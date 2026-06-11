import { detectAnomalies } from './lib/anomaly-detector.js';
import {
  loadParticipants,
  loadVotesHistory,
  saveAlerts,
  saveStats,
  ensureDataFiles,
} from './lib/storage.js';
import { formatParisIso, nowParis } from './lib/time.js';

export async function runDetectAlerts() {
  ensureDataFiles();
  const generatedAt = formatParisIso(nowParis());
  const participants = loadParticipants().participants;
  const history = loadVotesHistory();

  const result = detectAnomalies(history, participants, generatedAt);

  saveStats(result.stats);
  saveAlerts({
    generatedAt,
    modelVersion: result.modelVersion,
    alerts: result.alerts,
  });

  return {
    alertCount: result.alerts.length,
    phase: result.phase,
    snapshotCount: result.stats.snapshotCount,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDetectAlerts()
    .then((r) => {
      console.log(
        `Detection complete: ${r.alertCount} alert(s), phase=${r.phase}, snapshots=${r.snapshotCount}`
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
