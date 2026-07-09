# Joplin Agent Skills (Claude Code + Codex Plugin) — Design Spec

Date: 2026-07-09
Status: Approved
Scope: Second sub-project of Agentic-Joplin — the agent skills, packaged as a cross-platform plugin. The MCP server (Phase 1) is complete; the Joplin *app* plugin remains a separate, later sub-project.

## Context

Agentic-Joplin lets coding agents integrate with Joplin via three pieces: an MCP server (done), agent skills, and a Joplin app plugin. Per updated prioritization, **agent skills come before the Joplin app plugin**. The Joplin app plugin is now envisioned narrowly as a *configuration panel/GUI for the MCP server* (managing token/host/port, connection status) — out of scope here.

This sub-project mirrors the **Context7 distribution pattern**: ship the MCP server together with skills that teach an agent *when and how* to use its tools. Both target platforms — Claude Code and OpenAI Codex CLI — support the same Anthropic **Agent Skills** `SKILL.md` format and a `.mcp.json` for MCP servers, so the skill content and MCP config are authored once and shared; only the plugin manifest differs per platform.

## Goals

- Provide a small suite of Joplin agent skills (recipes + correct-usage guidance) that make the MCP server's 26 tools productive for an agent.
- Package them as a **single plugin directory valid for both Claude Code and Codex** — one source of truth for skills and MCP config, two thin manifests.
- Keep skill content 100% portable across the two platforms (identical `SKILL.md` files).
- Teach only agent-facing conventions; server-internal gotchas (HTML `markup_language:2`, `notebook`→`folder` mapping, empty-body deletes) stay hidden inside the MCP server.

## Non-goals

- The Joplin *app* plugin / configuration panel (separate, later sub-project).
- Publishing `@agentic-joplin/mcp-server` to npm (documented as a future release swap; see Distribution).
- True semantic/vector search — Joplin's Data API is full-text (keyword) only. The "semantic" layer is the agent's own query reformulation + result reading, which the search skill teaches.
- New MCP server tools — this sub-project is skills + packaging only; the server is unchanged.

## Repo layout

One plugin package, valid for both platforms simultaneously:

```
packages/
├── mcp-server/                           # existing (unchanged)
└── plugin/                               # cross-platform agent plugin (Claude Code + Codex)
    ├── .claude-plugin/plugin.json        # Claude Code manifest
    ├── plugin.json                       # Codex manifest (root) + interface metadata
    ├── .mcp.json                         # SHARED — declares the joplin MCP server
    ├── README.md                         # install instructions for both platforms + Codex config.toml snippet
    └── skills/                           # SHARED — identical SKILL.md format on both platforms
        ├── using-joplin/SKILL.md
        ├── joplin-capturing-notes/SKILL.md
        ├── joplin-searching-and-updating/SKILL.md
        └── joplin-organizing/SKILL.md
```

The future Joplin app plugin would be a separate `packages/joplin-plugin`, keeping the two "plugin" meanings distinct.

## Skill suite

Hub-and-spokes: `using-joplin` is the always-relevant entry point; the three workflow skills handle specific tasks and link back to the hub for shared conventions (DRY — conventions/gotchas defined once in the hub). Tools are referred to by base names (e.g. `find_notes`); exact MCP namespacing varies by client.

### `using-joplin` (hub)
**description:** "Use when working with Joplin notes, notebooks, or tags via the Joplin MCP tools — start here to check the connection, learn the available tools, avoid common pitfalls, and route to the capture / search-and-update / organize workflows."

Body:
- **Precondition:** call `ping` first; on failure, instruct the user to start Joplin, enable the Web Clipper service, and set `JOPLIN_TOKEN`.
- **Tool map:** compact grouped table (notes / notebooks / tags / search / resources / revisions / ping).
- **Agent-facing conventions:** resolve names→IDs first (`list_notebooks`, `find_notes`) since tools take IDs; deletes trash by default and `permanent:true` is irreversible → confirm before permanent deletes; list results may be capped — check the `truncated` flag; `attach_resource` is a read-modify-write (avoid interleaving edits); notes carry a `format` (`markdown`/`html`), preserved faithfully.
- **Routing:** create → `joplin-capturing-notes`; find/read/update → `joplin-searching-and-updating`; restructure → `joplin-organizing`.

### `joplin-capturing-notes`
**description:** "Use when saving or creating a note in Joplin — resolves or creates the target notebook, chooses Markdown or HTML, writes the note, and applies tags."

