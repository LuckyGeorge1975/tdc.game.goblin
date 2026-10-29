import fs from 'node:fs';
import vm from 'node:vm';
const level=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/levels/artillery-pilot.v1.json',import.meta.url),'utf8'));
const registry=JSON.parse(fs.readFileSync(new URL('../assets/unit-art/rules/unit-profiles.v1.json',import.meta.url),'utf8'));
export function artilleryScene(enabled=true, initialSeed=7,entrypointOrder=false,additionalFiles=[]){
  const nodes=new Map(),timers=new Map();let id=0,rolls=0,animations=0,rngState=initialSeed>>>0;
  function element(){const classes=new Set();return {innerHTML:'',textContent:'',checked:false,
    disabled:false,style:{},dataset:{},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),
      contains:n=>classes.has(n),toggle(n,v){if(v??!classes.has(n))classes.add(n);else classes.delete(n);}},
    setAttribute(){},addEventListener(){},appendChild(){},before(){},querySelector(){return null;},
    animate(){animations++;},
    insertAdjacentHTML(_,html){this.innerHTML=html+this.innerHTML;}};}
  const buttons=['movement','fire','los'].map(view=>Object.assign(element(),{dataset:{view}}));
  const document={querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);},
    querySelectorAll:s=>s==='.view-option:not(#grid-toggle)'?buttons:[],createElement:element,
    createElementNS:element,addEventListener(){}};
  const math=Object.create(Math);math.random=()=>{rolls++;if(context.rollQueue?.length)return context.rollQueue.shift();rngState^=rngState<<13;rngState^=rngState>>>17;rngState^=rngState<<5;rngState>>>=0;return rngState/4294967296;};
  const context=vm.createContext({document,Math:math,structuredClone,console,URLSearchParams,window:{},
    localStorage:{getItem(){return null;}},GameDialogs:{isOpen:()=>false,cancel(){},confirm:async()=>true},
    setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);},
    scheduleGameTask(fn){timers.set(++id,fn);return id;}});
  const run=s=>vm.runInContext(s,context);
  const files=['unit-life.js','unit-visuals.js','terrain-rules.js','ogre-systems.js','legacy-supercover.js','artillery-spotter-rules.js','assets/unit-art/rules/artillery-pilot.v1.js','siege-tank-fire-budget.js','assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js','catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','scenario-profile-manifest.js',
    ...(enabled?['presentation-preferences.js','presentation-state.js']:[]),'game.js','ogre-runtime.js','combat-feedback.js',
    'siegebreaker-weapons.js','strategic-missile.js','siege-pilot-runtime.js','artillery-pilot-runtime.js','catalog-base-runtime.js','catalog-specialists-runtime.js','catalog-specialists-ui.js','scenario.js',
    ...(enabled?['legacy-presentation.js']:[]),'command-history.js',...additionalFiles];
  const ordered=entrypointOrder?[...fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').matchAll(/<script[^>]+src="([^"?]+)(?:[^"]*)"/g)].map(m=>m[1]).filter(file=>files.includes(file)):files;
  if(entrypointOrder&&new Set(ordered).size!==files.length)throw Error('ENTRYPOINT_DEPENDENCY_MISSING');
  for(const file of ordered)run(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
  run("draw=()=>globalThis.GoblinLegacyPresentation?.sync();updateSelection=()=>{};loadScenario('iron-dust');");
  run(`scenarioCatalog['artillery-pilot']=GoblinArtilleryPilot.create(${JSON.stringify(level)},${JSON.stringify(registry)});loadScenario('artillery-pilot');`);
  return {run,context,timers,rng:()=>({seed:initialSeed,state:rngState,draws:rolls}),rolls:()=>rolls,animations:()=>animations,
    events:()=>JSON.parse(run('JSON.stringify(GoblinPresentation.events())')),
    state:()=>run('JSON.stringify({units,terrain:[...terrain],terrainTypes:[...terrainTypes],legacySession,turn,phase,turnPhase,gameOver,phaseRolls,phaseRollCursor})')};
}

export function queryBridge(g){
 const ui=fs.readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
 const start=ui.indexOf('    function query(command)'),end=ui.indexOf('    function undo()',start);
 const actualRevision=ui.slice(ui.indexOf('    function revision()'),ui.indexOf('    function legacyLogEntries()'));
 g.run(`const core=()=>false,t=key=>key,view={busy:false};let startZoomPending=null;const render=()=>{};${actualRevision}${ui.slice(start,end)}`);
}
export function enemy(g){
 g.run("if(turnPhase==='movement')setTurnPhase('fire');if(turnPhase==='fire')setTurnPhase('gev');startEnemyTurn()");
 const task=[...g.timers.values()].find(fn=>String(fn).includes('const foes='));if(!task)throw new Error('Missing actual enemy callback');task();
}
export function command(g,actorId,targetId,mode='direct',spotterId=null){return JSON.parse(g.run(`JSON.stringify((()=>{const u=units.find(u=>u.id==='${targetId}');return {type:'FireArtillery',actorId:'${actorId}',x:u.x,y:u.y,mode:'${mode}',spotterId:${JSON.stringify(spotterId)}}})())`));}
export function execute(g,cmd){return g.run(`dispatch(${JSON.stringify(cmd)},revision())`)}
export function read(g,expression){return JSON.parse(g.run(`JSON.stringify(${expression})`))}
