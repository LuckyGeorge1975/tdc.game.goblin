import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createIronDustProfile, queryIronDustProfile, queryIronDustCrtPreview,
  dispatchIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs';
import {queryIronDustBrowserCrtPreview} from '../iron-dust-browser-v2.mjs';

const end={type:'EndPhase',playerId:'player'};
const move=(unitId,x,y)=>({type:'Move',playerId:'player',unitId,to:{x,y}});
const fire=(unitId,targetId,weaponKey)=>({type:'PlayerFire',playerId:'player',unitId,targetId,
  ...(weaponKey?{weaponKey}:{})});
const advance={type:'AutoEnemyAdvance',playerId:'enemy'};
function apply(profile,command) {
  const result=dispatchIronDustProfile(profile,command);
  assert.ok(result.profile,JSON.stringify(result.error));
  return result;
}
function enemy(profile) {
  while(profile.entry.mode==='enemy') profile=apply(profile,advance).profile;
  return profile;
}
function checkPreview(profile,command) {
  const before=JSON.stringify(profile);
  const preview=queryIronDustCrtPreview(profile,command);
  assert.equal(JSON.stringify(profile),before,'preview must not mutate profile or RNG');
  assert.equal(preview?.legal,true);
  assert.equal(preview.profileId,profile.header.ruleProfileId);
  assert.equal(preview.stateRevision,profile.digest);
  assert.equal(preview.actorId,command.unitId);
  assert.equal(preview.targetId,command.targetId);
  assert.equal(preview.weaponKey,command.weaponKey??null);
  assert.equal(preview.meaning,'crt-attack-effective-defense');
  assert.equal(queryIronDustBrowserCrtPreview({profile},command).ratioCategory,
    preview.ratioCategory);
  const shot=apply(profile,command);
  assert.equal(preview.ratioCategory,shot.events[0].ratio);
  assert.equal(shot.events[0].type,'PlayerFireResolved');
  return shot;
}

test('Core standard preview matches direct resolved target and rejects stale legality', () => {
  let profile=createIronDustProfile(1);
  const command=fire('missile','guard');
  assert.equal(queryIronDustCrtPreview(profile,command),null,'wrong phase');
  profile=apply(profile,move('missile',4,6)).profile;
  for(let i=0;i<3;i++) profile=apply(profile,end).profile;
  profile=enemy(profile);
  profile=apply(profile,move('missile',4,5)).profile;
  profile=apply(profile,end).profile;
  const query=queryIronDustProfile(profile,command);
  assert.equal(query.available,true);
  const result=checkPreview(profile,command);
  assert.equal(result.events[0].effectiveDefense,query.effectiveDefense);
  assert.equal(queryIronDustCrtPreview(result.profile,command),null,'spent or ended');
  assert.equal(queryIronDustCrtPreview(profile,fire('missile','missing')),null,'empty target');
});

test('Core selected GOBLIN weapon preview matches guard and core resolver events', () => {
  let profile=createIronDustProfile(8);
  profile=apply(profile,move('ogre',3,2)).profile;
  for(let i=0;i<3;i++) profile=apply(profile,end).profile;
  profile=enemy(profile);
  profile=apply(profile,move('ogre',6,2)).profile;
  profile=apply(profile,end).profile;
  const target=['guard','raider'].find(id=>queryIronDustProfile(profile,fire('ogre',id,'main')).available);
  assert.ok(target,'a legal direct GOBLIN target is required');
  checkPreview(profile,fire('ogre',target,'main'));
  assert.equal(queryIronDustCrtPreview(profile,fire('ogre',target,'unknown')),null);
  const selected=apply(profile,{type:'SelectWeapon',playerId:'player',unitId:'ogre',weaponKey:'secondary'}).profile;
  assert.equal(queryIronDustCrtPreview(selected,fire('ogre',target,'main')),null,
    'old weapon selection cannot retain a ratio');
  assert.equal(queryIronDustProfile(selected,fire('ogre',target,'secondary')).available,true);
  checkPreview(selected,fire('ogre',target,'secondary'));

  profile=createIronDustProfile(8);
  for(const x of [3,6,9]) {
    profile=apply(profile,move('ogre',x,2)).profile;
    profile=apply(profile,end).profile;
    if(x===9) break;
    profile=apply(profile,end).profile;
    profile=apply(profile,end).profile;
    profile=enemy(profile);
  }
  checkPreview(profile,fire('ogre','core','main'));
});

