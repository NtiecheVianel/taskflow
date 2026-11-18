import { app } from './app';
import { config, isCloudHost } from './config';
import { closePool } from './config/database';
import { usesGateway } from './services/dataService';

if ((config.nodeEnv === 'production' || isCloudHost()) && !process.env.JWT_SECRET?.trim()) {
  console.error('JWT_SECRET est obligatoire en production (Render).');
  process.exit(1);
}

if ((config.nodeEnv === 'production' || isCloudHost()) && !config.localGatewayUrl) {
  console.error('LOCAL_GATEWAY_URL est absent. Les données resteront indisponibles tant que le tunnel n\'est pas configuré.');
}

const server = app.listen(config.port, '0.0.0.0', () => {
  const mode = usesGateway() ? 'hybride via passerelle locale' : 'PostgreSQL direct (développement)';
  console.log('===============================================');
  console.log(` Serveur TaskFlow API démarré sur le port ${config.port}`);
  console.log(` Mode : ${mode}`);
  console.log(` Environnement : ${config.nodeEnv}`);
  console.log('===============================================');
});

function shutdown(signal: string): void {
  console.log(`Arrêt (${signal})...`);
  server.close(() => {
    closePool()
      .catch((error: Error) => console.error('[PostgreSQL] fermeture:', error.message))
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
