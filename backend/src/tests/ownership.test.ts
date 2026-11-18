import assert from 'node:assert/strict';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { createApp } from '../app';

const TOKEN = 'ownership-gateway-token';

interface StoredUser {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

interface StoredTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const users: StoredUser[] = [];
const tasks: StoredTask[] = [];
let backend: Server;
let gateway: Server;
let baseUrl = '';

process.env.NODE_ENV = 'test';
process.env.DATA_SOURCE = 'gateway';
process.env.JWT_SECRET = 'ownership-test-jwt';
process.env.LOCAL_GATEWAY_TOKEN = TOKEN;
delete process.env.RENDER;

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function publicUser(user: StoredUser) {
  return { id: user.id, full_name: user.full_name, email: user.email, created_at: user.created_at };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.headers['x-local-gateway-token'] !== TOKEN) {
    send(res, 401, { message: 'Accès passerelle refusé.' });
    return;
  }

  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
  const userId = url.searchParams.get('userId') || body.userId;

  if (req.method === 'POST' && url.pathname === '/api/internal/users/by-email') {
    const found = users.find((user) => user.email === String(body.email || '').toLowerCase());
    send(res, 200, found || null);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/internal/users') {
    const user: StoredUser = {
      id: randomUUID(),
      full_name: body.full_name,
      email: String(body.email).toLowerCase(),
      password_hash: body.password_hash,
      created_at: new Date().toISOString(),
    };
    users.push(user);
    send(res, 201, publicUser(user));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/internal/tasks') {
    send(res, 200, tasks.filter((task) => task.user_id === userId));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/internal/tasks') {
    const task: StoredTask = {
      id: randomUUID(),
      user_id: body.user_id,
      title: body.title,
      description: body.description || null,
      status: body.status,
      priority: body.priority,
      due_date: body.due_date || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    tasks.push(task);
    send(res, 201, task);
    return;
  }

  const taskMatch = url.pathname.match(/^\/api\/internal\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'GET') {
    const task = tasks.find((item) => item.id === taskMatch[1] && item.user_id === userId) || null;
    send(res, 200, task);
    return;
  }

  if (taskMatch && req.method === 'PUT') {
    const task = tasks.find((item) => item.id === taskMatch[1] && item.user_id === userId);
    if (!task) {
      send(res, 200, null);
      return;
    }
    if (body.title !== undefined) task.title = body.title;
    if (body.status !== undefined) task.status = body.status;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.description !== undefined) task.description = body.description;
    if (body.due_date !== undefined) task.due_date = body.due_date;
    task.updated_at = new Date().toISOString();
    send(res, 200, task);
    return;
  }

  if (taskMatch && req.method === 'DELETE') {
    const index = tasks.findIndex((item) => item.id === taskMatch[1] && item.user_id === userId);
    if (index >= 0) tasks.splice(index, 1);
    send(res, 200, { success: index >= 0 });
    return;
  }

  send(res, 404, { message: 'Route stub inconnue.' });
}

before(async () => {
  users.length = 0;
  tasks.length = 0;
  gateway = createServer((req, res) => {
    handle(req, res).catch(() => send(res, 500, { message: 'stub' }));
  });
  gateway.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => gateway.once('listening', () => resolve()));
  process.env.LOCAL_GATEWAY_URL = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;

  backend = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => backend.once('listening', () => resolve()));
  baseUrl = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
});

after(async () => {
  await Promise.all(
    [backend, gateway].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  );
});

async function register(fullName: string, email: string): Promise<{ token: string; user: { id: string } }> {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, password: 'secret12' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201, JSON.stringify(body));
  assert.equal(body.password_hash, undefined);
  assert.equal(body.user.password_hash, undefined);
  return body;
}

test('un utilisateur ne voit ni ne modifie les tâches d\'un autre', async () => {
  const ada = await register('Ada Lovelace', `ada-${Date.now()}@example.com`);
  const grace = await register('Grace Hopper', `grace-${Date.now()}@example.com`);

  const created = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ada.token}`,
    },
    body: JSON.stringify({
      title: 'Tâche privée',
      description: 'visible uniquement par Ada',
      status: 'À faire',
      priority: 'Haute',
      due_date: '2026-12-01',
      user_id: grace.user.id,
    }),
  });
  const task = await created.json();
  assert.equal(created.status, 201, JSON.stringify(task));
  assert.equal(task.user_id, ada.user.id);
  assert.notEqual(task.user_id, grace.user.id);

  const graceList = await fetch(`${baseUrl}/api/tasks`, {
    headers: { Authorization: `Bearer ${grace.token}` },
  });
  assert.deepEqual(await graceList.json(), []);

  const graceRead = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    headers: { Authorization: `Bearer ${grace.token}` },
  });
  assert.equal(graceRead.status, 404);

  const graceUpdate = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${grace.token}`,
    },
    body: JSON.stringify({ title: 'Piratée', user_id: grace.user.id }),
  });
  assert.equal(graceUpdate.status, 404);

  const graceDelete = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${grace.token}` },
  });
  assert.equal(graceDelete.status, 404);

  const adaList = await fetch(`${baseUrl}/api/tasks`, {
    headers: { Authorization: `Bearer ${ada.token}` },
  });
  const adaTasks = await adaList.json();
  assert.equal(adaTasks.length, 1);
  assert.equal(adaTasks[0].title, 'Tâche privée');
});

test('mauvais mot de passe : 401', async () => {
  const email = `bad-${Date.now()}@example.com`;
  await register('Bad Login', email);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'mauvais' }),
  });
  assert.equal(response.status, 401);
});

test('e-mail déjà utilisé : 400', async () => {
  const email = `dup-${Date.now()}@example.com`;
  await register('Premier', email);
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: 'Second', email, password: 'secret12' }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.message, /existe déjà/i);
});
