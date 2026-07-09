import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerTagTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'get_tag',
    {
      description: 'Fetch a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to fetch'),
      },
    },
    async ({ tag_id }) => {
      try {
        const tag = await client.getTag(tag_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

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
    'update_tag',
    {
      description: 'Rename a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to rename'),
        title: z.string().describe('New tag title'),
      },
    },
    async ({ tag_id, title }) => {
      try {
        const tag = await client.updateTag(tag_id, { title });
        return { content: [{ type: 'text' as const, text: JSON.stringify(tag) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_tag',
    {
      description: 'Delete a Joplin tag by ID.',
      inputSchema: {
        tag_id: z.string().describe('ID of the tag to delete'),
      },
    },
    async ({ tag_id }) => {
      try {
        await client.deleteTag(tag_id);
        return { content: [{ type: 'text' as const, text: `Deleted tag ${tag_id}` }] };
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
