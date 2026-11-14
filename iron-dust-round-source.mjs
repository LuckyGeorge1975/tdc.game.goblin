import {createRoundRecorder,visibleRoundPath} from './round-view-producer.mjs?v=4';
import {dispatchIronDustProfile,validateIronDustProfile} from './src/core/iron-dust-executable-profile.mjs?v=2';

const stateOf = profile => profile.entry.mode==='enemy'?profile.entry.payload.state:profile.entry.payload;
const kind = Object.freeze({UnitMoved:'move',EnemyMoved:'move',RamResolved:'ram',PlayerFireResolved:'fire',
  EnemyUnitFireResolved:'fire',EnemySystemFireResolved:'fire',EnemyHeld:'special',EnemySkipped:'special',
  EnemyPassRecorded:'special',UnitRecovered:'special',WeaponSelected:'special',PhaseChanged:'phase'});
const label = Object.freeze(Object.fromEntries(['ogre','gev','missile','infantry','core','guard','raider']
  .map(id=>[id,`v2.unit.${id}`])));

function boardOf(state) {
  const {width,height,terrain,defaultTerrain}=state.map;
  const units=state.units.filter(unit=>unit.hp>0&&!unit.embarkedOn).map(unit=>({
    id:unit.id,labelKey:label[unit.id]??'v2.unit.unknown',cell:{x:unit.x,y:unit.y}
  }));
  return {width,height,terrain,defaultTerrain,units};
}

function observations(before, after, events, captureRoundEvent, options) {
  const facts = new Map(after.units.map(unit=>[unit.id,{id:unit.id,labelKey:label[unit.id]??'v2.unit.unknown',
    cell:{x:unit.x,y:unit.y}}]));
  const board=boardOf(after);
  const rows=events.flatMap(event=>{
    if (!Object.hasOwn(kind,event.type)) return [];
    const actorId=event.actorId??event.attackerId??event.unitId??null;
    const actor=facts.get(actorId);
    // EnemyMoved.targetId is the automation's intent target. It is not an
    // attacked unit or a movement destination in the public action.
    const target=event.type==='EnemyMoved'?null:facts.get(event.targetId);
    const path=actor&&event.from&&event.path?[event.from,...event.path]:[];
    const paths=visibleRoundPath(path,()=>true).map(cells=>({id:actorId,cells}));
    const side=before.units.find(unit=>unit.id===actorId)?.team??event.side??before.activeTeam;
    const informative=!['EnemySkipped','EnemyPassRecorded','EnemyHeld'].includes(event.type);
    const result=event.type==='RamResolved'?'X':event.result;
    return [captureRoundEvent({kind:kind[event.type],side,actor,
      target:event.type==='EnemyMoved'?facts.get(event.targetId):target,result,
      snapshot:{...board,paths},options:options?.get(event)},
    informative?{observable:true,actor,target,result,snapshot:board,paths}:null)];
  });
  return rows;
}

// Headless Core reference host. It owns game state and dispatch, separate from
// the read-only renderer. Reuse captureIronDustRoundCommit in a browser host.
export function createIronDustRoundRecorder(initialProfile, readProfile, mode='player') {
  const profile=validateIronDustProfile(initialProfile);
  if(profile.entry.mode!=='player'||stateOf(profile).phase!=='movement') throw Error('ROUND_START_INVALID');
  const session={};
  // The live spectator board carries display facts and never the profile or policy DTO.
  const spectatorBoard=()=>{
    const current=readProfile();
    if (!current) return null;
    const state=stateOf(current);
    const {width,height,terrain,defaultTerrain,units}=boardOf(state);
    return {width,height,terrain,defaultTerrain,units,roundNumber:state.turn,
      side:state.activeTeam,phase:state.phase,ended:current.entry.mode==='ended'};
  };
  return createRoundRecorder({session,mode,initialRound:stateOf(profile).turn,spectatorBoard,readAuthority:()=>{
    const current=readProfile();
    if (!current) return null;
    const state=stateOf(current);
    return {session,mode,round:state.turn,side:state.activeTeam,phase:state.phase,ended:current.entry.mode==='ended'};
  }});
}

export function createIronDustRoundHost(initialProfile,{mode='player',execute=dispatchIronDustProfile} = {}) {
  let profile=initialProfile;
  const recorder=createIronDustRoundRecorder(initialProfile,()=>profile,mode);
  function dispatch(command) {
    if (profile.entry.mode==='ended') return execute(profile,command);
    const commit=recorder.beginCommit();
    const before=profile, result=execute(before,command);
    if (!result.profile) return result;
    profile=result.profile;
    captureIronDustRoundCommit(commit,before,result);
    return result;
  }
  return Object.freeze({dispatch,view:recorder.view,get profile(){return profile}});
}

export function captureIronDustRoundCommit(commit,before,{profile,events}, privateOptions) {
  const previous=stateOf(before), next=stateOf(profile);
  const finished=profile.entry.mode==='ended';
  const complete=previous.activeTeam==='enemy' && events.some(event=>event.type==='PhaseChanged'&&
    event.from==='enemy'&&event.side==='player'&&event.to==='movement'&&event.turn===next.turn);
  commit.accept({roundNumber:previous.turn,events:observations(previous,next,events,commit.captureRoundEvent,privateOptions),
    ...(finished?{boundary:'terminal-partial'}:complete?{boundary:'complete'}:{})});
}
