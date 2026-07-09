# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-09

Initial development release. First of the project's three planned pieces — the **MCP server** —
is complete; the Joplin plugin and agent skills are planned as separate sub-projects.

### Added

- **`@agentic-joplin/mcp-server`** — a stdio Model Context Protocol server wrapping Joplin's
  local Data API, exposing 26 tools across 7 groups:
  - **Notes:** `create_note`, `get_note`, `update_note`, `delete_note`, `list_notes`
    (Markdown or HTML via a `format` parameter; `list_notes` can scope by notebook or tag).
  - **Notebooks:** `get_notebook`, `list_notebooks` (flat list + nested tree), `create_notebook`,
    `update_notebook` (rename/move), `delete_notebook`.
  - **Tags:** `get_tag`, `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `tag_note`, `untag_note`.
  - **Search:** `find_notes` (full-text, optional notebook/tag scoping).
  - **Resources:** `attach_resource`, `get_resource`, `update_resource`, `delete_resource`,
    `list_note_resources`.
  - **Revisions:** `list_note_revisions`, `delete_note_revisions`.
  - **System:** `ping`.
- Layered architecture: a typed `JoplinClient` HTTP wrapper, MCP tool handlers with Zod input
  schemas, and shared entity schemas. Env-based configuration (`JOPLIN_TOKEN`, `JOPLIN_HOST`,
  `JOPLIN_PORT`).
- Optional permanent-delete flag on note/notebook deletion; automatic internal pagination with a
  per-call `limit` and a `truncated` signal on list results.
- npm-workspaces monorepo scaffold, unit test suite (121 tests, Data API mocked), design spec,
  implementation plan, package README, and a manual smoke-test checklist.

### Notes

Behaviors confirmed against a live Joplin instance and handled accordingly:

- HTML notes are stored as raw HTML in the `body` field with `markup_language: 2` (the Data API's
  `body_html` parameter converts HTML to Markdown, so it is not used for faithful HTML storage).
- Joplin's DELETE endpoints return HTTP 200 with an empty body (not 204); responses are parsed
  accordingly.
- Search filters notebooks via the API's `folder` item type; `notebook` is mapped to it.

[0.1.0]: https://github.com/sohampatwardhan/Agentic-Joplin/releases/tag/v0.1.0
