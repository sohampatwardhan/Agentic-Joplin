import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JoplinClient } from '../client/JoplinClient.js';
import { toToolError } from './toolError.js';

export function registerSystemTools(server: McpServer, client: JoplinClient): void {
  server.registerTool(
    'ping',
    {
      description: 'Check whether the Joplin Data API is reachable.',
      inputSchema: {},
    },
    async () => {
      try {
        const available = await client.ping();
        return { content: [{ type: 'text' as const, text: JSON.stringify({ available }) }] };
      } catch (error) {
        return toToolError(error);
      }
    },
  );
}
