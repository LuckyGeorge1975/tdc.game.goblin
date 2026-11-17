const NS='http://www.w3.org/2000/svg';
let W=12,H=8;
const S=34,DX=Math.sqrt(3)*S, DY=1.5*S;
function boardViewBox(width=W,height=H) {
  return `0 0 ${Math.ceil(790+(width-12)*DX)} ${480+(height-8)*DY}`;
}
let terrain=new Set();
let terrainTypes = new Map();
function unitAlive(unit){return globalThis.GoblinUnitLife?GoblinUnitLife.alive(unit):unit?.hp>0}
function unitDead(unit){return globalThis.GoblinUnitLife?GoblinUnitLife.dead(unit):!!unit&&Number.isFinite(unit.hp)&&unit.hp<=0}
function terrainTypeAt(x,y){const key=`${x},${y}`;return terrainTypes.get(key)||(terrain.has(key)?'rubble-field':'open-ground')}
function drawTerrainArtwork(x,y){
  const type=terrainTypeAt(x,y);
  if(type==='field-position'&&typeof TerrainDisplay!=='undefined'){const c=hexCenter(x,y),marker=TerrainDisplay.svgIcon(type,c.x-14,c.y-14,28);marker.classList.add('terrain-artwork');svg.appendChild(marker);return true}
  if(type==='open-ground'&&currentScenario!=='atlas-proving-grounds'&&
    !(currentScenario==='editor-draft'&&ScenarioRuleProfiles.isDraftSession(legacySession))&&
    !(['training-t01','training-t02','training-t03'].includes(currentScenario)&&legacySession?.scenarioId===currentScenario&&
      legacySession.ruleProfileId==='TRAINING_FIELD_TEST_v1'&&globalThis.GoblinTrainingModel?.has(currentScenario))&&
    !(['catalog-full-atlas','catalog-full-terrain-course','catalog-full-advance','catalog-full-siege','catalog-full-specialists'].includes(currentScenario)&&
      legacySession?.scenarioId===currentScenario&&legacySession.ruleProfileId==='FULL_CATALOG_v1'&&
      globalThis.GoblinCatalogFullModel?.profile===legacySession.ruleProfileId&&GoblinCatalogFullModel.has(currentScenario,legacySession.ruleProfileId)))return false;
  const asset=UnitVisuals.terrainAssetFor(type);
  if(!asset)return false;
  const c=hexCenter(x,y),image=document.createElementNS(NS,'image');
  image.setAttribute('href',asset);image.setAttribute('x',c.x-36);image.setAttribute('y',c.y-36);
  image.setAttribute('width',72);image.setAttribute('height',72);
  image.classList.add('terrain-artwork');image.setAttribute('pointer-events','none');
  svg.appendChild(image);return true;
}
const COMBAT_RULES=Object.freeze({crt:Object.freeze({'1-2':['NE','NE','NE','NE','D','X'],'1-1':['NE','NE','D','D','D','X'],'2-1':['NE','D','D','X','X','X'],'3-1':['D','D','X','X','X','X'],'4-1':['D','X','X','X','X','X']})});
const builtInLevels=[
  {"version":"goblin-level-v3","id":"iron-dust","scenarioVersion":2,"width":12,"height":8,"ruleProfile":"FIELD_TEST_LEGACY_v2","objective":"core",
    terrain:[{"x":3,"y":1,"type":"rubble-field"},{"x":8,"y":1,"type":"rubble-field"},{"x":1,"y":4,"type":"rubble-field"},{"x":5,"y":3,"type":"rubble-field"},{"x":9,"y":5,"type":"rubble-field"},{"x":2,"y":6,"type":"rubble-field"},{"x":7,"y":6,"type":"rubble-field"},{"x":10,"y":2,"type":"rubble-field"}],
    units:[
      {"id":"ogre","assetId":"goblin-siegebreaker","team":"player","x":1,"y":5},
      {"id":"gev","assetId":"skimmer-scout","team":"player","x":2,"y":6},
      {"id":"missile","assetId":"rocket-artillery","team":"player","x":3,"y":6},
      {"id":"infantry","assetId":"infantry-platoon","team":"player","x":1,"y":6},
      {"id":"core","assetId":"command-core","team":"enemy","x":10,"y":2},
      {"id":"guard","assetId":"guard-tank","team":"enemy","x":8,"y":3},
      {"id":"raider","assetId":"raider-skimmer","team":"enemy","x":9,"y":5}
    ]},
  {"version":"goblin-level-v3","id":"relay-run","scenarioVersion":1,"width":12,"height":8,"ruleProfile":"FIELD_TEST_LEGACY_v1","objective":"core-and-escort",
    terrain:[{"x":4,"y":2,"type":"rubble-field"},{"x":5,"y":2,"type":"rubble-field"},{"x":4,"y":5,"type":"rubble-field"},{"x":7,"y":4,"type":"rubble-field"},{"x":8,"y":6,"type":"rubble-field"},{"x":2,"y":3,"type":"rubble-field"}],
    units:[
      {"id":"ogre","assetId":"goblin-siegebreaker","team":"player","x":1,"y":6},
      {"id":"gev","assetId":"skimmer-scout","team":"player","x":2,"y":6},
      {"id":"missile","assetId":"rocket-artillery","team":"player","x":3,"y":7},
      {"id":"infantry","assetId":"infantry-platoon","team":"player","x":1,"y":7},
      {"id":"core","assetId":"relay-node","team":"enemy","x":10,"y":1},
      {"id":"guard","assetId":"guard-tank","team":"enemy","x":8,"y":2},
      {"id":"raider","assetId":"raider-skimmer","team":"enemy","x":9,"y":4}
    ]},
  {"version":"goblin-level-v3","id":"unit-trial","scenarioVersion":1,"width":12,"height":8,"ruleProfile":"FIELD_TEST_LEGACY_v1","objective":"core-and-escort",
    terrain:[{"x":3,"y":1,"type":"rubble-field"},{"x":5,"y":2,"type":"rubble-field"},{"x":2,"y":4,"type":"rubble-field"},{"x":7,"y":4,"type":"rubble-field"},{"x":9,"y":5,"type":"rubble-field"},{"x":4,"y":6,"type":"rubble-field"}],
    units:[
      {"id":"heavy-tank","assetId":"assault-tank","team":"player","x":1,"y":6},
      {"id":"light-tank","assetId":"recon-tank","team":"player","x":2,"y":6},
      {"id":"gev-pc","assetId":"skimmer-carrier","team":"player","x":3,"y":6},
      {"id":"infantry","assetId":"field-engineers","team":"player","x":3,"y":7},
      {"id":"core","assetId":"command-hub","team":"enemy","x":10,"y":1},
      {"id":"guard","assetId":"siege-tank","team":"enemy","x":8,"y":2},
      {"id":"raider","assetId":"light-skimmer","team":"enemy","x":9,"y":5},
      {"id":"missile-crawler","assetId":"strategic-missile-carrier","team":"player","x":0,"y":7}
    ]}
];
const scenarioCatalog={},units=[];
let bootProfileError=null,legacySession=null;
try{
  Object.assign(scenarioCatalog,Object.fromEntries(builtInLevels.map(level=>[level.id,ScenarioRuleProfiles.legacyLevel(level)])));
  for(const id of ['iron-dust','relay-run','unit-trial'])ScenarioRuleProfiles.validate(id,scenarioCatalog[id]);
  legacySession=ScenarioRuleProfiles.beginSession('iron-dust',scenarioCatalog['iron-dust']);
  units.push(...scenarioCatalog['iron-dust'].units.map(unit=>({...unit})));
  terrain=new Set(scenarioCatalog['iron-dust'].terrain);
}catch(error){
  bootProfileError=error;
  globalThis.goblinBootProfileError=error;
  document.body.classList.add('boot-profile-rejected');
  document.querySelector('#mission-sub').textContent=error.message;
  document.querySelector('#scenario-select').disabled=true;
  document.querySelector('#end-turn').disabled=true;
  document.querySelector('#reset-game').disabled=true;
}
function victoryProfile(config){
  if(config?.objective==='learning'&&config.training?.definition?.binding.ruleProfileId==='TRAINING_FIELD_TEST_v1'&&globalThis.GoblinTrainingModel?.has(config.training.definition.binding.scenarioId))return {version:1,objectiveCode:'learning',requiresCore:false,requiresAllEnemies:false,requiresPlayerSurvival:true};
  if(config?.objectiveVersion!==1)throw new Error('Unsupported objective contract version');
  if(config.objective!=='core'&&config.objective!=='core-and-escort')throw new Error('Unsupported objective');
  return {version:1,objectiveCode:config.objective,requiresCore:true,requiresAllEnemies:config.objective==='core-and-escort',requiresPlayerSurvival:true};
}
function objectiveSnapshot(profile,roster){
  if(profile.objectiveCode==='learning'){const status=globalThis.GoblinTrainingRuntime?.status()??'running';return {goalMode:'learning',coreHp:0,coreMax:0,enemyAlive:roster.filter(u=>u.team==='enemy'&&unitAlive(u)).length,enemyTotal:roster.filter(u=>u.team==='enemy').length,playerAlive:roster.some(u=>u.team==='player'&&unitAlive(u)),outcome:null,remaining:['ready-for-debrief','lesson-complete'].includes(status)?0:1,total:1,progress:['ready-for-debrief','lesson-complete'].includes(status)?100:0}}
  const core=roster.find(unit=>unit.team==='enemy'&&unit.core),enemies=roster.filter(unit=>unit.team==='enemy');
  const pending=globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.pendingEnemy():0;
  const remainingEnemies=enemies.filter(unit=>unitAlive(unit)).length+pending;
  const playerAlive=roster.some(unit=>unit.team==='player'&&unitAlive(unit));
  const objectiveIncomplete=(profile.requiresCore&&unitAlive(core))||(profile.requiresAllEnemies&&remainingEnemies>0);
  const terminal=globalThis.GoblinCatalogFullRuntime?.terminalOutcome()??null;
  const outcome=terminal!==null?terminal:profile.requiresPlayerSurvival&&!playerAlive?false:objectiveIncomplete?null:true;
  const remaining=profile.requiresAllEnemies?remainingEnemies:unitDead(core)?0:core?.disabled?1:2;
  const total=profile.requiresAllEnemies?enemies.length+pending:2;
  return {goalMode:profile.objectiveCode,coreHp:core?.hp??0,coreMax:core?.maxHp??0,
    enemyAlive:remainingEnemies,enemyTotal:enemies.length,playerAlive,outcome,remaining,total,
    progress:total?Math.round((total-remaining)/total*100):100};
}
function victoryOutcome(profile,roster){return objectiveSnapshot(profile,roster).outcome}
let currentScenario='iron-dust';
let selected=null, focusedCell=null, gridVisible=false, turn=1, phase='player', turnPhase='movement', gameOver=false, viewMode='movement', transportLoadMode=null, transportUnloadMode=null;
const svg=document.querySelector('#battlefield-map'), logEl=document.querySelector('#combat-log');
const $=s=>document.querySelector(s);
function fullOwnsPresentation(){return globalThis.GoblinCatalogFullRuntime?.ownsPresentation?.()===true}
function clearFullNativePresentation(){
  for(const id of ['battlefield-map','unit-roster','force-count','move-ready','fire-ready','gev-ready',
    'objective-text','combat-log','selection-readout','carrier-cargo','weapon-controls','map-toast',
    'intel-kicker','intel-title','intel-copy','intel-facts','intel-terrain-icon',
    'unit-intel-kicker','unit-intel-title','unit-intel-copy','unit-intel-facts']){
    const node=$('#'+id);
    if(node)node.innerHTML='';
  }
  const progress=$('#objective-progress');
  if(progress)progress.style.width='0%';
}
function hexCenter(x,y){return {x:58+x*DX+(y%2?DX/2:0),y:48+y*DY}}
function hexPoints(x,y){const c=hexCenter(x,y);return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return `${c.x+S*Math.cos(a)},${c.y+S*Math.sin(a)}`}).join(' ')}
function hexVertices(x,y){const c=hexCenter(x,y);return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return {x:c.x+S*Math.cos(a),y:c.y+S*Math.sin(a)}})}
function hexNeighbors(x,y){return y%2===0?[{x,y:y+1},{x:x-1,y:y+1},{x:x-1,y},{x:x-1,y:y-1},{x,y:y-1},{x:x+1,y}]:[{x:x+1,y:y+1},{x,y:y+1},{x:x-1,y},{x,y:y-1},{x:x+1,y:y-1},{x:x+1,y}]}
function findMovementPath(from,to,allowance,movingUnit=selected,occupancy=null){const startKey=`${from.x},${from.y}`,targetKey=`${to.x},${to.y}`,occupied=new Set((occupancy??(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster(movingUnit?.team??'player'):units)).filter(u=>unitAlive(u)&&(!globalThis.GoblinCatalogFullRuntime?.active()||!u.embarkedOn)&&u!==movingUnit).map(u=>`${u.x},${u.y}`)),best=new Map([[startKey,0]]),queue=[{x:from.x,y:from.y,cost:0,path:[]}];while(queue.length){queue.sort((a,b)=>a.cost-b.cost);const node=queue.shift(),key=`${node.x},${node.y}`;if(key===targetKey)return node.path;if(node.cost>allowance)continue;hexNeighbors(node.x,node.y).forEach(next=>{if(next.x<0||next.x>=W||next.y<0||next.y>=H)return;const nextKey=`${next.x},${next.y}`;if(occupied.has(nextKey)&&nextKey!==targetKey)return;const cost=node.cost+movementCost(movingUnit,nextKey);if(cost>allowance||best.has(nextKey)&&best.get(nextKey)<=cost)return;best.set(nextKey,cost);queue.push({x:next.x,y:next.y,cost,path:[...node.path,next]})})}return null}function drawAreaBoundary(radius,className,includeCell=null){if(!selected)return;const inside=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&(includeCell?includeCell(x,y):dist(selected,{x,y})<=radius);let d='';for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!inside(x,y))continue;const vertices=hexVertices(x,y),neighbors=hexNeighbors(x,y);for(let i=0;i<6;i++){const n=neighbors[i];if(!inside(n.x,n.y)){const a=vertices[i],b=vertices[(i+1)%6];d+=`M${a.x},${a.y}L${b.x},${b.y}`}}}const path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.classList.add('area-boundary',...className.split(' '));svg.appendChild(path)}
function dist(a,b){const aq=a.x-Math.floor(a.y/2),bq=b.x-Math.floor(b.y/2),dr=a.y-b.y,dq=aq-bq;return Math.max(Math.abs(dq),Math.abs(dr),Math.abs(dq+dr))}
function nearestHex(px,py){let best=null,bestDistance=Infinity;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const c=hexCenter(x,y),d=(c.x-px)**2+(c.y-py)**2;if(d<bestDistance){bestDistance=d;best={x,y}}}return best}
// Historical Field Test sessions retain this exact pixel-sampling rule.
function legacyLosSampleCount(a,b){return Math.max(2,Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs((a.x+a.y)-(b.x+b.y)))*8)}
function lineOfSight(from,to){
  const session=legacySession;
  if(!session?.effectiveRules||!Object.isFrozen(session)||!Object.isFrozen(session.effectiveRules))return false;
  if(session.ruleProfileId==='LEGACY_SUPERCOVER_PROBE_v1'||
     session.ruleProfileId==='FIELD_TEST_SUPERCOVER_v1'||session.ruleProfileId==='CATALOG_ARTILLERY_PILOT_v1'||session.ruleProfileId==='CATALOG_BASE_TRANSPORT_v1'||session.ruleProfileId==='CATALOG_SPECIALISTS_v1'||session.ruleProfileId==='FULL_CATALOG_v1'){
    if(!(globalThis.GoblinCatalogFullModel?.has(session.scenarioId,session.ruleProfileId))&&!ScenarioRuleProfiles.isDraftSession?.(session)&&!['los-supercover-probe','los-supercover-showcase','artillery-pilot','catalog-transport','catalog-maneuver','catalog-siege','catalog-specialists'].includes(session.scenarioId)||
       session.scenarioVersion!==1||
       session.effectiveRules.losMode!=='strict-supercover'||typeof GoblinHexSupercover==='undefined')return false;
    return GoblinHexSupercover.intermediateHexes(from,to)
      .every(cell=>!TerrainRules.blocksLos(terrainTypeAt(cell.x,cell.y)));
  }
  if(session.ruleProfileId!=='FIELD_TEST_LEGACY_v1'&&
     !(session.ruleProfileId==='TRAINING_FIELD_TEST_v1'&&session.scenarioVersion===1&&
       globalThis.GoblinTrainingModel?.has(session.scenarioId)&&session.effectiveRules.losMode==='legacy-pixel-los-v1')&&
     !(session.scenarioId==='siege-pilot'&&session.scenarioVersion===1&&session.ruleProfileId==='CATALOG_SIEGE_PILOT_v1')&&
     !(session.scenarioId==='skimmer-pilot'&&session.scenarioVersion===1&&session.ruleProfileId==='CATALOG_SKIMMER_PILOT_v1')&&
     !(session.scenarioId==='iron-dust'&&session.scenarioVersion===2&&
       session.ruleProfileId==='FIELD_TEST_LEGACY_v2'&&
       session.effectiveRules.targetPolicyVersion==='skip-depleted-treads-v1'))return false;
  const steps=legacyLosSampleCount(from,to),a=hexCenter(from.x,from.y),b=hexCenter(to.x,to.y);
  for(let i=1;i<steps;i++){const t=i/steps,cell=nearestHex(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);if((cell.x!==from.x||cell.y!==from.y)&&(cell.x!==to.x||cell.y!==to.y)&&TerrainRules.blocksLos(terrainTypeAt(cell.x,cell.y)))return false}
  return true;
}
function findEnemyStep(foe,target){
  const occupied=new Set((globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster(foe.team):units).filter(u=>unitAlive(u)&&(!globalThis.GoblinCatalogFullRuntime?.active()||!u.embarkedOn)&&u!==foe).map(u=>`${u.x},${u.y}`));
  const queue=[{x:foe.x,y:foe.y,cost:0,path:[]}],seen=new Map([[`${foe.x},${foe.y}`,0]]);let best=null;
  while(queue.length){
    const node=queue.shift();
    if(node.path.length&&dist(node,target)<dist(foe,target)&&(!best||dist(node,target)<dist(best,target)||dist(node,target)===dist(best,target)&&node.cost<best.cost))best=node;
    hexNeighbors(node.x,node.y).forEach(next=>{
      const key=`${next.x},${next.y}`,stepCost=movementCost(foe,key);
      if(next.x<0||next.x>=W||next.y<0||next.y>=H||occupied.has(key)||node.cost+stepCost>foe.move)return;
      if(!seen.has(key)||node.cost+stepCost<seen.get(key)){seen.set(key,node.cost+stepCost);queue.push({x:next.x,y:next.y,cost:node.cost+stepCost,path:[...node.path,next]})}
    });
  }
  return best;
}
function addLog(text,enemy=false){if(fullOwnsPresentation()||globalThis.GoblinCatalogFullRuntime?.active())return;const lang=globalThis.GoblinLanguage?.current||'de';const t=new Date().toLocaleTimeString(lang,{hour:'2-digit',minute:'2-digit'});logEl.insertAdjacentHTML('afterbegin',`<div class="log-line ${enemy?'enemy':''}"><span class="log-time">${t}</span><strong>${enemy?'HOSTILE':'COMMAND'}</strong> ${text}</div>`);logEl.firstElementChild?.setAttribute('data-l10n-source',text)}
function drawGrid(){if(!gridVisible)return;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const grid=document.createElementNS(NS,'polygon');grid.setAttribute('points',hexPoints(x,y));grid.classList.add('grid-hex');svg.appendChild(grid)}}function drawFocusMarker(){if(!focusedCell)return;const marker=document.createElementNS(NS,'polygon');marker.setAttribute('points',hexPoints(focusedCell.x,focusedCell.y));marker.classList.add('focus-marker');svg.appendChild(marker)}function draw(){
  if(fullOwnsPresentation())return;
  globalThis.GoblinLegacyPresentation?.sync();
  const visibleUnits=globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units;
  svg.setAttribute('viewBox',boardViewBox()); svg.innerHTML=''; const passiveSelection=selected&&unitAlive(selected)&&!phaseCanAct(selected);
  const bakeData=typeof MapBake==='undefined'?null:MapBake.snapshot(currentScenario,legacySession?.config,legacySession,
    scenarioCatalog[currentScenario]?.bakeLevel,W,H,S,58,48,terrainTypeAt);
  const bakeUrl=typeof MapBake==='undefined'?null:MapBake.select(bakeData,draw),baked=!!bakeUrl;
  if(baked){
    const image=document.createElementNS(NS,'image'),scale=DX/192;
    image.setAttribute('href',bakeUrl);
    image.setAttribute('x',58-96*scale);
    image.setAttribute('y',48-(192/Math.sqrt(3))*scale);
    image.setAttribute('width',2400*scale);
    image.setAttribute('height',1386*scale);
    image.setAttribute('preserveAspectRatio','none');
    image.setAttribute('class','terrain-bake');
    svg.appendChild(image);
  }
  const tiled=!baked&&typeof TerrainTiles!=='undefined'?TerrainTiles.drawBoard(svg,terrainTypeAt,W,H,hexCenter,DX):new Set();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const illustrated=baked||tiled.has(`${x},${y}`)||drawTerrainArtwork(x,y);
    const p=document.createElementNS(NS,'polygon');p.setAttribute('points',hexPoints(x,y));p.classList.add('hex');p.dataset.x=x;p.dataset.y=y;
    if(illustrated)p.classList.add('terrain-illustrated');
    const unit=visibleUnits.find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y); const attackPhase=turnPhase==='fire',canFire=!!selected,canMove=!!selected; if(attackPhase&&selected&&unitAlive(selected)&&unit&&unit.team==='enemy'&&dist(selected,{x,y})<=attackRange(selected)&&fireTargetVisible(selected,unit)&&(typeof canSelectedWeaponTarget!=='function'||canSelectedWeaponTarget(selected,unit))) p.classList.add('attack');
    if(terrain.has(`${x},${y}`)){p.classList.add('terrain');}
    if(selected&&unitAlive(selected)){const distance=dist(selected,{x,y}),moveCost=distance+(terrain.has(`${x},${y}`)?1:0);if(x===selected.x&&y===selected.y)p.classList.add('selected');const moveAllowance=movementBudget(selected,turnPhase==='gev');const blockedByUnit=unit&&unit!==selected;if(canMove&&viewMode==='movement'&&!blockedByUnit&&findMovementPath(selected,{x,y},moveAllowance))p.classList.add('movement-fill');if(canFire&&(viewMode==='fire'||viewMode==='los')&&distance<=attackRange(selected)){if(viewMode==='fire')p.classList.add('fire-range');else if(lineOfSight(selected,{x,y}))p.classList.add('los-visible')}if(attackPhase&&unit&&unit.team==='enemy'&&distance<=attackRange(selected)&&fireTargetVisible(selected,unit)&&(typeof canSelectedWeaponTarget!=='function'||canSelectedWeaponTarget(selected,unit)))p.classList.add('attack')}
    p.addEventListener('click',()=>handleHex(x,y));svg.appendChild(p);
    if(terrain.has(`${x},${y}`)&&!illustrated){const c=hexCenter(x,y);const r=document.createElementNS(NS,'rect');r.setAttribute('x',c.x-11);r.setAttribute('y',c.y-7);r.setAttribute('width',22);r.setAttribute('height',14);r.setAttribute('transform',`rotate(18 ${c.x} ${c.y})`);r.classList.add('ruin');r.addEventListener('click',event=>{event.stopPropagation();handleHex(x,y)});svg.appendChild(r)}
  }
  if(transportUnloadMode){for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(canUnloadTo(transportUnloadMode.carrier,transportUnloadMode.cargo,x,y)){const target=svg.querySelector('.hex[data-x="'+x+'"][data-y="'+y+'"]');if(target)target.classList.add('unload-target')}}} drawGrid(); if(selected&&unitAlive(selected)&&!transportUnloadMode){const movementAllowance=movementBudget(selected,turnPhase==='gev'),areaClass=passiveSelection?' reference':'';const canMoveCell=(x,y)=>{const occupant=visibleUnits.find(u=>unitAlive(u)&&!u.embarkedOn&&u!==selected&&u.x===x&&u.y===y);const carrier=occupant?.transportCapacity?occupant:null;return !!(selected.team==='player'&&carrier&&canEmbark(selected,carrier))||(!occupant&&!!findMovementPath(selected,{x,y},movementAllowance))};if(viewMode==='movement')drawAreaBoundary(movementAllowance,'movement-boundary'+areaClass,canMoveCell);if(viewMode==='fire')drawAreaBoundary(attackRange(selected),'fire-boundary'+areaClass);if(viewMode==='los')drawAreaBoundary(attackRange(selected),'los-boundary'+areaClass,(x,y)=>dist(selected,{x,y})<=attackRange(selected)&&lineOfSight(selected,{x,y}))}
  UnitVisuals.sortMapUnits(visibleUnits.filter(u=>!u.embarkedOn&&!u.salvaged)).forEach(u=>{try{renderUnit(u)}catch(error){addLog(`Unit render failed: ${error.message}`,true)}}); drawFocusMarker(); updateRoster(); showCarrierCargo();
}
function renderUnit(u){if(u.embarkedOn)return;
  const c=hexCenter(u.x,u.y), color=u.team==='player'?(u.id==='ogre'?'#d1f35a':'#62cadd'):'#ee574d';
  const g=document.createElementNS(NS,'g');
  g.classList.add('unit-svg');
  const covered=terrain.has(`${u.x},${u.y}`);
  if(covered&&unitAlive(u))g.classList.add('covered-unit');
  if(!phaseCanAct(u)&&unitAlive(u)&&u.team==='player'&&!u.disabled)g.classList.add('acted-unit');if(u.disabled&&unitAlive(u)){g.classList.add('disabled-unit');g.style.opacity='.32';g.style.filter='grayscale(1)'}
  if(u.justHit&&unitAlive(u))g.classList.add('hit-flash');
  if(unitDead(u)){g.classList.add('wreck');g.setAttribute('pointer-events','none');
    if(UnitVisuals.wreckFor(u)?.cargoRelation)return;
    UnitVisuals.drawWreck(g,u,c,{ns:NS});svg.appendChild(g);return}
  if(transportLoadMode&&u.team==='player'&&u!==transportLoadMode){if(canEmbark(transportLoadMode,u))g.classList.add('transport-candidate');else g.classList.add('transport-unavailable')}
  if(selected&&selected.team==='player'&&selected!==u&&u.transportCapacity&&canEmbark(selected,u))g.classList.add('transport-target')
  const targetable=turnPhase==='fire'&&u.team==='enemy'&&selected&&dist(selected,u)<=attackRange(selected)&&lineOfSight(selected,u)&&(typeof canSelectedWeaponTarget!=='function'||canSelectedWeaponTarget(selected,u));
  if(targetable&&u.disabled){g.style.opacity='1';g.style.filter='none'}
  if(targetable&&!document.body.classList.contains('ui-v2-active')){const ring=document.createElementNS(NS,'polygon');ring.setAttribute('points',`${c.x},${c.y-24} ${c.x+21},${c.y-12} ${c.x+21},${c.y+12} ${c.x},${c.y+24} ${c.x-21},${c.y+12} ${c.x-21},${c.y-12}`);ring.classList.add('target-ring');g.appendChild(ring)}
  if(u.transportCapacity&&turnPhase==='movement'&&!u.disabled&&carrierLoad(u)<u.transportCapacity){const slot=carrierCargo(u).length,plus=document.createElementNS(NS,'text');plus.setAttribute('x',c.x-20+slot*20);plus.setAttribute('y',c.y-28);plus.setAttribute('text-anchor','middle');plus.classList.add('transport-slot');plus.textContent='+';plus.addEventListener('click',event=>{event.stopPropagation();activateLoadMode(u)});g.appendChild(plus)}
  UnitVisuals.draw(g,u,c,{ns:NS,color,map:true,selected:u===selected&&!document.body.classList.contains('ui-v2-active')});
  const bg=document.createElementNS(NS,'rect');
  bg.setAttribute('x',c.x-15);bg.setAttribute('y',c.y+22);bg.setAttribute('width',30);bg.setAttribute('height',3);bg.classList.add('unit-hp-bg','m1-replaced-hp');g.appendChild(bg);
  const hp=document.createElementNS(NS,'rect');
  hp.setAttribute('x',c.x-15);hp.setAttribute('y',c.y+22);hp.setAttribute('width',30*(u.catalogSystems?u.catalogSystems.treads/u.catalogSystems.maxTreads:u.hp/u.maxHp));hp.setAttribute('height',3);hp.setAttribute('fill',color);hp.classList.add('m1-replaced-hp');g.appendChild(hp);
  if(covered){const shield=document.createElementNS(NS,'path');shield.setAttribute('d',`M${c.x+17},${c.y-20} l6,3 v6 l-6,4 l-6,-4 v-6 z`);shield.classList.add('cover-mark');g.appendChild(shield)}
  g.addEventListener('click',event=>{event.stopPropagation();handleUnitClick(u)});
  svg.appendChild(g);
  if(u.moveFrom){const from=hexCenter(u.moveFrom.x,u.moveFrom.y);if(!globalThis.GoblinPresentation?.owns('legacy'))g.animate([{transform:`translate(${from.x-c.x}px,${from.y-c.y}px)`},{transform:'translate(0,0)'}],{duration:520,easing:'cubic-bezier(.2,.8,.25,1)',fill:'both'});u.moveFrom=null}
}
function clearSelection(message='AUSWAHL AUFGEHOBEN'){selected=null;transportLoadMode=null;transportUnloadMode=null;setToast(message);updateSelection();draw()}
function handleTransportShortcut(event) {
  if (event.key.toLowerCase() !== 'l' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (document.querySelectorAll('.modal:not(.hidden), .phase-confirm.show, .phase-transition.show').length) return;
  const carrier = selected;
  if (gameOver || phase !== 'player' || !carrier?.transportCapacity || carrier.team !== 'player' || unitDead(carrier) || carrier.disabled) return;
  event.preventDefault();
  const cargo = carrierCargo(carrier)[0];
  if (cargo) activateUnloadMode(carrier, cargo);
  else activateLoadMode(carrier);
}
if(!bootProfileError)document.addEventListener('keydown', handleTransportShortcut);
function weaponTargetAllowed(attacker,target){return typeof canSelectedWeaponTarget!=='function'||canSelectedWeaponTarget(attacker,target)}

function clearUnitInfo(){$('#unit-intel-kicker').textContent='UNIT INTEL';$('#unit-intel-title').textContent='NO UNIT SELECTED';$('#unit-intel-copy').textContent='Klicke eine Einheit für taktische Informationen.';$('#unit-intel-facts').innerHTML='<div><span>STATUS</span><b>SCANNING</b></div>'}
function showFieldInfo(x,y){
  if(fullOwnsPresentation())return;
  const unit=(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);
  const type=terrainTypeAt(x,y),rule=TerrainRules.get(type),cost=selected?movementCost(selected,`${x},${y}`):rule.cost;
  const blocked=selected&&!lineOfSight(selected,{x,y});
  const label=`${String.fromCharCode(65+x)}-${String(y+1).padStart(2,'0')}`;
  $('#intel-kicker').textContent='FIELD INTEL';$('#intel-title').textContent=`SECTOR ${label}`;
  const terrainIcon=typeof TerrainDisplay==='undefined'?null:TerrainDisplay.icon(type,'legacy-terrain-icon');
  const terrainIconHost=$('#intel-terrain-icon');
  if(terrainIconHost?.replaceChildren)terrainIconHost.replaceChildren(...(terrainIcon?[terrainIcon]:[]));
  $('#intel-copy').textContent=`${rule.note}${blocked?' Dieses Feld liegt hinter einem Sichtblocker.':''}`;
  $('#intel-facts').innerHTML=`<div><span>TERRAIN</span><b>${rule.label}</b></div><div><span>MOVE COST</span><b>${Number.isFinite(cost)?cost:'BLOCKED'}</b></div><div><span>COVER</span><b>${rule.cover?'+1 DEF':'NONE'}</b></div><div><span>OCCUPANT</span><b>${unit?unit.name:'NONE'}</b></div><div><span>VISIBILITY</span><b>${blocked?'BLOCKED':'CLEAR'}</b></div>`;
  for(const wreck of UnitVisuals.wrecksAt(x,y)){
    const row=document.createElement('div');row.textContent=UnitVisuals.wreckLabel(wreck);
    $('#intel-facts').appendChild(row);
  }
}
function carrierCargo(unit){return units.filter(u=>u.embarkedOn===unit.id&&unitAlive(u))}
function carrierLoad(unit){return carrierCargo(unit).reduce((sum,cargo)=>sum+Math.max(1,cargo.hp),0)}
function canUnloadTo(carrier,cargo,x,y){return !!carrier&&!!cargo&&turnPhase==='movement'&&carrier.team==='player'&&unitAlive(carrier)&&!carrier.disabled&&unitAlive(cargo)&&!cargo.embarkedThisTurn&&cargo.embarkedOn===carrier.id&&dist(carrier,{x,y})===1&&x>=0&&x<W&&y>=0&&y<H&&Number.isFinite(movementCost(cargo,`${x},${y}`))&&!units.some(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y)}
function activateLoadMode(carrier){if(turnPhase!=='movement'||carrier.team!=='player'||unitDead(carrier)||carrier.disabled||carrierLoad(carrier)>=carrier.transportCapacity){setToast('VERLADEN NUR IN DER BEWEGUNGSPHASE');return}transportUnloadMode=null;transportLoadMode=carrier;selected=carrier;setToast('VERLADBARE EINHEIT WÄHLEN');updateSelection();draw()}
function activateUnloadMode(carrier,cargo){if(turnPhase!=='movement'||unitDead(carrier)||carrier.disabled||cargo.embarkedThisTurn){setToast('AUSLADEN IN DIESER PHASE NICHT MOEGLICH');return}transportLoadMode=null;transportUnloadMode={carrier,cargo};selected=carrier;setToast('ZIELFELD FÜR AUSLADEN WÄHLEN');updateSelection();draw()}
function showCarrierCargo(){if(fullOwnsPresentation())return;const panel=document.querySelector('#carrier-cargo');if(!panel)return;updateAreaControls();const carrier=selected&&selected.transportCapacity?selected:null;if(!carrier){panel.classList.add('hidden');panel.innerHTML='';return}const cargo=carrierCargo(carrier);panel.classList.remove('hidden');panel.innerHTML='<span class="carrier-cargo-label">'+carrier.name+' - CARGO '+cargo.length+'/'+carrier.transportCapacity+'</span>';cargo.forEach(unit=>{const button=document.createElement('button');button.className='cargo-slot';button.title=unit.name+' ausladen';button.textContent=unit.icon;button.addEventListener('click',event=>{event.stopPropagation();activateUnloadMode(carrier,unit)});panel.appendChild(button)});if(cargo.length<carrier.transportCapacity){const button=document.createElement('button');button.className='cargo-slot transport-slot';button.title='Verladbare Einheit auswaehlen';button.textContent='+';button.addEventListener('click',event=>{event.stopPropagation();activateLoadMode(carrier)});panel.appendChild(button)}}
function canEmbark(a,b){const carrier=a?.transportCapacity?a:b,cargo=a?.transportCapacity?b:a,capacity=carrier?.transportCapacity??(carrier?.id==='gev-pc'?3:0);if(!carrier||!cargo||carrier.team!=='player'||cargo.team!=='player'||carrier===cargo)return false;return turnPhase==='movement'&&unitAlive(carrier)&&unitAlive(cargo)&&!carrier.disabled&&!cargo.disabled&&(cargo.infantry===true||cargo.engineering===true)&&!cargo.embarkedOn&&!cargo.moved&&!cargo.disembarkedThisTurn&&dist(carrier,cargo)<=1&&carrierLoad(carrier)+Math.max(1,cargo.hp)<=capacity}
function embark(cargo,carrier){if(!canEmbark(cargo,carrier)){setToast('VERLADEN NICHT MÖGLICH');return}transportLoadMode=null;transportUnloadMode=null;cargo.embarkedOn=carrier.id;cargo.embarkedThisTurn=true;cargo.x=carrier.x;cargo.y=carrier.y;cargo.moved=true;cargo.acted=true;addLog(`${cargo.name} steigt in ${carrier.name} ein.`);setToast('EINHEIT EINGESCHIFFT');selected=carrier;updateSelection();draw();maybeAutoAdvancePhase()}
function unloadAt(carrier,cargo,x,y){if(!canUnloadTo(carrier,cargo,x,y)){setToast('ZIELFELD NICHT VERFUEGBAR');return}transportUnloadMode=null;cargo.embarkedOn=null;cargo.x=x;cargo.y=y;cargo.moved=true;cargo.acted=true;carrier.moved=true;carrier.acted=true;addLog(cargo.name+' verlässt '+carrier.name+'.');setToast('EINHEIT AUSGESCHIFFT');selected=carrier;updateSelection();draw();maybeAutoAdvancePhase()}function showUnitInfo(unit){if(fullOwnsPresentation())return;if(globalThis.GoblinCatalogFullRuntime?.active()&&!GoblinCatalogFullRuntime.known(unit?.id))return;const covered=terrain.has(`${unit.x},${unit.y}`),label=`${String.fromCharCode(65+unit.x)}-${String(unit.y+1).padStart(2,'0')}`;$('#unit-intel-kicker').textContent=unit.team==='player'?'UNIT INTEL':'HOSTILE INTEL';$('#unit-intel-title').textContent=unit.name;$('#unit-intel-copy').textContent=`${unit.type} · ${unit.team==='player'?'FRIENDLY':'HOSTILE'} · SECTOR ${label}`;$('#unit-intel-facts').innerHTML=`<div><span>HP</span><b>${Math.max(0,unit.hp)}/${unit.maxHp}</b></div><div><span>DEFENSE</span><b>${unit.defense??unit.maxHp}</b></div><div><span>MOVE / RANGE</span><b>${unit.move} / ${unit.range}</b></div><div><span>STATUS</span><b>${unit.embarkedOn?'EMBARKED':unit.disabled?'DISABLED':covered?'COVERED':'OPEN'}</b></div>`}function selectPlayerUnit(unit){transportLoadMode=null;transportUnloadMode=null;focusedCell={x:unit.x,y:unit.y};showUnitInfo(unit);showFieldInfo(unit.x,unit.y);if(unit.disabled){setToast(`${unit.name} IST DEAKTIVIERT`);return}if(selected===unit){clearSelection();return}selected=unit;setToast(phaseCanAct(unit)?`${unit.name} AUSGEWÄHLT`:`${unit.name} AUSGEWÄHLT · BEREITS GEHANDELT`);updateSelection();draw()}function selectEnemyUnit(unit){focusedCell={x:unit.x,y:unit.y};selected=unit;setToast(`${unit.name} AUSGEWÄHLT`);showUnitInfo(unit);showFieldInfo(unit.x,unit.y);updateSelection();draw()}function handleUnitClick(unit){if(globalThis.GoblinCatalogFullRuntime?.active()&&!GoblinCatalogFullRuntime.known(unit?.id))return;focusedCell={x:unit.x,y:unit.y};draw();showUnitInfo(unit);showFieldInfo(unit.x,unit.y);if(gameOver||phase!=='player')return;if(transportLoadMode===selected&&unit.team==='player'&&canEmbark(unit,selected)){embark(unit,selected);return}if(selected&&unit.team==='player'&&!selected.transportCapacity&&unit.transportCapacity&&canEmbark(selected,unit)){embark(selected,unit);return}if(unit.team==='player'){selectPlayerUnit(unit);return}const canAttack=selected&&selected.team==='player'&&turnPhase==='fire'&&dist(selected,unit)<=attackRange(selected)&&lineOfSight(selected,unit)&&weaponTargetAllowed(selected,unit);if(canAttack){attack(selected,unit);return}if(selected&&selected.team==='player'){clearSelection(turnPhase!=='fire'?'FEUERPHASE NOCH NICHT AKTIV':'ZIEL NICHT ERREICHBAR');return}selectEnemyUnit(unit)}function handleHex(x,y){focusedCell={x,y};draw();showFieldInfo(x,y);if(gameOver||phase!=='player')return;if(transportUnloadMode&&canUnloadTo(transportUnloadMode.carrier,transportUnloadMode.cargo,x,y)){unloadAt(transportUnloadMode.carrier,transportUnloadMode.cargo,x,y);return}if(!units.some(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y)){clearUnitInfo()}const unit=units.find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);if(unit){showUnitInfo(unit);if(transportLoadMode===selected&&unit.team==='player'&&canEmbark(unit,selected)){embark(unit,selected);return}if(selected&&unit.team==='player'&&!selected.transportCapacity&&unit.transportCapacity&&canEmbark(selected,unit)){embark(selected,unit);return}if(unit.team==='player'){selectPlayerUnit(unit);return}}if(!selected){if(unit?.team==='enemy'){selectEnemyUnit(unit);return}setToast('WÄHLE ZUERST EINE EINHEIT');return}if(selected.disabled){clearSelection('EINHEIT IST DEAKTIVIERT');return}if(unit?.team==='enemy'){if(turnPhase==='movement'&&selected.team==='player'&&selected.id==='ogre'&&!selected.moved&&!unit.core){const allowance=selected.move;const acceptedPath=findMovementPath(selected,{x,y},allowance);if(acceptedPath){const actor=selected;const presentation=globalThis.GoblinLegacyPresentation?.begin(actor,acceptedPath,unit?'ram':'move',unit);actor.moveFrom={x:actor.x,y:actor.y};actor.x=x;actor.y=y;actor.moved=true;actor.acted=true;unit.hp=0;unit.justHit=true;addLog(`${actor.name} rammt ${unit.name}. Ziel zerstört.`);setToast('RAMMSTOSS: ZIEL ZERSTÖRT');selected=null;updateSelection();draw();setTimeout(()=>{unit.justHit=false;draw()},560);const ended=checkVictory();globalThis.GoblinLegacyPresentation?.confirm(presentation);if(ended)return;return}clearSelection('RAMMEN NICHT MÖGLICH');return}const inRange=selected.team==='player'&&dist(selected,unit)<=attackRange(selected),visible=lineOfSight(selected,unit);if(turnPhase==='fire'&&inRange&&visible&&weaponTargetAllowed(selected,unit)){attack(selected,unit);return}if(selected.team==='player'){clearSelection(turnPhase!=='fire'?'FEUERPHASE NOCH NICHT AKTIV':'ZIEL NICHT ERREICHBAR');return}selectEnemyUnit(unit);return}if((turnPhase==='movement'||turnPhase==='gev')&&selected.team==='player'&&!unit){const second=turnPhase==='gev';if(!canMoveUnit(selected,second)){clearSelection('EINHEIT HAT BEREITS GEHANDELT');return}const allowance=movementBudget(selected,second);const acceptedPath=findMovementPath(selected,{x,y},allowance);if(acceptedPath){const actor=selected;const presentation=globalThis.GoblinLegacyPresentation?.begin(actor,acceptedPath,unit?'ram':'move',unit);actor.moveFrom={x:actor.x,y:actor.y};actor.x=x;actor.y=y;carrierCargo(actor).forEach(c=>{c.x=x;c.y=y});actor.moveCount=(actor.moveCount||0)+1;if(second)actor.secondMoved=true;else actor.moved=true;actor.acted=true;globalThis.GoblinLegacyPresentation?.confirm(presentation);addLog(`${actor.name} bewegt sich nach ${String.fromCharCode(65+x)}-${String(y+1).padStart(2,'0')}.`);setToast('BEFEHL AUSGEFÜHRT');selected=null;updateSelection();draw();maybeAutoAdvancePhase()}else clearSelection()}else if(selected.team==='player')clearSelection('IN DIESER PHASE NICHT MÖGLICH')}function startEnemyTurn(chooseEnemyAction,chooseEnemyFireTarget){
  if(gameOver||phase!=='player'||globalThis.GoblinCatalogFullRuntime?.allowsPlayerPhaseAdvance?.()===false)return;
  ScenarioRuleProfiles.checkEnemyControllers(legacySession,chooseEnemyAction,chooseEnemyFireTarget);
  selected=null;updateSelection();draw();enemyTurn(chooseEnemyAction,chooseEnemyFireTarget);
}
function maybeAutoAdvancePhase(){if(GameDialogs.isOpen())return;if(!$('#auto-end-turn')?.checked||phase!=='player'||phaseReadyUnits().length)return;globalThis.GoblinUIV2?.notifyPhaseSkip(turnPhase);if(turnPhase==='movement'){setTurnPhase('fire');return}if(turnPhase==='fire'){setTurnPhase('gev');return}if(turnPhase==='gev')startEnemyTurn()}
function maybeAutoEndTurn(){maybeAutoAdvancePhase()}function combatRatio(strength,defense){strength=Math.max(0,strength);defense=Math.max(1,defense);if(strength>=defense*5)return '5-1';if(strength*2<defense)return '1-2';return `${Math.min(4,Math.max(1,Math.floor(strength/defense)))}-1`}function combatOutcome(attacker,target){const ratio=combatRatio(attacker.damage,target.defense??target.maxHp),band=COMBAT_RULES.crt[ratio],result=ratio==='5-1'?'X':band[Math.floor(Math.random()*band.length)];if(result==='D'){if(target.id==='infantry')target.hp=Math.max(0,target.hp-1);else if(target.disabled)target.hp=0;else {target.disabled=true;target.disabledUntil=turn+(attacker.team==='enemy'?2:1)}}if(result==='X')target.hp=0;return {ratio,result}}function checkVictory(){if(legacySession?.ruleProfileId==='TRAINING_FIELD_TEST_v1')return !units.some(u=>u.team==='player'&&unitAlive(u));const outcome=victoryOutcome(victoryProfile(legacySession.effectiveRules),units);if(outcome===null)return false;finish(outcome);return true}
function attack(attacker,target){if(attacker.disabled){setToast(`${attacker.name} IST DEAKTIVIERT`);return}if(target.team==='enemy'&&!lineOfSight(attacker,target)){setToast('SICHTLINIE BLOCKIERT');return}if(attacker.team==='player'&&(turnPhase!=='fire'||attacker.fired)){setToast('FEUERPHASE ODER EINHEIT BEREITS VERBRAUCHT');return}attacker.acted=true;if(attacker.team==='player')attacker.fired=true;const outcome=combatOutcome(attacker,target);target.lastOutcome=outcome.result;target.justHit=true;const resultText=outcome.result==='X'?'ZIEL AUSGESCHALTET':outcome.result==='D'?'ZIEL DEAKTIVIERT':'KEIN EFFEKT';addLog(`${attacker.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${resultText}.`);setToast(resultText);selected=null;updateSelection();draw();setTimeout(()=>{target.justHit=false;draw()},560);if(checkVictory())return;maybeAutoAdvancePhase()}function recoverDisabled(team){units.filter(u=>u.team===team&&u.disabled&&u.disabledUntil<=turn).forEach(u=>{u.disabled=false;u.disabledUntil=0;addLog(`${u.name} ist wieder einsatzbereit.`,team==='enemy')})}function enemyFire(foe){if(unitDead(foe)||foe.disabled)return false;const targets=(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster(foe.team):units).filter(u=>u.team==='player'&&unitAlive(u)).sort((a,b)=>dist(foe,a)-dist(foe,b));const target=targets.find(u=>dist(foe,u)<=foe.range&&lineOfSight(foe,u));if(!target)return false;const outcome=combatOutcome(foe,target);target.justHit=true;addLog(`${foe.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${outcome.result==='X'?'ZIEL AUSGESCHALTET':outcome.result==='D'?'ZIEL DEAKTIVIERT':'KEIN EFFEKT'}.`,true);setTimeout(()=>{target.justHit=false;draw()},560);return true}
function commitEnemyStep(foe,step){
  const presentation=globalThis.GoblinLegacyPresentation?.begin(foe,step.path,'move');
  foe.moveFrom={x:foe.x,y:foe.y};
  foe.x=step.x;
  foe.y=step.y;
  foe.moveCount=(foe.moveCount||0)+1;
  globalThis.GoblinCatalogRuntime?.syncCargo(foe);
  globalThis.GoblinCatalogFullRuntime?.recordRoundAction(foe,{}, {kind:'move',acceptedPrefix:step.path});
  globalThis.GoblinLegacyPresentation?.confirm(presentation);
  addLog(`${foe.name} rückt nach ${String.fromCharCode(65+foe.x)}-${String(foe.y+1).padStart(2,'0')} vor.`,true);
}
// A policy can replace a shot only within the engine's current fire slot.
function chooseNativeEnemyFire(actor,pass,baseline,commands,preview,apply,choose,revision,isActive){
  const owner=legacySession, initialRevision=revision();
  const current=()=>isActive()&&owner===legacySession&&phase==='enemy'&&turnPhase==='enemy'&&!gameOver;
  const checked=new Map();
  const baselineKey=JSON.stringify(baseline);
  for(const command of commands()){
    const {ok,code,...facts}=preview(command);
    if(ok){const key=JSON.stringify(command);checked.set(key,{command,facts,baseline:key===baselineKey});}
  }
  if(!checked.has(baselineKey))throw Error('ENEMY_FIRE_BASELINE_MISSING');
  let open=true, spent=false, engineFailed=false, engineError;
  const reject=code=>({ok:false,code});
  const available=()=>open&&current()&&!spent&&revision()===initialRevision;
  function execute(command){
    if(!open||!current())return reject('ENEMY_FIRE_SLOT_CLOSED');
    if(spent)return reject('ENEMY_FIRE_SLOT_SPENT');
    if(revision()!==initialRevision)return reject('ENEMY_FIRE_STATE_CHANGED');
    const allowed=checked.get(JSON.stringify(command));
    if(!allowed)return reject('ENEMY_FIRE_CHOICE_UNAVAILABLE');
    try{
      const result=preview(allowed.command);
      if(!result.ok)return result;
      spent=true;
      return apply(allowed.command);
    }catch(error){engineFailed=true;engineError=error;open=false;throw error;}
  }
  try{choose(Object.freeze({actorId:actor.id,pass,entries:()=>available()?structuredClone([...checked.values()]):[],execute}));}
  catch(error){if(!engineFailed)console.error('Enemy fire choice failed',actor.id,error);}
  finally{open=false;}
  if(engineFailed)throw engineError;
  if(spent)return true;
  if(!current())return null;
  if(revision()!==initialRevision)throw Error('ENEMY_FIRE_STATE_CHANGED');
  return apply(baseline).ok;
}
function legacyRuleRevision(){
  return JSON.stringify([currentScenario,legacySession?.sessionId,legacySession?.ruleProfileId,turn,phase,turnPhase,gameOver,
    [...terrain],[...terrainTypes],units.map(({moveFrom,justHit,...unit})=>unit)]);
}
function fullEnemyStepQuery(full,actor) {
  const fail = code => ({ok:false,code});
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
  return function query(command) {
    const move = command?.type === 'EnemyMove';
    if (!exact(command, move ? ['type','actorId','x','y'] : ['type','actorId']) ||
        (!move && command.type !== 'EnemyHold')) return fail('INVALID_ENEMY_STEP');
    if (command.actorId !== actor.id || actor.team !== 'enemy' || !units.includes(actor) ||
        !unitAlive(actor) || actor.disabled || actor.embarkedOn || actor.core)
      return fail('ENEMY_ACTOR_UNAVAILABLE');
    if (!move) return {ok:true};
    const {x,y} = command;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H ||
        (x === actor.x && y === actor.y)) return fail('INVALID_ENEMY_DESTINATION');
    const knownRoster = full.roster('enemy');
    if (knownRoster.some(u => unitAlive(u) && !u.embarkedOn && u.x === x && u.y === y))
      return fail('ENEMY_DESTINATION_OCCUPIED');
    const path = findMovementPath(actor,{x,y},actor.move,actor,knownRoster);
    return path?.length ? {ok:true,path} : fail('ENEMY_DESTINATION_UNREACHABLE');
  }
}
function defaultEnemyStep(full,foe) {
  const target = (full?.active() ? full.roster(foe.team) : units)
    .filter(u => u.team === 'player' && unitAlive(u)).sort((a,b) => dist(foe,a) - dist(foe,b))[0];
  return target ? {target,step:findEnemyStep(foe,target)} : null;
}
function applyDefaultEnemyStep(full,foe) {
  const planned = defaultEnemyStep(full,foe);
  if (!planned) return;
  const step = full?.active() ? full.enemyStep(foe,planned.step) : planned.step;
  if (step) commitEnemyStep(foe,step);
  else addLog(foe.name + ' hält Position.',true);
}
function finishEnemyTurn(full) {
  if (gameOver || full?.enemyEnd() || checkVictory()) return;
  const roundCommit = globalThis.GoblinFullRoundSource?.beginBoundary();
  units.filter(u => u.team === 'player').forEach(u => u.acted = false);
  phase = 'player';
  turn++;
  recoverDisabled('player');
  resetActionState();
  if (full?.active()) full.beginTurn('player');
  turnPhase = 'movement';
  full?.enterControlledSide?.();
  globalThis.GoblinFullRoundSource?.complete(roundCommit,turn-1,'complete');
  $('#turn-number').textContent = String(turn).padStart(2,'0');
  setTurnPhase('movement');
  $('#log-status').textContent = 'STANDBY';
  setToast('WÄHLE EINE EINHEIT');
  draw();
}
function enemyTurn(chooseEnemyAction, chooseEnemyFireTarget) {
  function chooseEnemyStep(full, actor, choose) {
    if (typeof choose !== 'function') return false;
    const session = legacySession, actionTurn = turn;
    let open = true, spent = false, engineFailed = false, engineError;
    const queryStep = fullEnemyStepQuery(full,actor);
    function query(command) {
      if (!open || !full.active() || legacySession !== session || turn !== actionTurn ||
          phase !== 'enemy' || turnPhase !== 'enemy' || gameOver) return {ok:false,code:'ENEMY_SLOT_CLOSED'};
      if (spent) return {ok:false,code:'ENEMY_STEP_SPENT'};
      return queryStep(command);
    }
    function execute(command) {
      try {
        const checked = query(command);
        if (!checked.ok) return checked;
        spent = true;
        if (command.type === 'EnemyMove')
          commitEnemyStep(actor,full.enemyStep(actor,{x:command.x,y:command.y,path:checked.path}));
        return {ok:true};
      } catch (error) {
        engineFailed = true;
        engineError = error;
        open = false;
        throw error;
      }
    }
    let choiceFailed = false, choiceError;
    try {
      choose(Object.freeze({actorId:actor.id,query,execute}));
    } catch (error) {
      choiceFailed = true;
      choiceError = error;
    } finally {
      open = false;
    }
    if (engineFailed) throw engineError;
    if (choiceFailed) console.error('FULL enemy choice failed', actor.id, choiceError);
    return spent;
  }
  const acceptedTurn = turn;
  const acceptedSession = typeof chooseEnemyAction === 'function' || typeof chooseEnemyFireTarget === 'function' ? legacySession : null;
  const stale = () => acceptedSession && (legacySession !== acceptedSession || turn !== acceptedTurn ||
    (!gameOver && (phase !== 'enemy' || turnPhase !== 'enemy')));
  recoverDisabled('enemy');
  phase = 'enemy';
  turnPhase = 'enemy';
  globalThis.GoblinCatalogFullRuntime?.enemyBegin();
  $('#phase-title').textContent = 'HOSTILE PHASE';
  showPhaseTransition('HOSTILE PHASE');
  $('#log-status').textContent = 'PROCESSING';
  setToast('FEINDZUG WIRD AUSGEFÜHRT');
  if (globalThis.GoblinCatalogFullRuntime?.startControlledEnemyTurn?.()) return;
  scheduleGameTask(() => {
    const full = globalThis.GoblinCatalogFullRuntime;
    if (full?.active() && (phase !== 'enemy' || turn !== acceptedTurn)) return;
    if (acceptedSession && legacySession !== acceptedSession) return;
    const fullActive = full?.active();
    const canAct = unit => unitAlive(unit) && !unit.disabled &&
      (!(fullActive || globalThis.GoblinCatalogRuntime?.active()) || !unit.embarkedOn);
    const core = units.find(unit => unit.id === 'core');
    const foes=units.filter(unit => unit.team === 'enemy' && unit !== core && canAct(unit));
    for (const foe of foes) {
      if (gameOver) break;
      if (fullActive && !canAct(foe)) continue;
      const explicitStep = full?.active() && chooseEnemyStep(full, foe, chooseEnemyAction);
      if (acceptedSession && (legacySession !== acceptedSession || turn !== acceptedTurn ||
          phase !== 'enemy' || turnPhase !== 'enemy')) return;
      if (explicitStep) {
        // An explicit first-pass move or hold still leaves the normal fire retry.
        foe.enemyFired = false;
        continue;
      }
      const fired = enemyFire(foe,chooseEnemyFireTarget,'first');
      if (stale()) return;
      foe.enemyFired = fired;
      if (foe.enemyFired || (fullActive && !canAct(foe))) continue;
      applyDefaultEnemyStep(full,foe);
    }
    for (const foe of foes) {
      if (gameOver) break;
      if (foe.enemyFired || (fullActive && !canAct(foe))) continue;
      const fired = enemyFire(foe,chooseEnemyFireTarget,'retry');
      if (stale()) return;
      foe.enemyFired = fired;
    }
    finishEnemyTurn(full);
  },650);
}
async function confirmPhaseAdvance(action) {
  if (GameDialogs.isOpen()) return;
  const ready = phaseReadyUnits();
  if (!ready.length) { action(); return; }
  const beforeTurn = turn, beforePhase = turnPhase;
  const next = {movement:'toFire',fire:'toGev',gev:'toEnemy'}[turnPhase];
  const t = (key, fallback, params) => {
    const value = globalThis.GoblinLanguage?.t(key, params);
    return value && value !== key ? value : fallback;
  };
  const accepted = await GameDialogs.confirm({
    id: 'phase-end', title: t('dialog.phaseAdvance.title', 'End this phase?'),
    message: t('dialog.phaseAdvance.pending', `${ready.length} unit(s) can still act.`, {pendingCount:ready.length}),
    acceptLabel: t(`dialog.phaseAdvance.confirm.${next}`, 'End phase'),
    cancelLabel: t('dialog.phaseAdvance.cancel', 'Stay in this phase'),
    rememberLabel: t('dialog.phaseAdvance.remember', 'Do not ask again when changing phases'),
    rememberKey: 'goblin-never-ask-phase'
  });
  if (accepted && !gameOver && phase === 'player' && turn === beforeTurn && turnPhase === beforePhase) action();
}
function closePhaseConfirm(accepted) { if (!accepted) GameDialogs.cancel('phase-end'); }
function fireTargetVisible(unit,target){return globalThis.GoblinArtilleryWeapons?.active(unit)?GoblinArtilleryWeapons.queryChoice(unit,target).ok:lineOfSight(unit,target)}
function attackRange(unit){return globalThis.GoblinSiegeWeapons?.active(unit)?GoblinSiegeWeapons.weapons(unit)?.[unit.siegeWeapon]?.range??0:unit.range}
function movementBudget(unit,second=false){const budget=globalThis.GoblinSkimmerBudget?.sessionBudget(legacySession,unit);return budget?(second?budget.secondary:budget.primary):(second?(unit?.team==='player'&&isGevUnit(unit)?2:0):unit.move)}
function isGevUnit(unit){return unit?.movementMode==='gev'||unit?.gev===true||unit?.id==='gev'}
function movementMode(unit){return unit?.movementMode||(isGevUnit(unit)?'gev':unit?.infantry?'infantry':unit?.move===0?'fixed':'tracked')}
function movementCost(unit,key){const [x,y]=key.split(',').map(Number);return TerrainRules.movementCost(terrainTypeAt(x,y),unit)}
function effectiveDefense(target){return (target.defense??target.maxHp)+TerrainRules.coverBonus(terrainTypeAt(target.x,target.y))}
function phaseCanAct(unit,phaseName=turnPhase){if(!unit||unit.team!=='player'||unitDead(unit)||unit.disabled||phaseName==='enemy'||phaseName==='over')return false;if(phaseName==='movement')return !unit.embarkedOn&&!unit.moved&&hasMovementOption(unit,movementBudget(unit));if(phaseName==='fire')return !unit.fired&&units.some(target=>target.team==='enemy'&&unitAlive(target)&&!target.embarkedOn&&dist(unit,target)<=unit.range&&lineOfSight(unit,target));if(phaseName==='gev')return !unit.embarkedOn&&isGevUnit(unit)&&!unit.secondMoved&&hasMovementOption(unit,movementBudget(unit,true));return false}
function hasMovementOption(unit, allowance) {
  const occupancy = globalThis.GoblinCatalogFullRuntime?.active() ? GoblinCatalogFullRuntime.roster(unit.team) : units;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x === unit.x && y === unit.y) continue;
    const occupant = occupancy.find(u => unitAlive(u) && u.x === x && u.y === y && u !== unit);
    if (occupant && !(unit.id === 'ogre' && occupant.team === 'enemy' && !occupant.core)) continue;
    if (findMovementPath(unit, {x, y}, allowance, unit, occupancy)) return true;
  }
  return false;
}

