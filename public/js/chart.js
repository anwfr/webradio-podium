import { formatDelta, formatRankDelta } from './data.js';
import { findReferenceSnapshot } from './snapshot-window.js';

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

function snapshotDayKey(timestamp) {
  const parts = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function snapshotsOnePerDay(snapshots) {
  const byDay = new Map();
  for (const snap of snapshots) {
    byDay.set(snapshotDayKey(snap.timestamp), snap);
  }
  return [...byDay.values()].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
}

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

function rankSeries(snapshots, slug, activeSlugs) {
  return snapshots.map((snap) => rankAtSnapshot(snap, slug, activeSlugs));
}

function snapshotVotes(snapshot, slug) {
  const entry = snapshot?.entries?.find((e) => e.slug === slug);
  return entry != null ? entry.votes : null;
}

function voteDeltaAtSnapshot(allSnapshots, snap, slug) {
  const ref = findReferenceSnapshot(allSnapshots, snap.timestamp);
  if (!ref || ref.timestamp === snap.timestamp) return null;

  const votes = snapshotVotes(snap, slug);
  if (votes == null) return null;

  const refEntry = ref.entries.find((e) => e.slug === slug);
  const refVotes = refEntry != null ? refEntry.votes : votes;
  return votes - refVotes;
}

function rankDeltaAtSnapshot(allSnapshots, snap, slug, activeSlugs) {
  const ref = findReferenceSnapshot(allSnapshots, snap.timestamp);
  if (!ref || ref.timestamp === snap.timestamp) return null;

  const rank = rankAtSnapshot(snap, slug, activeSlugs);
  const refRank = rankAtSnapshot(ref, slug, activeSlugs);
  if (rank == null || refRank == null) return null;
  return refRank - rank;
}

function voteDeltasForSnapshots(allSnapshots, dailySnapshots, slug) {
  return dailySnapshots.map((snap) => voteDeltaAtSnapshot(allSnapshots, snap, slug));
}

function rankDeltasForSnapshots(allSnapshots, dailySnapshots, slug, activeSlugs) {
  return dailySnapshots.map((snap) =>
    rankDeltaAtSnapshot(allSnapshots, snap, slug, activeSlugs),
  );
}

function appendDelta(base, delta, formatter) {
  if (delta == null) return base;
  const formatted = formatter(delta);
  if (!formatted) return base;
  return `${base} (${formatted})`;
}

function numericValues(values) {
  return values.filter((v) => v != null && Number.isFinite(v));
}

function paddedRange(values, {
  paddingRatio = 0.15,
  minPadding = 1,
  floor = null,
  ceil = null,
  integer = false,
} = {}) {
  const nums = numericValues(values);
  if (!nums.length) return { min: floor ?? 0, max: ceil ?? 1 };

  let min = Math.min(...nums);
  let max = Math.max(...nums);
  const span = Math.max(max - min, 0);
  const pad = Math.max(minPadding, span * paddingRatio);

  min -= pad;
  max += pad;

  if (floor != null) min = Math.max(floor, min);
  if (ceil != null) max = Math.min(ceil, max);

  if (integer) {
    min = Math.floor(min);
    max = Math.ceil(max);
  }

  if (min >= max) {
    max = integer ? min + 1 : min + minPadding;
  }

  return { min, max };
}

function voteScale(values) {
  return paddedRange(values, {
    minPadding: 5,
    floor: 0,
    integer: true,
  });
}

function rankScale(values, maxRank) {
  return paddedRange(values, {
    minPadding: 2,
    floor: 1,
    ceil: maxRank,
    integer: true,
  });
}

export function initDetailVoteChart(canvas, history, slug, label) {
  const allSnapshots = history.snapshots || [];
  const snapshots = snapshotsOnePerDay(allSnapshots);
  const labels = snapshotLabels(snapshots);
  const color = COLORS[1];
  const data = snapshots.map((snap) => snapshotVotes(snap, slug));
  const voteDeltas = voteDeltasForSnapshots(allSnapshots, snapshots, slug);
  const voteY = voteScale(data);

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
          voteDeltas,
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
              const votes = ctx.parsed.y;
              if (votes == null) return '—';
              const formatted = `${new Intl.NumberFormat('fr-FR').format(votes)} votes`;
              const delta = ctx.dataset.voteDeltas?.[ctx.dataIndex];
              return appendDelta(formatted, delta, (n) => formatDelta(n, ' votes').text);
            },
          },
        },
      },
      scales: {
        ...CHART_OPTIONS.scales,
        y: {
          ...CHART_OPTIONS.scales.y,
          beginAtZero: false,
          min: voteY.min,
          max: voteY.max,
          ticks: {
            color: '#9aa5c4',
            maxTicksLimit: 6,
          },
        },
      },
    },
  });

  return detailVoteChartInstance;
}

export function initDetailRankChart(canvas, history, slug, activeSlugs) {
  const allSnapshots = history.snapshots || [];
  const snapshots = snapshotsOnePerDay(allSnapshots);
  const labels = snapshotLabels(snapshots);
  const color = COLORS[2];
  const data = rankSeries(snapshots, slug, activeSlugs);
  const rankDeltas = rankDeltasForSnapshots(allSnapshots, snapshots, slug, activeSlugs);
  const maxRank = Math.max(1, activeSlugs.length);
  const rankY = rankScale(data, maxRank);

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
          rankDeltas,
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
              if (rank == null) return 'Non classé';
              const base = `Rang : ${rank}`;
              const delta = ctx.dataset.rankDeltas?.[ctx.dataIndex];
              return appendDelta(base, delta, (n) => formatRankDelta(n).text);
            },
          },
        },
      },
      scales: {
        ...CHART_OPTIONS.scales,
        y: {
          ...CHART_OPTIONS.scales.y,
          reverse: true,
          beginAtZero: false,
          min: rankY.min,
          max: rankY.max,
          ticks: {
            color: '#9aa5c4',
            stepSize: Math.max(1, Math.ceil((rankY.max - rankY.min) / 5)),
            maxTicksLimit: 6,
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
