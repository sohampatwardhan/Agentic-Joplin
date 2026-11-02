# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-11-01

First release published to npm, as [`agentic-joplin`](https://www.npmjs.com/package/agentic-joplin).

### Added

- **npm package `agentic-joplin`** — the MCP server is now publishable to npm and runnable with
  `npx agentic-joplin`. New `agentic-joplin` bin starts the stdio server; the authorize CLI stays
  available as the second bin (`npx -p agentic-joplin agentic-joplin-authorize`). The tarball
  ships only `dist/`, `README.md`, and `LICENSE`, and is rebuilt from a clean `dist/` on
  `prepack`. A GitHub Actions workflow (`.github/workflows/publish.yml`) builds, tests, and
  publishes the package with npm provenance whenever a GitHub Release is published.
- **`@agentic-joplin/plugin`** — cross-platform (Claude Code + Codex) plugin bundling the Joplin
  MCP server with four agent skills: `using-joplin` (hub), `joplin-capturing-notes`,
  `joplin-searching-and-updating`, and `joplin-organizing`. Shared `SKILL.md` files and MCP
  config; per-platform manifests. Token via Claude Code `userConfig` or Codex `env_vars`.
- **Token auto-discovery** — `npm run authorize --workspace agentic-joplin` (and the
  `agentic-joplin-authorize` bin) runs Joplin's clipper authorization handshake (`POST /auth` +
  poll `GET /auth/check`, the same flow the Web Clipper browser extension uses) so a user can
  grant access with one click in Joplin instead of copy-pasting a token, caching the result to
  `~/.agentic-joplin/token.json`. `loadConfig` falls back to this cache when `JOPLIN_TOKEN` is
  unset, and the plugin's Claude Code `userConfig` token field is now optional.

### Changed

- **Package renames** — the MCP server workspace `@agentic-joplin/mcp-server` is now
  `agentic-joplin` (use `--workspace agentic-joplin`), and the private monorepo root is now
  `agentic-joplin-monorepo`. The server's MCP version string is read from `package.json` instead
  of being hard-coded.

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

[Unreleased]: https://github.com/sohampatwardhan/Agentic-Joplin/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/sohampatwardhan/Agentic-Joplin/releases/tag/v0.2.0
[0.1.0]: https://github.com/sohampatwardhan/Agentic-Joplin/releases/tag/v0.1.0
