export class JoplinConnectionError extends Error {
  constructor(message = 'Could not reach Joplin. Is Joplin running with the Web Clipper service enabled?') {
    super(message);
    this.name = 'JoplinConnectionError';
  }
}

export class JoplinApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'JoplinApiError';
    this.status = status;
  }
}
