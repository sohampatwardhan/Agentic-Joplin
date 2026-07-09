# Joplin Agent Skills Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a cross-platform (Claude Code + Codex) agent plugin that bundles the existing Joplin MCP server with four Agent Skills teaching an agent to capture, search/update, and organize Joplin notes.

**Architecture:** A single plugin directory `packages/plugin` that is simultaneously a valid Claude Code plugin (`.claude-plugin/plugin.json` + `.mcp.json`) and a valid Codex plugin (root `plugin.json` with inline `mcpServers`). Skills are shared, identical `SKILL.md` files (frontmatter with both `name` and `description` to satisfy both platforms). The MCP server launches from the monorepo's built `dist` via `${CLAUDE_PLUGIN_ROOT}` (set by both tools).

**Tech Stack:** Markdown (Agent Skills `SKILL.md`), JSON manifests, a small Node/vitest structural-validation test. Depends on the already-built `@agentic-joplin/mcp-server` (26 tools).

**Reference spec:** [docs/superpowers/specs/2026-07-09-agent-skills-plugin-design.md](../specs/2026-07-09-agent-skills-plugin-design.md)

**Key facts confirmed during planning (do not re-litigate):**
- Claude Code plugin `.mcp.json` is `{ "mcpServers": { … } }` (wrapped); skills auto-discovered from `skills/<name>/SKILL.md`; secrets via top-level `userConfig` (`sensitive: true`) referenced as `${user_config.<key>}` in `.mcp.json` `env`. `${CLAUDE_PLUGIN_ROOT}` is interpolated in `.mcp.json`.
- Codex plugin root `plugin.json` uses `skills: "./skills/"` and `mcpServers` as an inline bare server-map object; passes secrets via `env_vars` (names pulled from the environment); also sets `CLAUDE_PLUGIN_ROOT`.
- SKILL.md frontmatter: Claude Code requires `description` (name defaults to dir); Codex requires `name` + `description`. Including **both** is portable.

---

## Task 1: Plugin scaffold, manifests, and MCP config

**Files:**
- Create: `packages/plugin/package.json`
- Create: `packages/plugin/.claude-plugin/plugin.json`
- Create: `packages/plugin/plugin.json`
- Create: `packages/plugin/.mcp.json`
- Create: `packages/plugin/.gitignore` (ignore local test deps output if any — optional; skip if nothing to ignore)

- [ ] **Step 1: Create directories**

Run: `mkdir -p packages/plugin/.claude-plugin packages/plugin/skills packages/plugin/test`

- [ ] **Step 2: Write `packages/plugin/package.json`**

Minimal private workspace member so the validation test (Task 6) has a home and `npm test` picks it up.

```json
{
  "name": "@agentic-joplin/plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Agentic Joplin plugin for Claude Code and Codex — bundles the Joplin MCP server and agent skills.",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "gray-matter": "^4.0.3",
    "vitest": "^4.1.0"
  }
}
```

- [ ] **Step 3: Write `packages/plugin/.claude-plugin/plugin.json`** (Claude Code manifest)

```json
{
  "name": "agentic-joplin",
  "displayName": "Agentic Joplin",
  "description": "Joplin notes for coding agents: MCP tools plus skills for capturing, searching, updating, and organizing notes.",
  "author": { "name": "Soham Patwardhan" },
  "homepage": "https://github.com/sohampatwardhan/Agentic-Joplin",
  "repository": "https://github.com/sohampatwardhan/Agentic-Joplin",
  "license": "MIT",
  "keywords": ["joplin", "notes", "mcp", "productivity"],
  "userConfig": {
    "joplin_token": {
      "type": "string",
      "title": "Joplin API token",
      "description": "API token from Joplin: Options > Web Clipper > Advanced options.",
      "sensitive": true,
      "required": true
    }
  }
}
```

- [ ] **Step 4: Write `packages/plugin/.mcp.json`** (Claude Code MCP config — wrapped shape, `${user_config.*}` for the token)

