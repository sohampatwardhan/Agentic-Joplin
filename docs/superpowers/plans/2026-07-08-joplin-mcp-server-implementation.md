# Joplin MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a from-scratch MCP server that wraps Joplin's Data API so coding agents can create, read, update, delete, search, and attach files to Joplin notes, notebooks, and tags.

**Architecture:** A three-layer TypeScript package at `packages/mcp-server`: a `JoplinClient` that wraps Joplin's Data API over HTTP (knows nothing about MCP), MCP tool handlers that validate input with Zod and delegate to `JoplinClient`, and shared Zod schemas for Joplin entities (Note, Notebook, Tag, Resource). The server runs over stdio using `@modelcontextprotocol/sdk`.

**Tech Stack:** TypeScript (Node.js >=20), `@modelcontextprotocol/sdk` ^1.29.0, `zod` ^4.4.0, `vitest` ^4.1.0 for unit tests, npm workspaces.

**Reference:** [docs/superpowers/specs/2026-07-08-joplin-mcp-server-design.md](../specs/2026-07-08-joplin-mcp-server-design.md)

---

## Task 1: Monorepo & package scaffold

**Files:**
- Create: `package.json` (repo root)
- Create: `.gitignore` (repo root)
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/vitest.config.ts`

- [ ] **Step 1: Create the directories**

Run: `mkdir -p packages/mcp-server/src/client packages/mcp-server/src/schemas packages/mcp-server/src/tools packages/mcp-server/test/client packages/mcp-server/test/tools`

- [ ] **Step 2: Write the root workspace `package.json`**

```json
{
  "name": "agentic-joplin",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 3: Write the root `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Write `packages/mcp-server/package.json`**

```json
{
  "name": "@agentic-joplin/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^26.0.0",
    "typescript": "^7.0.0",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 5: Write `packages/mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Write `packages/mcp-server/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: Installs successfully, creates `package-lock.json`, and links `@agentic-joplin/mcp-server` as a workspace.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore package-lock.json packages/mcp-server/package.json packages/mcp-server/tsconfig.json packages/mcp-server/vitest.config.ts
git commit -m "chore: scaffold mcp-server package and npm workspace"
```

---

## Task 2: Config loader

**Files:**
- Create: `packages/mcp-server/src/config.ts`
- Test: `packages/mcp-server/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when JOPLIN_TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow(/JOPLIN_TOKEN/);
  });

  it('returns defaults for host and port when only token is set', () => {
    const config = loadConfig({ JOPLIN_TOKEN: 'abc123' });
    expect(config).toEqual({ token: 'abc123', host: '127.0.0.1', port: 41184 });
  });

  it('uses JOPLIN_HOST and JOPLIN_PORT overrides when set', () => {
    const config = loadConfig({
      JOPLIN_TOKEN: 'abc123',
      JOPLIN_HOST: '192.168.1.5',
      JOPLIN_PORT: '9999',
    });
    expect(config).toEqual({ token: 'abc123', host: '192.168.1.5', port: 9999 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../src/config.js'` (or similar resolution error).

- [ ] **Step 3: Write the implementation**

```typescript
export interface JoplinConfig {
  token: string;
  host: string;
  port: number;
}

export function loadConfig(env: Record<string, string | undefined>): JoplinConfig {
  const token = env.JOPLIN_TOKEN;
  if (!token) {
    throw new Error(
      'JOPLIN_TOKEN environment variable is required. Generate one in Joplin under Options > Web Clipper > Advanced options.',
    );
  }
  return {
    token,
    host: env.JOPLIN_HOST ?? '127.0.0.1',
    port: env.JOPLIN_PORT ? Number(env.JOPLIN_PORT) : 41184,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/config.ts packages/mcp-server/test/config.test.ts
git commit -m "feat: add env-based config loader"
```

---

## Task 3: Error types

**Files:**
- Create: `packages/mcp-server/src/client/errors.ts`
- Test: `packages/mcp-server/test/client/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

describe('JoplinConnectionError', () => {
  it('has a default human-readable message', () => {
    const error = new JoplinConnectionError();
    expect(error.name).toBe('JoplinConnectionError');
    expect(error.message).toMatch(/Web Clipper/);
  });

  it('accepts a custom message', () => {
    const error = new JoplinConnectionError('custom message');
    expect(error.message).toBe('custom message');
  });
});

describe('JoplinApiError', () => {
  it('carries the HTTP status code and message', () => {
    const error = new JoplinApiError(404, 'Not Found');
    expect(error.name).toBe('JoplinApiError');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/client/errors.js'`

- [ ] **Step 3: Write the implementation**

```typescript
export class JoplinConnectionError extends Error {
  constructor(message = 'Could not reach Joplin. Is Joplin running with the Web Clipper service enabled?') {
    super(message);
    this.name = 'JoplinConnectionError';
  }
}

export class JoplinApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'JoplinApiError';
    this.status = status;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/errors.ts packages/mcp-server/test/client/errors.test.ts
git commit -m "feat: add JoplinConnectionError and JoplinApiError"
```

---

## Task 4: Entity schemas

**Files:**
- Create: `packages/mcp-server/src/schemas/note.ts`
- Create: `packages/mcp-server/src/schemas/notebook.ts`
- Create: `packages/mcp-server/src/schemas/tag.ts`
- Create: `packages/mcp-server/src/schemas/resource.ts`
- Test: `packages/mcp-server/test/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { NoteSchema, noteFormatFromMarkupLanguage } from '../src/schemas/note.js';
import { NotebookSchema } from '../src/schemas/notebook.js';
import { TagSchema } from '../src/schemas/tag.js';
import { ResourceSchema } from '../src/schemas/resource.js';

describe('entity schemas', () => {
  it('parses a valid note', () => {
    const note = NoteSchema.parse({
      id: 'note-1',
      parent_id: 'nb-1',
      title: 'Hello',
      body: 'World',
      markup_language: 1,
      created_time: 1,
      updated_time: 2,
    });
    expect(note.title).toBe('Hello');
  });

  it('rejects a note missing a required field', () => {
    expect(() => NoteSchema.parse({ id: 'note-1', title: 'Hello' })).toThrow();
  });

  it('parses a valid notebook, including a root notebook with an empty parent_id', () => {
    const notebook = NotebookSchema.parse({ id: 'nb-1', parent_id: '', title: 'Work' });
    expect(notebook.title).toBe('Work');
  });

  it('parses a valid tag', () => {
    const tag = TagSchema.parse({ id: 'tag-1', title: 'urgent' });
    expect(tag.title).toBe('urgent');
  });

  it('parses a valid resource', () => {
    const resource = ResourceSchema.parse({
      id: 'res-1',
      title: 'photo.jpg',
      mime: 'image/jpeg',
      file_extension: 'jpg',
      size: 1024,
    });
    expect(resource.mime).toBe('image/jpeg');
  });
});

describe('noteFormatFromMarkupLanguage', () => {
  it('maps markup_language 2 to html', () => {
    expect(noteFormatFromMarkupLanguage(2)).toBe('html');
  });

  it('maps markup_language 1 to markdown', () => {
    expect(noteFormatFromMarkupLanguage(1)).toBe('markdown');
  });

  it('defaults to markdown when markup_language is undefined', () => {
    expect(noteFormatFromMarkupLanguage(undefined)).toBe('markdown');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../src/schemas/note.js'`

- [ ] **Step 3: Write `packages/mcp-server/src/schemas/note.ts`**

```typescript
import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  markup_language: z.number().optional(),
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
});

export type Note = z.infer<typeof NoteSchema>;

export type NoteFormat = 'markdown' | 'html';

/** Joplin stores markup_language as 1 (Markdown) or 2 (HTML); undefined/1 defaults to markdown. */
export function noteFormatFromMarkupLanguage(markupLanguage: number | undefined): NoteFormat {
  return markupLanguage === 2 ? 'html' : 'markdown';
}
```

- [ ] **Step 4: Write `packages/mcp-server/src/schemas/notebook.ts`**

```typescript
import { z } from 'zod';

export const NotebookSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  title: z.string(),
});

export type Notebook = z.infer<typeof NotebookSchema>;
```

- [ ] **Step 5: Write `packages/mcp-server/src/schemas/tag.ts`**

```typescript
import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export type Tag = z.infer<typeof TagSchema>;
```

- [ ] **Step 6: Write `packages/mcp-server/src/schemas/resource.ts`**

```typescript
import { z } from 'zod';

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  mime: z.string().optional(),
  file_extension: z.string().optional(),
  size: z.number().optional(),
});

export type Resource = z.infer<typeof ResourceSchema>;
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (8 tests)

- [ ] **Step 8: Commit**

```bash
git add packages/mcp-server/src/schemas packages/mcp-server/test/schemas.test.ts
git commit -m "feat: add Zod schemas for Note, Notebook, Tag, and Resource"
```

---

## Task 5: Notebook tree builder

**Files:**
- Create: `packages/mcp-server/src/client/notebookTree.ts`
- Test: `packages/mcp-server/test/client/notebookTree.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { buildNotebookTree } from '../../src/client/notebookTree.js';

describe('buildNotebookTree', () => {
  it('nests a child notebook under its parent', () => {
    const tree = buildNotebookTree([
      { id: 'root', parent_id: '', title: 'Root' },
      { id: 'child', parent_id: 'root', title: 'Child' },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('child');
  });

  it('treats a notebook with an unknown parent_id as a root', () => {
    const tree = buildNotebookTree([{ id: 'orphan', parent_id: 'missing', title: 'Orphan' }]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('supports multiple levels of nesting', () => {
    const tree = buildNotebookTree([
      { id: 'a', parent_id: '', title: 'A' },
      { id: 'b', parent_id: 'a', title: 'B' },
      { id: 'c', parent_id: 'b', title: 'C' },
    ]);
    expect(tree[0].children[0].children[0].id).toBe('c');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/client/notebookTree.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import type { Notebook } from '../schemas/notebook.js';

export interface NotebookTreeNode extends Notebook {
  children: NotebookTreeNode[];
}

export function buildNotebookTree(notebooks: Notebook[]): NotebookTreeNode[] {
  const byId = new Map<string, NotebookTreeNode>();
  for (const notebook of notebooks) {
    byId.set(notebook.id, { ...notebook, children: [] });
  }

  const roots: NotebookTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parent_id ? byId.get(node.parent_id) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/notebookTree.ts packages/mcp-server/test/client/notebookTree.test.ts
git commit -m "feat: add notebook tree builder for nested notebooks"
```

---

## Task 6: JoplinClient core + note methods

**Files:**
- Create: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.notes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient notes', () => {
  it('getNote requests the note with the expected fields and token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.getNote('n1');

    expect(note.title).toBe('Hi');
    const calledUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/notes/n1');
    expect(calledUrl.searchParams.get('token')).toBe('test-token');
    expect(calledUrl.searchParams.get('fields')).toContain('title');
    expect(calledUrl.searchParams.get('fields')).toContain('markup_language');
  });

  it('createNote posts the input as JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n2', parent_id: 'nb1', title: 'New' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.createNote({ title: 'New', parent_id: 'nb1', body: 'Body' });

    expect(note.id).toBe('n2');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'New', parent_id: 'nb1', body: 'Body' });
  });

  it('createNote sends body_html instead of body when creating an HTML note', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n3', parent_id: 'nb1', title: 'Rich' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.createNote({ title: 'Rich', parent_id: 'nb1', body_html: '<p>Hi</p>' });

    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ title: 'Rich', parent_id: 'nb1', body_html: '<p>Hi</p>' });
  });

  it('updateNote sends body_html when updating to HTML content', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.updateNote('n1', { body_html: '<p>Updated</p>' });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ body_html: '<p>Updated</p>' });
  });

  it('deleteNote sends a DELETE request and resolves with no value', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.deleteNote('n1')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
  });

  it('listNotes auto-paginates until has_more is false', async () => {
    const page1 = new Response(
      JSON.stringify({ items: [{ id: 'n1', parent_id: 'nb1', title: 'A' }], has_more: true }),
      { status: 200 },
    );
    const page2 = new Response(
      JSON.stringify({ items: [{ id: 'n2', parent_id: 'nb1', title: 'B' }], has_more: false }),
      { status: 200 },
    );
    const fetchImpl = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes();

    expect(notes).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('listNotes scoped to a notebook handles a bare-array response from the relation endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'n1', parent_id: 'nb1', title: 'A' }]), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes({ parentId: 'nb1' });

    expect(notes).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'A' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/folders/nb1/notes');
  });

  it('throws JoplinConnectionError when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.getNote('n1')).rejects.toBeInstanceOf(JoplinConnectionError);
  });

  it('throws JoplinApiError with the response status on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    const client = new JoplinClient(config, fetchImpl);

    // A single call is used here (not two separate `await expect(...)` calls) because the
    // mocked Response's body can only be read once via `.text()` per the Fetch spec; reusing
    // the same mock Response across two getNote calls throws "Body is unusable" on the second.
    await expect(client.getNote('missing')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(JoplinApiError);
      expect(error).toMatchObject({ status: 404 });
      return true;
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/client/JoplinClient.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';

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
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (9 tests). `listNotebooks` has no test yet — it is covered in Task 7.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.notes.test.ts
git commit -m "feat: add JoplinClient with request/pagination core and note methods"
```

---

## Task 7: JoplinClient notebook & tag methods

**Files:**
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.notebooksAndTags.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient notebooks and tags', () => {
  it('listNotebooks returns flat items with parent_id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 'root', parent_id: '', title: 'Root' },
            { id: 'child', parent_id: 'root', title: 'Child' },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notebooks = await client.listNotebooks();

    expect(notebooks).toHaveLength(2);
    expect(notebooks[1].parent_id).toBe('root');
  });

  it('createNotebook posts an optional parent_id for nesting', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'nb2', parent_id: 'nb1', title: 'Sub' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const notebook = await client.createNotebook({ title: 'Sub', parent_id: 'nb1' });

    expect(notebook.parent_id).toBe('nb1');
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ title: 'Sub', parent_id: 'nb1' });
  });

  it('createTag posts the tag title', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'tag1', title: 'urgent' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const tag = await client.createTag({ title: 'urgent' });

    expect(tag.title).toBe('urgent');
  });

  it('attachTag posts the note id to the tag notes endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.attachTag('note1', 'tag1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/tags/tag1/notes');
    expect(JSON.parse(init.body)).toEqual({ id: 'note1' });
  });

  it('detachTag sends a DELETE to the tag/note pair', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.detachTag('note1', 'tag1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/tags/tag1/notes/note1');
    expect(init.method).toBe('DELETE');
  });

  it('listTags returns all tags', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 'tag1', title: 'urgent' }], has_more: false }), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const tags = await client.listTags();

    expect(tags).toEqual([{ id: 'tag1', title: 'urgent' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `client.createNotebook is not a function` (and similar for the other new methods)

- [ ] **Step 3: Add notebook and tag methods to `JoplinClient`**

Add the following imports and methods to `packages/mcp-server/src/client/JoplinClient.ts` (import `Tag` alongside the existing imports, and append the methods after `listNotebooks`):

```typescript
import type { Tag } from '../schemas/tag.js';
```

```typescript
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
```

The full file should now read:

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests across both `JoplinClient.notes.test.ts` and `JoplinClient.notebooksAndTags.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.notebooksAndTags.test.ts
git commit -m "feat: add notebook and tag methods to JoplinClient"
```

---

## Task 8: JoplinClient search & resource methods

**Files:**
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.searchAndResources.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient search and resources', () => {
  it('search sends the query and optional type as query params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 'n1', parent_id: 'nb1', title: 'Match' }], has_more: false }), {
        status: 200,
      }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const results = await client.search('recipes', { type: 'note' });

    expect(results).toHaveLength(1);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('query')).toBe('recipes');
    expect(url.searchParams.get('type')).toBe('note');
  });

  it('createResource sends a multipart form with props and file data', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'photo.jpg' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const resource = await client.createResource({
      title: 'photo.jpg',
      filename: 'photo.jpg',
      data: Buffer.from('fake-image-bytes'),
      mime: 'image/jpeg',
    });

    expect(resource.id).toBe('res1');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('attachResourceToNote appends a markdown resource link to the note body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'note1', parent_id: 'nb1', title: 'Note', body: 'Existing body' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: 'Existing body\n\n[photo.jpg](:/res1)',
          }),
          { status: 200 },
        ),
      );
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.attachResourceToNote('note1', 'res1', 'photo.jpg');

    expect(note.body).toContain('[photo.jpg](:/res1)');
    const [, updateInit] = fetchImpl.mock.calls[1];
    expect(JSON.parse(updateInit.body).body).toBe('Existing body\n\n[photo.jpg](:/res1)');
  });

  it('getResourceFile returns the raw file bytes as a Buffer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const buffer = await client.getResourceFile('res1');

    expect(Buffer.compare(buffer, Buffer.from([1, 2, 3]))).toBe(0);
  });

  it('getResource fetches resource metadata by id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'photo.jpg' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const resource = await client.getResource('res1');

    expect(resource.title).toBe('photo.jpg');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `client.search is not a function` (and similar for the other new methods)

- [ ] **Step 3: Add search and resource methods to `JoplinClient`**

Add the import and methods below to `packages/mcp-server/src/client/JoplinClient.ts` (import `Resource` alongside the existing imports, and append the methods at the end of the class):

```typescript
import type { Resource } from '../schemas/resource.js';
```

```typescript
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

  async listNoteResources(noteId: string): Promise<Resource[]> {
    return this.listAll<Resource>(`/notes/${noteId}/resources`, {
      fields: 'id,title,mime,file_extension,size',
    });
  }
```

The full file should now read (this is the final, complete state of `JoplinClient.ts` for Phase 1):

```typescript
import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';
import type { Resource } from '../schemas/resource.js';

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

  async listNoteResources(noteId: string): Promise<Resource[]> {
    return this.listAll<Resource>(`/notes/${noteId}/resources`, {
      fields: 'id,title,mime,file_extension,size',
    });
  }
}
```

This covers notes, notebook creation/listing, tag creation/listing, search, and resource upload/read. The remaining full-CRUD methods for notebooks and tags (`getNotebook`, `updateNotebook`, `deleteNotebook`, `getTag`, `updateTag`, `deleteTag`), resource update/delete (`updateResource`, `deleteResource`), revisions (`listRevisions`, `deleteNoteRevisions`), and `ping` are added in Tasks 16–19; Task 19 shows the complete final file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests across all `JoplinClient.*.test.ts` files)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.searchAndResources.test.ts
git commit -m "feat: add search and resource methods to JoplinClient"
```

---

## Task 9: Shared tool-error helper + note tools

**Files:**
- Create: `packages/mcp-server/src/tools/toolError.ts`
- Create: `packages/mcp-server/src/tools/notes.ts`
- Test: `packages/mcp-server/test/tools/toolError.test.ts`
- Test: `packages/mcp-server/test/tools/notes.test.ts`

- [ ] **Step 1: Write the failing test for the tool-error helper**

```typescript
import { describe, expect, it } from 'vitest';
import { toToolError } from '../../src/tools/toolError.js';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

