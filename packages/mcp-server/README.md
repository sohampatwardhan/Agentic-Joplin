# @agentic-joplin/mcp-server

An MCP server that lets agents manage Joplin notes, notebooks, tags, search, and resources via Joplin's Data API.

## Setup

1. In the Joplin desktop app, go to **Options > Web Clipper** and note the port (default `41184`), then generate an API token.
2. Install and build: `npm install && npm run build --workspace @agentic-joplin/mcp-server`
3. Add it to your MCP client config (e.g. Claude Code), running `node packages/mcp-server/dist/index.js` with these environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | Yes | — | API token from Joplin's Web Clipper settings |
| `JOPLIN_HOST` | No | `127.0.0.1` | Host where Joplin's Web Clipper service is listening |
| `JOPLIN_PORT` | No | `41184` | Port where Joplin's Web Clipper service is listening |

Joplin desktop must be running with the Web Clipper service enabled for any tool call to succeed.

## Tools

| Tool | Purpose |
|---|---|
| `create_note` | Create a note in a notebook, in Markdown (default) or HTML via `format` |
| `get_note` | Fetch a note by ID; result includes a `format` field |
| `update_note` | Partially update a note; `format` controls how `body` is interpreted |
| `delete_note` | Delete a note |
| `list_notes` | List notes, optionally scoped to a notebook |
| `list_notebooks` | List notebooks as a flat list and a nested tree |
| `create_notebook` | Create a notebook, optionally nested |
| `list_tags` | List all tags |
| `create_tag` | Create a tag |
| `tag_note` / `untag_note` | Attach/detach a tag on a note |
| `find_notes` | Full-text search |
| `attach_resource` | Upload and attach a file to a note |
| `get_resource` | Fetch resource metadata, optionally with file content |

## Development

- `npm run test --workspace @agentic-joplin/mcp-server` — unit tests (mocked Data API, no Joplin instance required)
- `npm run build --workspace @agentic-joplin/mcp-server` — type-check and compile
- See `SMOKE_TEST.md` for the manual release checklist against a real Joplin instance.
