import { describe, expect, it, vi } from 'vitest';
import { registerRevisionTools } from '../../src/tools/revisions.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerRevisionTools', () => {
  it('list_note_revisions calls JoplinClient.listRevisions with the given note id', async () => {
    const client = { listRevisions: vi.fn().mockResolvedValue([{ id: 'rev1', item_type: 1, item_id: 'note1' }]) };
    const server = createFakeServer();
    registerRevisionTools(server as any, client as any);

    const result = await server.tools.get('list_note_revisions')!.handler({ note_id: 'note1' });

    expect(client.listRevisions).toHaveBeenCalledWith('note1');
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 'rev1', item_type: 1, item_id: 'note1' }]);
  });

  it('delete_note_revisions calls JoplinClient.deleteNoteRevisions with the given note id', async () => {
    const client = { deleteNoteRevisions: vi.fn().mockResolvedValue(undefined) };
    const server = createFakeServer();
    registerRevisionTools(server as any, client as any);

    await server.tools.get('delete_note_revisions')!.handler({ note_id: 'note1' });

    expect(client.deleteNoteRevisions).toHaveBeenCalledWith('note1');
  });
});
