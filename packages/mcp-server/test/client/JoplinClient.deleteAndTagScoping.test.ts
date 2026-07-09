import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient permanent delete and tag-scoped listing', () => {
  it('deleteNote sends permanent=1 when requested', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNote('n1', { permanent: true });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/notes/n1');
    expect(url.searchParams.get('permanent')).toBe('1');
  });

  it('deleteNote omits the permanent param by default', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.deleteNote('n1');

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.searchParams.has('permanent')).toBe(false);
  });

  it('rejects an id containing path traversal before issuing any request', async () => {
    const fetchImpl = vi.fn();
    const client = new JoplinClient(config, fetchImpl);

    // A traversal id like '../folders/nb1' would otherwise normalize to DELETE /folders/nb1.
    await expect(client.deleteNote('../folders/nb1')).rejects.toThrow(/unexpected characters/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('listNotes scoped to a tag requests /tags/:id/notes', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'n1', parent_id: 'nb1', title: 'A' }]), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes({ tagId: 'tag1' });

    expect(notes).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'A' }]);
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/tags/tag1/notes');
  });

  it('listNotes prefers tagId over parentId when both are given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.listNotes({ tagId: 'tag1', parentId: 'nb1' });

    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/tags/tag1/notes');
  });
});
