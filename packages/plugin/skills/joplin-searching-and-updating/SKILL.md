---
name: joplin-searching-and-updating
description: Use when finding, reading, or updating existing Joplin notes — full-text search with notebook/tag scoping, read results, then safely update or append.
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
