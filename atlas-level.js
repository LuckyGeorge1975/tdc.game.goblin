// The content JSON owns the map and placements; specialist unit values remain
// provisional until their complete individual abilities are implemented.
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
      visualKey:entry.assetId,name:entry.name,type,team:entry.team,x:entry.x,y:entry.y,
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
    if(level.width!==W||level.height!==H||level.units.length!==26)throw new Error('ATLAS map dimensions or unit count invalid');
    const positions=new Set();
    for(const unit of level.units){
      if(!stats[unit.assetId]||!['player','enemy'].includes(unit.team)||unit.x<0||unit.x>=W||unit.y<0||unit.y>=H)throw new Error('ATLAS unit invalid');
      const key=`${unit.x},${unit.y}`;if(positions.has(key))throw new Error(`ATLAS duplicate position: ${key}`);positions.add(key);
    }
    for(const cell of level.terrain){if(!TerrainRules.rules[cell.type]||cell.x<0||cell.x>=W||cell.y<0||cell.y>=H)throw new Error('ATLAS terrain invalid')}
  }
  const baseUpdateRoster=updateRoster;
  updateRoster=function(){
    baseUpdateRoster();
    if(currentScenario!=='atlas-proving-grounds')return;
    const enemies=units.filter(unit=>unit.team==='enemy'),remaining=enemies.filter(unit=>unit.hp>0).length;
    $('#objective-text').textContent=`HOSTILES ${remaining}/${enemies.length}`;
    $('#objective-progress').style.width=`${Math.round((enemies.length-remaining)/enemies.length*100)}%`;
  };
  fetch('assets/unit-art/levels/atlas-proving-grounds.json')
    .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json()})
    .then(level=>{
      validateLevel(level);
      scenarioCatalog[level.id]={
        kicker:'MISSION 10 / ATLAS PROVING GROUNDS',title:'ATLAS / Proving Grounds',
        sub:'Regel-Prototyp: Schalte alle feindlichen Einheiten einschließlich Command Core aus.',
        objective:'core-and-escort',
        terrain:level.terrain.filter(cell=>TerrainRules.coverBonus(cell.type)>0).map(cell=>`${cell.x},${cell.y}`),
        terrainTypes:level.terrain,units:level.units.map(makeUnit)
      };
      const option=document.createElement('option');option.value=level.id;option.textContent='ATLAS / PROVING GROUNDS';
      $('#scenario-select').appendChild(option);
      if(globalThis.location?.search&&new URLSearchParams(globalThis.location.search).get('scenario')===level.id){
        loadScenario(level.id);
        $('#scenario-select').value=level.id;
      }
    })
    .catch(error=>{console.error('ATLAS level unavailable:',error);addLog('ATLAS-Level konnte nicht geladen werden.',true)});
})();
