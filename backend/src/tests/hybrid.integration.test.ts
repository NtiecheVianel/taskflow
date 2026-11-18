import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { after, test } from 'node:test';
import { createApp } from '../app';
import { closePool, getPool } from '../config/database';
import { runMigrations } from '../scripts/migrate';
import { postgresStore } from '../services/postgresStore';
import { createGatewayApp } from '../../../local-gateway/src/app';
import { closePool as closeGatewayPool } from '../../../local-gateway/src/config/database';

const enabled = process.env.TASKFLOW_RUN_INTEGRATION === '1';
const TOKEN = 'integration-gateway-token';
const servers: Server[] = [];

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'integration-jwt-secret';
process.env.DATA_SOURCE = 'postgres';
process.env.LOCAL_GATEWAY_TOKEN = TOKEN;
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '54329';
process.env.DB_NAME = process.env.DB_NAME || 'taskflow_test';
process.env.DB_USER = process.env.DB_USER || 'taskflow';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'taskflow_test_pw';
process.env.DB_SSL = 'false';
delete process.env.RENDER;
delete process.env.RAILWAY_ENVIRONMENT;

function listen(server: Server): Promise<string> {
  servers.push(server);
  return new Promise((resolve) => {
    server.once('listening', () => {
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });
}

after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          if (!server.listening) {
            resolve();
            return;
          }
          server.close(() => resolve());
        })
    )
  );
  await closePool();
  await closeGatewayPool();
});

test('PostgreSQL, migrations, isolation et coupure de passerelle', { skip: enabled ? false : 'TASKFLOW_RUN_INTEGRATION non défini' }, async () => {
  const first = await runMigrations();
  const second = await runMigrations();
  assert.deepEqual(second, []);
  assert.ok(first.length === 1 || first.length === 0);

  const tables = await getPool().query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [['users', 'tasks', 'schema_migrations']]
  );
  assert.equal(tables.rowCount, 3);

  await getPool().query(`DELETE FROM users WHERE email LIKE 'it-%@taskflow.test'`);

  const email = `it-${Date.now()}@taskflow.test`;
  const user = await postgresStore.createUser({
    full_name: 'Integration User',
    email,
    password_hash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
  });
  assert.match(user.id, /^[0-9a-f-]{36}$/i);

  const found = await postgresStore.getUserByEmail(email.toUpperCase());
  assert.equal(found?.id, user.id);
  assert.equal(found?.password_hash.startsWith('$2'), true);

  const injected = `'); DROP TABLE tasks; --`;
  const task = await postgresStore.createTask({
    user_id: user.id,
    title: injected,
    description: 'persistée',
    status: 'À faire',
    priority: 'Haute',
    due_date: '2026-12-01',
  });
  assert.equal(task.title, injected);
  assert.equal(task.due_date, '2026-12-01');

  const updated = await postgresStore.updateTask(task.id, user.id, { status: 'En cours' });
  assert.equal(updated?.status, 'En cours');

  const other = await postgresStore.createUser({
    full_name: 'Autre',
    email: `it-other-${Date.now()}@taskflow.test`,
    password_hash: '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012',
  });
  assert.equal(await postgresStore.getTaskById(task.id, other.id), null);
  assert.equal(await postgresStore.updateTask(task.id, other.id, { title: 'non' }), null);
  assert.equal(await postgresStore.deleteTask(task.id, other.id), false);
  assert.equal((await postgresStore.getTasks(user.id))[0].title, injected);

  const stats = await postgresStore.getTaskStats(user.id);
  assert.equal(stats.total, 1);
  assert.equal(stats.inProgress, 1);

  const stillThere = await getPool().query(`SELECT to_regclass('public.tasks') AS name`);
  assert.equal(stillThere.rows[0].name, 'tasks');

  const otherTask = await postgresStore.createTask({
    user_id: other.id,
    title: 'supprimée avec le compte',
    status: 'À faire',
    priority: 'Basse',
  });
  await getPool().query('DELETE FROM users WHERE id = $1', [other.id]);
  const gone = await getPool().query('SELECT id FROM tasks WHERE id = $1', [otherTask.id]);
  assert.equal(gone.rowCount, 0);

  process.env.DATA_SOURCE = 'gateway';
  const gatewayServer = createGatewayApp().listen(0, '127.0.0.1');
  process.env.LOCAL_GATEWAY_URL = await listen(gatewayServer);
  const backendServer = createApp().listen(0, '127.0.0.1');
  const baseUrl = await listen(backendServer);

  const register = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: 'Via Passerelle',
      email: `it-http-${Date.now()}@taskflow.test`,
      password: 'secret12',
    }),
  });
  const session = await register.json();
  assert.equal(register.status, 201, JSON.stringify(session));
  assert.equal(session.user.password_hash, undefined);

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: session.user.email, password: 'mauvais-mot' }),
  });
  assert.equal(login.status, 401);

  const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: session.user.email, password: 'secret12' }),
  });
  const logged = await goodLogin.json();
  assert.equal(goodLogin.status, 200);
  assert.equal(typeof logged.token, 'string');

  const created = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${logged.token}` },
    body: JSON.stringify({
      title: 'Tâche hybride',
      description: 'depuis le backend vers PostgreSQL',
      status: 'À faire',
      priority: 'Moyenne',
      due_date: '2026-11-30',
    }),
  });
  const createdTask = await created.json();
  assert.equal(created.status, 201, JSON.stringify(createdTask));

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Doublon', email: session.user.email, password: 'secret12' }),
  });
  assert.equal(duplicate.status, 400);

  await new Promise<void>((resolve, reject) => gatewayServer.close((error) => (error ? reject(error) : resolve())));
  const duringOutage = await fetch(`${baseUrl}/api/tasks`, {
    headers: { Authorization: `Bearer ${logged.token}` },
  });
  assert.equal(duringOutage.status, 503);

  const restarted = createGatewayApp().listen(0, '127.0.0.1');
  process.env.LOCAL_GATEWAY_URL = await listen(restarted);
  const afterRestart = await fetch(`${baseUrl}/api/tasks`, {
    headers: { Authorization: `Bearer ${logged.token}` },
  });
  const restored = await afterRestart.json();
  assert.equal(afterRestart.status, 200, JSON.stringify(restored));
  assert.equal(restored.some((item: { id: string }) => item.id === createdTask.id), true);

  const row = await getPool().query('SELECT title FROM tasks WHERE id = $1', [createdTask.id]);
  assert.equal(row.rows[0].title, 'Tâche hybride');
});
