# Joplin MCP Server — Design Spec

Date: 2026-07-08
Status: Approved
Scope: Phase 1 of the Agentic-Joplin project (MCP server only; the Joplin plugin and agent-skills sub-projects are separate, later specs).

## Context

Agentic-Joplin's overall aim is to let coding agents integrate with Joplin, via three pieces: a Joplin plugin, an MCP server, and agent skills. This spec covers only the MCP server, chosen as the first piece to build because it's independently useful to any MCP-capable agent immediately, and the plugin/skills sub-projects can build on top of it later.

This is a from-scratch implementation, unrelated to any third-party Joplin MCP server that may be connected in a given session/environment.

## Goals

- Give agents a well-typed, agent-ergonomic set of MCP tools for managing Joplin notes, notebooks (including nested notebooks), tags, search, and note resources (attachments).
- Wrap Joplin's Data API (the local REST API served by the desktop app's Web Clipper service) in Phase 1.
- Keep the Data API access isolated behind a client interface so a Phase 2 `joplin-cli`-backed implementation can be added later without reworking the tool layer.

## Non-goals (Phase 1)

- `joplin-cli` backend support (Phase 2).
- Joplin plugin, agent skill files (separate sub-projects/specs).
- Full Data API surface (revisions, sync status, master keys, event log, etc.) — only core note/notebook/tag/search/resource operations.
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
│       │   │   ├── notebooks.ts # list/create notebooks (folders), including nested tree assembly
│       │   │   ├── tags.ts      # list/create tags, attach/detach from notes
│       │   │   ├── search.ts    # full-text search
│       │   │   └── resources.ts # attach/read file resources on notes
│       │   ├── schemas/
│       │   │   └── *.ts         # shared Zod schemas / TS types for Joplin entities (Note, Notebook, Tag, Resource)
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

- `getNote(id)`, `createNote(input)`, `updateNote(id, input)`, `deleteNote(id)`, `listNotes({ parentId?, limit? })`
- `listNotebooks()` — returns flat items with `parent_id`; a helper assembles them into a nested tree, since notebooks can be nested like folders
- `createNotebook(input)` — accepts optional `parent_id` for nesting
- `listTags()`, `createTag(input)`, `attachTag(noteId, tagId)`, `detachTag(noteId, tagId)`
- `search(query, { type?, limit? })` — wraps `/search`
- `createResource(input, fileBuffer)`, `getResource(id)`, `listNoteResources(noteId)`

**Pagination:** the Data API returns `{ items, has_more }`. `JoplinClient`'s list/search methods auto-paginate internally up to a capped total (e.g. 200 items) rather than exposing raw page tokens to the agent. Each corresponding tool can still accept an optional `limit` to cap results earlier.

## MCP tool surface (agent-facing)

| Tool | Purpose |
|---|---|
| `create_note` | title, body, notebook_id, optional tags |
| `get_note` | fetch by id, with a fields param to avoid over-fetching |
| `update_note` | partial update by id |
| `delete_note` | delete by id |
| `list_notes` | by notebook_id, or all, capped/paginated |
| `list_notebooks` | flat list + nested tree view |
| `create_notebook` | title, optional parent_id |
| `list_tags` | all tags |
| `create_tag` | title |
| `tag_note` / `untag_note` | attach/detach a tag to/from a note |
| `find_notes` | full-text search, optional notebook/tag scoping |
| `attach_resource` | upload a file and attach to a note |
| `get_resource` | fetch resource metadata/content |

This mirrors the shape of typical Joplin MCP tool conventions (e.g. verb_noun naming, one tool per resource-action), as a sanity check that the surface is agent-ergonomic.

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
