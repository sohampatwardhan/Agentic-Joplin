# @agentic-joplin/mcp-server

An MCP server that lets agents manage Joplin notes, notebooks, tags, search, and resources via Joplin's Data API.

## Setup

1. In the Joplin desktop app, go to **Options > Web Clipper** and enable the service (default port `41184`).
2. Install and build: `npm install && npm run build --workspace @agentic-joplin/mcp-server`
3. Get a token — two options:
   - **Automatic (no copy-pasting):** run `npm run authorize --workspace @agentic-joplin/mcp-server`. It requests access from Joplin; click **Accept** on the dialog that appears in the app, and the token is fetched and cached to `~/.agentic-joplin/token.json` automatically.
   - **Manual:** in Joplin, go to **Options > Web Clipper > Advanced options**, copy the token, and set it as `JOPLIN_TOKEN` below.
4. Add it to your MCP client config (e.g. Claude Code), running `node packages/mcp-server/dist/index.js` with these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | No, if you used the automatic `authorize` option above | — | API token from Joplin's Web Clipper settings. Falls back to the cached token from `authorize` if unset. |
| `JOPLIN_HOST` | No | `127.0.0.1` | Host where Joplin's Web Clipper service is listening |
| `JOPLIN_PORT` | No | `41184` | Port where Joplin's Web Clipper service is listening |

Joplin desktop must be running with the Web Clipper service enabled for any tool call — or the `authorize` command — to succeed.

## Tools

Full CRUD parity with Joplin's Data API for notes, notebooks, tags, and resources, plus search, note revision history, and a connectivity check. Deliberately excludes `GET /events` (delta sync) and `GET /master_keys` (end-to-end-encryption metadata) — neither has a note-taking use case.

| Tool | Purpose |
|---|---|
| `create_note` | Create a note in a notebook, in Markdown (default) or HTML via `format` |
| `get_note` | Fetch a note by ID; result includes a `format` field |
| `update_note` | Partially update a note; `format` controls how `body` is interpreted |
| `delete_note` | Delete a note by ID, optional `permanent` flag |
| `list_notes` | List notes, optionally scoped to a notebook or tag |
| `get_notebook` | Fetch a notebook by ID |
| `list_notebooks` | List notebooks as a flat list and a nested tree |
| `create_notebook` | Create a notebook, optionally nested |
| `update_notebook` | Rename and/or move a notebook |
| `delete_notebook` | Delete a notebook by ID, optional `permanent` flag |
| `get_tag` | Fetch a tag by ID |
| `list_tags` | List all tags |
| `create_tag` | Create a tag |
| `update_tag` | Rename a tag |
| `delete_tag` | Delete a tag |
| `tag_note` / `untag_note` | Attach/detach a tag on a note |
| `find_notes` | Full-text search |
| `attach_resource` | Upload and attach a file to a note |
| `get_resource` | Fetch resource metadata, optionally with file content |
| `update_resource` | Rename and/or replace a resource's file content |
| `delete_resource` | Delete a resource by ID |
| `list_note_resources` | List resources attached to a note |
| `list_note_revisions` | List a note's revision history (best-effort; see below) |
| `delete_note_revisions` | Permanently delete all of a note's revision history |
| `ping` | Check whether the Joplin Data API is reachable |

**Known limitation:** the Data API has no server-side filter for note revisions, so `list_note_revisions` scans the 500 most recent revisions account-wide and filters client-side. On accounts with heavy edit history across many notes, very old revisions on a rarely-edited note may not surface.

## Development

- `npm run test --workspace @agentic-joplin/mcp-server` — unit tests (mocked Data API, no Joplin instance required)
- `npm run build --workspace @agentic-joplin/mcp-server` — type-check and compile
- `npm run authorize --workspace @agentic-joplin/mcp-server` — run Joplin's clipper authorization handshake and cache the resulting token
- See `SMOKE_TEST.md` for the manual release checklist against a real Joplin instance.
