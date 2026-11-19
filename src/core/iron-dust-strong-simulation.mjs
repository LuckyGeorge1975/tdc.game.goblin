import {describeIronDustSearch} from './iron-dust-ai-adapter.mjs';
import {validateIronDustProfile,forkIronDustProfileRng,queryIronDustProfile} from './iron-dust-executable-profile.mjs';
import {dispatchIronDustCommittedCommand} from './iron-dust-profile-replay.mjs';

const automatic={type:'AutoEnemyAdvance',playerId:'enemy'};
const stateOf=profile=>profile.entry.mode==='enemy'?profile.entry.payload.state:profile.entry.payload;
const identity=({kind,actorId,target,weaponRef})=>JSON.stringify({kind,actorId,target,weaponRef});
const reject=()=>{throw Error('IRON_DUST_STRONG_CAPTURE_MISMATCH');};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const material=unit=>{
  if(unit.hp<=0) return 0;
  if(!unit.ogreSystems) return 10+2*unit.hp-(unit.disabled?2:0);
  return 10+unit.ogreSystems.treads+2*Object.values(unit.ogreSystems.weapons)
    .reduce((total,weapon)=>total+Math.max(0,Math.min(weapon.remaining,weapon.count-weapon.destroyed)),0);
};
function materialValue(profile,side) {
  return stateOf(profile).units.reduce((sum,unit)=>sum+(unit.team===side?1:-1)*material(unit),0);
}
function evaluate(profile,side) {
  const {victory}=stateOf(profile);
  const winner=victory.status==='ended'?(victory.winner===side?1:-1):0;
  return 100000*winner+materialValue(profile,side);
}
// Inverse of the native LCG multiplier modulo 2^32. Each isolated copy takes
// exactly the requested W6 face and never consults the live combat cursor.
const beforeFace=face=>Number(BigInt.asUintN(32,(BigInt(face)-1013904223n)*4276115653n));

export function captureIronDustStrongDecision(profile,batch) {
  validateIronDustProfile(profile);
  const opened=describeIronDustSearch(profile,batch.side);
  if(!batch?.ok||!opened.ok||batch.view?.side!==batch.side||opened.phase!==batch.phase||
      opened.slot!==batch.slot||!same(opened.view,batch.view)||
      !same(opened.options.map(({candidate})=>identity(candidate)),batch.candidates.map(identity))) reject();
  const reference=batch.side==='enemy'?queryIronDustProfile(profile,automatic).action:null;
  const baselineIndex=opened.options.findIndex(({command,candidate})=>{
    if(batch.side==='player') return !!candidate.facts.objectiveReason;
    if(candidate.facts.automatic) return true;
    return same(command,reference.command);
  });
  if(baselineIndex<0) reject();
  return {version:1,profile:'CORE_IRON_DUST_v2',side:batch.side,revision:batch.revision,baselineIndex,
    snapshot:structuredClone(profile),actions:opened.options.map(({command},index)=>({index,action:command}))};
}

export function createSimulationPort(packet) {
  if(packet?.profile!=='CORE_IRON_DUST_v2') reject();
  let profile=forkIronDustProfileRng(packet.snapshot,0);
  if(stateOf(profile).activeTeam!==packet.side) reject();
  const baseline=describeIronDustSearch(profile,packet.side);
  if(!same(packet.actions.map(({action})=>action),baseline.options.map(({command})=>command))) reject();
  function status() {
    const state=stateOf(profile);
    return {side:state.activeTeam,turn:state.turn,ended:state.victory.status==='ended',winner:state.victory.winner};
  }
  function open() {
    const side=stateOf(profile).activeTeam;
    const batch=describeIronDustSearch(profile,side);
    if(!batch.ok) throw Error('IRON_DUST_STRONG_OPEN_FAILED');
    return {...batch,options:batch.options.map(({command,candidate})=>({action:command,candidate}))};
  }
  function choose(opened) {
    if(stateOf(profile).activeTeam==='player')
      return opened.options.find(({candidate})=>candidate.facts.objectiveReason)?.action;
    // Reference continuation chooses from the current native controller. It
    // never creates a new independent plan for the real opponent seat.
    const query=queryIronDustProfile(profile,automatic);
    if(!query.available) throw Error('IRON_DUST_STRONG_REFERENCE_FAILED');
    return query.action.command?.type==='EnemySystemAttack'||query.action.command?.type==='EnemyUnitAttack'||
      query.action.command?.type==='EnemyMove'||query.action.command?.type==='EnemyHold'
      ? query.action.command : automatic;
  }
  function commit(action) {
    // AutoEnemyAdvance can conceal a fire. Resolve the actual reference action
    // before modelling the roll so every native shot uses the same modal rule.
    let native=action;
    if(action.type==='AutoEnemyAdvance') {
      const reference=queryIronDustProfile(profile,action);
      if(!reference.available) throw Error('IRON_DUST_STRONG_REFERENCE_FAILED');
      if(reference.action.kind==='fire') native=reference.action.command;
    }
    const fire=['PlayerFire','EnemyUnitAttack','EnemySystemAttack'].includes(native.type);
    if(!fire) {
      const result=dispatchIronDustCommittedCommand(profile,native);
      if(!result.profile) throw Error(result.error?.code??'IRON_DUST_STRONG_COMMIT_FAILED');
      profile=result.profile;
      return {events:result.events,expectedAdjustment:0};
    }
    const outcomes=Array.from({length:6},(_,face)=>{
      const fork=forkIronDustProfileRng(profile,beforeFace(face));
      const result=dispatchIronDustCommittedCommand(fork,native);
      if(!result.profile) throw Error(result.error?.code??'IRON_DUST_STRONG_FIRE_FAILED');
      const event=result.events.find(event=>Object.hasOwn(event,'roll'));
      if(!event||event.roll!==face) throw Error('IRON_DUST_STRONG_ROLL_MISMATCH');
      return {...result,face,result:event.result};
    });
    const counts={NE:0,D:0,X:0};
    for(const outcome of outcomes) counts[outcome.result]++;
    const modal=['NE','D','X'].sort((a,b)=>counts[b]-counts[a])[0];
    const chosen=outcomes.find(outcome=>outcome.result===modal);
    const expected=outcomes.reduce((sum,outcome)=>sum+materialValue(outcome.profile,packet.side),0)/6;
    profile=chosen.profile;
    return {events:chosen.events,expectedAdjustment:expected-materialValue(profile,packet.side),
      chance:{modal,face:chosen.face,probabilities:Object.fromEntries(Object.entries(counts).map(([key,n])=>[key,n/6]))}};
  }
  return Object.freeze({open,choose,commit,status,evaluate:side=>evaluate(profile,side)});
}
