import { normalizePathname } from './paths.js';

const ESTABLISHMENT_SEGMENT = 'etablissement';
const LEGACY_PARAM = 'etablissement';

export function getBasePath() {
  const path = normalizePathname();
  const match = path.match(/^(.*)\/etablissement\/[^/]+$/);
  if (match) return match[1];
  if (path === '' || path === '/') return '';
  return path.replace(/\/$/, '');
}

export function parseRoute() {
  const path = normalizePathname();
  const match = path.match(/\/etablissement\/([^/]+)\/?$/);
  if (match) {
    return { mode: 'establishment', key: decodeURIComponent(match[1]) };
  }
  return { mode: 'global' };
}

export function buildGlobalUrl() {
  const base = getBasePath();
  if (!base) return `${location.origin}/`;
  return `${location.origin}${base}/`;
}

function globalUrlWithCurrentSearch() {
  const url = new URL(buildGlobalUrl());
  const params = new URLSearchParams(location.search);
  params.delete(LEGACY_PARAM);
  const query = params.toString();
  if (query) url.search = query;
  return url.toString();
}

export function redirectLegacyEstablishmentUrl() {
  const params = new URLSearchParams(location.search);
  const key = params.get(LEGACY_PARAM);
  if (!key || parseRoute().mode === 'establishment') return;
  location.replace(globalUrlWithCurrentSearch());
}

export function redirectEstablishmentUrl() {
  if (parseRoute().mode !== 'establishment') return false;
  location.replace(globalUrlWithCurrentSearch());
  return true;
}
