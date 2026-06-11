const PHASE_LABELS = {
  list_crawl: 'Parcours liste AFD',
  visit_fiches: 'Visite des fiches',
  visit_new_fiches: 'Nouveaux participants',
  scrape_votes: 'Collecte des votes',
};

const THROTTLED_PHASES = new Set(['visit_fiches', 'visit_new_fiches']);

function formatDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return `${min}m ${rem}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

function formatBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

function formatSignedDelta(n) {
  if (n == null) return '—';
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export class RunProgress {
  constructor({ onUpdate, startTime = Date.now(), logPrefix = 'pipeline' } = {}) {
    this.startTime = startTime;
    this.onUpdate = onUpdate;
    this.logPrefix = logPrefix;
    this.phase = '';
    this.current = 0;
    this.total = 0;
    this.slug = '';
    this.errorCount = 0;
    this.listSlugsFound = 0;
    this.voteDelta = null;
    this.cumulativeVoteDelta = 0;
    this.votes = null;
    this.previousVotes = null;
  }

  setPhase(phase, total = 0) {
    this.phase = phase;
    this.total = total;
    this.current = 0;
    this.slug = '';
    if (phase === 'scrape_votes') {
      this.cumulativeVoteDelta = 0;
      this.voteDelta = null;
      this.votes = null;
      this.previousVotes = null;
    }
    this.emit(true);
  }

  setListSlugsFound(count) {
    this.listSlugsFound = count;
  }

  tick(
    slug,
    {
      errorCount,
      voteDelta,
      cumulativeVoteDelta,
      votes,
      previousVotes,
    } = {}
  ) {
    this.current++;
    this.slug = slug;
    if (errorCount != null) this.errorCount = errorCount;
    if (voteDelta != null) this.voteDelta = voteDelta;
    if (cumulativeVoteDelta != null) {
      this.cumulativeVoteDelta = cumulativeVoteDelta;
    }
    if (votes != null) this.votes = votes;
    if (previousVotes != null) this.previousVotes = previousVotes;
    this.emit();
    this.logConsole();
  }

  tickListPage(pageIndex, lastPage, slugCount) {
    this.current = pageIndex + 1;
    this.total = lastPage + 1;
    this.slug = `page ${pageIndex}`;
    this.listSlugsFound = slugCount;
    this.emit();
    this.logConsole();
  }

  getSnapshot() {
    const elapsedMs = Date.now() - this.startTime;
    const percent =
      this.total > 0
        ? Math.min(100, Math.round((this.current / this.total) * 100))
        : 0;
    const rate = this.current > 0 ? elapsedMs / this.current : 0;
    const remaining = Math.max(0, this.total - this.current);
    const etaMs = rate > 0 ? Math.round(remaining * rate) : null;

    return {
      phase: this.phase,
      phaseLabel: PHASE_LABELS[this.phase] || this.phase,
      current: this.current,
      total: this.total,
      percent,
      slug: this.slug,
      elapsedMs,
      etaMs,
      errors: this.errorCount,
      listSlugsFound: this.listSlugsFound,
      voteDelta: this.voteDelta,
      cumulativeVoteDelta: this.cumulativeVoteDelta,
      votes: this.votes,
      previousVotes: this.previousVotes,
    };
  }

  logConsole(force = false) {
    const p = this.getSnapshot();
    if (
      !force &&
      THROTTLED_PHASES.has(this.phase) &&
      p.current % 10 !== 0 &&
      p.current !== p.total
    ) {
      return;
    }
    const bar = formatBar(p.percent);
    const eta = formatDuration(p.etaMs);
    const elapsed = formatDuration(p.elapsedMs);
    const err = p.errors > 0 ? ` · ${p.errors} erreur(s)` : '';
    const listInfo =
      p.listSlugsFound > 0 ? ` · ${p.listSlugsFound} slugs liste` : '';
    const voteInfo =
      this.phase === 'scrape_votes' && p.voteDelta != null
        ? ` · Δ${formatSignedDelta(p.voteDelta)} (${p.previousVotes}→${p.votes}) · ΣΔ${formatSignedDelta(p.cumulativeVoteDelta)}`
        : '';

    console.log(
      `[${this.logPrefix}] ${p.phaseLabel} ${bar} ${p.current}/${p.total} (${p.percent}%) — ${p.slug}${voteInfo}${listInfo} — ${elapsed} écoulé, ~${eta} restant${err}`
    );
  }

  emit(forceLog = false) {
    const snapshot = this.getSnapshot();
    if (this.onUpdate) this.onUpdate(snapshot);
    if (forceLog) this.logConsole(true);
  }
}

/** Alias historique (Pipeline B). */
export const DiscoverProgress = RunProgress;
