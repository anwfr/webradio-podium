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
  getPendingPodcastSlug,
  getPendingShareMode,
  openPendingPodcast,
} from './podcast-detail.js';
import {
  redirectEstablishmentUrl,
  redirectLegacyEstablishmentUrl,
} from './router.js';
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
  renderEstablishmentBadges,
  renderEstablishmentPodium,
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
import { showChampionSplash } from './champion-splash.js';

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

function updateSchoolHeader() {
  const key = getActiveEstablishmentKey();
  if (!key) return;

  const entry = findEstablishmentEntry(state.establishmentEntries, key);
  const label = entry?.label || state.userEstablishment?.label || key;

  const titleEl = document.getElementById('school-header-title');
  if (titleEl) titleEl.textContent = label;

  const podcastsTitleEl = document.getElementById('mon-ecole-podcasts-title');
  if (podcastsTitleEl) podcastsTitleEl.textContent = `Podcasts du ${label}`;
}

function refreshMonEcoleTab() {
  const key = getActiveEstablishmentKey();
  if (!key) return;

  const rows = getEstablishmentRows(key);
  updateSchoolHeader();

  const entry = findEstablishmentEntry(state.establishmentEntries, key);
  renderMyEstablishmentSummary('my-establishment-summary', entry, {
    totalEstablishmentCount: state.establishmentEntries.length,
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

function refreshPodcastsTab() {
  const sorted = sortPodcastsForMode(state.allRows, 'total');

  renderPodcastBadges(state.allRows, 'podcast-badges', {
    openPodcastDetail,
    getEstablishmentLabel: canonicalEstablishmentLabel,
  });

  renderPodium(sorted, 'podium-global', {
    establishmentCellMarkup,
    showEstablishment: true,
    establishmentDisplay: 'podium',
    openPodcastDetail,
    mode: 'total',
  });

  renderRankingList('list-podcasts', sorted, {
    showEstablishment: true,
    filterText: state.filterText,
    sortMode: 'total',
    establishmentDisplay: 'podium',
    highlightEstablishmentKey: state.userEstablishment?.key,
    establishmentCellMarkup,
    openPodcastDetail,
  });
}

function refreshEcolesTab() {
  const { establishmentEntries } = state;

  renderEstablishmentBadges(establishmentEntries, 'establishment-badges');

  renderEstablishmentPodium(establishmentEntries, 'podium-ecoles', {
    mode: 'total',
  });
  renderMyEstablishmentNeighbors('my-establishment-neighbors', establishmentEntries, {
    mode: 'total',
    establishmentKey: state.userEstablishment?.key,
  });
}

function refreshActiveTab() {
  if (!state.allRows.length) return;

  const tab = getActiveTab();
  if (tab === 'mon-ecole') refreshMonEcoleTab();
  else if (tab === 'podcasts') refreshPodcastsTab();
  else if (tab === 'ecoles') refreshEcolesTab();
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

  setActiveTab(getActiveTab(), { updateHash: false, notify: false });
  refreshActiveTab();
  initPodcastRouting();
  stashPodcastFromUrl();

  const pendingPodcastSlug = getPendingPodcastSlug();
  const pendingShareMode = getPendingShareMode();

  if (showChampionSplashOnOpen && !pendingPodcastSlug && !pendingShareMode) {
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
  const changeBtn = document.getElementById('btn-change-school');
  if (changeBtn && !changeBtn.dataset.bound) {
    changeBtn.dataset.bound = '1';
    changeBtn.addEventListener('click', () => {
      showOnboarding({ reason: 'change' });
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
}

function initPodcastRouting() {
  if (window.__podcastDetailReady) return;

  initPodcastDetailRouting({
    defaultTitle: state.defaultTitle,
    getRow: (slug) => state.allRows.find((r) => r.slug === slug),
    getAllRows: () => state.allRows,
    getHistory: () => state.history,
    getCanonicalEstablishmentLabel: canonicalEstablishmentLabel,
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
  setActiveTab('podcasts');
}

function tryAutoSelectEstablishmentFromPendingPodcast() {
  const slug = getPendingPodcastSlug();
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
