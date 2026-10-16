import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import type { AppConfig } from '../src/config';
import { loadSchemaSql, useDatabaseSsl } from '../src/db';
import { oauthBase, originAllowed, siteOrigin } from '../src/origin';
import { ensureApiPrefix } from '../src/request-url';

const config: AppConfig = {
  port: 3001,
  nodeEnv: 'test',
  databaseUrl: 'postgresql://deadline@127.0.0.1:5433/deadline_test',
  jwtSecret: 'test-secret-change-me',
  frontendOrigin: 'http://localhost:5173',
  publicApiOrigin: 'http://localhost:5173',
  cookieSecure: false,
  googleClientId: '',
  googleClientSecret: '',
  yandexClientId: '',
  yandexClientSecret: '',
};

function requestWith(headers: Record<string, string>): Request {
  return {
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}

test('schema sql is readable from the backend tree', () => {
  assert.match(loadSchemaSql(), /CREATE TABLE IF NOT EXISTS users/);
  assert.match(loadSchemaSql(), /CREATE TABLE IF NOT EXISTS assignments/);
});

test('remote databases use tls and local ones do not', () => {
  assert.equal(useDatabaseSsl('postgresql://deadline@127.0.0.1:5433/deadline_test'), false);
  assert.equal(useDatabaseSsl('postgresql://deadline:deadline@db:5432/deadline'), false);
  assert.equal(useDatabaseSsl('postgresql://user:pass@ep-example.neon.tech/neondb'), true);
});

test('api prefix is added only when the function mount stripped it', () => {
  assert.equal(ensureApiPrefix('/api/health'), '/api/health');
  assert.equal(ensureApiPrefix('/api/auth/oauth/google/callback?code=1'), '/api/auth/oauth/google/callback?code=1');
  assert.equal(ensureApiPrefix('/health'), '/api/health');
  assert.equal(ensureApiPrefix('/cron/health?x=1'), '/api/cron/health?x=1');
  assert.equal(ensureApiPrefix('/'), '/api');
  assert.equal(ensureApiPrefix(undefined), '/api');
});

test('an unknown host falls back to the configured origin', () => {
  const req = requestWith({ host: 'evil.example', 'x-forwarded-proto': 'https' });
  assert.equal(originAllowed('https://evil.example', config), false);
  assert.equal(siteOrigin(req, config), 'http://localhost:5173');
  assert.equal(oauthBase(req, config), 'http://localhost:5173');
});

test('the current vercel host is allowed over https', () => {
  const previous = process.env.VERCEL_URL;
  process.env.VERCEL_URL = 'deadline-preview.vercel.app';
  try {
    const req = requestWith({
      'x-forwarded-host': 'deadline-preview.vercel.app',
      'x-forwarded-proto': 'https',
    });
    assert.equal(originAllowed('https://deadline-preview.vercel.app', config), true);
    assert.equal(originAllowed('http://deadline-preview.vercel.app', config), false);
    assert.equal(siteOrigin(req, config), 'https://deadline-preview.vercel.app');
    assert.equal(oauthBase(req, config), 'https://deadline-preview.vercel.app');
  } finally {
    if (previous === undefined) {
      delete process.env.VERCEL_URL;
    } else {
      process.env.VERCEL_URL = previous;
    }
  }
});
