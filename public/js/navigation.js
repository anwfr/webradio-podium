const TABS = [
  { id: 'podcasts', label: 'Podcasts', hash: '#podcasts' },
  { id: 'ecoles', label: 'Écoles', hash: '#ecoles' },
  { id: 'mon-ecole', label: 'Mon école', hash: '#mon-ecole' },
];

const HASH_MAP = {
  'mon-ecole': 'mon-ecole',
  podcasts: 'podcasts',
  podium: 'podcasts',
  classement: 'podcasts',
  ecoles: 'ecoles',
};

export function normalizeTabId(tabId) {
  if (tabId === 'podium-global' || tabId === 'classement') return 'podcasts';
  return TABS.some((t) => t.id === tabId) ? tabId : 'podcasts';
}

let activeTab = 'podcasts';
let onTabChange = null;

export function tabFromHash() {
  const hash = location.hash.replace(/^#/, '');
  return HASH_MAP[hash] || 'podcasts';
}

export function hashForTab(tabId) {
  const tab = TABS.find((t) => t.id === tabId);
  return tab?.hash || '#podcasts';
}

export function getActiveTab() {
  return activeTab;
}

export function setActiveTab(tabId, { updateHash = true, notify = true } = {}) {
  tabId = normalizeTabId(tabId);
  const tab = TABS.find((t) => t.id === tabId);
  if (!tab) return;

  activeTab = tabId;

  document.querySelectorAll('.tab-panel[data-tab-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== tabId;
  });

  document.querySelectorAll('.app-tab').forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('app-tab--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (updateHash) {
    const current = location.hash.replace(/^#/, '');
    const target = tab.hash.replace(/^#/, '');
    if (current !== target) {
      history.replaceState({ tab: tabId }, '', tab.hash);
    }
  }

  if (notify) onTabChange?.(tabId);
}

export function initNavigation({ onChange } = {}) {
  onTabChange = onChange;

  const tabBar = document.getElementById('app-tab-bar');
  if (!tabBar) return;

  tabBar.innerHTML = TABS.map((tab) => {
    const icon = tabIcon(tab.id);
    return `
      <button type="button" class="app-tab" data-tab="${tab.id}" role="tab" aria-selected="false" aria-label="${tab.label}">
        <span class="app-tab-icon" aria-hidden="true">${icon}</span>
        <span class="app-tab-label">${tab.label}</span>
      </button>`;
  }).join('');

  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.app-tab');
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
  });

  window.addEventListener('hashchange', () => {
    setActiveTab(tabFromHash(), { updateHash: false });
  });

  setActiveTab(tabFromHash(), { updateHash: false, notify: false });
}

function tabIcon(id) {
  switch (id) {
    case 'mon-ecole':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V9.5z"/></svg>`;
    case 'podcasts':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><path d="M12 19v3"/></svg>`;
    case 'ecoles':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7"/><path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>`;
    default:
      return '';
  }
}

export { TABS };
