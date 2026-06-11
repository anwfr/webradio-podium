import {
  formatDelta,
  formatRankDelta,
  formatDeltaMarkup,
  formatRankDeltaMarkup,
} from './data.js';
import { getBadgeLabel } from './badge-labels.js';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function findRemontada(items, { rankDeltaField = 'deltaRankByDelta24h', minDelta = 1 } = {}) {
  return (
    [...items]
      .filter((item) => (item[rankDeltaField] ?? 0) >= minDelta)
      .sort((a, b) => b[rankDeltaField] - a[rankDeltaField])[0] ?? null
  );
}

export function findFlopDuJour(items, { rankDeltaField = 'deltaRankByDelta24h', maxDelta = -1 } = {}) {
  return (
    [...items]
      .filter((item) => (item[rankDeltaField] ?? 0) <= maxDelta)
      .sort((a, b) => a[rankDeltaField] - b[rankDeltaField])[0] ?? null
  );
}

export const BOOST_STORY_BADGES = {
  enFeu: { emoji: '🔥', type: 'enFeu' },
  remontada: { emoji: '🚀', type: 'remontada' },
  flop: { emoji: '📉', type: 'flop' },
};

export function resolveBoostBadgeLabel(badge) {
  if (badge?.type) return getBadgeLabel(badge.type);
  return badge?.label || '';
}

export function buildBoostSecondaryStories(items, hero, { keyField, rankDeltaField = 'deltaRankByDelta24h' } = {}) {
  const heroKey = hero?.[keyField];
  const remontada = findRemontada(items, { rankDeltaField });
  const flop = findFlopDuJour(items, { rankDeltaField });
  const stories = [];

  if (remontada && remontada[keyField] !== heroKey) {
    stories.push({ item: remontada, badge: BOOST_STORY_BADGES.remontada, story: 'remontada' });
  }

  const usedKeys = new Set(stories.map(({ item }) => item[keyField]));
  if (flop && flop[keyField] !== heroKey && !usedKeys.has(flop[keyField])) {
    stories.push({ item: flop, badge: BOOST_STORY_BADGES.flop, story: 'flop' });
  }

  return stories;
}

export function renderBoostCardHeadMarkup(badge) {
  return `
    <div class="boost-card-head">
      <span class="boost-card-badge">
        <span class="boost-card-badge-emoji" aria-hidden="true">${badge.emoji}</span>
        <span class="boost-card-badge-label">${escapeHtml(resolveBoostBadgeLabel(badge))}</span>
      </span>
    </div>`;
}

export function renderBoostStatsMarkup(story, { deltaVotes = 0, rankDelta = 0 } = {}) {
  if (story === 'remontada' || story === 'flop') {
    return formatRankDelta(rankDelta).text;
  }

  return `${formatDelta(deltaVotes).text} votes`;
}

export function boostStoryStatMarkup(story, item, { rankDeltaField = 'deltaRankByDelta24h' } = {}) {
  if (story === 'remontada' || story === 'flop') {
    return formatRankDeltaMarkup(item[rankDeltaField] ?? 0);
  }

  return formatDeltaMarkup(item.deltaVotes, { trailing: ' votes' });
}

export function boostStoryStatText(story, item, { rankDeltaField = 'deltaRankByDelta24h' } = {}) {
  if (story === 'remontada' || story === 'flop') {
    return formatRankDelta(item[rankDeltaField] ?? 0).text;
  }

  return `${formatDelta(item.deltaVotes).text} votes`;
}

export function renderHighlightBadgeCard({
  emoji,
  label,
  name = '',
  establishment = '',
  text = '',
  statMarkup = '',
  href = null,
  slug = null,
  city = '',
  link = false,
  interactive = false,
  title = '',
}) {
  const cityMarkup = city
    ? `<span class="podium-establishment-city establishment-badge-city">${escapeHtml(city)}</span>`
    : '';
  const nameMarkup = name
    ? `<p class="podcast-badge-name">${escapeHtml(name)}</p>`
    : '';
  const establishmentMarkup = establishment
    ? `<p class="podcast-badge-establishment">${escapeHtml(establishment)}</p>`
    : '';
  const actionTitle = title ? ` title="${escapeHtml(title)}"` : '';
  let tag = 'div';
  let className = 'establishment-badge-card';
  let extraAttrs = '';

  if (interactive) {
    tag = 'button';
    className = 'establishment-badge-card establishment-badge-card--chart';
    extraAttrs = ' type="button"';
  } else if (link && href) {
    tag = 'a';
    className = 'establishment-badge-card establishment-badge-card--link podcast-badge-card';
    extraAttrs = ` href="${escapeHtml(href)}"`;
    if (slug) extraAttrs += ` data-slug="${escapeHtml(slug)}"`;
  }

  const statContent = statMarkup || escapeHtml(text);

  return `
    <${tag}${extraAttrs} class="${className}"${actionTitle}>
      <span class="establishment-badge-card-emoji" aria-hidden="true">${emoji}</span>
      <div class="establishment-badge-card-body">
        <div class="establishment-badge-card-head">
          <strong class="establishment-badge-card-title">${escapeHtml(label)}</strong>
          ${cityMarkup}
        </div>
        ${nameMarkup}
        ${establishmentMarkup}
        <p class="establishment-badge-card-text">${statContent}</p>
      </div>
    </${tag}>`;
}

export function renderBoostDuJourCards(cardsMarkup) {
  return cardsMarkup.filter(Boolean).join('');
}

export function bindBoostCardClicks(container, { onActivate, linkSelector = '.boost-card--link' }) {
  if (!container || !onActivate) return;

  container.querySelectorAll(linkSelector).forEach((card) => {
    const activate = (e) => {
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e.type === 'keydown') e.preventDefault();
      if (e.target.closest('.establishment-chip, .podium-establishment-link')) return;
      onActivate(card);
    };

    card.addEventListener('click', activate);
    card.addEventListener('keydown', activate);
  });
}
