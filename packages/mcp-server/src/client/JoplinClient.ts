import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';
import type { Resource } from '../schemas/resource.js';
import type { Revision } from '../schemas/revision.js';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const MAX_AUTO_PAGINATE_ITEMS = 200;
const PAGE_SIZE = 100;
const REVISION_SCAN_LIMIT = 500;
const NOTE_ITEM_TYPE = 1;

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

  async getNote(id: string, fields?: string): Promise<Note> {
    const fieldList = fields
      ? fields.split(',').map((field) => field.trim())
      : ['id', 'parent_id', 'title', 'body', 'markup_language', 'created_time', 'updated_time'];
    if (!fieldList.includes('markup_language')) {
      fieldList.push('markup_language');
    }
    return this.request<Note>(`/notes/${id}`, {}, { fields: fieldList.join(',') });
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

  async deleteNote(id: string, options: { permanent?: boolean } = {}): Promise<void> {
    await this.request<void>(`/notes/${id}`, { method: 'DELETE' }, options.permanent ? { permanent: 1 } : {});
  }

  async listNotes(options: { parentId?: string; tagId?: string; limit?: number } = {}): Promise<Note[]> {
    const path = options.tagId
      ? `/tags/${options.tagId}/notes`
      : options.parentId
        ? `/folders/${options.parentId}/notes`
        : '/notes';
    return this.listAll<Note>(path, { fields: 'id,parent_id,title,created_time,updated_time' }, options.limit);
  }

  async getNotebook(id: string): Promise<Notebook> {
    return this.request<Notebook>(`/folders/${id}`, {}, { fields: 'id,parent_id,title' });
  }

  async listNotebooks(options: { limit?: number } = {}): Promise<Notebook[]> {
    return this.listAll<Notebook>('/folders', { fields: 'id,parent_id,title' }, options.limit);
  }

  async createNotebook(input: { title: string; parent_id?: string }): Promise<Notebook> {
    return this.request<Notebook>('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async updateNotebook(id: string, input: Partial<{ title: string; parent_id: string }>): Promise<Notebook> {
    return this.request<Notebook>(`/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async deleteNotebook(id: string, options: { permanent?: boolean } = {}): Promise<void> {
    await this.request<void>(`/folders/${id}`, { method: 'DELETE' }, options.permanent ? { permanent: 1 } : {});
  }

  async getTag(id: string): Promise<Tag> {
    return this.request<Tag>(`/tags/${id}`, {}, { fields: 'id,title' });
  }

  async listTags(options: { limit?: number } = {}): Promise<Tag[]> {
    return this.listAll<Tag>('/tags', { fields: 'id,title' }, options.limit);
  }

  async createTag(input: { title: string }): Promise<Tag> {
    return this.request<Tag>('/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async updateTag(id: string, input: { title: string }): Promise<Tag> {
    return this.request<Tag>(`/tags/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
  }

  async deleteTag(id: string): Promise<void> {
    await this.request<void>(`/tags/${id}`, { method: 'DELETE' });
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

  async search(query: string, options: { type?: string; limit?: number } = {}): Promise<Note[]> {
    return this.listAll<Note>(
      '/search',
      { query, type: options.type, fields: 'id,parent_id,title' },
      options.limit,
    );
  }

  async createResource(input: { title: string; filename: string; data: Buffer; mime?: string }): Promise<Resource> {
    const form = new FormData();
    form.set('props', JSON.stringify({ title: input.title }));
    form.set('data', new Blob([input.data] as BlobPart[], { type: input.mime ?? 'application/octet-stream' }), input.filename);
    return this.request<Resource>('/resources', { method: 'POST', body: form });
  }

  async attachResourceToNote(noteId: string, resourceId: string, resourceTitle: string): Promise<Note> {
    const note = await this.getNote(noteId);
    const safeTitle = resourceTitle.replace(/[[\]]/g, '\\$&');
    const link = `\n\n[${safeTitle}](:/${resourceId})`;
    return this.updateNote(noteId, { body: (note.body ?? '') + link });
  }

  async getResource(id: string): Promise<Resource> {
    return this.request<Resource>(`/resources/${id}`, {}, {
      fields: 'id,title,mime,file_extension,size',
    });
  }

  async updateResource(
    id: string,
    input: { title?: string; data?: Buffer; filename?: string; mime?: string },
  ): Promise<Resource> {
    if (input.data) {
      const form = new FormData();
      if (input.title !== undefined) {
        form.set('props', JSON.stringify({ title: input.title }));
      }
      form.set('data', new Blob([input.data] as BlobPart[], { type: input.mime ?? 'application/octet-stream' }), input.filename ?? 'file');
      return this.request<Resource>(`/resources/${id}`, { method: 'PUT', body: form });
    }
    return this.request<Resource>(`/resources/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.title }),
    });
  }

  async deleteResource(id: string): Promise<void> {
    await this.request<void>(`/resources/${id}`, { method: 'DELETE' });
  }

  async getResourceFile(id: string): Promise<Buffer> {
    const url = this.buildUrl(`/resources/${id}/file`);
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new JoplinConnectionError();
    }
    if (!response.ok) {
      throw new JoplinApiError(response.status, await response.text());
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async listNoteResources(noteId: string, options: { limit?: number } = {}): Promise<Resource[]> {
    return this.listAll<Resource>(
      `/notes/${noteId}/resources`,
      { fields: 'id,title,mime,file_extension,size' },
      options.limit,
    );
  }

  async listRevisions(noteId: string): Promise<Revision[]> {
    const revisions = await this.listAll<Revision>(
      '/revisions',
      {
        fields: 'id,item_type,item_id,title_diff,body_diff,created_time,updated_time',
        order_by: 'created_time',
        order_dir: 'DESC',
      },
      REVISION_SCAN_LIMIT,
    );
    return revisions.filter((revision) => revision.item_type === NOTE_ITEM_TYPE && revision.item_id === noteId);
  }

  async deleteNoteRevisions(noteId: string): Promise<void> {
    await this.request<void>(`/notes/${noteId}/revisions`, { method: 'DELETE' });
  }

  async ping(): Promise<boolean> {
    const url = this.buildUrl('/ping');
    let response: Response;
    try {
      response = await this.fetchImpl(url);
    } catch {
      throw new JoplinConnectionError();
    }
    if (!response.ok) {
      throw new JoplinApiError(response.status, await response.text());
    }
    const text = await response.text();
    return text === 'JoplinClipperServer';
  }
}
