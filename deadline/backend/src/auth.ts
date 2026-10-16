import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CookieOptions, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { AppConfig } from './config';
import { HttpError } from './http';

export const SESSION_COOKIE = 'deadline_session';
export const CSRF_COOKIE = 'deadline_csrf';
const SESSION_DAYS = 7;

const sessionSchema = z.object({
  sub: z.string().uuid(),
});

let dummyHash: string | undefined;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash('not-a-real-password', 12);
  }
  return bcrypt.compare(password, passwordHash ?? dummyHash);
}

export function signSession(userId: string, config: AppConfig): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
}

export function readSession(req: Request, config: AppConfig): string | null {
  const raw: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }
  try {
    const decoded: unknown = jwt.verify(raw, config.jwtSecret);
    const parsed = sessionSchema.safeParse(decoded);
    return parsed.success ? parsed.data.sub : null;
  } catch {
    return null;
  }
}

function baseCookie(config: AppConfig, secure = config.cookieSecure): CookieOptions {
  return {
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function setAuthCookies(
  res: Response,
  token: string,
  config: AppConfig,
  secure = config.cookieSecure,
): string {
  const csrf = crypto.randomBytes(32).toString('hex');
  res.cookie(SESSION_COOKIE, token, { ...baseCookie(config, secure), httpOnly: true });
  res.cookie(CSRF_COOKIE, csrf, { ...baseCookie(config, secure), httpOnly: false });
  return csrf;
}

export function clearAuthCookies(
  res: Response,
  config: AppConfig,
  secure = config.cookieSecure,
): void {
  const options = { ...baseCookie(config, secure), maxAge: 0 };
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

export function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function assertCsrf(req: Request): void {
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (typeof cookie !== 'string' || !header || !tokensMatch(cookie, header)) {
    throw new HttpError(403, 'csrf_failed', 'Запрос отклонён. Обновите страницу и повторите.');
  }
}
