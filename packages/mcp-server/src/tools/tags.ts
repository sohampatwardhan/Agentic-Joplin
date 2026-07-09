import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerTagTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'list_tags',
    {
      description: 'List all Joplin tags.',
      inputSchema: {},
    },
    async () => {
      try {
        const tags = await client.listTags();
        return { content: [{ type: 'text' as const, text: JSON.stringify(tags) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'create_tag',
    {
      description: 'Create a new Joplin tag.',
      inputSchema: {
        title: z.string().describe('Tag title'),
      },
    },
    async ({ title }) => {
      try {
        const tag = await client.createTag({ title });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'tag_note',
    {
      description: 'Attach an existing tag to a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to attach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.attachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Attached tag ${tag_id} to note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'untag_note',
    {
      description: 'Detach a tag from a note.',
      inputSchema: {
        note_id: z.string().describe('ID of the note'),
        tag_id: z.string().describe('ID of the tag to detach'),
      },
    },
    async ({ note_id, tag_id }) => {
      try {
        await client.detachTag(note_id, tag_id);
        return { content: [{ type: 'text' as const, text: `Detached tag ${tag_id} from note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
