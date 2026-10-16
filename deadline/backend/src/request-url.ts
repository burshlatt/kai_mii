export function requestUrlForApi(url: string | undefined): string {
  const value = url && url.length > 0 ? url : '/';
  const queryAt = value.indexOf('?');
  const pathname = queryAt === -1 ? value : value.slice(0, queryAt);
  const search = new URLSearchParams(queryAt === -1 ? '' : value.slice(queryAt + 1));
  const forwarded = search.get('__vercel_path');
  if ((pathname === '/api' || pathname === '/api/') && forwarded) {
    search.delete('__vercel_path');
    if (search.get('path') === forwarded) {
      search.delete('path');
    }
    const rest = search.toString();
    return `/api/${forwarded.replace(/^\/+/, '')}${rest ? `?${rest}` : ''}`;
  }
  return ensureApiPrefix(value);
}

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
