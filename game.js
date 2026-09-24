const NS='http://www.w3.org/2000/svg';
const W=12,H=8,S=34,DX=Math.sqrt(3)*S, DY=1.5*S;
let terrain = new Set(['3,1','8,1','1,4','5,3','9,5','2,6','7,6','10,2']);
const units = [
  {id:'ogre',name:'GOBLIN MK III',type:'HEAVY ASSAULT',team:'player',x:1,y:5,hp:5,maxHp:5,range:2,move:1,damage:3,icon:'G'},
  {id:'gev',name:'GEV SCOUT',type:'HOVERCRAFT',team:'player',x:2,y:6,hp:3,maxHp:3,range:3,move:3,damage:1,icon:'G'},
  {id:'missile',name:'MISSILE TANK',type:'ARTILLERY',team:'player',x:3,y:6,hp:3,maxHp:3,range:4,move:1,damage:2,icon:'M'},
  {id:'infantry',name:'INFANTRY PLATOON',type:'MOBILE INFANTRY',team:'player',x:1,y:6,hp:2,maxHp:2,range:1,move:2,damage:1,icon:'I'},
  {id:'core',name:'COMMAND CORE',type:'FORTIFIED TARGET',team:'enemy',x:10,y:2,hp:5,maxHp:5,range:0,move:0,damage:0,icon:'X',core:true},
  {id:'guard',name:'GUARD TANK',type:'HOSTILE ARMOR',team:'enemy',x:8,y:3,hp:3,maxHp:3,range:2,move:1,damage:1,icon:'G'},
  {id:'raider',name:'RAIDER GEV',type:'HOSTILE HOVER',team:'enemy',x:9,y:5,hp:2,maxHp:2,range:2,move:2,damage:1,icon:'R'}
];
const scenarioCatalog={
  'iron-dust':{kicker:'MISSION 07 / IRON DUST',title:'Durchbrechen. Ausschalten. Überleben.',sub:'Zerstöre den feindlichen Kommandokern, bevor Verstärkungen eintreffen.',terrain:['3,1','8,1','1,4','5,3','9,5','2,6','7,6','10,2'],units:units.map(u=>({...u}))},
  'relay-run':{kicker:'MISSION 08 / RELAY RUN',title:'Sichern. Halten. Extrahieren.',sub:'Erreiche den östlichen Relaisknoten und schalte seine Eskorte aus.',terrain:['4,2','5,2','4,5','7,4','8,6','2,3'],units:[
    {id:'ogre',name:'GOBLIN MK III',type:'HEAVY ASSAULT',team:'player',x:1,y:6,hp:5,maxHp:5,range:2,move:1,damage:3,icon:'G'},
    {id:'gev',name:'GEV SCOUT',type:'HOVERCRAFT',team:'player',x:2,y:6,hp:3,maxHp:3,range:3,move:3,damage:1,icon:'G'},
    {id:'missile',name:'MISSILE TANK',type:'ARTILLERY',team:'player',x:3,y:7,hp:3,maxHp:3,range:4,move:1,damage:2,icon:'M'},
    {id:'infantry',name:'INFANTRY PLATOON',type:'MOBILE INFANTRY',team:'player',x:1,y:7,hp:2,maxHp:2,range:1,move:2,damage:1,icon:'I'},
    {id:'core',name:'RELAY NODE',type:'FORTIFIED TARGET',team:'enemy',x:10,y:1,hp:4,maxHp:4,range:0,move:0,damage:0,icon:'X',core:true},
    {id:'guard',name:'GUARD TANK',type:'HOSTILE ARMOR',team:'enemy',x:8,y:2,hp:3,maxHp:3,range:2,move:1,damage:1,icon:'G'},
    {id:'raider',name:'RAIDER GEV',type:'HOSTILE HOVER',team:'enemy',x:9,y:4,hp:2,maxHp:2,range:2,move:2,damage:1,icon:'R'}
  ]}
};
let currentScenario='iron-dust';
let selected=null, turn=1, phase='player', gameOver=false, viewMode='combo';
const svg=document.querySelector('#battlefield-map'), logEl=document.querySelector('#combat-log');
const $=s=>document.querySelector(s);
function hexCenter(x,y){return {x:58+x*DX+(y%2?DX/2:0),y:48+y*DY}}
function hexPoints(x,y){const c=hexCenter(x,y);return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return `${c.x+S*Math.cos(a)},${c.y+S*Math.sin(a)}`}).join(' ')}
function hexVertices(x,y){const c=hexCenter(x,y);return Array.from({length:6},(_,i)=>{const a=Math.PI/3*i+Math.PI/6;return {x:c.x+S*Math.cos(a),y:c.y+S*Math.sin(a)}})}
function hexNeighbors(x,y){return y%2===0?[{x,y:y+1},{x:x-1,y:y+1},{x:x-1,y},{x:x-1,y:y-1},{x,y:y-1},{x:x+1,y}]:[{x:x+1,y:y+1},{x,y:y+1},{x:x-1,y},{x,y:y-1},{x:x+1,y:y-1},{x:x+1,y}]}
function drawAreaBoundary(radius,className,includeCell=()=>true){if(!selected)return;const inside=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&dist(selected,{x,y})<=radius&&includeCell(x,y);let d='';for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!inside(x,y))continue;const vertices=hexVertices(x,y),neighbors=hexNeighbors(x,y);for(let i=0;i<6;i++){const n=neighbors[i];if(!inside(n.x,n.y)){const a=vertices[i],b=vertices[(i+1)%6];d+=`M${a.x},${a.y}L${b.x},${b.y}`}}}const path=document.createElementNS(NS,'path');path.setAttribute('d',d);path.classList.add('area-boundary',className);svg.appendChild(path)}
function dist(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y),Math.abs((a.x+a.y)-(b.x+b.y)))}
function findEnemyStep(foe,target){
  const occupied=new Set(units.filter(u=>u.hp>0&&u!==foe).map(u=>`${u.x},${u.y}`));
  const queue=[{x:foe.x,y:foe.y,cost:0,path:[]}],seen=new Map([[`${foe.x},${foe.y}`,0]]);let best=null;
  while(queue.length){
    const node=queue.shift();
    if(node.path.length&&dist(node,target)<dist(foe,target)&&(!best||dist(node,target)<dist(best,target)||dist(node,target)===dist(best,target)&&node.cost<best.cost))best=node;
    hexNeighbors(node.x,node.y).forEach(next=>{
      const key=`${next.x},${next.y}`,stepCost=terrain.has(key)?2:1;
      if(next.x<0||next.x>=W||next.y<0||next.y>=H||occupied.has(key)||node.cost+stepCost>foe.move)return;
      if(!seen.has(key)||node.cost+stepCost<seen.get(key)){seen.set(key,node.cost+stepCost);queue.push({x:next.x,y:next.y,cost:node.cost+stepCost,path:[...node.path,next]})}
    });
  }
  return best;
}
function addLog(text,enemy=false){const t=new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});logEl.insertAdjacentHTML('afterbegin',`<div class="log-line ${enemy?'enemy':''}"><span class="log-time">${t}</span><strong>${enemy?'HOSTILE':'COMMAND'}</strong> ${text}</div>`)}
function draw(){
  svg.setAttribute('viewBox','0 0 790 480'); svg.innerHTML='';
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=document.createElementNS(NS,'polygon');p.setAttribute('points',hexPoints(x,y));p.classList.add('hex');p.dataset.x=x;p.dataset.y=y;
    const unit=units.find(u=>u.hp>0&&u.x===x&&u.y===y); if(selected&&selected.hp>0&&unit&&unit.team==='enemy'&&dist(selected,{x,y})<=selected.range) p.classList.add('attack');
    if(terrain.has(`${x},${y}`)){p.classList.add('terrain');}
    if(selected&&selected.hp>0){const distance=dist(selected,{x,y}),moveCost=distance+(terrain.has(`${x},${y}`)?1:0);if(x===selected.x&&y===selected.y)p.classList.add('selected');if(viewMode!=='fire'&&moveCost<=selected.move&&!unit)p.classList.add('movement-fill');if(viewMode==='fire'&&distance<=selected.range)p.classList.add('fire-range');if(unit&&unit.team==='enemy'&&distance<=selected.range)p.classList.add('attack')}
    p.addEventListener('click',()=>handleHex(x,y));svg.appendChild(p);
    if(terrain.has(`${x},${y}`)){const c=hexCenter(x,y);const r=document.createElementNS(NS,'rect');r.setAttribute('x',c.x-11);r.setAttribute('y',c.y-7);r.setAttribute('width',22);r.setAttribute('height',14);r.setAttribute('transform',`rotate(18 ${c.x} ${c.y})`);r.classList.add('ruin');r.addEventListener('click',event=>{event.stopPropagation();handleHex(x,y)});svg.appendChild(r)}
  }
  if(selected&&selected.hp>0){drawAreaBoundary(selected.move,'movement-boundary',(x,y)=>dist(selected,{x,y})+(terrain.has(`${x},${y}`)?1:0)<=selected.move);drawAreaBoundary(selected.range,'fire-boundary')}
  units.slice().sort((a,b)=>(a.hp>0?1:0)-(b.hp>0?1:0)).forEach(u=>{try{renderUnit(u)}catch(error){addLog(`Unit render failed: ${error.message}`,true)}}); updateRoster();
}
function renderUnit(u){
  const c=hexCenter(u.x,u.y), color=u.team==='player'?(u.id==='ogre'?'#d1f35a':'#62cadd'):'#ee574d';
  const g=document.createElementNS(NS,'g');
  g.classList.add('unit-svg');
  const covered=terrain.has(`${u.x},${u.y}`);
  if(covered&&u.hp>0)g.classList.add('covered-unit');
  if(u.acted&&u.hp>0&&u.team==='player')g.classList.add('acted-unit');
  if(u.justHit)g.classList.add('hit-flash');
  if(u.hp<=0){g.classList.add('wreck');const wreck=document.createElementNS(NS,'polygon');wreck.setAttribute('points',`${c.x-18},${c.y-10} ${c.x+12},${c.y-16} ${c.x+19},${c.y+8} ${c.x-8},${c.y+16}`);wreck.setAttribute('fill','#1a2528');wreck.setAttribute('stroke','#a34e46');wreck.setAttribute('stroke-width','2');g.appendChild(wreck);const mark=document.createElementNS(NS,'text');mark.setAttribute('x',c.x);mark.setAttribute('y',c.y+5);mark.setAttribute('text-anchor','middle');mark.classList.add('wreck-mark');mark.textContent='×';g.appendChild(mark);svg.appendChild(g);return}
  const targetable=u.team==='enemy'&&selected&&dist(selected,u)<=selected.range;
  if(targetable){const ring=document.createElementNS(NS,'polygon');ring.setAttribute('points',`${c.x},${c.y-24} ${c.x+21},${c.y-12} ${c.x+21},${c.y+12} ${c.x},${c.y+24} ${c.x-21},${c.y+12} ${c.x-21},${c.y-12}`);ring.classList.add('target-ring');g.appendChild(ring)}
  const shape=document.createElementNS(NS,'polygon');
  shape.setAttribute('points',`${c.x},${c.y-18} ${c.x+15},${c.y-8} ${c.x+12},${c.y+10} ${c.x},${c.y+17} ${c.x-12},${c.y+10} ${c.x-15},${c.y-8}`);
  shape.setAttribute('fill',u.team==='player'?'#17302d':'#391e24');
  shape.setAttribute('stroke',color);
  shape.setAttribute('stroke-width',u===selected?'3':'1.5');
  g.appendChild(shape);
  const text=document.createElementNS(NS,'text');
  text.setAttribute('x',c.x);text.setAttribute('y',c.y+5);text.setAttribute('text-anchor','middle');
  text.classList.add('unit-label');text.textContent=u.icon;g.appendChild(text);
  const bg=document.createElementNS(NS,'rect');
  bg.setAttribute('x',c.x-15);bg.setAttribute('y',c.y+22);bg.setAttribute('width',30);bg.setAttribute('height',3);bg.classList.add('unit-hp-bg');g.appendChild(bg);
  const hp=document.createElementNS(NS,'rect');
  hp.setAttribute('x',c.x-15);hp.setAttribute('y',c.y+22);hp.setAttribute('width',30*(u.hp/u.maxHp));hp.setAttribute('height',3);hp.setAttribute('fill',color);g.appendChild(hp);
  if(covered){const shield=document.createElementNS(NS,'path');shield.setAttribute('d',`M${c.x+17},${c.y-20} l6,3 v6 l-6,4 l-6,-4 v-6 z`);shield.classList.add('cover-mark');g.appendChild(shield)}
  g.addEventListener('click',event=>{event.stopPropagation();handleUnitClick(u)});
  svg.appendChild(g);
  if(u.moveFrom){const from=hexCenter(u.moveFrom.x,u.moveFrom.y);g.animate([{transform:`translate(${from.x-c.x}px,${from.y-c.y}px)`},{transform:'translate(0,0)'}],{duration:520,easing:'cubic-bezier(.2,.8,.25,1)',fill:'both'});u.moveFrom=null}
}
function clearSelection(message='AUSWAHL AUFGEHOBEN'){selected=null;setToast(message);updateSelection();draw()}
function showFieldInfo(x,y){const unit=units.find(u=>u.hp>0&&u.x===x&&u.y===y),covered=terrain.has(`${x},${y}`),label=`${String.fromCharCode(65+x)}-${String(y+1).padStart(2,'0')}`;$('#intel-kicker').textContent='FIELD INTEL';$('#intel-title').textContent=`SECTOR ${label}`;$('#intel-copy').textContent=covered?'Berg-/Trümmerfeld. Begehbar mit Bewegungskosten 2; Einheiten erhalten Deckung.':'Offenes Gelände. Keine Deckung, normale Bewegung.';$('#intel-facts').innerHTML=`<div><span>TERRAIN</span><b>${covered?'COVER / COST 2':'OPEN GROUND'}</b></div><div><span>OCCUPANT</span><b>${unit?unit.name:'NONE'}</b></div>`}
function showUnitInfo(unit){const covered=terrain.has(`${unit.x},${unit.y}`),label=`${String.fromCharCode(65+unit.x)}-${String(unit.y+1).padStart(2,'0')}`;$('#unit-intel-kicker').textContent=unit.team==='player'?'UNIT INTEL':'HOSTILE INTEL';$('#unit-intel-title').textContent=unit.name;$('#unit-intel-copy').textContent=`${unit.type} · ${unit.team==='player'?'FRIENDLY':'HOSTILE'} · SECTOR ${label}`;$('#unit-intel-facts').innerHTML=`<div><span>HP</span><b>${Math.max(0,unit.hp)}/${unit.maxHp}</b></div><div><span>MOVE / RANGE</span><b>${unit.move} / ${unit.range}</b></div><div><span>POSITION</span><b>${covered?'COVERED':'OPEN'}</b></div>`}
function selectPlayerUnit(unit){showUnitInfo(unit);showFieldInfo(unit.x,unit.y);if(unit.acted){setToast(`${unit.name} HAT BEREITS GEHANDELT`);return}if(selected===unit){clearSelection();return}selected=unit;setToast(`${unit.name} AUSGEWÄHLT`);updateSelection();draw()}
function handleUnitClick(unit){showUnitInfo(unit);showFieldInfo(unit.x,unit.y);if(gameOver||phase!=='player')return;if(unit.team==='player'){selectPlayerUnit(unit);return}if(!selected){setToast('WÄHLE ZUERST EINE EINHEIT');return}if(dist(selected,unit)<=selected.range)attack(selected,unit);else clearSelection('ZIEL AUSSER REICHWEITE')}
function handleHex(x,y){showFieldInfo(x,y);if(gameOver||phase!=='player')return;const unit=units.find(u=>u.hp>0&&u.x===x&&u.y===y);if(unit){showUnitInfo(unit);if(unit.team==='player'){selectPlayerUnit(unit);return}}if(!selected){setToast('WÄHLE ZUERST EINE EINHEIT');return}if(selected.acted){clearSelection('EINHEIT HAT BEREITS GEHANDELT');return}if(unit?.team==='enemy'){if(dist(selected,unit)<=selected.range)attack(selected,unit);else clearSelection('ZIEL AUSSER REICHWEITE');return}if(!unit&&dist(selected,{x,y})+(terrain.has(`${x},${y}`)?1:0)<=selected.move){const actor=selected;actor.moveFrom={x:actor.x,y:actor.y};actor.x=x;actor.y=y;actor.moveCount=(actor.moveCount||0)+1;actor.acted=true;addLog(`${actor.name} bewegt sich nach ${String.fromCharCode(65+x)}-${String(y+1).padStart(2,'0')}.`);selected=null;setToast('BEFEHL AUSGEFÜHRT');updateSelection();draw();maybeAutoEndTurn()}else clearSelection('FELD NICHT VERFÜGBAR')}
function startEnemyTurn(){if(gameOver||phase!=='player')return;selected=null;updateSelection();draw();enemyTurn()}
function maybeAutoEndTurn(){const active=units.filter(u=>u.team==='player'&&u.hp>0);if(active.length&&active.every(u=>u.acted)&&$('#auto-end-turn')?.checked)startEnemyTurn()}
function attack(attacker,target){attacker.acted=true;const covered=terrain.has(`${target.x},${target.y}`),damage=Math.max(1,attacker.damage-(covered?1:0));target.hp=Math.max(0,target.hp-damage);target.justHit=true;addLog(`${attacker.name} trifft ${target.name} für ${damage} Schaden${covered?' — DECKUNG REDUZIERT TREFFER':''}.`);setToast(target.hp?'TREFFER BESTÄTIGT':'ZIEL AUSGESCHALTET');selected=null;updateSelection();draw();setTimeout(()=>{target.justHit=false;draw()},560);if(target.hp===0&&target.core){finish(true);return}if(!units.some(u=>u.team==='enemy'&&u.hp>0)){finish(true);return}maybeAutoEndTurn()}
function enemyTurn(){phase='enemy';$('#phase-title').textContent='HOSTILE PHASE';$('#log-status').textContent='PROCESSING';setToast('FEINDZUG WIRD AUSGEFÜHRT');setTimeout(()=>{const foes=units.filter(u=>u.team==='enemy'&&u.hp>0&&u!==units.find(x=>x.id==='core'));foes.forEach(foe=>{const targets=units.filter(u=>u.team==='player'&&u.hp>0).sort((a,b)=>dist(foe,a)-dist(foe,b));const target=targets[0];if(target&&dist(foe,target)<=foe.range){const covered=terrain.has(`${target.x},${target.y}`),damage=Math.max(1,foe.damage-(covered?1:0));target.hp=Math.max(0,target.hp-damage);target.justHit=true;addLog(`${foe.name} feuert auf ${target.name}${covered?' — DECKUNG REDUZIERT TREFFER':''}.`,true);if(target.hp===0)addLog(`${target.name} ist ausgefallen.`,true);setTimeout(()=>{target.justHit=false;draw()},560)}else if(target){const step=findEnemyStep(foe,target);if(step){foe.moveFrom={x:foe.x,y:foe.y};foe.x=step.x;foe.y=step.y;foe.moveCount=(foe.moveCount||0)+1;addLog(`${foe.name} rückt nach ${String.fromCharCode(65+foe.x)}-${String(foe.y+1).padStart(2,'0')} vor.`,true)}else addLog(`${foe.name} hält Position.`,true)}});if(!units.some(u=>u.team==='player'&&u.hp>0)){finish(false);return}units.filter(u=>u.team==='player').forEach(u=>u.acted=false);phase='player';turn++;$('#turn-number').textContent=String(turn).padStart(2,'0');$('#phase-title').textContent='PLAYER PHASE';$('#log-status').textContent='STANDBY';setToast('WÄHLE EINE EINHEIT');draw()},650)}
function updateRoster(){const el=$('#unit-roster');el.innerHTML='';units.filter(u=>u.team==='player').forEach(u=>{const card=document.createElement('div');const covered=terrain.has(`${u.x},${u.y}`);card.className=`unit-card ${u.id==='ogre'?'ogre':''} ${u===selected?'active':''} ${u.acted?'acted':''} ${u.hp<=0?'destroyed':''} ${covered&&u.hp>0?'covered':''}`;card.innerHTML=`<div class="unit-token">${u.hp<=0?'×':u.icon}</div><div><span class="unit-name">${u.name}</span><span class="unit-type">${u.hp<=0?'DESTROYED':covered?'COVERED · '+u.type:u.acted?'DONE / NEXT TURN':u.type}</span></div><div class="hp-bar">${Array.from({length:u.maxHp},(_,i)=>`<i class="${i>=u.hp?'off':''}"></i>`).join('')}</div>`;card.onclick=()=>{if(u.hp>0)selectPlayerUnit(u)};el.appendChild(card)});$('#force-count').textContent=String(units.filter(u=>u.team==='player'&&u.hp>0).length).padStart(2,'0');const core=units.find(u=>u.id==='core');const corePct=Math.round((1-core.hp/core.maxHp)*100);$('#objective-text').textContent=core.hp?`CORE ${core.hp}/${core.maxHp} HP`:'CORE OFFLINE';$('#objective-progress').style.width=`${corePct}%`}
function updateSelection(){const el=$('#selection-readout');if(!selected){el.innerHTML='<span class="selection-icon">+</span><div><b>NO UNIT SELECTED</b><small>Wähle eine Einheit für Befehle</small></div>';return}const covered=terrain.has(`${selected.x},${selected.y}`);el.innerHTML=`<span class="selection-icon">${selected.icon}</span><div><b>${selected.name}${covered?' · COVERED':''}</b><small>HP ${selected.hp}/${selected.maxHp} · MOVE ${selected.move} · RANGE ${selected.range}</small></div>`}
function setViewMode(mode){viewMode=mode;document.querySelectorAll('.view-option').forEach(button=>button.classList.toggle('active',button.dataset.view===mode));draw()}
function setToast(t){const el=$('#map-toast');el.textContent=t;el.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.add('hidden'),1300)}
function finish(win){gameOver=true;phase='over';$('#modal-title').textContent=win?'MISSION COMPLETE':'MISSION FAILED';$('#modal-copy').textContent=win?'Der Kommandokern ist verstummt. Iron Dust gehört wieder euch.':'Die Verteidigungslinie ist kollabiert. Starte neu und halte den Goblin länger im Zentrum.';$('#modal').classList.remove('hidden');$('#log-status').textContent=win?'SUCCESS':'CRITICAL';}
function reset(){units.splice(0,units.length,...JSON.parse(JSON.stringify([{id:'ogre',name:'GOBLIN MK III',type:'HEAVY ASSAULT',team:'player',x:1,y:5,hp:5,maxHp:5,range:2,move:1,damage:3,icon:'G'},{id:'gev',name:'GEV SCOUT',type:'HOVERCRAFT',team:'player',x:2,y:6,hp:3,maxHp:3,range:3,move:3,damage:1,icon:'G'},{id:'missile',name:'MISSILE TANK',type:'ARTILLERY',team:'player',x:3,y:6,hp:3,maxHp:3,range:4,move:1,damage:2,icon:'M'},{id:'infantry',name:'INFANTRY PLATOON',type:'MOBILE INFANTRY',team:'player',x:1,y:6,hp:2,maxHp:2,range:1,move:2,damage:1,icon:'I'},{id:'core',name:'COMMAND CORE',type:'FORTIFIED TARGET',team:'enemy',x:10,y:2,hp:5,maxHp:5,range:0,move:0,damage:0,icon:'X',core:true},{id:'guard',name:'GUARD TANK',type:'HOSTILE ARMOR',team:'enemy',x:8,y:3,hp:3,maxHp:3,range:2,move:1,damage:1,icon:'G'},{id:'raider',name:'RAIDER GEV',type:'HOSTILE HOVER',team:'enemy',x:9,y:5,hp:2,maxHp:2,range:2,move:2,damage:1,icon:'R'}])));selected=null;turn=1;phase='player';gameOver=false;$('#modal').classList.add('hidden');$('#turn-number').textContent='01';$('#phase-title').textContent='PLAYER PHASE';$('#log-status').textContent='STANDBY';logEl.innerHTML='';addLog('Mission online. Awaiting command.');updateSelection();draw()}
$('#end-turn').onclick=()=>{if(!gameOver&&phase==='player'){const ready=units.filter(u=>u.team==='player'&&u.hp>0&&!u.acted);if(ready.length&&!window.confirm(`${ready.length} eigene Einheit${ready.length===1?' kann':'en können'} noch handeln. Gegnerzug wirklich starten?`)){setToast('GEGNERZUG ABGEBROCHEN');return}startEnemyTurn()}};$('#reset-game').onclick=reset;$('#modal-reset').onclick=reset;document.querySelectorAll('.view-option').forEach(button=>button.onclick=()=>setViewMode(button.dataset.view));document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=null;updateSelection();draw()}if(e.key.toLowerCase()==='f'&&selected){const target=units.find(u=>u.team==='enemy'&&u.hp>0&&dist(selected,u)<=selected.range);if(target)attack(selected,target)}});addLog('Mission online. Awaiting command.');draw();
