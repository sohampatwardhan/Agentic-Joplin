---
name: joplin-searching-and-updating
description: Use when finding, reading, or updating existing Joplin notes — full-text search with notebook/tag scoping, read results, then safely update or append.
metadata:
  author: sohampatwardhan
  version: "1.0.0"
---

# Searching and updating Joplin notes

See the `using-joplin` skill for the connection check and shared conventions.

## Search is full-text, not semantic

`find_notes` runs Joplin's keyword full-text search — it does not understand meaning. You
provide the semantic layer:

- Start with the user's key terms; if results are thin, reformulate (synonyms, broader terms),
  and use the `*` wildcard for prefixes.
- Scope when you can: pass `notebook_id` and/or `tag_id` to narrow.
- Read the candidate results and judge relevance yourself rather than trusting rank.
- If the result set comes back `truncated`, narrow the query or raise/lower `limit` deliberately
  — don't assume you've seen every match.

## Reading

- `get_note` by id returns the note; pass `fields` to fetch only what you need for large notes.
- Check the returned `format` before editing so your edit matches the note's Markdown/HTML.

## Updating and appending

- `update_note` is a partial update by id — send only the fields you're changing (`title`,
  `body`, `format`, `notebook_id`).
- To **append** rather than replace: `get_note` to read the current `body`, concatenate your
  addition, then `update_note` with the combined `body` in the note's existing `format`.
- Be aware this read-then-write is not atomic: if the note may be edited elsewhere (the Joplin
  UI, sync) between your read and write, your write can clobber that change. Keep the window
  small and don't interleave other edits.

## Enumerating

Use `list_notes` with `notebook_id` or `tag_id` to walk a set of notes (mind the `truncated`
flag). Use `list_note_revisions` if the user wants a note's edit history.

## Diagrams and math

Joplin renders Mermaid (` ```mermaid ` fences) and KaTeX (`$...$` inline, `$$...$$`
display) in **Markdown** notes. Follow "Diagrams and math" in the `using-joplin` skill. When
updating:

- When adding a diagram or formula, or fixing a broken one already in the note, use the
  `mermaid` or `katex` skill if it's available, then `update_note`. If it isn't, edit the
  plain fence or `$`/`$$` math directly and keep the syntax simple.
- Keep the note's existing `format`; both only render when it's `markdown`. Don't convert an
  `html` note just to add a diagram unless the user asks.
- Add diagrams or formulas only when they genuinely help, not as decoration. Leave existing
  ones alone unless the user asked you to change them or they're broken.
- If the note mirrors a verbatim source (slides, a document), only add diagrams or formulas
  that are in that source.
- When appending, follow the read-then-write appending guidance above.
- You may offer to install a missing companion skill, but only after an explicit yes, and
  don't ask again this session if they decline.
