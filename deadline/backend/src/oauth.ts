import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { AppConfig } from './config';
import { HttpError } from './http';
import { tokensMatch } from './auth';

export const OAUTH_STATE_COOKIE = 'deadline_oauth_state';
export type OAuthProvider = 'google' | 'yandex';

export interface OAuthProfile {
  subject: string;
  email: string;
  name: string;
}

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === 'google' || value === 'yandex';
}

export function providerConfigured(provider: OAuthProvider, config: AppConfig): boolean {
  if (provider === 'google') {
    return Boolean(config.googleClientId && config.googleClientSecret);
  }
  return Boolean(config.yandexClientId && config.yandexClientSecret);
}

export function redirectUri(
  provider: OAuthProvider,
  config: AppConfig,
  origin = config.publicApiOrigin,
): string {
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  state: string,
  config: AppConfig,
  origin = config.publicApiOrigin,
): string {
  const callback = redirectUri(provider, config, origin);
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.googleClientId);
    url.searchParams.set('redirect_uri', callback);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }
  const url = new URL('https://oauth.yandex.ru/authorize');
  url.searchParams.set('client_id', config.yandexClientId);
  url.searchParams.set('redirect_uri', callback);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'login:email login:info');
  url.searchParams.set('state', state);
  return url.toString();
}

export function issueState(res: Response, config: AppConfig, secure = config.cookieSecure): string {
  const state = crypto.randomBytes(24).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 10 * 60 * 1000,
  });
  return state;
}

export function clearState(res: Response, secure: boolean): void {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
  });
}

export function readState(req: Request, expected: unknown): void {
  const cookie = req.cookies?.[OAUTH_STATE_COOKIE];
  if (
    typeof cookie !== 'string' ||
    typeof expected !== 'string' ||
    !tokensMatch(cookie, expected)
  ) {
    throw new HttpError(400, 'oauth_state', 'Сессия входа устарела. Начните заново.');
  }
}

async function postForm(url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new HttpError(502, 'oauth_token', 'Провайдер не выдал токен.');
  }
  return response.json() as Promise<unknown>;
}

function readAccessToken(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || !('access_token' in payload)) {
    throw new HttpError(502, 'oauth_token', 'Провайдер вернул ответ без токена.');
  }
  const token = payload.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new HttpError(502, 'oauth_token', 'Провайдер вернул ответ без токена.');
  }
  return token;
}

export async function loadProfile(
  provider: OAuthProvider,
  code: string,
  config: AppConfig,
  origin = config.publicApiOrigin,
): Promise<OAuthProfile> {
  if (provider === 'google') {
    const tokenPayload = await postForm(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: redirectUri(provider, config, origin),
        grant_type: 'authorization_code',
      }),
    );
    const accessToken = readAccessToken(tokenPayload);
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!profileResponse.ok) {
      throw new HttpError(502, 'oauth_profile', 'Не удалось получить профиль Google.');
    }
    const profile: unknown = await profileResponse.json();
    return readGoogleProfile(profile);
  }

  const tokenPayload = await postForm(
    'https://oauth.yandex.ru/token',
    new URLSearchParams({
      code,
      client_id: config.yandexClientId,
      client_secret: config.yandexClientSecret,
      grant_type: 'authorization_code',
    }),
  );
  const accessToken = readAccessToken(tokenPayload);
  const profileResponse = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!profileResponse.ok) {
    throw new HttpError(502, 'oauth_profile', 'Не удалось получить профиль Яндекса.');
  }
  const profile: unknown = await profileResponse.json();
  return readYandexProfile(profile);
}

function readGoogleProfile(profile: unknown): OAuthProfile {
  if (typeof profile !== 'object' || profile === null) {
    throw new HttpError(502, 'oauth_profile', 'Профиль Google пустой.');
  }
  const record = profile as Record<string, unknown>;
  const subject = record.sub;
  const email = record.email;
  const name = record.name;
  if (typeof subject !== 'string' || typeof email !== 'string') {
    throw new HttpError(502, 'oauth_profile', 'Google не передал почту.');
  }
  return {
    subject,
    email,
    name: typeof name === 'string' && name.trim() ? name : email,
  };
}

function readYandexProfile(profile: unknown): OAuthProfile {
  if (typeof profile !== 'object' || profile === null) {
    throw new HttpError(502, 'oauth_profile', 'Профиль Яндекса пустой.');
  }
  const record = profile as Record<string, unknown>;
  const subject = record.id;
  const email = record.default_email;
  const realName = record.real_name;
  const displayName = record.display_name;
  if (typeof subject !== 'string' || typeof email !== 'string') {
    throw new HttpError(502, 'oauth_profile', 'Яндекс не передал почту.');
  }
  const name =
    typeof realName === 'string' && realName.trim()
      ? realName
      : typeof displayName === 'string' && displayName.trim()
        ? displayName
        : email;
  return { subject, email, name };
}
