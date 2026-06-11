import { getBadgeLabel } from './badge-labels.js';
import { formatHighlightNumberMarkup, formatDeltaMarkup } from './data.js';
import { findRemontada } from './boost-du-jour.js';
import { parsePodiumEstablishmentDisplay, resolveEstablishmentCity } from './establishment.js';

export function truncatePodcastTitle(title, max = 48) {
  if (!title || title.length <= max) return title || 'Podcast';
  return `${title.slice(0, max - 1)}…`;
}

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

function podcastStatLine(title, phraseMarkup) {
  return `${escapeStatText(truncatePodcastTitle(title))} ${phraseMarkup}`;
}

function badgeFromPodcast(row, { emoji, type, text, statMarkup }) {
  const label = row.establishment || row.school || '';
  const { city } = parsePodiumEstablishmentDisplay(label, {
    key: row.establishmentKey,
    school: row.school,
  });

  return {
    emoji,
    type,
    title: getBadgeLabel(type),
    text,
    statMarkup,
    slug: row.slug,
    podcastTitle: row.title,
    city: city || resolveEstablishmentCity({ label, key: row.establishmentKey }),
  };
}

export function computePodcastBadges(rows) {
  if (!rows.length) return [];

  const byDelta = [...rows].sort((a, b) => a.rankByDelta24h - b.rankByDelta24h);
  const badges = [];

  const enFeu = byDelta.find((row) => (row.deltaVotes ?? 0) > 0);
  if (enFeu) {
    badges.push(
      badgeFromPodcast(enFeu, {
        emoji: '🔥',
        type: 'enFeu',
        text: `${truncatePodcastTitle(enFeu.title)} cartonne avec ${enFeu.deltaVotes} votes aujourd'hui`,
        statMarkup: podcastStatLine(
          enFeu.title,
          `cartonne avec ${formatDeltaMarkup(enFeu.deltaVotes, { trailing: ' votes aujourd\u2019hui' })}`
        ),
      })
    );
  }

  const flop = [...rows]
    .filter((row) => row.deltaRankByDelta24h <= -1)
    .sort((a, b) => a.deltaRankByDelta24h - b.deltaRankByDelta24h)[0];
  if (flop) {
    const flopPlaces = Math.abs(flop.deltaRankByDelta24h);
    badges.push(
      badgeFromPodcast(flop, {
        emoji: '📉',
        type: 'flop',
        text: `${truncatePodcastTitle(flop.title)} chute de ${flopPlaces} ${placeWord(flopPlaces)} aujourd'hui`,
        statMarkup: podcastStatLine(
          flop.title,
          `chute de ${formatHighlightNumberMarkup(flopPlaces, { tone: 'neg' })} ${placeWord(flopPlaces)} <span class="badge-stat-muted">aujourd\u2019hui</span>`
        ),
      })
    );
  }

  const remontada = findRemontada(rows);
  if (remontada) {
    const remontadaPlaces = remontada.deltaRankByDelta24h ?? 0;
    badges.push(
      badgeFromPodcast(remontada, {
        emoji: '🚀',
        type: 'remontada',
        text: `${truncatePodcastTitle(remontada.title)} remonte de ${remontadaPlaces} ${placeWord(remontadaPlaces)} aujourd'hui`,
        statMarkup: podcastStatLine(
          remontada.title,
          `remonte de ${formatHighlightNumberMarkup(remontadaPlaces)} ${placeWord(remontadaPlaces)} <span class="badge-stat-muted">aujourd\u2019hui</span>`
        ),
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
        text: `${truncatePodcastTitle(gem.title)} explose dans le top 5 du jour`,
        statMarkup: podcastStatLine(
          gem.title,
          `explose dans le top ${formatHighlightNumberMarkup(5)} <span class="badge-stat-muted">du jour</span>`
        ),
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
