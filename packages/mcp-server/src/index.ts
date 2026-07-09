#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { JoplinClient } from './client/JoplinClient.js';
import { registerNoteTools } from './tools/notes.js';
import { registerNotebookTools } from './tools/notebooks.js';
import { registerTagTools } from './tools/tags.js';
import { registerSearchTools } from './tools/search.js';
import { registerResourceTools } from './tools/resources.js';

async function main() {
  const config = loadConfig(process.env);
  const client = new JoplinClient(config);

  const server = new McpServer({ name: 'agentic-joplin-mcp-server', version: '0.1.0' });

  registerNoteTools(server, client);
  registerNotebookTools(server, client);
  registerTagTools(server, client);
  registerSearchTools(server, client);
  registerResourceTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agentic Joplin MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting Agentic Joplin MCP server:', error);
  process.exit(1);
});
