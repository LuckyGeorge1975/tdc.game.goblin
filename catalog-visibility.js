// Pure viewer projection/reveal reducer. Geometry and world effects belong to caller.
(function(root){
  const VERSION='catalog-visibility-state-v1',TEAMS=['player','enemy'],RULE='phantom-stealth-v1';
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&v.length>0;
  const same=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
  const copy=v=>JSON.parse(JSON.stringify(v)),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
  const reject=code=>{const e=new Error(code);e.code=code;throw e};
  const keys=(v,names,code)=>{if(!object(v)||!same(Object.keys(v).sort(),[...names].sort()))reject(code)};
  const integer=(v,min,max,code)=>{if(!Number.isSafeInteger(v)||v<min||v>max)reject(code)};
  const team=t=>{if(!TEAMS.includes(t))reject('INVALID_VISIBILITY_TEAM')};
  const pairKey=(a,b)=>JSON.stringify([a,b]),cellKey=c=>JSON.stringify([c.x,c.y]);
  function rule(registry){
    if(registry?.schemaVersion!==1||registry.dataVersion!=='catalog-approved-data-v1'||registry.targetProfile!=='full-catalog-approved-v1'||typeof registry.targetActive!=='boolean'||registry.provenance?.approvedProposalSha256!=='44b9e4f473cc3fd83eb41183d1e2e70fd29078875e2f7132995bab6ba70b5d57')reject('INVALID_VISIBILITY_REGISTRY');
    const r=registry.definitions?.stealth?.[RULE];
    const expected={detectionDistance:2,detectionLos:'strict-supercover',detector:'living-active-opposing-nonembarked-unit',teamWide:true,revealOn:['own-fire','incoming-direct-attack-including-NE','incoming-area-attack-including-NE','collision'],revealExpires:'end-next-observing-team-fire-phase',moveAloneReveals:false,hiddenDirectTargetAllowed:false,hiddenAreaVictimAllowed:true,hiddenMovementOccupancy:'stop-at-last-free-prefix-consume-move-reveal',ownUnitsAlwaysKnown:true,projection:'hide-unit-instance-id-position-and-live-intel',objectiveAggregateCountAllowed:true,wallClockTimers:false};
    if(!same(r,expected))reject('UNSUPPORTED_VISIBILITY_RULE');return r;
  }
  function clocks(value){
    keys(value,TEAMS,'INVALID_VISIBILITY_CLOCK');let active=0;
    for(const t of TEAMS){keys(value[t],['completed','active'],'INVALID_VISIBILITY_CLOCK');integer(value[t].completed,0,Number.MAX_SAFE_INTEGER-2,'INVALID_VISIBILITY_CLOCK');if(typeof value[t].active!=='boolean')reject('INVALID_VISIBILITY_CLOCK');if(value[t].active)active++;}
    if(active>1)reject('INVALID_VISIBILITY_CLOCK');return value;
  }
  function factsIndex(facts,registry){
    rule(registry);keys(facts,['revision','map','actors','sensorPairs','teamFire'],'INVALID_VISIBILITY_FACTS');
    if(!id(facts.revision)||!Array.isArray(facts.actors)||!Array.isArray(facts.sensorPairs))reject('INVALID_VISIBILITY_FACTS');
    keys(facts.map,['width','height'],'INVALID_VISIBILITY_MAP');integer(facts.map.width,1,Number.MAX_SAFE_INTEGER,'INVALID_VISIBILITY_MAP');integer(facts.map.height,1,Number.MAX_SAFE_INTEGER,'INVALID_VISIBILITY_MAP');clocks(facts.teamFire);
    const actors=new Map(),bindings=[];
    for(const a of facts.actors){
      keys(a,['runtimeUnitId','assetId','team','alive','disabled','embarkedOn','x','y'],'INVALID_VISIBILITY_ACTOR');
      if(!id(a.runtimeUnitId)||actors.has(a.runtimeUnitId)||!id(a.assetId)||!object(registry.units?.[a.assetId]?.target)||typeof a.alive!=='boolean'||typeof a.disabled!=='boolean'||!(a.embarkedOn===null||id(a.embarkedOn)))reject('INVALID_VISIBILITY_ACTOR');
      team(a.team);integer(a.x,0,facts.map.width-1,'INVALID_VISIBILITY_POSITION');integer(a.y,0,facts.map.height-1,'INVALID_VISIBILITY_POSITION');actors.set(a.runtimeUnitId,a);
      const target=registry.units[a.assetId].target;
      if(target.stealthRef!==undefined){
        if(target.stealthRef!==RULE||target.systemDefinitionRef!=='ninja'||target.stealth!==true||a.embarkedOn!==null)reject('INVALID_VISIBILITY_BINDING');
        bindings.push({runtimeUnitId:a.runtimeUnitId,assetId:a.assetId,team:a.team,stealthRef:RULE});
      }
    }
    bindings.sort((a,b)=>a.runtimeUnitId<b.runtimeUnitId?-1:a.runtimeUnitId>b.runtimeUnitId?1:0);
    const pairs=new Map(),stealthIds=new Set(bindings.map(b=>b.runtimeUnitId));
    for(const p of facts.sensorPairs){
      keys(p,['observerId','targetId','distance','hasLineOfSight'],'INVALID_VISIBILITY_PAIR');
      const a=actors.get(p.observerId),b=actors.get(p.targetId),key=pairKey(p.observerId,p.targetId);
      if(!a||!b||!a.alive||a.disabled||a.embarkedOn!==null||!b.alive||a.team===b.team||!stealthIds.has(b.runtimeUnitId)||pairs.has(key)||typeof p.hasLineOfSight!=='boolean')reject('INVALID_VISIBILITY_PAIR');
      integer(p.distance,0,Number.MAX_SAFE_INTEGER,'INVALID_VISIBILITY_PAIR');pairs.set(key,p);
    }
    for(const binding of bindings){const subject=actors.get(binding.runtimeUnitId);if(!subject.alive)continue;
      for(const observer of facts.actors)if(observer.alive&&!observer.disabled&&observer.embarkedOn===null&&observer.team!==subject.team&&!pairs.has(pairKey(observer.runtimeUnitId,subject.runtimeUnitId)))reject('INCOMPLETE_VISIBILITY_PAIRS');
    }
    for(const p of pairs.values()){const reverse=pairs.get(pairKey(p.targetId,p.observerId));if(reverse&&(reverse.distance!==p.distance||reverse.hasLineOfSight!==p.hasLineOfSight))reject('INCONSISTENT_VISIBILITY_PAIRS');}
    return {actors,pairs,bindings};
  }
  function checked(state,facts,registry,requireClock=true){
    const index=factsIndex(facts,registry);
    keys(state,['version','dataVersion','dataProfile','ruleRef','rules','bindings','teamFire','reveals','sequence','lastEventId'],'INVALID_VISIBILITY_STATE');
    if(state.version!==VERSION||state.dataVersion!==registry.dataVersion||state.dataProfile!==registry.targetProfile||state.ruleRef!==RULE||!same(state.rules,rule(registry))||!same(state.bindings,index.bindings))reject('VISIBILITY_BINDING_MISMATCH');
    integer(state.sequence,0,Number.MAX_SAFE_INTEGER-1,'INVALID_VISIBILITY_SEQUENCE');if(state.sequence===0?state.lastEventId!==null:!id(state.lastEventId))reject('INVALID_VISIBILITY_SEQUENCE');clocks(state.teamFire);
    if(requireClock&&!same(state.teamFire,facts.teamFire))reject('VISIBILITY_CLOCK_MISMATCH');
    if(!Array.isArray(state.reveals))reject('INVALID_VISIBILITY_REVEAL');const seen=new Set();
    for(const r of state.reveals){
      keys(r,['runtimeUnitId','viewerTeam','untilFireEnd'],'INVALID_VISIBILITY_REVEAL');team(r.viewerTeam);
      const b=state.bindings.find(b=>b.runtimeUnitId===r.runtimeUnitId),key=pairKey(r.runtimeUnitId,r.viewerTeam);
      if(!b||b.team===r.viewerTeam||seen.has(key))reject('INVALID_VISIBILITY_REVEAL');seen.add(key);
      integer(r.untilFireEnd,state.teamFire[r.viewerTeam].completed+1,Number.MAX_SAFE_INTEGER,'INVALID_VISIBILITY_REVEAL');
    }
    return index;
  }
  function validate(state,facts,registry){checked(state,facts,registry);return true}
  function create(registry,bindings,facts){
    const index=factsIndex(facts,registry);
    if(!same(bindings,index.bindings))reject('VISIBILITY_BINDING_MISMATCH');
    return freeze({version:VERSION,dataVersion:registry.dataVersion,dataProfile:registry.targetProfile,ruleRef:RULE,rules:copy(rule(registry)),bindings:copy(bindings),teamFire:copy(facts.teamFire),reveals:[],sequence:0,lastEventId:null});
  }
  function known(state,viewerTeam,actor,index){
    if(!actor)return false;
    if(actor.team===viewerTeam||!actor.alive||!index.bindings.some(b=>b.runtimeUnitId===actor.runtimeUnitId))return true;
    if(state.reveals.some(r=>r.runtimeUnitId===actor.runtimeUnitId&&r.viewerTeam===viewerTeam&&state.teamFire[viewerTeam].completed<r.untilFireEnd))return true;
    return [...index.pairs.values()].some(p=>p.targetId===actor.runtimeUnitId&&index.actors.get(p.observerId).team===viewerTeam&&p.distance<=state.rules.detectionDistance&&p.hasLineOfSight);
  }
  function isKnown(state,viewerTeam,runtimeUnitId,facts,registry){team(viewerTeam);const index=checked(state,facts,registry);return id(runtimeUnitId)?known(state,viewerTeam,index.actors.get(runtimeUnitId),index):false}
  function project(state,viewerTeam,facts,registry){
    team(viewerTeam);const index=checked(state,facts,registry),actors=facts.actors.filter(a=>known(state,viewerTeam,a,index)).map(copy);
    return freeze({knownIds:actors.map(a=>a.runtimeUnitId),actors});
  }
  function knownOccupancy(state,viewerTeam,facts,registry){return freeze(project(state,viewerTeam,facts,registry).actors.filter(a=>a.alive&&a.embarkedOn===null).map(copy))}
  function eventBase(state,event){if(!object(event)||!id(event.id)||event.id===state.lastEventId||event.seq!==state.sequence+1)reject('INVALID_VISIBILITY_EVENT_ORDER')}
  function reveal(next,subjectId,reason,index,effects){
    const b=next.bindings.find(b=>b.runtimeUnitId===subjectId);if(!b)return;
    for(const viewer of TEAMS.filter(t=>t!==b.team)){
      const clock=next.teamFire[viewer],untilFireEnd=clock.completed+(clock.active?2:1),existing=next.reveals.find(r=>r.runtimeUnitId===subjectId&&r.viewerTeam===viewer);
      if(existing)existing.untilFireEnd=Math.max(existing.untilFireEnd,untilFireEnd);else next.reveals.push({runtimeUnitId:subjectId,viewerTeam:viewer,untilFireEnd});
      effects.push({type:'VisibilityRevealed',runtimeUnitId:subjectId,viewerTeam:viewer,reason,untilFireEnd:existing?existing.untilFireEnd:untilFireEnd});
    }
    next.reveals.sort((a,b)=>pairKey(a.runtimeUnitId,a.viewerTeam)<pairKey(b.runtimeUnitId,b.viewerTeam)?-1:1);
  }
  function reduce(state,event,facts,registry){
    const index=checked(state,facts,registry,false);eventBase(state,event);const next=copy(state),effects=[];
    if(event.type==='fire-start'||event.type==='fire-end'){
      keys(event,['type','id','seq','team'],'INVALID_VISIBILITY_EVENT');team(event.team);
      const expected=copy(state.teamFire),c=expected[event.team];
      if(event.type==='fire-start'){if(c.active||TEAMS.some(t=>expected[t].active))reject('INVALID_VISIBILITY_FIRE_BOUNDARY');c.active=true;}
      else{if(!c.active)reject('INVALID_VISIBILITY_FIRE_BOUNDARY');c.active=false;c.completed++;}
      if(!same(expected,facts.teamFire))reject('VISIBILITY_CLOCK_MISMATCH');next.teamFire=expected;
      next.reveals=next.reveals.filter(r=>r.untilFireEnd>next.teamFire[r.viewerTeam].completed);
    }else{
      if(!same(state.teamFire,facts.teamFire))reject('VISIBILITY_CLOCK_MISMATCH');
      if(event.type==='refresh')keys(event,['type','id','seq'],'INVALID_VISIBILITY_EVENT');
      else if(event.type==='reveal'){
        keys(event,['type','id','seq','subjectId','reason','result'],'INVALID_VISIBILITY_EVENT');
        if(!index.actors.has(event.subjectId)||!['own-fire','incoming-direct','incoming-area','collision'].includes(event.reason))reject('INVALID_VISIBILITY_EVENT');
        if(['incoming-direct','incoming-area'].includes(event.reason)?!['NE','D','X'].includes(event.result):event.result!==null)reject('INVALID_VISIBILITY_EVENT');
        reveal(next,event.subjectId,event.reason,index,effects);
      }else reject('INVALID_VISIBILITY_EVENT');
    }
    next.sequence=event.seq;next.lastEventId=event.id;validate(next,facts,registry);return freeze({state:next,effects});
  }
  function collisionPrefix(state,request,facts,registry){
    const index=checked(state,facts,registry);keys(request,['id','seq','actorId','phase','path'],'INVALID_VISIBILITY_COLLISION');eventBase(state,request);
    const actor=index.actors.get(request.actorId);
    if(!actor||!actor.alive||actor.disabled||actor.embarkedOn!==null||!['movement','gev'].includes(request.phase)||!Array.isArray(request.path)||!request.path.length)reject('INVALID_VISIBILITY_COLLISION');
    const visited=new Set(),prefix=[],effects=[],revealedIds=[];
    for(const cell of request.path){
      keys(cell,['x','y'],'INVALID_VISIBILITY_PATH');integer(cell.x,0,facts.map.width-1,'INVALID_VISIBILITY_PATH');integer(cell.y,0,facts.map.height-1,'INVALID_VISIBILITY_PATH');
      const key=cellKey(cell);if(visited.has(key)||key===cellKey(actor))reject('INVALID_VISIBILITY_PATH');visited.add(key);
    }
    for(const cell of request.path){
      const occupied=facts.actors.filter(a=>a.alive&&a.embarkedOn===null&&a.runtimeUnitId!==actor.runtimeUnitId&&a.x===cell.x&&a.y===cell.y);
      if(occupied.some(a=>known(state,actor.team,a,index)))reject('COLLISION_PATH_NOT_VALIDATED');
      if(occupied.length){revealedIds.push(...occupied.map(a=>a.runtimeUnitId));break;}
      prefix.push(copy(cell));
    }
    const next=copy(state);for(const subject of revealedIds)reveal(next,subject,'collision',index,effects);
    next.sequence=request.seq;next.lastEventId=request.id;validate(next,facts,registry);
    return freeze({state:next,acceptedPrefix:prefix,consumeMovementAction:true,actorId:actor.runtimeUnitId,phase:request.phase,collided:revealedIds.length>0,revealedIds:[...revealedIds].sort(),effects});
  }
  root.GoblinCatalogVisibility=Object.freeze({VERSION,create,validate,isKnown,project,knownOccupancy,reduce,collisionPrefix});
})(globalThis);
