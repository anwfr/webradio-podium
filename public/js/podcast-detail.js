import { formatDeltaMarkup } from './data.js';
import {
  resolveEstablishment,
  podiumEstablishmentMarkup,
} from './establishment.js';
import {
  initDetailVoteChart,
  initDetailRankChart,
  destroyDetailChart,
} from './chart.js';
import {
  getActiveTab,
  setActiveTab,
  hashForTab,
  tabFromHash,
  normalizeTabId,
} from './navigation.js';

const PODCAST_PARAM = 'podcast';

let context = null;
let pendingPodcastSlug = null;
let popstateBound = false;
let podcastUrlPushed = false;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getPodcastSlugFromUrl() {
  return new URLSearchParams(location.search).get(PODCAST_PARAM) || null;
}

export function buildPodcastUrl(slug) {
  const url = new URL(location.href);
  url.searchParams.set(PODCAST_PARAM, slug);
  return url.toString();
}

export function isMainAppVisible() {
  const onboarding = document.getElementById('onboarding-screen');
  if (onboarding && !onboarding.hidden) return false;
  const shell = document.getElementById('app-shell');
  return Boolean(shell && !shell.hidden);
}

export function stashPodcastFromUrl() {
  const slug = getPodcastSlugFromUrl();
  if (!slug) return null;
  pendingPodcastSlug = slug;
  const url = new URL(location.href);
  url.searchParams.delete(PODCAST_PARAM);
  history.replaceState(history.state ?? {}, '', url);
  return slug;
}

export function openPendingPodcast() {
  if (!isMainAppVisible()) return;
  const slug = pendingPodcastSlug;
  if (!slug) return;
  pendingPodcastSlug = null;
  openPodcastDetail(slug, { replaceUrl: true });
}

function setPodcastUrl(slug, { replace = false, tab = getActiveTab() } = {}) {
  const url = new URL(location.href);
  if (slug) url.searchParams.set(PODCAST_PARAM, slug);
  else url.searchParams.delete(PODCAST_PARAM);
  url.hash = hashForTab(tab);
  const state = { podcast: slug || null, tab };
  if (replace) {
    history.replaceState(state, '', url);
  } else {
    podcastUrlPushed = true;
    history.pushState(state, '', url);
  }
}

function restoreTabAfterPodcastClose() {
  const tabToRestore = normalizeTabId(history.state?.tab || tabFromHash());
  setActiveTab(tabToRestore, { updateHash: true, notify: false });
}

function renderEstablishmentMeta(row) {
  const resolved = resolveEstablishment(row);
  const label =
    context?.getCanonicalEstablishmentLabel?.(row) ||
    resolved.establishment ||
    row.school ||
    '';
  const key = row.establishmentKey || resolved.establishmentKey;
  return podiumEstablishmentMarkup({
    label,
    key,
    school: row.school,
  });
}

function rankHeroMarkup(rank) {
  if (rank === 1) return '<span class="podcast-hero-medal" aria-hidden="true">🥇</span>';
  if (rank === 2) return '<span class="podcast-hero-medal" aria-hidden="true">🥈</span>';
  if (rank === 3) return '<span class="podcast-hero-medal" aria-hidden="true">🥉</span>';
  return `<span class="podcast-hero-rank-line"><span class="podcast-hero-rank-num">${rank}</span><span class="podcast-hero-rank-suffix">e</span></span>`;
}

function sheetActionIcon(type) {
  const icons = {
    vote:
      '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2l2.95 8.26h8.05l-6.5 4.74 2.47 8.26L12 17.77l-4.97 3.29 2.47-8.26L1 10.26h8.05z"/></svg>',
    external:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="M15.41 6.51l-6.82 3.98"/></svg>',
    link:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  };
  const svg = icons[type] || '';
  return `<span class="sheet-action-btn-icon" aria-hidden="true">${svg}</span>`;
}

function copyLinkButtonHtml(copied = false) {
  return copied
    ? `${sheetActionIcon('check')} Copié !`
    : `${sheetActionIcon('link')} Copier le lien`;
}

