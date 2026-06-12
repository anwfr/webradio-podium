function isValidShareId(value) {
  return Number.isInteger(value) && value > 0;
}

function compareForShareIdAssignment(a, b) {
  const firstSeenDiff = (a.firstSeenAt || '').localeCompare(b.firstSeenAt || '');
  if (firstSeenDiff !== 0) return firstSeenDiff;
  return a.slug.localeCompare(b.slug);
}

export function assignShareIds(participants) {
  const list = [...participants];
  let maxId = 0;
  const usedIds = new Set();

  for (const participant of list) {
    if (!isValidShareId(participant.shareId)) continue;
    if (usedIds.has(participant.shareId)) {
      throw new Error(`shareId dupliqué détecté : ${participant.shareId} (${participant.slug})`);
    }
    usedIds.add(participant.shareId);
    maxId = Math.max(maxId, participant.shareId);
  }

  const missing = list.filter((participant) => !isValidShareId(participant.shareId));
  if (!missing.length) return list;

  missing.sort(compareForShareIdAssignment);

  for (const participant of missing) {
    maxId += 1;
    participant.shareId = maxId;
  }

  return list;
}