```json
{
  "mcpServers": {
    "joplin": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/../mcp-server/dist/index.js"],
      "env": {
        "JOPLIN_TOKEN": "${user_config.joplin_token}",
        "JOPLIN_HOST": "127.0.0.1",
        "JOPLIN_PORT": "41184"
      }
    }
  }
}
```

- [ ] **Step 5: Write `packages/plugin/plugin.json`** (Codex manifest — inline bare-map `mcpServers`, `env_vars` token pass-through)

```json
{
  "name": "agentic-joplin",
  "version": "0.1.0",
  "description": "Joplin notes for coding agents: MCP tools plus skills for capturing, searching, updating, and organizing notes.",
  "author": { "name": "Soham Patwardhan", "url": "https://github.com/sohampatwardhan" },
  "homepage": "https://github.com/sohampatwardhan/Agentic-Joplin",
  "repository": "https://github.com/sohampatwardhan/Agentic-Joplin",
  "license": "MIT",
  "keywords": ["joplin", "notes", "mcp", "productivity"],
  "skills": "./skills/",
  "mcpServers": {
    "joplin": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/../mcp-server/dist/index.js"],
      "env": {
        "JOPLIN_HOST": "127.0.0.1",
        "JOPLIN_PORT": "41184"
      },
      "env_vars": ["JOPLIN_TOKEN"]
    }
  },
  "interface": {
    "displayName": "Agentic Joplin",
    "shortDescription": "Capture, search, and organize Joplin notes.",
    "category": "Productivity",
    "capabilities": ["Write"]
  }
}
```

- [ ] **Step 6: Install workspace deps and verify all JSON parses**

Run: `npm install`
Then run:
```bash
node -e "for (const f of ['packages/plugin/package.json','packages/plugin/.claude-plugin/plugin.json','packages/plugin/plugin.json','packages/plugin/.mcp.json']) { JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('ok', f); }"
```
Expected: `ok` printed for all four files (valid JSON).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json packages/plugin/package.json packages/plugin/.claude-plugin packages/plugin/plugin.json packages/plugin/.mcp.json
git commit -m "feat(plugin): scaffold cross-platform plugin manifests and MCP config"
```

---

## Task 2: Hub skill — `using-joplin`

**Files:**
- Create: `packages/plugin/skills/using-joplin/SKILL.md`

- [ ] **Step 1: Write `packages/plugin/skills/using-joplin/SKILL.md`**

```markdown
---
name: using-joplin
description: Use when working with Joplin notes, notebooks, or tags via the Joplin MCP tools — start here to check the connection, learn the available tools, avoid common pitfalls, and route to the capture, search-and-update, or organize workflows.
---

# Using Joplin

These tools talk to a running Joplin desktop app through its Data API (the Web Clipper
service). Tool names below are the base names; your client may expose them namespaced
(e.g. `mcp__joplin__create_note`).

## Before anything else: check the connection

Call `ping` first. If it does not return available, tell the user to:
1. Open the Joplin desktop app.
2. Enable the Web Clipper service (Options > Web Clipper).
3. Make sure the API token is configured (the plugin reads `JOPLIN_TOKEN`).

Do not keep retrying other tools if `ping` fails — surface the fix instead.

## What's available

| Area | Tools |
|---|---|
| Notes | `create_note`, `get_note`, `update_note`, `delete_note`, `list_notes` |
| Notebooks | `get_notebook`, `list_notebooks`, `create_notebook`, `update_notebook`, `delete_notebook` |
| Tags | `get_tag`, `list_tags`, `create_tag`, `update_tag`, `delete_tag`, `tag_note`, `untag_note` |
| Search | `find_notes` |
| Resources | `attach_resource`, `get_resource`, `update_resource`, `delete_resource`, `list_note_resources` |
| Revisions | `list_note_revisions`, `delete_note_revisions` |
| System | `ping` |

## Conventions and pitfalls

- **Resolve names to IDs first.** Every tool takes IDs, not titles. Use `list_notebooks`
  (returns a flat list plus a nested tree), `find_notes`, or `list_tags` to look up an ID
  before acting on it.
