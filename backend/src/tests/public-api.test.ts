import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { createApp } from '../app';

process.env.NODE_ENV = 'test';
process.env.DATA_SOURCE = 'postgres';
process.env.JWT_SECRET = 'unit-test-jwt-secret';
delete process.env.LOCAL_GATEWAY_URL;
delete process.env.GATEWAY_URL;
delete process.env.RENDER;
delete process.env.RAILWAY_ENVIRONMENT;
process.env.DB_NAME = '';
process.env.DB_USER = '';

describe('API publique', { concurrency: 1 }, () => {
let server: Server;
let baseUrl = '';

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function json(path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

test('la racine annonce le mode sans secret', async () => {
  const { status, body } = await json('/');
  assert.equal(status, 200);
  assert.equal(body.mode, 'postgres_direct');
  assert.equal(JSON.stringify(body).includes('token'), false);
});

test('inscription incomplète : 400', async () => {
  const { status, body } = await json('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.c' }),
  });
  assert.equal(status, 400);
  assert.match(body.message, /nom complet/i);
});

test('mot de passe trop court : 400', async () => {
  const { status } = await json('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Ada', email: 'ada@example.com', password: '123' }),
  });
  assert.equal(status, 400);
});

test('connexion incomplète : 400', async () => {
  const { status, body } = await json('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(status, 400);
  assert.match(body.message, /requis/i);
});

test('tâches sans jeton : 401', async () => {
  const { status } = await json('/api/tasks');
  assert.equal(status, 401);
});

test('jeton invalide : 401', async () => {
  const { status, body } = await json('/api/tasks', {
    headers: { Authorization: 'Bearer pas-un-jwt' },
  });
  assert.equal(status, 401);
  assert.match(body.message, /jeton|autorisé/i);
});

test('santé sans PostgreSQL configuré : 503', async () => {
  delete process.env.RENDER;
  delete process.env.RAILWAY_ENVIRONMENT;
  process.env.NODE_ENV = 'test';
  process.env.DATA_SOURCE = 'postgres';
  process.env.DB_NAME = '';
  process.env.DB_USER = '';
  const { status, body } = await json('/api/health');
  assert.equal(status, 503);
  assert.equal(body.service.mode, 'postgres_unavailable');
});
});
