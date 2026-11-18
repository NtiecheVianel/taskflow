import fs from 'fs';
import path from 'path';
import { closePool, getPool } from '../config/database';

function migrationsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../database/migrations'),
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error('Dossier database/migrations introuvable.');
}

export async function runMigrations(): Promise<string[]> {
  const directory = migrationsDir();
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const client = await getPool().connect();
  const applied: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const existing = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
      if ((existing.rowCount || 0) > 0) {
        console.log(`[migrate] déjà appliquée : ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(directory, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[migrate] appliquée : ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }

  return applied;
}

if (require.main === module) {
  runMigrations()
    .then(async (applied) => {
      console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Aucune nouvelle migration.');
      await closePool();
      process.exit(0);
    })
    .catch(async (error: Error) => {
      console.error('[migrate]', error.message);
      await closePool();
      process.exit(1);
    });
}
