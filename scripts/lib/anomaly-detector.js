import { MIN_SNAPSHOTS_FOR_ALERTS } from './constants.js';
import { buildComparisonIntervals } from './snapshot-window.js';

const MODEL_VERSION = 'adaptive-v1';

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mad(values, med = median(values)) {
  if (!values.length) return 0;
  const deviations = values.map((v) => Math.abs(v - med));
  return median(deviations);
}

function modifiedZ(value, med, madValue) {
  if (madValue === 0) {
    return value / Math.max(1, med);
  }
  return 0.6745 * ((value - med) / madValue);
}

function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function getPhase(snapshotCount) {
  if (snapshotCount <= 5) return 'warmup';
  return 'mature';
}

function zThreshold(phase) {
  if (phase === 'warmup') return 4.5;
  return 3.5;
}

function computeBaselines(intervals, slugs) {
  const globalDeltas = intervals.map((i) => i.delta);
  const globalVelocities = intervals.map((i) => i.velocity);
  const globalRankJumps = intervals.map((i) => i.rankJump);

  const global = {
    medianDelta: median(globalDeltas),
    madDelta: mad(globalDeltas, median(globalDeltas)),
    medianVelocity: median(globalVelocities),
    madVelocity: mad(globalVelocities, median(globalVelocities)),
    medianRankJump: median(globalRankJumps),
    madRankJump: mad(globalRankJumps, median(globalRankJumps)),
    p95Velocity: p95(globalVelocities),
    participantCount: slugs.length,
  };

  const participants = {};
  for (const slug of slugs) {
    const personal = intervals.filter((i) => i.slug === slug);
    const pDeltas = personal.map((i) => i.delta);
    const pVel = personal.map((i) => i.velocity);
    participants[slug] = {
      historyLength: personal.length,
      medianDelta: median(pDeltas),
      madDelta: mad(pDeltas, median(pDeltas)),
      medianVelocity: median(pVel),
      madVelocity: mad(pVel, median(pVel)),
      p95Velocity: p95(pVel),
    };
  }

  return { global, participants };
}

function scoreInterval(interval, global, personal, zThresh, deltaMin) {
  if (interval.delta < deltaMin) {
    return { rawScore: 0, signals: {} };
  }

  const zGlobal = modifiedZ(
    interval.delta,
    global.medianDelta,
    global.madDelta
  );
  const zPersonal = modifiedZ(
    interval.delta,
    personal.medianDelta,
    personal.madDelta
  );

  const velThreshold =
    Math.max(global.p95Velocity || 0, personal.p95Velocity || 0) * 2;
  const velRatio =
    global.medianVelocity > 0
      ? interval.velocity / global.medianVelocity
      : interval.velocity;

  let picGlobal = 0;
  if (zGlobal >= zThresh) {
    picGlobal = Math.min(100, zGlobal * 15);
  }

  let picPersonal = 0;
  if (zPersonal >= zThresh) {
    picPersonal = Math.min(100, zPersonal * 15);
  }

  let velScore = 0;
  if (interval.velocity > velThreshold) {
    velScore = Math.min(100, velRatio * 10);
  }

  let rankScore = 0;
  const rankThresh =
    global.medianRankJump + 3 * global.madRankJump;
  if (interval.rankJump > rankThresh && global.madRankJump > 0) {
    const zRank = modifiedZ(
      interval.rankJump,
      global.medianRankJump,
      global.madRankJump
    );
    rankScore = Math.min(100, zRank * 12);
  }

  const rawScore =
    picGlobal * 0.35 +
    picPersonal * 0.25 +
    velScore * 0.25 +
    rankScore * 0.15;

  return {
    rawScore,
    signals: {
      modifiedZGlobal: zGlobal,
      modifiedZPersonal: zPersonal,
      velocity: interval.velocity,
      velocityRatioVsGlobal: velRatio,
      rankJump: interval.rankJump,
    },
  };
}

function percentileAmongPeers(delta, peerDeltas) {
  if (!peerDeltas.length) return 0;
  const below = peerDeltas.filter((d) => d < delta).length;
  return Math.round((below / peerDeltas.length) * 100);
}

function buildMessage(interval, global, personal, peerDeltas) {
  const pct = percentileAmongPeers(interval.delta, peerDeltas);
  const hours = Math.round(interval.hours);
  const globalMed = Math.round(global.medianDelta);
  const personalMed = Math.round(personal.medianDelta || 0);
  const ratioGlobal =
    globalMed > 0
      ? (interval.delta / globalMed).toFixed(1)
      : '—';
  const ratioPersonal =
    personalMed > 0
      ? (interval.delta / personalMed).toFixed(1)
      : '—';

  let tail = '';
  if (pct >= 90) {
    tail = ` Ce podcast est dans le top ${100 - pct} % des hausses de cette période.`;
  }

  return `+${interval.delta} votes en ${hours}h — ${ratioGlobal}× la médiane du concours (+${globalMed}) et ${ratioPersonal}× son habitude (+${personalMed}).${tail}`;
}

