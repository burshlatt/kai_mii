import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import request from 'supertest';
import './env';
import { createApp } from '../src/app';
import { getConfig, type AppConfig } from '../src/config';
import { createPool, migrate } from '../src/db';
import type { Express } from 'express';
import type { Pool } from 'pg';

let pool: Pool;
let app: Express;
const originalFetch = globalThis.fetch;

function oauthConfig(): AppConfig {
  return {
    ...getConfig(),
    googleClientId: 'google-client-id',
    googleClientSecret: 'google-client-secret',
    yandexClientId: 'yandex-client-id',
    yandexClientSecret: 'yandex-client-secret',
  };
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

before(async () => {
  const config = getConfig();
  pool = createPool(config.databaseUrl);
  await migrate(pool);
  await pool.query(`DELETE FROM users WHERE email LIKE 'oauth-suite-%'`);
  app = createApp(pool, oauthConfig());
});

after(async () => {
  restoreFetch();
  await pool.query(`DELETE FROM users WHERE email LIKE 'oauth-suite-%'`);
  await pool.end();
});

test('google login creates a session from the provider profile', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      const body = init?.body;
      assert.ok(body instanceof URLSearchParams);
      assert.equal(body.get('code'), 'good-code');
      assert.equal(body.get('grant_type'), 'authorization_code');
      assert.equal(body.get('client_id'), 'google-client-id');
      return new Response(JSON.stringify({ access_token: 'google-access' }), { status: 200 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), 'Bearer google-access');
      return new Response(
        JSON.stringify({
          sub: 'google-subject-1',
          email: 'oauth-suite-google@example.com',
          name: 'Алина Google',
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const agent = request.agent(app);
  const start = await agent.get('/api/auth/oauth/google/start').redirects(0);
  assert.equal(start.status, 302);
  const location = String(start.headers.location);
  assert.match(location, /^https:\/\/accounts\.google\.com\//);
  const state = new URL(location).searchParams.get('state');
  assert.ok(state);

  const callback = await agent
    .get('/api/auth/oauth/google/callback')
    .query({ code: 'good-code', state })
    .redirects(0);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.location, 'http://localhost:5173/');

  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'oauth-suite-google@example.com');
  assert.equal(me.body.user.name, 'Алина Google');
  const firstId = me.body.user.id as string;

  const again = request.agent(app);
  const restart = await again.get('/api/auth/oauth/google/start').redirects(0);
  const nextState = new URL(String(restart.headers.location)).searchParams.get('state');
  const second = await again
    .get('/api/auth/oauth/google/callback')
    .query({ code: 'good-code', state: nextState })
    .redirects(0);
  assert.equal(second.status, 302);
  const same = await again.get('/api/auth/me');
  assert.equal(same.body.user.id, firstId);

  const count = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM users WHERE oauth_subject = 'google-subject-1'`,
  );
  assert.equal(count.rows[0].count, '1');
  restoreFetch();
});

test('yandex login reads the profile and opens a session', async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://oauth.yandex.ru/token')) {
      return new Response(JSON.stringify({ access_token: 'yandex-access' }), { status: 200 });
    }
    if (url.startsWith('https://login.yandex.ru/info')) {
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('authorization'), 'OAuth yandex-access');
      return new Response(
        JSON.stringify({
          id: 'yandex-subject-1',
          default_email: 'oauth-suite-yandex@example.com',
          real_name: 'Алина Яндекс',
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const agent = request.agent(app);
  const start = await agent.get('/api/auth/oauth/yandex/start').redirects(0);
  assert.equal(start.status, 302);
  assert.match(String(start.headers.location), /^https:\/\/oauth\.yandex\.ru\/authorize/);
  const state = new URL(String(start.headers.location)).searchParams.get('state');
  const callback = await agent
    .get('/api/auth/oauth/yandex/callback')
    .query({ code: 'yandex-code', state })
    .redirects(0);
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.location, 'http://localhost:5173/');
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'oauth-suite-yandex@example.com');
  assert.equal(me.body.user.name, 'Алина Яндекс');
  restoreFetch();
});

test('oauth callback reports denial, a bad state, a taken email and a provider failure', async () => {
  const denied = await request(app)
    .get('/api/auth/oauth/google/callback')
    .query({ error: 'access_denied' })
    .redirects(0);
  assert.equal(denied.status, 302);
  assert.match(String(denied.headers.location), /error=oauth_denied$/);
  assert.equal((await request(app).get('/api/auth/me')).status, 401);

  const agent = request.agent(app);
  const start = await agent.get('/api/auth/oauth/google/start').redirects(0);
  assert.equal(start.status, 302);
  const badState = await agent
    .get('/api/auth/oauth/google/callback')
    .query({ code: 'x', state: 'not-the-cookie' })
    .redirects(0);
  assert.match(String(badState.headers.location), /error=oauth_failed$/);

  const emptyAgent = request.agent(app);
  const emptyStart = await emptyAgent.get('/api/auth/oauth/google/start').redirects(0);
  const emptyCode = await emptyAgent
    .get('/api/auth/oauth/google/callback')
    .query({ state: new URL(String(emptyStart.headers.location)).searchParams.get('state') })
    .redirects(0);
  assert.match(String(emptyCode.headers.location), /error=oauth_failed$/);

  const registered = await request(app).post('/api/auth/register').send({
    email: 'oauth-suite-taken@example.com',
    name: 'Занятая',
    password: 'demo-pass-1',
  });
  assert.equal(registered.status, 201);

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'taken-access' }), { status: 200 });
    }
    if (url === 'https://www.googleapis.com/oauth2/v3/userinfo') {
      return new Response(
        JSON.stringify({
          sub: 'google-subject-taken',
          email: 'oauth-suite-taken@example.com',
          name: 'Чужая',
        }),
        { status: 200 },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;

  const takenAgent = request.agent(app);
  const takenStart = await takenAgent.get('/api/auth/oauth/google/start').redirects(0);
  const takenState = new URL(String(takenStart.headers.location)).searchParams.get('state');
  const taken = await takenAgent
    .get('/api/auth/oauth/google/callback')
    .query({ code: 'taken-code', state: takenState })
    .redirects(0);
  assert.match(String(taken.headers.location), /error=oauth_email_taken$/);
  const linked = await pool.query(
    `SELECT id FROM users WHERE oauth_subject = 'google-subject-taken'`,
  );
  assert.equal(linked.rowCount, 0);

  globalThis.fetch = (async () => new Response('no', { status: 400 })) as typeof fetch;
  const failAgent = request.agent(app);
  const failStart = await failAgent.get('/api/auth/oauth/google/start').redirects(0);
  const failState = new URL(String(failStart.headers.location)).searchParams.get('state');
  const failed = await failAgent
    .get('/api/auth/oauth/google/callback')
    .query({ code: 'bad-code', state: failState })
    .redirects(0);
  assert.match(String(failed.headers.location), /error=oauth_failed$/);
  restoreFetch();
});
