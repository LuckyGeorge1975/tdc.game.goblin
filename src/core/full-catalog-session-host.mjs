import {createFullCatalogAiAdapter} from './full-catalog-ai-adapter.mjs';
import {createAiSessionHost} from './ai-session-host.mjs?v=2';

export function createFullCatalogSessionHost({host, read, readGeneration, select, selectEnemy, policy, onCommit, spectator = false}) {
  const adapter = createFullCatalogAiAdapter(host, readGeneration);
  const player = createAiSessionHost({adapter, select, policy, commit:onCommit, spectator,
    read:() => { const state = read(); return state?.side === 'player' ? state : null; }});
  let stopped = false, paused = false;
  function atEnemySlot(decision, execute) {
    if (stopped || paused || !decision.ok || (!selectEnemy && !policy)) return;
    const before = read();
    if (before?.side !== 'enemy' || decision.side !== before.side || before.ended) return;
    const key = policy ? policy.select(before,decision) : selectEnemy(decision);
    if (stopped || paused || !decision.candidates.some(candidate => candidate.key === key)) return;
    const current = read();
    if (!current || current.session !== before.session || current.side !== before.side || current.ended ||
        current.engine !== before.engine || current.profile !== before.profile || current.feature !== before.feature) return;
    const result = execute({schemaVersion:decision.schemaVersion,
      decisionId:decision.decisionId,revision:decision.revision,key});
    if (result.ok) onCommit(result,before);
  }
  return Object.freeze({
    advancePlayer:player.advance,
    chooseEnemyStep:adapter.chooseEnemyStep(atEnemySlot),
    chooseEnemyFire:adapter.chooseEnemyFire(atEnemySlot),
    invalidate:player.invalidate,
    pause() { paused = true; player.pause(); },
    resume() { if (!stopped) { paused = false; player.resume(); } },
    stop() { stopped = true; player.stop(); }
  });
}
