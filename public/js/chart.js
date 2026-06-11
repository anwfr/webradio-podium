const COLORS = [
  '#ff6b6b', '#4ecdc4', '#7c5cff', '#ffd166', '#6ee7a0',
  '#f472b6', '#60a5fa', '#fb923c', '#a78bfa', '#34d399',
];

let detailVoteChartInstance = null;
let detailRankChartInstance = null;

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: true,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: { color: '#f0f4ff', boxWidth: 12 },
    },
    tooltip: {
      backgroundColor: '#1a1f35',
      titleColor: '#f0f4ff',
      bodyColor: '#9aa5c4',
    },
  },
  scales: {
    x: {
      ticks: { color: '#9aa5c4', maxRotation: 45 },
      grid: { color: 'rgba(255, 255, 255, 0.06)' },
    },
    y: {
      ticks: { color: '#9aa5c4' },
      grid: { color: 'rgba(255, 255, 255, 0.06)' },
      beginAtZero: true,
    },
  },
};

function snapshotLabels(snapshots) {
  return snapshots.map((s) => {
    const d = new Date(s.timestamp);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Europe/Paris',
    });
  });
}

function rankAtSnapshot(snapshot, slug, activeSlugs) {
  const votesMap = new Map(snapshot.entries.map((e) => [e.slug, e.votes]));
  const inSnapshot = snapshot.entries.some((e) => e.slug === slug);
  if (!inSnapshot) return null;

  const ranked = activeSlugs
    .map((s) => ({ slug: s, votes: votesMap.get(s) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);
  const idx = ranked.findIndex((r) => r.slug === slug);
  return idx >= 0 ? idx + 1 : null;
}

function rankSeries(history, slug, activeSlugs) {
  const snapshots = history.snapshots || [];
  return snapshots.map((snap) => rankAtSnapshot(snap, slug, activeSlugs));
}

export function initDetailVoteChart(canvas, history, slug, label) {
  const snapshots = history.snapshots || [];
  const labels = snapshotLabels(snapshots);
  const color = COLORS[1];
  const data = snapshots.map((snap) => {
    const entry = snap.entries.find((e) => e.slug === slug);
    return entry ? entry.votes : null;
  });

  if (detailVoteChartInstance) {
    detailVoteChartInstance.destroy();
  }

  detailVoteChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color + '33',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          spanGaps: true,
        },
      ],
    },
    options: {
      ...CHART_OPTIONS,
      plugins: {
        ...CHART_OPTIONS.plugins,
        legend: { display: false },
      },
    },
  });

  return detailVoteChartInstance;
}

export function initDetailRankChart(canvas, history, slug, activeSlugs) {
  const snapshots = history.snapshots || [];
  const labels = snapshotLabels(snapshots);
  const color = COLORS[2];
  const data = rankSeries(history, slug, activeSlugs);
  const maxRank = Math.max(1, activeSlugs.length);

  if (detailRankChartInstance) {
    detailRankChartInstance.destroy();
  }

  detailRankChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Rang',
          data,
          borderColor: color,
          backgroundColor: color + '33',
          tension: 0.25,
          pointRadius: 4,
          pointBackgroundColor: color,
          fill: true,
          spanGaps: true,
        },
      ],
    },
    options: {
      ...CHART_OPTIONS,
      plugins: {
        ...CHART_OPTIONS.plugins,
        legend: { display: false },
        tooltip: {
          ...CHART_OPTIONS.plugins.tooltip,
          callbacks: {
            label(ctx) {
              const rank = ctx.parsed.y;
              return rank != null ? `Rang : ${rank}` : 'Non classé';
            },
          },
        },
      },
      scales: {
        ...CHART_OPTIONS.scales,
        y: {
          ...CHART_OPTIONS.scales.y,
          reverse: true,
          min: 1,
          max: maxRank,
          ticks: {
            color: '#9aa5c4',
            stepSize: Math.max(1, Math.ceil(maxRank / 10)),
            callback: (v) => (Number.isInteger(v) ? v : ''),
          },
          title: {
            display: true,
            text: 'Rang (1 = tête)',
            color: '#9aa5c4',
            font: { size: 11 },
          },
        },
      },
    },
  });

  return detailRankChartInstance;
}

export function destroyDetailChart() {
  if (detailVoteChartInstance) {
    detailVoteChartInstance.destroy();
    detailVoteChartInstance = null;
  }
  if (detailRankChartInstance) {
    detailRankChartInstance.destroy();
    detailRankChartInstance = null;
  }
}
