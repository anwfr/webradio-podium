import {
  formatDeltaMarkup,
  formatRankDeltaMarkup,
  formatRankOrdinal,
  podiumVotesDisplay,
  totalRankDelta,
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
import { parsePodiumEstablishmentDisplay } from './establishment.js';

function resolvePodcastEstablishmentMeta(row, getEstablishmentLabel) {
  const label = getEstablishmentLabel?.(row) || row.establishment || row.school || '';
  if (!label) return { city: '', establishmentName: '' };

  const { city, establishmentName } = parsePodiumEstablishmentDisplay(label, {
    key: row.establishmentKey,
    school: row.school,
  });
  return { city, establishmentName: establishmentName || label };
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderPodcastBadges(rows, containerId, { openPodcastDetail, getEstablishmentLabel } = {}) {
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
      const linkTitle = `Voir ${badge.podcastTitle || badge.slug}`;
      return renderHighlightBadgeCard({
        emoji: badge.emoji,
        label: badge.title,
        text: badge.text,
        statMarkup: badge.statMarkup,
        city: badge.city,
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

function renderPodcastBoostCard(row, { badge, story = null, getEstablishmentLabel }) {
  const { city } = resolvePodcastEstablishmentMeta(row, getEstablishmentLabel);
  const title = truncatePodcastTitle(row.title);

  return renderHighlightBadgeCard({
    emoji: badge.emoji,
    label: resolveBoostBadgeLabel(badge),
    city,
    statMarkup: `${escapeHtml(title)} ${boostStoryStatMarkup(story ?? 'enFeu', row)}`,
    href: buildPodcastUrl(row.slug),
    slug: row.slug,
    link: true,
    title: `Voir ${row.title}`,
  });
}

export function renderPodcastBoostDuJour(rows, containerId, {
  openPodcastDetail,
  getEstablishmentLabel,
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
    renderPodcastBoostCard(hero, {
      badge: BOOST_STORY_BADGES.enFeu,
      story: 'enFeu',
      getEstablishmentLabel,
    }),
    ...secondaryStories.map(({ item, badge, story }) =>
      renderPodcastBoostCard(item, { badge, story, getEstablishmentLabel })
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

    const { value: primaryValue, label: primaryLabel } = podiumVotesDisplay({
      votes: row.votes,
      deltaVotes: row.deltaVotes,
      mode: 'total',
    });
    const votesMarkup = `<div class="podium-votes-wrap">
            <span class="podium-votes">${primaryValue}</span>
            <span class="podium-votes-label">${primaryLabel}</span>
          </div>`;

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

function podcastListRank(row, { ordinalRank = false } = {}) {
  return ordinalRank ? row.localRank ?? row.rank : row.displayRank ?? row.rank;
}

function podcastCardTierClass(row, { sortMode = 'total', ordinalRank = false } = {}) {
  if (ordinalRank || sortMode !== 'total') return '';
  const rank = podcastListRank(row, { ordinalRank });
  if (rank === 1) return ' podcast-card--tier-1';
  if (rank === 2) return ' podcast-card--tier-2';
  if (rank === 3) return ' podcast-card--tier-3';
  return '';
}

function rankBadgeTierClass(row, { sortMode = 'total', ordinalRank = false } = {}) {
  if (ordinalRank || sortMode !== 'total') return '';
  const rank = podcastListRank(row, { ordinalRank });
  if (rank === 1) return ' rank-list-badge--tier-1';
  if (rank === 2) return ' rank-list-badge--tier-2';
  if (rank === 3) return ' rank-list-badge--tier-3';
  return '';
}

function rankDisplay(row, { showGlobalRankHint = false, sortMode = 'total', ordinalRank = false } = {}) {
  if (showGlobalRankHint) {
    return `<span class="podcast-card-rank rank-list-badge">${formatRankOrdinal(row.localRank)}</span><span class="podcast-card-rank-hint">#${row.globalRank} global</span>`;
  }

  if (sortMode === 'delta24h') {
    return `<span class="podcast-card-rank podcast-card-rank--delta">${formatDeltaMarkup(row.deltaVotes, { trailing: ' votes' })}</span>`;
  }

  const rank = podcastListRank(row, { ordinalRank });
  const rankText = ordinalRank ? formatRankOrdinal(rank) : rank;
  const tierClass = rankBadgeTierClass(row, { sortMode, ordinalRank });
  return `<span class="podcast-card-rank rank-list-badge${tierClass}">${rankText}</span>`;
}

function podcastCardStatsMarkup(row, sortMode = 'total') {
  const rankDeltaMarkup = formatRankDeltaMarkup(totalRankDelta(row));

  if (sortMode === 'delta24h') {
    return `<div class="podcast-card-stats">
          ${rankDeltaMarkup ? `<span class="podcast-card-delta">${rankDeltaMarkup}</span>` : ''}
        </div>`;
  }

  return `<div class="podcast-card-stats">
          <span class="podcast-card-votes"><strong>${row.votes}</strong> votes</span>
          <span class="podcast-card-delta">${formatDeltaMarkup(row.deltaVotes, { trailing: ' aujourd\u2019hui' })}</span>
          ${rankDeltaMarkup ? `<span class="podcast-card-delta">${rankDeltaMarkup}</span>` : ''}
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
  const tierClass = podcastCardTierClass(row, { sortMode, ordinalRank });
  const establishmentBlock =
    showEstablishment && establishmentCellMarkup
      ? `<div class="podcast-card-establishment${establishmentDisplay === 'podium' ? ' podcast-card-establishment--podium' : ''}">${establishmentCellMarkup(row, { display: establishmentDisplay })}</div>`
      : '';

  return `
    <article class="podcast-card${highlightClass}${tierClass}" id="card-${escapeHtml(row.slug)}" data-slug="${escapeHtml(row.slug)}">
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
