import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { registerNoteTools } from '../../src/tools/notes.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerNoteTools', () => {
  it('registers create_note, get_note, update_note, delete_note, and list_notes', () => {
    const server = createFakeServer();
    registerNoteTools(server as any, {} as any);

    expect([...server.tools.keys()]).toEqual([
      'create_note',
      'get_note',
      'update_note',
      'delete_note',
      'list_notes',
    ]);
  });

  it('create_note rejects input missing a required field', () => {
    const server = createFakeServer();
    registerNoteTools(server as any, {} as any);

    const shape = server.tools.get('create_note')!.config.inputSchema;
    const result = z.object(shape).safeParse({ title: 'Missing notebook' });

    expect(result.success).toBe(false);
  });

  it('create_note calls JoplinClient.createNote with mapped fields, defaulting to markdown', async () => {
    const client = { createNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('create_note')!.handler({
      title: 'Hi',
      body: 'World',
      notebook_id: 'nb1',
    });

    expect(client.createNote).toHaveBeenCalledWith({ title: 'Hi', parent_id: 'nb1', body: 'World' });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('n1');
  });

  it('create_note sends body_html instead of body when format is html', async () => {
    const client = { createNote: vi.fn().mockResolvedValue({ id: 'n2', parent_id: 'nb1', title: 'Rich' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('create_note')!.handler({
      title: 'Rich',
      body: '<p>Hi</p>',
      format: 'html',
      notebook_id: 'nb1',
    });

    expect(client.createNote).toHaveBeenCalledWith({
      title: 'Rich',
      parent_id: 'nb1',
      body_html: '<p>Hi</p>',
      markup_language: 2,
    });
  });

  it('get_note maps a JoplinApiError into an isError tool result', async () => {
    const { JoplinApiError } = await import('../../src/client/errors.js');
    const client = { getNote: vi.fn().mockRejectedValue(new JoplinApiError(404, 'Not Found')) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('get_note')!.handler({ note_id: 'missing' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Not Found');
  });

  it('get_note includes a friendly format field derived from markup_language', async () => {
    const client = {
      getNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi', markup_language: 2 }),
    };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    const result = await server.tools.get('get_note')!.handler({ note_id: 'n1' });
    const payload = JSON.parse(result.content[0].text);

    expect(payload.format).toBe('html');
  });

  it('update_note sends body_html when format is html and body is set', async () => {
    const client = { updateNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'Hi' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('update_note')!.handler({ note_id: 'n1', body: '<p>Updated</p>', format: 'html' });

    expect(client.updateNote).toHaveBeenCalledWith('n1', {
      title: undefined,
      parent_id: undefined,
      body_html: '<p>Updated</p>',
      markup_language: 2,
    });
  });

  it('update_note omits body fields entirely when body is not provided', async () => {
    const client = { updateNote: vi.fn().mockResolvedValue({ id: 'n1', parent_id: 'nb1', title: 'New title' }) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('update_note')!.handler({ note_id: 'n1', title: 'New title' });

    expect(client.updateNote).toHaveBeenCalledWith('n1', { title: 'New title', parent_id: undefined });
  });

  it('list_notes passes notebook_id and limit through to JoplinClient.listNotes', async () => {
    const client = { listNotes: vi.fn().mockResolvedValue([]) };
    const server = createFakeServer();
    registerNoteTools(server as any, client as any);

    await server.tools.get('list_notes')!.handler({ notebook_id: 'nb1', limit: 5 });

    expect(client.listNotes).toHaveBeenCalledWith({ parentId: 'nb1', limit: 5 });
  });
});
