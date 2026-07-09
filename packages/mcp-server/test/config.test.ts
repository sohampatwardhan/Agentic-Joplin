import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('throws when JOPLIN_TOKEN is missing', () => {
    expect(() => loadConfig({})).toThrow(/JOPLIN_TOKEN/);
  });

  it('returns defaults for host and port when only token is set', () => {
    const config = loadConfig({ JOPLIN_TOKEN: 'abc123' });
    expect(config).toEqual({ token: 'abc123', host: '127.0.0.1', port: 41184 });
  });

  it('uses JOPLIN_HOST and JOPLIN_PORT overrides when set', () => {
    const config = loadConfig({
      JOPLIN_TOKEN: 'abc123',
      JOPLIN_HOST: '192.168.1.5',
      JOPLIN_PORT: '9999',
    });
    expect(config).toEqual({ token: 'abc123', host: '192.168.1.5', port: 9999 });
  });
});
