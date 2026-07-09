import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient notes', () => {
  it('getNote requests the note with the expected fields and token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.getNote('n1');

    expect(note.title).toBe('Hi');
    const calledUrl = new URL(fetchImpl.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe('/notes/n1');
    expect(calledUrl.searchParams.get('token')).toBe('test-token');
    expect(calledUrl.searchParams.get('fields')).toContain('title');
    expect(calledUrl.searchParams.get('fields')).toContain('markup_language');
  });

  it('getNote overrides the default fields with a caller-provided list, always including markup_language', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.getNote('n1', 'id,title');

    const calledUrl = new URL(fetchImpl.mock.calls[0][0]);
    const fields = calledUrl.searchParams.get('fields');
    expect(fields).toContain('id');
    expect(fields).toContain('title');
    expect(fields).toContain('markup_language');
    expect(fields).not.toContain('body');
  });

  it('getNote does not duplicate markup_language when the caller already includes it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.getNote('n1', 'id,title,markup_language');

    const calledUrl = new URL(fetchImpl.mock.calls[0][0]);
    const fields = calledUrl.searchParams.get('fields')!;
    expect(fields.split(',').filter((f) => f === 'markup_language')).toHaveLength(1);
  });

  it('createNote posts the input as JSON', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n2', parent_id: 'nb1', title: 'New' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.createNote({ title: 'New', parent_id: 'nb1', body: 'Body' });

    expect(note.id).toBe('n2');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'New', parent_id: 'nb1', body: 'Body' });
  });

  it('createNote sends body_html instead of body when creating an HTML note', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n3', parent_id: 'nb1', title: 'Rich' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.createNote({ title: 'Rich', parent_id: 'nb1', body_html: '<p>Hi</p>' });

    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ title: 'Rich', parent_id: 'nb1', body_html: '<p>Hi</p>' });
  });

  it('updateNote sends body_html when updating to HTML content', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'n1', parent_id: 'nb1', title: 'Hi' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    await client.updateNote('n1', { body_html: '<p>Updated</p>' });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ body_html: '<p>Updated</p>' });
  });

  it('deleteNote sends a DELETE request and resolves with no value', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.deleteNote('n1')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0][1].method).toBe('DELETE');
  });

  it('listNotes auto-paginates until has_more is false', async () => {
    const page1 = new Response(
      JSON.stringify({ items: [{ id: 'n1', parent_id: 'nb1', title: 'A' }], has_more: true }),
      { status: 200 },
    );
    const page2 = new Response(
      JSON.stringify({ items: [{ id: 'n2', parent_id: 'nb1', title: 'B' }], has_more: false }),
      { status: 200 },
    );
    const fetchImpl = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes();

    expect(notes).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('listNotes scoped to a notebook handles a bare-array response from the relation endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: 'n1', parent_id: 'nb1', title: 'A' }]), { status: 200 }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const notes = await client.listNotes({ parentId: 'nb1' });

    expect(notes).toEqual([{ id: 'n1', parent_id: 'nb1', title: 'A' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(new URL(fetchImpl.mock.calls[0][0]).pathname).toBe('/folders/nb1/notes');
  });

  it('throws JoplinConnectionError when fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const client = new JoplinClient(config, fetchImpl);

    await expect(client.getNote('n1')).rejects.toBeInstanceOf(JoplinConnectionError);
  });

  it('throws JoplinApiError with the response status on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));
    const client = new JoplinClient(config, fetchImpl);

    // Note: a single call is used here (not two separate `await expect(...)` calls) because
    // the mocked Response object's body can only be read once via `.text()` per the Fetch
    // spec; reusing the same mock Response across two `getNote` calls throws "Body is
    // unusable: Body has already been read" on the second call.
    await expect(client.getNote('missing')).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(JoplinApiError);
      expect(error).toMatchObject({ status: 404 });
      return true;
    });
  });
});
