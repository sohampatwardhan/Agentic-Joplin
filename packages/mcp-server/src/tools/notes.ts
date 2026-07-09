import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { noteFormatFromMarkupLanguage } from '../schemas/note.js';
import { toToolError } from './toolError.js';

export function registerNoteTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'create_note',
    {
      description: 'Create a new Joplin note in the given notebook, in Markdown or HTML format.',
      inputSchema: {
        title: z.string().describe('Note title'),
        body: z.string().optional().describe('Note body, in the format given by "format"'),
        format: z.enum(['markdown', 'html']).default('markdown').describe('Format of the body content'),
        notebook_id: z.string().describe('ID of the notebook to create the note in'),
      },
    },
    async ({ title, body, format, notebook_id }) => {
      try {
        const note =
          format === 'html'
            ? await client.createNote({ title, parent_id: notebook_id, body_html: body, markup_language: 2 })
            : await client.createNote({ title, parent_id: notebook_id, body });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'get_note',
    {
      description: 'Fetch a Joplin note by ID. The result includes a "format" field (markdown or html).',
      inputSchema: {
        note_id: z.string().describe('ID of the note to fetch'),
      },
    },
    async ({ note_id }) => {
      try {
        const note = await client.getNote(note_id);
        const format = noteFormatFromMarkupLanguage(note.markup_language);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...note, format }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'update_note',
    {
      description: 'Partially update a Joplin note by ID. Set "format" to control how "body" is interpreted.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to update'),
        title: z.string().optional().describe('New title'),
        body: z.string().optional().describe('New body, in the format given by "format"'),
        format: z.enum(['markdown', 'html']).optional().describe('Format of the body content, if body is set'),
        notebook_id: z.string().optional().describe('Move the note to this notebook ID'),
      },
    },
    async ({ note_id, title, body, format, notebook_id }) => {
      try {
        const bodyFields =
          body === undefined ? {} : format === 'html' ? { body_html: body, markup_language: 2 } : { body };
        const note = await client.updateNote(note_id, { title, parent_id: notebook_id, ...bodyFields });
        return { content: [{ type: 'text' as const, text: JSON.stringify(note) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'delete_note',
    {
      description: 'Delete a Joplin note by ID.',
      inputSchema: {
        note_id: z.string().describe('ID of the note to delete'),
      },
    },
    async ({ note_id }) => {
      try {
        await client.deleteNote(note_id);
        return { content: [{ type: 'text' as const, text: `Deleted note ${note_id}` }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List Joplin notes, optionally scoped to a notebook.',
      inputSchema: {
        notebook_id: z.string().optional().describe('Only list notes in this notebook ID'),
        limit: z.number().int().positive().optional().describe('Maximum number of notes to return'),
      },
    },
    async ({ notebook_id, limit }) => {
      try {
        const notes = await client.listNotes({ parentId: notebook_id, limit });
        return { content: [{ type: 'text' as const, text: JSON.stringify(notes) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