test('Legacy adapter shares legal query, effective cover, selected attack and CRT ratio', () => {
  const ui=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
  const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  const query=ui.slice(ui.indexOf('    function query(command) {'),ui.indexOf('    function previewFire(command) {'));
  const preview=ui.slice(ui.indexOf('    function previewFire(command) {'),ui.indexOf('    function dispatch(command, expectedRevision) {'));
  const ratio=game.slice(game.indexOf('function combatRatio('),game.indexOf('function combatOutcome(',game.indexOf('function combatRatio(')));
  const defense=game.slice(game.indexOf('function effectiveDefense(target)'),game.indexOf('function phaseCanAct(',game.indexOf('function effectiveDefense(target)')));
  const actor={id:'ogre',team:'player',hp:8,x:1,y:1,damage:4,range:6,
    ogreSystems:{weapons:{main:{attack:6,range:6,label:'Main'},secondary:{attack:10,range:6,label:'Secondary'}}}};
  const target={id:'guard',team:'enemy',hp:3,x:3,y:4,defense:2};
  const context={units:[actor,target],currentScenario:'iron-dust',scenarioCatalog:{'iron-dust':{}},
    ScenarioRuleProfiles:{entries:{'iron-dust':{ruleProfileId:'LEGACY'}}},
    legacySession:{scenarioId:'iron-dust',ruleProfileId:'LEGACY'},
    IronDustBrowserV2:null,GameDialogs:{isOpen:()=>false},phase:'player',turnPhase:'fire',
    gameOver:false,W:12,H:8,sight:true,revision:()=> 'legacy-rev',t:key=>key,
    core:()=>false,dist:()=>2,lineOfSight:()=>context.sight,phaseCanAct:()=>true,
    weaponTargetAllowed:()=>true,SiegebreakerWeapons:{targetAllowed:()=>context.sight},
    TerrainRules:{coverBonus:()=>1},terrainTypeAt:()=> 'rubble-field'};
  runInNewContext(`${ratio}\n${defense}\n${query}\n${preview}\nglobalThis.preview=previewFire;globalThis.activeRatio=combatRatio;`,context);
  const command={type:'Fire',actorId:'ogre',x:3,y:4,weaponKey:'main'};
  const before=JSON.stringify(context.units);
  const main=context.preview(command);
  assert.equal(JSON.stringify(context.units),before);
  assert.equal(main.ratioCategory,context.activeRatio(6,3));
  assert.equal(main.profileId,'LEGACY');
  assert.equal(main.stateRevision,'legacy-rev');
  assert.equal(main.targetId,'guard');
  assert.equal(context.preview({...command,weaponKey:'secondary'}).ratioCategory,
    context.activeRatio(10,3));
  actor.ogreSystems=null;actor.damage=4;
  const ordinary=context.preview({type:'Fire',actorId:'ogre',x:3,y:4});
  assert.equal(ordinary.ratioCategory,context.activeRatio(actor.damage,3));
  assert.equal(ordinary.weaponKey,null);
  context.sight=false;
  assert.equal(context.preview(command),null,'blocked supercover sight');
  context.sight=true;context.turnPhase='movement';
  assert.equal(context.preview(command),null,'wrong phase');
  context.turnPhase='fire';target.hp=0;
  assert.equal(context.preview(command),null,'empty or destroyed target');
});
