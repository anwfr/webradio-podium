import {
  buildDayOverDayDeltas,
  rankAtSnapshot,
  snapshotDayLabel,
  snapshotVotes,
  snapshotsLatestPerDay,
  sortSnapshotsByTime,
} from './day-series.js';
import { formatDelta, formatRankDelta } from './data.js';

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
  return snapshots.map((s) => snapshotDayLabel(s.timestamp));
}

function rankSeries(snapshots, slug, activeSlugs) {
  return snapshots.map((snap) => rankAtSnapshot(snap, slug, activeSlugs));
}

function rankDayOverDayDeltas(dailySnapshots, slug, activeSlugs) {
  return dailySnapshots.map((snap, index) => {
    if (index === 0) return null;

    const rank = rankAtSnapshot(snap, slug, activeSlugs);
    const prevRank = rankAtSnapshot(dailySnapshots[index - 1], slug, activeSlugs);
    if (rank == null || prevRank == null) return null;

    return prevRank - rank;
  });
}

function formatDayOverDayTooltip(base, delta, formatter) {
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
  const allSnapshots = sortSnapshotsByTime(history.snapshots || []);
  const snapshots = snapshotsLatestPerDay(allSnapshots);
  const labels = snapshotLabels(snapshots);
  const color = COLORS[1];
  const data = snapshots.map((snap) => snapshotVotes(snap, slug));
  const voteDayDeltas = buildDayOverDayDeltas(snapshots, (snap) =>
    snapshotVotes(snap, slug),
  );
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
          voteDayDeltas,
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
              const dayDelta = ctx.dataset.voteDayDeltas?.[ctx.dataIndex];
              return formatDayOverDayTooltip(
                formatted,
                dayDelta,
                (n) => formatDelta(n, ' votes').text,
              );
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
  const allSnapshots = sortSnapshotsByTime(history.snapshots || []);
  const snapshots = snapshotsLatestPerDay(allSnapshots);
  const labels = snapshotLabels(snapshots);
  const color = COLORS[2];
  const data = rankSeries(snapshots, slug, activeSlugs);
  const rankDayDeltas = rankDayOverDayDeltas(snapshots, slug, activeSlugs);
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
          rankDayDeltas,
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
              const dayDelta = ctx.dataset.rankDayDeltas?.[ctx.dataIndex];
              return formatDayOverDayTooltip(
                base,
                dayDelta,
                (n) => formatRankDelta(n).text,
              );
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
