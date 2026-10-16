export function ensureApiPrefix(url: string | undefined): string {
  const value = url && url.length > 0 ? url : '/';
  const queryAt = value.indexOf('?');
  const pathname = queryAt === -1 ? value : value.slice(0, queryAt);
  const search = queryAt === -1 ? '' : value.slice(queryAt);
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return value;
  }
  const suffix = pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `/api${suffix}${search}`;
}
