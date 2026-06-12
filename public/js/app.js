import { loadSiteConfig } from './config.js';
import {
  loadAppData,
  buildRankings,
  buildRankingsAtComparison,
  enrichPodcastSortRanks,
  sortPodcastsForMode,
  formatLastUpdate,
  isDataEmpty,
} from './data.js';
import {
  findReferenceSnapshot,
  votesMap,
} from './snapshot-window.js';
import {
  resolveEstablishment,
  establishmentChipMarkup,
  podiumEstablishmentMarkup,
} from './establishment.js';
import {
  initPodcastDetailRouting,
  openPodcastDetail,
  syncPodcastFromUrl,
  stashPodcastFromUrl,
  resolvePendingPodcastSlug,
  hasPendingPodcastOpen,
  getPendingShareMode,
  openPendingPodcast,
  setShareIdLookup,
} from './podcast-detail.js';
import {
  redirectEstablishmentUrl,
  redirectLegacyEstablishmentUrl,
} from './router.js';
import { buildShareIdMaps } from './share-id.js';
import {
  buildEstablishmentLeaderboard,
  buildLocalRanks,
  findEstablishmentEntry,
} from './establishment-leaderboard.js';
import {
  renderPodium,
  renderRankingList,
  renderPodcastBadges,
} from './ranking-view.js';
import {
  renderMyEstablishmentSummary,
  renderMyEstablishmentNeighbors,
} from './establishment-ranking-view.js';
import {
  clearUserEstablishment,
  getUserEstablishment,
  setUserEstablishment,
} from './user-establishment.js';
import { initOnboarding, setOnboardingEntries, showOnboarding } from './onboarding.js';
import { initNavigation, setActiveTab, getActiveTab } from './navigation.js';
import { showChampionSplash, dismissChampionSplash } from './champion-splash.js';
import { initVoteCountdown } from './vote-countdown.js';

function getAfdListUrl(config) {
  return (
    config.afdListUrl ||
    config.afdContestUrl ||
    'https://offre-pedagogique.afd.fr/fr/publications/liste?words=&type%5B6%5D=6&thematic%5B389%5D=389&location='
  );
}

const state = {
  allRows: [],
  establishmentEntries: [],
  userEstablishment: null,
  filterText: '',
  history: { snapshots: [] },
  defaultTitle: 'Concours de podcast 2026',
  config: null,
  meta: null,
  participants: null,
  shareIdBySlug: new Map(),
  slugByShareId: new Map(),
};

function enrichRow(row) {
  const resolved = resolveEstablishment(row);
  return {
    ...row,
    establishment: resolved.establishment,
    establishmentKey: resolved.establishmentKey,
  };
}

function canonicalEstablishmentLabel(row) {
  if (!row.establishmentKey) return row.establishment || row.school || '';
  const entry = state.establishmentEntries.find((e) => e.key === row.establishmentKey);
  return entry?.label || row.establishment || row.school || '';
}

function establishmentCellMarkup(row, options = {}) {
  const key = row.establishmentKey;
  const label = canonicalEstablishmentLabel(row);
  const academy = row.academy;

  if (options.display === 'podium') {
    return podiumEstablishmentMarkup({ label, key, school: row.school });
  }

  const { display: _display, ...chipOptions } = options;
  return establishmentChipMarkup({
    label,
    key,
    academy,
    ...chipOptions,
  });
}

function getEstablishmentRows(key) {
  const filtered = state.allRows.filter((row) => row.establishmentKey === key);
  return buildLocalRanks(filtered);
}

function getActiveEstablishmentKey() {
  return state.userEstablishment?.key;
}

function refreshMonEcoleTab() {
  const key = getActiveEstablishmentKey();
  if (!key) return;

  const rows = getEstablishmentRows(key);
  const entry = findEstablishmentEntry(state.establishmentEntries, key);
  const label = entry?.label || state.userEstablishment?.label || key;

  renderMyEstablishmentSummary('my-establishment-summary', entry, { label });

  renderMyEstablishmentNeighbors('my-establishment-neighbors', state.establishmentEntries, {
    mode: 'total',
    establishmentKey: key,
  });

  renderRankingList(
    'list-mon-ecole',
    [...rows].sort((a, b) => a.rank - b.rank),
    {
      showEstablishment: false,
      establishmentCellMarkup,
      openPodcastDetail,
      emptyMessage: 'Aucun podcast pour cet établissement.',
    }
  );
}

