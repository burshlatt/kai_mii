import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from './logger';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export function wrap(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    const level = error.status >= 500 ? 'error' : 'warn';
    logger[level]({ code: error.code, status: error.status, path: req.path }, error.message);
    res.status(error.status).json({
      error: { code: error.code, message: error.message, fields: error.fields },
    });
    return;
  }

  if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) {
        fields[key] = issue.message;
      }
    }
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Проверьте поля формы',
        fields,
      },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'invalid_json', message: 'Не удалось прочитать JSON' },
    });
    return;
  }

  logger.error({ err: error, path: req.path }, 'unhandled error');
  res.status(500).json({
    error: { code: 'internal_error', message: 'На сервере что-то сломалось. Попробуйте ещё раз.' },
  });
}
