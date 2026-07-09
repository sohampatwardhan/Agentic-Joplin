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
- [ ] `update_notebook` — rename a notebook and move it under a different parent; verify both changes in Joplin's sidebar.
- [ ] `delete_notebook` — delete a test notebook; verify it's gone (or in trash).
- [ ] `update_tag` — rename a tag; verify the new name shows in Joplin's tag panel.
- [ ] `delete_tag` — delete a test tag; verify it's gone.
- [ ] `update_resource` — replace an attached file's content; verify Joplin shows the new content.
- [ ] `delete_resource` — delete a resource; verify it's gone (note body still contains the now-broken link, which is expected).
- [ ] `list_note_resources` — verify it lists the resources you attached earlier in this checklist.
- [ ] `list_note_revisions` — edit a note a couple of times, then verify revisions show up.
- [ ] `delete_note_revisions` — verify the note's revision history is cleared afterward (check Joplin's note history panel).
- [ ] `ping` — verify it reports available while Joplin is running, and reports a connection error after Joplin is closed.
- [ ] Stop the Joplin desktop app, then call any tool — verify the error message mentions the Web Clipper service rather than a raw connection error.
