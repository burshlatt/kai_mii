export interface HealthSnapshot {
  ok: boolean;
  status: number | null;
  db: string | null;
  reason: string;
}

function readDb(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('db' in body)) {
    return null;
  }
  const db = body.db;
  return typeof db === 'string' ? db : null;
}

export async function readHealth(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthSnapshot> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    const body: unknown = await response.json().catch(() => null);
    const db = readDb(body);
    if (response.ok && db === 'up') {
      return { ok: true, status: response.status, db, reason: 'ok' };
    }
    return {
      ok: false,
      status: response.status,
      db,
      reason: response.ok ? 'db_down' : 'http_error',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'network';
    return { ok: false, status: null, db: null, reason };
  }
}
