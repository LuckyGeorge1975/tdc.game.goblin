// Executable internal product evidence, not a browser save/import format or the old Core probe.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {artilleryScene,queryBridge,read} from './artillery-product-harness.mjs';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sourceFiles=['unit-life.js','ogre-systems.js','catalog-specialists-fire.js','catalog-specialists-model.js','catalog-specialists-runtime.js','catalog-specialists-ui.js','game.js','terrain-rules.js','legacy-supercover.js','scenario-profile-manifest.js',
  'artillery-spotter-rules.js','artillery-pilot-runtime.js','assets/unit-art/rules/artillery-pilot.v1.js',
  'assets/unit-art/levels/artillery-pilot.v1.json','assets/unit-art/rules/unit-profiles.v1.json','legacy-presentation.js','presentation-state.js',
  'command-history.js','combat-feedback.js','ogre-runtime.js','siegebreaker-weapons.js','strategic-missile.js',
  'siege-pilot-runtime.js','ui-v2.js','unit-visuals.js','tests/artillery-product-harness.mjs','catalog-base-model.js','catalog-base-runtime.js','assets/unit-art/rules/unit-profiles.catalog-approved.v1.json'];
export const sources=()=>Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256')
  .update(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')]));
const state=g=>read(g,`({units,terrain:[...terrain],terrainTypes:[...terrainTypes],turn,phase,turnPhase,gameOver,
  selectedId:selected?.id??null,focusedCell,phaseRolls,phaseRollCursor,
  history:phaseCommands.map(({log,...snapshot})=>snapshot)})`);
const events=g=>g.events().map(({event,status,...entry})=>{
  const {before,after,...facts}=event;
  return {...entry,status,event:{...facts,beforeDigest:digest(before),afterDigest:digest(after)}};
});
function validStep(step){
  if(!step||typeof step!=='object'||Array.isArray(step))return false;
  const keys=Object.keys(step);
  if(['Command','Query'].includes(step.kind))return keys.length===2&&keys.includes('command')&&step.command&&typeof step.command==='object'&&!Array.isArray(step.command);
  if(step.kind==='Select')return keys.length===3&&keys.includes('actorId')&&keys.includes('choice')&&typeof step.actorId==='string'&&typeof step.choice==='string';
  return keys.length===1&&['Advance','Enemy','Undo','Restart'].includes(step.kind);
}
async function apply(g,step){
  if(step.kind==='Command'||step.kind==='Query'){
    const command=JSON.stringify(step.command),query=read(g,`query(${command})`);
    const result=step.kind==='Query'?query:read(g,`dispatch(${command},revision())`);
    return {query,result};
  }
  if(step.kind==='Select')return {result:{ok:g.run(`GoblinArtilleryWeapons.selectWeapon(units.find(u=>u.id===${JSON.stringify(step.actorId)}),${JSON.stringify(step.choice)})`)}};
  if(step.kind==='Advance'){
    g.run("$('#end-turn').onclick()");
    await new Promise(resolve=>setImmediate(resolve));
    return {result:{phase:g.run('phase'),turnPhase:g.run('turnPhase')}};
  }
  if(step.kind==='Enemy'){
    assert.equal(g.run('phase'),'enemy');
    const pending=[...g.timers.entries()].find(([,fn])=>String(fn).includes('const foes='));
    assert.ok(pending,'real scheduled enemy callback');g.timers.delete(pending[0]);pending[1]();
    return {result:{phase:g.run('phase'),turn:g.run('turn')}};
  }
  if(step.kind==='Undo'){g.run('undoPhaseCommand()');return {result:{history:g.run('phaseCommands.length')}};}
  g.run("loadScenario('artillery-pilot')");return {result:{sessionId:g.run('legacySession.sessionId')}};
}
export async function recordArtilleryProductTrace(seed,commands){
  assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);
  assert.ok(Array.isArray(commands)&&commands.every(validStep),'invalid product trace command structure');
  const g=artilleryScene(true,seed);queryBridge(g);
  const header={scenarioId:'artillery-pilot',scenarioVersion:1,ruleProfileId:'CATALOG_ARTILLERY_PILOT_v1',
    productSession:read(g,'legacySession'),sources:sources(),rng:'xorshift32-test-v1',seed};
  const initial={state:state(g),rng:g.rng(),events:events(g),presentation:read(g,'GoblinPresentation.read()')};
  const steps=[];
  for(const command of commands){
    const before={state:state(g),rng:g.rng(),events:events(g)};
    const result=await apply(g,command);
    const after={state:state(g),rng:g.rng(),events:events(g)};
    if(command.kind==='Query'||result.query?.ok===false){assert.deepEqual(after,before,'query/reject cannot mutate state, RNG or events');}
    const previous=new Map(before.events.map(entry=>[entry.event.eventId,digest(entry)]));
    const current=new Map(after.events.map(entry=>[entry.event.eventId,digest(entry)]));
    steps.push({command,...result,state:after.state,rng:after.rng,
      presentation:read(g,'GoblinPresentation.read()'),
      events:{digest:digest(after.events),current:[...current.keys()],
        addedOrChanged:after.events.filter(entry=>previous.get(entry.event.eventId)!==digest(entry)),
        removed:[...previous.keys()].filter(id=>!current.has(id))}});
  }
  const value={traceVersion:'artillery-product-trace-v1',executable:'tests/artillery-product-trace.test.mjs',
    publicSaveFormat:false,header,initial,commands,steps};
  return {...value,traceDigest:digest(value)};
}
export async function replayArtilleryProductTrace(trace,compatibility=null){
  assert.equal(trace?.traceVersion,'artillery-product-trace-v1');
  assert.equal(trace.publicSaveFormat,false);
  assert.equal(trace.header?.scenarioId,'artillery-pilot');
  assert.equal(trace.header?.ruleProfileId,'CATALOG_ARTILLERY_PILOT_v1');
  if(compatibility){
    assert.ok(['artillery-source-compatibility-catalog-base-v1','artillery-source-compatibility-catalog-specialists-v1'].includes(compatibility.version));
    assert.ok(compatibility.originalTraceDigests.includes(trace.traceDigest),'unlisted frozen oracle');
    const current=sources(),paths=[...new Set([...Object.keys(trace.header.sources),...Object.keys(current)])].sort();
    assert.deepEqual(Object.keys(compatibility.sourcePairs).sort(),paths,'incomplete source compatibility boundary');
    for(const path of paths)assert.deepEqual(compatibility.sourcePairs[path],{from:trace.header.sources[path]??null,to:current[path]??null},'unauthorized source drift: '+path);
  }else assert.deepEqual(trace.header.sources,sources(),'different product source boundary');
  const {traceDigest,...value}=trace;assert.equal(digest(value),traceDigest,'tampered trace envelope');
  const initialGame=artilleryScene(true,trace.header.seed);queryBridge(initialGame);
  assert.deepEqual(trace.header.productSession,read(initialGame,'legacySession'),'different product profile or initial roster');
  assert.deepEqual(trace.initial,{state:state(initialGame),rng:initialGame.rng(),events:events(initialGame),
    presentation:read(initialGame,'GoblinPresentation.read()')},'different initial state or seed');
  assert.equal(trace.steps.length,trace.commands.length);
  trace.steps.forEach((step,index)=>assert.deepEqual(step.command,trace.commands[index],'different command/order'));
  const rebuilt=await recordArtilleryProductTrace(trace.header.seed,trace.commands);
  if(compatibility){
    // Only declared source provenance changes; every original gameplay/presentation value stays the oracle.
    rebuilt.header.sources=structuredClone(trace.header.sources);
    const {traceDigest:unused,...actual}=rebuilt;rebuilt.traceDigest=digest(actual);
  }
  assert.deepEqual(rebuilt,trace,'product state, events, header, seed, selection, budget or RNG differs');
  return rebuilt;
}
const action=command=>({kind:'Command',command});
const query=command=>({kind:'Query',command});
const fire=(actorId,x,y,mode='direct',spotterId=null)=>({type:'FireArtillery',actorId,x,y,mode,spotterId});
const move=(actorId,x,y)=>action({type:'Move',actorId,x,y});
const cycle=()=>[{kind:'Advance'},{kind:'Advance'},{kind:'Enemy'}];
export function victoryCommands(){
  const battery=fire('long-range-battery',4,3);
  const result=[move('recon-tank',6,1),move('mobile-siege-gun',2,6),{kind:'Advance'},
    query(fire('long-range-battery',8,1)),query({...battery,spotterId:'recon-tank'}),
    {kind:'Select',actorId:'long-range-battery',choice:'indirect/recon-tank'},
    query(fire('long-range-battery',8,1,'indirect','recon-tank')),
    {kind:'Select',actorId:'long-range-battery',choice:'direct'},action(battery),query(fire('long-range-battery',8,1,'indirect','recon-tank')),{kind:'Undo'},action(battery),
    {kind:'Select',actorId:'mobile-siege-gun',choice:'indirect/recon-tank'},
    action(fire('mobile-siege-gun',7,6,'indirect','recon-tank')),
    action({type:'Fire',actorId:'recon-tank',x:8,y:1}),...cycle()];
  for(const [x,y] of [[2,5],[3,4],[3,3]])result.push(move('mobile-siege-gun',x,y),{kind:'Advance'},...cycle());
  result.push(move('mobile-siege-gun',4,3),{kind:'Advance'},
    query(fire('mobile-siege-gun',10,3,'indirect','missing')),
    action(fire('mobile-siege-gun',10,3,'indirect','recon-tank')));
  return result;
}
export function victorySeed(){
  for(let seed=1;seed<10000;seed++){
    let state=seed;const values=[];for(let n=0;n<4;n++){state^=state<<13;state^=state>>>17;state^=state<<5;state>>>=0;values.push(state/4294967296);}
    if(values[0]>=1/3&&values[1]>=.5&&values[2]>=5/6&&values[3]>=5/6)return seed;
  }
  throw new Error('seed search boundary');
}
export async function defeatCommands(seed=7){
  const g=artilleryScene(true,seed);queryBridge(g);const result=[];
  for(let round=0;round<20&&!g.run('gameOver');round++){
    for(const command of [{kind:'Advance'},...cycle()]){result.push(command);await apply(g,command);}
    if(!g.run('gameOver')&&g.run("units.find(u=>u.id==='recon-tank').hp<=0")){
      const command=query(fire('long-range-battery',8,1,'indirect','recon-tank'));result.push(command);await apply(g,command);
    }
  }
  assert.equal(g.run("gameOver&&!units.some(u=>u.team==='player'&&u.hp>0)"),true);
  return result;
}
