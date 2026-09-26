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
  {name:'STRATEGIC MISSILE CARRIER',role:'LONG-RANGE MISSILE PLATFORM',team:'EXPEDITIONARY',icon:'C',hp:'2',move:'1',range:'SPECIAL',attack:'STRATEGIC',defense:'2',copy:'Mobiler Träger für einen strategischen Lenkflugkörper. Der Sonderangriff ist im Prototyp noch nicht spielbar.'},
  {name:'ARTILLERY DRONE',role:'AUTONOMOUS ARTILLERY',team:'FRONTIER',icon:'D',hp:'1',move:'0',range:'8',attack:'2',defense:'1',copy:'Unbemannte leichte Artillerie ohne Eigenbewegung. Für eine Verlegung benötigt sie einen Transporter.'},
  {name:'AMPHIBIOUS INFANTRY',role:'RIVER ASSAULT TROOPS',team:'EXPEDITIONARY',icon:'R',hp:'1–3',move:'2',range:'1',attack:'1 / squad',defense:'1 / squad',copy:'Spezialisierte Infanterie für Gewässer, Uferzonen und Nahbereichsoperationen.'},
  {name:'FIELD ENGINEERS',role:'COMBAT ENGINEERING',team:'SUPPORT',icon:'E',hp:'1–3',move:'2',range:'1',attack:'2',defense:'2',copy:'Unterstützungstrupps für Übergänge, Hindernisse und Feldstellungen. Erweiterte Bauaktionen folgen in einer späteren Ausbaustufe.'},
  {name:'LOCAL DEFENSE',role:'RESERVE INFANTRY',team:'FRONTIER',icon:'M',hp:'1',move:'2',range:'1',attack:'1',defense:'1',copy:'Leicht ausgerüstete lokale Kräfte für Sicherungsaufgaben und die Verteidigung von Missionszielen.'},
  {name:'COMMAND HUB',role:'FIXED COMMAND UNIT',team:'CORE SYSTEM',icon:'C',hp:'2',move:'0',range:'0',attack:'0',defense:'2',copy:'Stationäres Führungsziel. Kommandozentren und Relaisknoten bilden zentrale Szenarioziele.'},
  {name:'GOBLIN SIEGEBREAKER',role:'AUTONOMOUS FORTRESS · SYSTEMS',team:'AUTONOMOUS',icon:'G',hp:'45 TREADS',move:'3 → 0',range:'SYSTEMS',attack:'SYSTEMS',defense:'SYSTEMS',copy:'Diese Konfiguration verwaltet Batterien, Raketen, Nahbereichsschutz und Kettensegmente als einzelne Systeme.'},
  {name:'FORGE ENGINEER',role:'ENGINEERING FORTRESS',team:'SUPPORT',icon:'F',hp:'45 TREADS',move:'3 → 0',range:'SYSTEMS',attack:'DRONES',defense:'SYSTEMS',copy:'Autonome Reparatur- und Bergeplattform mit Transportkapazität und technischen Drohnen.'}
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
