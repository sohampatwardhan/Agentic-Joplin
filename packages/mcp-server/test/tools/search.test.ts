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
    const payload = JSON.parse(result.content[0].text);

    expect(client.search).toHaveBeenCalledWith('recipes', { type: 'note', limit: 10 });
    expect(payload.items).toHaveLength(1);
    expect(payload.truncated).toBe(false);
  });

  it('find_notes marks the result truncated when the limit is hit', async () => {
    const capped = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, parent_id: 'nb1', title: 'x' }));
    const client = { search: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({ query: 'recipes', limit: 10 });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(10);
    expect(payload.truncated).toBe(true);
  });

  it('find_notes marks the result truncated when the default cap is hit', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, parent_id: 'nb1', title: 'x' }));
    const client = { search: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({ query: 'recipes' });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(200);
    expect(payload.truncated).toBe(true);
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

  it('find_notes scopes results to a notebook via listNotes({ parentId }) intersection', async () => {
    const client = {
      search: vi.fn().mockResolvedValue([
        { id: 'n1', parent_id: 'nb1', title: 'In notebook' },
        { id: 'n2', parent_id: 'nb2', title: 'Not in notebook' },
      ]),
      listNotes: vi.fn().mockResolvedValue([{ id: 'n1', parent_id: 'nb1', title: 'In notebook' }]),
    };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({ query: 'recipes', notebook_id: 'nb1' });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNotes).toHaveBeenCalledWith({ parentId: 'nb1' });
    expect(payload.items).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'In notebook' }]);
  });

  it('find_notes scopes results to a tag via listNotes({ tagId }) intersection', async () => {
    const client = {
      search: vi.fn().mockResolvedValue([
        { id: 'n1', parent_id: 'nb1', title: 'Tagged' },
        { id: 'n2', parent_id: 'nb1', title: 'Untagged' },
      ]),
      listNotes: vi.fn().mockResolvedValue([{ id: 'n1', parent_id: 'nb1', title: 'Tagged' }]),
    };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({ query: 'recipes', tag_id: 'tag1' });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNotes).toHaveBeenCalledWith({ tagId: 'tag1' });
    expect(payload.items).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'Tagged' }]);
  });

  it('find_notes intersects both scopes when notebook_id and tag_id are both given', async () => {
    const client = {
      search: vi.fn().mockResolvedValue([
        { id: 'n1', parent_id: 'nb1', title: 'In both' },
        { id: 'n2', parent_id: 'nb1', title: 'In notebook only' },
      ]),
      listNotes: vi
        .fn()
        .mockResolvedValueOnce([
          { id: 'n1', parent_id: 'nb1', title: 'In both' },
          { id: 'n2', parent_id: 'nb1', title: 'In notebook only' },
        ])
        .mockResolvedValueOnce([{ id: 'n1', parent_id: 'nb1', title: 'In both' }]),
    };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    const result = await server.tools.get('find_notes')!.handler({
      query: 'recipes',
      notebook_id: 'nb1',
      tag_id: 'tag1',
    });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNotes).toHaveBeenCalledWith({ parentId: 'nb1' });
    expect(client.listNotes).toHaveBeenCalledWith({ tagId: 'tag1' });
    expect(payload.items).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'In both' }]);
  });

  it('find_notes does not call listNotes when no scoping id is given', async () => {
    const client = { search: vi.fn().mockResolvedValue([]), listNotes: vi.fn() };
    const server = createFakeServer();
    registerSearchTools(server as any, client as any);

    await server.tools.get('find_notes')!.handler({ query: 'recipes' });

    expect(client.listNotes).not.toHaveBeenCalled();
  });
});
