import { initSession, randomDelay, rateLimitCooldown } from './lib/fetcher.js';
import { DELAY_BETWEEN_FICHES_MS } from './lib/constants.js';
import { resourceUrl } from './lib/parser.js';
import { fetchAndParsePodcast } from './lib/list-crawl.js';
import { mergeParticipant } from './lib/parser.js';
import { config } from './lib/config.js';
import {
  loadParticipants,
  loadVotesHistory,
  saveParticipants,
  saveVotesHistory,
  ensureDataFiles,
} from './lib/storage.js';
import { formatParisIso, getSnapshotTimestamp, nowParis } from './lib/time.js';
import { votesMap } from './lib/snapshot-window.js';

export async function runScrapeVotes(snapshotTimestamp, { progress } = {}) {
  ensureDataFiles();
  const ts = snapshotTimestamp || formatParisIso(getSnapshotTimestamp());
  const participantsData = loadParticipants();
  const history = loadVotesHistory();
  const validatedAt = formatParisIso(nowParis());
  const existingIdx = history.snapshots.findIndex((s) => s.timestamp === ts);

  initSession();
  const errors = [];
  const entries = [];
  const participants = participantsData.participants.map((p) => ({ ...p }));
  const active = participants.filter((p) => p.active);
  let lastReferer = config.listUrl;

  const lastSnapshot =
    existingIdx >= 0
      ? history.snapshots.filter((_, i) => i !== existingIdx).at(-1)
      : history.snapshots.at(-1);
  const referenceVotes = lastSnapshot ? votesMap(lastSnapshot) : new Map();
  let cumulativeVoteDelta = 0;

  const baselineVotes = (slug, participant) => {
    if (referenceVotes.has(slug)) return referenceVotes.get(slug);
    if (participant.lastVotes != null) return participant.lastVotes;
    return 0;
  };

  if (progress) progress.setPhase('scrape_votes', active.length);

  for (const participant of active) {
    let voteDelta = null;
    let currentVotes = null;
    const previousVotes = baselineVotes(participant.slug, participant);

    try {
      await randomDelay(
        DELAY_BETWEEN_FICHES_MS.min,
        DELAY_BETWEEN_FICHES_MS.max
      );
      const parsed = await fetchAndParsePodcast(
        participant.slug,
        lastReferer
      );
      lastReferer = resourceUrl(participant.slug);

      const merged = mergeParticipant(participant, parsed, validatedAt);
      const idx = participants.findIndex((p) => p.slug === participant.slug);
      participants[idx] = merged;

      if (parsed.voteStatus === 'closed') {
        merged.active = false;
        merged.voteStatus = 'closed';
      }

      if (parsed.votes != null) {
        currentVotes = parsed.votes;
        voteDelta = currentVotes - previousVotes;
        cumulativeVoteDelta += voteDelta;
      } else if (merged.lastVotes != null) {
        currentVotes = merged.lastVotes;
        voteDelta = currentVotes - previousVotes;
        cumulativeVoteDelta += voteDelta;
      }

      if (merged.active && parsed.votes != null) {
        entries.push({ slug: merged.slug, votes: parsed.votes });
      } else if (merged.lastVotes != null && merged.active) {
        entries.push({ slug: merged.slug, votes: merged.lastVotes });
      }
    } catch (err) {
      errors.push({
        slug: participant.slug,
        step: 'scrape-votes',
        code: err.status === 429 ? 'http_429' : 'fetch_error',
        message: err.message,
      });
      if (err.status === 429) {
        await rateLimitCooldown('429 sur fiche');
      }
      if (participant.lastVotes != null) {
        currentVotes = participant.lastVotes;
        entries.push({
          slug: participant.slug,
          votes: participant.lastVotes,
        });
        voteDelta = currentVotes - previousVotes;
        cumulativeVoteDelta += voteDelta;
      }
    } finally {
      if (progress) {
        progress.tick(participant.slug, {
          errorCount: errors.length,
          voteDelta,
          cumulativeVoteDelta,
          votes: currentVotes,
          previousVotes,
        });
      }
    }
  }

  if (entries.length > 0) {
    const snapshot = {
      timestamp: ts,
      entries: entries.sort((a, b) => a.slug.localeCompare(b.slug)),
    };
    if (existingIdx >= 0) {
      history.snapshots[existingIdx] = snapshot;
    } else {
      history.snapshots.push(snapshot);
    }
    saveVotesHistory(history);
  }

  saveParticipants({
    updatedAt: validatedAt,
    participants,
  });

  return {
    snapshotTimestamp: ts,
    errors,
    entriesCount: entries.length,
    scrapeErrors: errors.length,
    cumulativeVoteDelta,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runScrapeVotes()
    .then((r) => {
      console.log(
        `Scraped ${r.entriesCount} entries for ${r.snapshotTimestamp}`
      );
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