function refreshPodiumTab() {
  const sorted = sortPodcastsForMode(state.allRows, 'total');

  renderPodium(sorted, 'podium-global', {
    establishmentCellMarkup,
    showEstablishment: true,
    establishmentDisplay: 'podium',
    openPodcastDetail,
    mode: 'total',
  });

  renderPodcastBadges(state.allRows, 'podcast-badges', {
    openPodcastDetail,
    getEstablishmentLabel: canonicalEstablishmentLabel,
  });
}

function refreshPodcastsTab() {
  const sorted = sortPodcastsForMode(state.allRows, 'total');

  renderRankingList('list-podcasts', sorted, {
    showEstablishment: true,
    filterText: state.filterText,
    sortMode: 'total',
    showTopTierStyles: false,
    establishmentDisplay: 'podium',
    highlightEstablishmentKey: state.userEstablishment?.key,
    establishmentCellMarkup,
    openPodcastDetail,
  });
}

function refreshActiveTab() {
  if (!state.allRows.length) return;

  const tab = getActiveTab();
  if (tab === 'podium') refreshPodiumTab();
  else if (tab === 'mon-ecole') refreshMonEcoleTab();
  else if (tab === 'podcasts') refreshPodcastsTab();
}

function updateFooterLastUpdate(meta, participants) {
  const el = document.getElementById('footer-last-update');
  if (el) el.textContent = formatLastUpdate(meta, participants);
}

function hideAllViews() {
  document.getElementById('loading').hidden = true;
  document.getElementById('app-shell').hidden = true;
  document.getElementById('onboarding-screen').hidden = true;
  document.getElementById('empty-state').hidden = true;
}

function showEmptyState(config, meta, participants) {
  hideAllViews();
  document.getElementById('empty-state').hidden = false;

  const updateLine = formatLastUpdate(meta, participants);
  const emptyDetail = document.getElementById('empty-state-detail');
  if (emptyDetail) {
    emptyDetail.textContent = updateLine
      ? `${updateLine}. Le classement n'est pas encore disponible.`
      : `Le classement n'est pas encore disponible.`;
  }
  document.getElementById('link-afd-empty').href = getAfdListUrl(config);
  const reloadBtn = document.getElementById('empty-reload');
  if (reloadBtn && !reloadBtn.dataset.bound) {
    reloadBtn.dataset.bound = '1';
    reloadBtn.addEventListener('click', () => location.reload());
  }
}

function showErrorState(message) {
  hideAllViews();
  const loading = document.getElementById('loading');
  loading.hidden = false;
  loading.innerHTML = `
    <p class="error-state">${message}</p>
    <button type="button" class="btn" onclick="location.reload()">Recharger</button>
  `;
}

function showAppShell({ openPendingPodcastAfter = false, showChampionSplashOnOpen = true } = {}) {
  hideAllViews();
  document.getElementById('app-shell').hidden = false;

  updateFooterLastUpdate(state.meta, state.participants);
  document.title = state.defaultTitle;

  initPodcastRouting();
  initVoteCountdown();
  setActiveTab(getActiveTab(), { updateHash: false, notify: false });
  refreshActiveTab();
  stashPodcastFromUrl();

  const pendingPodcastSlug = resolvePendingPodcastSlug();
  const pendingShareMode = getPendingShareMode();

  if (showChampionSplashOnOpen && !hasPendingPodcastOpen() && !pendingShareMode) {
    showChampionSplash(state.allRows, {
      getEstablishmentLabel: canonicalEstablishmentLabel,
      onOpenPodcast: (slug) => openPodcastDetail(slug),
    });
  }

  if (openPendingPodcastAfter && pendingPodcastSlug) {
    window.setTimeout(() => openPendingPodcast(), pendingShareMode ? 0 : 150);
  }
}

function setupAppShellControls() {
  const shell = document.getElementById('app-shell');
  if (shell && !shell.dataset.splashDismissBound) {
    shell.dataset.splashDismissBound = '1';
    shell.addEventListener(
      'pointerdown',
      (e) => {
        if (e.target.closest('.champion-splash-card, .champion-splash-crown, .champion-splash-backdrop')) {
          return;
        }
        dismissChampionSplash();
      },
      true
    );
  }

  const summaryWrap = document.getElementById('my-establishment-summary');
  if (summaryWrap && !summaryWrap.dataset.bound) {
    summaryWrap.dataset.bound = '1';
    summaryWrap.addEventListener('click', (e) => {
      if (e.target.closest('#btn-change-school')) {
        showOnboarding({ reason: 'change' });
      }
    });
  }

  const filterText = document.getElementById('filter-text');
  if (filterText && !filterText.dataset.bound) {
    filterText.dataset.bound = '1';
    filterText.addEventListener('input', (e) => {
      state.filterText = e.target.value;
      refreshPodcastsTab();
    });
  }

  const main = document.querySelector('.app-main');
  if (main && !main.dataset.podcastMainBound) {
    main.dataset.podcastMainBound = '1';
    main.addEventListener('click', (e) => {
      const link = e.target.closest('a.podcast-detail-link[data-slug]');
      if (!link) return;

      const panel = link.closest('.tab-panel');
      if (panel?.hidden) return;

      e.preventDefault();
      openPodcastDetail(link.dataset.slug);
    });
  }
}

