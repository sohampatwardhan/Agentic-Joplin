import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_AUTO_PAGINATE_ITEMS, type JoplinClient } from '../client/JoplinClient.js';
import { buildNotebookTree } from '../client/notebookTree.js';
import { toToolError } from './toolError.js';

export function registerNotebookTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'get_notebook',
    {
      description: 'Fetch a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to fetch'),
      },
    },
    async ({ notebook_id }) => {
      try {
        const notebook = await client.getNotebook(notebook_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_notebooks',
    {
      description: 'List Joplin notebooks as both a flat list and a nested tree (notebooks can be nested).',
      inputSchema: {
        limit: z.number().int().positive().optional().describe('Maximum number of notebooks to return'),
      },
    },
    async ({ limit }) => {
      try {
        const notebooks = await client.listNotebooks({ limit });
        const tree = buildNotebookTree(notebooks);
        const truncated = notebooks.length >= (limit ?? MAX_AUTO_PAGINATE_ITEMS);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ items: notebooks, tree, truncated }) }],
        };
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

  server.registerTool(
    'update_notebook',
    {
      description: 'Rename and/or move a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to update'),
        title: z.string().optional().describe('New title'),
        parent_id: z.string().optional().describe('New parent notebook ID, to move this notebook'),
      },
    },
    async ({ notebook_id, title, parent_id }) => {
      try {
        const notebook = await client.updateNotebook(notebook_id, { title, parent_id });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notebook) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_notebook',
    {
      description: 'Delete a Joplin notebook by ID.',
      inputSchema: {
        notebook_id: z.string().describe('ID of the notebook to delete'),
        permanent: z.boolean().optional().describe('Permanently delete instead of moving to trash'),
      },
    },
    async ({ notebook_id, permanent }) => {
      try {
        await client.deleteNotebook(notebook_id, { permanent });
        return { content: [{ type: 'text' as const, text: `Deleted notebook ${notebook_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