function voteButtonMarkup(row) {
  if (!row.url) return '';
  const votingOpen = row.voteStatus === 'open';
  const label = votingOpen ? 'Voter' : 'Fiche AFD';
  const hint = votingOpen
    ? 'Voter pour ce podcast sur le site de l\'AFD'
    : 'Voir la fiche officielle sur le site de l\'AFD';
  const btnClass = votingOpen
    ? 'sheet-action-btn sheet-action-btn--vote'
    : 'sheet-action-btn sheet-action-btn--muted';
  if (votingOpen) {
    return `<a href="${escapeHtml(row.url)}" class="${btnClass}" target="_blank" rel="noopener" title="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}"><span class="sheet-action-btn-vote-icon">${sheetActionIcon('vote')}</span><span class="sheet-action-btn-vote-label">${escapeHtml(label)}</span></a>`;
  }
  return `<a href="${escapeHtml(row.url)}" class="${btnClass}" target="_blank" rel="noopener" title="${escapeHtml(hint)}" aria-label="${escapeHtml(hint)}">${sheetActionIcon('external')}${escapeHtml(label)}</a>`;
}

function rankMarkerPercent(rank, total) {
  if (total <= 1) return 0;
  return ((rank - 1) / (total - 1)) * 100;
}

function rankTrackMessage(rank, total) {
  if (rank === 1) return '🏆 En tête du concours !';
  if (rank === 2) return '🥈 Deuxième place au concours !';
  if (rank === 3) return '🥉 Troisième place au concours !';
  if (rank <= 10) return 'Dans le top 10, bravo !';
  const quarter = Math.ceil(total / 4);
  if (rank <= quarter) return 'Très bien classé parmi tous les podcasts.';
  if (rank <= Math.ceil(total / 2)) return 'Bien placé dans le classement.';
  return 'Chaque vote peut faire remonter ce podcast !';
}

function rankNeighborTierClass(rank) {
  if (rank === 1) return 'rank-neighbor--tier-1';
  if (rank === 2) return 'rank-neighbor--tier-2';
  if (rank === 3) return 'rank-neighbor--tier-3';
  return '';
}

function rankNeighborMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function renderPeerRow(r, { currentSlug, rank }) {
  const isCurrent = r.slug === currentSlug;
  const tierClass = rankNeighborTierClass(rank);
  const medal = rankNeighborMedal(rank);
  const titleMedal = medal
    ? `<span class="rank-neighbor-medal" aria-hidden="true">${medal}</span>`
    : '';
  const className = `rank-neighbor ${tierClass}${isCurrent ? ' rank-neighbor--current' : ' rank-neighbor--link'}`;
  const body = `
      <span class="rank-neighbor-rank rank-list-badge">${rank}</span>
      <span class="rank-neighbor-title">${titleMedal}<span class="rank-neighbor-title-text">${escapeHtml(r.title)}</span></span>
      <span class="rank-neighbor-votes">${r.votes}</span>
      <span class="rank-neighbor-delta">${formatDeltaMarkup(r.deltaVotes)}</span>`;

  if (isCurrent) {
    return `<div class="${className}" aria-current="true">${body}</div>`;
  }

  return `<a href="${escapeHtml(buildPodcastUrl(r.slug))}" class="${className}" data-slug="${escapeHtml(r.slug)}">${body}</a>`;
}

function renderNeighbors(rows, currentSlug, rankKey = 'rank') {
  const idx = rows.findIndex((r) => r.slug === currentSlug);
  if (idx < 0) return '';

  const start = Math.max(0, idx - 2);
  const end = Math.min(rows.length, idx + 3);
  const slice = rows.slice(start, end);

  return slice
    .map((r) => renderPeerRow(r, { currentSlug, rank: r[rankKey] }))
    .join('');
}

function getEstablishmentPeersSection(allRows, currentRow) {
  const resolved = resolveEstablishment(currentRow);
  const key = currentRow.establishmentKey || resolved.establishmentKey;
  if (!key) return null;

  const title =
    context?.getCanonicalEstablishmentLabel?.(currentRow) ||
    currentRow.establishment ||
    resolved.establishment ||
    currentRow.school ||
    '';

  const peers = allRows
    .filter((r) => r.establishmentKey === key)
    .sort((a, b) => b.votes - a.votes);

  if (peers.length <= 1) return null;

  return {
    title,
    rows: peers
      .map((r, index) =>
        renderPeerRow(r, { currentSlug: currentRow.slug, rank: index + 1 })
      )
      .join(''),
  };
}

