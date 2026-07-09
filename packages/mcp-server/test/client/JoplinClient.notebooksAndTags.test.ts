import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient notebooks and tags', () => {
  it('listNotebooks returns flat items with parent_id', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 'root', parent_id: '', title: 'Root' },
            { id: 'child', parent_id: 'root', title: 'Child' },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notebooks = await client.listNotebooks();

    expect(notebooks).toHaveLength(2);
    expect(notebooks[1].parent_id).toBe('root');
  });

  it('createNotebook posts an optional parent_id for nesting', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'nb2', parent_id: 'nb1', title: 'Sub' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const notebook = await client.createNotebook({ title: 'Sub', parent_id: 'nb1' });

    expect(notebook.parent_id).toBe('nb1');
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ title: 'Sub', parent_id: 'nb1' });
  });

  it('createTag posts the tag title', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'tag1', title: 'urgent' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const tag = await client.createTag({ title: 'urgent' });

    expect(tag.title).toBe('urgent');
  });

  it('attachTag posts the note id to the tag notes endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.attachTag('note1', 'tag1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/tags/tag1/notes');
    expect(JSON.parse(init.body)).toEqual({ id: 'note1' });
  });

  it('detachTag sends a DELETE to the tag/note pair', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.detachTag('note1', 'tag1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/tags/tag1/notes/note1');
    expect(init.method).toBe('DELETE');
  });

  it('listTags returns all tags', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 'tag1', title: 'urgent' }], has_more: false }), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const tags = await client.listTags();

    expect(tags).toEqual([{ id: 'tag1', title: 'urgent' }]);
  });
});
