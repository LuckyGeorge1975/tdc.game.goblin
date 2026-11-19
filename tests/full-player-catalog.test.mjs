import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullGameManager,fullNativeSetup} from '../full-standard-seat-owner.mjs';
import {selectWeakFullCatalog,selectMediumFullCatalog} from '../src/core/full-catalog-difficulty.mjs';
import {prepareFullAttack2a,FULL_ATTACK_2A_ID,FULL_ATTACK_2A_ENGINE} from '../src/core/full-attack-2a.mjs';
import {prepareDefenderTrial} from '../src/core/full-defender-trial.mjs';

const json=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));

test('all 25 pairings bind natively in every FULL mission, migrated mission and field campaign level',async()=>{
  const game=await fullScene();
  for(const file of ['level-events.js','editor-draft.js'])
    game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  const full=game.context.GoblinCatalogFullRuntime;
  const attacker=await prepareFullAttack2a({engine:FULL_ATTACK_2A_ENGINE,
    modelBytes:Buffer.from(json('assets/ai/full-attack-2a.json').base64,'base64')});
  const defender=await prepareDefenderTrial('full-defender-control-trial',
    readFileSync(new URL('../assets/ai/full-defender-control-trial.json',import.meta.url)));
  for(const side of ['player','enemy']) {
    full.registerQualifiedController({side,id:side+'-weak',difficulty:'weak',select:selectWeakFullCatalog});
    full.registerQualifiedController({side,id:side+'-medium',difficulty:'medium',select:selectMediumFullCatalog});
    full.registerQualifiedController({side,id:side+'-strong',difficulty:'strong',
      select(){throw Error('Pairing admission must not start a worker');}});
  }
  full.registerQualifiedController({side:'player',id:FULL_ATTACK_2A_ID,difficulty:null,select:attacker});
  full.registerQualifiedController({side:'enemy',id:'full-defender-control-trial',difficulty:null,
    select:(batch,_port,report)=>defender(batch,report)});
  const cases=Object.entries(game.context.GoblinCatalogFullModel.configs)
    .map(([id,config])=>({id,config,draft:false}));
  for(const level of json('assets/unit-art/levels/full-migrated-missions.v3.json').levels) {
    const config=await game.context.GoblinEditorDraft.prepare(level);
    game.context.GoblinEditorDraft.validate(level);
    game.run('globalThis.migrationId='+JSON.stringify(level.id));
    game.context.prepared=config;
    game.run('ScenarioRuleProfiles.registerFullMission(migrationId,prepared);scenarioCatalog[migrationId]=prepared');
    cases.push({id:level.id,config,draft:false});
  }
  for(const file of ['relay-line','scorched-earth']) {
    const data=json('assets/unit-art/levels/'+file+'.v3.json');
    for(const [index,level] of (data.levels??data).entries())
      cases.push({id:file+'-'+index,config:await game.context.GoblinEditorDraft.prepare(level),draft:true});
  }
  let pairings=0;
  for(const entry of cases) {
    const manager=createFullGameManager(entry.config,full);
    assert.deepEqual(manager.seats.map(seat=>seat.ai.length),[4,4],entry.id);
    const [players,enemies]=manager.seats.map(seat=>[null,...seat.ai.map(policy=>policy.id)]);
    for(const player of players)for(const enemy of enemies) {
      game.context.control={...fullNativeSetup(manager,{player,enemy}),seed:7,
        ui:{handoff(){return true;}}};
      game.context.prepared=entry.config;
      const port=game.run(entry.draft?'loadEditorDraft(prepared,control)':
        'loadScenario('+JSON.stringify(entry.id)+',control)');
      assert.equal(port.state().controller,player===null?'human':'ai',entry.id);
      assert.equal(port.controlBinding().roles.enemy,enemy===null?'human':'ai',entry.id);
      pairings++;
    }
  }
  assert.equal(cases.length,35);
  assert.equal(pairings,875);
});
