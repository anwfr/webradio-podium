import { loadSiteConfig } from './config.js';
import { formatDateFr } from './data.js';

let refreshTimer = null;

function formatDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  if (min < 60) return `${min}m ${rem.toString().padStart(2, '0')}s`;
  const h = Math.floor(min / 60);
  return `${h}h ${(min % 60).toString().padStart(2, '0')}m`;
}

function renderProgressBlock(progress) {
  const block = document.getElementById('progress-block');
  if (!progress) {
    block.hidden = true;
    return;
  }

  block.hidden = false;
  const pct = progress.percent ?? 0;
  block.innerHTML = `
    <h2>⏳ ${progress.phaseLabel || 'En cours'}</h2>
    <div class="progress-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-fill" style="width: ${pct}%"></div>
    </div>
    <p class="progress-meta">
      <strong>${progress.current}/${progress.total}</strong> (${pct}%)
      · ${progress.slug || '—'}
      · ${formatDuration(progress.elapsedMs)} écoulé
      · ~${formatDuration(progress.etaMs)} restant
      ${progress.errors > 0 ? ` · <span class="delta-neg">${progress.errors} erreur(s)</span>` : ''}
      ${progress.listSlugsFound ? ` · ${progress.listSlugsFound} slugs sur la liste` : ''}
    </p>
  `;
}

function renderChangeList(items) {
  if (!items?.length) {
    return '<li class="change-reason">Aucun élément</li>';
  }
  return items
    .map(
      (item) => `
    <li>
      <a href="${item.url}" target="_blank" rel="noopener"><strong>${item.title}</strong></a>
      <span class="badge badge-low">${item.current?.voteStatus || '—'}</span>
      ${item.previous ? `<br><small>${JSON.stringify(item.previous)} → ${JSON.stringify(item.current)}</small>` : ''}
      <div class="change-reason">${item.reason}</div>
    </li>`
    )
    .join('');
}

async function loadReport() {
  try {
    const res = await fetch('/data/sync-report.json');
    if (!res.ok) return { status: 'none', runAt: null };
    return res.json();
  } catch {
    return { status: 'none', runAt: null };
  }
}

function statusLabel(status) {
  switch (status) {
    case 'running':
      return { text: 'En cours…', class: 'status-running' };
    case 'complete':
      return { text: 'Terminé', class: 'status-complete' };
    case 'failed':
      return { text: 'Échec', class: 'status-failed' };
    default:
      return { text: 'Aucune découverte', class: 'status-none' };
  }
}

async function render() {
  const config = await loadSiteConfig();
  document.getElementById('btn-discover').href =
    `${config.repoUrl}/actions/workflows/discover.yml`;
  document.getElementById('link-home').href = 'index.html';
  document.getElementById('link-github').href = config.repoUrl;

  document.getElementById('loading').hidden = true;

  const report = await loadReport();
  const status = statusLabel(report.status);
  const pill = document.getElementById('status-pill');
  pill.textContent = status.text;
  pill.className = `status-pill ${status.class}`;

  if (report.status === 'running') {
    renderProgressBlock(report.progress);
    document.getElementById('run-info').textContent = `Découverte en cours depuis ${formatDateFr(report.runAt)}`;
    document.getElementById('sections').innerHTML = '';
    if (!refreshTimer) {
      refreshTimer = setInterval(() => render(), 10000);
    }
    return;
  }

  document.getElementById('progress-block').hidden = true;

  if (report.status === 'none' || !report.runAt) {
    document.getElementById('run-info').textContent =
      'Aucune découverte lancée — utilisez le bouton ci-dessous';
    document.getElementById('sections').innerHTML = '';
    return;
  }

  const durationMin = Math.round((report.durationMs || 0) / 60000);
  document.getElementById('run-info').textContent = `Dernière exécution : ${formatDateFr(report.runAt)} (${durationMin} min)`;

  const changes = report.changes || {};
  document.getElementById('sections').innerHTML = `
    <section class="change-section opened">
      <header>✅ Votes ouverts (${report.summary?.votesOpened || 0})</header>
      <ul class="change-list">${renderChangeList(changes.votesOpened)}</ul>
    </section>
    <section class="change-section closed">
      <header>🛑 Votes fermés (${report.summary?.votesClosed || 0})</header>
      <ul class="change-list">${renderChangeList(changes.votesClosed)}</ul>
    </section>
    <section class="change-section new">
      <header>🆕 Nouveaux podcasts (${report.summary?.newlyDiscovered || 0})</header>
      <ul class="change-list">${renderChangeList(changes.newlyDiscovered)}</ul>
    </section>
    <section class="change-section meta">
      <header>🔄 Statut modifié (${report.summary?.statusChanged || 0})</header>
      <ul class="change-list">${renderChangeList(changes.statusChanged)}</ul>
    </section>
    <section class="change-section meta">
      <header>📝 Métadonnées mises à jour (${report.summary?.metadataUpdated || 0})</header>
      <ul class="change-list">${renderChangeList(changes.metadataUpdated)}</ul>
    </section>
    <section class="change-section unchanged collapsed" id="unchanged-section">
      <header>📋 Inchangés (${changes.unchanged || 0}) — cliquer pour déplier</header>
      <ul class="change-list"><li class="change-reason">${changes.unchanged || 0} fiches sans changement de statut</li></ul>
    </section>
  `;

  document.getElementById('unchanged-section')?.addEventListener('click', (e) => {
    if (e.target.tagName === 'HEADER' || e.currentTarget === e.target) {
      e.currentTarget.classList.toggle('collapsed');
    }
  });

  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

render().catch((err) => {
  document.getElementById('loading').textContent = 'Erreur de chargement';
  console.error(err);
});
