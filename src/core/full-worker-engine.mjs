const files=[
  'unit-life.js','unit-visuals.js','terrain-rules.js','ogre-systems.js','legacy-supercover.js',
  'artillery-spotter-rules.js','assets/unit-art/rules/artillery-pilot.v1.js','siege-tank-fire-budget.js',
  'assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js',
  'catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','scenario-profile-manifest.js',
  'game.js','ogre-runtime.js','combat-feedback.js','siegebreaker-weapons.js','strategic-missile.js',
  'siege-pilot-runtime.js','artillery-pilot-runtime.js','catalog-base-runtime.js','catalog-specialists-runtime.js',
  'catalog-specialists-ui.js','scenario.js','command-history.js','catalog-full-model.js','catalog-waves.js',
  'catalog-visibility.js','catalog-full-runtime.js','training-director.js','training-model.js','training-runtime.js',
  'level-events.js','editor-draft.js'
];
let preparedSources;
async function fetchSource(path) {
  const response=await fetch(new URL('../../'+path,import.meta.url));
  if(!response.ok) throw Error('FULL_WORKER_SOURCE_UNAVAILABLE: '+path);
  return response.text();
}
async function sources(readSource) {
  const index=await readSource('index.html');
  const order=[...index.matchAll(/<script[^>]+src="([^"?]+)(?:[^"]*)"/g)]
    .map(match=>match[1]).filter(path=>files.includes(path));
  // Runtime additions absent from the HTML still follow the native harness
  // dependency order, after the classic entrypoint scripts.
  for(const path of files) if(!order.includes(path)) order.push(path);
  return (await Promise.all(order.map(readSource))).join('\n;\n');
}
function documentStub() {
  const nodes=new Map();
  function element() {
    const classes=new Set(),attributes=new Map();
    return {innerHTML:'',textContent:'',checked:false,disabled:false,style:{},dataset:{},children:[],
      classList:{add(...values){values.forEach(value=>classes.add(value));},
        remove(...values){values.forEach(value=>classes.delete(value));},contains:value=>classes.has(value),
        toggle(value,on){if(on??!classes.has(value))classes.add(value);else classes.delete(value);}},
      setAttribute(name,value){attributes.set(name,String(value));},getAttribute:name=>attributes.get(name)??null,
      removeAttribute(name){attributes.delete(name);},addEventListener(){},removeEventListener(){},
      appendChild(child){this.children.push(child);return child;},append(...children){this.children.push(...children);},
      before(){},remove(){},querySelector(){return null;},querySelectorAll(){return [];},
      animate(){return {finished:Promise.resolve(),cancel(){}};},
      insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}};
  }
  const buttons=['movement','fire','los'].map(view=>Object.assign(element(),{dataset:{view}}));
  return {querySelector(selector){if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);},
    querySelectorAll:selector=>selector==='.view-option:not(#grid-toggle)'?buttons:[],
    createElement:element,createElementNS:element,addEventListener(){},removeEventListener(){}};
}

