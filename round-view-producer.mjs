const KINDS = Object.freeze({move:'v2.ui.move',fire:'v2.ui.fire',ram:'v2.ui.ram',
  special:'v2.event.unknown',phase:'v2.event.PhaseChanged','observed-effect':'v2.event.unknown'});
const RESULTS = Object.freeze({NE:'NE',D:'D',X:'X'});
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const point = ({x,y}) => ({x,y});

function encodeRound(round, perspective) {
  const tokens = new Map();
  function token(id, rowKey) {
    const key=perspective==='player'?`${rowKey}:${id}`:id;
    if (!tokens.has(key)) tokens.set(key,`unit-${tokens.size+1}`);
    return tokens.get(key);
  }
  const rows = round.rows.map((row,index) => {
    const result = {rowKey:`row-${index+1}`,side:row.side,kind:row.kind,descriptionKey:KINDS[row.kind]};
    const entity = fact => ({token:token(fact.id,result.rowKey),labelKey:fact.labelKey,
      ...(fact.cell ? {cell:point(fact.cell)} : {})});
    if (row.actor) result.actor=entity(row.actor);
    if (row.target) result.target=entity(row.target);
    if (row.targetCell) result.targetCell=point(row.targetCell);
    if (row.hits?.length) result.hits=row.hits.map(hit=>({target:entity(hit.target),resultKey:RESULTS[hit.result]}));
    if (Object.hasOwn(RESULTS,row.result)) result.resultKey=RESULTS[row.result];
    if (row.snapshot) {
      const {width,height,defaultTerrain,terrain,units,paths} = row.snapshot;
      result.snapshot={width,height,defaultTerrain,terrain,units:units.map(entity),
        visiblePathSegments:paths.map(({id,cells})=>({entityToken:token(id,result.rowKey),cells}))};
    }
    if (perspective !== 'player' && row.options?.length) {
      result.options=row.options.map((option,i)=>({optionKey:`option-${i+1}`,
        descriptionKey:KINDS[option.kind],selected:option.selected===true,
        ...(option.target?{target:entity(option.target)}:{}),
        ...(option.targetCell?{targetCell:point(option.targetCell)}:{}),
        ...(option.component?{component:option.component}:{}),
        ...(Number.isFinite(option.score)?{score:option.score}:{})}));
    }
    if (perspective !== 'player' && row.explanationKey) result.explanationKey=row.explanationKey;
    return result;
  });
  return freeze({schemaVersion:1,roundNumber:round.number,perspective,completion:round.completion,rows});
}

function copyRow(row) {
  if (!row || !Object.hasOwn(KINDS,row.kind) || !['player','enemy'].includes(row.side))
    throw Error('ROUND_EVENT_INVALID');
  const subject = fact => fact && {id:fact.id,labelKey:fact.labelKey,...(fact.cell?{cell:point(fact.cell)}:{})};
  const copy={kind:row.kind,side:row.side,actor:subject(row.actor),target:subject(row.target),
    result:typeof row.result==='string'?row.result:null};
  if (row.targetCell) copy.targetCell=point(row.targetCell);
  if (row.hits) copy.hits=row.hits.filter(hit=>Object.hasOwn(RESULTS,hit.result))
    .map(hit=>({target:subject(hit.target),result:hit.result}));
  if (row.explanationKey) copy.explanationKey=row.explanationKey;
  if (row.snapshot) {
    const {width,height,defaultTerrain,terrain,units,paths} = row.snapshot;
    const ids=new Set(units.map(unit=>unit.id));
    copy.snapshot={width,height,defaultTerrain,terrain:terrain.map(({x,y,type})=>({x,y,type})),
      units:units.map(subject),paths:paths.filter(path=>ids.has(path.id)&&path.cells.length>=2)
        .map(({id,cells})=>({id,cells:cells.map(point)}))};
  }
  if (row.options) copy.options=row.options.filter(option=>Object.hasOwn(KINDS,option.kind))
    .map(option=>({kind:option.kind,target:subject(option.target),selected:option.selected===true,
      ...(option.targetCell?{targetCell:point(option.targetCell)}:{}),
      ...(option.component?{component:option.component}:{}),
      ...(Number.isFinite(option.score)?{score:option.score}:{})}));
  return copy;
}

