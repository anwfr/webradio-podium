import { getLatestComparison } from './snapshot-window.js';
import { resolveFromBase } from './paths.js';

const EMPTY_PARTICIPANTS = { updatedAt: null, participants: [] };
const EMPTY_HISTORY = { snapshots: [] };
const EMPTY_META = {
  lastRunAt: null,
  lastRunStatus: null,
  trigger: null,
};

async function fetchJsonOrNull(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadAppData() {
  const [participants, history, meta] = await Promise.all([
    fetchJsonOrNull(resolveFromBase('data/participants.json')),
    fetchJsonOrNull(resolveFromBase('data/votes-history.json')),
    fetchJsonOrNull(resolveFromBase('data/meta.json')),
  ]);
  return {
    participants: participants ?? EMPTY_PARTICIPANTS,
    history: history ?? EMPTY_HISTORY,
    meta: meta ?? EMPTY_META,
  };
}

export function isDataEmpty(participants, history) {
  const activeCount = (participants?.participants || []).filter((p) => p.active).length;
  const snapshotCount = history?.snapshots?.length || 0;
  return activeCount === 0 && snapshotCount === 0;
}

export function getLatestVotes(history) {
  const snapshots = history.snapshots || [];
  if (!snapshots.length) return new Map();
  const last = snapshots[snapshots.length - 1];
  return new Map(last.entries.map((e) => [e.slug, e.votes]));
}

function comparisonDeltas(active, latestVotes, referenceVotes) {
  const sorted = active
    .map((p) => {
      const votes = latestVotes.get(p.slug) ?? p.lastVotes ?? 0;
      const refVotes = referenceVotes.has(p.slug)
        ? referenceVotes.get(p.slug)
        : votes;
      return {
        slug: p.slug,
        votes,
        deltaVotes: votes - refVotes,
      };
    })
    .sort((a, b) => b.votes - a.votes);

  const refSorted = active
    .map((p) => ({
      slug: p.slug,
      votes: referenceVotes.has(p.slug)
        ? referenceVotes.get(p.slug)
        : latestVotes.get(p.slug) ?? p.lastVotes ?? 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  const prevRanks = new Map();
  refSorted.forEach((r, i) => prevRanks.set(r.slug, i + 1));

  const bySlug = new Map();
  sorted.forEach((row, index) => {
    const rank = index + 1;
    const prevRank = prevRanks.get(row.slug) ?? rank;
    bySlug.set(row.slug, {
      votes: row.votes,
      rank,
      deltaVotes: row.deltaVotes,
      deltaRank: prevRank - rank,
    });
  });
  return bySlug;
}

export function buildRankingsAtComparison(participants, latestVotes, referenceVotes) {
  const active = participants.participants.filter((p) => p.active);
  const deltas24 = comparisonDeltas(active, latestVotes, referenceVotes);

  return [...deltas24.entries()]
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([slug, d24]) => {
      const p = active.find((x) => x.slug === slug);
      return {
        ...p,
        votes: d24.votes,
        rank: d24.rank,
        deltaVotes: d24.deltaVotes,
        deltaRank: d24.deltaRank,
      };
    });
}

export function buildRankings(participants, history) {
  const comp24 = getLatestComparison(history);
  return buildRankingsAtComparison(
    participants,
    comp24.latestVotes,
    comp24.referenceVotes
  );
}

function rankPodcastsByField(rows, field) {
  const sorted = [...rows].sort((a, b) => b[field] - a[field]);
  const ranks = new Map();
  sorted.forEach((row, index) => ranks.set(row.slug, index + 1));
  return ranks;
}

export function enrichPodcastSortRanks(rows, referenceRows = null) {
  const deltaRanks = rankPodcastsByField(rows, 'deltaVotes');

  let refDeltaRanks = new Map();
  if (referenceRows?.length) {
    refDeltaRanks = rankPodcastsByField(referenceRows, 'deltaVotes');
  }

  return rows.map((row) => {
    const rankByDelta24h = deltaRanks.get(row.slug);
    const prevDelta = refDeltaRanks.get(row.slug) ?? rankByDelta24h;
    return {
      ...row,
      rankByTotal: row.rank,
      rankByDelta24h,
      deltaRankByTotal: row.deltaRank,
      deltaRankByDelta24h: prevDelta - rankByDelta24h,
    };
  });
}

export function sortPodcastsForMode(rows, mode = 'delta24h') {
  const rankField = mode === 'total' ? 'rankByTotal' : 'rankByDelta24h';
  return [...rows]
    .sort((a, b) => a[rankField] - b[rankField])
    .map((row) => ({
      ...row,
      displayRank: row[rankField],
    }));
}

export function computeGlobalDelta24h(items) {
  return items.reduce((sum, item) => sum + (item.deltaVotes ?? 0), 0);
}

export function formatRankOrdinal(rank) {
  const n = Math.trunc(Number(rank));
  if (!Number.isFinite(n) || n < 1) return String(rank ?? '');
  if (n === 1) return '1er';
  return `${n}e`;
}

export function totalRankDelta(item) {
  return item?.deltaRankByTotal ?? item?.deltaRank ?? 0;
}

export function formatRankDelta(n) {
  if (n === 0) return { text: '', class: 'delta-zero', direction: 'zero' };
  if (n > 0) {
    const places = n > 1 ? 'places' : 'place';
    return { text: `↑ ${n} ${places}`, class: 'delta-pos', direction: 'up' };
  }
  const abs = Math.abs(n);
  const places = abs > 1 ? 'places' : 'place';
  return { text: `↓ ${abs} ${places}`, class: 'delta-neg', direction: 'down' };
}

export function formatRankDeltaMarkup(n) {
  const delta = formatRankDelta(n);
  if (!delta.text) return '';
  return `<span class="delta-value ${delta.class}"><span class="delta-text">${delta.text}</span></span>`;
}

export function formatDeltaCompactMarkup(n, trailing = '') {
  const delta = formatDelta(n);
  return `<span class="delta-value ${delta.class}"><span class="delta-text">${delta.text}${trailing}</span></span>`;
}

export function renderPodium24hStatsMarkup(deltaVotes, rankDelta = 0) {
  const rankMarkup = formatRankDeltaMarkup(rankDelta);
  return `<div class="podium-delta-group">
    <p class="podium-delta">${formatDeltaCompactMarkup(deltaVotes, ' votes')}</p>
    ${rankMarkup ? `<p class="podium-delta">${rankMarkup}</p>` : ''}
  </div>`;
}

export function formatDelta(n, suffix = '') {
  if (n === 0) return { text: '0' + suffix, class: 'delta-zero', direction: 'zero' };
  if (n > 0) return { text: `+${n}${suffix}`, class: 'delta-pos', direction: 'up' };
  return { text: `${n}${suffix}`, class: 'delta-neg', direction: 'down' };
}

export function formatHighlightNumberMarkup(n, { tone = 'pos' } = {}) {
  const formatted = new Intl.NumberFormat('fr-FR').format(n ?? 0);
  const cls = tone === 'neg' ? 'delta-neg' : tone === 'zero' ? 'delta-zero' : 'delta-pos';
  return `<span class="delta-value ${cls}"><span class="delta-text">${formatted}</span></span>`;
}

export function podiumVotesDisplay({ votes, deltaVotes, mode = 'total' }) {
  if (mode === 'delta24h') {
    return {
      value: formatDelta(deltaVotes).text,
      label: 'votes',
    };
  }

  return {
    value: new Intl.NumberFormat('fr-FR').format(votes),
    label: 'votes',
  };
}

export function formatDeltaMarkup(n, { suffix = '', trailing = '', hideZero = false } = {}) {
  if (hideZero && n === 0) return '';
  const delta = formatDelta(n, suffix);
  const arrow =
    delta.direction === 'up'
      ? '<span class="delta-arrow delta-arrow--up" aria-hidden="true"></span>'
      : delta.direction === 'down'
        ? '<span class="delta-arrow delta-arrow--down" aria-hidden="true"></span>'
        : '';
  return `<span class="delta-value ${delta.class}">${arrow}<span class="delta-text">${delta.text}${trailing}</span></span>`;
}

export function formatDateFr(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
  } catch {
    return iso;
  }
}

export function formatLastUpdate(meta, participants) {
  const iso = meta?.lastRunAt || participants?.updatedAt;
  if (!iso) return '';
  return `Dernière mise à jour : ${formatDateFr(iso)}`;
}
