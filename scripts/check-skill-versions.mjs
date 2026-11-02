#!/usr/bin/env node
// Fails if any SKILL.md in the repo lacks a `metadata.version` in its YAML frontmatter, or if
// that version is not valid SemVer 2.0.0. Dependency-free on purpose: it reads only the small
// subset of YAML that Agent Skills frontmatter uses (top-level keys and a flat `metadata` map
// of string values), so it can run before `npm ci`.
//
// Usage: node scripts/check-skill-versions.mjs [rootDir]

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Official SemVer 2.0.0 regex (https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string).
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

/** Recursively collect SKILL.md paths. Symlinks are not followed, so mirrored skill dirs are skipped. */
function findSkillFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) findSkillFiles(join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** Strip matching single or double quotes from a scalar. */
function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Return the `metadata.version` value, or an error string describing why it is missing. */
export function readMetadataVersion(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'missing YAML frontmatter' };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { error: 'unterminated YAML frontmatter' };

  const fm = lines.slice(1, end);
  const start = fm.findIndex((l) => /^metadata:\s*$/.test(l));
  if (start === -1) return { error: 'missing `metadata` map' };

  for (const line of fm.slice(start + 1)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) break; // next top-level key: end of the metadata map
    const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && m[1] === 'version') {
      const value = unquote(m[2]);
      return value ? { version: value } : { error: '`metadata.version` is empty' };
    }
  }
  return { error: 'missing `metadata.version`' };
}

function main() {
  const root = resolve(process.argv[2] ?? join(fileURLToPath(import.meta.url), '..', '..'));
  const files = findSkillFiles(root).sort();
  if (files.length === 0) {
    console.error(`No SKILL.md files found under ${root}`);
    process.exit(1);
  }

  let failures = 0;
  for (const file of files) {
    const rel = relative(root, file);
    const { version, error } = readMetadataVersion(readFileSync(file, 'utf8'));
    if (error) {
      console.error(`✗ ${rel}: ${error}`);
      failures++;
    } else if (!SEMVER.test(version)) {
      console.error(`✗ ${rel}: metadata.version "${version}" is not valid SemVer 2.0.0`);
      failures++;
    } else {
      console.log(`✓ ${rel}: ${version}`);
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} of ${files.length} SKILL.md file(s) failed the version check.`);
    process.exit(1);
  }
  console.log(`\nAll ${files.length} SKILL.md file(s) carry a valid SemVer metadata.version.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
