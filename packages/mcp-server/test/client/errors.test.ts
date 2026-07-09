import { describe, expect, it } from 'vitest';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

describe('JoplinConnectionError', () => {
  it('has a default human-readable message', () => {
    const error = new JoplinConnectionError();
    expect(error.name).toBe('JoplinConnectionError');
    expect(error.message).toMatch(/Web Clipper/);
  });

  it('accepts a custom message', () => {
    const error = new JoplinConnectionError('custom message');
    expect(error.message).toBe('custom message');
  });
});

describe('JoplinApiError', () => {
  it('carries the HTTP status code and message', () => {
    const error = new JoplinApiError(404, 'Not Found');
    expect(error.name).toBe('JoplinApiError');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
  });
});
