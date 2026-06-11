import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  JOURNAL_RETENTION_DAYS,
  JOURNAL_MAX_STRING_LENGTH,
  JOURNAL_MAX_ERRORS_PER_EVENT,
} from './constants.js';
import { dataPath, readJson } from './storage.js';
import {
  formatParisLogTimestamp,
  nowParis,
  parseParisLogTimestamp,
} from './time.js';

export const JOURNAL_FILE = 'execution-journal.log';
const LEGACY_JOURNAL_FILE = 'execution-journal.json';

const LOG_TS_RE = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/;

const SENSITIVE_KEY_RE =
  /^(password|passwd|secret|token|cookie|cookies|authorization|api[_-]?key|private[_-]?key|credential|auth)$/i;
const SENSITIVE_VALUE_RE =
  /(Bearer\s+\S+|ghp_[a-zA-Z0-9_]+|github_pat_[a-zA-Z0-9_]+|x-access-token:\s*\S+|Basic\s+\S+)/i;

let currentRunId = null;
let currentPipeline = null;
let appendCountSincePurge = 0;

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

function journalPath() {
  return dataPath(JOURNAL_FILE);
}

function retentionCutoffMs() {
  return Date.now() - JOURNAL_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

function formatOutputCompact(value) {
  if (value == null) return '';
  if (typeof value !== 'object') {
    return ` ${String(value).replace(/\s+/g, ' ')}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (value.every((item) => item && typeof item === 'object' && 'slug' in item)) {
      const summary = value
        .slice(0, JOURNAL_MAX_ERRORS_PER_EVENT)
        .map((item) => `${item.slug}:${item.code || '?'}`)
        .join(',');
      const suffix = value.length > JOURNAL_MAX_ERRORS_PER_EVENT ? ',…' : '';
      return ` errors=${summary}${suffix}`;
    }
    return ` [${value.length}]`;
  }

  const parts = [];
  for (const [key, val] of Object.entries(value)) {
    if (val == null || val === '') continue;
    if (typeof val === 'object') {
      const nested = formatOutputCompact(val).trim();
      if (nested) parts.push(`${key}=${nested}`);
    } else {
      parts.push(`${key}=${String(val).replace(/\s+/g, ' ')}`);
    }
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

export function formatLogLine({
  at,
  pipeline,
  level = 'info',
  event,
  step,
  message,
  output,
  includeOutput = true,
}) {
  const ts = at || formatParisLogTimestamp(nowParis());
  const evt = step ? `${event}/${step}` : event;
  const extras =
    includeOutput && output != null
      ? formatOutputCompact(sanitizeForJournal(output))
      : '';
  return `${ts} [${pipeline}] ${level.toUpperCase()} ${evt} ${message}${extras}`;
}

function readLogLines() {
  const fp = journalPath();
  if (!fs.existsSync(fp)) return [];
  return fs
    .readFileSync(fp, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

function writeLogLines(lines) {
  const fp = journalPath();
  ensureDir(path.dirname(fp));
  const body = lines.length ? `${lines.join('\n')}\n` : '';
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, fp);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function purgeLogLines(lines) {
  const cutoff = retentionCutoffMs();
  return lines.filter((line) => {
    const match = line.match(LOG_TS_RE);
    if (!match) return true;
    const t = parseParisLogTimestamp(match[1]);
    return !Number.isNaN(t) && t >= cutoff;
  });
}

function appendLogLine(line) {
  ensureJournalFile();
  fs.appendFileSync(journalPath(), `${line}\n`, 'utf8');
  appendCountSincePurge += 1;
  if (appendCountSincePurge >= 100) {
    purgeJournal();
    appendCountSincePurge = 0;
  }
}

function appendEntry(partial) {
  const line = formatLogLine({
    pipeline: partial.pipeline ?? currentPipeline,
    level: partial.level ?? 'info',
    event: partial.event,
    step: partial.step,
    message: partial.message,
    output: partial.output,
    includeOutput: partial.event !== 'http_request',
  });
  appendLogLine(line);
  return { at: line.slice(0, 19), ...partial };
}

function migrateLegacyJsonJournal() {
  const logPath = journalPath();
  const jsonPath = dataPath(LEGACY_JOURNAL_FILE);
  if (fs.existsSync(logPath) || !fs.existsSync(jsonPath)) return;

  let journal;
  try {
    journal = readJson(jsonPath, null);
  } catch {
    return;
  }

  const entries = journal?.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    writeLogLines([]);
    return;
  }

  const lines = entries.map((entry) => {
    const at = entry.at
      ? entry.at.replace('T', ' ').slice(0, 19)
      : formatParisLogTimestamp(nowParis());
    return formatLogLine({
      at,
      pipeline: entry.pipeline || 'unknown',
      level: entry.level || 'info',
      event: entry.event || 'event',
      step: entry.step,
      message: entry.message || '',
      output: entry.output,
      includeOutput: entry.event !== 'http_request',
    });
  });

  writeLogLines(purgeLogLines(lines));
}

export function ensureJournalFile() {
  migrateLegacyJsonJournal();
  if (!fs.existsSync(journalPath())) {
    writeLogLines([]);
  }
}

export function startRun(pipeline, trigger, meta = {}) {
  purgeJournal();
  appendCountSincePurge = 0;
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
  purgeJournal();
  appendCountSincePurge = 0;
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
  });
}

export function purgeJournal() {
  const lines = readLogLines();
  const before = lines.length;
  const kept = purgeLogLines(lines);
  writeLogLines(kept);
  return { removed: before - kept.length, kept: kept.length };
}
