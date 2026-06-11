import { setUserEstablishment } from './user-establishment.js';
import { escapeHtml } from './ranking-view.js';
import { closePodcastDetail, stashPodcastFromUrl } from './podcast-detail.js';
import {
  parsePodiumEstablishmentDisplay,
  resolveEstablishmentCity,
} from './establishment.js';

const FEATURED_ESTABLISHMENT_KEY = 'college-florian-d-anduze';

let entries = [];
let onComplete = null;

function sortOnboardingEntries(items) {
  return [...items].sort((a, b) => {
    if (a.key === FEATURED_ESTABLISHMENT_KEY) return -1;
    if (b.key === FEATURED_ESTABLISHMENT_KEY) return 1;
    return 0;
  });
}

export function initOnboarding({ onSelected } = {}) {
  onComplete = onSelected;

  const search = document.getElementById('onboarding-search');
  const list = document.getElementById('onboarding-list');

  if (search && !search.dataset.bound) {
    search.dataset.bound = '1';
    search.addEventListener('input', () => renderOnboardingList(search.value));
  }

  if (list && !list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-establishment-key]');
      if (!btn) return;
      const key = btn.dataset.establishmentKey;
      const label = btn.dataset.establishmentLabel;
      selectEstablishment(key, label);
    });
  }
}

export function setOnboardingEntries(establishmentEntries) {
  entries = establishmentEntries;
}

export function showOnboarding({ reason = 'onboarding' } = {}) {
  closePodcastDetail(true);
  stashPodcastFromUrl();

  document.getElementById('loading').hidden = true;
  document.getElementById('app-shell').hidden = true;
  document.getElementById('empty-state').hidden = true;

  const screen = document.getElementById('onboarding-screen');
  if (screen) {
    screen.hidden = false;
    screen.classList.toggle('onboarding-screen--change', reason === 'change');
  }

  const title = document.getElementById('onboarding-title');
  const lead = document.getElementById('onboarding-lead');
  if (title) {
    title.textContent =
      reason === 'change' ? 'Changer d\'établissement' : 'Choisis ton établissement';
  }
  if (lead) {
    lead.textContent =
      reason === 'change'
        ? 'Sélectionne un nouvel établissement pour personnaliser l\'app.'
        : 'Repère ton école dans le classement et débloque le podium en direct !';
  }

  const search = document.getElementById('onboarding-search');
  if (search) {
    search.value = '';
  }
  renderOnboardingList('');
}

export function hideOnboarding() {
  const screen = document.getElementById('onboarding-screen');
  if (screen) screen.hidden = true;
}

function entrySearchHaystack(entry) {
  const label = entry.label || entry.key || '';
  const city = resolveEstablishmentCity({ label, key: entry.key }) || '';
  return `${label} ${city}`.toLowerCase();
}

function renderOnboardingCard(entry) {
  const label = entry.label || entry.key || 'Établissement';
  const { city, establishmentName } = parsePodiumEstablishmentDisplay(label, {
    key: entry.key,
  });
  const displayName = establishmentName || label;
  const cityMarkup = city
    ? `<span class="podium-establishment-city">${escapeHtml(city)}</span>`
    : '';

  return `
    <button
      type="button"
      class="onboarding-card"
      data-establishment-key="${escapeHtml(entry.key)}"
      data-establishment-label="${escapeHtml(label)}"
    >
      <span class="onboarding-card-establishment">
        ${cityMarkup}
        <span class="podium-establishment-name onboarding-card-title">${escapeHtml(displayName)}</span>
      </span>
    </button>`;
}

function renderOnboardingList(query) {
  const list = document.getElementById('onboarding-list');
  if (!list) return;

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    if (!q) return true;
    return entrySearchHaystack(entry).includes(q);
  });

  if (!filtered.length) {
    list.innerHTML = `<p class="onboarding-empty">Aucun établissement trouvé.</p>`;
    return;
  }

  list.innerHTML = sortOnboardingEntries(filtered)
    .slice(0, 80)
    .map((entry) => renderOnboardingCard(entry))
    .join('');

  if (filtered.length > 80) {
    list.innerHTML += `<p class="onboarding-more">Affine ta recherche pour voir plus de résultats.</p>`;
  }
}

function selectEstablishment(key, label) {
  setUserEstablishment(key, label);
  hideOnboarding();
  onComplete?.({ key, label });
}
