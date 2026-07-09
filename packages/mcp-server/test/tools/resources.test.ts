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
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNoteResources).toHaveBeenCalledWith('note1', { limit: undefined });
    expect(payload.items).toEqual([{ id: 'res1', title: 'photo.jpg' }]);
    expect(payload.truncated).toBe(false);
  });

  it('list_note_resources marks the result truncated when the cap is hit', async () => {
    const capped = Array.from({ length: 200 }, (_, i) => ({ id: `res${i}`, title: 'x' }));
    const client = { listNoteResources: vi.fn().mockResolvedValue(capped) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const result = await server.tools.get('list_note_resources')!.handler({ note_id: 'note1' });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.items).toHaveLength(200);
    expect(payload.truncated).toBe(true);
  });

  it('list_note_resources forwards an optional limit to JoplinClient.listNoteResources', async () => {
    const client = { listNoteResources: vi.fn().mockResolvedValue([{ id: 'res1', title: 'photo.jpg' }]) };
    const server = createFakeServer();
    registerResourceTools(server as any, client as any);

    const result = await server.tools.get('list_note_resources')!.handler({ note_id: 'note1', limit: 1 });
    const payload = JSON.parse(result.content[0].text);

    expect(client.listNoteResources).toHaveBeenCalledWith('note1', { limit: 1 });
    expect(payload.truncated).toBe(true);
  });
});
