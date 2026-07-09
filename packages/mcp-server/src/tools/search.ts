import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerSearchTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'find_notes',
    {
      description: 'Full-text search for notes, optionally filtered by item type.',
      inputSchema: {
        query: z.string().describe('Search query; supports the * wildcard'),
        type: z
          .enum(['note', 'notebook', 'tag'])
          .optional()
          .describe("Restrict results to this item type ('notebook' is mapped to Joplin's 'folder' value)"),
        limit: z.number().int().positive().optional().describe('Maximum number of results to return'),
      },
    },
    async ({ query, type, limit }) => {
      try {
        const joplinType = type === 'notebook' ? 'folder' : type;
        const results = await client.search(query, { type: joplinType, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(results) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