// Trusted event capture only. publicEvidence is obtained independently from
// engine visibility and the actual public event, never from a policy or UI.
function captureRoundEvent(event, publicEvidence = null) {
  const full=copyRow(event);
  if (!publicEvidence?.observable) return {full,public:null};
  const {actor, target, result, snapshot, paths} = publicEvidence;
  const named = !event.actor || actor?.id===event.actor.id;
  const visible={side:event.side,kind:named?event.kind:'observed-effect',
    actor:named&&event.actor?actor:null,target:target?.id===event.target?.id?target:null,result};
  if (publicEvidence.targetCell) visible.targetCell=publicEvidence.targetCell;
  if (publicEvidence.hits) visible.hits=publicEvidence.hits;
  if (snapshot) visible.snapshot={...snapshot,paths:paths??[]};
  // This slice publishes no player alternatives. A visible target alone does
  // not prove that ranking, count or even the option's existence are public.
  return {full,public:copyRow(visible)};
}

// FULL commit boundaries can attest a hit or a newly revealed subject. They
// cannot attest all intermediate coordinates. A path needs explicit per-step
// evidence from the commit source, including visibility of the mover there.
function captureFullRoundEvent(event, {before,after,disclosure}) {
  if (!disclosure) return captureRoundEvent(event);
  const lookup=(id, frame)=>frame?.units.find(unit=>unit.id===id);
  const disclosed=(id,timing)=>timing==='before'?lookup(id,before):timing==='after'?lookup(id,after):null;
  const actor=event.actor?disclosed(event.actor.id,disclosure.actor):null;
  const target=event.target?disclosed(event.target.id,disclosure.target):null;
  const hits=event.hits?.filter(hit=>lookup(hit.target.id,after));
  if (!actor && !target && !hits?.length && disclosure.observableEffect!==true) return captureRoundEvent(event);
  const snapshot=disclosure.boardVisible===true?after:null;
  const ownsMarker=snapshot?.units.some(unit=>unit.id===actor?.id);
  const path=event.snapshot?.paths.find(segment=>segment.id===actor?.id)?.cells;
  const steps=path && Array.isArray(disclosure.visibleSteps)&&disclosure.visibleSteps.length===path.length
    ? visibleRoundPath(path,index=>disclosure.visibleSteps[index]===true):[];
  const paths=ownsMarker ? steps.map(cells=>({id:actor.id,cells})):[];
  return captureRoundEvent(event,{observable:true,actor,target,snapshot,paths,hits,
    targetCell:disclosure.targetCellVisible===true?event.targetCell:null,
    result:disclosure.resultVisible===true?event.result:null});
}

// Paths carry evidence per accepted step. A gap closes the current polyline.
export function visibleRoundPath(cells, canSee) {
  const segments=[];
  let current=[];
  for (const [index,cell] of cells.entries()) {
    if (canSee(index)) current.push(point(cell));
    else if (current.length) {segments.push(current);current=[]}
  }
  if (current.length) segments.push(current);
  return segments.filter(segment=>segment.length>=2);
}

