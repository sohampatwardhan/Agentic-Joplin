#!/usr/bin/env node
import { authorize } from './authorize.js';
import { defaultTokenPath, writeCachedToken } from './tokenStore.js';

async function main() {
  const host = process.env.JOPLIN_HOST || '127.0.0.1';
  const port = process.env.JOPLIN_PORT ? Number(process.env.JOPLIN_PORT) : 41184;

  console.log(`Requesting authorization from Joplin at ${host}:${port}...`);
  console.log('Open Joplin — a dialog should appear asking you to accept this request.');

  const token = await authorize({
    host,
    port,
    onWaiting: () => process.stdout.write('.'),
  });

  writeCachedToken(token);
  console.log(`\nAuthorized. Token saved to ${defaultTokenPath()}.`);
  console.log('You can now run the Joplin MCP server without setting JOPLIN_TOKEN yourself.');
}

main().catch((error) => {
  console.error(`\nAuthorization failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