- **Deletes trash by default.** `delete_note` / `delete_notebook` move to the trash. Passing
  `permanent: true` is irreversible — confirm with the user before a permanent delete.
- **Lists can be truncated.** List/search results include a `truncated` flag; if it is true,
  narrow the query (by notebook/tag) or pass a smaller `limit` rather than assuming you saw
  everything.
- **Attaching a resource rewrites the note body.** `attach_resource` reads the note and writes
  an appended link back as a second call — avoid interleaving other edits to the same note
  around it.
- **Notes have a format.** A note is Markdown or HTML; `get_note` returns a `format` field, and
  `create_note`/`update_note` take a `format` (`markdown` default, or `html`). HTML is stored
  faithfully — you do not need to think about Joplin's internal markup fields.

## Which workflow

- Creating/saving a note → use the `joplin-capturing-notes` skill.
- Finding, reading, or updating existing notes → use the `joplin-searching-and-updating` skill.
- Restructuring notebooks/tags or cleaning up → use the `joplin-organizing` skill.
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugin/skills/using-joplin/SKILL.md
git commit -m "feat(plugin): add using-joplin hub skill"
```

---

## Task 3: Skill — `joplin-capturing-notes`

**Files:**
- Create: `packages/plugin/skills/joplin-capturing-notes/SKILL.md`

- [ ] **Step 1: Write `packages/plugin/skills/joplin-capturing-notes/SKILL.md`**

```markdown
---
name: joplin-capturing-notes
description: Use when saving or creating a note in Joplin — resolves or creates the target notebook, chooses Markdown or HTML, writes the note, and applies tags.
---

# Capturing notes in Joplin

See the `using-joplin` skill for the connection check and shared conventions (resolve
names to IDs, `truncated`, delete caution).

## Steps

1. **Find the target notebook.** Call `list_notebooks` and match the user's intended notebook
   by title (use the nested `tree` to disambiguate notebooks with the same name under different
   parents). If it doesn't exist and the user wants it created, call `create_notebook` with the
   `title` and an optional `parent_id` to nest it.
2. **Choose the format.** Default to `markdown`. Use `html` only when the content is genuinely
   HTML (e.g. clipped rich content). The body you pass is stored as-is in that format.
3. **Create the note.** Call `create_note` with `title`, `body`, `format`, and `notebook_id`.
   Capture the returned note `id`.
4. **Apply tags (separate step).** `create_note` does not take tags. For each desired tag:
   ensure it exists via `list_tags` (create it with `create_tag` if missing), then attach it
   with `tag_note` (note id + tag id).
5. **Report** the created note's id and where it landed.

## Notes

- Don't invent a notebook. If the user didn't name one and none is obvious, ask, or fall back
  to a clearly-named default only if the user approved that.
- For a quick capture with no notebook specified, it's fine to create/append to a dedicated
  inbox notebook — but say so.
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugin/skills/joplin-capturing-notes/SKILL.md
git commit -m "feat(plugin): add joplin-capturing-notes skill"
```

---

## Task 4: Skill — `joplin-searching-and-updating`

**Files:**
- Create: `packages/plugin/skills/joplin-searching-and-updating/SKILL.md`

- [ ] **Step 1: Write `packages/plugin/skills/joplin-searching-and-updating/SKILL.md`**

```markdown
---
name: joplin-searching-and-updating
description: Use when finding, reading, or updating existing Joplin notes — full-text search with notebook/tag scoping, read results, then safely update or append.
---

# Searching and updating Joplin notes

See the `using-joplin` skill for the connection check and shared conventions.

## Search is full-text, not semantic

`find_notes` runs Joplin's keyword full-text search — it does not understand meaning. You
provide the semantic layer:

- Start with the user's key terms; if results are thin, reformulate (synonyms, broader terms),
  and use the `*` wildcard for prefixes.
- Scope when you can: pass `notebook_id` and/or `tag_id` to narrow.
- Read the candidate results and judge relevance yourself rather than trusting rank.
- If the result set comes back `truncated`, narrow the query or raise/lower `limit` deliberately
  — don't assume you've seen every match.

