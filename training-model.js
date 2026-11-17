// Profile-bound Field Test starts and separate learning contracts.
(function(root){
 const profile='TRAINING_FIELD_TEST_v1',ids=Object.freeze(['training-t01','training-t02','training-t03']);
 const stable=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]))):v;
 const copy=v=>JSON.parse(JSON.stringify(v)),freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v)}return v};
 async function hash(v){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(stable(v))));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
 const unitProfiles={
  "assault-tank":{"visualKey":"assault-tank","name":"ASSAULT TANK","type":"FRONTLINE ARMOR","hp":3,"maxHp":3,"defense":3,"range":2,"move":3,"damage":4,"icon":"H","movementMode":"tracked"},
  "infantry-platoon":{"visualKey":"infantry-platoon","name":"INFANTRY PLATOON","type":"MOBILE INFANTRY","hp":2,"maxHp":2,"defense":2,"range":1,"move":2,"damage":1,"icon":"I","infantry":true,"movementMode":"infantry"},
  "guard-tank":{"visualKey":"guard-tank","name":"GUARD TANK","type":"HOSTILE ARMOR","hp":3,"maxHp":3,"defense":3,"range":2,"move":1,"damage":1,"icon":"G","movementMode":"tracked"}
 };
 const learningProfiles={
  "training-t01":{"seed":37093377,"next":"training-t02","titleKey":"training.t01.title","goalKey":"training.t01.goal"},
  "training-t02":{"seed":37093378,"next":"training-t03","titleKey":"training.t02.title","goalKey":"training.t02.goal"},
  "training-t03":{"seed":37093379,"next":"iron-dust","titleKey":"training.t03.title","goalKey":"training.t03.goal"}
 };
 let configs=null,levels=null,definitions=null;
 let advisory=null,advisorySource=null;
 const parameterRefs=['query','actor:tank','actor:infantry','actor:hostile','region:goal','region:practice','region:openFire','control:back','control:cancel','phase:fire','phase:movement','query:attack','query:defense','query:range','query:cost','query:available','shot:result','shot:effect','recoveryReason','skills','objective','budget:scout','actor:scout'];
 const controls=['back','cancel','confirm','phase','exit'];
 function historicalShape(data){
  if(data?.version!=='goblin-level-package-v3')return data;
  const fail=()=>{throw Error('TRAINING_SOURCE_VERSION')};
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
   Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  if(!exact(data,['version','levels'])||!Array.isArray(data.levels))fail();
  return {version:'training-levels-v1',
   authority:{contractSha256:'88a2a9dde0ea9c9b4db347e09bd42d59fe2410abd8fcec0e07e1a0fcbec9b13b',
    contentPin:'2fdce6ac1be30e8b2a360250b37724586469e71c',status:'authored candidate; actual query/route checks required before delivery'},
   levels:data.levels.map(level=>{
    const fields=['version','id','scenarioVersion','width','height','ruleProfile','objective','terrain','regions','units'];
    if(level&&Object.hasOwn(level,'aiAllowed')){
     if(level.aiAllowed!==false)fail();
     fields.push('aiAllowed');
    }
    if(!exact(level,fields)||
     level.version!=='goblin-level-v3'||!Object.hasOwn(learningProfiles,level.id)||level.scenarioVersion!==1||
     level.width!==12||level.height!==8||level.ruleProfile!==profile||level.objective!=='learning'||!Array.isArray(level.units))fail();
    const units=level.units.map(entry=>{
     if(!exact(entry,['id','assetId','team','x','y'])||!Object.hasOwn(unitProfiles,entry.assetId))fail();
     const {visualKey,name,type,...rules}=unitProfiles[entry.assetId];
     return {id:entry.id,visualKey,name,type,team:entry.team,x:entry.x,y:entry.y,...rules};
    });
    return {id:level.id,...learningProfiles[level.id],units,terrain:level.terrain,regions:level.regions};
   })};
 }
 function manifestFor(definition){return {binding:copy(definition.binding),definition:copy(definition),actorTags:copy(definition.actorTags),regionRefs:[...definition.regionRefs],copyKeys:[...new Set([...definition.steps.flatMap(s=>[s.messageKey,s.recovery?.messageKey]).filter(Boolean),...(definition.terminal?Object.entries(definition.terminal).filter(([k])=>k!=='requiredStepIds').map(([,v])=>v):[])])],parameterRefs:[...parameterRefs],controlRefs:[...controls],capabilityRefs:[]}}
 async function initialize(levelData,scriptData){
  levelData=copy(historicalShape(levelData));scriptData=copy(scriptData);
  if(await hash(levelData)!=='f68869da180df36a2d485940ca8155953d8c36f581d993a20514acf855d01d73'||await hash(scriptData)!=='5407c9e7d97a9583a002ef3aae54f528a27e21bb315a310016ff29703477e37b')throw Error('TRAINING_SOURCE_DIGEST');
  if(levelData.version!=='training-levels-v1'||scriptData.version!=='training-scripts-v1'||levelData.levels.length!==3||scriptData.definitions.length!==3)throw Error('TRAINING_SOURCE_VERSION');
  const next={};
  for(const level of levelData.levels){const definition=scriptData.definitions.find(d=>d.binding.scenarioId===level.id);if(!ids.includes(level.id)||!definition||await hash({...definition,binding:{...definition.binding,scriptDigest:null}})!==definition.binding.scriptDigest)throw Error('TRAINING_SCRIPT_BINDING');
   const manifest=manifestFor(definition);GoblinTrainingDirector.validateDefinition(definition,manifest);
   const occupied=new Set();for(const u of level.units){const cell=u.x+','+u.y,type=level.terrain.find(c=>c.x===u.x&&c.y===u.y)?.type??'open-ground';if(occupied.has(cell)||u.x<0||u.x>=12||u.y<0||u.y>=8||!Number.isFinite(TerrainRules.movementCost(type,u)))throw Error('TRAINING_START');occupied.add(cell)}
   for(const [tag,id]of Object.entries(definition.actorTags))if(!level.units.some(u=>u.id===id))throw Error('TRAINING_ACTOR_BINDING');
   for(const ref of definition.regionRefs)if(!level.regions[ref]?.length||level.regions[ref].some(c=>!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.x>=12||c.y<0||c.y>=8))throw Error('TRAINING_REGION_BINDING');
   next[level.id]=freeze({title:level.id,kicker:'TRAINING',kickerKey:'training.label',titleKey:level.titleKey,goalKey:level.goalKey,sub:'Learning goal',scenarioVersion:1,ruleProfileId:profile,ruleProfile:'training-field-test-data-v1',objectiveVersion:1,objective:'learning',losMode:'legacy-pixel-los-v1',units:copy(level.units),terrain:level.terrain.filter(c=>TerrainRules.coverBonus(c.type)).map(c=>c.x+','+c.y),terrainTypes:copy(level.terrain),training:{version:'training-runtime-v1',seed:level.seed,next:level.next,regions:copy(level.regions),definition:copy(definition),manifest}});
  }
  configs=freeze(next);levels=freeze(copy(levelData));definitions=freeze(copy(scriptData));return configs;
 }
 const has=id=>!!configs&&Object.hasOwn(configs,id);
 function validate(id,config){if(!has(id)||JSON.stringify(stable(config))!==JSON.stringify(stable(configs[id])))throw Error('TRAINING_PROFILE_MISMATCH');return true}
 async function initializeAdvisory(config){
  ScenarioRuleProfiles.validate('iron-dust',config);
  if(config.scenarioVersion!==2||config.ruleProfileId!=='FIELD_TEST_LEGACY_v2'||config.targetPolicyVersion!=='skip-depleted-treads-v1')throw Error('ADVISORY_PROFILE');
  const source=JSON.stringify(stable(config)),binding={directorSchemaVersion:1,scenarioId:'iron-dust',scenarioVersion:2,ruleProfileId:config.ruleProfileId,unitDataProfile:'legacy-inline:'+await hash(config.units),mechanicsVersion:'legacy-inline:'+await hash({crt:COMBAT_RULES.crt,targetPolicyVersion:config.targetPolicyVersion,losMode:'legacy-pixel-los-v1'}),objective:config.objective,objectiveVersion:config.objectiveVersion,losMode:'legacy-pixel-los-v1',scriptId:'iron-dust-advisory',scriptVersion:1,scriptDigest:'pending'};
  const step=(id,key,when,next,params={})=>({id,category:'instruction',messageKey:key,paramRefs:params,highlightRefs:[],completeWhen:when,next,alternatives:[],recovery:null,holdAutoPhase:false});
  const definition={binding,mode:'advisory',startStepId:'intro',actorTags:Object.fromEntries(config.units.map(u=>[u.id==='gev'?'scout':u.id,u.id])),regionRefs:[],onRestore:null,terminal:null,steps:[
   step('intro','training.normalIntro',{op:'uiFact',type:'acknowledgeInstruction'},'wait',{objective:'objective'}),
   {...step('wait',null,{op:'any',conditions:[{op:'all',conditions:[{op:'acceptedAction',type:'Move',actorTag:'scout'},{op:'actorState',actorTag:'scout',field:'moveSpent',value:true}]},{op:'phaseEntered',team:'player',phase:'fire'}]},'hint'),category:'branch'},
   step('hint','training.normalHint',{op:'uiFact',type:'acknowledgeInstruction'},'exit',{unit:'actor:scout',remaining:'budget:scout',phase:'phase:movement'}),
   {...step('exit',null,null,null),category:'exit'}]};
  definition.binding.scriptDigest=await hash({...definition,binding:{...binding,scriptDigest:null}});const manifest=manifestFor(definition);GoblinTrainingDirector.validateDefinition(definition,manifest);
  advisory=freeze({definition,manifest,regions:{}});advisorySource=source;return advisory;
 }
 function advisoryFor(config){return advisory&&JSON.stringify(stable(config))===advisorySource?advisory:null}
 function copyKey(key){const match=/^mission\.(training-t0[123])\.(.+)$/.exec(key);if(!match||!has(match[1]))return null;const config=configs[match[1]],field=match[2];return field==='title'?config.titleKey:['objective.short','objective.full','briefing.short'].includes(field)?config.goalKey:field==='briefing.full'?'training.intro':field==='briefing.victory'?'training.readyForDebrief':field==='briefing.defeat'?'v2.training.defeatRule':field==='end.victory'?'training.complete.title':null}
 root.GoblinTrainingModel=Object.freeze({profile,ids,hash,initialize,initializeAdvisory,advisoryFor,has,validate,manifestFor,copyKey,get configs(){return configs}});
})(globalThis);
