import assert from 'node:assert/strict';
import test from 'node:test';
import { readHealth } from '../src/monitor';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('health snapshot is ok only when the database is up', async () => {
  const up = await readHealth('http://monitor.test/api/health', async () =>
    jsonResponse(200, { status: 'ok', db: 'up' }),
  );
  assert.equal(up.ok, true);
  assert.equal(up.reason, 'ok');

  const down = await readHealth('http://monitor.test/api/health', async () =>
    jsonResponse(503, { status: 'degraded', db: 'down' }),
  );
  assert.equal(down.ok, false);
  assert.equal(down.reason, 'http_error');
  assert.equal(down.db, 'down');

  const lying = await readHealth('http://monitor.test/api/health', async () =>
    jsonResponse(200, { status: 'ok', db: 'down' }),
  );
  assert.equal(lying.ok, false);
  assert.equal(lying.reason, 'db_down');
});

test('health snapshot reports a network failure', async () => {
  const failed = await readHealth('http://monitor.test/api/health', async () => {
    throw new Error('connect ECONNREFUSED');
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.status, null);
  assert.equal(failed.reason, 'connect ECONNREFUSED');
});
