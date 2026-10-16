import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../deadline/backend/src/app';
import { getConfig } from '../deadline/backend/src/config';
import { getSharedPool, migrate } from '../deadline/backend/src/db';
import { logger } from '../deadline/backend/src/logger';
import { requestUrlForApi } from '../deadline/backend/src/request-url';

type AppHandler = (req: IncomingMessage, res: ServerResponse) => void;

let starting: Promise<AppHandler> | undefined;

function ready(): Promise<AppHandler> {
  if (!starting) {
    starting = boot().catch((error: unknown) => {
      starting = undefined;
      throw error;
    });
  }
  return starting;
}

async function boot(): Promise<AppHandler> {
  const config = getConfig();
  const pool = getSharedPool(config.databaseUrl);
  await migrate(pool);
  return createApp(pool, config) as unknown as AppHandler;
}

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  req.url = requestUrlForApi(req.url);
  ready()
    .then((app) => {
      app(req, res);
    })
    .catch((error: unknown) => {
      logger.error({ err: error }, 'failed to start');
      if (res.headersSent) {
        return;
      }
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: {
            code: 'startup_failed',
            message: 'Сервис не запустился. Проверьте DATABASE_URL и JWT_SECRET.',
          },
        }),
      );
    });
}
