import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDayOverDayDeltas,
  getPodcastDayOverDayDeltas,
  snapshotVotes,
  snapshotsLatestPerDay,
  sortSnapshotsByTime,
} from '../../public/js/day-series.js';

const slug = 'pod-a';

const snapshots = [
  {
    timestamp: '2026-06-11T16:00:00+02:00',
    entries: [{ slug, votes: 514 }],
  },
  {
    timestamp: '2026-06-11T14:27:17+02:00',
    entries: [{ slug, votes: 520 }],
  },
  {
    timestamp: '2026-06-11T20:52:12+02:00',
    entries: [{ slug, votes: 530 }],
  },
  {
    timestamp: '2026-06-12T07:51:38+02:00',
    entries: [{ slug, votes: 560 }],
  },
  {
    timestamp: '2026-06-12T18:45:25+02:00',
    entries: [{ slug, votes: 610 }],
  },
  {
    timestamp: '2026-06-14T17:00:00+02:00',
    entries: [{ slug, votes: 612 }],
  },
];

describe('snapshotsLatestPerDay', () => {
  it('retient le snapshot le plus récent de chaque jour', () => {
    const daily = snapshotsLatestPerDay(snapshots);
    assert.equal(daily.length, 3);
    assert.equal(daily[0].timestamp, '2026-06-11T20:52:12+02:00');
    assert.equal(daily[1].timestamp, '2026-06-12T18:45:25+02:00');
    assert.equal(daily[2].timestamp, '2026-06-14T17:00:00+02:00');
    assert.equal(snapshotVotes(daily[0], slug), 530);
    assert.equal(snapshotVotes(daily[1], slug), 610);
    assert.equal(snapshotVotes(daily[2], slug), 612);
  });
});

describe('buildDayOverDayDeltas', () => {
  it('calcule le delta vs le jour précédent affiché', () => {
    const daily = snapshotsLatestPerDay(snapshots);
    const deltas = buildDayOverDayDeltas(daily, (snap) => snapshotVotes(snap, slug));

    assert.equal(deltas[0], null);
    assert.equal(deltas[1], 80);
    assert.equal(deltas[2], 2);
  });
});

describe('sortSnapshotsByTime', () => {
  it('ordonne les snapshots chronologiquement', () => {
    const sorted = sortSnapshotsByTime(snapshots);
    assert.equal(sorted[0].timestamp, '2026-06-11T14:27:17+02:00');
    assert.equal(sorted.at(-1).timestamp, '2026-06-14T17:00:00+02:00');
  });
});

describe('getPodcastDayOverDayDeltas', () => {
  it('reprend le delta du dernier point affiché sur le graphique', () => {
    const history = { snapshots };
    const activeSlugs = [slug, 'pod-b'];
    const daily = snapshotsLatestPerDay(snapshots);
    const chartDeltas = buildDayOverDayDeltas(daily, (snap) =>
      snapshotVotes(snap, slug),
    );
    const { deltaVotes } = getPodcastDayOverDayDeltas(history, slug, activeSlugs);

    assert.equal(deltaVotes, chartDeltas.at(-1));
    assert.equal(deltaVotes, 2);
  });
});
