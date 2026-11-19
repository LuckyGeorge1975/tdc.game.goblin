import {createAiPolicyRegistry} from './ai-policy-registry.mjs?v=1';
import {hexDistance} from './hex.mjs';

export const FULL_ATTACK_2A_ENGINE = '91cc3f4170d242631e4f821d12e259daabded6af';
export const FULL_ATTACK_2A_MODEL_SHA256 = 'df5e5a1f48b2e5c2c3618418cb76440ea73030b909cf90f3f3d685ee7bd6f3ba';
export const FULL_ATTACK_2A_ID = 'full-attack-2a';
const evaluatedEngine = '8e9adbd284d9dd7b5fb0c5c4a873325fd3242313';
const feature = 'goblin-full-fire-effects-v1';
const scope = Object.freeze({engine:FULL_ATTACK_2A_ENGINE,profile:'FULL_CATALOG_v1',
  side:'player',slot:'fire',feature});
const kinds = ['unit-crt','component-crt','tread-roll-5-6','area'];
const ratios = ['1-2','1-1','2-1','3-1','4-1','5-1'];
const onBoard = unit => unit.alive && !unit.embarkedOn;

function area(batch, target) {
  const counts = [0,0,0,0];
  for (const unit of batch.view.units) {
    if (!onBoard(unit)) continue;
    const distance=hexDistance(unit,target);
    if (distance<=1) counts[(unit.relation==='own'?0:2)+distance]++;
  }
  return counts;
}

export function encodeFullFireEffects(batch, candidate) {
  const {effectKind,ratioCategory,attack,range,objectiveTarget,disabledTarget,mode}=candidate.facts;
  if (!kinds.includes(effectKind)||!Number.isFinite(attack)||!Number.isFinite(range)) return null;
  const crt=effectKind.endsWith('-crt');
  if (crt?!ratios.includes(ratioCategory):ratioCategory!=null) return null;
  if (effectKind!=='area'&&(typeof objectiveTarget!=='boolean'||typeof disabledTarget!=='boolean')) return null;
  const [ownCenter,ownNear,enemyCenter,enemyNear]=effectKind==='area'?area(batch,candidate.target):[0,0,0,0];
  return [...kinds.map(kind=>Number(effectKind===kind)),...ratios.map(ratio=>Number(ratioCategory===ratio)),
    attack/8,range/8,Number(objectiveTarget===true),Number(disabledTarget===true),Number(mode==='indirect'),
    ownCenter,ownNear/6,enemyCenter,enemyNear/6];
}

function objectiveScore(batch, candidate, input) {
  if (candidate.facts.effectKind==='area') return 2*input[17]+6*input[18]-4*input[15]-12*input[16];
  const target=batch.view.units.find(unit=>unit.id===candidate.target?.unitId);
  const component=candidate.target?.componentId??'';
  const material=component.startsWith('missiles')?4:component.startsWith('main')?3:component.startsWith('secondary')?2:0;
  const treads=component==='treads'?4+(target?.systems?.treads<=6?6:0):0;
  return 24*input[12]+5*input[13]+ratios.indexOf(candidate.facts.ratioCategory)+material+treads;
}

export function scoreFullFireEffects(model, input) {
  return model.hidden.reduce((sum,node,i)=>sum+model.output.weights[i]*Math.tanh(
    node.weights.reduce((value,weight,j)=>value+weight*input[j],node.bias)),model.output.bias);
}

function select(candidate,reason,report,options) {
  const key=candidate?.key;
  if (key!==undefined) report?.({key,explanationKey:`v2.round.${reason}`,options});
  return key;
}

const endPhase=(batch,report)=>select(batch.candidates.find(candidate=>candidate.kind==='end-phase'),'objectivePass',report);

function selectMovement(batch,report) {
  const opponents=batch.view.units.filter(unit=>onBoard(unit)&&unit.relation==='opponent');
  const core=opponents.find(unit=>unit.objectiveTarget);
  for (const actor of batch.view.units) {
    if (!onBoard(actor)||actor.relation!=='own'||actor.disabled) continue;
    const target=core??opponents.toSorted((a,b)=>hexDistance(actor,a)-hexDistance(actor,b)||a.id.localeCompare(b.id))[0];
    if (!target) continue;
    const distance=hexDistance(actor,target);
    const best=batch.candidates.filter(candidate=>candidate.kind==='move'&&candidate.actorId===actor.id&&
      hexDistance(candidate.target,target)<distance)
      .toSorted((a,b)=>hexDistance(a.target,target)-hexDistance(b.target,target)||a.target.y-b.target.y||a.target.x-b.target.x)[0];
    if (best) return select(best,'objectiveMove',report);
  }
  return endPhase(batch,report);
}

