// Shared category calculation for the active Core fire resolvers and read-only preview.
export function ironDustCrtRatio(attack, defense) {
  const strength = Math.max(0, attack), guarded = Math.max(1, defense);
  if (strength >= guarded * 5) return '5-1';
  if (strength * 2 < guarded) return '1-2';
  return `${Math.min(4, Math.max(1, Math.floor(strength / guarded)))}-1`;
}
