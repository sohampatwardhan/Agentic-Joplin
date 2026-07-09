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
