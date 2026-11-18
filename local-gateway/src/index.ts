import { createGatewayApp } from './app';
import { config } from './config';
import { closePool } from './config/database';

if (!config.localGatewayToken) {
  console.error('LOCAL_GATEWAY_TOKEN est obligatoire. La passerelle refuse de démarrer sans secret.');
  process.exit(1);
}

if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
  console.error(`HOST=${config.host} expose la passerelle au-delà de la machine. La valeur recommandée est 127.0.0.1.`);
}

const app = createGatewayApp();
const server = app.listen(config.port, config.host, () => {
  console.log('===============================================');
  console.log(` Passerelle TaskFlow sur http://${config.host}:${config.port}`);
  console.log(' PostgreSQL reste local. Le tunnel Cloudflare se lance à part.');
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
