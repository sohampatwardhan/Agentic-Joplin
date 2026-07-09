---
name: using-joplin
description: Use when working with Joplin notes, notebooks, or tags via the Joplin MCP tools — start here to check the connection, learn the available tools, avoid common pitfalls, and route to the capture, search-and-update, or organize workflows.
---

# Using Joplin

These tools talk to a running Joplin desktop app through its Data API (the Web Clipper
service). Tool names below are the base names; your client may expose them namespaced
(e.g. `mcp__joplin__create_note`).

## Before anything else: check the connection

Call `ping` first. If it does not return available, tell the user to:
1. Open the Joplin desktop app.
2. Enable the Web Clipper service (Options > Web Clipper).
3. Make sure the API token is configured (the plugin reads `JOPLIN_TOKEN`).

Do not keep retrying other tools if `ping` fails — surface the fix instead.

## What's available

| Area | Tools |
|---|---|
| Notes | `create_note`, `get_note`, `update_note`, `delete_note`, `list_notes` |
| Notebooks | `get_notebook`, `list_notebooks`, `create_notebook`, `update_notebook`, `delete_notebook` |
| Tags | `get_tag`, `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `tag_note`, `untag_note` |
| Search | `find_notes` |
| Resources | `attach_resource`, `get_resource`, `update_resource`, `delete_resource`, `list_note_resources` |
| Revisions | `list_note_revisions`, `delete_note_revisions` |
| System | `ping` |

## Conventions and pitfalls

- **Resolve names to IDs first.** Every tool takes IDs, not titles. Use `list_notebooks`
  (returns a flat list plus a nested tree), `find_notes`, or `list_tags` to look up an ID
  before acting on it.
- **Deletes trash by default.** `delete_note` / `delete_notebook` move to the trash. Passing
  `permanent: true` is irreversible — confirm with the user before a permanent delete.
- **Lists can be truncated.** List/search results include a `truncated` flag; if it is true,
  narrow the query (by notebook/tag) or pass a smaller `limit` rather than assuming you saw
  everything.
- **Attaching a resource rewrites the note body.** `attach_resource` reads the note and writes
  an appended link back as a second call — avoid interleaving other edits to the same note
  around it.
- **Notes have a format.** A note is Markdown or HTML; `get_note` returns a `format` field, and
  `create_note`/`update_note` take a `format` (`markdown` default, or `html`). HTML is stored
  faithfully — you do not need to think about Joplin's internal markup fields.

## Which workflow

- Creating/saving a note → use the `joplin-capturing-notes` skill.
- Finding, reading, or updating existing notes → use the `joplin-searching-and-updating` skill.
- Restructuring notebooks/tags or cleaning up → use the `joplin-organizing` skill.
