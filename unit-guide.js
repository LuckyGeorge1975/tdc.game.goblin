const unitGuideEntries=[
  {name:'GOBLIN SIEGEBREAKER',role:'AUTONOMOUS ASSAULT FORTRESS',team:'FRIENDLY SYSTEM',icon:'G',hp:'SYSTEMS',move:'3 → 0',range:'1–5',attack:'1–6',defense:'BY SYSTEM',copy:'Autonome Belagerungsplattform mit getrennt verwalteten Batterien, Lenkflugkörpern, Nahbereichsschutz und Kettensegmenten. Kettenschäden reduzieren die Bewegung stufenweise.'},
  {name:'SKIMMER SCOUT',role:'HOVER RECON · PROTOTYPE',team:'FRIENDLY SYSTEM',icon:'G',hp:'3',move:'3 + 2',range:'3',attack:'1',defense:'3',copy:'Schnelles Aufklärungsfahrzeug für Flankenmanöver. Sein zusätzlicher Manöverschritt macht es beweglich, verlangt aber eine vorausschauende Positionierung.'},
  {name:'ROCKET ARTILLERY',role:'TRACKED ROCKET LAUNCHER',team:'CORE SYSTEM',icon:'M',hp:'2',move:'2',range:'4',attack:'3',defense:'2',copy:'Leicht gepanzerte Raketenartillerie mit hoher Reichweite. Sie wirkt am besten hinter der Front und ist im Nahkampf verwundbar.'},
  {name:'INFANTRY SQUAD',role:'BATTLESUIT INFANTRY',team:'CORE SYSTEM',icon:'I',hp:'1–3',move:'2',range:'1',attack:'1 / squad',defense:'1 / squad',copy:'Infanterie wird in einzelnen Trupps gezählt. Bis zu drei Trupps können für Angriff und Verteidigung zusammenwirken.'},
  {name:'ASSAULT TANK',role:'FRONTLINE ARMOR',team:'CORE SYSTEM',icon:'H',hp:'3',move:'3',range:'2',attack:'4',defense:'3',copy:'Robustes Kettenfahrzeug für den direkten Schlagabtausch und das Halten wichtiger Korridore.'},
  {name:'RECON TANK',role:'SCOUT ARMOR',team:'CORE SYSTEM',icon:'L',hp:'2',move:'3',range:'2',attack:'2',defense:'2',copy:'Schneller und leichter Spähpanzer für Vorstöße, Flankenschutz und das Besetzen freier Räume.'},
  {name:'SIEGE TANK',role:'TWIN-GUN TANK DESTROYER',team:'CORE SYSTEM',icon:'S',hp:'5',move:'3',range:'3',attack:'6*',defense:'5',copy:'Schwerer Jagdpanzer mit zwei getrennt einsetzbaren Geschützen und zusätzlichem Nahbereichsschutz.'},
  {name:'LONG-RANGE BATTERY',role:'FIXED ROCKET ARTILLERY',team:'CORE SYSTEM',icon:'H',hp:'1',move:'0',range:'8',attack:'6',defense:'1',copy:'Stationäre Fernunterstützung mit großer Reichweite. Ohne Transport bleibt sie an ihre Ausgangsstellung gebunden.'},
  {name:'MOBILE SIEGE GUN',role:'MOBILE ARTILLERY',team:'EXPEDITIONARY',icon:'M',hp:'2',move:'1',range:'6',attack:'6',defense:'2',copy:'Langsame mobile Artillerie für Stellungswechsel zwischen Feueraufträgen.'},
  {name:'COMBAT SKIMMER',role:'HOVERCRAFT',team:'CORE SYSTEM',icon:'G',hp:'2',move:'4 + 3',range:'2',attack:'2',defense:'2',copy:'Schwebefahrzeug mit einem zusätzlichen Manöverschritt. Seine Stärke liegt in schnellen Richtungswechseln.'},
  {name:'LIGHT SKIMMER',role:'LIGHT HOVERCRAFT',team:'EXPEDITIONARY',icon:'L',hp:'1',move:'4 + 3',range:'2',attack:'1',defense:'1',copy:'Sehr schnelles, leicht bewaffnetes Schwebefahrzeug für Aufklärung und Störangriffe.'},
  {name:'SKIMMER CARRIER',role:'PERSONNEL CARRIER',team:'EXPEDITIONARY',icon:'P',hp:'2',move:'3 + 2',range:'2',attack:'1',defense:'2',copy:'Transportiert bis zu drei Infanterietrupps und folgt den Manöverregeln der Schwebefahrzeuge.'},
  {name:'STRATEGIC MISSILE CARRIER',role:'ONE-SHOT MISSILE PLATFORM',team:'EXPEDITIONARY',icon:'C',hp:'2',move:'1',range:'8',attack:'6 / 3 BLAST',defense:'2',copy:'Mobiler Träger mit einem Lenkflugkörper. In der Feuerphase ein sichtbares Feindziel innerhalb von acht Hexfeldern wählen: Angriff 6 auf das Ziel, Angriff 3 auf Einheiten in benachbarten Hexen – auch eigene. Nach dem Start ist die Munition verbraucht.'},
  {name:'ARTILLERY DRONE',role:'AUTONOMOUS ARTILLERY',team:'FRONTIER',icon:'D',hp:'1',move:'0',range:'8',attack:'2',defense:'1',copy:'Katalogregel: keine Eigenbewegung; eine Verlegung erfordert Transport. Im aktuellen Field Test gilt eine abweichende Szenarioregel.'},
  {name:'AMPHIBIOUS INFANTRY',role:'RIVER ASSAULT TROOPS',team:'EXPEDITIONARY',icon:'R',hp:'1–3',move:'2',range:'1',attack:'1 / squad',defense:'1 / squad',copy:'Spezialisierte Infanterie für Gewässer, Uferzonen und Nahbereichsoperationen.'},
  {name:'FIELD ENGINEERS',role:'COMBAT ENGINEERING',team:'SUPPORT',icon:'E',hp:'1–3',move:'2',range:'1',attack:'2',defense:'2',copy:'Unterstützungstrupps für Übergänge, Hindernisse und Feldstellungen. Erweiterte Bauaktionen folgen in einer späteren Ausbaustufe.'},
  {name:'LOCAL DEFENSE',role:'RESERVE INFANTRY',team:'FRONTIER',icon:'M',hp:'1',move:'2',range:'1',attack:'1',defense:'1',copy:'Leicht ausgerüstete lokale Kräfte für Sicherungsaufgaben und die Verteidigung von Missionszielen.'},
  {name:'COMMAND HUB',role:'FIXED COMMAND UNIT',team:'CORE SYSTEM',icon:'C',hp:'2',move:'0',range:'0',attack:'0',defense:'2',copy:'Stationäres Führungsziel. Kommandozentren und Relaisknoten bilden zentrale Szenarioziele.'},
  {name:'GOBLIN DREADNAUGHT',role:'HEAVY ASSAULT PLATFORM',team:'HOSTILE SYSTEM',icon:'G',hp:'6',move:'2',range:'3',attack:'4',defense:'6',copy:'Schwere gegnerische Plattform. Im ATLAS-Teststand noch als einzelnes Fahrzeug modelliert; getrennte Systemschäden folgen später.'},
  {name:'PHANTOM PLATFORM',role:'MOBILE PLATFORM',team:'HOSTILE SYSTEM',icon:'P',hp:'3',move:'2',range:'3',attack:'2',defense:'3',copy:'Mobile Plattform. Ein eigener Tarnmechanismus ist noch nicht implementiert.'},
  {name:'INFANTRY PLATOON',role:'MOBILE INFANTRY',team:'HOSTILE SYSTEM',icon:'I',hp:'2',move:'2',range:'1',attack:'1',defense:'2',copy:'Gegnerische Infanterie. Ein D-Treffer reduziert ihre Stärke statt sie vorübergehend zu deaktivieren.'},
  {name:'COMMAND CORE',role:'FORTIFIED OBJECTIVE',team:'HOSTILE SYSTEM',icon:'X',hp:'5',move:'0',range:'0',attack:'0',defense:'5',copy:'Stationäres Missionsziel. Im ATLAS-Szenario müssen zusätzlich die übrigen Gegner ausgeschaltet werden.'},
  {name:'RELAY NODE',role:'FORTIFIED OBJECTIVE',team:'HOSTILE SYSTEM',icon:'R',hp:'4',move:'0',range:'0',attack:'0',defense:'4',copy:'Stationärer Relaisknoten. Missionsziele und Siegbedingungen unterscheiden sich je nach Szenario.'},
  {name:'GUARD TANK',role:'HOSTILE ARMOR',team:'HOSTILE SYSTEM',icon:'G',hp:'3',move:'1',range:'2',attack:'1',defense:'3',copy:'Gegnerischer Sicherungspanzer. Die KI feuert auf erreichbare Ziele und rückt sonst vor.'},
  {name:'RAIDER SKIMMER',role:'HOSTILE HOVERCRAFT',team:'HOSTILE SYSTEM',icon:'R',hp:'2',move:'2',range:'2',attack:'1',defense:'2',copy:'Gegnerischer Skimmer. Kann Wasser und Flüsse überqueren; die eigenständige KI nutzt derzeit keine zusätzliche Skimmer-Phase.'},
  {name:'FORGE ENGINEER',role:'ENGINEERING FORTRESS',team:'SUPPORT',icon:'F',hp:'6',move:'2',range:'1',attack:'2',defense:'6',copy:'Autonome Reparatur- und Bergeplattform. Im ATLAS-Teststand noch als normales Fahrzeug spielbar; Reparatur, Bergung und Drohnen folgen später.'}
];
const guideActions={
  'GOBLIN SIEGEBREAKER':['Bewegen und gegnerische Fahrzeuge rammen','Waffensystem wählen; intakte Batterien separat abfeuern','Ketten- und Systemschäden verwalten'],
  'SKIMMER SCOUT':['Bewegen','Feuern','Zusätzliches Skimmer-Manöver nach der Feuerphase'],
  'ROCKET ARTILLERY':['Bewegen','Auf sichtbare Ziele feuern'],
  'INFANTRY SQUAD':['Bewegen und feuern','Als Passagier ein- und aussteigen; vom Transporter feuern'],
  'ASSAULT TANK':['Bewegen','Auf sichtbare Ziele feuern'],
  'RECON TANK':['Bewegen','Auf sichtbare Ziele feuern'],
  'SIEGE TANK':['Bewegen und feuern','Geteiltes Feuer: geplant, derzeit ein Angriff'],
  'LONG-RANGE BATTERY':['Fernfeuer; keine Eigenbewegung','Transportverlegung: geplant'],
  'MOBILE SIEGE GUN':['Langsam bewegen','Fernfeuer'],
  'COMBAT SKIMMER':['Bewegen und feuern','Zusätzliches Skimmer-Manöver'],
  'LIGHT SKIMMER':['Bewegen und feuern','Zusätzliches Skimmer-Manöver'],
  'SKIMMER CARRIER':['Bewegen, feuern und Skimmer-Manöver','Infanterie per Karte laden/entladen; Fracht in der Leiste wählen'],
  'STRATEGIC MISSILE CARRIER':['Bewegen','Einmaliger Lenkflugkörper mit Flächenschaden; auch Friendly Fire'],
  'ARTILLERY DRONE':['Fernfeuer; Katalogregel ohne Eigenbewegung','Transportverlegung: geplant'],
  'AMPHIBIOUS INFANTRY':['Bewegen und feuern','Wasser und Flüsse betreten'],
  'FIELD ENGINEERS':['Bewegen, feuern und transportieren','Bau- und Räumaktionen: geplant'],
  'LOCAL DEFENSE':['Stellung halten und feuern','Keine Eigenbewegung im ATLAS-Teststand'],
  'COMMAND HUB':['Stationäres Missionsziel; keine aktive Aktion'],
  'GOBLIN DREADNAUGHT':['Gegner-KI: bewegen und feuern','Getrennte Plattform-Systeme: geplant'],
  'PHANTOM PLATFORM':['Gegner-KI: bewegen und feuern','Tarnung: geplant'],
  'INFANTRY PLATOON':['Gegner-KI: bewegen und feuern'],
  'COMMAND CORE':['Stationäres Missionsziel; keine aktive Aktion'],
  'RELAY NODE':['Stationäres Missionsziel; keine aktive Aktion'],
  'GUARD TANK':['Gegner-KI: bewegen und feuern'],
  'RAIDER SKIMMER':['Gegner-KI: bewegen und feuern','Wasserpassage; kein eigener KI-Zusatzschritt'],
  'FORGE ENGINEER':['Bewegen und feuern','Reparatur, Bergung und Drohnen: geplant']
};
let guideIndex=0;
const guideModal=document.querySelector('#unit-guide-modal');
function renderUnitGuide(){
  const unit=unitGuideEntries[guideIndex],live=units.find(item=>item.name===unit.name);
  document.querySelector('.guide-information').scrollTop=0;
  document.querySelector('#guide-symbol').textContent=unit.icon;
  document.querySelector('#guide-symbol').classList.toggle('enemy',(live?.team==='enemy')||(!live&&unit.team==='HOSTILE SYSTEM'));
  document.querySelector('#guide-kicker').textContent=live?(live.team==='player'?'FRIENDLY · LIVE':'HOSTILE · LIVE'):unit.team+' · CATALOG';
  document.querySelector('#guide-name').textContent=unit.name;
  document.querySelector('#guide-role').textContent=unit.role;
  const liveDrone=unit.name==='ARTILLERY DRONE'&&live;
  document.querySelector('#guide-copy').textContent=liveDrone?'Field-Test-Regel: Diese Artilleriedrohne kann sich selbstständig bewegen. Die stationäre Katalogregel ist noch nicht aktiv.':unit.copy;
  globalThis.UnitGuideVoice.render(unit.name);
  const hp=live?(live.ogreSystems?`${live.ogreSystems.treads} TREADS`:`${Math.max(0,live.hp)}/${live.maxHp}`):unit.hp;
  const move=live?`${live.move}${isGevUnit(live)?' + 2':''}`:unit.move;
  const range=live?(live.ogreSystems?'BY WEAPON':live.range):unit.range;
  const attack=live?(live.ogreSystems?'BY WEAPON':live.damage):unit.attack;
  const defense=live?(live.ogreSystems?'BY SYSTEM':effectiveDefense(live)):unit.defense;
  document.querySelector('#guide-facts').innerHTML=`<div class="guide-fact"><span>ARMOR / HP</span><b>${hp}</b></div><div class="guide-fact"><span>MOVE</span><b>${move}</b></div><div class="guide-fact"><span>RANGE</span><b>${range}</b></div><div class="guide-fact"><span>ATTACK / DEF</span><b>${attack} / ${defense}</b></div>`;
  globalThis.UnitGuideRange.render(unit,live);
  const scenarios=Object.entries(scenarioCatalog).filter(([,config])=>config.units.some(item=>item.name===unit.name)).map(([id])=>id.toUpperCase().replaceAll('-',' '));
  document.querySelector('#guide-scenarios').textContent=scenarios.join(' · ')||'CATALOG ONLY';
  document.querySelector('#guide-status').textContent=live?(live.hp<=0?'DESTROYED':live.disabled?'DISABLED':currentScenario==='atlas-proving-grounds'?'ATLAS · PROTOTYPE STATS':'LIVE IN CURRENT SCENARIO'):'NOT IN CURRENT SCENARIO';
  document.querySelector('#guide-phase-status').textContent=!live?'—':live.hp<=0?'DESTROYED':live.team==='enemy'?'HOSTILE AI':phaseCanAct(live)?'READY':live.disabled?'DISABLED':'NO ACTION NOW';
  const list=document.querySelector('#guide-action-list');list.replaceChildren();
  for(const action of liveDrone?['Im Field Test bewegen und fernfeuern','Stationäre Katalogregel: geplant']:guideActions[unit.name]||[]){const item=document.createElement('li');item.textContent=action;list.appendChild(item)}
  document.querySelector('#guide-find').disabled=!live;
  document.querySelector('#guide-count').textContent=`${String(guideIndex+1).padStart(2,'0')} / ${String(unitGuideEntries.length).padStart(2,'0')}`;
}
function openUnitGuide(){renderUnitGuide();guideModal.classList.remove('hidden');}
function closeUnitGuide(){guideModal.classList.add('hidden');}
document.querySelector('#unit-guide-open').onclick=openUnitGuide;
document.querySelector('#unit-guide-close').onclick=closeUnitGuide;
document.querySelector('#guide-prev').onclick=()=>{guideIndex=(guideIndex+unitGuideEntries.length-1)%unitGuideEntries.length;renderUnitGuide()};
document.querySelector('#guide-next').onclick=()=>{guideIndex=(guideIndex+1)%unitGuideEntries.length;renderUnitGuide()};
document.querySelector('#guide-find').onclick=()=>{const unit=units.find(item=>item.name===unitGuideEntries[guideIndex].name);if(!unit)return;closeUnitGuide();selected=unit;focusedCell={x:unit.x,y:unit.y};showUnitInfo(unit);showFieldInfo(unit.x,unit.y);updateSelection();draw();globalThis.GoblinMobileViews?.show('map',{focus:true})};
guideModal.addEventListener('click',event=>{if(event.target===guideModal)closeUnitGuide()});
document.addEventListener('keydown',event=>{if(guideModal.classList.contains('hidden'))return;if(event.key==='Escape')closeUnitGuide();if(event.key==='ArrowLeft')document.querySelector('#guide-prev').click();if(event.key==='ArrowRight')document.querySelector('#guide-next').click()});
