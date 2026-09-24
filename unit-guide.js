const unitGuideEntries=[
  {name:'GOBLIN MK III',role:'HEAVY ASSAULT',team:'FRIENDLY SYSTEM',icon:'G',hp:'5',move:'1',range:'2',damage:'3',copy:'Der Goblin ist der mobile Schwerpunkt der Truppe. Langsam, schwer gepanzert und mit hoher Feuerkraft eignet er sich zum Halten zentraler Felder und zum Durchbrechen feindlicher Linien.'},
  {name:'GEV SCOUT',role:'HOVERCRAFT',team:'FRIENDLY SYSTEM',icon:'G',hp:'3',move:'3',range:'3',damage:'1',copy:'Der Scout nutzt seine Geschwindigkeit für Aufklärung, Flankenmanöver und schnelle Angriffe. Vermeide offene Gefechte mit schwer gepanzerten Zielen.'},
  {name:'MISSILE TANK',role:'ARTILLERY',team:'FRIENDLY SYSTEM',icon:'M',hp:'3',move:'1',range:'4',damage:'2',copy:'Der Missile Tank bekämpft Ziele aus sicherer Entfernung. Schütze ihn mit Gelände und anderen Einheiten, denn seine Mobilität ist begrenzt.'},
  {name:'INFANTRY PLATOON',role:'MOBILE INFANTRY',team:'FRIENDLY SYSTEM',icon:'I',hp:'2',move:'2',range:'1',damage:'1',copy:'Infanterie ist zahlenmäßig schwächer, aber flexibel. Sie kann Gelände nutzen und eignet sich zum Sichern von Engpässen und als Begleitschutz.'},
  {name:'COMMAND CORE',role:'FORTIFIED TARGET',team:'HOSTILE SYSTEM',icon:'X',hp:'5',move:'0',range:'0',damage:'0',copy:'Der Kommandokern ist das Primärziel der Mission. Er bewegt sich nicht und muss ausgeschaltet werden, bevor die Verteidigungslinie sich stabilisiert.'},
  {name:'GUARD TANK',role:'HOSTILE ARMOR',team:'HOSTILE SYSTEM',icon:'G',hp:'3',move:'1',range:'2',damage:'1',copy:'Der Guard Tank bewacht wichtige Korridore. Er ist robust genug für den Nahkampf und zwingt schnelle Einheiten zu vorsichtigen Anflügen.'},
  {name:'RAIDER GEV',role:'HOSTILE HOVER',team:'HOSTILE SYSTEM',icon:'R',hp:'2',move:'2',range:'2',damage:'1',copy:'Raider GEVs versuchen, ungeschützte Einheiten zu umgehen. Ihre Stärke liegt in der Bewegung, nicht im direkten Schlagabtausch.'}
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
  document.querySelector('#guide-facts').innerHTML=`<div class="guide-fact"><span>ARMOR / HP</span><b>${unit.hp}</b></div><div class="guide-fact"><span>MOVE</span><b>${unit.move}</b></div><div class="guide-fact"><span>RANGE</span><b>${unit.range}</b></div><div class="guide-fact"><span>DAMAGE</span><b>${unit.damage}</b></div>`;
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
