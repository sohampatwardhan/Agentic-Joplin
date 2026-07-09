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

    expect(payload.items).toHaveLength(2);
    expect(payload.tree[0].children[0].id).toBe('child');
    expect(payload.truncated).toBe(false);
  });

  it('list_notebooks marks the result truncated when the cap is hit', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({ id: `nb${i}`, parent_id: '', title: 'x' }));
    const client = { listNotebooks: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    const result = await server.tools.get('list_notebooks')!.handler({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(200);
    expect(payload.truncated).toBe(true);
  });

  it('list_notebooks forwards an optional limit to JoplinClient.listNotebooks', async () => {
    const client = {
      listNotebooks: vi.fn().mockResolvedValue([{ id: 'nb1', parent_id: '', title: 'A' }]),
    };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    const result = await server.tools.get('list_notebooks')!.handler({ limit: 1 });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNotebooks).toHaveBeenCalledWith({ limit: 1 });
    expect(payload.truncated).toBe(true);
  });

  it('create_notebook forwards an optional parent_id for nesting', async () => {
    const client = { createNotebook: vi.fn().mockResolvedValue({ id: 'nb2', parent_id: 'nb1', title: 'Sub' }) };
    const server = createFakeServer();
    registerNotebookTools(server as any, client as any);

    await server.tools.get('create_notebook')!.handler({ title: 'Sub', parent_id: 'nb1' });

    expect(client.createNotebook).toHaveBeenCalledWith({ title: 'Sub', parent_id: 'nb1' });
  });

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
});
