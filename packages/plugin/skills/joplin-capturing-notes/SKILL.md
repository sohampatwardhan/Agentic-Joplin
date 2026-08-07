---
name: joplin-capturing-notes
description: Use when saving or creating a note in Joplin — resolves or creates the target notebook, chooses Markdown or HTML, writes the note, and applies tags.
---

# Capturing notes in Joplin

See the `using-joplin` skill for the connection check and shared conventions (resolve
names to IDs, `truncated`, delete caution).

## Steps

1. **Find the target notebook.** Call `list_notebooks` and match the user's intended notebook
   by title (use the nested `tree` to disambiguate notebooks with the same name under different
   parents). If it doesn't exist and the user wants it created, call `create_notebook` with the
   `title` and an optional `parent_id` to nest it.
2. **Choose the format.** Default to `markdown`. Use `html` only when the content is genuinely
   HTML (e.g. clipped rich content). The body you pass is stored as-is in that format.
3. **Create the note.** Call `create_note` with `title`, `body`, `format`, and `notebook_id`.
   Capture the returned note `id`.
4. **Apply tags (separate step).** `create_note` does not take tags. For each desired tag:
   ensure it exists via `list_tags` (create it with `create_tag` if missing), then attach it
   with `tag_note` (note id + tag id).
5. **Report** the created note's id and where it landed.

## Diagrams

Joplin renders Mermaid natively inside a fenced ` ```mermaid ` block in **Markdown**
notes. Whenever the note includes or would benefit from a diagram (flowchart, sequence,
architecture, gantt, ER, etc.), **use the `mermaid` skill** to author and validate it,
then embed the fenced ` ```mermaid ` block in the note `body`. Requirements:

- The note `format` must be `markdown` (step 2) — Mermaid does not render in `html` notes.
- Never paste hand-written Mermaid you haven't validated; the `mermaid` skill renders it
  first so the note doesn't display a syntax error to the user.

## Notes

- Don't invent a notebook. If the user didn't name one and none is obvious, ask, or fall back
  to a clearly-named default only if the user approved that.
- For a quick capture with no notebook specified, it's fine to create/append to a dedicated
  inbox notebook — but say so.
