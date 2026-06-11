import { runDiscover } from './discover-participants.js';
import { runPublish } from './publish-data.js';
import { saveMeta, ensureDataFiles } from './lib/storage.js';
import { formatParisIso, nowParis } from './lib/time.js';
import {
  startRun,
  logStepComplete,
  logStepError,
  endRun,
  isRunActive,
  sanitizeForJournal,
} from './lib/journal.js';

const PIPELINE = 'pipeline-b';
const trigger = process.env.PIPELINE_TRIGGER || 'local';

async function main() {
  ensureDataFiles();
  const start = Date.now();

  startRun(PIPELINE, trigger);

  let report;
  try {
    report = await runDiscover(trigger);
    logStepComplete(
      PIPELINE,
      'discover-participants',
      `Découverte terminée — ouverts ${report.summary.votesOpened}, fermés ${report.summary.votesClosed}, nouveaux ${report.summary.newlyDiscovered}`,
      report.summary
    );
    if (report.errors?.length) {
      logStepError(PIPELINE, 'discover-participants', 'Erreurs partielles lors de la découverte', {
        errors: report.errors,
      });
    }
  } catch (err) {
    logStepError(PIPELINE, 'discover-participants', `Échec fatal : ${err.message}`, {
      code: 'fatal',
    });
    endRun(PIPELINE, 'fail', `Discover interrompu`, {
      durationMs: Date.now() - start,
    });
    throw err;
  }

  runPublish();
  logStepComplete(PIPELINE, 'publish', 'Données publiées vers public/data/');

  const durationMs = Date.now() - start;
  const status = report.errors?.length ? 'partial' : 'success';

  saveMeta({
    lastRunAt: formatParisIso(nowParis()),
    lastRunStatus: status,
    lastRunDurationMs: report.durationMs,
    trigger: `discover:${trigger}`,
    snapshotTimestamp: null,
    counts: {
      participantsActive: 0,
      participantsTotal: 0,
      snapshotsTotal: 0,
      scrapeErrors: report.summary.errors,
      newParticipants: report.summary.newlyDiscovered,
    },
    errors: (report.errors || []).slice(0, 20),
  });

  runPublish();

  endRun(
    PIPELINE,
    'success',
    `Discover OK en ${Math.round(durationMs / 1000)}s`,
    sanitizeForJournal({
      durationMs,
      status,
      summary: report.summary,
    })
  );

  console.log(
    `Discover complete: opened=${report.summary.votesOpened}, closed=${report.summary.votesClosed}, new=${report.summary.newlyDiscovered}`
  );
}

main().catch((err) => {
  console.error('Discover failed:', err);
  try {
    if (isRunActive()) {
      endRun(PIPELINE, 'fail', err.message, { code: 'unhandled' });
    }
  } catch {
    /* ignore */
  }
  process.exit(1);
});
