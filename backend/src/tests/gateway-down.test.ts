import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, describe, test } from 'node:test';
import { createApp } from '../app';

const TOKEN = 'gateway-token-should-not-leak';
const servers: Server[] = [];

process.env.NODE_ENV = 'test';
process.env.DATA_SOURCE = 'gateway';
process.env.JWT_SECRET = 'unit-test-jwt-secret';
process.env.LOCAL_GATEWAY_TOKEN = TOKEN;
delete process.env.RENDER;

function track(server: Server): Server {
  servers.push(server);
  return server;
}

async function listen(server: Server): Promise<string> {
  if (!server.listening) {
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  }
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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
});

describe('passerelle indisponible', { concurrency: 1 }, () => {
test('passerelle arrêtée : 503, et le secret n\'apparaît pas', async () => {
  process.env.LOCAL_GATEWAY_URL = 'http://127.0.0.1:1';
  process.env.LOCAL_GATEWAY_TOKEN = TOKEN;
  const base = await listen(track(createApp().listen(0, '127.0.0.1')));

  const tasks = await fetch(`${base}/api/tasks`);
  assert.equal(tasks.status, 401);

  const response = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Ada Lovelace', email: 'ada@example.com', password: 'secret12' }),
  });
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal(text.includes(TOKEN), false);
  assert.match(text, /passerelle|tunnel|indisponible/i);
});

test('secret de passerelle refusé : 503 public, pas une déconnexion utilisateur', async () => {
  const stub = track(
    createServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Accès passerelle refusé.' }));
    }).listen(0, '127.0.0.1')
  );
  process.env.LOCAL_GATEWAY_URL = await listen(stub);
  process.env.LOCAL_GATEWAY_TOKEN = TOKEN;

  const base = await listen(track(createApp().listen(0, '127.0.0.1')));
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'secret12' }),
  });
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.error, 'DATA_SERVICE_UNAVAILABLE');
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
});
});
