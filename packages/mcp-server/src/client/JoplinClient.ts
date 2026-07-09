import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_AUTO_PAGINATE_ITEMS = 200;
const PAGE_SIZE = 100;

interface ListResponse<T> {
  items: T[];
  has_more: boolean;
}

type QueryParams = Record<string, string | number | undefined>;

export class JoplinClient {
  constructor(
    private readonly config: JoplinConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  private buildUrl(path: string, params: QueryParams = {}): string {
    if (/\.\./.test(path) || /[?#%]/.test(path)) {
      throw new JoplinApiError(400, `Refusing to issue request for a path with unexpected characters: ${path}`);
    }
    const url = new URL(`http://${this.config.host}:${this.config.port}${path}`);
    url.searchParams.set('token', this.config.token);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request<T>(path: string, init: RequestInit = {}, params: QueryParams = {}): Promise<T> {
    const url = this.buildUrl(path, params);
    let response: Response;
    try {
      response = await this.fetchImpl(url, init);
    } catch {
      throw new JoplinConnectionError();
    }
    if (!response.ok) {
      const body = await response.text();
      throw new JoplinApiError(response.status, body || response.statusText);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  private async listAll<T>(path: string, params: QueryParams = {}, limit?: number): Promise<T[]> {
    const cap = limit ?? MAX_AUTO_PAGINATE_ITEMS;
    const results: T[] = [];
    let page = 1;
    while (results.length < cap) {
      const response = await this.request<ListResponse<T> | T[]>(path, {}, { ...params, page, limit: PAGE_SIZE });
      if (Array.isArray(response)) {
        // Some relation endpoints (e.g. /folders/:id/notes) return a bare array instead of
        // the { items, has_more } wrapper — treat that as the complete, unpaginated result.
        results.push(...response);
        break;
      }
      results.push(...response.items);
      if (!response.has_more) break;
      page += 1;
    }
    return results.slice(0, cap);
  }

  async getNote(id: string): Promise<Note> {
    return this.request<Note>(`/notes/${id}`, {}, {
      fields: 'id,parent_id,title,body,markup_language,created_time,updated_time',
    });
  }

  async createNote(input: { title: string; parent_id: string; body?: string; body_html?: string; markup_language?: number }): Promise<Note> {
    return this.request<Note>('/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async updateNote(id: string, input: Partial<{ title: string; body: string; body_html: string; parent_id: string; markup_language: number }>): Promise<Note> {
    return this.request<Note>(`/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async deleteNote(id: string): Promise<void> {
    await this.request<void>(`/notes/${id}`, { method: 'DELETE' });
  }

  async listNotes(options: { parentId?: string; limit?: number } = {}): Promise<Note[]> {
    const path = options.parentId ? `/folders/${options.parentId}/notes` : '/notes';
    return this.listAll<Note>(path, { fields: 'id,parent_id,title,created_time,updated_time' }, options.limit);
  }

  async listNotebooks(): Promise<Notebook[]> {
    return this.listAll<Notebook>('/folders', { fields: 'id,parent_id,title' });
  }

  async createNotebook(input: { title: string; parent_id?: string }): Promise<Notebook> {
    return this.request<Notebook>('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async listTags(): Promise<Tag[]> {
    return this.listAll<Tag>('/tags', { fields: 'id,title' });
  }

  async createTag(input: { title: string }): Promise<Tag> {
    return this.request<Tag>('/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async attachTag(noteId: string, tagId: string): Promise<void> {
    await this.request<void>(`/tags/${tagId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteId }),
    });
  }

  async detachTag(noteId: string, tagId: string): Promise<void> {
    await this.request<void>(`/tags/${tagId}/notes/${noteId}`, { method: 'DELETE' });
  }
}
