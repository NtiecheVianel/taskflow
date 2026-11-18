import { Pool, types } from 'pg';
import { config } from '../config';
import { DataUnavailableError } from '../errors';

types.setTypeParser(1082, (value) => value);

let pool: Pool | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(config.db.database && config.db.user);
}

export function getPool(): Pool {
  if (!isDatabaseConfigured()) {
    throw new DataUnavailableError('PostgreSQL non configuré. Renseignez DB_NAME et DB_USER.');
  }

  if (!pool) {
    pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
      max: 10,
      connectionTimeoutMillis: config.db.connectionTimeoutMs,
      idleTimeoutMillis: 30_000,
      application_name: 'taskflow-local-gateway',
    });

    pool.on('error', (error) => {
      console.error('[PostgreSQL] Connexion inactive perdue:', error.message);
    });
  }

  return pool;
}

export async function checkDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}
