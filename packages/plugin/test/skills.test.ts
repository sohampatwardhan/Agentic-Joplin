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
  // Namespaced-tool illustration in using-joplin (e.g. "your client may expose them
  // namespaced") — not a bare tool name and not a typo, so it's not covered by KNOWN_TOOLS.
  'mcp__joplin__create_note',
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
        // a token is "tool-like" if it ends in a known verb/noun shape; check membership only
        // for tokens that appear in KNOWN_TOOLS' vocabulary space (contains an underscore).
        const toolLike = referenced.filter((t) => t.includes('_'));
        const unknown = toolLike.filter((t) => !KNOWN_TOOLS.has(t) && !KNOWN_FIELDS.has(t));
        expect(unknown, `unknown tool-like tokens in ${skill}: ${unknown.join(', ')}`).toEqual([]);
      });
    });
  }
});
