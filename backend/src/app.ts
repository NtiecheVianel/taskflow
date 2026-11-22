import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import { errorHandler } from './middleware/errorHandler';
import { dataService, usesGateway } from './services/dataService';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');

  const configuredOrigins = config.frontendUrl === '*'
    ? []
    : config.frontendUrl.split(',').map((origin) => origin.trim()).filter(Boolean);
  const allowedOrigins = [
    ...configuredOrigins,
    'https://gestion-de-taches-fyswuxcs6-clementadjivon52-commits-projects.vercel.app',
    'http://localhost:3000',
  ];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '100kb' }));

  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'API TaskFlow opérationnelle',
      version: '1.1.0',
      mode: usesGateway() ? 'hybrid_via_gateway' : 'postgres_direct',
    });
  });

  app.get('/api/health', async (_req: Request, res: Response) => {
    const health = await dataService.checkHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json({
      api: 'online',
      timestamp: new Date().toISOString(),
      service: health,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tasks', taskRoutes);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Route introuvable sur le serveur API.' });
  });

  app.use(errorHandler);
  return app;
}

export const app = createApp();
