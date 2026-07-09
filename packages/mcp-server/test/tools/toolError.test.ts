import { describe, expect, it } from 'vitest';
import { toToolError } from '../../src/tools/toolError.js';
import { JoplinApiError, JoplinConnectionError } from '../../src/client/errors.js';

describe('toToolError', () => {
  it('maps a JoplinApiError to an isError result with its message', () => {
    const result = toToolError(new JoplinApiError(404, 'Not Found'));
    expect(result).toEqual({ content: [{ type: 'text', text: 'Not Found' }], isError: true });
  });

  it('maps a JoplinConnectionError to an isError result with its message', () => {
    const result = toToolError(new JoplinConnectionError('Is Joplin running?'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Is Joplin running?');
  });

  it('maps an unknown error to a generic isError result', () => {
    const result = toToolError(new Error('boom'));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Unexpected error: boom');
  });
});
