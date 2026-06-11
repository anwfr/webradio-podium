import { setUserEstablishment } from './user-establishment.js';
import { escapeHtml } from './ranking-view.js';
import { closePodcastDetail, stashPodcastFromUrl } from './podcast-detail.js';

const FEATURED_ESTABLISHMENT_KEY = 'college-florian-d-anduze';

let entries = [];
let onComplete = null;
let mode = 'onboarding';

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
      if (!btn || btn.tagName !== 'BUTTON') return;
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
  mode = reason;

  closePodcastDetail(true);
  stashPodcastFromUrl();

  document.getElementById('loading').hidden = true;
  document.getElementById('app-shell').hidden = true;
  document.getElementById('empty-state').hidden = true;

  const screen = document.getElementById('onboarding-screen');
  if (screen) screen.hidden = false;

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
        : 'Pour commencer, indique où tu étudies. Tu verras en priorité les podcasts de ton école.';
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

function renderOnboardingList(query) {
  const list = document.getElementById('onboarding-list');
  if (!list) return;

  const q = query.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const label = entry.label || entry.key || '';
    if (!q) return true;
    return label.toLowerCase().includes(q);
  });

  if (!filtered.length) {
    list.innerHTML = `<p class="onboarding-empty">Aucun établissement trouvé.</p>`;
    return;
  }

  list.innerHTML = sortOnboardingEntries(filtered)
    .slice(0, 80)
    .map(
      (entry) => {
        const label = entry.label || entry.key || 'Établissement';
        return `
    <div class="onboarding-card">
      <div class="onboarding-card-body">
        <strong class="onboarding-card-title">${escapeHtml(label)}</strong>
      </div>
      <button type="button" class="btn btn-small" data-establishment-key="${escapeHtml(entry.key)}" data-establishment-label="${escapeHtml(label)}">
        ${mode === 'change' ? 'Sélectionner' : 'C\'est mon établissement'}
      </button>
    </div>`;
      }
    )
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
