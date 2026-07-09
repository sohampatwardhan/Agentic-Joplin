import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
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
}
