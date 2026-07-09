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
