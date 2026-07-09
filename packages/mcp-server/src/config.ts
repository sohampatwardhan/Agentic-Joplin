import { readCachedToken } from './tokenStore.js';

export interface JoplinConfig {
  token: string;
  host: string;
  port: number;
}

export function loadConfig(env: Record<string, string | undefined>): JoplinConfig {
  const token = env.JOPLIN_TOKEN || readCachedToken();
  if (!token) {
    throw new Error(
      'JOPLIN_TOKEN environment variable is required. Generate one in Joplin under Options > Web Clipper > ' +
        'Advanced options, or run `npx agentic-joplin-authorize` to fetch one automatically.',
    );
  }
  return {
    token,
    host: env.JOPLIN_HOST ?? '127.0.0.1',
    port: env.JOPLIN_PORT ? Number(env.JOPLIN_PORT) : 41184,
  };
}
