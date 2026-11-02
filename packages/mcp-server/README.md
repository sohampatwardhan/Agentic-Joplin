# agentic-joplin

An [MCP](https://modelcontextprotocol.io) server that lets AI agents manage [Joplin](https://joplinapp.org) notes, notebooks, tags, search, and resources via Joplin's local Data API. Stdio transport, 26 tools.

```bash
npx agentic-joplin
```

## Requirements

- Node.js ≥ 20
- The Joplin desktop app running, with the **Web Clipper service enabled** (**Options > Web Clipper**, default port `41184`). Every tool call — and the authorize step — talks to this local service.

## 1. Authorize (one time)

The server needs a Joplin API token. Pick one:

- **Automatic (recommended):** run

  ```bash
  npx -y -p agentic-joplin agentic-joplin-authorize
  ```

  (`-p` is needed because the authorize command is the package's second bin.) It asks Joplin for access; click **Accept** in the dialog that appears in Joplin. The token is cached to `~/.agentic-joplin/token.json` (file mode `0600`) and picked up automatically by the server — you don't need to set `JOPLIN_TOKEN`.
- **Manual:** in Joplin, open **Options > Web Clipper > Advanced options**, copy the token, and pass it as `JOPLIN_TOKEN` in your MCP client config.

If neither is present, the server still starts; on the first tool call it runs the same authorization handshake itself (Joplin shows the Accept dialog, and the call waits up to 5 minutes for you to respond), then caches the token as above.

Token resolution order: `JOPLIN_TOKEN` → `~/.agentic-joplin/token.json` → interactive authorization on first request.

## 2. Configure your MCP client

Most MCP clients (Claude Desktop's `claude_desktop_config.json`, Cursor's `mcp.json`, a project `.mcp.json`, …) accept this shape:

```json
{
  "mcpServers": {
    "joplin": {
      "command": "npx",
      "args": ["-y", "agentic-joplin"]
    }
  }
}
```

With an explicit token or a non-default host/port:

```json
{
  "mcpServers": {
    "joplin": {
      "command": "npx",
      "args": ["-y", "agentic-joplin"],
      "env": {
        "JOPLIN_TOKEN": "<your Joplin API token>",
        "JOPLIN_HOST": "127.0.0.1",
        "JOPLIN_PORT": "41184"
      }
    }
  }
}
```

Claude Code: `claude mcp add joplin -- npx -y agentic-joplin`

Codex (`~/.codex/config.toml`):

```toml
[mcp_servers.joplin]
command = "npx"
args = ["-y", "agentic-joplin"]
env_vars = ["JOPLIN_TOKEN"]
```

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JOPLIN_TOKEN` | No | — | API token from Joplin's Web Clipper settings. If unset, falls back to the cached token in `~/.agentic-joplin/token.json`, then to interactive authorization on first request. |
| `JOPLIN_HOST` | No | `127.0.0.1` | Host where Joplin's Web Clipper service is listening (also used by `agentic-joplin-authorize`) |
| `JOPLIN_PORT` | No | `41184` | Port where Joplin's Web Clipper service is listening (also used by `agentic-joplin-authorize`) |

The server speaks MCP over stdin/stdout; its only stderr output is a startup line (`Agentic Joplin MCP server running on stdio`) and fatal errors.

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

This package lives in the [Agentic-Joplin monorepo](https://github.com/sohampatwardhan/Agentic-Joplin) under `packages/mcp-server`. From the repo root:

- `npm install && npm run build --workspace agentic-joplin` — type-check and compile to `dist/`
- `npm run test --workspace agentic-joplin` — unit tests (mocked Data API, no Joplin instance required)
- `npm run authorize --workspace agentic-joplin` — run Joplin's clipper authorization handshake and cache the resulting token
- `node packages/mcp-server/dist/index.js` — run the server from a local build
- See [`SMOKE_TEST.md`](https://github.com/sohampatwardhan/Agentic-Joplin/blob/main/packages/mcp-server/SMOKE_TEST.md) for the manual release checklist against a real Joplin instance.

## License

MIT
