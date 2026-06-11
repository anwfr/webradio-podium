import {
  formatDeltaMarkup,
  formatRankDeltaMarkup,
  formatRankOrdinal,
  podiumVotesDisplay,
} from './data.js';
import {
  BOOST_STORY_BADGES,
  buildBoostSecondaryStories,
  resolveBoostBadgeLabel,
  renderHighlightBadgeCard,
  renderBoostDuJourCards,
  boostStoryStatMarkup,
} from './boost-du-jour.js';
import { parsePodiumEstablishmentDisplay } from './establishment.js';
import { escapeHtml } from './ranking-view.js';
import {
  sortEstablishmentsForMode,
  computeEstablishmentBadges,
} from './establishment-leaderboard.js';

function formatNumber(n) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

function rankNeighborTierClass(rank) {
  if (rank === 1) return 'rank-neighbor--tier-1';
  if (rank === 2) return 'rank-neighbor--tier-2';
  if (rank === 3) return 'rank-neighbor--tier-3';
  return '';
}

function rankNeighborMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

export function renderEstablishmentBadges(entries, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const badges = computeEstablishmentBadges(entries);
  if (!badges.length) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = badges
    .map((badge) => {
      const cityMarkup = badge.city
        ? badge.city
        : '';
      return renderHighlightBadgeCard({
        emoji: badge.emoji,
        label: badge.title,
        text: badge.text,
        statMarkup: badge.statMarkup,
        city: cityMarkup,
      });
    })
    .join('');
}

function renderEstablishmentBoostCard(entry, { badge, story = null }) {
  const { city, establishmentName } = parsePodiumEstablishmentDisplay(entry.label, {
    key: entry.key,
  });
  const name = establishmentName || entry.label;

  return renderHighlightBadgeCard({
    emoji: badge.emoji,
    label: resolveBoostBadgeLabel(badge),
    city,
    statMarkup: `${escapeHtml(name)} ${boostStoryStatMarkup(story ?? 'enFeu', entry)}`,
  });
}

export function renderEstablishmentBoostDuJour(entries, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sorted = sortEstablishmentsForMode(entries, 'delta24h');
  if (!sorted.length) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const hero = sorted[0];
  const secondaryStories = buildBoostSecondaryStories(sorted, hero, { keyField: 'key' });

  const cards = [
    renderEstablishmentBoostCard(hero, {
      badge: BOOST_STORY_BADGES.enFeu,
      story: 'enFeu',
    }),
    ...secondaryStories.map(({ item, badge, story }) =>
      renderEstablishmentBoostCard(item, { badge, story })
    ),
  ];

  container.innerHTML = renderBoostDuJourCards(cards);
}

export function renderMyEstablishmentSummary(containerId, entry, { totalEstablishmentCount = 0 } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!entry) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const rankLabel = formatRankOrdinal(entry.rankByTotal);
  const rankMeta =
    totalEstablishmentCount > 0
      ? `sur ${formatNumber(totalEstablishmentCount)} établissement${totalEstablishmentCount > 1 ? 's' : ''}`
      : '';
  const votesMarkup = formatDeltaMarkup(entry.deltaVotes, { trailing: ' votes' });
  const progressionMarkup = formatRankDeltaMarkup(entry.deltaRankByDelta24h ?? 0);
  const progressionValue =
    progressionMarkup ||
    '<span class="establishment-summary-stat-muted">Stable</span>';

  container.innerHTML = `
    <div class="establishment-summary">
      <div class="establishment-summary-stat">
        <span class="establishment-summary-stat-label">Classement</span>
        <span class="establishment-summary-stat-value">${escapeHtml(rankLabel)}</span>
        ${rankMeta ? `<span class="establishment-summary-stat-meta">${escapeHtml(rankMeta)}</span>` : ''}
      </div>
      <div class="establishment-summary-stat">
        <span class="establishment-summary-stat-label">Votes aujourd'hui</span>
        <span class="establishment-summary-stat-value">${votesMarkup}</span>
      </div>
      <div class="establishment-summary-stat">
        <span class="establishment-summary-stat-label">Progression</span>
        <span class="establishment-summary-stat-value">${progressionValue}</span>
      </div>
    </div>`;
}

