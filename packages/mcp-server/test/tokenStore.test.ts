import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCachedToken, writeCachedToken } from '../src/tokenStore.js';

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agentic-joplin-token-'));
  path = join(dir, 'token.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('tokenStore', () => {
  it('returns undefined when no token file exists', () => {
    expect(readCachedToken(path)).toBeUndefined();
  });

  it('writes and reads back a token', () => {
    writeCachedToken('abc123', path);

    expect(readCachedToken(path)).toBe('abc123');
  });

  it('creates the parent directory if it does not exist', () => {
    const nestedPath = join(dir, 'nested', 'dir', 'token.json');

    writeCachedToken('xyz789', nestedPath);

    expect(readCachedToken(nestedPath)).toBe('xyz789');
  });

  it('returns undefined for a malformed token file', () => {
    writeCachedToken('', path); // writes valid JSON but with an empty token
    expect(readCachedToken(path)).toBeUndefined();
  });
});