// Each recorder is bound once by the trusted host. Only view() belongs in UI.
export function createRoundRecorder({session, mode, initialRound, readAuthority}) {
  if (!session || !['player','spectator'].includes(mode) || !Number.isSafeInteger(initialRound) || initialRound<1)
    throw Error('ROUND_SESSION_INVALID');
  let round = initialRound, terminal=false, playerView=null;
  const completed=[];
  let base={parent:null}, head=base;
  let generation=0;
  const checkpoints=new WeakMap();

  function live() {
    const authority=readAuthority();
    return authority?.session===session && authority.mode===mode ? authority : null;
  }
  function checkpoint() {
    const authority=live();
    if (!authority || terminal || authority.ended) return null;
    const key=Object.freeze({});
    checkpoints.set(key,{round,head});
    return key;
  }
  function rewind(key) {
    const authority=live(), saved=checkpoints.get(key);
    if (!authority || authority.ended || terminal || saved?.round!==round || authority.round!==round) return false;
    for (let node=head;node;node=node.parent) if (node===saved.head) {
      head=node;
      generation++;
      return true;
    }
    return false;
  }
  function rows() {
    const all=[];
    for (let node=head;node!==base;node=node.parent) all.push(node);
    const ordered=all.reverse();
    return {public:ordered.flatMap(node=>node.public),full:ordered.flatMap(node=>node.full)};
  }
  // The host opens this before applying the native action. A receipt and its
  // opaque event handles are valid only at this exact parent and undo generation.
  function beginCommit() {
    const authority=live();
    if (!authority || terminal || authority.ended || authority.round!==round)
      throw Error('ROUND_RECEIPT_STALE');
    const parent=head, openedGeneration=generation, openedRound=round;
    const captures=new WeakMap();
    function bind(row) {
      const event=Object.freeze({});
      captures.set(event,row);
      return event;
    }
    return Object.freeze({
      captureRoundEvent:(...args)=>bind(captureRoundEvent(...args)),
      captureFullRoundEvent:(...args)=>bind(captureFullRoundEvent(...args)),
      accept(receipt) {
        if (head!==parent || generation!==openedGeneration || round!==openedRound)
          throw Error('ROUND_RECEIPT_STALE');
        const {events}=receipt;
        if (!Array.isArray(events)) throw Error('ROUND_RECEIPT_STALE');
        if (new Set(events).size!==events.length || events.some(event=>!captures.has(event)))
          throw Error('ROUND_EVENT_INVALID');
        accept({...receipt,events:events.map(event=>captures.get(event))});
      }
    });
  }
  function accept({roundNumber, events, boundary}) {
    const authority=live();
    if (!authority || terminal || roundNumber!==round)
      throw Error('ROUND_RECEIPT_STALE');
    if (boundary==='complete' && (authority.ended || authority.round!==round+1 ||
        authority.side!=='player' || authority.phase!=='movement')) throw Error('ROUND_BOUNDARY_INVALID');
    if (boundary==='terminal-partial' && (!authority.ended || authority.round!==round)) throw Error('ROUND_BOUNDARY_INVALID');
    if (boundary===undefined && (authority.ended || authority.round!==round)) throw Error('ROUND_BOUNDARY_MISSING');
    if (boundary!==undefined && !['complete','terminal-partial'].includes(boundary)) throw Error('ROUND_BOUNDARY_INVALID');
    head={parent:head,public:events.flatMap(event=>event.public?[event.public]:[]),full:events.map(event=>event.full)};
    if (!boundary) return;
    const captured=rows();
    completed.push({number:round,completion:boundary,rows:captured.full});
    if (boundary==='complete') {
      playerView=encodeRound({number:round,completion:boundary,rows:captured.public},'player');
      round++;
    } else terminal=true;
    base={parent:null};head=base;
  }
  function view() {
    const authority=live();
    if (!authority) return null;
    if (mode==='spectator' || terminal && authority.ended) {
      const perspective=mode==='spectator'?'spectator':'post-mission';
      const rounds=completed.map(record=>encodeRound(record,perspective));
      return Object.freeze({latestComplete:rounds.findLast(item=>item.completion==='complete')??null,
        terminalPartial:rounds.findLast(item=>item.completion==='terminal-partial')??null,trace:Object.freeze(rounds)});
    }
    return Object.freeze({latestComplete:playerView,terminalPartial:null});
  }
  // A live spectator trace is separate from the renderer's completed-round DTO.
  // Never attach it to the ordinary view, including terminal-withheld states.
  function spectatorCurrent() {
    const authority=live();
    if (!authority || authority.ended || mode!=='spectator' || terminal) return null;
    const current=encodeRound({number:round,completion:'complete',rows:rows().full},'spectator');
    return freeze({schemaVersion:1,roundNumber:round,rows:current.rows});
  }
  return Object.freeze({beginCommit,checkpoint,rewind,view,spectatorCurrent});
}
