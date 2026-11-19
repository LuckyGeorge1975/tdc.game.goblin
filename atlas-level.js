// The content JSON files own ATLAS and the smaller showcase maps and placements.
// The versioned register keeps live Field Test values separate from the inactive target profile.
(function(){
  const historicalPresentation={
    "atlas-proving-grounds":{"schemaVersion":1,"id":"atlas-proving-grounds","title":"ATLAS / PROVING GROUNDS","description":"Content-Showcase auf 12 × 8 Hexfeldern: jeder Terrain-Typ und jeder aktuelle Asset-Typ ist mindestens einmal zu sehen. Die erweiterten Geländeregeln und mehrere Einheiten sind noch nicht vollständig implementiert.","width":12,"height":8,"defaultTerrain":"open-ground","objectiveDraft":"Sichere den Command Core und halte den Relay Node. Das Missionsziel ist ein Designvorschlag, noch keine Spielregel.","names":{"goblin-siegebreaker":"GOBLIN SIEGEBREAKER","skimmer-scout":"SKIMMER SCOUT","rocket-artillery":"ROCKET ARTILLERY","infantry-squad":"INFANTRY SQUAD","assault-tank":"ASSAULT TANK","recon-tank":"RECON TANK","siege-tank":"SIEGE TANK","long-range-battery":"LONG-RANGE BATTERY","mobile-siege-gun":"MOBILE SIEGE GUN","combat-skimmer":"COMBAT SKIMMER","light-skimmer":"LIGHT SKIMMER","skimmer-carrier":"SKIMMER CARRIER","strategic-missile-carrier":"STRATEGIC MISSILE CARRIER","artillery-drone":"ARTILLERY DRONE","amphibious-infantry":"AMPHIBIOUS INFANTRY","field-engineers":"FIELD ENGINEERS","local-defense":"LOCAL DEFENSE","forge-engineer":"FORGE ENGINEER","command-hub":"COMMAND HUB","goblin-dreadnaught":"GOBLIN DREADNAUGHT","phantom-platform":"PHANTOM PLATFORM","infantry-platoon":"INFANTRY PLATOON","command-core":"COMMAND CORE","relay-node":"RELAY NODE","guard-tank":"GUARD TANK","raider-skimmer":"RAIDER SKIMMER"}},
    "showcase-terrain-course":{"schemaVersion":1,"id":"showcase-terrain-course","title":"TERRAIN COURSE","kicker":"SHOWCASE 01 / TERRAIN COURSE","objective":"core-and-escort","width":12,"height":8,"defaultTerrain":"open-ground"},
    "showcase-advance":{"schemaVersion":1,"id":"showcase-advance","title":"ADVANCE","kicker":"SHOWCASE 02 / ADVANCE","objective":"core-and-escort","width":12,"height":8,"defaultTerrain":"open-ground"},
    "showcase-siege":{"schemaVersion":1,"id":"showcase-siege","title":"SIEGE AND TRANSPORT","kicker":"SHOWCASE 03 / SIEGE AND TRANSPORT","objective":"core-and-escort","width":12,"height":8,"defaultTerrain":"open-ground"},
    "showcase-specialists":{"schemaVersion":1,"id":"showcase-specialists","title":"SPECIALISTS","kicker":"SHOWCASE 04 / SPECIALISTS","objective":"core-and-escort","width":12,"height":8,"defaultTerrain":"open-ground"},
    "los-supercover-showcase":{"schemaVersion":1,"id":"los-supercover-showcase","scenarioVersion":1,"ruleProfileId":"FIELD_TEST_SUPERCOVER_v1","title":"SUPERCOVER / Boundary Line","kicker":"SHOWCASE 05 / SUPERCOVER","objective":"core-and-escort","width":12,"height":8,"defaultTerrain":"open-ground"}
  };
  let profile;
  const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
    Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
  function historicalShape(level){
    if(level?.version!=='goblin-level-v3')return level;
    const fail=()=>{throw new Error('Showcase level schema invalid')};
    if(!exact(level,['version','id','scenarioVersion','width','height','ruleProfile','objective','terrain','units'])||
      !Object.hasOwn(historicalPresentation,level.id)||level.width!==W||level.height!==H||
      !Array.isArray(level.terrain)||!Array.isArray(level.units))fail();
    const {names,...source}=historicalPresentation[level.id],rules=ScenarioRuleProfiles.entries[level.id];
    if(level.scenarioVersion!==rules.scenarioVersion||level.ruleProfile!==rules.ruleProfileId||level.objective!==rules.objective||
      !level.terrain.every(cell=>exact(cell,['x','y','type'])))fail();
    const units=level.units.map(unit=>{
      if(!exact(unit,['id','assetId','team','x','y'])||!Object.hasOwn(profile.units,unit.assetId))fail();
      const {id,assetId,team,x,y}=unit;
      if(id!==(assetId==='command-core'?'core':assetId==='goblin-siegebreaker'?'ogre':assetId))fail();
      return {assetId,...(names?{name:names[assetId]}:{}),team,x,y};
    });
    return {...source,terrain:level.terrain,units};
  }
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
  const normalizeLevel = level => ({...level,
    scenarioVersion:level.scenarioVersion??1,
    ruleProfileId:level.ruleProfileId??'FIELD_TEST_LEGACY_v1'});
  function validateLevel(level){
    level=normalizeLevel(level);
    const {losMode}=ScenarioRuleProfiles.entries[level.id]??{};
    ScenarioRuleProfiles.validate(level.id,{...level,
      ...(losMode?{losMode}:{}),
      objectiveVersion:level.schemaVersion,
      ruleProfile:profile.legacyProfile});
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
  function register(level, bakeSourceLevel=level){
    const sourceLevel=bakeSourceLevel;
    level=normalizeLevel(level);
    validateLevel(level);
    const {losMode}=ScenarioRuleProfiles.entries[level.id];
    if(scenarioCatalog[level.id])throw new Error(`Duplicate scenario: ${level.id}`);
    scenarioCatalog[level.id]={
      kicker:level.kicker,title:level.title,
      sub:'Feindlichen Kern und alle übrigen Gegner ausschalten; eigene Einheit erhalten.',
      objectiveVersion:level.schemaVersion,objective:level.objective,scenarioVersion:level.scenarioVersion,
      ruleProfileId:level.ruleProfileId,ruleProfile:profile.legacyProfile,
      ...(losMode?{losMode}:{}),
      showAllEnemiesProgress:true,
      terrain:level.terrain.filter(cell=>TerrainRules.coverBonus(cell.type)>0).map(cell=>`${cell.x},${cell.y}`),
      terrainTypes:level.terrain,units:level.units.map(makeUnit),
      ...(['showcase-terrain-course','showcase-specialists','atlas-proving-grounds','showcase-siege','los-supercover-showcase'].includes(level.id)?{bakeLevel:sourceLevel}:{})
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
    if(globalThis.goblinBootProfileError)return;
    if (['v2',null].includes(new URLSearchParams(globalThis.location?.search||'').get('ui'))) return;
    try{
      const response=await fetch('assets/unit-art/rules/unit-profiles.v1.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      profile=validateProfile(await response.json());
    }catch(error){console.error('Unit rule profile unavailable:',error);addLog('Einheiten-Regelprofil konnte nicht geladen werden.',true);return}
    try{
      const response=await fetch('assets/unit-art/levels/artillery-pilot.v3.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const config=GoblinArtilleryPilot.create(await response.json(),profile);
      ScenarioRuleProfiles.validate('artillery-pilot',config);
      scenarioCatalog['artillery-pilot']=config;
      const option=document.createElement('option');option.value='artillery-pilot';option.textContent=config.title;option.dataset.titleKey='mission.artillery-pilot.title';
      $('#scenario-select').appendChild(option);renderScenarioObjective();
      if(new URLSearchParams(globalThis.location?.search||'').get('scenario')==='artillery-pilot')loadScenario('artillery-pilot');
    }catch(error){console.error('Artillery pilot unavailable:',error)}
    try{
      const response=await fetch('assets/unit-art/levels/siege-pilot.v3.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const config=GoblinSiegePilot.create(await response.json(),profile);
      ScenarioRuleProfiles.validate('siege-pilot',config);
      scenarioCatalog['siege-pilot']=config;
      const option=document.createElement('option');option.value='siege-pilot';option.textContent=config.title;option.dataset.titleKey='mission.siege-pilot.title';
      $('#scenario-select').appendChild(option);renderScenarioObjective();
      if(new URLSearchParams(globalThis.location?.search||'').get('scenario')==='siege-pilot')loadScenario('siege-pilot');
    }catch(error){console.error('Siege pilot unavailable:',error)}
    try{
      const response=await fetch('assets/unit-art/levels/skimmer-pilot.v3.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const config=GoblinSkimmerPilot.create(await response.json(),profile);
      ScenarioRuleProfiles.validate('skimmer-pilot',config);
      scenarioCatalog['skimmer-pilot']=config;
      const option=document.createElement('option');option.value='skimmer-pilot';option.textContent=config.title;option.dataset.titleKey='mission.skimmer-pilot.title';
      $('#scenario-select').appendChild(option);renderScenarioObjective();
      if(new URLSearchParams(globalThis.location?.search||'').get('scenario')==='skimmer-pilot')loadScenario('skimmer-pilot');
    }catch(error){console.error('Skimmer pilot unavailable:',error)}
    try{
      const response=await fetch('assets/unit-art/levels/atlas-proving-grounds.v3.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const author=await response.json(),level=historicalShape(author);
      const objective=author.version==='goblin-level-v3'?author.objective:ScenarioRuleProfiles.entries[level.id].objective;
      register({...level,kicker:'MISSION 10 / ATLAS PROVING GROUNDS',title:'ATLAS / Proving Grounds',objective},level);
    }catch(error){console.error('ATLAS level unavailable:',error);addLog(`ATLAS-Level konnte nicht geladen werden: ${error.message}`,true)}
    try{
      const response=await fetch('assets/unit-art/levels/showcase-levels.v3.json');
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const source=await response.json();
      const bundle=source?.version==='goblin-level-package-v3'&&exact(source,['version','levels'])&&Array.isArray(source.levels)
        ? {schemaVersion:1,levels:source.levels.map(historicalShape)} : source;
      if(bundle.schemaVersion!==1||!Array.isArray(bundle.levels)||bundle.levels.length!==5)throw new Error('Showcase bundle schema invalid');
      const expected=['showcase-terrain-course','showcase-advance','showcase-siege','showcase-specialists','los-supercover-showcase'];
      if(expected.some((id,index)=>bundle.levels[index]?.id!==id))throw new Error('Showcase level IDs invalid');
      for(const level of bundle.levels)validateLevel(level);
      for(const level of bundle.levels)register(level);
    }catch(error){console.error('Showcase levels unavailable:',error);addLog(`Showcase-Level konnten nicht geladen werden: ${error.message}`,true)}
  })();
})();
