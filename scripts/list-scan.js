import {
  crawlAllListSlugs,
  fetchAndParsePodcast,
} from './lib/list-crawl.js';
import { initSession, randomDelay } from './lib/fetcher.js';
import { mergeParticipant, resourceUrl } from './lib/parser.js';
import { config } from './lib/config.js';
import { DELAY_BETWEEN_FICHES_MS } from './lib/constants.js';
import {
  loadParticipants,
  saveParticipants,
  ensureDataFiles,
} from './lib/storage.js';
import { formatParisIso, nowParis } from './lib/time.js';

export async function runListScan({ progress } = {}) {
  ensureDataFiles();
  const data = loadParticipants();
  const validatedAt = formatParisIso(nowParis());
  const knownSlugs = new Set(data.participants.map((p) => p.slug));
  const participantsMap = new Map(
    data.participants.map((p) => [p.slug, { ...p }])
  );

  initSession();
  if (progress) progress.setPhase('list_crawl', 1);

  const listSlugs = await crawlAllListSlugs({
    onListPageProgress: progress
      ? (page, lastPage, slugCount) => {
          progress.tickListPage(page, lastPage, slugCount);
        }
      : undefined,
  });

  if (progress) progress.setListSlugsFound(listSlugs.length);

  const newSlugs = listSlugs.filter((s) => !knownSlugs.has(s));

  const errors = [];
  let newCount = 0;

  if (progress && newSlugs.length > 0) {
    progress.setPhase('visit_new_fiches', newSlugs.length);
  }

  let lastReferer = config.listUrl;
  for (const slug of newSlugs) {
    try {
      await randomDelay(
        DELAY_BETWEEN_FICHES_MS.min,
        DELAY_BETWEEN_FICHES_MS.max
      );
      const parsed = await fetchAndParsePodcast(slug, lastReferer);
      lastReferer = resourceUrl(slug);
      const merged = mergeParticipant(null, parsed, validatedAt);
      participantsMap.set(slug, merged);
      newCount++;
    } catch (err) {
      errors.push({
        slug,
        step: 'list-scan',
        code: 'fetch_error',
        message: err.message,
      });
    } finally {
      if (progress) {
        progress.tick(slug, { errorCount: errors.length });
      }
    }
  }

  const participants = [...participantsMap.values()].sort((a, b) =>
    a.slug.localeCompare(b.slug)
  );

  saveParticipants({
    updatedAt: validatedAt,
    participants,
  });

  return { newCount, errors, participants };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runListScan()
    .then((r) => {
      console.log(`List scan: ${r.newCount} new participant(s)`);
      if (r.errors.length) console.warn('Errors:', r.errors);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
