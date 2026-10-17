import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  jwtSecret: string;
  frontendOrigin: string;
  publicApiOrigin: string;
  cookieSecure: boolean;
  googleClientId: string;
  googleClientSecret: string;
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) {
    return cached;
  }

  const jwtSecret = process.env.JWT_SECRET ?? '';
  const databaseUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || '';
  if (jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set and at least 16 characters');
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  cached = {
    port: Number(process.env.PORT ?? 3001),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    databaseUrl,
    jwtSecret,
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    publicApiOrigin: process.env.PUBLIC_API_ORIGIN ?? 'http://localhost:5173',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  };
  return cached;
}

export function resetConfigCache(): void {
  cached = undefined;
}
