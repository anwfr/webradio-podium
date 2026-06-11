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
  renderPodcastBoostDuJour,
} from './ranking-view.js';
import {
  renderEstablishmentBadges,
  renderEstablishmentPodium,
  renderEstablishmentBoostDuJour,
  renderMyEstablishmentSummary,
  renderMyEstablishmentNeighbors,
} from './establishment-ranking-view.js';
import { clearUserEstablishment, getUserEstablishment } from './user-establishment.js';
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
  podcastSortMode: 'delta24h',
  establishmentSortMode: 'delta24h',
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
      ordinalRank: true,
      establishmentCellMarkup,
      openPodcastDetail,
      emptyMessage: 'Aucun podcast pour cet établissement.',
    }
  );
}

function updateTop3SectionTitle(titleId, mode) {
  const titleEl = document.getElementById(titleId);
  if (!titleEl) return;
  titleEl.textContent =
    mode === 'delta24h' ? '🔥 Qui cartonne aujourd\u2019hui ?' : '🏆 Podium';
}

function hideBadgeContainer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  container.hidden = true;
}

function refreshPodcastsTab() {
  const sorted = sortPodcastsForMode(state.allRows, state.podcastSortMode);
  const is24h = state.podcastSortMode === 'delta24h';

  if (is24h) {
    hideBadgeContainer('podcast-badges');
  } else {
    renderPodcastBadges(state.allRows, 'podcast-badges', { openPodcastDetail });
  }
  updateTop3SectionTitle('podcast-top3-title', state.podcastSortMode);

  const podium = document.getElementById('podium-global');
  const boost = document.getElementById('boost-podcasts');
  if (podium) podium.hidden = is24h;
  if (boost) boost.hidden = !is24h;

  if (is24h) {
    if (podium) podium.innerHTML = '';
    renderPodcastBoostDuJour(sorted, 'boost-podcasts', { openPodcastDetail });
  } else {
    if (boost) {
      boost.innerHTML = '';
      boost.hidden = true;
    }
    renderPodium(sorted, 'podium-global', {
      establishmentCellMarkup,
      showEstablishment: true,
      establishmentDisplay: 'podium',
      openPodcastDetail,
      mode: 'total',
    });
  }

  renderRankingList('list-podcasts', sorted, {
    showEstablishment: true,
    filterText: state.filterText,
    sortMode: state.podcastSortMode,
    establishmentDisplay: 'podium',
    highlightEstablishmentKey: state.userEstablishment?.key,
    establishmentCellMarkup,
    openPodcastDetail,
  });
}

function refreshEcolesTab() {
  const { establishmentEntries, establishmentSortMode } = state;
  const is24h = establishmentSortMode === 'delta24h';

  if (is24h) {
    hideBadgeContainer('establishment-badges');
  } else {
    renderEstablishmentBadges(establishmentEntries, 'establishment-badges');
  }
  updateTop3SectionTitle('establishment-top3-title', establishmentSortMode);

  const podium = document.getElementById('podium-ecoles');
  const boost = document.getElementById('boost-ecoles');
  if (podium) podium.hidden = is24h;
  if (boost) boost.hidden = !is24h;

  if (is24h) {
    if (podium) podium.innerHTML = '';
    renderEstablishmentBoostDuJour(establishmentEntries, 'boost-ecoles');
  } else {
    if (boost) {
      boost.innerHTML = '';
      boost.hidden = true;
    }
    renderEstablishmentPodium(establishmentEntries, 'podium-ecoles', {
      mode: 'total',
    });
  }
  renderMyEstablishmentNeighbors('my-establishment-neighbors', establishmentEntries, {
    mode: establishmentSortMode,
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
  const pendingPodcastSlug = stashPodcastFromUrl();

  if (showChampionSplashOnOpen && !pendingPodcastSlug) {
    showChampionSplash(state.allRows, {
      getEstablishmentLabel: canonicalEstablishmentLabel,
      onOpenPodcast: (slug) => openPodcastDetail(slug),
    });
  }

  if (openPendingPodcastAfter) {
    window.setTimeout(() => openPendingPodcast(), 150);
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

  bindSortModeToggle('podcast-mode-toggle', {
    getMode: () => state.podcastSortMode,
    setMode: (mode) => {
      state.podcastSortMode = mode;
    },
    onChange: () => refreshPodcastsTab(),
  });

  bindSortModeToggle('establishment-mode-toggle', {
    getMode: () => state.establishmentSortMode,
    setMode: (mode) => {
      state.establishmentSortMode = mode;
    },
    onChange: () => refreshEcolesTab(),
  });
}

function bindSortModeToggle(toggleId, { getMode, setMode, onChange }) {
  const modeToggle = document.getElementById(toggleId);
  if (!modeToggle || modeToggle.dataset.bound) return;

  modeToggle.dataset.bound = '1';
  modeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode === getMode()) return;

    setMode(mode);
    modeToggle.querySelectorAll('[data-mode]').forEach((control) => {
      const active = control.dataset.mode === mode;
      control.classList.toggle('segmented-control-btn--active', active);
      control.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    onChange();
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

function onEstablishmentSelected({ key, label }) {
  state.userEstablishment = { key, label };
  setActiveTab('mon-ecole');
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
