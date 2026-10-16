import { createPool, migrate } from './db';
import { logger } from './logger';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }
  const pool = createPool(databaseUrl);
  await migrate(pool);
  await pool.end();
  logger.info('schema ready');
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'migrate failed');
  process.exit(1);
});