## Reading

- `get_note` by id returns the note; pass `fields` to fetch only what you need for large notes.
- Check the returned `format` before editing so your edit matches the note's Markdown/HTML.

## Updating and appending

- `update_note` is a partial update by id — send only the fields you're changing (`title`,
  `body`, `format`, `notebook_id`).
- To **append** rather than replace: `get_note` to read the current `body`, concatenate your
  addition, then `update_note` with the combined `body` in the note's existing `format`.
- Be aware this read-then-write is not atomic: if the note may be edited elsewhere (the Joplin
  UI, sync) between your read and write, your write can clobber that change. Keep the window
  small and don't interleave other edits.

## Enumerating

Use `list_notes` with `notebook_id` or `tag_id` to walk a set of notes (mind the `truncated`
flag). Use `list_note_revisions` if the user wants a note's edit history.
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugin/skills/joplin-searching-and-updating/SKILL.md
git commit -m "feat(plugin): add joplin-searching-and-updating skill"
```

---

## Task 5: Skill — `joplin-organizing`

**Files:**
- Create: `packages/plugin/skills/joplin-organizing/SKILL.md`

- [ ] **Step 1: Write `packages/plugin/skills/joplin-organizing/SKILL.md`**

```markdown
---
name: joplin-organizing
description: Use when restructuring a Joplin workspace — nesting, moving, or renaming notebooks; retagging notes; and cleaning up.
---

# Organizing a Joplin workspace

See the `using-joplin` skill for the connection check and shared conventions.

## Survey first

Call `list_notebooks` (use the nested `tree`) and `list_tags` to understand the current
structure before changing anything. Confirm the intended end state with the user for anything
sweeping.

## Notebooks

- **Rename or move:** `update_notebook` with `title` (rename) and/or `parent_id` (move under a
  new parent; a top-level notebook has an empty `parent_id`).
- **Create structure:** `create_notebook` with `parent_id` to build nested notebooks.

## Tags

- Attach/detach with `tag_note` / `untag_note`.
- `create_tag`, `update_tag` (rename), `delete_tag` manage the tag vocabulary itself.

## Cleanup — be careful

- `delete_note` / `delete_notebook` trash by default; **only** pass `permanent: true` after the
  user explicitly confirms, since it can't be undone. Prefer trashing.
- For bulk operations, enumerate with `list_notes` (by notebook or tag) and act per-item. Watch
  the `truncated` flag — if the list was capped, process in narrower batches so you don't miss
  items.

## Notes

- Moving a notebook moves all its notes and sub-notebooks with it.
- When deduplicating or merging notebooks, move notes to the target first, verify, then delete
  the now-empty source (trashed, not permanent, unless confirmed).
```

- [ ] **Step 2: Commit**

```bash
git add packages/plugin/skills/joplin-organizing/SKILL.md
git commit -m "feat(plugin): add joplin-organizing skill"
```

---

## Task 6: Structural validation test

**Files:**
- Create: `packages/plugin/test/skills.test.ts`
- Create: `packages/plugin/vitest.config.ts`

This guards the skills against drift: every skill has valid frontmatter, the `name` matches its
directory, and every tool name referenced in a skill actually exists in the MCP server's tool
set.

- [ ] **Step 1: Write `packages/plugin/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node' },
});
```

- [ ] **Step 2: Write the failing test `packages/plugin/test/skills.test.ts`**

```typescript
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const skillsDir = join(here, '..', 'skills');

// The MCP server's registered tool names (keep in sync with packages/mcp-server/src/tools/*).
const KNOWN_TOOLS = new Set([
  'create_note', 'get_note', 'update_note', 'delete_note', 'list_notes',
  'get_notebook', 'list_notebooks', 'create_notebook', 'update_notebook', 'delete_notebook',
  'get_tag', 'list_tags', 'create_tag', 'update_tag', 'delete_tag', 'tag_note', 'untag_note',
  'find_notes',
  'attach_resource', 'get_resource', 'update_resource', 'delete_resource', 'list_note_resources',
  'list_note_revisions', 'delete_note_revisions',
  'ping',
]);

