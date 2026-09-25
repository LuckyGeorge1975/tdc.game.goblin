const unitGuideEntries=[
  {name:'GOBLIN MK III',role:'HEAVY ASSAULT · PROTOTYPE',team:'FRIENDLY SYSTEM',icon:'G',hp:'5',move:'1',range:'2',attack:'3',defense:'5',copy:'Eigenständiger G.O.B.L.I.N.-Prototyp mit schwerem Angriff und Rammfähigkeit. Die Werte sind bewusst von der kanonischen Ogre-Matrix getrennt.'},
  {name:'GEV SCOUT',role:'HOVERCRAFT · PROTOTYPE',team:'FRIENDLY SYSTEM',icon:'G',hp:'3',move:'3 + 2',range:'3',attack:'1',defense:'3',copy:'Schnelles Aufklärungsfahrzeug mit Zweitbewegung. Der aktuelle Field-Test nutzt vereinfachte Werte; der kanonische GEV folgt im Katalog.'},
  {name:'MISSILE TANK',role:'TRACKED MISSILE LAUNCHER',team:'CORE SYSTEM',icon:'M',hp:'2',move:'2',range:'4',attack:'3',defense:'2',copy:'Leicht gepanzerter Raketenwerfer. Im Szenario zählt die Einheit als reguläres Kettenfahrzeug mit hoher Reichweite.'},
  {name:'INFANTRY SQUAD',role:'BATTLESUIT INFANTRY',team:'CORE SYSTEM',icon:'I',hp:'1–3',move:'2',range:'1',attack:'1 / squad',defense:'1 / squad',copy:'Infanterie wird in einzelnen Trupps gezählt. Bis zu drei Trupps können für Angriff und Verteidigung zusammenwirken.'},
  {name:'HEAVY TANK',role:'MAIN BATTLE TANK',team:'CORE SYSTEM',icon:'H',hp:'3',move:'3',range:'2',attack:'4',defense:'3',copy:'Ausgewogenes Kettenfahrzeug für den direkten Schlagabtausch.'},
  {name:'LIGHT TANK',role:'SCOUT ARMOR',team:'CORE SYSTEM',icon:'L',hp:'2',move:'3',range:'2',attack:'2',defense:'2',copy:'Schneller, günstiger Späher. In der Aufstellung zählt er als halbe Panzereinheit.'},
  {name:'SUPERHEAVY TANK',role:'TWIN-GUN TANK DESTROYER',team:'CORE SYSTEM',icon:'S',hp:'5',move:'3',range:'3',attack:'6*',defense:'5',copy:'Schwerer Zerstörer mit zwei getrennten Angriffen zu je 3. Zusätzlich besitzt er Antipersonenwaffen.'},
  {name:'HOWITZER',role:'FIXED MISSILE ARTILLERY',team:'CORE SYSTEM',icon:'H',hp:'1',move:'0',range:'8',attack:'6',defense:'1',copy:'Nicht selbstfahrende Artillerie. Hohe Reichweite, aber ohne eigene Bewegung.'},
  {name:'MOBILE HOWITZER',role:'MOBILE ARTILLERY',team:'SHOCKWAVE',icon:'M',hp:'2',move:'1',range:'6',attack:'6',defense:'2',copy:'Bewegliche Variante der Howitzer mit geringerer Reichweite und höherer taktischer Flexibilität.'},
  {name:'GEV',role:'HOVERCRAFT',team:'CORE SYSTEM',icon:'G',hp:'2',move:'4 + 3',range:'2',attack:'2',defense:'2',copy:'Hovercraft mit zwei Bewegungsphasen. Wasser und Straßen folgen eigenen Geländeregeln.'},
  {name:'LIGHT GEV',role:'LIGHT HOVERCRAFT',team:'SHOCKWAVE',icon:'L',hp:'1',move:'4 + 3',range:'2',attack:'1',defense:'1',copy:'Sehr schnelles, leicht bewaffnetes Hovercraft. Es zählt als halbe Panzereinheit.'},
  {name:'GEV-PC',role:'PERSONNEL CARRIER',team:'SHOCKWAVE',icon:'P',hp:'2',move:'3 + 2',range:'2',attack:'1',defense:'2',copy:'Transportiert bis zu drei Infanterietrupps und nutzt die GEV-Bewegungsregeln.'},
  {name:'MISSILE CRAWLER',role:'CRUISE MISSILE PLATFORM',team:'SHOCKWAVE',icon:'C',hp:'2',move:'1',range:'SPECIAL',attack:'CRUISE',defense:'2',copy:'Träger einer Cruise Missile. Nach dem Abschuss gelten eigene Regeln; das ist im Prototyp noch nicht spielbar.'},
  {name:'LIGHT ARTILLERY DRONE',role:'AUTONOMOUS ARTILLERY',team:'BATTLEFIELDS',icon:'D',hp:'1',move:'0',range:'8',attack:'2',defense:'1',copy:'Unbemannte leichte Artillerie. Sie hat keine Eigenbewegung und muss transportiert werden.'},
  {name:'MARINES',role:'AMPHIBIOUS INFANTRY',team:'SHOCKWAVE',icon:'R',hp:'1–3',move:'2',range:'1',attack:'1 / squad',defense:'1 / squad',copy:'Infanterie mit Sonderregeln für Wasser und Überrennen.'},
  {name:'COMBAT ENGINEERS',role:'FIELD ENGINEERING',team:'REINFORCEMENT PACK',icon:'E',hp:'1–3',move:'2',range:'1',attack:'2',defense:'2',copy:'Können Brücken, Übergänge und Befestigungen beeinflussen. Die Engineering-Aktionen folgen in einer späteren Ausbaustufe.'},
  {name:'MILITIA',role:'CANNON FODDER',team:'BATTLEFIELDS',icon:'M',hp:'1',move:'2',range:'1',attack:'1',defense:'1',copy:'Günstige lokale Verteidiger für Szenarien der Battlefields-Erweiterung.'},
  {name:'COMMAND POST',role:'FIXED COMMAND UNIT',team:'CORE SYSTEM',icon:'C',hp:'2',move:'0',range:'0',attack:'0',defense:'2',copy:'Statisches Kommandoziel. Command Posts und Relaisknoten werden im Prototyp als Missionsziele modelliert.'},
  {name:'OGRE MK III',role:'CYBERTANK · SYSTEMS',team:'OGRE',icon:'O',hp:'45 TREADS',move:'3 → 0',range:'SYSTEMS',attack:'SYSTEMS',defense:'SYSTEMS',copy:'Der Mk. III wird über einzelne Haupt-, Sekundär-, Raketen-, Antipersonen- und Kettenkomponenten geführt. Die Komponentenschäden sind noch nicht im Field-Test aktiviert.'},
  {name:'VULCAN',role:'ENGINEERING CYBERTANK',team:'REINFORCEMENT PACK',icon:'V',hp:'45 TREADS',move:'3 → 0',range:'SYSTEMS',attack:'DRONES',defense:'SYSTEMS',copy:'Ogre mit Reparatur-, Transport- und Drohnenrolle. Die unterstützenden Engineering-Aufgaben sind als Datenmodell vorbereitet.'}
];
let guideIndex=0;
const guideModal=document.querySelector('#unit-guide-modal');
function renderUnitGuide(){
  const unit=unitGuideEntries[guideIndex];
  document.querySelector('#guide-symbol').textContent=unit.icon;
  document.querySelector('#guide-symbol').classList.toggle('enemy',unit.team==='HOSTILE SYSTEM');
  document.querySelector('#guide-kicker').textContent=unit.team;
  document.querySelector('#guide-name').textContent=unit.name;
  document.querySelector('#guide-role').textContent=unit.role;
  document.querySelector('#guide-copy').textContent=unit.copy;
  document.querySelector('#guide-facts').innerHTML=`<div class="guide-fact"><span>ARMOR / HP</span><b>${unit.hp}</b></div><div class="guide-fact"><span>MOVE</span><b>${unit.move}</b></div><div class="guide-fact"><span>RANGE</span><b>${unit.range}</b></div><div class="guide-fact"><span>ATTACK / DEF</span><b>${unit.attack} / ${unit.defense}</b></div>`;
  document.querySelector('#guide-count').textContent=`${String(guideIndex+1).padStart(2,'0')} / ${String(unitGuideEntries.length).padStart(2,'0')}`;
}
function openUnitGuide(){renderUnitGuide();guideModal.classList.remove('hidden');}
function closeUnitGuide(){guideModal.classList.add('hidden');}
document.querySelector('#unit-guide-open').onclick=openUnitGuide;
document.querySelector('#unit-guide-close').onclick=closeUnitGuide;
document.querySelector('#guide-prev').onclick=()=>{guideIndex=(guideIndex+unitGuideEntries.length-1)%unitGuideEntries.length;renderUnitGuide()};
document.querySelector('#guide-next').onclick=()=>{guideIndex=(guideIndex+1)%unitGuideEntries.length;renderUnitGuide()};
guideModal.addEventListener('click',event=>{if(event.target===guideModal)closeUnitGuide()});
document.addEventListener('keydown',event=>{if(guideModal.classList.contains('hidden'))return;if(event.key==='Escape')closeUnitGuide();if(event.key==='ArrowLeft')document.querySelector('#guide-prev').click();if(event.key==='ArrowRight')document.querySelector('#guide-next').click()});