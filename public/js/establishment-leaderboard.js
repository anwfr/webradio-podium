import { getBadgeLabel } from './badge-labels.js';
import { formatHighlightNumberMarkup } from './data.js';
import { resolveEstablishmentCity } from './establishment.js';

function escapeStatText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badgeFromEntry(entry, { emoji, type, text, statMarkup }) {
  return {
    emoji,
    type,
    title: getBadgeLabel(type),
    text,
    statMarkup,
    key: entry.key,
    label: entry.label,
    city: resolveEstablishmentCity({ label: entry.label, key: entry.key }),
  };
}

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

export function computeEstablishmentBadges(entries) {
  if (!entries.length) return [];

  const byDelta = [...entries].sort((a, b) => a.rankByDelta24h - b.rankByDelta24h);
  const byTotal = [...entries].sort((a, b) => a.rankByTotal - b.rankByTotal);
  const badges = [];

  const champion = byTotal[0];
  if (champion) {
    badges.push(
      badgeFromEntry(champion, {
        emoji: '👑',
        type: 'champion',
        text: `${champion.label} domine avec ${champion.totalVotes} votes au total`,
        statMarkup: `${escapeStatText(champion.label)} domine avec ${formatHighlightNumberMarkup(champion.totalVotes)} votes au total`,
      })
    );
  }

  const flop = [...entries]
    .filter((entry) => entry.deltaRankByDelta24h <= -1)
    .sort((a, b) => a.deltaRankByDelta24h - b.deltaRankByDelta24h)[0];
  if (flop) {
    badges.push(
      badgeFromEntry(flop, {
        emoji: '📉',
        type: 'flop',
        text: `${flop.label} chute de ${Math.abs(flop.deltaRankByDelta24h)} places aujourd'hui`,
        statMarkup: `${escapeStatText(flop.label)} chute de ${formatHighlightNumberMarkup(Math.abs(flop.deltaRankByDelta24h), { tone: 'neg' })} places <span class="badge-stat-muted">aujourd\u2019hui</span>`,
      })
    );
  }

  const underdog = byDelta.find(
    (entry) => entry.podcastCount === 1 && entry.rankByDelta24h <= 10 && entry.deltaVotes > 0
  );
  if (underdog) {
    badges.push(
      badgeFromEntry(underdog, {
        emoji: '⚡',
        type: 'underdog',
        text: `${underdog.label} brille avec un seul podcast`,
      })
    );
  }

  const bestRank = [...entries]
    .filter((entry) => entry.bestGlobalRank != null)
    .sort((a, b) => a.bestGlobalRank - b.bestGlobalRank)[0];
  if (bestRank) {
    badges.push(
      badgeFromEntry(bestRank, {
        emoji: '🎯',
        type: 'meilleurRang',
        text: `${bestRank.label} a le podcast le plus haut (#${bestRank.bestGlobalRank})`,
        statMarkup: `${escapeStatText(bestRank.label)} a le podcast le plus haut (${formatHighlightNumberMarkup(bestRank.bestGlobalRank)})`,
      })
    );
  }

  const used = new Set();
  return badges.filter((badge) => {
    if (used.has(badge.key)) return false;
    used.add(badge.key);
    return true;
  }).slice(0, 3);
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
