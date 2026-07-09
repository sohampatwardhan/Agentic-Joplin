import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient revisions and ping', () => {
  it('listRevisions filters the account-wide revision scan to the given note', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            { id: 'rev1', item_type: 1, item_id: 'note1', created_time: 2 },
            { id: 'rev2', item_type: 1, item_id: 'note2', created_time: 1 },
            { id: 'rev3', item_type: 2, item_id: 'note1', created_time: 3 },
          ],
          has_more: false,
        }),
        { status: 200 },
      ),
    );
    const client = new JoplinClient(config, fetchImpl);

    const revisions = await client.listRevisions('note1');

    expect(revisions).toEqual([{ id: 'rev1', item_type: 1, item_id: 'note1', created_time: 2 }]);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/revisions');
    expect(url.searchParams.get('order_by')).toBe('created_time');
    expect(url.searchParams.get('order_dir')).toBe('DESC');
  });

  it('deleteNoteRevisions sends a DELETE to the note revisions endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNoteRevisions('note1');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(new URL(url).pathname).toBe('/notes/note1/revisions');
    expect(init.method).toBe('DELETE');
  });

  it('ping returns true when the Data API responds with JoplinClipperServer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('JoplinClipperServer', { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).resolves.toBe(true);
  });

  it('ping returns false when the response body does not match', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('SomethingElse', { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).resolves.toBe(false);
  });

  it('ping throws JoplinConnectionError when fetch rejects', async () => {
    const { JoplinConnectionError } = await import('../../src/client/errors.js');
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.ping()).rejects.toBeInstanceOf(JoplinConnectionError);
  });
});
