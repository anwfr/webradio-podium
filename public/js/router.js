import { normalizePathname } from './paths.js';

const LEGACY_PARAM = 'etablissement';
const LEGACY_PODCAST_PARAM = 'podcast';
const LEGACY_SHARE_PARAM = 'partage';

const ESTABLISHMENT_PATH_RE = /^(.*)\/etablissement\/[^/]+$/;
const SHARE_ID_PATH_RE = /^(.*)\/(\d+)\/?$/;

export function getBasePath() {
  const path = normalizePathname();
  const establishmentMatch = path.match(ESTABLISHMENT_PATH_RE);
  if (establishmentMatch) return establishmentMatch[1];
  const shareMatch = path.match(SHARE_ID_PATH_RE);
  if (shareMatch) return shareMatch[1];
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

export function parseShareIdFromUrl(pathname = normalizePathname()) {
  const match = pathname.match(/\/(\d+)\/?$/);
  if (!match) return null;
  const shareId = Number(match[1]);
  if (!Number.isInteger(shareId) || shareId <= 0) return null;
  return shareId;
}

export function buildPodcastShareUrl(shareId) {
  const base = getBasePath();
  const path = base ? `${base}/${shareId}` : `/${shareId}`;
  return `${location.origin}${path}`;
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
  params.delete(LEGACY_PODCAST_PARAM);
  params.delete(LEGACY_SHARE_PARAM);
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
