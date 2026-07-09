import { describe, expect, it } from 'vitest';
import { NoteSchema, noteFormatFromMarkupLanguage } from '../src/schemas/note.js';
import { NotebookSchema } from '../src/schemas/notebook.js';
import { TagSchema } from '../src/schemas/tag.js';
import { ResourceSchema } from '../src/schemas/resource.js';
import { RevisionSchema } from '../src/schemas/revision.js';

describe('entity schemas', () => {
  it('parses a valid note', () => {
    const note = NoteSchema.parse({
      id: 'note-1',
      parent_id: 'nb-1',
      title: 'Hello',
      body: 'World',
      markup_language: 1,
      created_time: 1,
      updated_time: 2,
    });
    expect(note.title).toBe('Hello');
  });

  it('rejects a note missing a required field', () => {
    expect(() => NoteSchema.parse({ id: 'note-1', title: 'Hello' })).toThrow();
  });

  it('parses a valid notebook, including a root notebook with an empty parent_id', () => {
    const notebook = NotebookSchema.parse({ id: 'nb-1', parent_id: '', title: 'Work' });
    expect(notebook.title).toBe('Work');
  });

  it('parses a valid tag', () => {
    const tag = TagSchema.parse({ id: 'tag-1', title: 'urgent' });
    expect(tag.title).toBe('urgent');
  });

  it('parses a valid resource', () => {
    const resource = ResourceSchema.parse({
      id: 'res-1',
      title: 'photo.jpg',
      mime: 'image/jpeg',
      file_extension: 'jpg',
      size: 1024,
    });
    expect(resource.mime).toBe('image/jpeg');
  });
});

describe('noteFormatFromMarkupLanguage', () => {
  it('maps markup_language 2 to html', () => {
    expect(noteFormatFromMarkupLanguage(2)).toBe('html');
  });

  it('maps markup_language 1 to markdown', () => {
    expect(noteFormatFromMarkupLanguage(1)).toBe('markdown');
  });

  it('defaults to markdown when markup_language is undefined', () => {
    expect(noteFormatFromMarkupLanguage(undefined)).toBe('markdown');
  });
});

describe('RevisionSchema', () => {
  it('parses a valid revision', () => {
    const revision = RevisionSchema.parse({
      id: 'rev-1',
      item_type: 1,
      item_id: 'note-1',
      title_diff: '...',
      body_diff: '...',
      created_time: 1,
      updated_time: 2,
    });
    expect(revision.item_id).toBe('note-1');
  });

  it('rejects a revision missing a required field', () => {
    expect(() => RevisionSchema.parse({ id: 'rev-1' })).toThrow();
  });
});