function targetsActiveDeadlineObjective(view, candidate) {
  const objectives=view.objectives??[];
  const limit=objectives.find(goal=>goal.kind==='enemy-turn-limit');
  if (!Number.isSafeInteger(limit?.turns)||!Number.isSafeInteger(limit.completedEnemyTurns)||
      limit.completedEnemyTurns>=limit.turns) return false;
  const goal=objectives.find(goal=>goal.kind==='destroy-core'&&goal.satisfied===false&&goal.target?.kind==='unit');
  if (!goal) return false;
  const target=view.units.find(unit=>unit.id===goal.target.unitId&&unit.relation==='opponent'&&onBoard(unit));
  if (!target) return false;
  if (candidate.target.kind==='cell') return candidate.target.x===target.x&&candidate.target.y===target.y;
  return candidate.target.unitId===target.id;
}

function selectFire(batch, model, report) {
  const shots=[];
  let baseline;
  for (const candidate of batch.candidates) {
    if (candidate.kind!=='fire'&&candidate.kind!=='hex-fire') continue;
    const input=encodeFullFireEffects(batch,candidate);
    if (!input) continue;
    const points=objectiveScore(batch,candidate,input);
    const shot={candidate,input,points};
    shots.push(shot);
    if (candidate.kind==='hex-fire'&&points<=0) continue;
    if (!baseline||points>baseline.points) baseline=shot;
  }
  if (!baseline) return endPhase(batch,report);
  const deadline=targetsActiveDeadlineObjective(batch.view,baseline.candidate);
  const options=()=>shots.map(shot=>({key:shot.candidate.key,baseline:shot===baseline,
    scores:{basis:shot.points,model:shot.modelScore}}));
  if (!model||deadline) return select(baseline.candidate,deadline?'deadlinePriority':'objectiveFire',
    report,report?options():undefined);
  const {actorId,weaponRef}=baseline.candidate;
  let selected=baseline.candidate, highest=baseline.modelScore=scoreFullFireEffects(model,baseline.input);
  for (const shot of shots) {
    const {candidate,input}=shot;
    if (shot===baseline||candidate.actorId!==actorId||candidate.weaponRef!==weaponRef) continue;
    const value=shot.modelScore=scoreFullFireEffects(model,input);
    if (value>highest) { selected=candidate; highest=value; }
  }
  return select(selected,selected===baseline.candidate?'modelBaseline':'modelTarget',report,report?options():undefined);
}

function compile(bytes) {
  const {commit,model}=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  const weights=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
  if (commit!==evaluatedEngine||model?.version!=='goblin-full-qualification-v3'||model.featureVersion!==feature||
      model.rewardVersion!=='goblin-mission-win-pair-v1'||!Array.isArray(model.hidden)||model.hidden.length!==8||
      !model.hidden.every(node=>Number.isFinite(node?.bias)&&weights(node.weights,19))||
      !Number.isFinite(model.output?.bias)||!weights(model.output.weights,8)) throw Error('AI_POLICY_INVALID');
  return (batch,report)=>selectFire(batch,model,report);
}

export async function prepareFullAttack2a({engine,modelBytes,crypto}) {
  if (engine!==scope.engine) throw Error('AI_POLICY_SCOPE_MISMATCH');
  const registry=createAiPolicyRegistry([{id:FULL_ATTACK_2A_ID,label:'FULL 2A',sha256:FULL_ATTACK_2A_MODEL_SHA256,
    evaluation:'objective-2a',schemaVersion:1,scopes:[scope]}],crypto);
  await registry.install(FULL_ATTACK_2A_ID,modelBytes,compile);
  const policy=registry.bind(FULL_ATTACK_2A_ID,[scope]);

  return function choose(batch,port,report) {
    const state=port.state();
    if (!state||state.policyId!==FULL_ATTACK_2A_ID||state.profileId!==scope.profile||state.side!==scope.side||
        state.controller!=='ai'||state.ended||state.paused||!batch?.ok||batch.schemaVersion!==1||
        batch.side!==scope.side||batch.phase!==state.phase||batch.slot!==state.slot||
        batch.view?.side!==scope.side||batch.view.phase!==state.phase)
      throw Error('AI_POLICY_SCOPE_MISMATCH');
    if (state.phase==='fire') return policy.select(scope,batch,report);
    if (state.phase==='movement'||state.phase==='gev') return selectMovement(batch,report);
    throw Error('AI_POLICY_SCOPE_MISMATCH');
  };
}
