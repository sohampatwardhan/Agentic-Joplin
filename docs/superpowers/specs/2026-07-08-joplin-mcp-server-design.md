# Joplin MCP Server — Design Spec

Date: 2026-07-08
Status: Approved
Scope: Phase 1 of the Agentic-Joplin project (MCP server only; the Joplin plugin and agent-skills sub-projects are separate, later specs).

## Context

Agentic-Joplin's overall aim is to let coding agents integrate with Joplin, via three pieces: a Joplin plugin, an MCP server, and agent skills. This spec covers only the MCP server, chosen as the first piece to build because it's independently useful to any MCP-capable agent immediately, and the plugin/skills sub-projects can build on top of it later.

This is a from-scratch implementation, unrelated to any third-party Joplin MCP server that may be connected in a given session/environment.

## Goals

- Fully interface with Joplin's Data API as far as it makes sense for an agent to use it: full CRUD parity for notes, notebooks, tags, and resources (not just a reduced subset), plus search, note revision history, and a connectivity check — not just the minimum needed for basic note-taking.
- Give agents a well-typed, agent-ergonomic set of MCP tools for all of the above, including nested notebooks and notes in either Markdown or HTML format.
- Wrap Joplin's Data API (the local REST API served by the desktop app's Web Clipper service) in Phase 1.
- Keep the Data API access isolated behind a client interface so a Phase 2 `joplin-cli`-backed implementation can be added later without reworking the tool layer.

## Non-goals (Phase 1)

- `joplin-cli` backend support (Phase 2).
- Joplin plugin, agent skill files (separate sub-projects/specs).
- Events / delta-sync (`GET /events`) and master keys (`GET /master_keys`) — deliberately excluded even though the rest of the Data API is covered. Events is a sync-watching feature with no clear agent use case here, and master keys exposes end-to-end-encryption key metadata, which is a security-adjacent surface with no note-taking use case.
- Any HTTP transport for the MCP server itself — stdio only.

## Repo layout

Monorepo using npm workspaces. The MCP server is the first package; the plugin and skills packages land later as separate specs/sub-projects.

```
Agentic-Joplin/
├── package.json                 # workspace root
├── packages/
│   └── mcp-server/
│       ├── package.json
│       ├── src/
│       │   ├── index.ts         # entrypoint: creates MCP server, registers tools, connects stdio transport
│       │   ├── client/
│       │   │   └── JoplinClient.ts   # typed wrapper over the Joplin Data API (fetch-based)
│       │   ├── tools/
│       │   │   ├── notes.ts     # create/get/update/delete/list notes
│       │   │   ├── notebooks.ts # get/list/create/update/delete notebooks (folders), including nested tree assembly
│       │   │   ├── tags.ts      # get/list/create/update/delete tags, attach/detach from notes
│       │   │   ├── search.ts    # full-text search
│       │   │   ├── resources.ts # attach/get/update/delete/list resources on notes
│       │   │   ├── revisions.ts # list/delete a note's revision history
│       │   │   └── system.ts    # ping (connectivity check)
│       │   ├── schemas/
│       │   │   └── *.ts         # shared Zod schemas / TS types for Joplin entities (Note, Notebook, Tag, Resource, Revision)
│       │   └── config.ts        # reads JOPLIN_TOKEN / JOPLIN_PORT / JOPLIN_HOST from env
│       └── test/
│           └── *.test.ts        # unit tests, JoplinClient mocked
```

## Architecture

Three layers, chosen over a thin direct-mapping approach (tangles HTTP logic into tool handlers, harder to test) and a generic API-proxy approach (pushes Data API knowledge onto the agent, contradicts named-tool ergonomics):

1. **`JoplinClient`** — typed wrapper over the Data API. Knows nothing about MCP; returns parsed data or throws typed errors (`JoplinConnectionError`, `JoplinApiError`).
2. **Tool handlers** (`tools/*.ts`) — MCP-facing. Each tool has a Zod input schema, calls into `JoplinClient`, and maps client errors to MCP tool error results.
3. **Shared schemas** (`schemas/*.ts`) — Zod schemas / TS types for Joplin entities, reused by both client and tool layers.

Transport: stdio (standard for local MCP servers run by Claude Code/Desktop/other MCP clients) — no HTTP server of our own to manage.

Runtime: TypeScript / Node.js, using `@modelcontextprotocol/sdk` (latest stable: 1.29.0) — `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`. The split `@modelcontextprotocol/server` package only exists as an unreleased 2.0 alpha/beta with no stable version, so Phase 1 targets the stable 1.x SDK instead. Tool schemas use the standard `zod` package (peer dependency, v3.25+) as a raw shape object passed to `registerTool`'s `inputSchema`, not a `z.object(...)`-wrapped schema. Tool errors are signaled via `{ content: [...], isError: true }`, not thrown exceptions.

## `JoplinClient` methods

