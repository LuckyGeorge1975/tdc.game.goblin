// Approved A/B rules on the existing movement, CRT, history and presentation paths.
(function(root){
 const active=()=>!root.IronDustBrowserV2?.active&&(root.GoblinCatalogFullRuntime?.active()||legacySession?.ruleProfileId===GoblinCatalogBase.profile&&GoblinCatalogBase.has(legacySession.scenarioId)||legacySession?.ruleProfileId===root.GoblinCatalogSpecialistsModel?.profile&&root.GoblinCatalogSpecialistsModel?.has(legacySession.scenarioId));
 const fullActive=()=>root.GoblinCatalogFullRuntime?.active()===true;
 const record=u=>(active()||fullActive())?legacySession.effectiveRules.catalog?.records[u?.id]:null;
 const spec=u=>record(u)?.rules;
 const drone=u=>spec(u)?.cargoRef==='drone-cargo-v1';
 const carrier=u=>spec(u)?.cargoRef==='carrier-cargo-v1';
 const passenger=u=>spec(u)?.passengerRef==='infantry-passenger-v1';
 const bound=u=>!!u&&units.includes(u)&&!!record(u);
 const cargoDefinition=ref=>active()?legacySession.effectiveRules.catalog.cargo[ref]:null;
 const ready=u=>bound(u)&&unitAlive(u)&&!u.disabled;
 const pos=(x,y)=>Number.isInteger(x)&&x>=0&&x<W&&Number.isInteger(y)&&y>=0&&y<H;
 const text=(key,fallback=key,params={})=>{const value=root.GoblinLanguage?.t(key,params);return value&&value!==key?value:fallback};
 const name=u=>text(`library.unit.${record(u)?.assetId}.name`,u?.name??units.find(x=>x.id===u?.id)?.name??'');
 const keys={WRONG_PHASE:'v2.reject.phase',UNAVAILABLE:'v2.reject.unavailable',UNSUPPORTED_CARGO:'v2.reject.catalog.unsupportedCargo',CARGO_SPENT:'v2.reject.catalog.cargoNotReady',CARGO_CAPACITY:'v2.reject.catalog.capacity',DRONE_LOAD_BUDGET:'v2.reject.catalog.droneLoadBudget',CARGO_TURN:'v2.reject.catalog.sameTurn',DEPLOY_CELL:'v2.reject.catalog.deployCell',DRONE_DEPLOY_BUDGET:'v2.reject.catalog.droneDeployBudget',DRONE_LAND:'v2.reject.catalog.droneLand',DEPLOY_TERRAIN:'v2.reject.catalog.infantryTerrain',DRONE_NOT_READY:'v2.reject.catalog.droneNotReady',ABOARD_FIRE:'v2.reject.catalog.aboardFire',NO_WEAPON:'v2.reject.catalog.noWeapon',FIRE_SPENT:'v2.reject.spent',FIRE_TARGET:'v2.reject.target',INVALID_COMMAND:'ui.error.INVALID_COMMAND',INVALID_CARRIER:'v2.ui.embark',MOVE_SPENT:'ui.error.ACTION_SPENT',UNREACHABLE:'ui.error.UNREACHABLE'};
 const fail=(code,reason)=>({ok:false,code,reason:text(keys[code],reason,{capacity:3})});
 const ok=Object.freeze({ok:true});
 function loadQuery(cargo,c){
  if(phase!=='player'||gameOver||turnPhase!=='movement')return fail('WRONG_PHASE','Laden nur in der Bewegungsphase.');
  if(!ready(cargo)||!ready(c)||cargo.team!=='player'||c.team!==cargo.team||!carrier(c)||cargo===c)return fail('UNAVAILABLE','Aktive eigene Fracht und aktiven Transporter wählen.');
  if(!drone(cargo)&&!passenger(cargo))return fail('UNSUPPORTED_CARGO','Dieser Typ kann nicht eingeladen werden.');
  if(cargo.embarkedOn||cargo.moved||cargo.disembarkedThisTurn||dist(cargo,c)!==1)return fail('CARGO_SPENT','Fracht muss benachbart sein und ihre Bewegung noch besitzen; kein erneutes Laden nach Ausstieg.');
  const aboard=carrierCargo(c),cost=drone(cargo)?cargoDefinition(spec(cargo).cargoRef).cargoCost:cargo.hp;
  if(aboard.some(u=>drone(u))||drone(cargo)&&aboard.length||carrierLoad(c)+cost>c.transportCapacity)return fail('CARGO_CAPACITY','Kapazität: 3 SP Infanterie oder eine Drohne, keine Mischung.');
  if(drone(cargo)&&(cargo.fired||c.moved))return fail('DRONE_LOAD_BUDGET','Drohne benötigt unverbrauchte Bewegung und Feuer; Transporter benötigt Hauptbewegung.');
  return ok;
 }
 function unloadQuery(c,cargo,x,y){
  if(phase!=='player'||gameOver||turnPhase!=='movement')return fail('WRONG_PHASE','Aufstellen und Aussteigen nur in der Bewegungsphase.');
  if(!ready(c)||!ready(cargo)||c.team!=='player'||cargo.team!==c.team||!carrier(c)||cargo.embarkedOn!==c.id)return fail('UNAVAILABLE','Aktiven Transporter und aktive eigene Fracht wählen.');
  if(cargo.embarkedThisTurn||cargo.disembarkedThisTurn)return fail('CARGO_TURN','Nicht im selben Zug ein- und ausladen.');
  if(!pos(x,y)||dist(c,{x,y})!==1||units.some(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y))return fail('DEPLOY_CELL','Freies benachbartes Feld wählen.');
  if(drone(cargo)){
   if(c.moved)return fail('DRONE_DEPLOY_BUDGET','Aufstellen benötigt die Hauptbewegung des Transporters.');
   if(cargoDefinition(spec(c).cargoRef).droneDeployExcludedTerrain.includes(terrainTypeAt(x,y)))return fail('DRONE_LAND','Drohne nur auf Land oder einer Brücke aufstellen.');
  }else if(!passenger(cargo)||!Number.isFinite(movementCost(cargo,`${x},${y}`)))return fail('DEPLOY_TERRAIN','Für diese Infanterie unpassierbares Feld.');
  return ok;
 }
 function fireQuery(u,target){
  if(!ready(u)||u.team!=='player'||phase!=='player'||gameOver||turnPhase!=='fire')return fail('WRONG_PHASE','Aktive eigene Einheit in der Feuerphase wählen.');
  if(spec(u).fireRuleRef!=='single-fire-v1')return fail('NO_WEAPON','Keine Feueraktion in diesem Profil.');
  if(u.fired)return fail('FIRE_SPENT','Keine unverbrauchte Feueraktion.');
  if(drone(u)&&u.embarkedOn)return fail('ABOARD_FIRE','Diese Fracht kann an Bord nicht feuern.');
  if(drone(u)&&(u.droneReadyTurn??1)>turn)return fail('DRONE_NOT_READY','Drohne feuert frühestens im nächsten eigenen Zug.');
  if(u.embarkedOn&&!passenger(u))return fail('ABOARD_FIRE','Diese Fracht kann an Bord nicht feuern.');
  if(!target||unitDead(target)||target.embarkedOn||target.team===u.team||!bound(target)||dist(u,target)>spec(u).range||!lineOfSight(u,target))return fail('FIRE_TARGET','Ziel außerhalb der Reichweite oder ohne direkte Sicht.');
  return ok;
 }
 function query(command){
  if(!active())return null;
  if(!command||typeof command!=='object'||Array.isArray(command))return fail('INVALID_COMMAND','Ungültiger Befehl.');
  const fields={Move:['type','actorId','x','y'],Fire:['type','actorId','x','y'],Embark:['type','actorId','carrierId','x','y'],Unload:['type','actorId','cargoId','x','y']}[command.type];
  if(!fields||Object.keys(command).length!==fields.length||!fields.every(k=>Object.hasOwn(command,k)))return fail('INVALID_COMMAND','Befehl gehört nicht zu diesem Regelprofil.');
  const u=units.find(u=>u.id===command.actorId),{x,y}=command;
  if(phase!=='player'||gameOver||!ready(u)||u.team!=='player'||!pos(x,y))return fail('UNAVAILABLE','Einheit oder Ziel nicht verfügbar.');
  const target=(root.GoblinCatalogFullRuntime?.active()?root.GoblinCatalogFullRuntime.roster(u.team):units).find(u=>unitAlive(u)&&!u.embarkedOn&&u.x===x&&u.y===y);
  if(command.type==='Embark')return target?.id===command.carrierId?loadQuery(u,target):fail('INVALID_CARRIER','Transporter wählen.');
  if(command.type==='Unload')return unloadQuery(u,units.find(u=>u.id===command.cargoId),x,y);
  if(command.type==='Fire')return fireQuery(u,target);
  if(!['movement','gev'].includes(turnPhase))return fail('WRONG_PHASE','Bewegen nur in der Bewegungsphase oder im GEV-Manöver.');
  if(!canMoveUnit(u,turnPhase==='gev')||target)return fail('MOVE_SPENT','Keine passende Bewegung verfügbar oder Feld besetzt.');
  const path=findMovementPath(u,{x,y},movementBudget(u,turnPhase==='gev'),u);
  return path?.length?{ok:true,path:path.map(c=>({...c}))}:fail('UNREACHABLE','Mit diesem Phasenbudget nicht erreichbar.');
 }
 const oldBudget=movementBudget;movementBudget=function(u,second=false){const t=spec(u);return t?(second?(t.gevPhaseEligible?t.movement[1]:0):t.movement[0]):oldBudget(u,second)};
 const oldGev=isGevUnit;isGevUnit=function(u){const t=spec(u);return t?!!t.gevPhaseEligible:oldGev(u)};
 const oldLoad=carrierLoad;carrierLoad=function(c){return carrier(c)?carrierCargo(c).reduce((n,u)=>n+(drone(u)?cargoDefinition(spec(u).cargoRef).cargoCost:u.hp),0):oldLoad(c)};
 const oldCanLoad=canEmbark;canEmbark=function(a,b){return active()?loadQuery(a?.transportCapacity?b:a,a?.transportCapacity?a:b).ok:oldCanLoad(a,b)};
 const oldCanUnload=canUnloadTo;canUnloadTo=function(c,u,x,y){return active()?unloadQuery(c,u,x,y).ok:oldCanUnload(c,u,x,y)};
 const oldEmbark=embark;embark=function(u,c){
  if(!active())return oldEmbark(u,c);const check=loadQuery(u,c);if(!check.ok){setToast(check.reason);return}
  transportLoadMode=null;transportUnloadMode=null;u.embarkedOn=c.id;u.embarkedThisTurn=true;u.x=c.x;u.y=c.y;u.moved=true;u.acted=true;
  if(drone(u)){u.fired=true;c.moved=true;c.acted=true}
  if(root.GoblinCatalogFullRuntime?.active()){root.GoblinCatalogFullRuntime.recordAction(u,{type:'Embark'},{kind:'cargo'});root.GoblinCatalogFullRuntime.refresh()}
  addLog(text('v2.catalog.loaded',`${u.name} → ${c.name} · Fracht ${carrierLoad(c)}/3`,{cargo:name(u),carrier:name(c),current:carrierLoad(c),capacity:c.transportCapacity}));selected=c;updateSelection();draw();maybeAutoAdvancePhase();
 };
 const oldUnload=unloadAt;unloadAt=function(c,u,x,y){
  if(!active())return oldUnload(c,u,x,y);const check=unloadQuery(c,u,x,y);if(!check.ok){setToast(check.reason);return}
  transportUnloadMode=null;u.embarkedOn=null;u.embarkedThisTurn=false;u.disembarkedThisTurn=true;u.x=x;u.y=y;u.moved=true;u.acted=true;
  if(drone(u)){u.fired=true;u.droneReadyTurn=turn+1;c.moved=true;c.acted=true}
  if(root.GoblinCatalogFullRuntime?.active()){root.GoblinCatalogFullRuntime.recordAction(u,{type:'Unload'},{kind:'cargo'});root.GoblinCatalogFullRuntime.refresh()}
  addLog(drone(u)?text('v2.catalog.deployed',`${u.name} aufgestellt · Feuer ab Zug ${turn+1}.`,{unit:name(u),turn:turn+1}):`${name(u)} · ${text('v2.ui.unload','Aussteigen')}`);selected=c;updateSelection();draw();maybeAutoAdvancePhase();
 };
 const oldPhase=phaseCanAct;phaseCanAct=function(u,name=turnPhase){
  if(!active())return oldPhase(u,name);
  if(!ready(u)||u.team!=='player')return false;
  if(name==='fire')return units.some(t=>fireQuery(u,t).ok);
  if(name==='movement'){
   if(units.some(c=>loadQuery(u,c).ok))return true;
   if(carrier(u)){
    if(units.some(cargo=>loadQuery(cargo,u).ok))return true;
    for(const cargo of carrierCargo(u))for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(unloadQuery(u,cargo,x,y).ok)return true;
   }
  }
  return oldPhase(u,name);
 };
 const oldTarget=root.canSelectedWeaponTarget;root.canSelectedWeaponTarget=function(u,t){return spec(u)?fireQuery(u,t).ok:oldTarget(u,t)};
 const oldAttack=attack;attack=function(u,t){if(active()){const check=fireQuery(u,t);if(!check.ok){setToast(check.reason);return}}return oldAttack(u,t)};
 // Update variable infantry strength inside the one real CRT application, before observer capture.
 const oldApply=applyCombatRoll;applyCombatRoll=function(a,t,roll){const result=oldApply(a,t,roll);if(spec(t)?.strengthRef){t.squads=t.hp;t.damage=t.hp;t.defense=t.hp}return result};
 const oldOutcome=combatOutcome;combatOutcome=function(a,t){
  if(!active())return oldOutcome(a,t);
  const mechanical=carrierCargo(t).filter(drone),result=oldOutcome(a,t);
  if(unitDead(t))for(const u of mechanical){u.hp=0;u.embarkedOn=t.id;u.lastOutcome='X';const hit=result.passengers.find(p=>p.unit.id===u.id);if(hit){hit.outcome={...hit.outcome,directResult:hit.outcome.result,result:'X',cause:'mechanical-carrier-loss'}}}
  return result;
 };
 const oldEnemyFire=enemyFire;enemyFire=function(u){if(spec(u)&&(u.embarkedOn&&!passenger(u)||spec(u).fireRuleRef==='no-fire-v1'||drone(u)&&(u.droneReadyTurn??1)>turn))return false;return oldEnemyFire(u)};
 function syncCargo(c){if(active())for(const u of carrierCargo(c)){u.x=c.x;u.y=c.y}}
 const loadWeight=(c,roster=units)=>roster.filter(u=>unitAlive(u)&&u.embarkedOn===c.id).reduce((n,u)=>n+(drone(u)?cargoDefinition(spec(u).cargoRef).cargoCost:u.hp),0);
 function summary(u,roster=units){const t=spec(u);if(!t)return null;if(root.GoblinSpecialistsRuntime?.active()&&u.catalogSystems)return root.GoblinSpecialistsRuntime.summary(u,roster);
  const chunks=[t.strengthRef?text('v2.catalog.variableStrength',`${u.hp} SP · A=D=SP`,{strength:u.hp}):t.infantry?text('v2.catalog.fixedStrength',`${u.hp}/${u.maxHp} SP · A/D fest`,{current:u.hp,max:u.maxHp}):text('v2.catalog.hitPoints',`${u.hp}/${u.maxHp} HP`,{current:u.hp,max:u.maxHp}),
   text('v2.catalog.combatValues',`A${u.damage??u.attack} D${u.defense} R${u.range}`,{attackLabel:text('v2.ui.attack','A'),defenseLabel:text('v2.ui.defense','D'),rangeLabel:text('v2.ui.range','R'),attack:u.damage??u.attack,defense:u.defense,range:u.range}),
   text(t.gevPhaseEligible?'v2.catalog.movementBonus':'v2.catalog.movement',`M${movementBudget(u)}${t.gevPhaseEligible?' + '+movementBudget(u,true):''}`,{moveLabel:text('v2.ui.move','M'),movement:movementBudget(u),bonus:movementBudget(u,true)})];
  if(t.halfUnit||t.setupValue!==undefined)chunks.push(text('v2.catalog.forceWeight','Aufstellungswert ½',{weight:t.forceBudgetWeight}));
  if(t.missileRuleRef)chunks.push(text('v2.specialists.resource','Munition',{label:text('v2.specialists.ammo','Munition'),current:u.ammunition,max:1}),text('v2.full.missile.impact','Zentrum A6 / Nachbarn A3',{center:6,adjacent:3}));
  if(carrier(u))chunks.push(text('v2.catalog.cargoSummary',`Fracht ${loadWeight(u,roster)}/3 SP oder 1 Drohne`,{current:loadWeight(u,roster),capacity:u.transportCapacity}));
  if(drone(u)){chunks.push(text('v2.catalog.droneSummary','Stationär · direktes Feuer · keine Bordaktionen'));if((u.droneReadyTurn??1)>turn)chunks.push(text('v2.catalog.fireFromTurn',`Feuer ab Zug ${u.droneReadyTurn}`,{turn:u.droneReadyTurn}))}
  if(root.GoblinSpecialistsRuntime?.active()&&(u.materialMax!==undefined||u.catalogFire))chunks.push(root.GoblinSpecialistsRuntime.summary(u,roster));
  return chunks.join(' · ');
 }
 function actions(u){const t=spec(u);if(!t)return [];if(root.GoblinSpecialistsRuntime?.active())return root.GoblinSpecialistsRuntime.actions(u);
  const labels={move:['v2.ui.move','Bewegen'],fire:['v2.ui.fire','Feuern'],'gev-second-move':['v2.ui.move','GEV-Manöver'],embark:['v2.ui.embark','Einsteigen'],disembark:['v2.ui.unload','Aussteigen'],'load-infantry':['v2.ui.embark','Einladen'],'unload-infantry':['v2.ui.unload','Ausladen'],'load-drone':['v2.ui.embark','Einladen'],'deploy-drone':['v2.ui.catalog.deployDrone','Drohne aufstellen'],'passenger-fire':['v2.ui.fire','Bordfeuer'],'be-transported':['v2.ui.embark','Transportieren']};
  return [...new Set(t.capabilities.filter(k=>labels[k]).map(k=>text(...labels[k])))];
 }
 const oldInfo=showUnitInfo;showUnitInfo=function(u){oldInfo(u);if(spec(u)){const p=document.createElement('p');p.textContent=summary(u);$('#unit-intel-facts').appendChild(p)}};
 root.GoblinCatalogRuntime=Object.freeze({active,record,spec,drone,carrier,passenger,name,actions,loadWeight,query,loadQuery,unloadQuery,fireQuery,syncCargo,summary});
})(globalThis);
