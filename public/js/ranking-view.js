import {
  formatDeltaMarkup,
  formatRankDeltaMarkup,
  formatRankOrdinal,
  podiumVotesDisplay,
  renderPodium24hStatsMarkup,
} from './data.js';
import {
  BOOST_STORY_BADGES,
  buildBoostSecondaryStories,
  resolveBoostBadgeLabel,
  renderHighlightBadgeCard,
  renderBoostDuJourCards,
  boostStoryStatMarkup,
} from './boost-du-jour.js';
import { buildPodcastUrl } from './podcast-detail.js';
import { computePodcastBadges, truncatePodcastTitle } from './podcast-badges.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPodcastBadges(rows, containerId, { openPodcastDetail } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const badges = computePodcastBadges(rows);
  if (!badges.length) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;
  container.innerHTML = badges
    .map((badge) => {
      const href = buildPodcastUrl(badge.slug);
      const podcastTitle = truncatePodcastTitle(badge.podcastTitle);
      const linkTitle = `Voir ${badge.podcastTitle || badge.slug}`;
      return renderHighlightBadgeCard({
        emoji: badge.emoji,
        label: badge.title,
        name: podcastTitle,
        text: badge.text,
        statMarkup: badge.statMarkup,
        href,
        slug: badge.slug,
        link: true,
        title: linkTitle,
      });
    })
    .join('');

  container.querySelectorAll('.podcast-badge-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const slug = card.dataset.slug;
      if (slug) openPodcastDetail?.(slug);
    });
  });
}

function podcastModeRankDelta(row, mode) {
  return mode === 'total' ? row.deltaRankByTotal : row.deltaRankByDelta24h;
}

function renderPodcastBoostCard(row, { badge, story = null }) {
  return renderHighlightBadgeCard({
    emoji: badge.emoji,
    label: resolveBoostBadgeLabel(badge),
    name: truncatePodcastTitle(row.title),
    statMarkup: boostStoryStatMarkup(story ?? 'enFeu', row),
    href: buildPodcastUrl(row.slug),
    slug: row.slug,
    link: true,
    title: `Voir ${row.title}`,
  });
}

export function renderPodcastBoostDuJour(rows, containerId, {
  openPodcastDetail,
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '';
    container.hidden = true;
    return;
  }

  container.hidden = false;

  const hero = rows[0];
  const secondaryStories = buildBoostSecondaryStories(rows, hero, { keyField: 'slug' });

  const cardsMarkup = [
    renderPodcastBoostCard(hero, { badge: BOOST_STORY_BADGES.enFeu, story: 'enFeu' }),
    ...secondaryStories.map(({ item, badge, story }) =>
      renderPodcastBoostCard(item, { badge, story })
    ),
  ];

  container.innerHTML = renderBoostDuJourCards(cardsMarkup);

  container.querySelectorAll('.podcast-badge-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const slug = card.dataset.slug;
      if (slug) openPodcastDetail?.(slug);
    });
  });
}

export function renderPodium(rows, containerId, {
  establishmentCellMarkup,
  showEstablishment = true,
  establishmentDisplay = 'chip',
  openPodcastDetail,
  mode = 'total',
} = {}) {
  const podium = document.getElementById(containerId);
  if (!podium) return;
  podium.innerHTML = '';

  const top3 = rows.slice(0, 3);
  const order = [1, 0, 2];
  const medals = ['🥇', '🥈', '🥉'];
  order.forEach((idx) => {
    const row = top3[idx];
    if (!row) return;
    const rank = idx + 1;
    const slot = document.createElement('div');
    slot.className = `podium-slot podium-slot--${rank}`;

    const establishmentMarkup =
      showEstablishment && establishmentCellMarkup
        ? `<div class="podium-school podium-school--${establishmentDisplay}">${establishmentCellMarkup(row, { display: establishmentDisplay })}</div>`
        : '';

    const votesMarkup =
      mode === 'delta24h'
        ? renderPodium24hStatsMarkup(
            row.deltaVotes,
            podcastModeRankDelta(row, mode) ?? 0
          )
        : (() => {
            const { value: primaryValue, label: primaryLabel } = podiumVotesDisplay({
              votes: row.votes,
              deltaVotes: row.deltaVotes,
              mode,
            });
            return `<div class="podium-votes-wrap">
            <span class="podium-votes">${primaryValue}</span>
            <span class="podium-votes-label">${primaryLabel}</span>
          </div>
          <p class="podium-delta" title="Votes aujourd'hui">${formatDeltaMarkup(row.deltaVotes, { trailing: ' aujourd\u2019hui' })}</p>`;
          })();

    slot.innerHTML = `
      <article class="podium-card">
        <div class="podium-medal" aria-hidden="true">${medals[idx]}</div>
        <h3 class="podium-title">${escapeHtml(row.title)}</h3>
        ${establishmentMarkup}
        ${votesMarkup}
      </article>
      <div class="podium-step" aria-hidden="true">
        <span class="podium-step-num">${rank}</span>
      </div>`;

    slot.addEventListener('click', (e) => {
      if (e.target.closest('.establishment-chip, .podium-establishment-link')) return;
      openPodcastDetail(row.slug);
    });
    podium.appendChild(slot);
  });
}

