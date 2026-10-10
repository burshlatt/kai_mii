import { createApp } from './app';
import { getConfig } from './config';
import { createPool, migrate } from './db';
import { logger } from './logger';

async function main(): Promise<void> {
  const config = getConfig();
  const pool = createPool(config.databaseUrl);
  await migrate(pool);
  const app = createApp(pool, config);
  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'api listening');
  });
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'failed to start');
  process.exit(1);
});
