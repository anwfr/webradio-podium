import { crawlAllListSlugs, visitParticipants } from './lib/list-crawl.js';
import {
  loadParticipants,
  saveParticipants,
  saveSyncReport,
  emptySyncReport,
} from './lib/storage.js';
import { publishSyncReport } from './publish-data.js';
import { formatParisIso, nowParis } from './lib/time.js';
import { RunProgress } from './lib/progress.js';
import { RUN_PROGRESS_PUBLISH_EVERY } from './lib/constants.js';

function snapshotParticipant(p) {
  return {
    active: p.active,
    voteStatus: p.voteStatus,
    edition: p.edition ?? null,
    votes: p.lastVotes ?? null,
    title: p.title,
    school: p.school ?? null,
    category: p.category ?? null,
    establishment: p.establishment ?? null,
  };
}

function metadataChanged(before, after) {
  return (
    before.title !== after.title ||
    before.school !== after.school ||
    before.category !== after.category ||
    before.establishment !== after.establishment
  );
}

function buildReason(before, after) {
  if (!before && after.active) {
    return `Nouveau slug détecté sur la liste AFD, éligible édition 2026`;
  }
  if (before && !before.active && after.active) {
    const votes = after.lastVotes ?? 0;
    return `Votes ouverts : édition 2026 confirmée, widget vote détecté (${votes} votes)`;
  }
  if (before && before.active && !after.active) {
    if (after.voteStatus === 'closed') {
      return `Votes fermés : texte "Votes clôturés" détecté sur la fiche`;
    }
    return `Indisponible : widget vote absent (était ouvert précédemment)`;
  }
  if (
    before &&
    before.voteStatus !== after.voteStatus &&
    before.active === after.active
  ) {
    return `Statut modifié : ${before.voteStatus} → ${after.voteStatus}`;
  }
  if (metadataChanged(before || {}, after)) {
    return 'Métadonnées mises à jour (titre, école ou catégorie)';
  }
  return 'Aucun changement de statut';
}

export function computeDiff(beforeParticipants, afterParticipants) {
  const beforeMap = new Map(beforeParticipants.map((p) => [p.slug, p]));
  const afterMap = new Map(afterParticipants.map((p) => [p.slug, p]));

  const changes = {
    votesOpened: [],
    votesClosed: [],
    newlyDiscovered: [],
    statusChanged: [],
    metadataUpdated: [],
    unchanged: 0,
  };

  for (const [slug, after] of afterMap) {
    const before = beforeMap.get(slug);
    const beforeSnap = before ? snapshotParticipant(before) : null;
    const afterSnap = snapshotParticipant(after);

    const entry = {
      slug,
      title: after.title,
      url: after.url,
      previous: beforeSnap,
      current: afterSnap,
      reason: buildReason(beforeSnap, after),
    };

    if (!before) {
      changes.newlyDiscovered.push(entry);
      continue;
    }

    if (!before.active && after.active) {
      changes.votesOpened.push(entry);
    } else if (before.active && !after.active) {
      changes.votesClosed.push(entry);
    } else if (before.voteStatus !== after.voteStatus) {
      changes.statusChanged.push(entry);
    } else if (metadataChanged(beforeSnap, afterSnap)) {
      changes.metadataUpdated.push(entry);
    } else {
      changes.unchanged++;
    }
  }

  return changes;
}

export async function runDiscover(trigger = 'manual') {
  const start = Date.now();
  const validatedAt = formatParisIso(nowParis());

  const beforeData = loadParticipants();
  const beforeParticipants = beforeData.participants.map((p) => ({ ...p }));

  let runningReport = {
    ...emptySyncReport(),
    status: 'running',
    runAt: validatedAt,
    trigger,
    progress: null,
  };
  saveSyncReport(runningReport);
  publishSyncReport();

  let visitTick = 0;

  const progress = new RunProgress({
    logPrefix: 'discover',
    onUpdate: (snapshot) => {
      runningReport = {
        ...runningReport,
        progress: snapshot,
      };
      const shouldPublish =
        snapshot.phase === 'list_crawl' ||
        visitTick % RUN_PROGRESS_PUBLISH_EVERY === 0 ||
        snapshot.current === snapshot.total;

      if (shouldPublish) {
        saveSyncReport(runningReport, { backup: false });
        publishSyncReport();
      }
    },
  });

  try {
    progress.setPhase('list_crawl', 1);

    const listSlugs = await crawlAllListSlugs({
      onListPageProgress: (page, lastPage, slugCount) => {
        progress.tickListPage(page, lastPage, slugCount);
      },
    });

    progress.setListSlugsFound(listSlugs.length);

    const knownSlugs = new Set(beforeParticipants.map((p) => p.slug));
    const allSlugs = [...new Set([...listSlugs, ...knownSlugs])];

    const participantsMap = new Map(
      beforeParticipants.map((p) => [p.slug, { ...p }])
    );

    progress.setPhase('visit_fiches', allSlugs.length);

    const visitErrors = await visitParticipants(
      allSlugs,
      participantsMap,
      validatedAt,
      {
        onProgress: (i, total, slug, errorCount) => {
          visitTick = i;
          progress.tick(slug, { errorCount });
        },
        onError: (_slug, err) => {
          if (err.status === 429) {
            console.warn('[discover] Rate-limit détecté — pause anti-flood activée');
          }
        },
      }
    );

    const participants = [...participantsMap.values()].sort((a, b) =>
      a.slug.localeCompare(b.slug)
    );

    saveParticipants({
      updatedAt: validatedAt,
      participants,
    });

    const changes = computeDiff(beforeParticipants, participants);
    const durationMs = Date.now() - start;

    const report = {
      status: 'complete',
      runAt: validatedAt,
      durationMs,
      trigger,
      summary: {
        votesOpened: changes.votesOpened.length,
        votesClosed: changes.votesClosed.length,
        newlyDiscovered: changes.newlyDiscovered.length,
        statusChanged: changes.statusChanged.length,
        metadataUpdated: changes.metadataUpdated.length,
        unchanged: changes.unchanged,
        errors: visitErrors.length,
      },
      changes,
      errors: visitErrors,
    };

    saveSyncReport(report);
    publishSyncReport();

    return report;
  } catch (err) {
    const durationMs = Date.now() - start;
    const failedReport = {
      ...runningReport,
      status: 'failed',
      durationMs,
      progress: progress.getSnapshot(),
      errors: [{ code: 'fatal', message: err.message }],
    };
    saveSyncReport(failedReport);
    publishSyncReport();
    throw err;
  }
}