function phaseReadyUnits() {
  const full = globalThis.GoblinCatalogFullRuntime;
  return full?.active() ? full.readyUnits() : units.filter(unit => phaseCanAct(unit));
}
function phaseDoneLabel(unit){if(turnPhase==='fire'&&!unit.fired)return 'NO TARGET';return turnPhase==='movement'?'MOVEMENT DONE':turnPhase==='fire'?'FIRE DONE':turnPhase==='gev'?'SECOND MOVE DONE':'DONE'}function showPhaseTransition(label){const overlay=$('#phase-transition'),title=$('#phase-transition-title');if(!overlay||!title)return;title.textContent=label;overlay.classList.add('show');clearTimeout(window.phaseTransitionTimer);window.phaseTransitionTimer=setTimeout(()=>overlay.classList.remove('show'),1000)}function updateRoster(){if(fullOwnsPresentation())return;const el=$('#unit-roster');el.innerHTML='';units.filter(u=>u.team==='player').forEach(u=>{const card=document.createElement('div');const covered=terrain.has(`${u.x},${u.y}`);const status=unitDead(u)?'DESTROYED':u.embarkedOn?'EMBARKED':u.disabled?'DISABLED':phaseCanAct(u)?(covered?'COVERED · '+u.type:u.type):phaseDoneLabel(u);card.className=`unit-card ${u.id==='ogre'?'ogre':''} ${u===selected?'active':''} ${!phaseCanAct(u)&&unitAlive(u)?'acted':''} ${unitDead(u)?'destroyed':''} ${covered&&unitAlive(u)?'covered':''}`;card.innerHTML=`<div class="unit-token">${unitDead(u)?'×':u.icon}</div><div><span class="unit-name">${u.name}</span><span class="unit-type">${status}</span></div><div class="hp-bar">${Array.from({length:u.maxHp},(_,i)=>`<i class="${i>=u.hp?'off':''}"></i>`).join('')}</div>`;card.onclick=()=>{if(unitAlive(u))selectPlayerUnit(u)};el.appendChild(card)});$('#force-count').textContent=String(units.filter(u=>u.team==='player'&&unitAlive(u)).length).padStart(2,'0');const active=units.filter(u=>u.team==='player'&&unitAlive(u)&&!u.disabled),counts={movement:active.filter(u=>phaseCanAct(u,'movement')).length,fire:active.filter(u=>phaseCanAct(u,'fire')).length,gev:active.filter(u=>phaseCanAct(u,'gev')).length};[['movement','MOVE'],['fire','FIRE'],['gev','GEV']].forEach(([key,label])=>{const node=$(`#${key}-ready`);if(node){node.textContent=`${label} ${counts[key]}/${key==='gev'?Math.min(1,active.filter(isGevUnit).length):active.length}`;node.classList.toggle('active',turnPhase===key)}});const profile=victoryProfile(legacySession.effectiveRules),objective=objectiveSnapshot(profile,units);$('#objective-text').textContent=profile.requiresAllEnemies?`HOSTILES ${objective.remaining}/${objective.total}`:objective.remaining===0?'CORE OFFLINE':`CORE ${objective.remaining===1?'DISABLED':'OPERATIONAL'} · DAMAGE ${objective.total-objective.remaining}/${objective.total}`;$('#objective-progress').style.width=`${objective.progress}%`}function updateSelection(){if(fullOwnsPresentation())return;showCarrierCargo();const el=$('#selection-readout');if(!selected){clearUnitInfo();el.innerHTML='<span class="selection-icon">+</span><div><b>NO UNIT SELECTED</b><small>Wähle eine Einheit für Befehle</small></div>';return}const covered=terrain.has(`${selected.x},${selected.y}`),extra=turnPhase==='gev'&&isGevUnit(selected)?` · SECOND MOVE ${movementBudget(selected,true)}`:'',phaseState=selected.disabled?'DISABLED':phaseCanAct(selected)?'READY':phaseDoneLabel(selected);el.innerHTML=`<span class="selection-icon">${selected.icon}</span><div><b>${selected.name}${covered?' · COVERED':''}</b><small>HP ${selected.hp}/${selected.maxHp} · ${phaseState} · MOVE ${selected.move}${extra} · RANGE ${attackRange(selected)}</small></div>`}function setViewMode(mode){if(transportUnloadMode)return;viewMode=mode;document.querySelectorAll('.view-option:not(#grid-toggle)').forEach(button=>button.classList.toggle('active',button.dataset.view===mode));draw()}function updateAreaControls(){document.querySelectorAll('.view-option:not(#grid-toggle)').forEach(button=>{button.disabled=!!transportUnloadMode})}function setGridVisible(value){gridVisible=value;const button=$('#grid-toggle');if(button){button.classList.toggle('active',gridVisible);button.setAttribute('aria-pressed',String(gridVisible))}draw()}
function setToast(t){if(fullOwnsPresentation())return;const el=$('#map-toast');el.textContent=t;el.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.add('hidden'),1300)}
function updatePhaseControls(){const button=$('#end-turn');if(!button)return;button.innerHTML=turnPhase==='movement'?'NEXT: FIRE <span>↵</span>':turnPhase==='fire'?'NEXT: SKIMMER <span>↵</span>':'END TURN <span>↵</span>';button.title=turnPhase==='movement'?'Zur Feuerphase wechseln':turnPhase==='fire'?'Zum Skimmer-Manöver wechseln':'Gegnerzug starten';}function setTurnPhase(next){transportLoadMode=null;transportUnloadMode=null;turnPhase=next;if(next==='gev'&&selected&&!phaseCanAct(selected,'gev'))selected=null;if(next==='movement'||next==='gev')setViewMode('movement');if(next==='fire')setViewMode('fire');const labels={movement:'MOVEMENT PHASE',fire:'FIRE PHASE',gev:'SKIMMER MANEUVER',enemy:'HOSTILE PHASE'},hints={movement:'WÄHLE EINE EINHEIT ZUM BEWEGEN',fire:'WÄHLE EINE EINHEIT ZUM FEUERN',gev:globalThis.GoblinCatalogRuntime?.active()?(globalThis.GoblinLanguage?.t(`mission.${currentScenario}.budget`)||'Bewegungsbudget der gewählten Einheit beachten.'):currentScenario==='skimmer-pilot'?(globalThis.GoblinLanguage?.t('mission.skimmer-pilot.budget')||'Skimmer-Erprobung · 4 + 3'):'SKIMMER-MANÖVER: BIS ZU 2 FELDER'};$('#phase-title').textContent=labels[next]||'PLAYER PHASE';updatePhaseControls();if(hints[next])setToast(hints[next]);if(next!=='enemy'&&next!=='over')showPhaseTransition(labels[next]||'PLAYER PHASE');updateSelection();draw();if(next!=='enemy'&&next!=='over')setTimeout(maybeAutoAdvancePhase,1050);}function resetActionState(){units.forEach(u=>{u.moved=false;u.fired=false;u.secondMoved=false;u.acted=false})}
function canMoveUnit(unit,second=false){return unitAlive(unit)&&!unit.embarkedOn&&!unit.disabled&&unit.move>0&&(second?isGevUnit(unit)&&!unit.secondMoved:!unit.moved)}
function resetActionState(){units.forEach(u=>{u.moved=false;u.fired=false;u.secondMoved=false;u.acted=false;u.embarkedThisTurn=false;u.disembarkedThisTurn=false})}
function unloadAt(carrier,cargo,x,y){if(!canUnloadTo(carrier,cargo,x,y)){setToast('AUSLADEN NICHT MÖGLICH');return}transportUnloadMode=null;cargo.embarkedOn=null;cargo.embarkedThisTurn=false;cargo.disembarkedThisTurn=true;cargo.x=x;cargo.y=y;cargo.moved=true;cargo.acted=true;addLog(cargo.name+' verlässt '+carrier.name+'.');setToast('EINHEIT AUSGESCHIFFT');selected=carrier;updateSelection();draw();maybeAutoAdvancePhase()}
function showCarrierCargo(){if(fullOwnsPresentation())return;const panel=document.querySelector('#carrier-cargo');if(!panel)return;updateAreaControls();const carrier=selected?.transportCapacity?selected:selected?.embarkedOn?units.find(u=>u.id===selected.embarkedOn):null;if(!carrier){panel.classList.add('hidden');panel.innerHTML='';return}const cargo=carrierCargo(carrier);panel.classList.remove('hidden');panel.innerHTML='<span class="carrier-cargo-label">'+carrier.name+' - CARGO '+carrierLoad(carrier)+'/'+carrier.transportCapacity+'</span>';cargo.forEach(unit=>{const button=document.createElement('button');button.className='cargo-slot';button.title=turnPhase==='fire'?unit.name+' zum Feuern wählen':unit.name+' ausladen';button.textContent=unit.icon;button.classList.toggle('active',selected===unit);button.addEventListener('click',event=>{event.stopPropagation();if(turnPhase==='fire'){selected=unit;focusedCell={x:carrier.x,y:carrier.y};showUnitInfo(unit);showFieldInfo(carrier.x,carrier.y);setToast(unit.fired?'PASSAGIER HAT BEREITS GEFEUERT':unit.name+' FEUERBEREIT');updateSelection();draw()}else activateUnloadMode(carrier,unit)});panel.appendChild(button)});if(turnPhase==='movement'&&carrierLoad(carrier)<carrier.transportCapacity){const button=document.createElement('button');button.className='cargo-slot transport-slot';button.title='Verladbare Einheit auswählen';button.textContent='+';button.addEventListener('click',event=>{event.stopPropagation();activateLoadMode(carrier)});panel.appendChild(button)}}
function applyCombatRoll(attacker,target,roll){const ratio=combatRatio(attacker.damage,effectiveDefense(target)),band=COMBAT_RULES.crt[ratio],result=ratio==='5-1'?'X':band[roll];if(result==='D'){if(target.infantry===true||target.engineering===true||target.id==='infantry')target.hp=Math.max(0,target.hp-1);else if(target.disabled)target.hp=0;else {target.disabled=true;target.disabledUntil=turn+(attacker.team==='enemy'?2:1)}}if(result==='X')target.hp=0;target.lastOutcome=result;return {ratio,result}}
function combatRandom(){return globalThis.GoblinCatalogFullRuntime?.missionRandom?.()??Math.random()}
function combatOutcome(attacker,target){const roll=Math.floor(combatRandom()*6),outcome=applyCombatRoll(attacker,target,roll),passengers=carrierCargo(target).map(unit=>({unit,outcome:applyCombatRoll(attacker,unit,roll)}));if(unitDead(target))passengers.forEach(({unit})=>{if(unitAlive(unit)){unit.embarkedOn=null;unit.embarkedThisTurn=false;unit.disembarkedThisTurn=true;unit.x=target.x;unit.y=target.y;unit.moved=true}});return {...outcome,roll,passengers}}
function reportPassengerHits(attacker,outcome,hostile=false){outcome.passengers.forEach(({unit,outcome:hit})=>{const text=hit.result==='X'||unitDead(unit)?'AUSGESCHALTET':hit.result==='D'?'GETROFFEN':'KEIN EFFEKT';addLog(`${attacker.name}: Mitfahrer ${unit.name} ${hit.result} bei ${hit.ratio} — ${text}.`,hostile)})}
function attack(attacker,target){if(attacker.disabled){setToast(`${attacker.name} IST DEAKTIVIERT`);return}if(target.team==='enemy'&&!lineOfSight(attacker,target)){setToast('SICHTLINIE BLOCKIERT');return}if(attacker.team==='player'&&(turnPhase!=='fire'||attacker.fired)){setToast('FEUERPHASE ODER EINHEIT BEREITS VERBRAUCHT');return}attacker.acted=true;if(attacker.team==='player')attacker.fired=true;const outcome=combatOutcome(attacker,target);target.lastOutcome=outcome.result;target.justHit=true;const resultText=outcome.result==='X'?'ZIEL AUSGESCHALTET':outcome.result==='D'?'ZIEL DEAKTIVIERT':'KEIN EFFEKT';addLog(`${attacker.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${resultText}.`);reportPassengerHits(attacker,outcome);setToast(resultText);selected=null;updateSelection();draw();setTimeout(()=>{target.justHit=false;draw()},560);if(checkVictory())return;maybeAutoAdvancePhase()}
function enemyFire(foe){if(unitDead(foe)||foe.disabled)return false;const targets=units.filter(u=>u.team==='player'&&unitAlive(u)&&!u.embarkedOn).sort((a,b)=>dist(foe,a)-dist(foe,b));const target=targets.find(u=>dist(foe,u)<=foe.range&&lineOfSight(foe,u));if(!target)return false;const outcome=combatOutcome(foe,target);target.justHit=true;addLog(`${foe.name} feuert auf ${target.name}: ${outcome.result} bei ${outcome.ratio} — ${outcome.result==='X'?'ZIEL AUSGESCHALTET':outcome.result==='D'?'ZIEL DEAKTIVIERT':'KEIN EFFEKT'}.`,true);reportPassengerHits(foe,outcome,true);setTimeout(()=>{target.justHit=false;draw()},560);return true}
function updateRoster(){if(fullOwnsPresentation())return;const el=$('#unit-roster');el.innerHTML='';units.filter(u=>u.team==='player').forEach(u=>{const card=document.createElement('div'),covered=!u.embarkedOn&&terrain.has(`${u.x},${u.y}`),carrier=u.embarkedOn?units.find(item=>item.id===u.embarkedOn):null,actionStatus=phaseCanAct(u)?(covered?'COVERED · '+u.type:u.type):phaseDoneLabel(u);const status=unitDead(u)?'DESTROYED':u.embarkedOn?'EMBARKED · '+(carrier?.name||'TRANSPORT'):u.disabled?'DISABLED':u.transportCapacity?'CARGO '+carrierLoad(u)+'/'+u.transportCapacity+' · '+actionStatus:actionStatus;card.className=`unit-card ${u.id==='ogre'?'ogre':''} ${u===selected?'active':''} ${!phaseCanAct(u)&&unitAlive(u)?'acted':''} ${unitDead(u)?'destroyed':''} ${covered&&unitAlive(u)?'covered':''}`;card.innerHTML=`<div class="unit-token">${unitDead(u)?'×':u.icon}</div><div><span class="unit-name">${u.name}</span><span class="unit-type">${status}</span></div><div class="hp-bar">${Array.from({length:u.maxHp},(_,i)=>`<i class="${i>=u.hp?'off':''}"></i>`).join('')}</div>`;card.onclick=()=>{if(unitAlive(u))selectPlayerUnit(u)};el.appendChild(card)});$('#force-count').textContent=String(units.filter(u=>u.team==='player'&&unitAlive(u)).length).padStart(2,'0');const active=units.filter(u=>u.team==='player'&&unitAlive(u)&&!u.disabled),counts={movement:active.filter(u=>phaseCanAct(u,'movement')).length,fire:active.filter(u=>phaseCanAct(u,'fire')).length,gev:active.filter(u=>phaseCanAct(u,'gev')).length};[['movement','MOVE'],['fire','FIRE'],['gev','SKIMMER']].forEach(([key,label])=>{const node=$(`#${key}-ready`);if(node){const eligible=key==='movement'?active.filter(u=>!u.embarkedOn).length:key==='gev'?active.filter(u=>!u.embarkedOn&&isGevUnit(u)).length:active.length;node.textContent=`${label} ${counts[key]}/${eligible}`;node.classList.toggle('active',turnPhase===key)}});const profile=victoryProfile(legacySession.effectiveRules),objective=objectiveSnapshot(profile,units);$('#objective-text').textContent=profile.requiresAllEnemies?`HOSTILES ${objective.remaining}/${objective.total}`:objective.remaining===0?'CORE OFFLINE':`CORE ${objective.remaining===1?'DISABLED':'OPERATIONAL'} · DAMAGE ${objective.total-objective.remaining}/${objective.total}`;$('#objective-progress').style.width=`${objective.progress}%`}
function phaseReadyForEnemy(){const active=units.filter(u=>u.team==='player'&&unitAlive(u)&&!u.disabled),gevs=active.filter(isGevUnit);return active.every(u=>u.fired)&&gevs.every(u=>u.secondMoved)}function finish(win){gameOver=true;phase='over';turnPhase='over';const result=win?'MISSION COMPLETE':'MISSION FAILED';$('#phase-title').textContent=result;$('#log-status').textContent=win?'SUCCESS':'CRITICAL';$('#end-turn').disabled=true;addLog(`${result} — COMBAT LOG AVAILABLE`);setToast(`${result} · KAMPFBERICHT VERFÜGBAR`);updateSelection();draw()}function reset(){loadScenario(currentScenario)}
if(!bootProfileError){
function advanceNativePlayerPhase() {
  if (globalThis.GoblinCatalogFullRuntime?.allowsPlayerPhaseAdvance?.()===false) return;
  if (turnPhase==='movement') setTurnPhase('fire');
  else if (turnPhase==='fire') setTurnPhase('gev');
  else if (turnPhase==='gev') startEnemyTurn();
}
$('#end-turn').onclick=()=>{
  if(gameOver||phase!=='player')return;
  const full=globalThis.GoblinCatalogFullRuntime;
  const mapPort=full?.mapPort?.();
  if(mapPort){
    const seat=mapPort.state();
    if(!seat?.humanReady)return;
    confirmPhaseAdvance(()=>{
      if(full.mapPort()===mapPort&&mapPort.state()?.generation===seat.generation)
        globalThis.GoblinV2Flow?.commitFullMap({type:'EndPhase'});
    });
  }
  else if(!full?.controllerPort?.())confirmPhaseAdvance(advanceNativePlayerPhase);
};$('#grid-toggle').onclick=()=>setGridVisible(!gridVisible);$('#reset-game').onclick=reset;document.querySelectorAll('.view-option:not(#grid-toggle)').forEach(button=>button.onclick=()=>setViewMode(button.dataset.view));document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;transportLoadMode=null;transportUnloadMode=null;updateSelection();draw()}if(e.key.toLowerCase()==='f'&&turnPhase==='fire'&&selected){const target=(globalThis.GoblinCatalogFullRuntime?.active()?GoblinCatalogFullRuntime.roster():units).find(u=>u.team==='enemy'&&unitAlive(u)&&dist(selected,u)<=attackRange(selected)&&lineOfSight(selected,u)&&weaponTargetAllowed(selected,u));if(target)attack(selected,target)}});addLog('Mission online. Awaiting command.');updatePhaseControls();draw();
}
