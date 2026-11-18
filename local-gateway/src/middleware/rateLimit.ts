import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;
  const key = req.ip || req.socket.remoteAddress || 'local';
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 1000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.reset < now) buckets.delete(bucketKey);
      }
    }
    next();
    return;
  }

  current.count += 1;
  if (current.count > max) {
    res.status(429).json({ message: 'Trop de requêtes. Réessayez dans un instant.' });
    return;
  }

  next();
}
