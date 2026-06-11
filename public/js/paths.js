export function getAppBase() {
  if (typeof window !== 'undefined' && window.__APP_BASE__) {
    return String(window.__APP_BASE__).replace(/\/?$/, '/');
  }
  return '/';
}

export function resolveFromBase(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return `${getAppBase()}${normalized}`;
}

export function normalizePathname(pathname = location.pathname) {
  return pathname.replace(/\/index\.html$/, '').replace(/\/404\.html$/, '');
}
