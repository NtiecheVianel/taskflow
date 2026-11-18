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

  constructor(
    message = 'Communication interrompue avec la base de données. Vérifiez que la passerelle ou le tunnel sont actifs.'
  ) {
    super(message);
    this.name = 'DataUnavailableError';
    this.statusCode = 503;
  }
}
