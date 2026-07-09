# Manual smoke test — Agentic Joplin plugin

Run against a real Joplin instance (Web Clipper enabled, token set) after building the MCP server.

## Claude Code

- [ ] Install the plugin; confirm it prompts for the Joplin API token.
- [ ] Confirm the four skills appear: `using-joplin`, `joplin-capturing-notes`,
      `joplin-searching-and-updating`, `joplin-organizing` (namespaced `agentic-joplin:<skill>`).
- [ ] Ask the agent to "check my Joplin connection" → it uses the hub skill and `ping` succeeds.
- [ ] Capture: "save a note titled X in notebook Y" → note created in the right notebook.
- [ ] Capture HTML: "save an HTML note …" → `get_note` reports `format: html` and the HTML round-trips.
- [ ] Search/update: "find the note about X and append Y" → found, appended in the right format.
- [ ] Organize: "move notebook A under B and tag its notes Z" → structure updated.
- [ ] Cleanup: "delete the test note" → trashed (agent asks before any permanent delete).

## Codex

- [ ] `export JOPLIN_TOKEN=…`, install the plugin; confirm the four skills load and the joplin
      MCP server connects (`ping`).
- [ ] Repeat the capture / search-update / organize / cleanup checks above.

## MCP launch verification (the deferred build-time check)

- [ ] Confirm the server actually launches on **both** platforms via the bundled config
      (`${CLAUDE_PLUGIN_ROOT}/../mcp-server/dist/index.js`). If a platform does not interpolate
      `${CLAUDE_PLUGIN_ROOT}` in `args`, fall back to: (a) a relative `cwd` + relative `args`, or
      (b) an absolute path, or (c) the published-npm form `npx -y @agentic-joplin/mcp-server`.
      Record which form each platform needed.
