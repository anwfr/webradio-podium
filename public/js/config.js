import { resolveFromBase } from './paths.js';

export async function loadSiteConfig() {
  try {
    const res = await fetch(resolveFromBase('js/site-config.json'));
    if (res.ok) return await res.json();
  } catch {
    /* local dev without publish */
  }
  const fallback = await fetch(resolveFromBase('js/site-config.defaults.json')).then((r) =>
    r.json()
  );
  return fallback;
}