describe('toToolError', () => {
  it('maps a JoplinApiError to an isError result with its message', () => {
    const result = toToolError(new JoplinApiError(404, 'Not Found'));
    expect(result).toEqual({ content: [{ type: 'text', text: 'Not Found' }], isError: true });
  });

  it('maps a JoplinConnectionError to an isError result with its message', () => {
    const result = toToolError(new JoplinConnectionError('Is Joplin running?'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Is Joplin running?');
  });

  it('maps an unknown error to a generic isError result', () => {
    const result = toToolError(new Error('boom'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Unexpected error: boom');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/toolError.js'`

- [ ] **Step 3: Write `packages/mcp-server/src/tools/toolError.ts`**

```typescript
import { JoplinApiError, JoplinConnectionError } from '../client/errors.js';

export function toToolError(error: unknown): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message =
    error instanceof JoplinConnectionError || error instanceof JoplinApiError
      ? error.message
      : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: 'text', text: message }], isError: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for note tools**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { registerNoteTools } from '../../src/tools/notes.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerNoteTools', () => {
  it('registers create_note, get_note, update_note, delete_note, and list_notes', () => {
    const server = createFakeServer();
    registerNoteTools(server as any, {} as any);

    expect([...server.tools.keys()]).toEqual([
      'create_note',
      'get_note',
      'update_note',
      'delete_note',
      'list_notes',
    ]);
  });

  it('create_note rejects input missing a required field', () => {
    const server = createFakeServer();
    registerNoteTools(server as any, {} as any);

    const shape = server.tools.get('create_note')!.config.inputSchema;
    const result = z.object(shape).safeParse({ title: 'Missing notebook' });

    expect(result.success).toBe(false);
  });

  it('create_note calls JoplinClient.createNote with mapped fields, defaulting to markdown', async () => {
    const client = { createNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('create_note')!.handler({
      title: 'Hi',
      body: 'World',
      notebook_id: 'nb1',
    });

    expect(client.createNote).toHaveBeenCalledWith({ title: 'Hi', parent_id: 'nb1', body: 'World' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('n1');
  });

  it('create_note sends body_html instead of body when format is html', async () => {
    const client = { createNote: vi.fn().mockResolvedValue({ id: 'n2', parent_id: 'nb1', title: 'Rich' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('create_note')!.handler({
      title: 'Rich',
      body: '<p>Hi</p>',
      format: 'html',
      notebook_id: 'nb1',
    });

    expect(client.createNote).toHaveBeenCalledWith({
      title: 'Rich',
      parent_id: 'nb1',
      body_html: '<p>Hi</p>',
      markup_language: 2,
    });
  });

  it('get_note maps a JoplinApiError into an isError tool result', async () => {
    const { JoplinApiError } = await import('../../src/client/errors.js');
    const client = { getNote: vi.fn().mockRejectedValue(new JoplinApiError(404, 'Not Found')) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('get_note')!.handler({ note_id: 'missing' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Not Found');
  });

  it('get_note includes a friendly format field derived from markup_language', async () => {
    const client = {
      getNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi', markup_language: 2 }),
    };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('get_note')!.handler({ note_id: 'n1' });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.format).toBe('html');
  });

  it('update_note sends body_html when format is html and body is set', async () => {
    const client = { updateNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('update_note')!.handler({ note_id: 'n1', body: '<p>Updated</p>', format: 'html' });

    expect(client.updateNote).toHaveBeenCalledWith('n1', {
      title: undefined,
      parent_id: undefined,
      body_html: '<p>Updated</p>',
      markup_language: 2,
    });
  });

  it('update_note omits body fields entirely when body is not provided', async () => {
    const client = { updateNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'New title' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('update_note')!.handler({ note_id: 'n1', title: 'New title' });

    expect(client.updateNote).toHaveBeenCalledWith('n1', { title: 'New title', parent_id: undefined });
  });

  it('list_notes passes notebook_id and limit through to JoplinClient.listNotes', async () => {
    const client = { listNotes: vi.fn().mockResolvedValue([]) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('list_notes')!.handler({ notebook_id: 'nb1', limit: 5 });

    expect(client.listNotes).toHaveBeenCalledWith({ parentId: 'nb1', limit: 5 });
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/notes.js'`

- [ ] **Step 7: Write `packages/mcp-server/src/tools/notes.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { noteFormatFromMarkupLanguage } from '../schemas/note.js';
import { toToolError } from './toolError.js';

export function registerNoteTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'create_note',
    {
      description: 'Create a new Joplin note in the given notebook, in Markdown or HTML format.',
      inputSchema: {
        title: z.string().describe('Note title'),
        body: z.string().optional().describe('Note body, in the format given by "format"'),
        format: z.enum(['markdown', 'html']).default('markdown').describe('Format of the body content'),
        notebook_id: z.string().describe('ID of the notebook to create the note in'),
      },
    },
    async ({ title, body, format, notebook_id }) => {
      try {
        const note =
          format === 'html'
            ? await client.createNote({ title, parent_id: notebook_id, body_html: body, markup_language: 2 })
            : await client.createNote({ title, parent_id: notebook_id, body });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_note',
    {
      description: 'Fetch a Joplin note by ID. The result includes a "format" field (markdown or html).',
      inputSchema: {
        note_id: z.string().describe('ID of the note to fetch'),
      },
    },
    async ({ note_id }) => {
      try {
        const note = await client.getNote(note_id);
        const format = noteFormatFromMarkupLanguage(note.markup_language);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...note, format }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_note',
    {
      description: 'Partially update a Joplin note by ID. Set "format" to control how "body" is interpreted.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to update'),
        title: z.string().optional().describe('New title'),
        body: z.string().optional().describe('New body, in the format given by "format"'),
        format: z.enum(['markdown', 'html']).optional().describe('Format of the body content, if body is set'),
        notebook_id: z.string().optional().describe('Move the note to this notebook ID'),
      },
    },
    async ({ note_id, title, body, format, notebook_id }) => {
      try {
        const bodyFields =
          body === undefined ? {} : format === 'html' ? { body_html: body, markup_language: 2 } : { body };
        const note = await client.updateNote(note_id, { title, parent_id: notebook_id, ...bodyFields });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_note',
    {
      description: 'Delete a Joplin note by ID.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to delete'),
      },
    },
    async ({ note_id }) => {
      try {
        await client.deleteNote(note_id);
        return { content: [{ type: 'text' as const, text: `Deleted note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List Joplin notes, optionally scoped to a notebook.',
      inputSchema: {
        notebook_id: z.string().optional().describe('Only list notes in this notebook ID'),
        limit: z.number().int().positive().optional().describe('Maximum number of notes to return'),
      },
    },
    async ({ notebook_id, limit }) => {
      try {
        const notes = await client.listNotes({ parentId: notebook_id, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notes) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests in `toolError.test.ts` and `notes.test.ts`)

- [ ] **Step 9: Commit**

```bash
git add packages/mcp-server/src/tools/toolError.ts packages/mcp-server/src/tools/notes.ts packages/mcp-server/test/tools/toolError.test.ts packages/mcp-server/test/tools/notes.test.ts
git commit -m "feat: add note MCP tools (create_note, get_note, update_note, delete_note, list_notes)"
```

---

## Task 10: Notebook tools

**Files:**
- Create: `packages/mcp-server/src/tools/notebooks.ts`
- Test: `packages/mcp-server/test/tools/notebooks.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerNotebookTools } from '../../src/tools/notebooks.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerNotebookTools', () => {
  it('list_notebooks returns both the flat list and a nested tree', async () => {
    const client = {
      listNotebooks: vi.fn().mockResolvedValue([
        { id: 'root', parent_id: '', title: 'Root' },
        { id: 'child', parent_id: 'root', title: 'Child' },
      ]),
    };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    const result = await server.tools.get('list_notebooks')!.handler({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.flat).toHaveLength(2);
    expect(payload.tree[0].children[0].id).toBe('child');
  });

  it('create_notebook forwards an optional parent_id for nesting', async () => {
    const client = { createNotebook: vi.fn().mockResolvedValue({ id: 'nb2', parent_id: 'nb1', title: 'Sub' }) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    await server.tools.get('create_notebook')!.handler({ title: 'Sub', parent_id: 'nb1' });

    expect(client.createNotebook).toHaveBeenCalledWith({ title: 'Sub', parent_id: 'nb1' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/notebooks.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { buildNotebookTree } from '../client/notebookTree.js';
import { toToolError } from './toolError.js';

export function registerNotebookTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_notebooks',
    {
      description: 'List Joplin notebooks as both a flat list and a nested tree (notebooks can be nested).',
      inputSchema: {},
    },
    async () => {
      try {
        const notebooks = await client.listNotebooks();
        const tree = buildNotebookTree(notebooks);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ flat: notebooks, tree }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_notebook',
    {
      description: 'Create a new Joplin notebook, optionally nested under a parent notebook.',
      inputSchema: {
        title: z.string().describe('Notebook title'),
        parent_id: z.string().optional().describe('ID of the parent notebook, for nesting'),
      },
    },
    async ({ title, parent_id }) => {
      try {
        const notebook = await client.createNotebook({ title, parent_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/notebooks.ts packages/mcp-server/test/tools/notebooks.test.ts
git commit -m "feat: add notebook MCP tools (list_notebooks, create_notebook)"
```

---

## Task 11: Tag tools

**Files:**
- Create: `packages/mcp-server/src/tools/tags.ts`
- Test: `packages/mcp-server/test/tools/tags.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerTagTools } from '../../src/tools/tags.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerTagTools', () => {
  it('tag_note calls JoplinClient.attachTag with note_id and tag_id', async () => {
    const client = { attachTag: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    const result = await server.tools.get('tag_note')!.handler({ note_id: 'n1', tag_id: 't1' });

    expect(client.attachTag).toHaveBeenCalledWith('n1', 't1');
    expect(result.isError).toBeUndefined();
  });

  it('untag_note calls JoplinClient.detachTag with note_id and tag_id', async () => {
    const client = { detachTag: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    await server.tools.get('untag_note')!.handler({ note_id: 'n1', tag_id: 't1' });

    expect(client.detachTag).toHaveBeenCalledWith('n1', 't1');
  });

  it('create_tag calls JoplinClient.createTag with the title', async () => {
    const client = { createTag: vi.fn().mockResolvedValue({ id: 't1', title: 'urgent' }) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    await server.tools.get('create_tag')!.handler({ title: 'urgent' });

    expect(client.createTag).toHaveBeenCalledWith({ title: 'urgent' });
  });

  it('list_tags calls JoplinClient.listTags', async () => {
    const client = { listTags: vi.fn().mockResolvedValue([{ id: 't1', title: 'urgent' }]) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    const result = await server.tools.get('list_tags')!.handler({});

    expect(client.listTags).toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 't1', title: 'urgent' }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/tags.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerTagTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_tags',
    {
      description: 'List all Joplin tags.',
      inputSchema: {},
    },
    async () => {
      try {
        const tags = await client.listTags();
        return { content: [{ type: 'text' as const, text: JSON.stringify(tags) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_tag',
    {
      description: 'Create a new Joplin tag.',
      inputSchema: {
        title: z.string().describe('Tag title'),
      },
    },
    async ({ title }) => {
      try {
        const tag = await client.createTag({ title });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'tag_note',
    {
      description: 'Attach an existing tag to a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to attach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.attachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Attached tag ${tag_id} to note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'untag_note',
    {
      description: 'Detach a tag from a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to detach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.detachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Detached tag ${tag_id} from note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/tags.ts packages/mcp-server/test/tools/tags.test.ts
git commit -m "feat: add tag MCP tools (list_tags, create_tag, tag_note, untag_note)"
```

---

## Task 12: Search tool

**Files:**
- Create: `packages/mcp-server/src/tools/search.ts`
- Test: `packages/mcp-server/test/tools/search.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerSearchTools } from '../../src/tools/search.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerSearchTools', () => {
  it('find_notes forwards the query, type, and limit to JoplinClient.search', async () => {
    const client = { search: vi.fn().mockResolvedValue([{ id: 'n1', parent_id: 'nb1', title: 'Match' }]) };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({ query: 'recipes', type: 'note', limit: 10 });

    expect(client.search).toHaveBeenCalledWith('recipes', { type: 'note', limit: 10 });
    expect(JSON.parse(result.content[0].text)).toHaveLength(1);
  });

  it("find_notes maps the agent-facing type 'notebook' to Joplin's 'folder' value", async () => {
    const client = { search: vi.fn().mockResolvedValue([]) };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    await server.tools.get('find_notes')!.handler({ query: 'recipes', type: 'notebook' });

    expect(client.search).toHaveBeenCalledWith('recipes', { type: 'folder', limit: undefined });
  });

  it('find_notes rejects an input missing the required query field', async () => {
    const { z } = await import('zod');
    const server = createFakeServer();
    registerSearchTools(server as any, { search: vi.fn() } as any);

    const shape = server.tools.get('find_notes')!.config.inputSchema;
    const result = z.object(shape).safeParse({ type: 'note' });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/search.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerSearchTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'find_notes',
    {
      description: 'Full-text search for notes, optionally filtered by item type.',
      inputSchema: {
        query: z.string().describe('Search query; supports the * wildcard'),
        type: z
          .enum(['note', 'notebook', 'tag'])
          .optional()
          .describe("Restrict results to this item type ('notebook' is mapped to Joplin's 'folder' value)"),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return'),
      },
    },
    async ({ query, type, limit }) => {
      try {
        const joplinType = type === 'notebook' ? 'folder' : type;
        const results = await client.search(query, { type: joplinType, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(results) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/search.ts packages/mcp-server/test/tools/search.test.ts
git commit -m "feat: add find_notes MCP tool"
```

---

## Task 13: Resource tools

**Files:**
- Create: `packages/mcp-server/src/tools/resources.ts`
- Test: `packages/mcp-server/test/tools/resources.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerResourceTools } from '../../src/tools/resources.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerResourceTools', () => {
  it('attach_resource decodes base64, creates the resource, and attaches it to the note', async () => {
    const client = {
      createResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'photo.jpg' }),
      attachResourceToNote: vi.fn().mockResolvedValue({ id: 'note1', parent_id: 'nb1', title: 'Note' }),
    };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const base64 = Buffer.from('fake-bytes').toString('base64');
    await server.tools.get('attach_resource')!.handler({
      note_id: 'note1',
      filename: 'photo.jpg',
      file_base64: base64,
      mime: 'image/jpeg',
    });

    expect(client.createResource).toHaveBeenCalledWith({
      title: 'photo.jpg',
      filename: 'photo.jpg',
      data: Buffer.from('fake-bytes'),
      mime: 'image/jpeg',
    });
    expect(client.attachResourceToNote).toHaveBeenCalledWith('note1', 'res1', 'photo.jpg');
  });

  it('attach_resource uses the provided title over the filename when given', async () => {
    const client = {
      createResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'My Photo' }),
      attachResourceToNote: vi.fn().mockResolvedValue({ id: 'note1', parent_id: 'nb1', title: 'Note' }),
    };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    await server.tools.get('attach_resource')!.handler({
      note_id: 'note1',
      filename: 'photo.jpg',
      file_base64: Buffer.from('fake-bytes').toString('base64'),
      title: 'My Photo',
    });

    expect(client.createResource).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'My Photo' }),
    );
  });

  it('get_resource returns metadata only by default', async () => {
    const client = {
      getResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'photo.jpg' }),
      getResourceFile: vi.fn(),
    };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const result = await server.tools.get('get_resource')!.handler({ resource_id: 'res1' });

    expect(client.getResourceFile).not.toHaveBeenCalled();
    expect(JSON.parse(result.content[0].text)).toEqual({ id: 'res1', title: 'photo.jpg' });
  });

  it('get_resource includes base64 content when include_content is true', async () => {
    const client = {
      getResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'photo.jpg' }),
      getResourceFile: vi.fn().mockResolvedValue(Buffer.from('fake-bytes')),
    };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const result = await server.tools.get('get_resource')!.handler({ resource_id: 'res1', include_content: true });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.content_base64).toBe(Buffer.from('fake-bytes').toString('base64'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/resources.js'`

- [ ] **Step 3: Write the implementation**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerResourceTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'attach_resource',
    {
      description:
        'Upload a file and attach it to a note as a resource. Note: this reads the note body and writes back an appended link as two separate requests, so a concurrent edit to the same note (in the Joplin UI, via sync, or another tool call) between the read and write can be overwritten.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to attach the file to'),
        filename: z.string().describe('File name, including extension'),
        file_base64: z.string().describe('Base64-encoded file content'),
        title: z.string().optional().describe('Resource title; defaults to the filename'),
        mime: z.string().optional().describe('MIME type of the file'),
      },
    },
    async ({ note_id, filename, file_base64, title, mime }) => {
      try {
        const data = Buffer.from(file_base64, 'base64');
        const resourceTitle = title ?? filename;
        const resource = await client.createResource({ title: resourceTitle, filename, data, mime });
        const note = await client.attachResourceToNote(note_id, resource.id, resourceTitle);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ resource, note }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_resource',
    {
      description: "Fetch a resource's metadata, and optionally its file content as base64.",
      inputSchema: {
        resource_id: z.string().describe('ID of the resource'),
        include_content: z.boolean().optional().describe('Include the base64-encoded file content'),
      },
    },
    async ({ resource_id, include_content }) => {
      try {
        const resource = await client.getResource(resource_id);
        if (!include_content) {
          return { content: [{ type: 'text' as const, text: JSON.stringify(resource) }] };
        }
        const file = await client.getResourceFile(resource_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ...resource, content_base64: file.toString('base64') }),
            },
          ],
        };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/resources.ts packages/mcp-server/test/tools/resources.test.ts
git commit -m "feat: add resource MCP tools (attach_resource, get_resource)"
```

---

## Task 14: Server entrypoint

**Files:**
- Create: `packages/mcp-server/src/index.ts`

- [ ] **Step 1: Write the implementation**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { JoplinClient } from './client/JoplinClient.js';
import { registerNoteTools } from './tools/notes.js';
import { registerNotebookTools } from './tools/notebooks.js';
import { registerTagTools } from './tools/tags.js';
import { registerSearchTools } from './tools/search.js';
import { registerResourceTools } from './tools/resources.js';

async function main() {
  const config = loadConfig(process.env);
  const client = new JoplinClient(config);

  const server = new McpServer({ name: 'agentic-joplin-mcp-server', version: '0.1.0' });

  registerNoteTools(server, client);
  registerNotebookTools(server, client);
  registerTagTools(server, client);
  registerSearchTools(server, client);
  registerResourceTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agentic Joplin MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting Agentic Joplin MCP server:', error);
  process.exit(1);
});
```

There is no unit test for this file — it wires real I/O (stdio) which is exercised by the manual smoke test in Task 15, not by an automated test. Instead, this task is verified by a successful full build.

- [ ] **Step 2: Run the full test suite and the build**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (every test from Tasks 2–13)

Run: `npm run build --workspace @agentic-joplin/mcp-server`
Expected: Compiles with no TypeScript errors; `packages/mcp-server/dist/index.js` is created.

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/src/index.ts
git commit -m "feat: wire up MCP server entrypoint over stdio"
```

---

## Task 15: Manual smoke-test checklist & package README

**Files:**
- Create: `packages/mcp-server/SMOKE_TEST.md`
- Create: `packages/mcp-server/README.md`

- [ ] **Step 1: Write `packages/mcp-server/SMOKE_TEST.md`**

```markdown
# Manual Smoke Test — Joplin MCP Server

Run these checks against a real running Joplin desktop app before each release.

Requires:
- Joplin desktop running
- Web Clipper service enabled (Options > Web Clipper) with an API token generated
- `JOPLIN_TOKEN` (and `JOPLIN_HOST` / `JOPLIN_PORT` if non-default) exported in your shell

Build first: `npm run build --workspace @agentic-joplin/mcp-server`

Then connect an MCP client (e.g. Claude Code) to `node packages/mcp-server/dist/index.js` with the env vars above, and run through:

- [ ] `create_note` — create a note in an existing notebook; verify it appears in Joplin.
- [ ] `create_note` with `format: "html"` — create a note with an HTML body; verify Joplin renders it as HTML (not literal Markdown-escaped tags), and that `get_note` reports `format: "html"` for it.
- [ ] `list_notes` — list notes in that notebook; verify the new note is present.
- [ ] `find_notes` — search for the note by a word from its title; verify it's found.
- [ ] `create_notebook` with a `parent_id` — verify the new notebook appears nested under the parent in Joplin's sidebar.
- [ ] `attach_resource` — attach a small image file to the note; verify the note body now contains a `[title](:/resourceId)` link and the image renders in Joplin.
- [ ] `get_resource` with `include_content: true` — verify the returned `content_base64` decodes back to the original file.
- [ ] `tag_note` / `untag_note` — attach then remove a tag from the note; verify in Joplin's tag panel.
- [ ] `delete_note` — delete the test note; verify it's gone (or in Joplin's trash, per Joplin's delete behavior).
- [ ] Stop the Joplin desktop app, then call any tool — verify the error message mentions the Web Clipper service rather than a raw connection error.
```

- [ ] **Step 2: Write `packages/mcp-server/README.md`**

```markdown
# @agentic-joplin/mcp-server

An MCP server that lets agents manage Joplin notes, notebooks, tags, search, and resources via Joplin's Data API.

## Setup

1. In the Joplin desktop app, go to **Options > Web Clipper** and note the port (default `41184`), then generate an API token.
2. Install and build: `npm install && npm run build --workspace @agentic-joplin/mcp-server`
3. Add it to your MCP client config (e.g. Claude Code), running `node packages/mcp-server/dist/index.js` with these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | Yes | — | API token from Joplin's Web Clipper settings |
| `JOPLIN_HOST` | No | `127.0.0.1` | Host where Joplin's Web Clipper service is listening |
| `JOPLIN_PORT` | No | `41184` | Port where Joplin's Web Clipper service is listening |

Joplin desktop must be running with the Web Clipper service enabled for any tool call to succeed.

## Tools

| Tool | Purpose |
|---|---|
| `create_note` | Create a note in a notebook, in Markdown (default) or HTML via `format` |
| `get_note` | Fetch a note by ID; result includes a `format` field |
| `update_note` | Partially update a note; `format` controls how `body` is interpreted |
| `delete_note` | Delete a note |
| `list_notes` | List notes, optionally scoped to a notebook |
| `list_notebooks` | List notebooks as a flat list and a nested tree |
| `create_notebook` | Create a notebook, optionally nested |
| `list_tags` | List all tags |
| `create_tag` | Create a tag |
| `tag_note` / `untag_note` | Attach/detach a tag on a note |
| `find_notes` | Full-text search |
| `attach_resource` | Upload and attach a file to a note |
| `get_resource` | Fetch resource metadata, optionally with file content |

## Development

- `npm run test --workspace @agentic-joplin/mcp-server` — unit tests (mocked Data API, no Joplin instance required)
- `npm run build --workspace @agentic-joplin/mcp-server` — type-check and compile
- See `SMOKE_TEST.md` for the manual release checklist against a real Joplin instance.
```

- [ ] **Step 3: Commit**

```bash
git add packages/mcp-server/SMOKE_TEST.md packages/mcp-server/README.md
git commit -m "docs: add smoke-test checklist and package README"
```

---

## Task 16: JoplinClient — permanent delete & tag-scoped note listing

**Files:**
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.deleteAndTagScoping.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient permanent delete and tag-scoped listing', () => {
  it('deleteNote sends permanent=1 when requested', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNote('n1', { permanent: true });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/notes/n1');
    expect(url.searchParams.get('permanent')).toBe('1');
  });

  it('deleteNote omits the permanent param by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNote('n1');

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.searchParams.has('permanent')).toBe(false);
  });

  it('rejects an id containing path traversal before issuing any request', async () => {
    const fetchImpl = vi.fn();
    const client = new JoplinClient(config, fetchImpl);

    // A traversal id like '../folders/nb1' would otherwise normalize to DELETE /folders/nb1.
    await expect(client.deleteNote('../folders/nb1')).rejects.toThrow(/unexpected characters/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('listNotes scoped to a tag requests /tags/:id/notes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'n1', parent_id: 'nb1', title: 'A' }]), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes({ tagId: 'tag1' });

    expect(notes).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'A' }]);
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/tags/tag1/notes');
  });

  it('listNotes prefers tagId over parentId when both are given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.listNotes({ tagId: 'tag1', parentId: 'nb1' });

    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/tags/tag1/notes');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `deleteNote`/`listNotes` don't accept these new options, so the assertions on their outgoing request URLs fail.

- [ ] **Step 3: Replace `deleteNote` and `listNotes` in `JoplinClient.ts`**

Replace the existing `deleteNote` and `listNotes` methods with:

```typescript
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
```

The full file should now read:

```typescript
import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';
import type { Resource } from '../schemas/resource.js';

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

  async listNoteResources(noteId: string): Promise<Resource[]> {
    return this.listAll<Resource>(`/notes/${noteId}/resources`, {
      fields: 'id,title,mime,file_extension,size',
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests, including the 5 new ones in this file)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.deleteAndTagScoping.test.ts
git commit -m "feat: add permanent delete option and tag-scoped listing to JoplinClient"
```

---

## Task 17: JoplinClient — notebook & tag full CRUD

**Files:**
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.notebookAndTagCrud.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient notebook and tag CRUD', () => {
  it('getNotebook fetches a notebook by id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'nb1', parent_id: '', title: 'Work' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const notebook = await client.getNotebook('nb1');

    expect(notebook.title).toBe('Work');
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/folders/nb1');
  });

  it('updateNotebook sends the given fields as JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'nb1', parent_id: 'nb2', title: 'Renamed' }), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notebook = await client.updateNotebook('nb1', { title: 'Renamed', parent_id: 'nb2' });

    expect(notebook.title).toBe('Renamed');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ title: 'Renamed', parent_id: 'nb2' });
  });

  it('deleteNotebook sends permanent=1 when requested', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNotebook('nb1', { permanent: true });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/folders/nb1');
    expect(url.searchParams.get('permanent')).toBe('1');
  });

  it('getTag fetches a tag by id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'tag1', title: 'urgent' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const tag = await client.getTag('tag1');

    expect(tag.title).toBe('urgent');
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/tags/tag1');
  });

  it('updateTag renames a tag', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'tag1', title: 'renamed' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const tag = await client.updateTag('tag1', { title: 'renamed' });

    expect(tag.title).toBe('renamed');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ title: 'renamed' });
  });

  it('deleteTag sends a DELETE request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteTag('tag1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/tags/tag1');
    expect(init.method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `client.getNotebook is not a function` (and similarly for the other new methods)

- [ ] **Step 3: Add notebook and tag CRUD methods to `JoplinClient.ts`**

Add `getNotebook` immediately before `listNotebooks`:

```typescript
  async getNotebook(id: string): Promise<Notebook> {
    return this.request<Notebook>(`/folders/${id}`, {}, { fields: 'id,parent_id,title' });
  }
```

Add `updateNotebook` and `deleteNotebook` immediately after `createNotebook`:

```typescript
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
```

Add `getTag` immediately before `listTags`:

```typescript
  async getTag(id: string): Promise<Tag> {
    return this.request<Tag>(`/tags/${id}`, {}, { fields: 'id,title' });
  }
```

Add `updateTag` and `deleteTag` immediately after `createTag`:

```typescript
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
```

The full file should now read:

```typescript
import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';
import type { Resource } from '../schemas/resource.js';

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

  async listNoteResources(noteId: string): Promise<Resource[]> {
    return this.listAll<Resource>(`/notes/${noteId}/resources`, {
      fields: 'id,title,mime,file_extension,size',
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests, including the 6 new ones in this file)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.notebookAndTagCrud.test.ts
git commit -m "feat: add full CRUD (get/update/delete) for notebooks and tags to JoplinClient"
```

---

## Task 18: JoplinClient — resource update & delete

**Files:**
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.resourceCrud.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient resource update and delete', () => {
  it('updateResource sends JSON props only when no new file data is given', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'New title' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const resource = await client.updateResource('res1', { title: 'New title' });

    expect(resource.title).toBe('New title');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ title: 'New title' });
  });

  it('updateResource sends multipart form data when replacing file content', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'photo.jpg' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.updateResource('res1', {
      title: 'photo.jpg',
      data: Buffer.from('new-bytes'),
      filename: 'photo.jpg',
      mime: 'image/jpeg',
    });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('deleteResource sends a DELETE request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteResource('res1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/resources/res1');
    expect(init.method).toBe('DELETE');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `client.updateResource is not a function` (and similarly for `deleteResource`)

- [ ] **Step 3: Add `updateResource` and `deleteResource` to `JoplinClient.ts`**

Add both methods immediately after `getResource` (before `getResourceFile`):

```typescript
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
```

The `getResource` / `updateResource` / `deleteResource` / `getResourceFile` block should now read, in order:

```typescript
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
```

Everything else in the file (all methods before `getResource` and `listNoteResources` after `getResourceFile`) is unchanged from Task 17.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests, including the 3 new ones in this file)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/client/JoplinClient.resourceCrud.test.ts
git commit -m "feat: add updateResource and deleteResource to JoplinClient"
```

---

## Task 19: JoplinClient — note revisions & ping

**Files:**
- Create: `packages/mcp-server/src/schemas/revision.ts`
- Modify: `packages/mcp-server/src/client/JoplinClient.ts`
- Modify: `packages/mcp-server/test/schemas.test.ts`
- Test: `packages/mcp-server/test/client/JoplinClient.revisionsAndPing.test.ts`

- [ ] **Step 1: Write the failing test for the `Revision` schema**

Add this import and `describe` block to `packages/mcp-server/test/schemas.test.ts`:

```typescript
import { RevisionSchema } from '../src/schemas/revision.js';
```

```typescript
describe('RevisionSchema', () => {
  it('parses a valid revision', () => {
    const revision = RevisionSchema.parse({
      id: 'rev-1',
      item_type: 1,
      item_id: 'note-1',
      title_diff: '...',
      body_diff: '...',
      created_time: 1,
      updated_time: 2,
    });
    expect(revision.item_id).toBe('note-1');
  });

  it('rejects a revision missing a required field', () => {
    expect(() => RevisionSchema.parse({ id: 'rev-1' })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../src/schemas/revision.js'`

- [ ] **Step 3: Write `packages/mcp-server/src/schemas/revision.ts`**

```typescript
import { z } from 'zod';

export const RevisionSchema = z.object({
  id: z.string(),
  item_type: z.number(),
  item_id: z.string(),
  title_diff: z.string().optional(),
  body_diff: z.string().optional(),
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
});

export type Revision = z.infer<typeof RevisionSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests in `schemas.test.ts`, including the 2 new ones)

- [ ] **Step 5: Write the failing test for `listRevisions`, `deleteNoteRevisions`, and `ping`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient revisions and ping', () => {
  it('listRevisions filters the account-wide revision scan to the given note', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 'rev1', item_type: 1, item_id: 'note1', created_time: 2 },
            { id: 'rev2', item_type: 1, item_id: 'note2', created_time: 1 },
            { id: 'rev3', item_type: 2, item_id: 'note1', created_time: 3 },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
    );
    const client = new JoplinClient(config, fetchImpl);

    const revisions = await client.listRevisions('note1');

    expect(revisions).toEqual([{ id: 'rev1', item_type: 1, item_id: 'note1', created_time: 2 }]);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/revisions');
    expect(url.searchParams.get('order_by')).toBe('created_time');
    expect(url.searchParams.get('order_dir')).toBe('DESC');
  });

  it('deleteNoteRevisions sends a DELETE to the note revisions endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNoteRevisions('note1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/notes/note1/revisions');
    expect(init.method).toBe('DELETE');
  });

  it('ping returns true when the Data API responds with JoplinClipperServer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('JoplinClipperServer', { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).resolves.toBe(true);
  });

  it('ping returns false when the response body does not match', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('SomethingElse', { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).resolves.toBe(false);
  });

  it('ping throws JoplinConnectionError when fetch rejects', async () => {
    const { JoplinConnectionError } = await import('../../src/client/errors.js');
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).rejects.toBeInstanceOf(JoplinConnectionError);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `client.listRevisions is not a function` (and similarly for `deleteNoteRevisions`, `ping`)

- [ ] **Step 7: Add revisions and ping support to `JoplinClient.ts`**

Add a `Revision` import alongside the existing imports:

```typescript
import type { Revision } from '../schemas/revision.js';
```

Add two new constants alongside `MAX_AUTO_PAGINATE_ITEMS` and `PAGE_SIZE`:

```typescript
const REVISION_SCAN_LIMIT = 500;
const NOTE_ITEM_TYPE = 1;
```

Add `listRevisions`, `deleteNoteRevisions`, and `ping` at the end of the class, after `listNoteResources`:

```typescript
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
```

The full file should now read (this is the final, complete state of `JoplinClient.ts`):

```typescript
import { JoplinApiError, JoplinConnectionError } from './errors.js';
import type { JoplinConfig } from '../config.js';
import type { Note } from '../schemas/note.js';
import type { Notebook } from '../schemas/notebook.js';
import type { Tag } from '../schemas/tag.js';
import type { Resource } from '../schemas/resource.js';
import type { Revision } from '../schemas/revision.js';

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const MAX_AUTO_PAGINATE_ITEMS = 200;
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

  async listNoteResources(noteId: string): Promise<Resource[]> {
    return this.listAll<Resource>(`/notes/${noteId}/resources`, {
      fields: 'id,title,mime,file_extension,size',
    });
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
```

This is now the complete, final `JoplinClient.ts` for the expanded scope — every method listed in the design spec's `JoplinClient` methods section.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests, including the 5 new ones in this file)

- [ ] **Step 9: Commit**

```bash
git add packages/mcp-server/src/schemas/revision.ts packages/mcp-server/src/client/JoplinClient.ts packages/mcp-server/test/schemas.test.ts packages/mcp-server/test/client/JoplinClient.revisionsAndPing.test.ts
git commit -m "feat: add note revisions and ping to JoplinClient"
```

---

## Task 20: Note, notebook, and tag tool extensions

**Files:**
- Modify: `packages/mcp-server/src/tools/notes.ts`
- Modify: `packages/mcp-server/src/tools/notebooks.ts`
- Modify: `packages/mcp-server/src/tools/tags.ts`
- Modify: `packages/mcp-server/test/tools/notes.test.ts`
- Modify: `packages/mcp-server/test/tools/notebooks.test.ts`
- Modify: `packages/mcp-server/test/tools/tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/mcp-server/test/tools/notes.test.ts` (inside the existing `describe('registerNoteTools', ...)` block):

```typescript
  it('delete_note forwards the permanent flag', async () => {
    const client = { deleteNote: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('delete_note')!.handler({ note_id: 'n1', permanent: true });

    expect(client.deleteNote).toHaveBeenCalledWith('n1', { permanent: true });
  });

  it('list_notes forwards tag_id to JoplinClient.listNotes', async () => {
    const client = { listNotes: vi.fn().mockResolvedValue([]) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('list_notes')!.handler({ tag_id: 'tag1' });

    expect(client.listNotes).toHaveBeenCalledWith({ parentId: undefined, tagId: 'tag1', limit: undefined });
  });
```

Add these tests to `packages/mcp-server/test/tools/notebooks.test.ts` (inside the existing `describe('registerNotebookTools', ...)` block):

```typescript
  it('get_notebook calls JoplinClient.getNotebook with the given id', async () => {
    const client = { getNotebook: vi.fn().mockResolvedValue({ id: 'nb1', parent_id: '', title: 'Work' }) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    const result = await server.tools.get('get_notebook')!.handler({ notebook_id: 'nb1' });

    expect(client.getNotebook).toHaveBeenCalledWith('nb1');
    expect(JSON.parse(result.content[0].text).title).toBe('Work');
  });

  it('update_notebook forwards title and parent_id', async () => {
    const client = { updateNotebook: vi.fn().mockResolvedValue({ id: 'nb1', parent_id: 'nb2', title: 'Renamed' }) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    await server.tools.get('update_notebook')!.handler({ notebook_id: 'nb1', title: 'Renamed', parent_id: 'nb2' });

    expect(client.updateNotebook).toHaveBeenCalledWith('nb1', { title: 'Renamed', parent_id: 'nb2' });
  });

  it('delete_notebook forwards the permanent flag', async () => {
    const client = { deleteNotebook: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    await server.tools.get('delete_notebook')!.handler({ notebook_id: 'nb1', permanent: true });

    expect(client.deleteNotebook).toHaveBeenCalledWith('nb1', { permanent: true });
  });
```

Add these tests to `packages/mcp-server/test/tools/tags.test.ts` (inside the existing `describe('registerTagTools', ...)` block):

```typescript
  it('get_tag calls JoplinClient.getTag with the given id', async () => {
    const client = { getTag: vi.fn().mockResolvedValue({ id: 't1', title: 'urgent' }) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    const result = await server.tools.get('get_tag')!.handler({ tag_id: 't1' });

    expect(client.getTag).toHaveBeenCalledWith('t1');
    expect(JSON.parse(result.content[0].text).title).toBe('urgent');
  });

  it('update_tag renames a tag', async () => {
    const client = { updateTag: vi.fn().mockResolvedValue({ id: 't1', title: 'renamed' }) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    await server.tools.get('update_tag')!.handler({ tag_id: 't1', title: 'renamed' });

    expect(client.updateTag).toHaveBeenCalledWith('t1', { title: 'renamed' });
  });

  it('delete_tag calls JoplinClient.deleteTag with the given id', async () => {
    const client = { deleteTag: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    await server.tools.get('delete_tag')!.handler({ tag_id: 't1' });

    expect(client.deleteTag).toHaveBeenCalledWith('t1');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `delete_note`/`list_notes` don't yet accept `permanent`/`tag_id`, and `get_notebook`, `update_notebook`, `delete_notebook`, `get_tag`, `update_tag`, `delete_tag` don't exist yet.

- [ ] **Step 3: Update `packages/mcp-server/src/tools/notes.ts`**

Replace the `delete_note` and `list_notes` tool registrations with:

```typescript
  server.registerTool(
    'delete_note',
    {
      description: 'Delete a Joplin note by ID.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to delete'),
        permanent: z.boolean().optional().describe('Permanently delete instead of moving to trash'),
      },
    },
    async ({ note_id, permanent }) => {
      try {
        await client.deleteNote(note_id, { permanent });
        return { content: [{ type: 'text' as const, text: `Deleted note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List Joplin notes, optionally scoped to a notebook or tag.',
      inputSchema: {
        notebook_id: z.string().optional().describe('Only list notes in this notebook ID'),
        tag_id: z.string().optional().describe('Only list notes with this tag ID (takes priority over notebook_id)'),
        limit: z.number().int().positive().optional().describe('Maximum number of notes to return'),
      },
    },
    async ({ notebook_id, tag_id, limit }) => {
      try {
        const notes = await client.listNotes({ parentId: notebook_id, tagId: tag_id, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notes) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
```

- [ ] **Step 4: Rewrite `packages/mcp-server/src/tools/notebooks.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { buildNotebookTree } from '../client/notebookTree.js';
import { toToolError } from './toolError.js';

export function registerNotebookTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'get_notebook',
    {
      description: 'Fetch a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to fetch'),
      },
    },
    async ({ notebook_id }) => {
      try {
        const notebook = await client.getNotebook(notebook_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_notebooks',
    {
      description: 'List Joplin notebooks as both a flat list and a nested tree (notebooks can be nested).',
      inputSchema: {},
    },
    async () => {
      try {
        const notebooks = await client.listNotebooks();
        const tree = buildNotebookTree(notebooks);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ flat: notebooks, tree }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_notebook',
    {
      description: 'Create a new Joplin notebook, optionally nested under a parent notebook.',
      inputSchema: {
        title: z.string().describe('Notebook title'),
        parent_id: z.string().optional().describe('ID of the parent notebook, for nesting'),
      },
    },
    async ({ title, parent_id }) => {
      try {
        const notebook = await client.createNotebook({ title, parent_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_notebook',
    {
      description: 'Rename and/or move a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to update'),
        title: z.string().optional().describe('New title'),
        parent_id: z.string().optional().describe('New parent notebook ID, to move this notebook'),
      },
    },
    async ({ notebook_id, title, parent_id }) => {
      try {
        const notebook = await client.updateNotebook(notebook_id, { title, parent_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_notebook',
    {
      description: 'Delete a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to delete'),
        permanent: z.boolean().optional().describe('Permanently delete instead of moving to trash'),
      },
    },
    async ({ notebook_id, permanent }) => {
      try {
        await client.deleteNotebook(notebook_id, { permanent });
        return { content: [{ type: 'text' as const, text: `Deleted notebook ${notebook_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 5: Rewrite `packages/mcp-server/src/tools/tags.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerTagTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'get_tag',
    {
      description: 'Fetch a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to fetch'),
      },
    },
    async ({ tag_id }) => {
      try {
        const tag = await client.getTag(tag_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_tags',
    {
      description: 'List all Joplin tags.',
      inputSchema: {},
    },
    async () => {
      try {
        const tags = await client.listTags();
        return { content: [{ type: 'text' as const, text: JSON.stringify(tags) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_tag',
    {
      description: 'Create a new Joplin tag.',
      inputSchema: {
        title: z.string().describe('Tag title'),
      },
    },
    async ({ title }) => {
      try {
        const tag = await client.createTag({ title });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_tag',
    {
      description: 'Rename a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to rename'),
        title: z.string().describe('New tag title'),
      },
    },
    async ({ tag_id, title }) => {
      try {
        const tag = await client.updateTag(tag_id, { title });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_tag',
    {
      description: 'Delete a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to delete'),
      },
    },
    async ({ tag_id }) => {
      try {
        await client.deleteTag(tag_id);
        return { content: [{ type: 'text' as const, text: `Deleted tag ${tag_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'tag_note',
    {
      description: 'Attach an existing tag to a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to attach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.attachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Attached tag ${tag_id} to note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'untag_note',
    {
      description: 'Detach a tag from a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to detach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.detachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Detached tag ${tag_id} from note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests in `notes.test.ts`, `notebooks.test.ts`, and `tags.test.ts`)

- [ ] **Step 7: Commit**

```bash
git add packages/mcp-server/src/tools/notes.ts packages/mcp-server/src/tools/notebooks.ts packages/mcp-server/src/tools/tags.ts packages/mcp-server/test/tools/notes.test.ts packages/mcp-server/test/tools/notebooks.test.ts packages/mcp-server/test/tools/tags.test.ts
git commit -m "feat: add get/update/delete MCP tools for notes, notebooks, and tags"
```

---

## Task 21: Resource tool extensions

**Files:**
- Modify: `packages/mcp-server/src/tools/resources.ts`
- Modify: `packages/mcp-server/test/tools/resources.test.ts`

- [ ] **Step 1: Write the failing tests**

Add these tests to `packages/mcp-server/test/tools/resources.test.ts` (inside the existing `describe('registerResourceTools', ...)` block):

```typescript
  it('update_resource sends props-only update when no new file is given', async () => {
    const client = { updateResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'New title' }) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    await server.tools.get('update_resource')!.handler({ resource_id: 'res1', title: 'New title' });

    expect(client.updateResource).toHaveBeenCalledWith('res1', {
      title: 'New title',
      data: undefined,
      filename: undefined,
      mime: undefined,
    });
  });

  it('update_resource decodes base64 file content when replacing the file', async () => {
    const client = { updateResource: vi.fn().mockResolvedValue({ id: 'res1', title: 'photo.jpg' }) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    await server.tools.get('update_resource')!.handler({
      resource_id: 'res1',
      filename: 'photo.jpg',
      file_base64: Buffer.from('new-bytes').toString('base64'),
      mime: 'image/jpeg',
    });

    expect(client.updateResource).toHaveBeenCalledWith('res1', {
      title: undefined,
      data: Buffer.from('new-bytes'),
      filename: 'photo.jpg',
      mime: 'image/jpeg',
    });
  });

  it('delete_resource calls JoplinClient.deleteResource with the given id', async () => {
    const client = { deleteResource: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    await server.tools.get('delete_resource')!.handler({ resource_id: 'res1' });

    expect(client.deleteResource).toHaveBeenCalledWith('res1');
  });

  it('list_note_resources calls JoplinClient.listNoteResources with the given note id', async () => {
    const client = { listNoteResources: vi.fn().mockResolvedValue([{ id: 'res1', title: 'photo.jpg' }]) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const result = await server.tools.get('list_note_resources')!.handler({ note_id: 'note1' });

    expect(client.listNoteResources).toHaveBeenCalledWith('note1');
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 'res1', title: 'photo.jpg' }]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `update_resource`, `delete_resource`, and `list_note_resources` don't exist yet.

- [ ] **Step 3: Rewrite `packages/mcp-server/src/tools/resources.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerResourceTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'attach_resource',
    {
      description:
        'Upload a file and attach it to a note as a resource. Note: this reads the note body and writes back an appended link as two separate requests, so a concurrent edit to the same note (in the Joplin UI, via sync, or another tool call) between the read and write can be overwritten.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to attach the file to'),
        filename: z.string().describe('File name, including extension'),
        file_base64: z.string().describe('Base64-encoded file content'),
        title: z.string().optional().describe('Resource title; defaults to the filename'),
        mime: z.string().optional().describe('MIME type of the file'),
      },
    },
    async ({ note_id, filename, file_base64, title, mime }) => {
      try {
        const data = Buffer.from(file_base64, 'base64');
        const resourceTitle = title ?? filename;
        const resource = await client.createResource({ title: resourceTitle, filename, data, mime });
        const note = await client.attachResourceToNote(note_id, resource.id, resourceTitle);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ resource, note }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_resource',
    {
      description: "Fetch a resource's metadata, and optionally its file content as base64.",
      inputSchema: {
        resource_id: z.string().describe('ID of the resource'),
        include_content: z.boolean().optional().describe('Include the base64-encoded file content'),
      },
    },
    async ({ resource_id, include_content }) => {
      try {
        const resource = await client.getResource(resource_id);
        if (!include_content) {
          return { content: [{ type: 'text' as const, text: JSON.stringify(resource) }] };
        }
        const file = await client.getResourceFile(resource_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ...resource, content_base64: file.toString('base64') }),
            },
          ],
        };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_resource',
    {
      description: "Rename a resource and/or replace its file content.",
      inputSchema: {
        resource_id: z.string().describe('ID of the resource to update'),
        title: z.string().optional().describe('New title'),
        filename: z.string().optional().describe('New file name, if replacing content'),
        file_base64: z.string().optional().describe('Base64-encoded new file content, if replacing content'),
        mime: z.string().optional().describe('MIME type of the new file content'),
      },
    },
    async ({ resource_id, title, filename, file_base64, mime }) => {
      try {
        const data = file_base64 !== undefined ? Buffer.from(file_base64, 'base64') : undefined;
        const resource = await client.updateResource(resource_id, { title, data, filename, mime });
        return { content: [{ type: 'text' as const, text: JSON.stringify(resource) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_resource',
    {
      description: 'Delete a resource by ID.',
      inputSchema: {
        resource_id: z.string().describe('ID of the resource to delete'),
      },
    },
    async ({ resource_id }) => {
      try {
        await client.deleteResource(resource_id);
        return { content: [{ type: 'text' as const, text: `Deleted resource ${resource_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_note_resources',
    {
      description: 'List resources attached to a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
      },
    },
    async ({ note_id }) => {
      try {
        const resources = await client.listNoteResources(note_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(resources) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (all tests in `resources.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/resources.ts packages/mcp-server/test/tools/resources.test.ts
git commit -m "feat: add update_resource, delete_resource, and list_note_resources MCP tools"
```

---

## Task 22: Revision & ping tools

**Files:**
- Create: `packages/mcp-server/src/tools/revisions.ts`
- Create: `packages/mcp-server/src/tools/system.ts`
- Test: `packages/mcp-server/test/tools/revisions.test.ts`
- Test: `packages/mcp-server/test/tools/system.test.ts`

- [ ] **Step 1: Write the failing test for revision tools**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerRevisionTools } from '../../src/tools/revisions.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerRevisionTools', () => {
  it('list_note_revisions calls JoplinClient.listRevisions with the given note id', async () => {
    const client = { listRevisions: vi.fn().mockResolvedValue([{ id: 'rev1', item_type: 1, item_id: 'note1' }]) };
    const server = createFakeServer();
    registerRevisionTools(server as any, client as any);

    const result = await server.tools.get('list_note_revisions')!.handler({ note_id: 'note1' });

    expect(client.listRevisions).toHaveBeenCalledWith('note1');
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 'rev1', item_type: 1, item_id: 'note1' }]);
  });

  it('delete_note_revisions calls JoplinClient.deleteNoteRevisions with the given note id', async () => {
    const client = { deleteNoteRevisions: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerRevisionTools(server as any, client as any);

    await server.tools.get('delete_note_revisions')!.handler({ note_id: 'note1' });

    expect(client.deleteNoteRevisions).toHaveBeenCalledWith('note1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/revisions.js'`

- [ ] **Step 3: Write `packages/mcp-server/src/tools/revisions.ts`**

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerRevisionTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_note_revisions',
    {
      description:
        "List a note's revision history. Best-effort: scans the most recent revisions account-wide since the Data API has no server-side note filter, so very old revisions on rarely-edited notes in large accounts may not surface.",
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
      },
    },
    async ({ note_id }) => {
      try {
        const revisions = await client.listRevisions(note_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(revisions) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_note_revisions',
    {
      description: "Permanently delete all of a note's revision history.",
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
      },
    },
    async ({ note_id }) => {
      try {
        await client.deleteNoteRevisions(note_id);
        return { content: [{ type: 'text' as const, text: `Deleted revision history for note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (2 tests)

- [ ] **Step 5: Write the failing test for the system (ping) tool**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { registerSystemTools } from '../../src/tools/system.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerSystemTools', () => {
  it('ping reports availability from JoplinClient.ping', async () => {
    const client = { ping: vi.fn().mockResolvedValue(true) };
    const server = createFakeServer();
    registerSystemTools(server as any, client as any);

    const result = await server.tools.get('ping')!.handler({});

    expect(JSON.parse(result.content[0].text)).toEqual({ available: true });
  });

  it('ping maps a connection error to an isError tool result', async () => {
    const { JoplinConnectionError } = await import('../../src/client/errors.js');
    const client = { ping: vi.fn().mockRejectedValue(new JoplinConnectionError()) };
    const server = createFakeServer();
    registerSystemTools(server as any, client as any);

    const result = await server.tools.get('ping')!.handler({});

    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: FAIL — `Cannot find module '../../src/tools/system.js'`

- [ ] **Step 7: Write `packages/mcp-server/src/tools/system.ts`**

```typescript
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerSystemTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'ping',
    {
      description: 'Check whether the Joplin Data API is reachable.',
      inputSchema: {},
    },
    async () => {
      try {
        const available = await client.ping();
        return { content: [{ type: 'text' as const, text: JSON.stringify({ available }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add packages/mcp-server/src/tools/revisions.ts packages/mcp-server/src/tools/system.ts packages/mcp-server/test/tools/revisions.test.ts packages/mcp-server/test/tools/system.test.ts
git commit -m "feat: add note revision and ping MCP tools"
```

---

## Task 23: Wire new tools into the server entrypoint, and update docs

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/README.md`
- Modify: `packages/mcp-server/SMOKE_TEST.md`

- [ ] **Step 1: Rewrite `packages/mcp-server/src/index.ts`**

```typescript
#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { JoplinClient } from './client/JoplinClient.js';
import { registerNoteTools } from './tools/notes.js';
import { registerNotebookTools } from './tools/notebooks.js';
import { registerTagTools } from './tools/tags.js';
import { registerSearchTools } from './tools/search.js';
import { registerResourceTools } from './tools/resources.js';
import { registerRevisionTools } from './tools/revisions.js';
import { registerSystemTools } from './tools/system.js';

async function main() {
  const config = loadConfig(process.env);
  const client = new JoplinClient(config);

  const server = new McpServer({ name: 'agentic-joplin-mcp-server', version: '0.1.0' });

  registerNoteTools(server, client);
  registerNotebookTools(server, client);
  registerTagTools(server, client);
  registerSearchTools(server, client);
  registerResourceTools(server, client);
  registerRevisionTools(server, client);
  registerSystemTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agentic Joplin MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting Agentic Joplin MCP server:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the full test suite and the build**

Run: `npm run test --workspace @agentic-joplin/mcp-server`
Expected: PASS (every test from Tasks 2–22)

Run: `npm run build --workspace @agentic-joplin/mcp-server`
Expected: Compiles with no TypeScript errors; `packages/mcp-server/dist/index.js` is created.

- [ ] **Step 3: Rewrite the tool table in `packages/mcp-server/README.md`**

Replace the existing `## Tools` section with:

```markdown
## Tools

Full CRUD parity with Joplin's Data API for notes, notebooks, tags, and resources, plus search, note revision history, and a connectivity check. Deliberately excludes `GET /events` (delta sync) and `GET /master_keys` (end-to-end-encryption metadata) — neither has a note-taking use case.

| Tool | Purpose |
|---|---|
| `create_note` | Create a note in a notebook, in Markdown (default) or HTML via `format` |
| `get_note` | Fetch a note by ID; result includes a `format` field |
| `update_note` | Partially update a note; `format` controls how `body` is interpreted |
| `delete_note` | Delete a note by ID, optional `permanent` flag |
| `list_notes` | List notes, optionally scoped to a notebook or tag |
| `get_notebook` | Fetch a notebook by ID |
| `list_notebooks` | List notebooks as a flat list and a nested tree |
| `create_notebook` | Create a notebook, optionally nested |
| `update_notebook` | Rename and/or move a notebook |
| `delete_notebook` | Delete a notebook by ID, optional `permanent` flag |
| `get_tag` | Fetch a tag by ID |
| `list_tags` | List all tags |
| `create_tag` | Create a tag |
| `update_tag` | Rename a tag |
| `delete_tag` | Delete a tag |
| `tag_note` / `untag_note` | Attach/detach a tag on a note |
| `find_notes` | Full-text search |
| `attach_resource` | Upload and attach a file to a note |
| `get_resource` | Fetch resource metadata, optionally with file content |
| `update_resource` | Rename and/or replace a resource's file content |
| `delete_resource` | Delete a resource by ID |
| `list_note_resources` | List resources attached to a note |
| `list_note_revisions` | List a note's revision history (best-effort; see below) |
| `delete_note_revisions` | Permanently delete all of a note's revision history |
| `ping` | Check whether the Joplin Data API is reachable |

**Known limitation:** the Data API has no server-side filter for note revisions, so `list_note_revisions` scans the 500 most recent revisions account-wide and filters client-side. On accounts with heavy edit history across many notes, very old revisions on a rarely-edited note may not surface.
```

- [ ] **Step 4: Add new checklist items to `packages/mcp-server/SMOKE_TEST.md`**

Append these items to the checklist (after the existing `delete_note` item and before the "Stop the Joplin desktop app" item):

```markdown
- [ ] `update_notebook` — rename a notebook and move it under a different parent; verify both changes in Joplin's sidebar.
- [ ] `delete_notebook` — delete a test notebook; verify it's gone (or in trash).
- [ ] `update_tag` — rename a tag; verify the new name shows in Joplin's tag panel.
- [ ] `delete_tag` — delete a test tag; verify it's gone.
- [ ] `update_resource` — replace an attached file's content; verify Joplin shows the new content.
- [ ] `delete_resource` — delete a resource; verify it's gone (note body still contains the now-broken link, which is expected).
- [ ] `list_note_resources` — verify it lists the resources you attached earlier in this checklist.
- [ ] `list_note_revisions` — edit a note a couple of times, then verify revisions show up.
- [ ] `delete_note_revisions` — verify the note's revision history is cleared afterward (check Joplin's note history panel).
- [ ] `ping` — verify it reports available while Joplin is running, and reports a connection error after Joplin is closed.
```

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src/index.ts packages/mcp-server/README.md packages/mcp-server/SMOKE_TEST.md
git commit -m "feat: wire revision and ping tools into the server entrypoint; update docs"
```

---

## Task 24: Post-review enhancements (spec-completeness + safety)

These items came out of the plan-hardening review. The P0/P1 correctness and security fixes (HTML `markup_language`, search `folder` mapping, path-traversal guard, empty-body handling, resource-title escaping, attach-race documentation) were already folded directly into Tasks 4–23 above. The items below are additive enhancements — each expands the tool surface with matching tests. Implement them TDD-style like every other task: write the failing test, run it red, implement, run it green, commit.

- [ ] **Step 1: `list_*` truncation signal (P1).** `JoplinClient.listAll` silently caps results (200 default, 500 for the revision scan) with no signal. Export the cap constant (`export const MAX_AUTO_PAGINATE_ITEMS = 200;`) from `JoplinClient.ts`, then change every list-type tool (`list_notes`, `list_notebooks`, `list_tags`, `find_notes`, `list_note_resources`) so its output is `{ items, truncated }` where `truncated = items.length >= (limit ?? MAX_AUTO_PAGINATE_ITEMS)`. Update each affected tool test to read `JSON.parse(...).items` and add one asserting `truncated: true` when the returned array length equals the cap. Leave `list_note_revisions` returning a bare array (its length reflects the client-side note filter, not the scan cap — the scan-window limitation is already documented in its description).

  **Test to add (representative — `list_notes` in `test/tools/notes.test.ts`):**

```typescript
  it('list_notes marks the result truncated when the cap is hit', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, parent_id: 'nb1', title: 'x' }));
    const client = { listNotes: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('list_notes')!.handler({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(200);
    expect(payload.truncated).toBe(true);
  });
```

- [ ] **Step 2: `get_note` field selection (P2, spec line 86).** Add an optional `fields` param (comma-separated string) to the `get_note` tool and thread it to `JoplinClient.getNote(id, fields?)`, which overrides the default field list — but always append `markup_language` if the caller omits it, so the derived `format` field still works. Update `getNote`'s signature everywhere it appears and add a test asserting a custom `fields` value reaches the request's `fields` query param and still includes `markup_language`.

- [ ] **Step 3: `find_notes` notebook/tag scoping (P2, spec line 101).** Add optional `notebook_id` and `tag_id` params to `find_notes` that fold into Joplin's search query syntax (`notebook:"<title>"` / `tag:"<title>"` filters appended to `query`). Note this requires resolving the id to a title first (Joplin's search filters match on notebook/tag title, not id) — or, simpler and id-native, scope by calling `listNotes({ parentId })` / `listNotes({ tagId })` and intersecting with the search results client-side. Pick the id-native approach to avoid a title round-trip; add a test for each scoping path.

- [ ] **Step 4: `limit` param on the remaining list tools (P2, spec line 79).** The spec says every list tool "can accept an optional limit." Add optional `limit` to `list_notebooks`, `list_tags`, and `list_note_resources` tools, threading to the already-`limit`-capable `listNotebooks`/`listTags`/`listNoteResources` client methods (add the `limit?` param + `listAll` passthrough to those three client methods). Add a test per tool asserting the limit reaches `listAll`'s cap argument.

- [ ] **Step 5: Commit**

```bash
git add packages/mcp-server/src packages/mcp-server/test
git commit -m "feat: list truncation signal, get_note fields, find_notes scoping, list limits"
```
