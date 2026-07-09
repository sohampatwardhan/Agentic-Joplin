import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerRevisionTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_note_revisions',
    {
      description:
        "List a note's revision history. Best-effort: scans the most recent revisions account-wide since the Data API has no server-side note filter, so very old revisions on rarely-edited notes in large accounts may not surface.",
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
      },
    },
    async ({ note_id }) => {
      try {
        const revisions = await client.listRevisions(note_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(revisions) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_note_revisions',
    {
      description: "Permanently delete all of a note's revision history.",
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
      },
    },
    async ({ note_id }) => {
      try {
        await client.deleteNoteRevisions(note_id);
        return { content: [{ type: 'text' as const, text: `Deleted revision history for note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