// Backticked snake_case tokens that are tool *parameters/fields*, not tools. Extend this only
// for genuine field names — never to hide a broken tool reference.
const KNOWN_FIELDS = new Set([
  'parent_id', 'notebook_id', 'tag_id', 'note_id', 'resource_id',
  'file_base64', 'markup_language', 'user_config', 'mcp_servers', 'env_vars',
]);

const skillNames = readdirSync(skillsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe('skills', () => {
  it('has the expected skill set', () => {
    expect(skillNames.sort()).toEqual(
      ['joplin-capturing-notes', 'joplin-organizing', 'joplin-searching-and-updating', 'using-joplin'].sort(),
    );
  });

  for (const skill of skillNames) {
    describe(skill, () => {
      const file = join(skillsDir, skill, 'SKILL.md');

      it('has a SKILL.md', () => {
        expect(existsSync(file)).toBe(true);
      });

      it('has frontmatter name matching the directory and a non-empty description', () => {
        const { data } = matter(readFileSync(file, 'utf8'));
        expect(data.name).toBe(skill);
        expect(typeof data.description).toBe('string');
        expect((data.description as string).length).toBeGreaterThan(20);
      });

      it('only references tools that exist in the MCP server', () => {
        const body = readFileSync(file, 'utf8');
        // backticked lower_snake_case tokens that look like tool calls
        const referenced = [...body.matchAll(/`([a-z][a-z_]+)`/g)].map((m) => m[1]);
        // Single-underscore tokens are candidate tool/field names; MCP-namespaced examples
        // (e.g. `mcp__joplin__create_note`) contain a double underscore and are not bare tools.
        const toolLike = referenced.filter((t) => t.includes('_') && !t.includes('__'));
        const unknown = toolLike.filter((t) => !KNOWN_TOOLS.has(t) && !KNOWN_FIELDS.has(t));
        expect(unknown, `unknown tool-like tokens in ${skill}: ${unknown.join(', ')}`).toEqual([]);
      });
    });
  }
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `npm run test --workspace @agentic-joplin/plugin`
Expected: PASS. (All four skills exist with correct frontmatter, and every backticked
underscore-token in the skills is a real tool — e.g. `create_note`, `find_notes`. If a skill
references a non-tool underscore token, either backtick it differently or add it — the test will
name the offending token.)

Note: the `KNOWN_FIELDS` allowlist already excludes the field names the skills reference
(`parent_id`, `notebook_id`, `tag_id`, etc.). If a later skill edit introduces a new genuine
field token, add it to `KNOWN_FIELDS` — never add a real tool name there to silence a broken
reference (a mistyped tool should fail this test).

- [ ] **Step 4: Commit**

```bash
git add packages/plugin/vitest.config.ts packages/plugin/test/skills.test.ts package-lock.json
git commit -m "test(plugin): validate skill frontmatter and tool references"
```

---

## Task 7: Plugin README and cross-platform smoke checklist

**Files:**
- Create: `packages/plugin/README.md`
- Create: `packages/plugin/SMOKE_TEST.md`

- [ ] **Step 1: Write `packages/plugin/README.md`**

````markdown
# Agentic Joplin plugin (Claude Code + Codex)

Bundles the Joplin MCP server with four agent skills. One directory, valid for both Claude Code
and Codex.

## Prerequisites

- Node.js ≥ 20, and this monorepo built: `npm install && npm run build --workspace @agentic-joplin/mcp-server`
- Joplin desktop running with the Web Clipper service enabled (Options → Web Clipper), and an API token.

The bundled `.mcp.json` / `plugin.json` launch the server from `../mcp-server/dist/index.js`
relative to the plugin (`${CLAUDE_PLUGIN_ROOT}`), so build the server before use.

## Claude Code

Install the plugin directory (e.g. `claude plugin install ./packages/plugin` or via a
marketplace entry). Claude Code will prompt for the **Joplin API token** (stored in your
keychain via the plugin's `userConfig`). Non-default host/port: edit the `env` in
`.mcp.json`.

## Codex

Install the plugin directory as a Codex plugin. Export your token so the server picks it up
(the plugin passes `JOPLIN_TOKEN` through via `env_vars`):

```bash
export JOPLIN_TOKEN="<your token>"
```

If you configure MCP manually instead of installing the plugin, add this to `~/.codex/config.toml`:

```toml
[mcp_servers.joplin]
command = "node"
args = ["/absolute/path/to/Agentic-Joplin/packages/mcp-server/dist/index.js"]
env = { JOPLIN_HOST = "127.0.0.1", JOPLIN_PORT = "41184" }
env_vars = ["JOPLIN_TOKEN"]
```

## Skills

- **using-joplin** — hub: connection check, tool map, conventions, routing.
- **joplin-capturing-notes** — create notes (notebook resolution, format, tags).
- **joplin-searching-and-updating** — search, read, update/append.
- **joplin-organizing** — notebooks, tags, cleanup.

## Development

- `npm run test --workspace @agentic-joplin/plugin` — validate skill frontmatter + tool references.
- See `SMOKE_TEST.md` for the manual cross-platform install/verification checklist.
````

- [ ] **Step 2: Write `packages/plugin/SMOKE_TEST.md`**

```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add packages/plugin/README.md packages/plugin/SMOKE_TEST.md
git commit -m "docs(plugin): add README and cross-platform smoke checklist"
```

---

## Task 8: Root docs update

**Files:**
- Modify: `README.md` (root)
- Modify: `CHANGELOG.md` (root)

- [ ] **Step 1: Update the root `README.md` status table and add a plugin section**

In the "three planned pieces" table, change the Agent skills row status to ✅ and add a short
"Agent skills plugin" section after the MCP server section:

```markdown
## Agent skills plugin

[`packages/plugin`](packages/plugin) is a single plugin — valid for both **Claude Code** and
**Codex** — that bundles the Joplin MCP server with four agent skills (`using-joplin` hub plus
`joplin-capturing-notes`, `joplin-searching-and-updating`, `joplin-organizing`). See
[`packages/plugin/README.md`](packages/plugin/README.md) for install steps on each platform.
```

Update the status table row:

```markdown
| **Agent skills** — skill files teaching agents how to use Joplin effectively | ✅ Claude Code + Codex plugin |
```

- [ ] **Step 2: Add a CHANGELOG entry**

Add under a new `## [Unreleased]` section (or a `0.2.0` heading) an Added entry:

```markdown
## [Unreleased]

### Added

- **`@agentic-joplin/plugin`** — cross-platform (Claude Code + Codex) plugin bundling the Joplin
  MCP server with four agent skills: `using-joplin` (hub), `joplin-capturing-notes`,
  `joplin-searching-and-updating`, and `joplin-organizing`. Shared `SKILL.md` files and MCP
  config; per-platform manifests. Token via Claude Code `userConfig` or Codex `env_vars`.
```

- [ ] **Step 3: Run the full workspace test suite and commit**

Run: `npm test` (root) — expect the mcp-server suite (121) plus the plugin skill-validation suite to pass.

```bash
git add README.md CHANGELOG.md
git commit -m "docs: mark agent skills plugin complete in README and CHANGELOG"
```

---

## Task 9: Manual cross-platform verification (human/agent-in-the-loop)

This is the spec's build-time verification — it requires real Claude Code and Codex installs and
a running Joplin, so it's a checklist rather than an automated test.

- [ ] Work through `packages/plugin/SMOKE_TEST.md` on Claude Code.
- [ ] Work through `packages/plugin/SMOKE_TEST.md` on Codex.
- [ ] If the `${CLAUDE_PLUGIN_ROOT}` launch form needed a per-platform fallback, update
      `.mcp.json` / `plugin.json` accordingly and note it in `SMOKE_TEST.md`, then re-verify.
- [ ] Commit any config adjustments discovered during verification.
