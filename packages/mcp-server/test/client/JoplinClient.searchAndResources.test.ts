import { describe, expect, it, vi } from 'vitest';
import { JoplinClient } from '../../src/client/JoplinClient.js';

const config = { token: 'test-token', host: '127.0.0.1', port: 41184 };

describe('JoplinClient search and resources', () => {
  it('search sends the query and optional type as query params', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [{ id: 'n1', parent_id: 'nb1', title: 'Match' }], has_more: false }), {
        status: 200,
      }),
    );
    const client = new JoplinClient(config, fetchImpl);

    const results = await client.search('recipes', { type: 'note' });

    expect(results).toHaveLength(1);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('query')).toBe('recipes');
    expect(url.searchParams.get('type')).toBe('note');
  });

  it('createResource sends a multipart form with props and file data', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'photo.jpg' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const resource = await client.createResource({
      title: 'photo.jpg',
      filename: 'photo.jpg',
      data: Buffer.from('fake-image-bytes'),
      mime: 'image/jpeg',
    });

    expect(resource.id).toBe('res1');
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('attachResourceToNote appends a markdown resource link to the note body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'note1', parent_id: 'nb1', title: 'Note', body: 'Existing body' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: 'Existing body\n\n[photo.jpg](:/res1)',
          }),
          { status: 200 },
        ),
      );
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.attachResourceToNote('note1', 'res1', 'photo.jpg');

    expect(note.body).toContain('[photo.jpg](:/res1)');
    const [, updateInit] = fetchImpl.mock.calls[1];
    expect(JSON.parse(updateInit.body).body).toBe('Existing body\n\n[photo.jpg](:/res1)');
  });

  it('attachResourceToNote appends an HTML anchor link for HTML notes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: '<p>existing</p>',
            markup_language: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: '<p>existing</p>\n\n<a href=":/res1">photo.jpg</a>',
          }),
          { status: 200 },
        ),
      );
    const client = new JoplinClient(config, fetchImpl);

    const note = await client.attachResourceToNote('note1', 'res1', 'photo.jpg');

    expect(note.body).toContain('<a href=":/res1">photo.jpg</a>');
    expect(note.body).not.toMatch(/\[.*\]\(:\/res1\)/);
    const [, updateInit] = fetchImpl.mock.calls[1];
    expect(JSON.parse(updateInit.body).body).toBe('<p>existing</p>\n\n<a href=":/res1">photo.jpg</a>');
  });

  it('attachResourceToNote HTML-escapes the resource title for HTML notes', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: '<p>existing</p>',
            markup_language: 2,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'note1',
            parent_id: 'nb1',
            title: 'Note',
            body: '<p>existing</p>\n\n<a href=":/res1">&lt;a &amp; b&gt; &quot;c&quot;</a>',
          }),
          { status: 200 },
        ),
      );
    const client = new JoplinClient(config, fetchImpl);

    await client.attachResourceToNote('note1', 'res1', '<a & b> "c"');

    const [, updateInit] = fetchImpl.mock.calls[1];
    expect(JSON.parse(updateInit.body).body).toBe(
      '<p>existing</p>\n\n<a href=":/res1">&lt;a &amp; b&gt; &quot;c&quot;</a>',
    );
  });

  it('getResourceFile returns the raw file bytes as a Buffer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const buffer = await client.getResourceFile('res1');

    expect(Buffer.compare(buffer, Buffer.from([1, 2, 3]))).toBe(0);
  });

  it('getResource fetches resource metadata by id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'res1', title: 'photo.jpg' }), { status: 200 }));
    const client = new JoplinClient(config, fetchImpl);

    const resource = await client.getResource('res1');

    expect(resource.title).toBe('photo.jpg');
  });
});
