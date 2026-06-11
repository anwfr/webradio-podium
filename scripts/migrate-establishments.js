import {
  ensureDataFiles,
  loadParticipants,
  saveParticipants,
} from './lib/storage.js';
import { extractEstablishment } from './lib/establishment.js';
import { formatParisIso, nowParis } from './lib/time.js';
import { runPublish } from './publish-data.js';

export function migrateEstablishments({ publish = true } = {}) {
  ensureDataFiles();
  const data = loadParticipants();
  const validatedAt = formatParisIso(nowParis());

  let updated = 0;
  let unresolved = 0;
  const unresolvedSamples = [];

  const participants = data.participants.map((participant) => {
    const { establishment, establishmentKey } = extractEstablishment(
      participant.school
    );

    if (!establishment) {
      unresolved++;
      if (unresolvedSamples.length < 10) {
        unresolvedSamples.push({
          slug: participant.slug,
          school: participant.school,
        });
      }
      return participant;
    }

    if (
      participant.establishment !== establishment ||
      participant.establishmentKey !== establishmentKey
    ) {
      updated++;
    }

    return {
      ...participant,
      establishment,
      establishmentKey,
      lastValidatedAt: participant.lastValidatedAt || validatedAt,
    };
  });

  saveParticipants({
    ...data,
    updatedAt: validatedAt,
    participants,
  });

  if (publish) {
    runPublish();
  }

  const uniqueEstablishments = new Set(
    participants.map((p) => p.establishment).filter(Boolean)
  ).size;

  return {
    total: participants.length,
    updated,
    unresolved,
    uniqueEstablishments,
    unresolvedSamples,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = migrateEstablishments();
  console.log('[migrate-establishments] Terminé');
  console.log(`  Participants : ${report.total}`);
  console.log(`  Mis à jour   : ${report.updated}`);
  console.log(`  Non résolus  : ${report.unresolved}`);
  console.log(`  Établissements uniques : ${report.uniqueEstablishments}`);
  if (report.unresolvedSamples.length) {
    console.log('  Exemples non résolus :');
    for (const sample of report.unresolvedSamples) {
      console.log(`    - ${sample.slug}: ${sample.school?.slice(0, 90) || '—'}`);
    }
  }
}
