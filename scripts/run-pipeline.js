import { runScrapeVotes } from './scrape-votes.js';
import { runDetectAlerts } from './detect-alerts.js';
import { runPublish, publishMeta } from './publish-data.js';
import { saveMeta, ensureDataFiles, loadParticipants, loadVotesHistory } from './lib/storage.js';
import { formatParisIso, getSnapshotTimestamp, nowParis } from './lib/time.js';
import { RunProgress } from './lib/progress.js';
import { RUN_PROGRESS_PUBLISH_EVERY } from './lib/constants.js';
import {
  startRun,
  logStepComplete,
  logStepError,
  endRun,
  isRunActive,
  sanitizeForJournal,
} from './lib/journal.js';

const PIPELINE = 'pipeline-a';
const trigger = process.env.PIPELINE_TRIGGER || 'local';

function shouldPublishProgress(snapshot) {
  return (
    snapshot.current % RUN_PROGRESS_PUBLISH_EVERY === 0 ||
    snapshot.current === snapshot.total
  );
}

async function main() {
  ensureDataFiles();
  const start = Date.now();
  const snapshotTs = formatParisIso(getSnapshotTimestamp());
  const errors = [];

  startRun(PIPELINE, trigger, { snapshotTimestamp: snapshotTs });

  let runningMeta = {
    lastRunAt: null,
    lastRunStatus: 'running',
    lastRunDurationMs: 0,
    trigger,
    snapshotTimestamp: snapshotTs,
    counts: {
      participantsActive: 0,
      participantsTotal: 0,
      snapshotsTotal: 0,
      scrapeErrors: 0,
      newParticipants: 0,
    },
    errors: [],
    progress: null,
  };
  saveMeta(runningMeta);
  publishMeta();

  const progress = new RunProgress({
    logPrefix: 'pipeline',
    onUpdate: (snapshot) => {
      runningMeta = {
        ...runningMeta,
        progress: snapshot,
      };
      if (shouldPublishProgress(snapshot)) {
        saveMeta(runningMeta);
        publishMeta();
      }
    },
  });

  let scrapeResult = { errors: [], scrapeErrors: 0, entriesCount: 0 };
  let detectResult = { alertCount: 0 };

  try {
    const activeCount = loadParticipants().participants.filter((p) => p.active).length;
    console.log(
      `[pipeline] Collecte des votes — snapshot ${snapshotTs} · ${activeCount} fiche(s) active(s)`
    );
    scrapeResult = await runScrapeVotes(snapshotTs, { progress });
    errors.push(...(scrapeResult.errors || []));
    const scrapeMsg = `Scrape terminé — ${scrapeResult.entriesCount} entrée(s)`;
    logStepComplete(PIPELINE, 'scrape-votes', scrapeMsg, {
      snapshotTimestamp: scrapeResult.snapshotTimestamp,
      entriesCount: scrapeResult.entriesCount,
      scrapeErrors: scrapeResult.scrapeErrors,
      cumulativeVoteDelta: scrapeResult.cumulativeVoteDelta,
      errors: scrapeResult.errors,
    });
    if (scrapeResult.scrapeErrors > 0) {
      logStepError(PIPELINE, 'scrape-votes', 'Erreurs partielles lors du scrape', {
        errors: scrapeResult.errors,
      });
    }
  } catch (err) {
    errors.push({ step: 'scrape-votes', code: 'fatal', message: err.message });
    logStepError(PIPELINE, 'scrape-votes', `Échec fatal : ${err.message}`, {
      code: 'fatal',
    });
    saveMeta({
      ...runningMeta,
      lastRunStatus: 'failed',
      lastRunDurationMs: Date.now() - start,
      progress: progress.getSnapshot(),
      errors: errors.slice(0, 20),
    });
    publishMeta();
    endRun(PIPELINE, 'fail', `Pipeline interrompu (scrape-votes)`, {
      durationMs: Date.now() - start,
    });
    throw err;
  }

  try {
    detectResult = await runDetectAlerts();
    logStepComplete(
      PIPELINE,
      'detect-alerts',
      `Détection terminée — ${detectResult.alertCount} alerte(s), phase ${detectResult.phase}`,
      detectResult
    );
  } catch (err) {
    errors.push({ step: 'detect-alerts', code: 'fatal', message: err.message });
    logStepError(PIPELINE, 'detect-alerts', `Échec fatal : ${err.message}`, {
      code: 'fatal',
    });
    saveMeta({
      ...runningMeta,
      lastRunStatus: 'failed',
      lastRunDurationMs: Date.now() - start,
      progress: progress.getSnapshot(),
      errors: errors.slice(0, 20),
    });
    publishMeta();
    endRun(PIPELINE, 'fail', `Pipeline interrompu (detect-alerts)`, {
      durationMs: Date.now() - start,
    });
    throw err;
  }

  runPublish();
  logStepComplete(PIPELINE, 'publish', 'Données publiées vers public/data/');

  const participants = loadParticipants();
  const history = loadVotesHistory();
  const durationMs = Date.now() - start;
  const hasScrapeErrors = scrapeResult.scrapeErrors > 0 || errors.length > 0;
  const status = hasScrapeErrors ? 'partial' : 'success';

  saveMeta({
    lastRunAt: formatParisIso(nowParis()),
    lastRunStatus: status,
    lastRunDurationMs: durationMs,
    trigger,
    snapshotTimestamp: snapshotTs,
    counts: {
      participantsActive: participants.participants.filter((p) => p.active).length,
      participantsTotal: participants.participants.length,
      snapshotsTotal: history.snapshots.length,
      scrapeErrors: scrapeResult.scrapeErrors || 0,
      newParticipants: 0,
    },
    errors: errors.slice(0, 20),
  });

  runPublish();

  const summary = sanitizeForJournal({
    durationMs,
    status,
    snapshotTimestamp: snapshotTs,
    newParticipants: 0,
    alertCount: detectResult.alertCount,
    entriesCount: scrapeResult.entriesCount,
    errorCount: errors.length,
  });

  endRun(
    PIPELINE,
    'success',
    `Pipeline OK en ${Math.round(durationMs / 1000)}s`,
    summary
  );

  console.log(
    `Pipeline OK in ${Math.round(durationMs / 1000)}s — alerts=${detectResult.alertCount}`
  );
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  try {
    if (isRunActive()) {
      endRun(PIPELINE, 'fail', err.message, { code: 'unhandled' });
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
