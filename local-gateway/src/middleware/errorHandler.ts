import { NextFunction, Request, Response } from 'express';
import { DataUnavailableError, HttpError } from '../errors';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof DataUnavailableError) {
    console.error('[PostgreSQL indisponible]', err.message);
    res.status(503).json({ message: err.message });
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

  const connectionCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', '57P01', '28P01', '08006', '08001'];
  if (connectionCodes.includes(err?.code) || /ECONNREFUSED|timeout|connect E/i.test(err?.message || '')) {
    res.status(503).json({ message: 'Base de données PostgreSQL indisponible.' });
    return;
  }

  console.error('[Passerelle]', err?.code || '', err?.message || err);
  res.status(500).json({ message: 'Erreur interne de la passerelle de données.' });
}
