const PARIS = 'Europe/Paris';

export function snapshotDayKey(timestamp) {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: PARIS,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function snapshotDayLabel(timestamp) {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: PARIS,
  });
}

export function sortSnapshotsByTime(snapshots) {
  return [...snapshots].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

/** Dernier snapshot de chaque jour calendaire (Europe/Paris). */
export function snapshotsLatestPerDay(snapshots) {
  const byDay = new Map();
  for (const snap of snapshots) {
    const key = snapshotDayKey(snap.timestamp);
    const prev = byDay.get(key);
    if (!prev || Date.parse(snap.timestamp) > Date.parse(prev.timestamp)) {
      byDay.set(key, snap);
    }
  }
  return sortSnapshotsByTime([...byDay.values()]);
}

export function snapshotVotes(snapshot, slug) {
  const entry = snapshot?.entries?.find((e) => e.slug === slug);
  return entry != null ? entry.votes : null;
}

export function rankAtSnapshot(snapshot, slug, activeSlugs) {
  if (!snapshot?.entries?.some((e) => e.slug === slug)) return null;

  const votesMap = new Map(snapshot.entries.map((e) => [e.slug, e.votes]));
  const ranked = activeSlugs
    .map((s) => ({ slug: s, votes: votesMap.get(s) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const idx = ranked.findIndex((r) => r.slug === slug);
  return idx >= 0 ? idx + 1 : null;
}

/** Deltas votes / rang vs le jour précédent affiché (aligné graphiques fiche podcast). */
export function getPodcastDayOverDayDeltas(history, slug, activeSlugs) {
  const daily = snapshotsLatestPerDay(sortSnapshotsByTime(history?.snapshots ?? []));
  if (daily.length < 2) {
    return { deltaVotes: null, deltaRank: null };
  }

  const latest = daily.at(-1);
  const prev = daily.at(-2);
  const currVotes = snapshotVotes(latest, slug);
  const prevVotes = snapshotVotes(prev, slug);
  const currRank = rankAtSnapshot(latest, slug, activeSlugs);
  const prevRank = rankAtSnapshot(prev, slug, activeSlugs);

  return {
    deltaVotes:
      currVotes != null && prevVotes != null ? currVotes - prevVotes : null,
    deltaRank:
      currRank != null && prevRank != null ? prevRank - currRank : null,
  };
}

/**
 * Delta jour vs jour précédent affiché sur la série.
 * @returns {(null | number)[]}
 */
export function buildDayOverDayDeltas(dailySnapshots, valueAt) {
  return dailySnapshots.map((snap, index) => {
    if (index === 0) return null;

    const curr = valueAt(snap);
    const prev = valueAt(dailySnapshots[index - 1]);
    if (curr == null || prev == null) return null;

    return curr - prev;
  });
}