export async function createHeadlessFullEngine({readSource}={}) {
  const text=readSource?await sources(readSource):await (preparedSources??=sources(fetchSource));
  const timers=new Map();
  let serial=0;
  const root=Object.create(null);
  Object.assign(root,{globalThis:root,window:root,document:documentStub(),Math:Object.create(Math),
    structuredClone:(...args)=>globalThis.structuredClone(...args),
    console,URLSearchParams,URL,TextEncoder,TextDecoder,crypto:globalThis.crypto,
    performance:globalThis.performance,localStorage:{getItem(){return null;},setItem(){},removeItem(){}},
    GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true,warn:async()=>true},
    setTimeout(fn){timers.set(++serial,fn);return serial;},clearTimeout(id){timers.delete(id);},
    scheduleGameTask(fn){timers.set(++serial,fn);return serial;},
    requestAnimationFrame(){return ++serial;},cancelAnimationFrame(){},
    addEventListener(){},removeEventListener(){},dispatchEvent(){return true;}});
  // All bundled scripts share a fresh lexical environment and an isolated
  // global root. No native UI object or live permission enters this context.
  const compile=new Function('root',`with(root){${text}
    draw=()=>{};
    updateSelection=()=>{};
    let workerModalRoll=null;
    let workerReferences=false;
    let workerReload=null;
    let workerRollContext=null;
    let workerKnowledgeIds=null;
    let workerUnmodeledEnemy=0,workerUnmodeledPlayer=0;
    const workerNativeVictoryOutcome=victoryOutcome;
    victoryOutcome=function(profile,roster) {
      const outcome=workerNativeVictoryOutcome(profile,roster);
      if(workerKnowledgeIds===null)return outcome;
      if(outcome==='draw'){
        if(workerUnmodeledEnemy>0&&workerUnmodeledPlayer===0)return false;
        if(workerUnmodeledPlayer>0&&workerUnmodeledEnemy===0)return true;
        if(workerUnmodeledEnemy!==0||workerUnmodeledPlayer!==0)return null;
      }
      if(outcome===true&&workerUnmodeledEnemy!==0)return null;
      if(outcome===false&&workerUnmodeledPlayer!==0&&
        !roster.some(unit=>unit.team==='player'&&unitAlive(unit)))return null;
      return outcome;
    };
    const workerNativeWaves=GoblinCatalogWaves;
    root.GoblinCatalogWaves=Object.freeze({...workerNativeWaves,
      beginTurn(state,request,config) {
        const result=workerNativeWaves.beginTurn(state,request,config);
        if(workerKnowledgeIds===null)return result;
        const effects=result.effects.filter(effect=>{
          const template=config.waves.find(wave=>wave.id===effect.waveId)?.templateId;
          return workerKnowledgeIds.has(template);
        });
        return Object.freeze({...result,effects:Object.freeze(effects)});
      },
      pendingEnemy(state) {
        if(workerKnowledgeIds===null)return workerNativeWaves.pendingEnemy(state);
        const config=JSON.parse(state.configBinding);
        workerNativeWaves.validate(state,config);
        return state.waves.filter((row,index)=>row.status==='pending'&&
          config.waves[index].team==='enemy'&&workerKnowledgeIds.has(config.waves[index].templateId)).length;
      }
    });
    const workerNativeCombatRandom=combatRandom;
    const workerNativeCombatOutcome=combatOutcome;
    combatOutcome=function(attacker,target) {
      const previous=workerRollContext;
      workerRollContext={attacker,target,metadata:GoblinSpecialistsRuntime.fireMetadata()};
      try{return workerNativeCombatOutcome(attacker,target);}
      finally{workerRollContext=previous;}
    };
    combatRandom=()=>{
      if(workerModalRoll===null)return workerNativeCombatRandom();
      const face=typeof workerModalRoll==='function'?workerModalRoll(workerRollContext):
        Array.isArray(workerModalRoll)?workerModalRoll.shift():workerModalRoll;
      if(!Number.isInteger(face)||face<0||face>5)throw Error('FULL_MODEL_ROLL_QUEUE_EXHAUSTED');
      return (face+0.5)/6;
    };
    return {
      root,
      async initialize(data,levels) {
        await GoblinCatalogFullModel.initialize(data,levels,{profile:'FULL_CATALOG_v1'});
        Object.assign(scenarioCatalog,GoblinCatalogFullModel.configs);
      },
      load(id,controls) {
        workerKnowledgeIds=null;
        const port=loadScenario(id,controls);
        return {port,session:legacySession};
      },
      async loadConfig(config,seed,scenarioId,draft) {
        if(!workerReferences) {
          for(const side of ['player','enemy'])
            GoblinCatalogFullRuntime.registerQualifiedController({side,id:'worker-reference-'+side,
              difficulty:'strong',select(){throw Error('FULL_WORKER_REFERENCE_IS_EXPLICIT');}});
          workerReferences=true;
        }
        const controls={roles:{player:'ai',enemy:'ai'},
          policyIds:{player:'worker-reference-player',enemy:'worker-reference-enemy'},seed};
        if(draft) {
          const prepared=await GoblinEditorDraft.prepare(structuredClone(draft));
          workerReload=()=>{
            workerKnowledgeIds=null;
            const port=loadEditorDraft(prepared,controls);
            return {port,session:legacySession};
          };
          return workerReload();
        }
        const id=scenarioId??Object.keys(scenarioCatalog).find(key=>
          scenarioCatalog[key].catalog?.levelDigest===config.catalog?.levelDigest);
        if(typeof id!=='string')throw Error('FULL_WORKER_CONFIG_INVALID');
        scenarioCatalog[id]=structuredClone(config);
        workerReload=()=>{
          workerKnowledgeIds=null;
          const port=loadScenario(id,controls);
          return {port,session:legacySession};
        };
        return workerReload();
      },
      reload(){if(!workerReload)throw Error('FULL_WORKER_NOT_LOADED');return workerReload();},
      applyRootKnowledge(view) {
        if(!view||!['player','enemy'].includes(view.side)||!Array.isArray(view.units))
          throw Error('FULL_MODEL_KNOWLEDGE_INVALID');
        const ids=new Set(view.units.map(unit=>unit.id));
        if(ids.size!==view.units.length||view.units.some(unit=>!units.some(actual=>actual.id===unit.id)))
          throw Error('FULL_MODEL_KNOWLEDGE_INVALID');
        // Own actors are always disclosed. Dropping one would create a model
        // with an incomplete native owner and cargo authority.
        if(units.some(unit=>unit.team===view.side&&!ids.has(unit.id)))
          throw Error('FULL_MODEL_OWN_UNIT_MISSING');
        const unknownTargets=(kinds,known)=>{
          const goals=kinds.map(kind=>view.objectives?.find(goal=>goal.kind===kind));
          if(goals.some(goal=>!Number.isSafeInteger(goal?.remaining)||goal.remaining<0))return null;
          return Math.max(0,goals.reduce((sum,goal)=>sum+goal.remaining,0)-known);
        };
        const knownEnemy=view.units.filter(unit=>unit.alive&&
          unit.relation===(view.side==='enemy'?'own':'opponent')).length;
        const knownPlayer=view.units.filter(unit=>unit.alive&&
          unit.relation===(view.side==='player'?'own':'opponent')).length;
        const symmetric=view.objectives?.some(goal=>goal.kind==='destroy-opponent-force');
        workerUnmodeledEnemy=symmetric?(view.side==='enemy'?0:unknownTargets(['destroy-opponent-force'],knownEnemy)):
          unknownTargets(view.side==='player'?['destroy-core','destroy-escort']:['protect-core','protect-escort'],knownEnemy);
        workerUnmodeledPlayer=view.side==='player'?0:
          unknownTargets([symmetric?'destroy-opponent-force':'destroy-player-force'],knownPlayer);
        workerKnowledgeIds=ids;
        units.splice(0,units.length,...units.filter(unit=>ids.has(unit.id)));
        const full=GoblinCatalogFullRuntime,s=full.ensure();
        const clocks=structuredClone(s.visibility.teamFire);
        const facts=full.facts(clocks);
        const bindings=facts.actors.filter(actor=>actor.assetId&&
          legacySession.effectiveRules.catalog.registry.units[actor.assetId].target.stealthRef)
          .map(actor=>({runtimeUnitId:actor.runtimeUnitId,assetId:actor.assetId,team:actor.team,
            stealthRef:'phantom-stealth-v1'})).sort((a,b)=>a.runtimeUnitId<b.runtimeUnitId?-1:1);
        const visibility=GoblinCatalogVisibility.create(legacySession.effectiveRules.catalog.registry,bindings,facts);
        // The model knows the positions disclosed at its root. Actual private
        // reveal-expiry timers are not part of that knowledge.
        const reveals=bindings.filter(binding=>binding.team!==view.side).map(binding=>({
          runtimeUnitId:binding.runtimeUnitId,viewerTeam:view.side,untilFireEnd:Number.MAX_SAFE_INTEGER}));
        s.visibility={...visibility,reveals};
        full.refresh();
        return {knownIds:units.map(unit=>unit.id),
          unmodeledTargets:{enemy:workerUnmodeledEnemy,player:workerUnmodeledPlayer}};
      },
      setModalRoll(face) {
        const faces=Array.isArray(face)?face:[face];
        if(face!==null&&typeof face!=='function'&&(!faces.length||faces.some(value=>!Number.isInteger(value)||value<0||value>5)))
          throw Error('FULL_MODEL_ROLL_INVALID');
        workerModalRoll=Array.isArray(face)?[...face]:face;
      },
      state(){return {turn,phase,turnPhase,ended:gameOver,winner:gameOver?
        (GoblinCatalogFullRuntime.terminalOutcome()==='draw'?'draw':
          GoblinCatalogFullRuntime.terminalOutcome()===true?'player':'enemy'):null};}
    };
  }`);
  // The scripts refer to their timer registry only through the stub closures.
  const engine=compile(root);
  return Object.freeze({...engine,dispose(){timers.clear();}});
}
