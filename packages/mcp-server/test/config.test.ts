import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import * as tokenStore from '../src/tokenStore.js';

describe('loadConfig', () => {
  it('throws when JOPLIN_TOKEN is missing and no cached token exists', () => {
    vi.spyOn(tokenStore, 'readCachedToken').mockReturnValue(undefined);

    expect(() => loadConfig({})).toThrow(/JOPLIN_TOKEN/);
  });

  it('falls back to a cached token when JOPLIN_TOKEN is not set', () => {
    vi.spyOn(tokenStore, 'readCachedToken').mockReturnValue('cached-token');

    const config = loadConfig({});

    expect(config).toEqual({ token: 'cached-token', host: '127.0.0.1', port: 41184 });
  });

  it('prefers JOPLIN_TOKEN over a cached token when both are present', () => {
    vi.spyOn(tokenStore, 'readCachedToken').mockReturnValue('cached-token');

    const config = loadConfig({ JOPLIN_TOKEN: 'env-token' });

    expect(config.token).toBe('env-token');
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