Body: resolve target notebook via `list_notebooks` (create with `create_notebook`, optional `parent_id`, if absent) → pick `format` (`markdown` default, `html` for rich content) → `create_note` (title, body, format, notebook_id) → tag as a separate step (`list_tags`/`create_tag`, then `tag_note`; `create_note` has no tags param) → return the note id.

### `joplin-searching-and-updating`
**description:** "Use when finding, reading, or updating existing Joplin notes — full-text search with notebook/tag scoping, read results, then safely update or append."

Body: `find_notes` (query, optional `notebook_id`/`tag_id`) — **full-text, not semantic**; the agent supplies the semantic layer (reformulate/broaden queries, use `*`, iterate, read+rank). Watch the `truncated` flag → narrow query or set `limit`. Read with `get_note` (optional `fields` to avoid over-fetch); note the returned `format`. Update/append with `update_note` (partial), matching the note's existing `format`; append = `get_note` → concatenate → `update_note`, with a caution about the read-modify-write race on concurrently-edited notes.

### `joplin-organizing`
**description:** "Use when restructuring a Joplin workspace — nesting, moving, or renaming notebooks; retagging notes; and cleaning up."

Body: survey with `list_notebooks` (tree) + `list_tags` → move/rename via `update_notebook` (`parent_id`/`title`) → retag via `tag_note`/`untag_note`, `create_tag`/`update_tag`/`delete_tag` → cleanup via `delete_note`/`delete_notebook`, **confirming before `permanent:true`** and preferring trash; enumerate with `list_notes` (mind the cap) and operate per-item.

## Manifests, MCP wiring, and config

**Claude Code — `.claude-plugin/plugin.json`:** minimal (`name`, `description`, `author`). Skills auto-discovered from `skills/`; MCP from the sibling `.mcp.json`. Declares a `userConfig` for `JOPLIN_TOKEN` so Claude Code prompts for the secret and injects it into the server env.

**Codex — root `plugin.json`:** superset — `name`, `version`, `description`, `author`, `skills: "./skills/"`, `mcpServers: "./.mcp.json"`, plus an `interface` block (`displayName`, `category`, `capabilities`). The two manifests coexist; each tool reads its own and ignores the other.

**Shared `.mcp.json` — the joplin server:**
- **Launch (decided):** commit `node ${plugin_root}/../mcp-server/dist/index.js` so it runs from the monorepo immediately. Document `npx -y @agentic-joplin/mcp-server` as the swap once the package is published to npm (future release step; no publish now).
- **Non-secret config:** `JOPLIN_HOST`/`JOPLIN_PORT` as static `env` with `127.0.0.1`/`41184` defaults.
- **Token (never committed):** Codex uses `env_vars: ["JOPLIN_TOKEN"]` (pass-through from the user's environment); Claude Code uses the plugin `userConfig` prompt. README documents exporting `JOPLIN_TOKEN` for both, plus a copy-paste Codex `config.toml` `[mcp_servers.joplin]` snippet for users who configure MCP manually instead of installing the plugin.

**Build-time verification (do not guess in the plan):** confirm whether Claude Code and Codex accept the *same* `.mcp.json` file shape. Claude Code uses a bare server-map (`{ "joplin": {…} }`); Codex references `./.mcp.json` from its manifest. If the shapes differ, keep the shared `.mcp.json` for Claude Code and **inline** the identical server block into Codex's `plugin.json` `mcpServers` object (Codex supports inline) — a ~5-line duplication, still one logical config. Verify against current tool behavior/docs during implementation.

## Testing / verification

Skills are prose, so verification is structural + manual rather than unit tests:
- **Structural check:** a small script (or test) validating each `SKILL.md` has YAML frontmatter with `name` + `description`, descriptions are within a sane length, skill dir names match `name`, and every MCP tool referenced in the skills actually exists in the server's tool list (guards against drift as tools change).
- **Manual cross-platform smoke checklist** (markdown doc, like the MCP server's SMOKE_TEST.md): install the plugin in Claude Code and in Codex; confirm (a) the four skills are discovered, (b) the joplin MCP server connects (`ping`), and (c) one end-to-end run of each workflow against a real Joplin instance — capture a note (Markdown + HTML), search/read/update it, organize (move notebook, retag), then clean up. Confirm the `.mcp.json` shape works on both (or the inline fallback is used for Codex).

## Future (out of scope here)

- Joplin *app* plugin as an MCP-server configuration panel (`packages/joplin-plugin`).
- Publish `@agentic-joplin/mcp-server` to npm and swap `.mcp.json` to `npx`.
- Additional workflow skills (e.g. research capture, periodic review) once the core suite proves useful.
