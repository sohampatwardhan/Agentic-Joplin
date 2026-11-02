---
name: joplin-organizing
description: Use when restructuring a Joplin workspace — nesting, moving, or renaming notebooks; retagging notes; and cleaning up.
---

# Organizing a Joplin workspace

See the `using-joplin` skill for the connection check and shared conventions.

## Survey first

Call `list_notebooks` (use the nested `tree`) and `list_tags` to understand the current
structure before changing anything. Confirm the intended end state with the user for anything
sweeping.

## Notebooks

- **Rename or move:** `update_notebook` with `title` (rename) and/or `parent_id` (move under a
  new parent; a top-level notebook has an empty `parent_id`).
- **Create structure:** `create_notebook` with `parent_id` to build nested notebooks.

## Tags

- Attach/detach with `tag_note` / `untag_note`.
- `create_tag`, `update_tag` (rename), `delete_tag` manage the tag vocabulary itself.

## Cleanup — be careful

- `delete_note` / `delete_notebook` trash by default; **only** pass `permanent: true` after the
  user explicitly confirms, since it can't be undone. Prefer trashing.
- For bulk operations, enumerate with `list_notes` (by notebook or tag) and act per-item. Watch
  the `truncated` flag — if the list was capped, process in narrower batches so you don't miss
  items.

## Notes

- Moving a notebook moves all its notes and sub-notebooks with it.
- Organizing doesn't change note bodies. If merging notes means combining bodies, keep any
  Mermaid or math blocks intact (see "Diagrams and math" in `using-joplin`).
- When deduplicating or merging notebooks, move notes to the target first, verify, then delete
  the now-empty source (trashed, not permanent, unless confirmed).
