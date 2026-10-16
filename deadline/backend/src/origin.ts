import type { Request } from 'express';
import type { AppConfig } from './config';

const HOST = /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/;

function firstHeader(value: string | undefined): string {
  return value?.split(',')[0]?.trim() ?? '';
}

function vercelHosts(): string[] {
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
  ].filter((host): host is string => Boolean(host));
}

export function requestOrigin(req: Request): string | null {
  const host = firstHeader(req.get('x-forwarded-host') || req.get('host') || undefined);
  if (!HOST.test(host)) {
    return null;
  }
  const proto = firstHeader(req.get('x-forwarded-proto') || undefined) || 'http';
  if (proto !== 'http' && proto !== 'https') {
    return null;
  }
  return `${proto}://${host}`;
}

export function originAllowed(origin: string, config: AppConfig): boolean {
  if (origin === config.frontendOrigin || origin === config.publicApiOrigin) {
    return true;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (!vercelHosts().includes(url.host)) {
    return false;
  }
  return url.protocol === 'https:';
}

export function siteOrigin(req: Request, config: AppConfig): string {
  const current = requestOrigin(req);
  if (current && originAllowed(current, config)) {
    return current;
  }
  return config.frontendOrigin;
}

export function oauthBase(req: Request, config: AppConfig): string {
  const current = requestOrigin(req);
  if (current && originAllowed(current, config)) {
    return current;
  }
  return config.publicApiOrigin;
}

export function secureCookie(config: AppConfig): boolean {
  if (process.env.VERCEL === '1') {
    return true;
  }
  return config.cookieSecure;
}
