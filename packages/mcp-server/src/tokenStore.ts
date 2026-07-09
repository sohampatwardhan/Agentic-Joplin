import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

export function defaultTokenPath(): string {
  return `${homedir()}/.agentic-joplin/token.json`;
}

export function readCachedToken(path: string = defaultTokenPath()): string | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as { token?: string };
    return data.token || undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedToken(token: string, path: string = defaultTokenPath()): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify({ token }, null, 2), { mode: 0o600 });
}
