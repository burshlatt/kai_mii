import { logger } from './logger';
import { readHealth } from './monitor';

function intervalMs(): number {
  const parsed = Number(process.env.HEALTH_INTERVAL_MS ?? 30000);
  if (!Number.isFinite(parsed) || parsed < 1000) {
    return 30000;
  }
  return parsed;
}

async function checkOnce(url: string): Promise<number> {
  const snapshot = await readHealth(url);
  if (snapshot.ok) {
    logger.info({ alert: false, url, ...snapshot }, 'health ok');
    return 0;
  }
  logger.error({ alert: true, url, ...snapshot }, 'health alert');
  return 1;
}

async function main(): Promise<void> {
  const url = process.env.HEALTH_URL ?? 'http://127.0.0.1:3001/api/health';
  if (process.argv.includes('--once')) {
    process.exit(await checkOnce(url));
  }
  for (;;) {
    await checkOnce(url);
    await new Promise((resolve) => setTimeout(resolve, intervalMs()));
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error, alert: true }, 'health monitor crashed');
  process.exit(1);
});