export function computeDeltaMin(global) {
  return Math.max(3, Math.round((global?.medianDelta ?? 0) * 0.5));
}

function isDeltaAnomaly(interval, global, personal, zThresh, deltaMin, signals) {
  if (interval.delta < deltaMin) return false;

  const velThreshold =
    Math.max(global.p95Velocity || 0, personal.p95Velocity || 0) * 2;
  const rankThresh = global.medianRankJump + 3 * global.madRankJump;

  return (
    signals.modifiedZGlobal >= zThresh ||
    signals.modifiedZPersonal >= zThresh ||
    interval.velocity > velThreshold ||
    (interval.rankJump > rankThresh && global.madRankJump > 0)
  );
}

function severityFromDelta(interval, signals, zThresh, peerDeltas) {
  const peerMed = median(peerDeltas);
  if (
    signals.modifiedZGlobal >= zThresh + 1 ||
    interval.delta > 5 * Math.max(1, peerMed)
  ) {
    return 'high';
  }
  if (
    signals.modifiedZGlobal >= zThresh ||
    signals.modifiedZPersonal >= zThresh
  ) {
    return 'medium';
  }
  return 'low';
}

export function detectAnomalies(votesHistory, participants, generatedAt) {
  const activeSlugs = participants
    .filter((p) => p.active)
    .map((p) => p.slug);
  const snapshots = votesHistory.snapshots || [];
  const snapshotCount = snapshots.length;
  const intervals = buildComparisonIntervals(snapshots, activeSlugs);
  const { global, participants: participantStats } = computeBaselines(
    intervals,
    activeSlugs
  );

  const stats = {
    generatedAt,
    snapshotCount,
    global,
    participants: participantStats,
  };

  const deltaMin = computeDeltaMin(global);
  stats.global.deltaMin = deltaMin;

  if (snapshotCount < MIN_SNAPSHOTS_FOR_ALERTS) {
    return {
      stats,
      alerts: [],
      modelVersion: MODEL_VERSION,
      phase: null,
    };
  }

  const phase = getPhase(snapshotCount);
  const alerts = [];
  const zThresh = zThreshold(phase);

  const lastTimestamp =
    snapshots[snapshotCount - 1]?.timestamp;
  const lastIntervals = intervals.filter(
    (i) => i.timestamp === lastTimestamp
  );

  for (const slug of activeSlugs) {
    const slugIntervals = intervals.filter((i) => i.slug === slug);
    const lastInterval = slugIntervals[slugIntervals.length - 1];
    if (!lastInterval) continue;

    const personal = participantStats[slug] || {
      medianDelta: 0,
      madDelta: 0,
      medianVelocity: 0,
      p95Velocity: 0,
      historyLength: 0,
    };

    const peerDeltas = lastIntervals
      .filter((x) => x.slug !== slug)
      .map((x) => x.delta);
    const { signals } = scoreInterval(
      lastInterval,
      global,
      personal,
      zThresh,
      deltaMin
    );

    if (!isDeltaAnomaly(lastInterval, global, personal, zThresh, deltaMin, signals)) {
      continue;
    }

    const severity = severityFromDelta(
      lastInterval,
      signals,
      zThresh,
      peerDeltas
    );

    let confidence = 'low';
    if (phase === 'mature' && personal.historyLength >= 3) {
      confidence = severity === 'high' ? 'high' : 'medium';
    }

    alerts.push({
      slug,
      type: 'anomaly_spike',
      severity,
      confidence,
      message: buildMessage(lastInterval, global, personal, peerDeltas),
      votesDelta: lastInterval.delta,
      periodHours: Math.round(lastInterval.hours),
      metrics: {
        modifiedZGlobal: Number(signals.modifiedZGlobal?.toFixed(2) || 0),
        modifiedZPersonal: Number(
          signals.modifiedZPersonal?.toFixed(2) || 0
        ),
        percentileAmongPeers: percentileAmongPeers(
          lastInterval.delta,
          peerDeltas
        ),
        velocity: Number(lastInterval.velocity.toFixed(2)),
        velocityRatioVsGlobal: Number(
          (signals.velocityRatioVsGlobal || 0).toFixed(2)
        ),
      },
    });
  }

  alerts.sort((a, b) => b.votesDelta - a.votesDelta);

  return {
    stats,
    alerts,
    modelVersion: MODEL_VERSION,
    phase,
  };
}
