import { JoplinApiError, JoplinConnectionError } from '../client/errors.js';

export function toToolError(error: unknown): { content: [{ type: 'text'; text: string }]; isError: true } {
  const message =
    error instanceof JoplinConnectionError || error instanceof JoplinApiError
      ? error.message
      : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  return { content: [{ type: 'text', text: message }], isError: true };
}
