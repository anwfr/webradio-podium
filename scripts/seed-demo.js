/**
 * Initialise data/ avec un extrait réaliste (fictif partiel) pour le dev local.
 * Données inspirées de fiches AFD réelles — non exhaustives.
 */
import {
  writeJson,
  dataPath,
  ensureDataFiles,
  emptySyncReport,
} from './lib/storage.js';
import { runPublish } from './publish-data.js';
import { formatParisIso, nowParis } from './lib/time.js';
import { extractEstablishment } from './lib/establishment.js';

const now = formatParisIso(nowParis());
const base = '2026-06-01T06:00:00+02:00';

function withEstablishmentFields(participant) {
  const { establishment, establishmentKey } = extractEstablishment(
    participant.school
  );
  return {
    ...participant,
    establishment,
    establishmentKey,
  };
}

const participants = [
  withEstablishmentFields({
    slug: 'les-filles-aussi-ont-des-ailes',
    title: 'Les filles aussi ont des ailes',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/les-filles-aussi-ont-des-ailes',
    school: 'Collège de Kawéni 1, Mamoudzou',
    category: 'Cycle 4 (12-14 ans)',
    academy: 'Académie de Mayotte',
    country: 'France',
    edition: '2026',
    status: 'Demi-finaliste',
    voteStatus: 'open',
    active: true,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 439,
  }),
  withEstablishmentFields({
    slug: 'faim-de-vie',
    title: 'Faim de vie',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/faim-de-vie',
    school: 'Lycée professionnel',
    category: 'Lycée professionnel',
    academy: 'Académie de Paris',
    country: 'France',
    edition: '2026',
    status: null,
    voteStatus: 'open',
    active: true,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 128,
  }),
  withEstablishmentFields({
    slug: 'petit-canot-et-gros-paquebot',
    title: 'Petit canot et gros paquebot',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/petit-canot-et-gros-paquebot',
    school: 'Collège',
    category: 'Cycle 3 (10-12 ans)',
    academy: 'Académie de Lyon',
    country: 'France',
    edition: '2026',
    status: null,
    voteStatus: 'open',
    active: true,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 312,
  }),
  withEstablishmentFields({
    slug: 'au-dela-des-vagues',
    title: 'Au-delà des vagues',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/au-dela-des-vagues',
    school: 'Lycée',
    category: 'Lycée général',
    academy: 'Académie de Bordeaux',
    country: 'France',
    edition: '2026',
    status: null,
    voteStatus: 'open',
    active: true,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 201,
  }),
  withEstablishmentFields({
    slug: 'les-jo-un-iceberg-social',
    title: 'Les J.O, un iceberg social',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/les-jo-un-iceberg-social',
    school: 'Collège',
    category: 'Cycle 4 (12-14 ans)',
    academy: 'Académie de Marseille',
    country: 'France',
    edition: '2024',
    status: null,
    voteStatus: 'closed',
    active: false,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 890,
  }),
  withEstablishmentFields({
    slug: 'souffle-vert',
    title: 'Souffle vert',
    url: 'https://offre-pedagogique.afd.fr/fr/ressources/souffle-vert',
    school: 'Collège',
    category: 'Cycle 3 (10-12 ans)',
    academy: 'Académie de Nantes',
    country: 'France',
    edition: '2026',
    status: null,
    voteStatus: 'open',
    active: true,
    firstSeenAt: base,
    lastValidatedAt: now,
    lastVotes: 95,
  }),
];

const voteSeries = {
  'les-filles-aussi-ont-des-ailes': [380, 395, 410, 425, 439],
  'faim-de-vie': [90, 102, 115, 122, 128],
  'petit-canot-et-gros-paquebot': [250, 268, 285, 300, 312],
  'au-dela-des-vagues': [160, 175, 188, 195, 201],
  'souffle-vert': [60, 72, 80, 88, 95],
};

const timestamps = [
  '2026-06-07T06:00:00+02:00',
  '2026-06-08T16:00:00+02:00',
  '2026-06-09T06:00:00+02:00',
  '2026-06-10T16:00:00+02:00',
  '2026-06-11T06:00:00+02:00',
];

const snapshots = timestamps.map((timestamp, idx) => ({
  timestamp,
  entries: Object.entries(voteSeries).map(([slug, series]) => ({
    slug,
    votes: series[idx],
  })),
}));

async function main() {
ensureDataFiles();

writeJson(dataPath('participants.json'), {
  updatedAt: now,
  participants,
});

writeJson(dataPath('votes-history.json'), { snapshots });

writeJson(dataPath('sync-report.json'), {
  ...emptySyncReport(),
  status: 'none',
  runAt: null,
});

writeJson(dataPath('meta.json'), {
  lastRunAt: now,
  lastRunStatus: 'success',
  lastRunDurationMs: 0,
  trigger: 'seed-demo',
  snapshotTimestamp: timestamps[timestamps.length - 1],
  counts: {
    participantsActive: participants.filter((p) => p.active).length,
    participantsTotal: participants.length,
    snapshotsTotal: snapshots.length,
    scrapeErrors: 0,
    newParticipants: 0,
  },
  errors: [],
});

runPublish();
console.log('Demo data seeded — run npm run pipeline or open public/index.html');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
