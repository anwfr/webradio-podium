import { getBadgeLabel } from './badge-labels.js';
import { formatHighlightNumberMarkup } from './data.js';

export function truncatePodcastTitle(title, max = 48) {
  if (!title || title.length <= max) return title || 'Podcast';
  return `${title.slice(0, max - 1)}…`;
}

function badgeFromPodcast(row, { emoji, type, text, statMarkup }) {
  return {
    emoji,
    type,
    title: getBadgeLabel(type),
    text,
    statMarkup,
    slug: row.slug,
    podcastTitle: row.title,
  };
}

export function computePodcastBadges(rows) {
  if (!rows.length) return [];

  const byDelta = [...rows].sort((a, b) => a.rankByDelta24h - b.rankByDelta24h);
  const byTotal = [...rows].sort((a, b) => a.rankByTotal - b.rankByTotal);
  const badges = [];

  const champion = byTotal[0];
  if (champion) {
    badges.push(
      badgeFromPodcast(champion, {
        emoji: '👑',
        type: 'champion',
        text: `Domine avec ${champion.votes} votes au total`,
        statMarkup: `Domine avec ${formatHighlightNumberMarkup(champion.votes)} votes au total`,
      })
    );
  }

  const flop = [...rows]
    .filter((row) => row.deltaRankByDelta24h <= -1)
    .sort((a, b) => a.deltaRankByDelta24h - b.deltaRankByDelta24h)[0];
  if (flop) {
    badges.push(
      badgeFromPodcast(flop, {
        emoji: '📉',
        type: 'flop',
        text: `Chute de ${Math.abs(flop.deltaRankByDelta24h)} places aujourd'hui`,
        statMarkup: `Chute de ${formatHighlightNumberMarkup(Math.abs(flop.deltaRankByDelta24h), { tone: 'neg' })} places <span class="badge-stat-muted">aujourd\u2019hui</span>`,
      })
    );
  }

  const underdog = byDelta.find(
    (row) => row.rankByTotal > 15 && row.rankByDelta24h <= 10 && row.deltaVotes > 0
  );
  if (underdog) {
    badges.push(
      badgeFromPodcast(underdog, {
        emoji: '⚡',
        type: 'underdog',
        text: `Surprend depuis la #${underdog.rankByTotal}`,
        statMarkup: `Surprend depuis la ${formatHighlightNumberMarkup(underdog.rankByTotal)}`,
      })
    );
  }

  const gem = byDelta.find(
    (row) => row.rankByTotal > 20 && row.rankByDelta24h <= 5 && row.deltaVotes > 0
  );
  if (gem) {
    badges.push(
      badgeFromPodcast(gem, {
        emoji: '💫',
        type: 'gem',
        text: `Explose dans le top 5 du jour`,
        statMarkup: `Explose dans le top ${formatHighlightNumberMarkup(5)} du jour`,
      })
    );
  }

  const used = new Set();
  return badges
    .filter((badge) => {
      if (used.has(badge.slug)) return false;
      used.add(badge.slug);
      return true;
    })
    .slice(0, 3);
}
