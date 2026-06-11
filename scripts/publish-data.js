import fs from 'fs';
import path from 'path';
import { config, repoUrl } from './lib/config.js';
import { ensureDataFiles, dataPath } from './lib/storage.js';

const DATA_FILES = [
  'participants.json',
  'votes-history.json',
  'meta.json',
  'sync-report.json',
  'execution-journal.log',
];

function copyDataToPublic() {
  ensureDir(config.publicDataDir);
  for (const file of DATA_FILES) {
    const src = dataPath(file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(config.publicDataDir, file));
    }
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeSiteConfig() {
  ensureDir(config.publicJsDir);
  const siteConfig = {
    siteBaseUrl: config.siteBaseUrl,
    repoUrl: repoUrl(),
    afdListUrl: config.listUrl,
  };
  const outPath = path.join(config.publicJsDir, 'site-config.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(siteConfig, null, 2) + '\n',
    'utf8'
  );
}

export function publishSyncReport() {
  ensureDataFiles();
  ensureDir(config.publicDataDir);
  const src = dataPath('sync-report.json');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(config.publicDataDir, 'sync-report.json'));
  }
}

export function publishMeta() {
  ensureDataFiles();
  ensureDir(config.publicDataDir);
  const src = dataPath('meta.json');
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(config.publicDataDir, 'meta.json'));
  }
}

export function runPublish() {
  ensureDataFiles();
  copyDataToPublic();
  writeSiteConfig();
  console.log('Published data/ → public/data/ and site-config.json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPublish();
}
