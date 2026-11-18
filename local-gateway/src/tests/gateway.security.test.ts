import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import { after, test } from 'node:test';
import { createGatewayApp } from '../app';
import { tokensMatch } from '../middleware/gatewayAuth';

const TOKEN = 'gateway-security-token';
process.env.NODE_ENV = 'test';
process.env.LOCAL_GATEWAY_TOKEN = TOKEN;
process.env.RATE_LIMIT_MAX = '1000';

let server: Server;
let baseUrl = '';

function listen(): Promise<void> {
  server = createGatewayApp().listen(0, '127.0.0.1');
  return new Promise((resolve) => {
    server.once('listening', () => {
      baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
}

after(async () => {
  if (!server) return;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('comparaison de secret', () => {
  assert.equal(tokensMatch(TOKEN, TOKEN), true);
  assert.equal(tokensMatch('court', TOKEN), false);
  assert.equal(tokensMatch(`${TOKEN}x`, TOKEN), false);
});

test('sans secret, mauvais secret, et charge utile refusée', async () => {
  await listen();

  const root = await fetch(`${baseUrl}/`);
  const rootBody = await root.json();
  assert.equal(root.status, 200);
  assert.equal(rootBody.role, 'local-data-gateway');
  assert.equal(JSON.stringify(rootBody).includes(TOKEN), false);

  const missing = await fetch(`${baseUrl}/api/internal/health`);
  assert.equal(missing.status, 401);

  const wrong = await fetch(`${baseUrl}/api/internal/users/by-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-local-gateway-token': 'pas-le-bon-secret',
    },
    body: JSON.stringify({ email: 'a@b.c' }),
  });
  assert.equal(wrong.status, 401);

  const noSql = await fetch(`${baseUrl}/api/internal/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-local-gateway-token': TOKEN,
    },
    body: JSON.stringify({ sql: 'DROP TABLE users', query: 'SELECT * FROM users' }),
  });
  const noSqlBody = await noSql.json();
  assert.equal(noSql.status, 400);
  assert.equal(JSON.stringify(noSqlBody).toLowerCase().includes('drop table'), false);

  const missingEmail = await fetch(`${baseUrl}/api/internal/users/by-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-local-gateway-token': TOKEN,
    },
    body: JSON.stringify({}),
  });
  assert.equal(missingEmail.status, 400);
});
