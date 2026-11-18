import { timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function tokensMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function gatewayAuth(req: Request, res: Response, next: NextFunction): void {
  const expected = config.localGatewayToken;
  if (!expected) {
    res.status(503).json({ message: 'Passerelle non configurée.' });
    return;
  }

  const provided = String(req.get('x-local-gateway-token') || req.get('x-gateway-secret') || '');
  if (!provided || !tokensMatch(provided, expected)) {
    res.status(401).json({ message: 'Accès passerelle refusé.' });
    return;
  }

  next();
}
