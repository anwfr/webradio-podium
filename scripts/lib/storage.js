import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import {
  BACKUP_RETENTION_DAYS,
  SYNC_REPORT_BACKUP_DAYS,
} from './constants.js';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJson(filePath, defaultValue = null) {
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function writeJson(filePath, data) {
  _writeJson(filePath, data);
}

function _writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

export function backupFile(filePath, prefix) {
  if (!fs.existsSync(filePath)) return;
  const backupsDir = path.join(config.dataDir, 'backups');
  ensureDir(backupsDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const dest = path.join(backupsDir, `${prefix}-${stamp}.json`);
  fs.copyFileSync(filePath, dest);
  purgeOldBackups(backupsDir, prefix, BACKUP_RETENTION_DAYS);
}

export function backupSyncReport() {
  const src = path.join(config.dataDir, 'sync-report.json');
  if (!fs.existsSync(src)) return;
  const backupsDir = path.join(config.dataDir, 'backups');
  ensureDir(backupsDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  fs.copyFileSync(src, path.join(backupsDir, `sync-report-${stamp}.json`));
  purgeOldBackups(backupsDir, 'sync-report', SYNC_REPORT_BACKUP_DAYS);
}

function purgeOldBackups(backupsDir, prefix, maxDays) {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupsDir).filter((f) => f.startsWith(prefix));
  for (const file of files) {
    const full = path.join(backupsDir, file);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(full);
    }
  }
}

export const emptyParticipants = () => ({
  updatedAt: null,
  participants: [],
});

export const emptyVotesHistory = () => ({ snapshots: [] });

export const emptyMeta = () => ({
  lastRunAt: null,
  lastRunStatus: null,
  lastRunDurationMs: 0,
  trigger: null,
  snapshotTimestamp: null,
  counts: {
    participantsActive: 0,
    participantsTotal: 0,
    snapshotsTotal: 0,
    scrapeErrors: 0,
    newParticipants: 0,
  },
  errors: [],
});

export const emptySyncReport = () => ({
  status: 'none',
  runAt: null,
  durationMs: 0,
  trigger: null,
  summary: {
    votesOpened: 0,
    votesClosed: 0,
    newlyDiscovered: 0,
    statusChanged: 0,
    metadataUpdated: 0,
    unchanged: 0,
    errors: 0,
  },
  changes: {
    votesOpened: [],
    votesClosed: [],
    newlyDiscovered: [],
    statusChanged: [],
    metadataUpdated: [],
    unchanged: 0,
  },
  errors: [],
});

export function dataPath(name) {
  return path.join(config.dataDir, name);
}

export function loadParticipants() {
  return readJson(dataPath('participants.json'), emptyParticipants());
}

export function loadVotesHistory() {
  return readJson(dataPath('votes-history.json'), emptyVotesHistory());
}

export function saveParticipants(data) {
  backupFile(dataPath('participants.json'), 'participants');
  writeJson(dataPath('participants.json'), data);
}

export function saveVotesHistory(data) {
  backupFile(dataPath('votes-history.json'), 'votes-history');
  writeJson(dataPath('votes-history.json'), data);
}

export function saveMeta(data) {
  writeJson(dataPath('meta.json'), data);
}

export function saveSyncReport(data, { backup = true } = {}) {
  if (backup) backupSyncReport();
  writeJson(dataPath('sync-report.json'), data);
}

export function ensureDataFiles() {
  ensureDir(config.dataDir);
  ensureDir(path.join(config.dataDir, 'backups'));
  if (!fs.existsSync(dataPath('participants.json'))) {
    _writeJson(dataPath('participants.json'), emptyParticipants());
  }
  if (!fs.existsSync(dataPath('votes-history.json'))) {
    writeJson(dataPath('votes-history.json'), emptyVotesHistory());
  }
  if (!fs.existsSync(dataPath('meta.json'))) {
    writeJson(dataPath('meta.json'), emptyMeta());
  }
  if (!fs.existsSync(dataPath('sync-report.json'))) {
    writeJson(dataPath('sync-report.json'), emptySyncReport());
  }
  if (
    !fs.existsSync(dataPath('execution-journal.log')) &&
    !fs.existsSync(dataPath('execution-journal.json'))
  ) {
    ensureDir(config.dataDir);
    fs.writeFileSync(dataPath('execution-journal.log'), '', 'utf8');
  }
}

/**
 * Supprime entièrement data/ et public/data/ (dev local).
 * Les fichiers JSON sont recréés vides au prochain run d'un pipeline (`ensureDataFiles`).
 */
export function resetAllData() {
  if (fs.existsSync(config.dataDir)) {
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  }
  if (fs.existsSync(config.publicDataDir)) {
    fs.rmSync(config.publicDataDir, { recursive: true, force: true });
  }
}
