import crypto from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Pool } from 'pg';
import {
  assertCsrf,
  clearAuthCookies,
  hashPassword,
  readSession,
  setAuthCookies,
  signSession,
  verifyPassword,
} from './auth';
import type { AppConfig } from './config';
import { getConfig } from './config';
import {
  assignmentPatchSchema,
  assignmentSchema,
  loginSchema,
  parseAssignmentQuery,
  registerSchema,
} from './domain';
import {
  deleteAssignment,
  findUserByEmail,
  findUserById,
  findUserByOAuth,
  getAssignment,
  insertAssignment,
  insertOAuthUser,
  insertUser,
  listAssignments,
  summarizeAssignments,
  updateAssignment,
} from './db';
import { errorMiddleware, HttpError, wrap } from './http';
import { logger } from './logger';
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  isOAuthProvider,
  issueState,
  loadProfile,
  providerConfigured,
  readState,
} from './oauth';

interface AuthedRequest extends Request {
  userId: string;
}

function userIdOf(req: Request): string {
  return (req as AuthedRequest).userId;
}

export function createApp(pool: Pool, config: AppConfig = getConfig()): express.Express {
  const app = express();

  function requireUser(req: Request, _res: Response, next: NextFunction): void {
    const userId = readSession(req, config);
    if (!userId) {
      next(new HttpError(401, 'unauthorized', 'Войдите, чтобы продолжить.'));
      return;
    }
    (req as AuthedRequest).userId = userId;
    next();
  }

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // HSTS belongs on the HTTPS proxy. On local HTTP it makes the browser skip the site.
      hsts: false,
    }),
  );
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    res.setHeader('x-request-id', requestId);
    res.on('finish', () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - started,
      });
    });
    next();
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'rate_limited', message: 'Слишком много попыток. Подождите и повторите.' },
    },
  });

  app.get(
    '/api/health',
    wrap(async (_req, res) => {
      try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'up', uptimeSeconds: Math.round(process.uptime()) });
      } catch (error) {
        logger.error({ err: error }, 'healthcheck failed');
        res.status(503).json({
          status: 'degraded',
          db: 'down',
          uptimeSeconds: Math.round(process.uptime()),
        });
      }
    }),
  );

  app.post(
    '/api/auth/register',
    authLimiter,
    wrap(async (req, res) => {
      const input = registerSchema.parse(req.body);
      const existing = await findUserByEmail(pool, input.email);
      if (existing) {
        throw new HttpError(409, 'email_taken', 'Такая почта уже зарегистрирована.');
      }
      const user = await insertUser(pool, {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      });
      setAuthCookies(res, signSession(user.id, config), config);
      res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
    }),
  );

  app.post(
    '/api/auth/login',
    authLimiter,
    wrap(async (req, res) => {
      const input = loginSchema.parse(req.body);
      const user = await findUserByEmail(pool, input.email);
      const matches = await verifyPassword(input.password, user?.passwordHash ?? null);
      if (!user || !user.passwordHash || !matches) {
        throw new HttpError(401, 'invalid_credentials', 'Неверная почта или пароль.');
      }
      setAuthCookies(res, signSession(user.id, config), config);
      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    }),
  );

  app.post(
    '/api/auth/logout',
    wrap(async (req, res) => {
      assertCsrf(req);
      clearAuthCookies(res, config);
      res.status(204).end();
    }),
  );

  app.get(
    '/api/auth/me',
    wrap(async (req, res) => {
      const userId = readSession(req, config);
      if (!userId) {
        throw new HttpError(401, 'unauthorized', 'Войдите, чтобы продолжить.');
      }
      const user = await findUserById(pool, userId);
      if (!user) {
        clearAuthCookies(res, config);
        throw new HttpError(401, 'unauthorized', 'Войдите, чтобы продолжить.');
      }
      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    }),
  );

  app.get('/api/auth/oauth/:provider/start', (req, res, next) => {
    const provider = req.params.provider;
    if (!isOAuthProvider(provider)) {
      next(new HttpError(404, 'not_found', 'Провайдер не поддерживается.'));
      return;
    }
    if (!providerConfigured(provider, config)) {
      res.redirect(`${config.frontendOrigin}/login?error=oauth_unavailable`);
      return;
    }
    const state = issueState(res, config);
    res.redirect(buildAuthorizeUrl(provider, state, config));
  });

  app.get(
    '/api/auth/oauth/:provider/callback',
    wrap(async (req, res) => {
      const provider = req.params.provider;
      if (!isOAuthProvider(provider)) {
        throw new HttpError(404, 'not_found', 'Провайдер не поддерживается.');
      }
      const fail = (code: string): void => {
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
        res.redirect(`${config.frontendOrigin}/login?error=${code}`);
      };
      if (!providerConfigured(provider, config)) {
        fail('oauth_unavailable');
        return;
      }
      if (typeof req.query.error === 'string') {
        fail('oauth_denied');
        return;
      }
      try {
        readState(req, req.query.state);
      } catch {
        fail('oauth_failed');
        return;
      }
      const code = req.query.code;
      if (typeof code !== 'string' || code.length === 0) {
        fail('oauth_failed');
        return;
      }
      try {
        const profile = await loadProfile(provider, code, config);
        const linked = await findUserByOAuth(pool, provider, profile.subject);
        let user = linked;
        if (!user) {
          const byEmail = await findUserByEmail(pool, profile.email);
          if (byEmail) {
            fail('oauth_email_taken');
            return;
          }
          user = await insertOAuthUser(pool, {
            email: profile.email,
            name: profile.name,
            provider,
            subject: profile.subject,
          });
        }
        setAuthCookies(res, signSession(user.id, config), config);
        res.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
        res.redirect(`${config.frontendOrigin}/`);
      } catch (error) {
        logger.warn({ err: error, provider }, 'oauth callback failed');
        fail('oauth_failed');
      }
    }),
  );

  app.get(
    '/api/assignments/summary',
    requireUser,
    wrap(async (req, res) => {
      const summary = await summarizeAssignments(pool, userIdOf(req));
      res.json({ summary });
    }),
  );

  app.get(
    '/api/assignments',
    requireUser,
    wrap(async (req, res) => {
      const query = parseAssignmentQuery(req.query as Record<string, unknown>);
      const assignments = await listAssignments(pool, userIdOf(req), query);
      res.json({ assignments });
    }),
  );

  app.post(
    '/api/assignments',
    requireUser,
    wrap(async (req, res) => {
      assertCsrf(req);
      const input = assignmentSchema.parse(req.body);
      const assignment = await insertAssignment(pool, userIdOf(req), input);
      res.status(201).json({ assignment });
    }),
  );

  app.get(
    '/api/assignments/:id',
    requireUser,
    wrap(async (req, res) => {
      const assignment = await getAssignment(pool, userIdOf(req), req.params.id);
      if (!assignment) {
        throw new HttpError(404, 'not_found', 'Задание не найдено.');
      }
      res.json({ assignment });
    }),
  );

  app.patch(
    '/api/assignments/:id',
    requireUser,
    wrap(async (req, res) => {
      assertCsrf(req);
      const patch = assignmentPatchSchema.parse(req.body);
      const assignment = await updateAssignment(pool, userIdOf(req), req.params.id, patch);
      if (!assignment) {
        throw new HttpError(404, 'not_found', 'Задание не найдено.');
      }
      res.json({ assignment });
    }),
  );

  app.delete(
    '/api/assignments/:id',
    requireUser,
    wrap(async (req, res) => {
      assertCsrf(req);
      const removed = await deleteAssignment(pool, userIdOf(req), req.params.id);
      if (!removed) {
        throw new HttpError(404, 'not_found', 'Задание не найдено.');
      }
      res.status(204).end();
    }),
  );

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Маршрут не найден' } });
  });
  app.use(errorMiddleware);
  return app;
}
