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
