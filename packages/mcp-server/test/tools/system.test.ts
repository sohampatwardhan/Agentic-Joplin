import { describe, expect, it, vi } from 'vitest';
import { registerSystemTools } from '../../src/tools/system.js';

function createFakeServer() {
  const tools = new Map();
  return {
    registerTool(name: string, config: any, handler: any) {
      tools.set(name, { config, handler });
    },
    tools,
  };
}

describe('registerSystemTools', () => {
  it('ping reports availability from JoplinClient.ping', async () => {
    const client = { ping: vi.fn().mockResolvedValue(true) };
    const server = createFakeServer();
    registerSystemTools(server as any, client as any);

    const result = await server.tools.get('ping')!.handler({});

    expect(JSON.parse(result.content[0].text)).toEqual({ available: true });
  });

  it('ping maps a connection error to an isError tool result', async () => {
    const { JoplinConnectionError } = await import('../../src/client/errors.js');
    const client = { ping: vi.fn().mockRejectedValue(new JoplinConnectionError()) };
    const server = createFakeServer();
    registerSystemTools(server as any, client as any);

    const result = await server.tools.get('ping')!.handler({});

    expect(result.isError).toBe(true);
  });
});
