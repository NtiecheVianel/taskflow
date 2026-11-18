export class HttpError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

export class DataUnavailableError extends Error {
  statusCode: number;

  constructor(message = 'Base de données PostgreSQL indisponible.') {
    super(message);
    this.name = 'DataUnavailableError';
    this.statusCode = 503;
  }
}
