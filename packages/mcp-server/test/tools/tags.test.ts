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
