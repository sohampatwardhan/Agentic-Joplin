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
    const payload = JSON.parse(result.content[0].text);

    expect(client.listTags).toHaveBeenCalled();
    expect(payload.items).toEqual([{ id: 't1', title: 'urgent' }]);
    expect(payload.truncated).toBe(false);
  });

  it('list_tags marks the result truncated when the cap is hit', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({ id: `t${i}`, title: 'x' }));
    const client = { listTags: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    const result = await server.tools.get('list_tags')!.handler({});
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(200);
    expect(payload.truncated).toBe(true);
  });

  it('list_tags forwards an optional limit to JoplinClient.listTags', async () => {
    const client = { listTags: vi.fn().mockResolvedValue([{ id: 't1', title: 'urgent' }]) };
    const server = createFakeServer();
    registerTagTools(server as any, client as any);

    const result = await server.tools.get('list_tags')!.handler({ limit: 1 });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listTags).toHaveBeenCalledWith({ limit: 1 });
    expect(payload.truncated).toBe(true);
  });

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
});