- **Notes:** `getNote(id)`, `createNote(input)`, `updateNote(id, input)`, `deleteNote(id, { permanent? })`, `listNotes({ parentId?, tagId?, limit? })`
- Note format: Joplin notes are Markdown by default but may be HTML. `createNote`/`updateNote` accept either `body` (Markdown) or `body_html` (HTML), matching the Data API's own two input fields. `getNote` requests the note's `markup_language` field (1 = Markdown, 2 = HTML) and a `noteFormatFromMarkupLanguage` helper maps it to a friendly `'markdown' | 'html'` value for tool output.
- **Notebooks:** `getNotebook(id)`, `listNotebooks()`, `createNotebook(input)`, `updateNotebook(id, input)`, `deleteNotebook(id, { permanent? })` — `listNotebooks()` returns flat items with `parent_id`; a helper assembles them into a nested tree, since notebooks can be nested like folders. `updateNotebook` supports both renaming (`title`) and moving (`parent_id`).
- **Tags:** `getTag(id)`, `listTags()`, `createTag(input)`, `updateTag(id, input)`, `deleteTag(id)`, `attachTag(noteId, tagId)`, `detachTag(noteId, tagId)`
- **Search:** `search(query, { type?, limit? })` — wraps `/search`
- **Resources:** `createResource(input)`, `getResource(id)`, `updateResource(id, input)`, `deleteResource(id)`, `getResourceFile(id)`, `listNoteResources(noteId)`, `attachResourceToNote(noteId, resourceId, title)`. `updateResource` supports both replacing file content (multipart) and renaming (JSON props-only), matching the Data API's two `PUT /resources/:id` modes.
- **Revisions:** `listRevisions(noteId)`, `deleteNoteRevisions(noteId)`. The Data API only exposes an unscoped `GET /revisions` (no note-id filter) — `listRevisions` requests the most recent 500 revisions account-wide (`order_by=created_time&order_dir=DESC`) and filters client-side by `item_id`/`item_type`. **Known limitation:** on accounts with heavy edit history across many notes, very old revisions on a rarely-edited note may fall outside that 500-item window and not surface. This is a constraint of the underlying API (no server-side note filter), not a bug in this client.
- **System:** `ping()` — wraps `GET /ping`, which returns the plain-text string `"JoplinClipperServer"` rather than JSON, so it bypasses the generic JSON-parsing request path and does its own `response.text()` comparison.

**Pagination:** the Data API returns `{ items, has_more }` for top-level collections (e.g. `/notes`, `/folders`, `/tags`). Some relation endpoints (e.g. `/folders/:id/notes`) are documented ambiguously and may return a bare array instead — `JoplinClient`'s internal pagination helper handles both shapes defensively (a bare array is treated as a complete, one-shot result). List/search methods auto-paginate internally up to a capped total (e.g. 200 items, 500 for revisions) rather than exposing raw page tokens to the agent. Each corresponding tool can still accept an optional `limit` to cap results earlier.

## MCP tool surface (agent-facing)

| Tool | Purpose |
|---|---|
| `create_note` | title, body, notebook_id, optional `format` (`markdown` default, or `html`) |
| `get_note` | fetch by id, with a fields param to avoid over-fetching; result includes a `format` field |
| `update_note` | partial update by id; optional `format` controls how `body` is interpreted |
| `delete_note` | delete by id, optional `permanent` flag |
| `list_notes` | by notebook_id, by tag_id, or all, capped/paginated |
| `get_notebook` | fetch a notebook by id |
| `list_notebooks` | flat list + nested tree view |
| `create_notebook` | title, optional parent_id |
| `update_notebook` | rename and/or move (change parent_id) |
| `delete_notebook` | delete by id, optional `permanent` flag |
| `get_tag` | fetch a tag by id |
| `list_tags` | all tags |
| `create_tag` | title |
| `update_tag` | rename a tag |
| `delete_tag` | delete a tag |
| `tag_note` / `untag_note` | attach/detach a tag to/from a note |
| `find_notes` | full-text search, optional notebook/tag scoping |
| `attach_resource` | upload a file and attach to a note |
| `get_resource` | fetch resource metadata/content |
| `update_resource` | rename and/or replace a resource's file content |
| `delete_resource` | delete a resource by id |
| `list_note_resources` | list resources attached to a note |
| `list_note_revisions` | list a note's revision history (best-effort — see `listRevisions` limitation above) |
| `delete_note_revisions` | permanently delete all of a note's revision history |
| `ping` | check whether the Joplin Data API is reachable |

This mirrors the shape of typical Joplin MCP tool conventions (e.g. verb_noun naming, one tool per resource-action), as a sanity check that the surface is agent-ergonomic. Deliberately excluded: `GET /events` (delta sync) and `GET /master_keys` — see Non-goals.

## Configuration

Env vars only, read at startup by `config.ts`:

- `JOPLIN_TOKEN` (required) — Data API auth token, generated in Joplin's Options > Web Clipper settings.
- `JOPLIN_PORT` (default `41184`)
- `JOPLIN_HOST` (default `127.0.0.1`)

Missing `JOPLIN_TOKEN` fails fast at server startup with a clear error message, not a mid-call crash.

## Error handling

- **Connectivity:** if the Data API is unreachable (Joplin app not running, or Web Clipper service disabled), `JoplinClient` throws `JoplinConnectionError`. Tool handlers catch it and return an MCP tool error result with a human-readable hint (e.g. "Is Joplin running with Web Clipper enabled?") rather than a raw connection-refused stack trace.
- **API errors:** non-2xx responses from the Data API are parsed into `JoplinApiError` (status + message) and surfaced as a tool error the agent can react to (e.g. 404 on `get_note` → "note not found", not a crash).
- **Validation:** Zod schemas on every tool input reject malformed calls before any network request.

## Testing

- Unit tests per tool file, mocking `JoplinClient` (not raw `fetch`) — verifies input validation, correct client calls, and error-to-tool-result mapping.
- Unit tests for `JoplinClient` itself, mocking `fetch` — verifies URL/query construction, auth token inclusion, pagination accumulation, and error parsing.
- A short manual smoke-test checklist (markdown doc) for release verification against a real running Joplin app: create/list/search/delete a note, nested notebook creation, attach a resource.

## Future (Phase 2, out of scope here)

- `joplin-cli`-backed alternative implementation of the `JoplinClient` interface, selectable via config, for headless use without the desktop app running.
- Joplin plugin sub-project (separate spec).
- Agent skills sub-project (separate spec), assuming this MCP server (or an equivalent) provides the underlying tools.
