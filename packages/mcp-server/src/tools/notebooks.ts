import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { buildNotebookTree } from '../client/notebookTree.js';
import { toToolError } from './toolError.js';

export function registerNotebookTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_notebooks',
    {
      description: 'List Joplin notebooks as both a flat list and a nested tree (notebooks can be nested).',
      inputSchema: {},
    },
    async () => {
      try {
        const notebooks = await client.listNotebooks();
        const tree = buildNotebookTree(notebooks);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ flat: notebooks, tree }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_notebook',
    {
      description: 'Create a new Joplin notebook, optionally nested under a parent notebook.',
      inputSchema: {
        title: z.string().describe('Notebook title'),
        parent_id: z.string().optional().describe('ID of the parent notebook, for nesting'),
      },
    },
    async ({ title, parent_id }) => {
      try {
        const notebook = await client.createNotebook({ title, parent_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
