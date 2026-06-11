import { CookieJar } from 'tough-cookie';
import { config } from './config.js';
import { logHttpRequest } from './journal.js';
import {
  HTTP_RETRY_BACKOFF_BASE_MS,
  HTTP_RETRY_BACKOFF_JITTER_MS,
  RATE_LIMIT_COOLDOWN_MS,
} from './constants.js';

let sessionUserAgent = null;
let cookieJar = new CookieJar();
let lastReferer = config.afdBaseUrl;

function pickUserAgent() {
  const idx = Math.floor(Math.random() * config.userAgents.length);
  return config.userAgents[idx];
}

function uaLabel(ua) {
  const m = ua.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/);
  return m ? m[0] : 'navigateur';
}

export function initSession() {
  sessionUserAgent = pickUserAgent();
  cookieJar = new CookieJar();
  lastReferer = config.afdBaseUrl;
  console.log(
    `[http] Session scraping — UA cohérent (${uaLabel(sessionUserAgent)}), cookies persistants, requêtes séquentielles`
  );
}

export function getLastReferer() {
  return lastReferer;
}

export function randomDelay(minMs, maxMs) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function rateLimitCooldown(reason = 'rate-limit') {
  const min = RATE_LIMIT_COOLDOWN_MS.min;
  const max = RATE_LIMIT_COOLDOWN_MS.max;
  const ms = min + Math.random() * (max - min);
  console.log(
    `[http] Pause courtoise (${reason}) — ${Math.round(ms / 1000)}s avant la suite…`
  );
  await randomDelay(min, max);
}

async function getCookieHeader(url) {
  return (await cookieJar.getCookieString(url)) || '';
}

async function storeCookies(url, response) {
  const setCookie = response.headers.getSetCookie?.() || [];
  for (const cookie of setCookie) {
    await cookieJar.setCookie(cookie, url);
  }
}

function retryBackoff(attempt) {
  const base = HTTP_RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
  return randomDelay(base, base + HTTP_RETRY_BACKOFF_JITTER_MS);
}

function logAttempt(url, attempt, startMs, result) {
  logHttpRequest({
    method: 'GET',
    url,
    status: result.status ?? null,
    durationMs: Date.now() - startMs,
    attempt,
    ok: result.ok,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  });
}

export async function fetchPage(url, options = {}) {
  const { referer = lastReferer, retries = 3 } = options;
  if (!sessionUserAgent) initSession();

  let attempt = 0;
  while (attempt < retries) {
    const attemptNum = attempt + 1;
    const startMs = Date.now();

    try {
      const cookieHeader = await getCookieHeader(url);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        config.httpTimeoutMs
      );

      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': sessionUserAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Referer: referer,
          Connection: 'keep-alive',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          DNT: '1',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      });

      clearTimeout(timeout);
      await storeCookies(url, response);

      const willRetry =
        response.status === 429 || response.status === 503;
      const ok = response.ok && !willRetry;

      logAttempt(url, attemptNum, startMs, {
        status: response.status,
        ok,
      });

      if (willRetry) {
        await retryBackoff(attempt);
        attempt++;
        continue;
      }

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status} for ${url}`);
        err.status = response.status;
        throw err;
      }

      lastReferer = url;
      const html = await response.text();
      return html;
    } catch (err) {
      const isLastAttempt = attempt >= retries - 1;

      logAttempt(url, attemptNum, startMs, {
        ok: false,
        status: err.status ?? null,
        errorCode:
          err.name === 'AbortError'
            ? 'timeout'
            : err.status
              ? `http_${err.status}`
              : err.name,
        errorMessage: err.message,
      });

      attempt++;
      if (isLastAttempt) throw err;
      await retryBackoff(attempt - 1);
    }
  }
  throw new Error(`Failed to fetch ${url}`);
}
