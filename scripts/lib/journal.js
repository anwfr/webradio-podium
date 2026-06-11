import { randomUUID } from 'crypto';
import {
  JOURNAL_RETENTION_DAYS,
  JOURNAL_MAX_STRING_LENGTH,
  JOURNAL_MAX_ERRORS_PER_EVENT,
} from './constants.js';
import { dataPath, readJson, writeJson } from './storage.js';
import { formatParisIso, nowParis } from './time.js';

const JOURNAL_FILE = 'execution-journal.json';

const SENSITIVE_KEY_RE =
  /^(password|passwd|secret|token|cookie|cookies|authorization|api[_-]?key|private[_-]?key|credential|auth)$/i;
const SENSITIVE_VALUE_RE =
  /(Bearer\s+\S+|ghp_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+|x-access-token:\s*\S+|Basic\s+\S+)/i;

let currentRunId = null;
let currentPipeline = null;

export function emptyJournal() {
  return {
    retentionDays: JOURNAL_RETENTION_DAYS,
    updatedAt: null,
    entries: [],
  };
}

export function sanitizeForJournal(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    if (SENSITIVE_VALUE_RE.test(value)) return '[redacted]';
    if (value.length > JOURNAL_MAX_STRING_LENGTH) {
      return value.slice(0, JOURNAL_MAX_STRING_LENGTH) + '…';
    }
    return value;
  }

  if (Array.isArray(value)) {
    const slice = value.slice(0, 50);
    return slice.map((item) => sanitizeForJournal(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = sanitizeForJournal(val, depth + 1);
      }
    }
    return out;
  }

  return String(value);
}

function purgeEntries(entries) {
  const cutoff =
    Date.now() - JOURNAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    const t = Date.parse(entry.at);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

function loadJournal() {
  return readJson(dataPath(JOURNAL_FILE), emptyJournal());
}

function saveJournal(journal) {
  journal.entries = purgeEntries(journal.entries || []);
  journal.retentionDays = JOURNAL_RETENTION_DAYS;
  journal.updatedAt = formatParisIso(nowParis());
  writeJson(dataPath(JOURNAL_FILE), journal);
}

function appendEntry(partial) {
  const journal = loadJournal();
  const entry = {
    id: randomUUID(),
    runId: currentRunId,
    at: formatParisIso(nowParis()),
    pipeline: partial.pipeline ?? currentPipeline,
    ...partial,
  };
  if (entry.output !== undefined) {
    entry.output = sanitizeForJournal(entry.output);
  }
  journal.entries.push(entry);
  saveJournal(journal);
  return entry;
}

export function startRun(pipeline, trigger, meta = {}) {
  currentRunId = randomUUID();
  currentPipeline = pipeline;
  return appendEntry({
    pipeline,
    event: 'start',
    level: 'info',
    message: `Démarrage — ${trigger}`,
    output: { trigger, ...meta },
  });
}

export function logEvent(
  pipeline,
  event,
  message,
  { step, level = 'info', output } = {}
) {
  return appendEntry({
    pipeline,
    step,
    event,
    level,
    message,
    output,
  });
}

export function logStepComplete(pipeline, step, message, output) {
  return logEvent(pipeline, 'step_complete', message, {
    step,
    level: 'info',
    output,
  });
}

export function logStepError(pipeline, step, message, output) {
  const sanitized = output ? sanitizeForJournal(output) : undefined;
  if (sanitized?.errors?.length > JOURNAL_MAX_ERRORS_PER_EVENT) {
    sanitized.errors = sanitized.errors.slice(0, JOURNAL_MAX_ERRORS_PER_EVENT);
    sanitized.errorsTruncated = true;
  }
  return logEvent(pipeline, 'step_error', message, {
    step,
    level: 'error',
    output: sanitized,
  });
}

export function endRun(pipeline, status, message, output) {
  const level = status === 'success' ? 'info' : 'error';
  const event = status === 'success' ? 'complete' : 'fail';
  const entry = appendEntry({
    pipeline,
    event,
    level,
    message,
    output,
  });
  currentRunId = null;
  currentPipeline = null;
  return entry;
}

export function isRunActive() {
  return currentRunId !== null;
}

const SENSITIVE_URL_PARAM_RE =
  /^(token|key|secret|password|auth|access[_-]?token|api[_-]?key)$/i;

/** Retire les paramètres sensibles des URLs avant journal / console. */
export function sanitizeUrl(url) {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (SENSITIVE_URL_PARAM_RE.test(key)) {
        u.searchParams.set(key, '[redacted]');
      }
    }
    const safe = u.toString();
    if (safe.length > JOURNAL_MAX_STRING_LENGTH) {
      return safe.slice(0, JOURNAL_MAX_STRING_LENGTH) + '…';
    }
    return safe;
  } catch {
    const str = String(url);
    if (str.length > JOURNAL_MAX_STRING_LENGTH) {
      return str.slice(0, JOURNAL_MAX_STRING_LENGTH) + '…';
    }
    return str;
  }
}

/**
 * Log chaque requête HTTP sortante (console + journal public).
 * Ne journalise jamais cookies, tokens ni corps de requête.
 */
export function logHttpRequest({
  method = 'GET',
  url,
  status = null,
  durationMs,
  attempt = 1,
  ok = true,
  errorCode = null,
  errorMessage = null,
}) {
  const safeUrl = sanitizeUrl(url);
  const pipeline = currentPipeline || 'http';
  const duration = Math.round(durationMs);

  let message;
  let level = 'info';

  if (ok && status != null) {
    message = `${method} ${safeUrl} → ${status} (${duration}ms)`;
    if (status === 429 || status === 503) {
      level = 'warn';
      message += ` — nouvelle tentative prévue`;
    }
  } else {
    level = 'error';
    const detail = errorCode || errorMessage || 'échec';
    message = `${method} ${safeUrl} → ${detail} (${duration}ms, tentative ${attempt})`;
  }

  console.log(`[http] ${message}`);

  return logEvent(pipeline, 'http_request', message, {
    step: 'fetch',
    level,
    output: {
      method,
      url: safeUrl,
      status,
      durationMs: duration,
      attempt,
      ok,
      errorCode,
      errorMessage: errorMessage
        ? sanitizeForJournal(errorMessage)
        : undefined,
    },
  });
}

export function purgeJournal() {
  const journal = loadJournal();
  const before = journal.entries.length;
  journal.entries = purgeEntries(journal.entries);
  saveJournal(journal);
  return { removed: before - journal.entries.length, kept: journal.entries.length };
}
