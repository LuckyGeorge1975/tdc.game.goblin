export const IRON_DUST_ENEMY_DIFFICULTIES = Object.freeze(['weak', 'medium', 'strong']);
const VERSION = 'iron-dust-enemy-tactics-v1';

export function ironDustEnemyPolicy(difficulty = 'medium') {
  if (!IRON_DUST_ENEMY_DIFFICULTIES.includes(difficulty))
    throw Object.assign(new Error('IRON_DUST_DIFFICULTY_INVALID'),
      {code: 'IRON_DUST_DIFFICULTY_INVALID'});
  // Absence is the original Medium contract, including its historical digests.
  return difficulty === 'medium' ? null : Object.freeze({version: VERSION, difficulty});
}

export function validIronDustEnemyPolicy(policy) {
  return policy === null || !!policy && typeof policy === 'object' &&
    !Array.isArray(policy) && policy.version === VERSION &&
    (policy.difficulty === 'weak' || policy.difficulty === 'strong') &&
    Object.keys(policy).length === 2 && Object.hasOwn(policy, 'version') &&
    Object.hasOwn(policy, 'difficulty');
}