function renderSheetContent(row, allRows, history) {
  const total = allRows.length;
  const rankPct = rankMarkerPercent(row.rank, total);
  const shareUrl = buildPodcastUrl(row.slug);

  const establishmentPeersSection = getEstablishmentPeersSection(allRows, row);

  return `
    <div class="podcast-hero rank-tier-${Math.min(row.rank, 3)}">
      <div class="podcast-hero-rank" aria-label="Rang ${row.rank}">${rankHeroMarkup(row.rank)}</div>
      <div class="podcast-hero-body">
        <h2 class="podcast-hero-title" id="podcast-sheet-title">${escapeHtml(row.title)}</h2>
        <div class="podcast-hero-meta">${renderEstablishmentMeta(row)}</div>
        <div class="podcast-hero-stats">
          <div class="podcast-stat">
            <span class="podcast-stat-label">Votes</span>
            <span class="podcast-stat-value">${row.votes}</span>
          </div>
          <div class="podcast-stat">
            <span class="podcast-stat-label">Votes (aujourd'hui)</span>
            <span class="podcast-stat-value">${formatDeltaMarkup(row.deltaVotes)}</span>
          </div>
          <div class="podcast-stat">
            <span class="podcast-stat-label">Places (aujourd'hui)</span>
            <span class="podcast-stat-value">${formatDeltaMarkup(row.deltaRank, { hideZero: true })}</span>
          </div>
        </div>
        <div class="podcast-hero-actions">${voteButtonMarkup(row)}</div>
      </div>
    </div>

    <div class="rank-track" aria-label="Place au classement global : ${row.rank} sur ${total}">
      <p class="rank-track-summary">
        Ce podcast est
        <strong class="rank-track-summary-rank">${row.rank}<sup>e</sup></strong>
        sur <strong class="rank-track-summary-total">${total}</strong> podcasts
      </p>
      <p class="rank-track-message">${rankTrackMessage(row.rank, total)}</p>
      <div class="rank-track-bar-wrap">
        <div class="rank-track-ends">
          <span class="rank-track-end rank-track-end--best">🥇 1er</span>
          <span class="rank-track-end rank-track-end--last">Dernier</span>
        </div>
        <div class="rank-track-bar">
          <div class="rank-track-zones" aria-hidden="true"></div>
          <div class="rank-track-marker" style="left: ${rankPct}%">
            <span class="rank-track-marker-badge">${row.rank}<sup>e</sup></span>
          </div>
        </div>
        <div class="rank-track-direction" aria-hidden="true">
          <span>← Mieux classé</span>
          <span>Moins bien classé →</span>
        </div>
      </div>
    </div>

    <div class="rank-neighbors-wrap">
      <h3 class="podcast-section-title">Classement global</h3>
      <div class="rank-neighbors">${renderNeighbors(allRows, row.slug, 'rank')}</div>
    </div>

    ${
      establishmentPeersSection
        ? `<div class="rank-neighbors-wrap">
      <h3 class="podcast-section-title">Classement du ${escapeHtml(establishmentPeersSection.title)}</h3>
      <div class="rank-neighbors">${establishmentPeersSection.rows}</div>
    </div>`
        : ''
    }

    <div class="podcast-charts-grid">
      <div class="podcast-chart-wrap">
        <h3 class="podcast-section-title">Évolution des votes</h3>
        <canvas id="podcast-detail-votes-chart"></canvas>
      </div>
      <div class="podcast-chart-wrap">
        <h3 class="podcast-section-title">Évolution du classement</h3>
        <canvas id="podcast-detail-rank-chart"></canvas>
      </div>
    </div>

    <div class="podcast-share-card">
      <h3 class="podcast-section-title">Partager ce podcast</h3>
      <p class="podcast-share-lead">Envoie le lien à tes amis pour suivre ce podcast dans le classement.</p>
      <div class="sheet-action-row">
        <button type="button" class="sheet-action-btn sheet-action-btn--accent" id="podcast-share-btn" hidden>
          ${sheetActionIcon('share')} Partager
        </button>
        <button type="button" class="sheet-action-btn sheet-action-btn--muted" id="podcast-copy-link">
          ${copyLinkButtonHtml()}
        </button>
      </div>
      <input type="text" id="podcast-share-url" class="podcast-share-url" readonly value="${escapeHtml(shareUrl)}" aria-label="Lien du podcast" />
    </div>
  `;
}

