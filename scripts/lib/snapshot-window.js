import { COMPARISON_WINDOW_HOURS } from './constants.js';
import { hoursBetween } from './time.js';

export function votesMap(snapshot) {
  if (!snapshot?.entries) return new Map();
  return new Map(snapshot.entries.map((e) => [e.slug, e.votes]));
}

/**
 * Dernier snapshot dont le timestamp est ≤ (atTimestamp − COMPARISON_WINDOW_HOURS).
 * Si aucun, retourne le premier snapshot (historique < 24 h).
 */
export function findReferenceSnapshot(
  snapshots,
  atTimestamp,
  windowHours = COMPARISON_WINDOW_HOURS
) {
  if (!snapshots?.length) return null;
  const atMs = Date.parse(atTimestamp);
  const targetMs = atMs - windowHours * 60 * 60 * 1000;

  let ref = null;
  for (const snap of snapshots) {
    const ms = Date.parse(snap.timestamp);
    if (ms <= targetMs) ref = snap;
    else break;
  }
  return ref ?? snapshots[0];
}

function rankMap(votesBySlug, slugs) {
  const ranked = slugs
    .map((slug) => ({ slug, votes: votesBySlug.get(slug) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const map = new Map();
  ranked.forEach((r, i) => map.set(r.slug, i + 1));
  return map;
}

/** Intervalles 24 h : chaque snapshot est comparé à la référence ~24 h avant. */
export function buildComparisonIntervals(snapshots, activeSlugs) {
  const intervals = [];
  for (const curr of snapshots) {
    const ref = findReferenceSnapshot(snapshots, curr.timestamp);
    if (!ref) continue;

    const hours = hoursBetween(ref.timestamp, curr.timestamp);
    const refVotes = votesMap(ref);
    const currVotes = votesMap(curr);

    const refVotesFull = new Map(
      activeSlugs.map((s) => [s, refVotes.get(s) ?? 0])
    );
    const currVotesFull = new Map(
      activeSlugs.map((s) => [
        s,
        currVotes.get(s) ?? refVotes.get(s) ?? 0,
      ])
    );

    const rankPrev = rankMap(refVotesFull, activeSlugs);
    const rankCurr = rankMap(currVotesFull, activeSlugs);

    for (const slug of activeSlugs) {
      const v0 = refVotes.get(slug);
      const v1 = currVotes.get(slug);
      if (v0 == null && v1 == null) continue;

      const votes0 = v0 ?? v1 ?? 0;
      const votes1 = v1 ?? v0 ?? 0;
      const delta = votes1 - votes0;

      intervals.push({
        slug,
        timestamp: curr.timestamp,
        prevTimestamp: ref.timestamp,
        delta,
        velocity: delta / hours,
        rankJump: (rankPrev.get(slug) ?? 0) - (rankCurr.get(slug) ?? 0),
        hours,
      });
    }
  }
  return intervals;
}

export function getLatestComparison(
  history,
  windowHours = COMPARISON_WINDOW_HOURS
) {
  const snapshots = history?.snapshots ?? [];
  if (!snapshots.length) {
    return {
      latestVotes: new Map(),
      referenceVotes: new Map(),
      periodHours: null,
      latestTimestamp: null,
      referenceTimestamp: null,
      windowHours,
    };
  }
  const latest = snapshots[snapshots.length - 1];
  const ref = findReferenceSnapshot(snapshots, latest.timestamp, windowHours);
  const hours = hoursBetween(ref.timestamp, latest.timestamp);
  return {
    latestVotes: votesMap(latest),
    referenceVotes: votesMap(ref),
    periodHours: hours,
    latestTimestamp: latest.timestamp,
    referenceTimestamp: ref.timestamp,
    windowHours,
  };
}
