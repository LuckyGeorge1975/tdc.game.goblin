import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';

test('all migrated mission data validates and enters the native FULL profile with its original mission ID',async()=>{
  const game = await fullScene();
  for (const file of ['level-events.js','editor-draft.js'])
    game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  game.context.migrated = JSON.parse(readFileSync(new URL('../assets/unit-art/levels/full-migrated-missions.v3.json',import.meta.url),'utf8'));
  for (const level of game.context.migrated.levels) {
    game.context.level = level;
    try {
      await game.run('GoblinEditorDraft.prepare(level).then(config=>{globalThis.prepared=config})');
    } catch (error) {
      throw Error(level.id+': '+error.message);
    }
    game.run('ScenarioRuleProfiles.registerFullMission(level.id,prepared);scenarioCatalog[level.id]=prepared;loadScenario(level.id)');
    assert.equal(game.run('legacySession.ruleProfileId'),'FULL_CATALOG_v1');
    assert.equal(game.run('currentScenario'),level.id);
    assert.equal(game.run('GoblinCatalogFullRuntime.active()'),true);
  }
});
