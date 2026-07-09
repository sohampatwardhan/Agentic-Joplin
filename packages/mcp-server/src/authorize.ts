import { JoplinApiError, JoplinConnectionError } from './client/errors.js';

export interface AuthorizeOptions {
  host?: string;
  port?: number;
  fetchImpl?: typeof fetch;
  pollIntervalMs?: number;
  timeoutMs?: number;
  onWaiting?: () => void;
}

interface AuthCheckResponse {
  status: 'waiting' | 'accepted' | 'rejected';
  token?: string;
}

/**
 * Runs Joplin's clipper authorization handshake (the same flow the Web Clipper browser
 * extension uses) so a user can grant access by clicking Accept in Joplin instead of
 * copy-pasting a token from Options > Web Clipper.
 */
export async function authorize(options: AuthorizeOptions = {}): Promise<string> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 41184;
  const fetchImpl = options.fetchImpl ?? fetch;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const base = `http://${host}:${port}`;

  let authResponse: Response;
  try {
    authResponse = await fetchImpl(`${base}/auth`, { method: 'POST' });
  } catch {
    throw new JoplinConnectionError();
  }
  if (!authResponse.ok) {
    throw new JoplinApiError(authResponse.status, await authResponse.text());
  }
  const { auth_token: authToken } = (await authResponse.json()) as { auth_token: string };

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const checkResponse = await fetchImpl(`${base}/auth/check?auth_token=${authToken}`);
    if (!checkResponse.ok) {
      throw new JoplinApiError(checkResponse.status, await checkResponse.text());
    }
    const result = (await checkResponse.json()) as AuthCheckResponse;

    if (result.status === 'accepted') {
      if (!result.token) {
        throw new Error('Joplin accepted the authorization request but did not return a token.');
      }
      return result.token;
    }
    if (result.status === 'rejected') {
      throw new Error('Authorization request was rejected in Joplin.');
    }

    options.onWaiting?.();
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Timed out waiting for authorization. Open Joplin, click Accept on the request, and try again.');
}
