import {
  fetchPage,
  initSession,
  randomDelay,
  rateLimitCooldown,
  getLastReferer,
} from './fetcher.js';
import {
  extractLastPageIndex,
  extractSlugsFromListHtml,
  listPageUrl,
  parsePodcastPage,
  mergeParticipant,
  resourceUrl,
} from './parser.js';
import { config } from './config.js';
import {
  DELAY_BETWEEN_FICHES_MS,
  DELAY_BETWEEN_LIST_PAGES_MS,
  DELAY_AFTER_LIST_FIRST_MS,
} from './constants.js';

export async function crawlAllListSlugs({ onListPageProgress } = {}) {
  initSession();
  const firstHtml = await fetchPage(listPageUrl(0), {
    referer: config.afdBaseUrl,
  });
  await randomDelay(
    DELAY_AFTER_LIST_FIRST_MS.min,
    DELAY_AFTER_LIST_FIRST_MS.max
  );

  const lastPage = extractLastPageIndex(firstHtml);
  const allSlugs = new Set(extractSlugsFromListHtml(firstHtml));

  if (onListPageProgress) {
    onListPageProgress(0, lastPage, allSlugs.size);
  }

  for (let page = 1; page <= lastPage; page++) {
    await randomDelay(
      DELAY_BETWEEN_LIST_PAGES_MS.min,
      DELAY_BETWEEN_LIST_PAGES_MS.max
    );
    const html = await fetchPage(listPageUrl(page), {
      referer: listPageUrl(page - 1),
    });
    for (const slug of extractSlugsFromListHtml(html)) {
      allSlugs.add(slug);
    }
    if (onListPageProgress) {
      onListPageProgress(page, lastPage, allSlugs.size);
    }
  }

  return [...allSlugs];
}

export async function fetchAndParsePodcast(slug, referer) {
  const html = await fetchPage(resourceUrl(slug), {
    referer: referer ?? getLastReferer(),
  });
  return parsePodcastPage(html, slug);
}

export async function visitParticipants(
  slugs,
  participantsMap,
  validatedAt,
  { onProgress, onError } = {}
) {
  const errors = [];
  let index = 0;
  let lastReferer = config.listUrl;

  for (const slug of slugs) {
    index++;
    if (onProgress) onProgress(index, slugs.length, slug, errors.length);

    try {
      await randomDelay(
        DELAY_BETWEEN_FICHES_MS.min,
        DELAY_BETWEEN_FICHES_MS.max
      );
      const parsed = await fetchAndParsePodcast(slug, lastReferer);
      lastReferer = resourceUrl(slug);

      const existing = participantsMap.get(slug);
      const merged = mergeParticipant(existing, parsed, validatedAt);
      participantsMap.set(slug, merged);
    } catch (err) {
      const code =
        err.status === 404
          ? 'http_404'
          : err.status === 429
            ? 'http_429'
            : 'fetch_error';

      errors.push({
        slug,
        code,
        message: err.message,
      });

      if (onError) onError(slug, err, errors.length);

      if (err.status === 429) {
        await rateLimitCooldown('429 sur fiche');
      }

      if (err.status === 404 && participantsMap.has(slug)) {
        const p = participantsMap.get(slug);
        p.active = false;
        p.voteStatus = 'closed';
        participantsMap.set(slug, p);
      }
    }
  }

  return errors;
}