function rankDisplay(row, { showGlobalRankHint = false, sortMode = 'total', ordinalRank = false } = {}) {
  if (showGlobalRankHint) {
    return `<span class="podcast-card-rank rank-list-badge">${formatRankOrdinal(row.localRank)}</span><span class="podcast-card-rank-hint">#${row.globalRank} global</span>`;
  }

  if (sortMode === 'delta24h') {
    return `<span class="podcast-card-rank podcast-card-rank--delta">${formatDeltaMarkup(row.deltaVotes, { trailing: ' votes' })}</span>`;
  }

  const rank = row.displayRank ?? row.rank;
  const rankText = ordinalRank ? formatRankOrdinal(rank) : rank;
  return `<span class="podcast-card-rank rank-list-badge">${rankText}</span>`;
}

function podcastCardStatsMarkup(row, sortMode = 'total') {
  if (sortMode === 'delta24h') {
    const rankDeltaMarkup = formatRankDeltaMarkup(row.deltaRankByDelta24h ?? 0);
    return `<div class="podcast-card-stats">
          ${rankDeltaMarkup ? `<span class="podcast-card-delta">${rankDeltaMarkup}</span>` : '<span class="podcast-card-delta delta-zero">Stable</span>'}
        </div>`;
  }

  return `<div class="podcast-card-stats">
          <span class="podcast-card-votes"><strong>${row.votes}</strong> votes</span>
          <span class="podcast-card-delta">${formatDeltaMarkup(row.deltaVotes, { trailing: ' aujourd\u2019hui' })}</span>
        </div>`;
}

export function renderPodcastCard(row, {
  showEstablishment = true,
  showGlobalRankHint = false,
  ordinalRank = false,
  sortMode = 'total',
  establishmentDisplay = 'chip',
  highlightEstablishmentKey = null,
  establishmentCellMarkup,
  openPodcastDetail,
}) {
  const highlightClass =
    highlightEstablishmentKey && row.establishmentKey === highlightEstablishmentKey
      ? ' podcast-card--my-school'
      : '';
  const establishmentBlock =
    showEstablishment && establishmentCellMarkup
      ? `<div class="podcast-card-establishment${establishmentDisplay === 'podium' ? ' podcast-card-establishment--podium' : ''}">${establishmentCellMarkup(row, { display: establishmentDisplay })}</div>`
      : '';

  return `
    <article class="podcast-card${highlightClass}" id="card-${escapeHtml(row.slug)}" data-slug="${escapeHtml(row.slug)}">
      <div class="podcast-card-rank-col">${rankDisplay(row, { showGlobalRankHint, sortMode, ordinalRank })}</div>
      <div class="podcast-card-body">
        <h3 class="podcast-card-title">
          <a href="${buildPodcastUrl(row.slug)}" class="podcast-detail-link">${escapeHtml(row.title)}</a>
        </h3>
        ${establishmentBlock}
        ${podcastCardStatsMarkup(row, sortMode)}
      </div>
    </article>`;
}

export function renderRankingList(containerId, rows, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    showEstablishment = true,
    showGlobalRankHint = false,
    ordinalRank = false,
    filterText = '',
    establishmentDisplay = 'chip',
    highlightEstablishmentKey = null,
    sortMode = 'total',
    establishmentCellMarkup,
    openPodcastDetail,
    emptyMessage = 'Aucun podcast trouvé.',
  } = options;

  const filtered = rows.filter((row) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    const hay = `${row.title} ${row.school} ${row.establishment || ''} ${row.academy}`.toLowerCase();
    return hay.includes(q);
  });

  if (!filtered.length) {
    container.innerHTML = `<p class="list-empty">${escapeHtml(emptyMessage)}</p>`;
    return;
  }

  container.innerHTML = filtered
    .map((row) =>
      renderPodcastCard(row, {
        showEstablishment,
        showGlobalRankHint,
        establishmentDisplay,
        highlightEstablishmentKey,
        sortMode,
        ordinalRank,
        establishmentCellMarkup,
        openPodcastDetail,
      })
    )
    .join('');

  container.querySelectorAll('.podcast-card').forEach((card) => {
    const slug = card.dataset.slug;
    card.addEventListener('click', (e) => {
      if (e.target.closest('a.external-link')) return;
      if (e.target.closest('.establishment-chip, .podium-establishment-link')) return;
      if (e.target.closest('a.podcast-detail-link')) {
        e.preventDefault();
      }
      openPodcastDetail(slug);
    });
  });
}
