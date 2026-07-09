import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_AUTO_PAGINATE_ITEMS, type JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerResourceTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'attach_resource',
    {
      description:
        'Upload a file and attach it to a note as a resource. Note: this reads the note body and writes back an appended link as two separate requests, so a concurrent edit to the same note (in the Joplin UI, via sync, or another tool call) between the read and write can be overwritten.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to attach the file to'),
        filename: z.string().describe('File name, including extension'),
        file_base64: z.string().describe('Base64-encoded file content'),
        title: z.string().optional().describe('Resource title; defaults to the filename'),
        mime: z.string().optional().describe('MIME type of the file'),
      },
    },
    async ({ note_id, filename, file_base64, title, mime }) => {
      try {
        const data = Buffer.from(file_base64, 'base64');
        const resourceTitle = title ?? filename;
        const resource = await client.createResource({ title: resourceTitle, filename, data, mime });
        const note = await client.attachResourceToNote(note_id, resource.id, resourceTitle);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ resource, note }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_resource',
    {
      description: "Fetch a resource's metadata, and optionally its file content as base64.",
      inputSchema: {
        resource_id: z.string().describe('ID of the resource'),
        include_content: z.boolean().optional().describe('Include the base64-encoded file content'),
      },
    },
    async ({ resource_id, include_content }) => {
      try {
        const resource = await client.getResource(resource_id);
        if (!include_content) {
          return { content: [{ type: 'text' as const, text: JSON.stringify(resource) }] };
        }
        const file = await client.getResourceFile(resource_id);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ ...resource, content_base64: file.toString('base64') }),
            },
          ],
        };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_resource',
    {
      description: "Rename a resource and/or replace its file content.",
      inputSchema: {
        resource_id: z.string().describe('ID of the resource to update'),
        title: z.string().optional().describe('New title'),
        filename: z.string().optional().describe('New file name, if replacing content'),
        file_base64: z.string().optional().describe('Base64-encoded new file content, if replacing content'),
        mime: z.string().optional().describe('MIME type of the new file content'),
      },
    },
    async ({ resource_id, title, filename, file_base64, mime }) => {
      try {
        const data = file_base64 !== undefined ? Buffer.from(file_base64, 'base64') : undefined;
        const resource = await client.updateResource(resource_id, { title, data, filename, mime });
        return { content: [{ type: 'text' as const, text: JSON.stringify(resource) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_resource',
    {
      description: 'Delete a resource by ID.',
      inputSchema: {
        resource_id: z.string().describe('ID of the resource to delete'),
      },
    },
    async ({ resource_id }) => {
      try {
        await client.deleteResource(resource_id);
        return { content: [{ type: 'text' as const, text: `Deleted resource ${resource_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_note_resources',
    {
      description: 'List resources attached to a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        limit: z.number().int().positive().optional().describe('Maximum number of resources to return'),
      },
    },
    async ({ note_id, limit }) => {
      try {
        const resources = await client.listNoteResources(note_id, { limit });
        const truncated = resources.length >= (limit ?? MAX_AUTO_PAGINATE_ITEMS);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ items: resources, truncated }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