export function renderEstablishmentPodium(entries, containerId, { mode = 'delta24h' } = {}) {
  const podium = document.getElementById(containerId);
  if (!podium) return;
  podium.innerHTML = '';

  const sorted = sortEstablishmentsForMode(entries, mode);
  const top3 = sorted.slice(0, 3);
  const order = [1, 0, 2];
  const medals = ['🥇', '🥈', '🥉'];
  order.forEach((idx) => {
    const entry = top3[idx];
    if (!entry) return;
    const rank = idx + 1;
    const slot = document.createElement('div');
    slot.className = `podium-slot podium-slot--${rank}`;

    const { city, establishmentName } = parsePodiumEstablishmentDisplay(entry.label, {
      key: entry.key,
    });
    const cityMarkup = city
      ? `<span class="podium-establishment-city">${escapeHtml(city)}</span>`
      : '';
    const establishmentTitle = establishmentName || entry.label;

    const { value: primaryValue, label: primaryLabel } = podiumVotesDisplay({
      votes: entry.totalVotes,
      deltaVotes: entry.deltaVotes,
      mode: 'total',
    });
    const votesMarkup = `<div class="podium-votes-wrap">
            <span class="podium-votes">${primaryValue}</span>
            <span class="podium-votes-label">${primaryLabel}</span>
          </div>`;

    slot.innerHTML = `
      <article class="podium-card">
        <div class="podium-medal" aria-hidden="true">${medals[idx]}</div>
        <div class="podium-school podium-school--podium">
          <span class="podium-establishment">
            ${cityMarkup}
            <span class="podium-establishment-name">${escapeHtml(establishmentTitle)}</span>
          </span>
        </div>
        ${votesMarkup}
      </article>
      <div class="podium-step" aria-hidden="true">
        <span class="podium-step-num">${rank}</span>
      </div>`;

    podium.appendChild(slot);
  });
}

function renderEstablishmentNeighborRow(entry, { currentKey, mode = 'delta24h' }) {
  const isCurrent = entry.key === currentKey;
  const is24h = mode === 'delta24h';
  const rank = entry.displayRank;
  const tierClass = is24h ? '' : rankNeighborTierClass(rank);
  const medal = is24h ? '' : rankNeighborMedal(rank);
  const titleMedal = medal
    ? `<span class="rank-neighbor-medal" aria-hidden="true">${medal}</span>`
    : '';
  const rankMarkup = is24h
    ? `<span class="rank-neighbor-rank rank-neighbor-rank--delta">${formatDeltaMarkup(entry.deltaVotes, { trailing: ' votes' })}</span>`
    : `<span class="rank-neighbor-rank rank-list-badge">${rank}</span>`;
  const deltaMarkup = is24h
    ? ''
    : `<span class="rank-neighbor-delta">${formatDeltaMarkup(entry.deltaVotes, { trailing: ' votes aujourd\u2019hui' })}</span>`;
  const className = `rank-neighbor ${tierClass}${isCurrent ? ' rank-neighbor--current' : ''}`;
  const body = `
      ${rankMarkup}
      <span class="rank-neighbor-title">${titleMedal}<span class="rank-neighbor-title-text">${escapeHtml(entry.label)}</span></span>
      <span class="rank-neighbor-votes">${formatNumber(entry.totalVotes)}</span>
      ${deltaMarkup}`;

  return `<div class="${className}"${isCurrent ? ' aria-current="true"' : ''}>${body}</div>`;
}

export function renderMyEstablishmentNeighbors(containerId, entries, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    mode = 'delta24h',
    establishmentKey = null,
    emptyMessage = 'Établissement introuvable.',
  } = options;

  if (!establishmentKey) {
    container.innerHTML = '';
    return;
  }

  const sorted = sortEstablishmentsForMode(entries, mode);
  const idx = sorted.findIndex((item) => item.key === establishmentKey);

  if (idx < 0) {
    container.innerHTML = `<p class="list-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  const start = Math.max(0, idx - 2);
  const end = Math.min(sorted.length, idx + 3);
  const slice = sorted.slice(start, end);

  container.innerHTML = slice
    .map((entry) =>
      renderEstablishmentNeighborRow(entry, { currentKey: establishmentKey, mode })
    )
    .join('');
}
