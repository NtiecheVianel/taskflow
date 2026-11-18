import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPool } from '../config/database';
import { usesGateway } from '../services/dataService';

process.env.NODE_ENV = 'test';
process.env.RENDER = 'true';
process.env.DATA_SOURCE = 'postgres';
delete process.env.RAILWAY_ENVIRONMENT;

test('Render force la passerelle et interdit le pool PostgreSQL', () => {
  assert.equal(usesGateway(), true);
  assert.throws(() => getPool(), /passerelle|PostgreSQL/i);
});
