export const COMPARISON_WINDOW_HOURS = 24;

function hoursBetween(ts1, ts2) {
  const a = Date.parse(ts1);
  const b = Date.parse(ts2);
  return Math.max(0.01, (b - a) / (60 * 60 * 1000));
}

export function votesMap(snapshot) {
  if (!snapshot?.entries) return new Map();
  return new Map(snapshot.entries.map((e) => [e.slug, e.votes]));
}

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
      windowHours,
    };
  }
  const latest = snapshots[snapshots.length - 1];
  const ref = findReferenceSnapshot(snapshots, latest.timestamp, windowHours);
  return {
    latestVotes: votesMap(latest),
    referenceVotes: votesMap(ref),
    periodHours: hoursBetween(ref.timestamp, latest.timestamp),
    windowHours,
  };
}
