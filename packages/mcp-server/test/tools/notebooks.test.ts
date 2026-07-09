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
