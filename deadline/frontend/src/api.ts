export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

let onUnauthorized = (): void => {};

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function readCookie(name: string): string | null {
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const csrf = readCookie('deadline_csrf');
    if (csrf) {
      headers.set('x-csrf-token', csrf);
    }
  }

  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError(
      0,
      'network',
      'Не удалось связаться с сервером. Проверьте соединение и повторите.',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = payload as ErrorBody | null;
    const message = body?.error?.message ?? 'Запрос не выполнен.';
    if (response.status === 401 && path !== '/api/auth/login' && path !== '/api/auth/register') {
      onUnauthorized();
    }
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'request_failed',
      message,
      body?.error?.fields,
    );
  }

  return payload as T;
}

export function networkMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Не удалось связаться с сервером. Проверьте соединение и повторите.';
}
