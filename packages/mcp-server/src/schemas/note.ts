import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string(),
  parent_id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  markup_language: z.number().optional(),
  created_time: z.number().optional(),
  updated_time: z.number().optional(),
});

export type Note = z.infer<typeof NoteSchema>;

export type NoteFormat = 'markdown' | 'html';

/** Joplin stores markup_language as 1 (Markdown) or 2 (HTML); undefined/1 defaults to markdown. */
export function noteFormatFromMarkupLanguage(markupLanguage: number | undefined): NoteFormat {
  return markupLanguage === 2 ? 'html' : 'markdown';
}
