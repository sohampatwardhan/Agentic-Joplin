import { describe, expect, it, vi } from 'vitest';
import { authorize } from '../src/authorize.js';
import { JoplinApiError, JoplinConnectionError } from '../src/client/errors.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('authorize', () => {
  it('requests an auth_token, polls until accepted, and returns the final token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth_token: 'auth-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'waiting' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'accepted', token: 'real-token' }));

    const token = await authorize({ fetchImpl, pollIntervalMs: 0 });

    expect(token).toBe('real-token');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:41184/auth');
    expect(fetchImpl.mock.calls[0][1]).toEqual({ method: 'POST' });
    expect(fetchImpl.mock.calls[1][0]).toBe('http://127.0.0.1:41184/auth/check?auth_token=auth-1');
  });

  it('calls onWaiting while status is waiting', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth_token: 'auth-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'waiting' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'accepted', token: 'real-token' }));
    const onWaiting = vi.fn();

    await authorize({ fetchImpl, pollIntervalMs: 0, onWaiting });

    expect(onWaiting).toHaveBeenCalledTimes(1);
  });

  it('throws when the request is rejected in Joplin', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth_token: 'auth-1' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'rejected' }));

    await expect(authorize({ fetchImpl, pollIntervalMs: 0 })).rejects.toThrow(/rejected/);
  });

  it('throws JoplinConnectionError when the initial request cannot connect', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(authorize({ fetchImpl })).rejects.toBeInstanceOf(JoplinConnectionError);
  });

  it('throws JoplinApiError when /auth responds with a non-2xx status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('nope', { status: 500 }));

    await expect(authorize({ fetchImpl })).rejects.toBeInstanceOf(JoplinApiError);
  });

  it('times out if never accepted or rejected', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ auth_token: 'auth-1' }))
      .mockImplementation(async () => jsonResponse({ status: 'waiting' }));

    await expect(authorize({ fetchImpl, pollIntervalMs: 0, timeoutMs: 1 })).rejects.toThrow(/Timed out/);
  });
});
