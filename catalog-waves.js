// Pure fixed U3-wave reducer. No unit factory, geometry, RNG, history or world writes.
(function(root){
  const VERSION='catalog-wave-state-v1',CONFIG_VERSION='catalog-wave-config-v1',TEAMS=['player','enemy'];
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&v.length>0;
  const same=(a,b)=>a===b||!!(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k])));
  const canonical=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]))):v;
  const text=v=>JSON.stringify(canonical(v)),copy=v=>JSON.parse(JSON.stringify(v)),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
  const reject=code=>{const error=new Error(code);error.code=code;throw error};
  const keys=(v,names,code)=>{if(!object(v)||!same(Object.keys(v).sort(),[...names].sort()))reject(code)};
  const integer=(v,min,max,code)=>{if(!Number.isSafeInteger(v)||v<min||v>max)reject(code)};
  const CONFIG=freeze({version:CONFIG_VERSION,waves:[
    {id:'u3-guard-3',team:'enemy',dueOwnTurn:3,templateId:'u3-wave-guard',entries:[{x:11,y:0},{x:11,y:1},{x:11,y:2}],maxAttempts:3},
    {id:'u3-drone-5',team:'player',dueOwnTurn:5,templateId:'u3-wave-drone',entries:[{x:0,y:5},{x:0,y:6},{x:0,y:7}],maxAttempts:3}
  ]});
  function validateConfig(config){
    keys(config,['version','waves'],'INVALID_WAVE_CONFIG');
    if(config.version!==CONFIG_VERSION||!Array.isArray(config.waves)||config.waves.length!==CONFIG.waves.length)reject('UNSUPPORTED_WAVE_CONFIG');
    const ids=new Set(),templates=new Set();
    config.waves.forEach((wave,index)=>{
      keys(wave,['id','team','dueOwnTurn','templateId','entries','maxAttempts'],'INVALID_WAVE_CONFIG');const approved=CONFIG.waves[index];
      if(!id(wave.id)||!id(wave.templateId)||ids.has(wave.id)||templates.has(wave.templateId)||wave.team!==approved.team||wave.dueOwnTurn!==approved.dueOwnTurn||wave.maxAttempts!==approved.maxAttempts||!same(wave.entries,approved.entries))reject('UNSUPPORTED_WAVE_CONFIG');
      ids.add(wave.id);templates.add(wave.templateId);
    });return true;
  }
  function requestShape(request,config){
    keys(request,['eventId','revision','team','ownTurn','entries'],'INVALID_WAVE_REQUEST');
    if(!id(request.eventId)||!id(request.revision)||!TEAMS.includes(request.team)||!Array.isArray(request.entries))reject('INVALID_WAVE_REQUEST');integer(request.ownTurn,1,Number.MAX_SAFE_INTEGER-1,'INVALID_WAVE_TURN');
    const seen=new Set();
    for(const entry of request.entries){
      keys(entry,['waveId','options'],'INVALID_WAVE_ENTRY_FACTS');const wave=config.waves.find(w=>w.id===entry.waveId);
      if(!wave||wave.team!==request.team||seen.has(entry.waveId)||!Array.isArray(entry.options)||entry.options.length!==wave.entries.length)reject('INVALID_WAVE_ENTRY_FACTS');seen.add(entry.waveId);
      entry.options.forEach((option,index)=>{
        keys(option,['x','y','passable','occupied'],'INVALID_WAVE_ENTRY_FACTS');
        if(!same({x:option.x,y:option.y},wave.entries[index])||typeof option.passable!=='boolean'||typeof option.occupied!=='boolean')reject('INVALID_WAVE_ENTRY_FACTS');
      });
    }
    return text(request);
  }
  function validate(state,config){
    validateConfig(config);keys(state,['version','configBinding','ownTurns','lastBeginKeys','waves'],'INVALID_WAVE_STATE');
    if(state.version!==VERSION||state.configBinding!==text(config))reject('WAVE_CONFIG_BINDING_MISMATCH');
    keys(state.ownTurns,TEAMS,'INVALID_WAVE_TURNS');keys(state.lastBeginKeys,TEAMS,'INVALID_WAVE_BEGIN_KEYS');
    for(const team of TEAMS){
      integer(state.ownTurns[team],0,Number.MAX_SAFE_INTEGER-1,'INVALID_WAVE_TURN');const key=state.lastBeginKeys[team];
      if(state.ownTurns[team]===0){if(key!==null)reject('INVALID_WAVE_BEGIN_KEYS');}
      else{
        let request;try{request=JSON.parse(key)}catch{reject('INVALID_WAVE_BEGIN_KEYS')}
        if(typeof key!=='string'||requestShape(request,config)!==key||request.team!==team||request.ownTurn!==state.ownTurns[team])reject('INVALID_WAVE_BEGIN_KEYS');
      }
    }
    if(!Array.isArray(state.waves)||state.waves.length!==config.waves.length)reject('INVALID_WAVE_ROWS');
    state.waves.forEach((row,index)=>{
      keys(row,['id','status','attempts','nextOwnTurn','spawnedUnitId'],'INVALID_WAVE_ROW');const wave=config.waves[index];
      if(row.id!==wave.id||!['pending','spawned','failed','discarded'].includes(row.status))reject('INVALID_WAVE_ROW');integer(row.attempts,0,wave.maxAttempts,'INVALID_WAVE_ATTEMPTS');integer(row.nextOwnTurn,wave.dueOwnTurn,wave.dueOwnTurn+wave.maxAttempts,'INVALID_WAVE_NEXT_TURN');
      if(row.status==='pending'||row.status==='discarded'){
        if(row.attempts>=wave.maxAttempts||row.nextOwnTurn!==wave.dueOwnTurn+row.attempts||row.spawnedUnitId!==null)reject('INVALID_WAVE_ROW');
        if(row.status==='pending'&&row.nextOwnTurn<=state.ownTurns[wave.team])reject('OVERDUE_PENDING_WAVE');
      }else{
        if(row.attempts<1||row.nextOwnTurn!==wave.dueOwnTurn+row.attempts-1||state.ownTurns[wave.team]<row.nextOwnTurn)reject('INVALID_WAVE_ROW');
        if(row.status==='failed'?(row.attempts!==wave.maxAttempts||row.spawnedUnitId!==null):row.spawnedUnitId!==wave.templateId)reject('INVALID_WAVE_ROW');
      }
    });return true;
  }
  function create(config){
    validateConfig(config);
    return freeze({version:VERSION,configBinding:text(config),ownTurns:{player:0,enemy:0},lastBeginKeys:{player:null,enemy:null},waves:config.waves.map(w=>({id:w.id,status:'pending',attempts:0,nextOwnTurn:w.dueOwnTurn,spawnedUnitId:null}))});
  }
  function beginTurn(state,request,config){
    validate(state,config);const key=requestShape(request,config),previous=state.ownTurns[request.team];
    if(request.ownTurn===previous&&state.lastBeginKeys[request.team]===key)return freeze({state:copy(state),effects:[],idempotent:true});
    if(request.ownTurn!==previous+1)reject('STALE_OR_SKIPPED_WAVE_TURN');
    const due=state.waves.filter((row,index)=>row.status==='pending'&&config.waves[index].team===request.team&&row.nextOwnTurn===request.ownTurn);
    if(!same(request.entries.map(e=>e.waveId),due.map(row=>row.id)))reject('INCOMPLETE_OR_EXTRA_WAVE_FACTS');
    const next=copy(state),effects=[];next.ownTurns[request.team]=request.ownTurn;next.lastBeginKeys[request.team]=key;
    for(const entry of request.entries){
      const index=config.waves.findIndex(w=>w.id===entry.waveId),wave=config.waves[index],row=next.waves[index],destination=entry.options.find(option=>option.passable&&!option.occupied);row.attempts++;
      if(destination){
        row.status='spawned';row.spawnedUnitId=wave.templateId;
        effects.push({type:'SpawnWave',waveId:wave.id,team:wave.team,templateId:wave.templateId,unitId:wave.templateId,entry:{x:destination.x,y:destination.y},ownTurn:request.ownTurn,attempt:row.attempts,eventId:request.eventId,revision:request.revision});
      }else if(row.attempts===wave.maxAttempts){
        row.status='failed';effects.push({type:'WaveFailed',waveId:wave.id,team:wave.team,attempt:row.attempts,eventId:request.eventId,revision:request.revision});
      }else{
        row.nextOwnTurn++;effects.push({type:'WaveDeferred',waveId:wave.id,team:wave.team,attempt:row.attempts,nextOwnTurn:row.nextOwnTurn,eventId:request.eventId,revision:request.revision});
      }
    }
    validate(next,config);return freeze({state:next,effects,idempotent:false});
  }
  function boundConfig(state){let config;try{config=JSON.parse(state?.configBinding)}catch{reject('INVALID_WAVE_CONFIG_BINDING')}validate(state,config);return config}
  function pendingEnemy(state){const config=boundConfig(state);return state.waves.filter((row,index)=>row.status==='pending'&&config.waves[index].team==='enemy').length}
  function discardPending(state){
    const config=boundConfig(state),next=copy(state),effects=[];
    next.waves.forEach((row,index)=>{if(row.status==='pending'){row.status='discarded';effects.push({type:'WaveDiscarded',waveId:row.id,team:config.waves[index].team})}});
    validate(next,config);return freeze({state:next,effects});
  }
  root.GoblinCatalogWaves=Object.freeze({CONFIG_VERSION,VERSION,CONFIG,create,validate,beginTurn,pendingEnemy,discardPending});
})(globalThis);
