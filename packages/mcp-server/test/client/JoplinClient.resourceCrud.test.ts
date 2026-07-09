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

  it('listNoteResources stops paginating once the given limit is reached', async () => {
    const page1 = new Response(
      JSON.stringify({ items: [{ id: 'res1', title: 'a' }], has_more: true }),
      { status: 200 },
    );
    const fetchImpl = vi.fn().mockResolvedValueOnce(page1);
    const client = new JoplinClient(config, fetchImpl);

    const resources = await client.listNoteResources('note1', { limit: 1 });

    expect(resources).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/notes/note1/resources');
  });
});
