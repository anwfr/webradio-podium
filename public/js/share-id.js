export function buildShareIdMaps(participantsData) {
  const slugByShareId = new Map();
  const shareIdBySlug = new Map();

  for (const participant of participantsData?.participants || []) {
    const shareId = participant.shareId;
    if (!Number.isInteger(shareId) || shareId <= 0) continue;
    slugByShareId.set(shareId, participant.slug);
    shareIdBySlug.set(participant.slug, shareId);
  }

  return { slugByShareId, shareIdBySlug };
}
