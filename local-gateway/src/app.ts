import express, { Request, Response } from 'express';
import { errorHandler } from './middleware/errorHandler';
import { gatewayAuth } from './middleware/gatewayAuth';
import { rateLimit } from './middleware/rateLimit';
import healthRoutes from './routes/health.routes';
import taskRoutes from './routes/task.routes';
import userRoutes from './routes/user.routes';

export function createGatewayApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '32kb' }));

  app.use((req, res, next) => {
    const started = Date.now();
    const pathOnly = (req.originalUrl || req.path).split('?')[0];
    res.on('finish', () => {
      console.log(`[gateway] ${req.method} ${pathOnly} ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'Passerelle TaskFlow', role: 'local-data-gateway' });
  });

  app.use('/api', rateLimit);
  app.use('/api', gatewayAuth);
  app.use('/api/internal/health', healthRoutes);
  app.use('/api/internal/users', userRoutes);
  app.use('/api/internal/tasks', taskRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Route introuvable sur la passerelle.' });
  });

  app.use(errorHandler);
  return app;
}
