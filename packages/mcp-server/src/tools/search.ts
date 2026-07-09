import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_AUTO_PAGINATE_ITEMS, type JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerSearchTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'find_notes',
    {
      description:
        'Full-text search for notes, optionally filtered by item type and scoped to a notebook and/or tag.',
      inputSchema: {
        query: z.string().describe('Search query; supports the * wildcard'),
        type: z
          .enum(['note', 'notebook', 'tag'])
          .optional()
          .describe("Restrict results to this item type ('notebook' is mapped to Joplin's 'folder' value)"),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return'),
        notebook_id: z.string().optional().describe('Only return results whose note lives in this notebook ID'),
        tag_id: z.string().optional().describe('Only return results whose note has this tag ID'),
      },
    },
    async ({ query, type, limit, notebook_id, tag_id }) => {
      try {
        const joplinType = type === 'notebook' ? 'folder' : type;
        const results = await client.search(query, { type: joplinType, limit });
        const truncated = results.length >= (limit ?? MAX_AUTO_PAGINATE_ITEMS);

        // Joplin's search filters (e.g. notebook:"title") match on title, not ID, so scoping
        // by ID here instead resolves each scope to its note-id set via listNotes and
        // intersects client-side with the search results (avoiding a title round-trip).
        let items = results;
        if (notebook_id !== undefined || tag_id !== undefined) {
          const scopedIdSets = await Promise.all([
            notebook_id !== undefined ? client.listNotes({ parentId: notebook_id }) : undefined,
            tag_id !== undefined ? client.listNotes({ tagId: tag_id }) : undefined,
          ]);
          const idSets = scopedIdSets
            .filter((notes) => notes !== undefined)
            .map((notes) => new Set(notes.map((note) => note.id)));
          items = results.filter((note) => idSets.every((ids) => ids.has(note.id)));
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({ items, truncated }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
