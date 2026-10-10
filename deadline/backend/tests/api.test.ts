import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import request from 'supertest';
import './env';
import { createApp } from '../src/app';
import { getConfig } from '../src/config';
import { createPool, migrate } from '../src/db';
import type { Express } from 'express';
import type { Pool } from 'pg';

let pool: Pool;
let app: Express;

function csrfOf(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const found = list.find((item) => item.startsWith('deadline_csrf='));
  if (!found) {
    throw new Error('csrf cookie missing');
  }
  return decodeURIComponent(found.split(';')[0].slice('deadline_csrf='.length));
}

before(async () => {
  const config = getConfig();
  pool = createPool(config.databaseUrl);
  await migrate(pool);
  await pool.query('TRUNCATE assignments, users CASCADE');
  app = createApp(pool, config);
});

after(async () => {
  await pool.end();
});

test('health, auth, crud, validation, csrf and ownership', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.db, 'up');

  const anon = await request(app).get('/api/assignments');
  assert.equal(anon.status, 401);

  const agent = request.agent(app);
  const registered = await agent.post('/api/auth/register').send({
    email: 'alina@example.com',
    name: 'Алина',
    password: 'demo-pass-1',
  });
  assert.equal(registered.status, 201);
  const csrf = csrfOf(registered);

  const duplicate = await request(app).post('/api/auth/register').send({
    email: 'alina@example.com',
    name: 'Другая',
    password: 'demo-pass-1',
  });
  assert.equal(duplicate.status, 409);

  const badLogin = await request(app).post('/api/auth/login').send({
    email: 'alina@example.com',
    password: 'wrong-password',
  });
  assert.equal(badLogin.status, 401);

  const missingCsrf = await agent.post('/api/assignments').send({
    title: 'Эссе',
    course: 'История',
    dueAt: '2020-01-01T00:00:00.000Z',
    status: 'todo',
    priority: 'high',
  });
  assert.equal(missingCsrf.status, 403);

  const invalid = await agent.post('/api/assignments').set('x-csrf-token', csrf).send({
    title: '',
    course: 'История',
    dueAt: '2026-10-12T09:00:00.000Z',
    status: 'todo',
    priority: 'high',
  });
  assert.equal(invalid.status, 400);
  assert.equal(typeof invalid.body.error.fields.title, 'string');

  const created = await agent.post('/api/assignments').set('x-csrf-token', csrf).send({
    title: 'Эссе про транспорт',
    course: 'История',
    description: 'Три страницы',
    dueAt: '2020-01-01T00:00:00.000Z',
    status: 'todo',
    priority: 'high',
  });
  assert.equal(created.status, 201);
  const id = created.body.assignment.id as string;

  const summary = await agent.get('/api/assignments/summary');
  assert.equal(summary.status, 200);
  assert.equal(summary.body.summary.overdue, 1);
  assert.equal(summary.body.summary.todo, 1);

  const listed = await agent.get('/api/assignments').query({ overdue: '1' });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.assignments.length, 1);

  const other = request.agent(app);
  const otherUser = await other.post('/api/auth/register').send({
    email: 'boris@example.com',
    name: 'Борис',
    password: 'demo-pass-1',
  });
  assert.equal(otherUser.status, 201);
  const hidden = await other.get(`/api/assignments/${id}`);
  assert.equal(hidden.status, 404);

  const updated = await agent
    .patch(`/api/assignments/${id}`)
    .set('x-csrf-token', csrf)
    .send({ status: 'done' });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.assignment.status, 'done');

  const afterDone = await agent.get('/api/assignments/summary');
  assert.equal(afterDone.body.summary.overdue, 0);
  assert.equal(afterDone.body.summary.done, 1);

  const removed = await agent.delete(`/api/assignments/${id}`).set('x-csrf-token', csrf);
  assert.equal(removed.status, 204);

  const oauth = await request(app).get('/api/auth/oauth/google/start');
  assert.equal(oauth.status, 302);
  assert.match(String(oauth.headers.location), /oauth_unavailable/);

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'alina@example.com');

  const loggedOut = await agent.post('/api/auth/logout').set('x-csrf-token', csrf);
  assert.equal(loggedOut.status, 204);
  const afterLogout = await agent.get('/api/auth/me');
  assert.equal(afterLogout.status, 401);
});
