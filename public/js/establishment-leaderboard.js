import { getBadgeLabel } from './badge-labels.js';
import { formatHighlightNumberMarkup, formatDeltaMarkup, totalRankDelta } from './data.js';
import { findRemontada } from './boost-du-jour.js';
import { resolveEstablishmentCity } from './establishment.js';

function escapeStatText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function placeWord(count) {
  return Math.abs(count) > 1 ? 'places' : 'place';
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
  const badges = [];

  const enFeu = byDelta.find((entry) => (entry.deltaVotes ?? 0) > 0);
  if (enFeu) {
    badges.push(
      badgeFromEntry(enFeu, {
        emoji: '🔥',
        type: 'enFeu',
        text: `${enFeu.label} cartonne avec ${enFeu.deltaVotes} votes aujourd'hui`,
        statMarkup: `${escapeStatText(enFeu.label)} cartonne avec ${formatDeltaMarkup(enFeu.deltaVotes, { trailing: ' votes aujourd\u2019hui' })}`,
      })
    );
  }

  const flop = [...entries]
    .filter((entry) => totalRankDelta(entry) <= -1)
    .sort((a, b) => totalRankDelta(a) - totalRankDelta(b))[0];
  if (flop) {
    const flopPlaces = Math.abs(totalRankDelta(flop));
    badges.push(
      badgeFromEntry(flop, {
        emoji: '📉',
        type: 'flop',
        text: `${flop.label} chute de ${flopPlaces} ${placeWord(flopPlaces)} aujourd'hui`,
        statMarkup: `${escapeStatText(flop.label)} chute de ${formatHighlightNumberMarkup(flopPlaces, { tone: 'neg' })} ${placeWord(flopPlaces)} <span class="badge-stat-muted">aujourd\u2019hui</span>`,
      })
    );
  }

  const remontada = findRemontada(entries);
  if (remontada) {
    const remontadaPlaces = totalRankDelta(remontada);
    badges.push(
      badgeFromEntry(remontada, {
        emoji: '🚀',
        type: 'remontada',
        text: `${remontada.label} remonte de ${remontadaPlaces} ${placeWord(remontadaPlaces)} aujourd'hui`,
        statMarkup: `${escapeStatText(remontada.label)} remonte de ${formatHighlightNumberMarkup(remontadaPlaces)} ${placeWord(remontadaPlaces)} <span class="badge-stat-muted">aujourd\u2019hui</span>`,
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
