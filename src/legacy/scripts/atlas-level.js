// The content JSON files own ATLAS and the smaller showcase maps and placements.
// Specialist values remain provisional until their individual rules are implemented.
(function(){
  const stats={
    'goblin-siegebreaker':[5,5,2,3,3,'G','HEAVY ASSAULT'],
    'skimmer-scout':[3,3,3,3,1,'S','HOVERCRAFT'],
    'rocket-artillery':[3,3,4,1,2,'M','ARTILLERY'],
    'infantry-squad':[2,2,1,2,1,'I','INFANTRY'],
    'assault-tank':[3,3,2,3,4,'A','FRONTLINE ARMOR'],
    'recon-tank':[2,2,2,3,2,'R','SCOUT ARMOR'],
    'siege-tank':[5,5,3,3,6,'S','SIEGE ARMOR'],
    'long-range-battery':[2,2,6,0,3,'B','FIXED ARTILLERY'],
    'mobile-siege-gun':[3,3,4,1,3,'M','MOBILE ARTILLERY'],
    'combat-skimmer':[2,2,2,3,2,'C','HOVERCRAFT'],
    'light-skimmer':[1,1,2,3,1,'L','HOVERCRAFT'],
    'skimmer-carrier':[2,2,2,3,1,'P','PERSONNEL CARRIER'],
    'strategic-missile-carrier':[2,2,8,1,6,'C','MISSILE PLATFORM'],
    'artillery-drone':[2,2,4,2,2,'D','ARTILLERY DRONE'],
    'amphibious-infantry':[2,2,1,2,1,'I','AMPHIBIOUS INFANTRY'],
    'field-engineers':[2,2,1,2,2,'E','FIELD ENGINEERING'],
    'local-defense':[2,2,2,0,2,'L','STATIC DEFENSE'],
    'forge-engineer':[2,2,1,2,2,'F','FIELD ENGINEERING'],
    'command-hub':[5,5,0,0,0,'H','FORTIFIED TARGET'],
    'goblin-dreadnaught':[6,6,3,2,4,'G','HEAVY ASSAULT'],
    'phantom-platform':[3,3,3,2,2,'P','MOBILE PLATFORM'],
    'infantry-platoon':[2,2,1,2,1,'I','INFANTRY'],
    'command-core':[5,5,0,0,0,'X','FORTIFIED TARGET'],
    'relay-node':[4,4,0,0,0,'R','FORTIFIED TARGET'],
    'guard-tank':[3,3,2,1,1,'G','HOSTILE ARMOR'],
    'raider-skimmer':[2,2,2,2,1,'R','HOVERCRAFT']
  };
  function makeUnit(entry){
    const [hp,defense,range,move,damage,icon,type]=stats[entry.assetId];
    const unit={id:entry.assetId==='goblin-siegebreaker'?'ogre':entry.assetId==='command-core'?'core':entry.assetId,
      visualKey:entry.assetId,name:entry.name||entry.assetId.replaceAll('-',' ').toUpperCase(),type,team:entry.team,x:entry.x,y:entry.y,
      hp,maxHp:hp,defense,range,move,damage,icon};
    if(entry.assetId==='goblin-siegebreaker')unit.ogreSystems=GoblinSystems.createMarkIII();
    if(entry.assetId==='command-core')unit.core=true;
    if(['infantry-squad','amphibious-infantry','infantry-platoon','field-engineers','forge-engineer'].includes(entry.assetId))unit.infantry=true;
    if(['field-engineers','forge-engineer'].includes(entry.assetId))unit.engineering=true;
    if(entry.assetId==='amphibious-infantry')unit.amphibious=true;
    if(['skimmer-scout','combat-skimmer','light-skimmer','skimmer-carrier','raider-skimmer'].includes(entry.assetId)){unit.gev=true;unit.movementMode='gev'}
    if(entry.assetId==='skimmer-carrier')unit.transportCapacity=3;
    if(entry.assetId==='strategic-missile-carrier'){unit.strategicMissile=true;unit.missilesRemaining=1}
    return unit;
  }
  function validateLevel(level){
    if(level.schemaVersion!==1||!/^[-a-z0-9]+$/.test(level.id||'')||!level.title?.trim()||!level.kicker?.trim()||level.width!==W||level.height!==H||
      level.defaultTerrain!=='open-ground'||level.objective!=='core-and-escort'||
      !Array.isArray(level.units)||!Array.isArray(level.terrain)||level.units.length<2)throw new Error('Showcase level schema invalid');
    const positions=new Set(),assetIds=new Set(),teams=new Set();
    for(const unit of level.units){
      if(!stats[unit.assetId]||!['player','enemy'].includes(unit.team)||!Number.isInteger(unit.x)||!Number.isInteger(unit.y)||unit.x<0||unit.x>=W||unit.y<0||unit.y>=H)throw new Error(`${level.id}: unit invalid`);
      const key=`${unit.x},${unit.y}`;if(positions.has(key)||assetIds.has(unit.assetId))throw new Error(`${level.id}: duplicate unit or position: ${key}`);
      positions.add(key);assetIds.add(unit.assetId);teams.add(unit.team);
    }
    if(teams.size!==2||level.units.filter(unit=>unit.assetId==='command-core'&&unit.team==='enemy').length!==1)throw new Error(`${level.id}: enemy command core and both teams required`);
    const terrainCells=new Map();
    for(const cell of level.terrain){
      if(!TerrainRules.rules[cell.type]||!Number.isInteger(cell.x)||!Number.isInteger(cell.y)||cell.x<0||cell.x>=W||cell.y<0||cell.y>=H)throw new Error(`${level.id}: terrain invalid`);
      const key=`${cell.x},${cell.y}`;if(terrainCells.has(key))throw new Error(`${level.id}: duplicate terrain: ${key}`);
      terrainCells.set(key,cell.type);
    }
    for(const entry of level.units){
      const unit=makeUnit(entry),type=terrainCells.get(`${entry.x},${entry.y}`)||level.defaultTerrain;
      if(unit.move>0&&!Number.isFinite(TerrainRules.movementCost(type,unit)))throw new Error(`${level.id}: impassable start for ${entry.assetId}`);
    }
  }
  const baseUpdateRoster=updateRoster;
  updateRoster=function(){
    baseUpdateRoster();
    if(!scenarioCatalog[currentScenario]?.showAllEnemiesProgress)return;
    const enemies=units.filter(unit=>unit.team==='enemy'),remaining=enemies.filter(unit=>unit.hp>0).length;
    $('#objective-text').textContent=`HOSTILES ${remaining}/${enemies.length}`;
    $('#objective-progress').style.width=`${Math.round((enemies.length-remaining)/enemies.length*100)}%`;
  };
  function register(level){
    validateLevel(level);
    if(level.id==='los-supercover-showcase'){
      if(level.scenarioVersion!==1||level.ruleProfileId!=='FIELD_TEST_SUPERCOVER_v1')throw new Error('Supercover scenario profile invalid');
    }else if(level.ruleProfileId||level.scenarioVersion)throw new Error('Legacy scenario profile changed');
    if(scenarioCatalog[level.id])throw new Error(`Duplicate scenario: ${level.id}`);
    scenarioCatalog[level.id]={
      kicker:level.kicker,title:level.title,
      sub:'Feindlichen Kern und alle übrigen Gegner ausschalten; eigene Einheit erhalten.',
      objective:level.objective,showAllEnemiesProgress:true,
      scenarioVersion:level.scenarioVersion||1,ruleProfileId:level.ruleProfileId||'FIELD_TEST_LEGACY_v1',
      terrain:level.terrain.filter(cell=>TerrainRules.coverBonus(cell.type)>0).map(cell=>`${cell.x},${cell.y}`),
      terrainTypes:level.terrain,units:level.units.map(makeUnit)
    };
    const option=document.createElement('option');option.value=level.id;option.textContent=level.title;
    option.dataset.titleKey=`mission.${level.id}.title`;
    $('#scenario-select').appendChild(option);
    renderScenarioObjective();
    if(globalThis.location?.search&&new URLSearchParams(globalThis.location.search).get('scenario')===level.id){
      loadScenario(level.id);
      $('#scenario-select').value=level.id;
    }
  }
  (async()=>{
    try{
      const response=await fetch('assets/unit-art/levels/atlas-proving-grounds.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const level=await response.json();
      register({...level,kicker:'MISSION 10 / ATLAS PROVING GROUNDS',title:'ATLAS / Proving Grounds',objective:'core-and-escort'});
    }catch(error){console.error('ATLAS level unavailable:',error);addLog('ATLAS-Level konnte nicht geladen werden.',true)}
    try{
      const response=await fetch('assets/unit-art/levels/showcase-levels.json?showcase=supercover-v1');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bundle=await response.json();
      if(bundle.schemaVersion!==1||!Array.isArray(bundle.levels)||bundle.levels.length!==5)throw new Error('Showcase bundle schema invalid');
      const expected=['showcase-terrain-course','showcase-advance','showcase-siege','showcase-specialists','los-supercover-showcase'];
      if(expected.some((id,index)=>bundle.levels[index]?.id!==id))throw new Error('Showcase level IDs invalid');
      for(const level of bundle.levels)validateLevel(level);
      for(const level of bundle.levels)register(level);
    }catch(error){console.error('Showcase levels unavailable:',error);addLog('Showcase-Level konnten nicht geladen werden.',true)}
  })();
})();
