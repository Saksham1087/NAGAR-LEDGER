export function normalizeRoutePath(pathname: string): string {
  if (!pathname) return '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function stripBasePath(pathname: string, baseUrl = '/'): string {
  const normalizedBase =
    baseUrl === '/' ? '/' : `/${baseUrl.replace(/^\/+|\/+$/g, '')}`;

  const cleanPath = normalizeRoutePath(pathname);

  if (normalizedBase === '/') {
    return cleanPath;
  }

  if (cleanPath === normalizedBase) {
    return '/';
  }

  if (cleanPath.startsWith(`${normalizedBase}/`)) {
    return normalizeRoutePath(cleanPath.slice(normalizedBase.length));
  }

  return cleanPath;
}

export function withBasePath(appPath: string, baseUrl = '/'): string {
  const normalizedBase =
    baseUrl === '/' ? '/' : `/${baseUrl.replace(/^\/+|\/+$/g, '')}/`;
  const trimmedAppPath = appPath.startsWith('/') ? appPath.slice(1) : appPath;

  if (normalizedBase === '/') {
    return `/${trimmedAppPath}`;
  }

  if (!trimmedAppPath) {
    return normalizedBase;
  }

  return `${normalizedBase}${trimmedAppPath}`;
}
