// The content JSON files own ATLAS and the smaller showcase maps and placements.
// The versioned register keeps live Field Test values separate from the inactive target profile.
(function(){
  let profile;
  function validateProfile(value){
    if(value?.schemaVersion!==1||value.legacyProfile!=='field-test-atlas-v1'||value.targetProfile!=='full-catalog-v1-draft'||value.targetActive!==false||
      !value.units||Object.keys(value.units).length!==26)throw new Error('Unit rule profile invalid');
    for(const [id,record] of Object.entries(value.units)){
      const stats=record?.legacy;
      if(!/^[-a-z0-9]+$/.test(id)||!Array.isArray(stats)||stats.length!==7||
        stats.slice(0,5).some(number=>!Number.isInteger(number)||number<0)||
        stats[0]<1||stats[1]<1||typeof stats[5]!=='string'||typeof stats[6]!=='string'||
        !record.target?.source)throw new Error(`Unit rule profile invalid: ${id}`);
    }
    return value;
  }
  function makeUnit(entry){
    const [hp,defense,range,move,damage,icon,type]=profile.units[entry.assetId].legacy;
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
    ScenarioRuleProfiles.validate(level.id,{...level,objectiveVersion:level.schemaVersion,
      ruleProfile:profile.legacyProfile,objective:level.id==='atlas-proving-grounds'?'core-and-escort':level.objective});
    if(level.schemaVersion!==1||!/^[-a-z0-9]+$/.test(level.id||'')||!level.title?.trim()||!level.kicker?.trim()||level.width!==W||level.height!==H||
      level.defaultTerrain!=='open-ground'||level.objective!=='core-and-escort'||
      !Array.isArray(level.units)||!Array.isArray(level.terrain)||level.units.length<2)throw new Error('Showcase level schema invalid');
    const positions=new Set(),assetIds=new Set(),teams=new Set();
    for(const unit of level.units){
      if(!profile.units[unit.assetId]||!['player','enemy'].includes(unit.team)||!Number.isInteger(unit.x)||!Number.isInteger(unit.y)||unit.x<0||unit.x>=W||unit.y<0||unit.y>=H)throw new Error(`${level.id}: unit invalid`);
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
  function register(level){
    validateLevel(level);
    if(scenarioCatalog[level.id])throw new Error(`Duplicate scenario: ${level.id}`);
    scenarioCatalog[level.id]={
      kicker:level.kicker,title:level.title,
      sub:'Feindlichen Kern und alle übrigen Gegner ausschalten; eigene Einheit erhalten.',
      objectiveVersion:level.schemaVersion,objective:level.objective,scenarioVersion:level.scenarioVersion,
      ruleProfileId:level.ruleProfileId,ruleProfile:profile.legacyProfile,showAllEnemiesProgress:true,
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
      const response=await fetch('assets/unit-art/rules/unit-profiles.v1.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      profile=validateProfile(await response.json());
    }catch(error){console.error('Unit rule profile unavailable:',error);addLog('Einheiten-Regelprofil konnte nicht geladen werden.',true);return}
    try{
      const response=await fetch('assets/unit-art/levels/atlas-proving-grounds.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const level=await response.json();
      register({...level,kicker:'MISSION 10 / ATLAS PROVING GROUNDS',title:'ATLAS / Proving Grounds',objective:'core-and-escort'});
    }catch(error){console.error('ATLAS level unavailable:',error);addLog(`ATLAS-Level konnte nicht geladen werden: ${error.message}`,true)}
    try{
      const response=await fetch('assets/unit-art/levels/showcase-levels.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const bundle=await response.json();
      if(bundle.schemaVersion!==1||!Array.isArray(bundle.levels)||bundle.levels.length!==4)throw new Error('Showcase bundle schema invalid');
      const expected=['showcase-terrain-course','showcase-advance','showcase-siege','showcase-specialists'];
      if(expected.some((id,index)=>bundle.levels[index]?.id!==id))throw new Error('Showcase level IDs invalid');
      for(const level of bundle.levels)validateLevel(level);
      for(const level of bundle.levels)register(level);
    }catch(error){console.error('Showcase levels unavailable:',error);addLog(`Showcase-Level konnten nicht geladen werden: ${error.message}`,true)}
  })();
})();
