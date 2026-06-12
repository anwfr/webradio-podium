function aggregateRows(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!row.establishmentKey) continue;

    let entry = map.get(row.establishmentKey);
    if (!entry) {
      entry = {
        key: row.establishmentKey,
        label: row.establishment || row.establishmentKey,
        podcastCount: 0,
        totalVotes: 0,
        deltaVotes: 0,
        bestGlobalRank: Infinity,
      };
      map.set(row.establishmentKey, entry);
    }

    const rowLabel = row.establishment || '';
    const entryLabel = entry.label || '';
    if (rowLabel && rowLabel.length < entryLabel.length) {
      entry.label = rowLabel;
    }
    if (!entry.label) entry.label = row.establishmentKey;

    entry.podcastCount += 1;
    entry.totalVotes += row.votes;
    entry.deltaVotes += row.deltaVotes;
    entry.bestGlobalRank = Math.min(entry.bestGlobalRank, row.rank);
  }

  return map;
}

function rankByField(entries, field) {
  const sorted = [...entries].sort((a, b) => b[field] - a[field]);
  const ranks = new Map();
  sorted.forEach((entry, index) => ranks.set(entry.key, index + 1));
  return ranks;
}

export function buildEstablishmentLeaderboard(rows, referenceRows = null) {
  const currentMap = aggregateRows(rows);
  const entries = [...currentMap.values()].map((entry) => ({
    ...entry,
    bestGlobalRank: entry.bestGlobalRank === Infinity ? null : entry.bestGlobalRank,
  }));

  const totalRanks = rankByField(entries, 'totalVotes');
  const deltaRanks = rankByField(entries, 'deltaVotes');

  let refTotalRanks = new Map();
  let refDeltaRanks = new Map();
  if (referenceRows?.length) {
    const refEntries = [...aggregateRows(referenceRows).values()];
    refTotalRanks = rankByField(refEntries, 'totalVotes');
    refDeltaRanks = rankByField(refEntries, 'deltaVotes');
  }

  return entries
    .map((entry) => {
      const rankByTotal = totalRanks.get(entry.key);
      const rankByDelta24h = deltaRanks.get(entry.key);
      const prevTotal = refTotalRanks.get(entry.key) ?? rankByTotal;
      const prevDelta = refDeltaRanks.get(entry.key) ?? rankByDelta24h;

      return {
        ...entry,
        rankByTotal,
        rankByDelta24h,
        deltaRankByTotal: prevTotal - rankByTotal,
        deltaRankByDelta24h: prevDelta - rankByDelta24h,
        rank: rankByTotal,
        deltaRank: prevTotal - rankByTotal,
      };
    })
    .sort((a, b) => a.rankByTotal - b.rankByTotal);
}

export function sortEstablishmentsForMode(entries, mode = 'delta24h') {
  const field = mode === 'total' ? 'rankByTotal' : 'rankByDelta24h';
  return [...entries]
    .sort((a, b) => a[field] - b[field])
    .map((entry) => ({
      ...entry,
      displayRank: entry[field],
    }));
}

export function buildLocalRanks(rows) {
  const sorted = [...rows].sort((a, b) => b.votes - a.votes);
  return sorted.map((row, index) => ({
    ...row,
    localRank: index + 1,
    globalRank: row.rank,
  }));
}

export function findEstablishmentEntry(entries, key) {
  return entries.find((entry) => entry.key === key) || null;
}
