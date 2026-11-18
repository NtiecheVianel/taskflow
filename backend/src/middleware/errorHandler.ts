import { Request, Response, NextFunction } from 'express';
import { DataUnavailableError, HttpError } from '../errors';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof DataUnavailableError) {
    console.error('[Données indisponibles]', err.message);
    res.status(err.statusCode || 503).json({
      message: err.message,
      error: 'DATA_SERVICE_UNAVAILABLE',
    });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'JSON invalide.' });
    return;
  }

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ message: 'Payload trop volumineux.' });
    return;
  }

  console.error('[Erreur Serveur]', err?.code || '', err?.message || err);
  res.status(500).json({
    message: 'Une erreur interne est survenue sur le serveur.',
  });
};
