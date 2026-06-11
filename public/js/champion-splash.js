import {
  sortPodcastsForMode,
  formatDeltaMarkup,
  formatRankDeltaMarkup,
} from './data.js';
import {
  BOOST_STORY_BADGES,
  findRemontada,
  findFlopDuJour,
  resolveBoostBadgeLabel,
} from './boost-du-jour.js';
import { getBadgeLabel } from './badge-labels.js';
import { computePodcastBadges } from './podcast-badges.js';

const SPLASH_DURATION_MS = 4000;
const LAST_STORY_KEY = 'webradio-podium-splash-last';

const SPLASH_VARIANTS = {
  'crown-drop': {
    id: 'crown-drop',
    particleEmojis: ['🥇', '✨', '👑'],
  },
  'en-feu': {
    id: 'en-feu',
    particleEmojis: ['🔥', '💥', '🔥'],
  },
  'rocket-boost': {
    id: 'rocket-boost',
    particleEmojis: ['🚀', '⭐', '💫'],
  },
  'medal-shine': {
    id: 'medal-shine',
    particleEmojis: ['🥇', '🥈', '🥉'],
  },
  'sparkle-party': {
    id: 'sparkle-party',
    particleEmojis: ['✨', '🌟', '💫', '⭐'],
  },
  'voltage-pulse': {
    id: 'voltage-pulse',
    particleEmojis: ['⚡', '💥', '⚡'],
  },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVotes(n) {
  return new Intl.NumberFormat('fr-FR').format(n ?? 0);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function storyKey(story) {
  return `${story.storyId}-${story.slug}`;
}

function makeStory(storyId, row, {
  label,
  badge,
  statHtml,
  heroEmoji,
  variantIds,
}) {
  return {
    storyId,
    slug: row.slug,
    title: row.title,
    label,
    badge,
    statHtml,
    heroEmoji,
    variantIds,
  };
}

export function buildPodcastSplashStories(rows) {
  if (!rows.length) return [];

  const stories = [];
  const seen = new Set();
  const add = (story) => {
    const key = storyKey(story);
    if (seen.has(key)) return;
    seen.add(key);
    stories.push(story);
  };

  const sortedTotal = sortPodcastsForMode(rows, 'total');
  const sortedDelta = sortPodcastsForMode(rows, 'delta24h');
  const champion = sortedTotal[0];
  const enFeu = sortedDelta[0];

  if (champion) {
    add(
      makeStory('champion', champion, {
        label: getBadgeLabel('champion'),
        badge: { emoji: '👑', label: 'Sur le podium' },
        statHtml: `domine avec <strong class="champion-splash-votes">${formatVotes(champion.votes)}</strong> votes au total`,
        heroEmoji: '👑',
        variantIds: ['crown-drop', 'medal-shine'],
      })
    );
  }

  if (enFeu && enFeu.slug !== champion?.slug && (enFeu.deltaVotes ?? 0) > 0) {
    add(
      makeStory('enFeu', enFeu, {
        label: resolveBoostBadgeLabel(BOOST_STORY_BADGES.enFeu),
        badge: BOOST_STORY_BADGES.enFeu,
        statHtml: formatDeltaMarkup(enFeu.deltaVotes, { trailing: ' votes aujourd\u2019hui' }),
        heroEmoji: BOOST_STORY_BADGES.enFeu.emoji,
        variantIds: ['en-feu'],
      })
    );
  }

  const remontada = findRemontada(rows);
  if (remontada) {
    add(
      makeStory('remontada', remontada, {
        label: resolveBoostBadgeLabel(BOOST_STORY_BADGES.remontada),
        badge: BOOST_STORY_BADGES.remontada,
        statHtml: formatRankDeltaMarkup(remontada.deltaRankByDelta24h ?? 0),
        heroEmoji: BOOST_STORY_BADGES.remontada.emoji,
        variantIds: ['rocket-boost'],
      })
    );
  }

  const flop = findFlopDuJour(rows);
  if (flop) {
    add(
      makeStory('flop', flop, {
        label: resolveBoostBadgeLabel(BOOST_STORY_BADGES.flop),
        badge: BOOST_STORY_BADGES.flop,
        statHtml: formatRankDeltaMarkup(flop.deltaRankByDelta24h ?? 0),
        heroEmoji: BOOST_STORY_BADGES.flop.emoji,
        variantIds: ['voltage-pulse'],
      })
    );
  }

  for (const badge of computePodcastBadges(rows)) {
    if (badge.type === 'champion' || badge.type === 'flop') continue;

    if (badge.type === 'underdog') {
      const row = rows.find((entry) => entry.slug === badge.slug);
      if (!row) continue;
      add(
        makeStory('underdog', row, {
          label: badge.title,
          badge: { emoji: badge.emoji, label: getBadgeLabel('underdog') },
          statHtml: escapeHtml(badge.text),
          heroEmoji: badge.emoji,
          variantIds: ['sparkle-party', 'voltage-pulse'],
        })
      );
    }

    if (badge.type === 'gem') {
      const row = rows.find((entry) => entry.slug === badge.slug);
      if (!row) continue;
      add(
        makeStory('gem', row, {
          label: badge.title,
          badge: { emoji: badge.emoji, label: getBadgeLabel('gem') },
          statHtml: escapeHtml(badge.text),
          heroEmoji: badge.emoji,
          variantIds: ['sparkle-party'],
        })
      );
    }
  }

  return stories;
}

function pickSplashStory(stories) {
  if (!stories.length) return null;

  let pool = stories;
  try {
    const lastKey = sessionStorage.getItem(LAST_STORY_KEY);
    if (lastKey && stories.length > 1) {
      const filtered = stories.filter((story) => storyKey(story) !== lastKey);
      if (filtered.length) pool = filtered;
    }
  } catch {
    /* ignore storage errors */
  }

  const picked = pickRandom(pool);
  try {
    sessionStorage.setItem(LAST_STORY_KEY, storyKey(picked));
  } catch {
    /* ignore storage errors */
  }

  return picked;
}

function pickVariant(story) {
  const variantId = pickRandom(story.variantIds);
  return SPLASH_VARIANTS[variantId] ?? SPLASH_VARIANTS['crown-drop'];
}

function buildParticles(variant) {
  const emojis = variant.particleEmojis;
  return emojis
    .map((emoji, i) => {
      const angle = (360 / emojis.length) * i + Math.random() * 40 - 20;
      const delay = (Math.random() * 0.25).toFixed(2);
      const dist = 55 + Math.random() * 35;
      return `<span class="champion-splash-particle" style="--angle:${angle}deg;--dist:${dist}px;--delay:${delay}s" aria-hidden="true">${emoji}</span>`;
    })
    .join('');
}

let activeSplash = null;

export function showChampionSplash(rows, { getEstablishmentLabel, onOpenPodcast, onDismiss } = {}) {
  const story = pickSplashStory(buildPodcastSplashStories(rows));
  if (!story) return;
  dismissChampionSplash();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const variant = pickVariant(story);
  const establishment = getEstablishmentLabel?.(rows.find((row) => row.slug === story.slug)) ?? '';
  const establishmentLine = establishment
    ? `<p class="champion-splash-establishment">${escapeHtml(establishment)}</p>`
    : '';
  const badgeLabel = story.badge.type ? resolveBoostBadgeLabel(story.badge) : story.badge.label;
  const badgeLine =
    badgeLabel && badgeLabel !== story.label
      ? `<span class="champion-splash-badge" aria-hidden="true">${story.badge.emoji} ${escapeHtml(badgeLabel)}</span>`
      : '';

  const overlay = document.createElement('div');
  overlay.className = `champion-splash champion-splash--${variant.id} champion-splash--story-${story.storyId}`;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `${story.label} : ${story.title}`);

  overlay.innerHTML = `
    <button type="button" class="champion-splash-backdrop" aria-label="Fermer"></button>
    <div class="champion-splash-particles">${buildParticles(variant)}</div>
    <article class="champion-splash-card" tabindex="0">
      <button type="button" class="champion-splash-crown" aria-label="${escapeHtml(story.label)}">${story.heroEmoji}</button>
      <p class="champion-splash-label">${escapeHtml(story.label)}</p>
      <h2 class="champion-splash-title">${escapeHtml(story.title)}</h2>
      ${establishmentLine}
      <p class="champion-splash-stat">${story.statHtml}</p>
      ${badgeLine}
      <p class="champion-splash-hint">Touche pour voir le podcast · se ferme dans 4 s</p>
      <div class="champion-splash-progress" aria-hidden="true">
        <span class="champion-splash-progress-bar"></span>
      </div>
    </article>`;

  document.body.appendChild(overlay);

  const duration = reducedMotion ? 2500 : SPLASH_DURATION_MS;
  const progressBar = overlay.querySelector('.champion-splash-progress-bar');
  if (progressBar) {
    progressBar.style.animationDuration = `${duration}ms`;
  }

  requestAnimationFrame(() => {
    overlay.classList.add('champion-splash--visible');
  });

  let closed = false;
  const close = (reason) => {
    if (closed) return;
    closed = true;
    window.clearTimeout(autoTimer);
    overlay.classList.remove('champion-splash--visible');
    overlay.classList.add('champion-splash--closing');
    window.setTimeout(() => {
      overlay.remove();
      if (activeSplash === overlay) activeSplash = null;
      onDismiss?.(reason);
    }, reducedMotion ? 120 : 280);
  };

  const autoTimer = window.setTimeout(() => close('auto'), duration);
  activeSplash = overlay;

  overlay.querySelector('.champion-splash-backdrop')?.addEventListener('click', () => close('backdrop'));

  const card = overlay.querySelector('.champion-splash-card');
  card?.addEventListener('click', (e) => {
    if (e.target.closest('.champion-splash-crown')) return;
    if (story.slug && onOpenPodcast) onOpenPodcast(story.slug);
    close('card');
  });

  const hero = overlay.querySelector('.champion-splash-crown');
  hero?.addEventListener('click', (e) => {
    e.stopPropagation();
    hero.classList.remove('champion-splash-crown--bounce');
    void hero.offsetWidth;
    hero.classList.add('champion-splash-crown--bounce');
  });

  card?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close('escape');
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (story.slug && onOpenPodcast) onOpenPodcast(story.slug);
      close('keyboard');
    }
  });
}

export function dismissChampionSplash() {
  activeSplash?.querySelector('.champion-splash-backdrop')?.click();
}
