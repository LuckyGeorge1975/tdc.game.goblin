import {createFullCatalogAiAdapter} from './full-catalog-ai-adapter.mjs';
import {createAiSessionHost} from './ai-session-host.mjs';

export function createFullCatalogSessionHost({host, read, readGeneration, select, selectEnemy, onCommit, spectator = false}) {
  const adapter = createFullCatalogAiAdapter(host, readGeneration);
  const player = createAiSessionHost({adapter, select, commit:onCommit, spectator,
    read:() => { const state = read(); return state?.side === 'player' ? state : null; }});
  let stopped = false, paused = false;
  function atEnemySlot(decision, execute) {
    if (stopped || paused || !decision.ok || !selectEnemy) return;
    const key = selectEnemy(decision);
    if (stopped || paused || !decision.candidates.some(candidate => candidate.key === key)) return;
    const before = read();
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