function initShareIdLookup(participants) {
  const maps = buildShareIdMaps(participants);
  state.shareIdBySlug = maps.shareIdBySlug;
  state.slugByShareId = maps.slugByShareId;
  setShareIdLookup({
    getShareIdBySlug: (slug) => state.shareIdBySlug.get(slug) ?? null,
    getSlugByShareId: (shareId) => state.slugByShareId.get(shareId) ?? null,
  });
}

function initPodcastRouting() {
  if (window.__podcastDetailReady) return;

  initPodcastDetailRouting({
    defaultTitle: state.defaultTitle,
    getRow: (slug) => state.allRows.find((r) => r.slug === slug),
    getAllRows: () => state.allRows,
    getHistory: () => state.history,
    getCanonicalEstablishmentLabel: canonicalEstablishmentLabel,
    getShareIdBySlug: (slug) => state.shareIdBySlug.get(slug) ?? null,
  });
  window.__podcastDetailReady = true;
}

function loadRankingsData(participants, history) {
  let referenceRows = null;
  const snapshots = history?.snapshots ?? [];
  if (snapshots.length) {
    const latest = snapshots[snapshots.length - 1];
    const refSnap = findReferenceSnapshot(snapshots, latest.timestamp);
    const refRefSnap = findReferenceSnapshot(snapshots, refSnap.timestamp);
    referenceRows = buildRankingsAtComparison(
      participants,
      votesMap(refSnap),
      votesMap(refRefSnap)
    ).map(enrichRow);
  }

  const rankings = buildRankings(participants, history).map(enrichRow);
  state.allRows = enrichPodcastSortRanks(rankings, referenceRows);
  state.establishmentEntries = buildEstablishmentLeaderboard(state.allRows, referenceRows);
  state.history = history;
  setOnboardingEntries(state.establishmentEntries);
}

function applyUserEstablishment({ key, label }) {
  state.userEstablishment = { key, label };
  setUserEstablishment(key, label);
  setActiveTab('podium');
}

function tryAutoSelectEstablishmentFromPendingPodcast() {
  const slug = resolvePendingPodcastSlug();
  if (!slug) return null;

  const row = state.allRows.find((r) => r.slug === slug);
  if (!row?.establishmentKey) return null;

  const entry = findEstablishmentEntry(state.establishmentEntries, row.establishmentKey);
  if (!entry) return null;

  return {
    key: entry.key,
    label: entry.label || row.establishment || row.school || entry.key,
  };
}

function onEstablishmentSelected({ key, label }) {
  applyUserEstablishment({ key, label });
  showAppShell({ openPendingPodcastAfter: true });
}

async function main() {
  redirectLegacyEstablishmentUrl();
  if (redirectEstablishmentUrl()) return;

  initOnboarding({ onSelected: onEstablishmentSelected });
  initNavigation({ onChange: () => refreshActiveTab() });
  setupAppShellControls();

  const config = await loadSiteConfig();
  state.config = config;

  try {
    const { participants, history, meta } = await loadAppData();
    state.participants = participants;
    state.meta = meta;

    if (isDataEmpty(participants, history)) {
      showEmptyState(config, meta, participants);
      return;
    }

    loadRankingsData(participants, history);
    initShareIdLookup(participants);

    stashPodcastFromUrl();

    const savedEstablishment = getUserEstablishment();
    if (savedEstablishment) {
      const entry = findEstablishmentEntry(state.establishmentEntries, savedEstablishment.key);
      if (entry) {
        state.userEstablishment = {
          key: entry.key,
          label: entry.label || savedEstablishment.label || entry.key,
        };
      } else {
        clearUserEstablishment();
      }
    }

    if (!state.userEstablishment) {
      const autoSelected = tryAutoSelectEstablishmentFromPendingPodcast();
      if (autoSelected) {
        applyUserEstablishment(autoSelected);
        showAppShell({ openPendingPodcastAfter: true });
        return;
      }

      showOnboarding({ reason: 'onboarding' });
      return;
    }

    showAppShell({ openPendingPodcastAfter: true });
  } catch (err) {
    console.error(err);
    showErrorState(
      'Impossible de charger le classement pour le moment. Réessayez dans un instant.'
    );
  }
}

main();
