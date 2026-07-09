# Manual Smoke Test — Joplin MCP Server

Run these checks against a real running Joplin desktop app before each release.

Requires:
- Joplin desktop running
- Web Clipper service enabled (Options > Web Clipper) with an API token generated
- `JOPLIN_TOKEN` (and `JOPLIN_HOST` / `JOPLIN_PORT` if non-default) exported in your shell

Build first: `npm run build --workspace @agentic-joplin/mcp-server`

Then connect an MCP client (e.g. Claude Code) to `node packages/mcp-server/dist/index.js` with the env vars above, and run through:

- [ ] `create_note` — create a note in an existing notebook; verify it appears in Joplin.
- [ ] `create_note` with `format: "html"` — create a note with an HTML body; verify Joplin renders it as HTML (not literal Markdown-escaped tags), and that `get_note` reports `format: "html"` for it.
- [ ] `list_notes` — list notes in that notebook; verify the new note is present.
- [ ] `find_notes` — search for the note by a word from its title; verify it's found.
- [ ] `create_notebook` with a `parent_id` — verify the new notebook appears nested under the parent in Joplin's sidebar.
- [ ] `attach_resource` — attach a small image file to the note; verify the note body now contains a `[title](:/resourceId)` link and the image renders in Joplin.
- [ ] `get_resource` with `include_content: true` — verify the returned `content_base64` decodes back to the original file.
- [ ] `tag_note` / `untag_note` — attach then remove a tag from the note; verify in Joplin's tag panel.
- [ ] `delete_note` — delete the test note; verify it's gone (or in Joplin's trash, per Joplin's delete behavior).
- [ ] Stop the Joplin desktop app, then call any tool — verify the error message mentions the Web Clipper service rather than a raw connection error.