function getSheet() {
  return document.getElementById('podcast-sheet');
}

export function closePodcastDetail(fromPopstate = false) {
  const sheet = getSheet();
  const wasOpen = sheet && !sheet.hidden;

  if (wasOpen) {
    sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    destroyDetailChart();
    document.title = context?.defaultTitle || document.title;
  }

  restoreTabAfterPodcastClose();

  if (!fromPopstate && getPodcastSlugFromUrl()) {
    if (podcastUrlPushed) {
      podcastUrlPushed = false;
      history.back();
      return;
    }
    setPodcastUrl(null, { replace: true, tab: getActiveTab() });
  } else if (fromPopstate) {
    podcastUrlPushed = false;
  }
}

export function openPodcastDetail(slug, { replaceUrl = false } = {}) {
  if (!context) {
    pendingPodcastSlug = slug;
    return;
  }

  if (!isMainAppVisible()) {
    pendingPodcastSlug = slug;
    closePodcastDetail(true);
    return;
  }

  const row = context.getRow(slug);
  if (!row) {
    closePodcastDetail(true);
    setPodcastUrl(null, true);
    return;
  }

  const allRows = context.getAllRows?.() || [];
  const history = context.getHistory();
  const sheet = getSheet();
  const content = document.getElementById('podcast-sheet-content');

  try {
    content.innerHTML = renderSheetContent(row, allRows, history);

    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    document.title = `${row.title} — ${context?.defaultTitle || 'Concours de podcast 2026'}`;

    const tab = getActiveTab();
    if (!replaceUrl) setPodcastUrl(slug, { tab });
    else setPodcastUrl(slug, { replace: true, tab });

    if (typeof Chart !== 'undefined') {
      const activeSlugs = allRows.map((r) => r.slug);
      initDetailVoteChart(
        document.getElementById('podcast-detail-votes-chart'),
        history,
        row.slug,
        row.title
      );
      initDetailRankChart(
        document.getElementById('podcast-detail-rank-chart'),
        history,
        row.slug,
        activeSlugs
      );
    }

    content.querySelectorAll('.rank-neighbor--link').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = link.dataset.slug;
        if (slug) openPodcastDetail(slug);
      });
    });

    const shareUrl = buildPodcastUrl(row.slug);
    const shareInput = document.getElementById('podcast-share-url');
    const copyBtn = document.getElementById('podcast-copy-link');
    const shareBtn = document.getElementById('podcast-share-btn');

    async function copyShareLink() {
      const url = shareInput?.value || shareUrl;
      if (copyBtn) {
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.innerHTML = copyLinkButtonHtml(true);
          window.setTimeout(() => {
            copyBtn.innerHTML = copyLinkButtonHtml(false);
          }, 2000);
        } catch {
          if (shareInput) {
            shareInput.select();
            document.execCommand('copy');
          }
        }
      }
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyShareLink());
    }

    if (shareBtn && typeof navigator.share === 'function') {
      shareBtn.hidden = false;
      shareBtn.addEventListener('click', async () => {
        const siteTitle = context?.defaultTitle || 'Concours de podcast 2026';
        try {
          await navigator.share({
            title: row.title,
            text: `${row.title} — ${siteTitle}`,
            url: shareUrl,
          });
        } catch (err) {
          if (err?.name === 'AbortError') return;
          await copyShareLink();
        }
      });
    }
  } catch (err) {
    console.error(err);
    sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    destroyDetailChart();
    document.title = context?.defaultTitle || document.title;
  }
}

export function syncPodcastFromUrl() {
  if (!isMainAppVisible()) {
    stashPodcastFromUrl();
    closePodcastDetail(true);
    return;
  }

  const slug = getPodcastSlugFromUrl();
  if (slug) openPodcastDetail(slug, { replaceUrl: true });
  else closePodcastDetail(true);
}

export function initPodcastDetailRouting(ctx) {
  context = ctx;

  const sheet = getSheet();
  document.getElementById('podcast-sheet-close').addEventListener('click', () => {
    closePodcastDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closePodcastDetail();
  });

  if (!popstateBound) {
    window.addEventListener('popstate', () => syncPodcastFromUrl());
    popstateBound = true;
  }
}
