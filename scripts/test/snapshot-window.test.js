import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findReferenceSnapshot,
  getLatestComparison,
  buildComparisonIntervals,
} from '../lib/snapshot-window.js';
import { buildRankings } from '../../public/js/data.js';

const t0 = '2026-06-11T06:00:00+02:00';
const t1 = '2026-06-11T16:00:00+02:00';

const participants = {
  participants: [
    { slug: 'pod-a', title: 'A', active: true, lastVotes: 150 },
    { slug: 'pod-b', title: 'B', active: true, lastVotes: 80 },
  ],
};

describe('findReferenceSnapshot — historique frais (< 24 h)', () => {
  const snapshots = [
    { timestamp: t0, entries: [{ slug: 'pod-a', votes: 100 }] },
    { timestamp: t1, entries: [{ slug: 'pod-a', votes: 150 }] },
  ];

  it('retourne le premier snapshot quand aucun n’est à 24 h ou plus', () => {
    const ref = findReferenceSnapshot(snapshots, t1);
    assert.equal(ref.timestamp, t0);
  });

  it('retourne le snapshot courant s’il n’y en a qu’un', () => {
    const ref = findReferenceSnapshot([snapshots[0]], t0);
    assert.equal(ref.timestamp, t0);
  });
});

describe('deltas affichés — init fraîche puis actualisation < 24 h', () => {
  const snapshots = [
    {
      timestamp: t0,
      entries: [
        { slug: 'pod-a', votes: 100 },
        { slug: 'pod-b', votes: 50 },
      ],
    },
    {
      timestamp: t1,
      entries: [
        { slug: 'pod-a', votes: 150 },
        { slug: 'pod-b', votes: 80 },
      ],
    },
  ];
  const history = { snapshots };

  it('aucun delta au premier snapshot seul', () => {
    const rankings = buildRankings(participants, { snapshots: [snapshots[0]] });
    assert.deepEqual(
      rankings.map((r) => r.deltaVotes),
      [0, 0]
    );
  });

  it('comptabilise les deltas dès le 2e snapshot (< 24 h)', () => {
    const comp = getLatestComparison(history);
    assert.equal(comp.periodHours, 10);
    assert.equal(comp.referenceTimestamp, t0);
    assert.equal(comp.latestTimestamp, t1);

    const rankings = buildRankings(participants, history);
    const bySlug = Object.fromEntries(
      rankings.map((r) => [r.slug, r.deltaVotes])
    );
    assert.equal(bySlug['pod-a'], 50);
    assert.equal(bySlug['pod-b'], 30);
  });
});

describe('buildComparisonIntervals — fenêtre de comparaison', () => {
  const snapshots = [
    {
      timestamp: t0,
      entries: [
        { slug: 'pod-a', votes: 100 },
        { slug: 'pod-b', votes: 50 },
      ],
    },
    {
      timestamp: t1,
      entries: [
        { slug: 'pod-a', votes: 150 },
        { slug: 'pod-b', votes: 80 },
      ],
    },
  ];

  it('produit des intervalles sur la période réelle (< 24 h)', () => {
    const intervals = buildComparisonIntervals(snapshots, ['pod-a', 'pod-b']);
    const last = intervals.filter((i) => i.timestamp === t1);
    assert.equal(last.length, 2);
    assert.equal(last[0].prevTimestamp, t0);
    assert.equal(last[0].hours, 10);
    assert.equal(last.find((i) => i.slug === 'pod-a').delta, 50);
  });
});
