export const IRON_DUST_ENEMY_DIFFICULTIES = Object.freeze(['weak', 'medium', 'strong']);
const VERSION = 'iron-dust-enemy-tactics-v1';

export function effectiveIronDustDifficulty(difficulty = 'medium', minimumDifficulty) {
  const requested = IRON_DUST_ENEMY_DIFFICULTIES.indexOf(difficulty);
  const minimum = minimumDifficulty === undefined ? 0 : IRON_DUST_ENEMY_DIFFICULTIES.indexOf(minimumDifficulty);
  if (requested < 0 || minimum < 0)
    throw Object.assign(new Error('IRON_DUST_DIFFICULTY_INVALID'),
      {code: 'IRON_DUST_DIFFICULTY_INVALID'});
  return IRON_DUST_ENEMY_DIFFICULTIES[Math.max(requested, minimum)];
}

export function ironDustEnemyPolicy(difficulty = 'medium') {
  difficulty = effectiveIronDustDifficulty(difficulty);
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
