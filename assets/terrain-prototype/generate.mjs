// Original content study: seamless pointy-top hex ground + six-edge network overlays.
// This generator is not loaded by the game.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const baseDir=join(root,'tiles','ground');
const roadsDir=join(root,'tiles','road');
const riversDir=join(root,'tiles','river');
const overlaysDir=join(root,'tiles','special');
for(const folder of [baseDir,roadsDir,riversDir,overlaysDir])await mkdir(folder,{recursive:true});

const R=128,C=128;
const vertices=Array.from({length:6},(_,i)=>{const a=(-90+i*60)*Math.PI/180;return {x:C+R*Math.cos(a),y:C+R*Math.sin(a)}});
const ports=vertices.map((v,i)=>({x:(v.x+vertices[(i+1)%6].x)/2,y:(v.y+vertices[(i+1)%6].y)/2}));
const sides=['NE','E','SE','SW','W','NW'];
const polygon=vertices.map(v=>`${v.x.toFixed(4)},${v.y.toFixed(4)}`).join(' ');
const ground='#616d62';
const terrainTypes=[
  {id:'open-ground',name:'Open Ground',status:'implemented'},
  {id:'rubble-field',name:'Rubble Field',status:'implemented'},
  {id:'mountain',name:'Mountain',status:'existing-cover-rule'},
  {id:'ridge',name:'Ridge',status:'concept'},
  {id:'forest',name:'Forest',status:'concept'},
  {id:'marsh',name:'Marsh',status:'concept'},
  {id:'water',name:'Water / Pond',status:'concept'},
  {id:'urban',name:'Urban',status:'concept'},
  {id:'crater',name:'Crater',status:'concept'},
];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const path=(d,fill,stroke='none',sw=1,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
const line=(d,color,sw=2,extra='')=>path(d,'none',color,sw,`stroke-linecap="round" ${extra}`);
const poly=(points,fill,stroke='none',sw=1,extra='')=>`<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;

function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function sprinkles(seed,kind){
  const rng=random(seed),bits=[];
  const color=kind==='forest'?'#8b9d80':kind==='water'?'#b2c4b9':'#aab4a0';
  for(let i=0;i<28;i++){
    const x=70+rng()*116,y=70+rng()*116,dx=1+rng()*4;
    if((x-128)**2+(y-128)**2>81**2)continue;
    bits.push(line(`M${x.toFixed(1)} ${y.toFixed(1)}l${dx.toFixed(1)} ${(rng()*2-1).toFixed(1)}`,color,.7,'opacity=".34"'));
  }
  return bits.join('');
}

function mountainContours(variant){
  const rng=random(8101+variant*391),rays=19;
  const angles=Array.from({length:rays},(_,i)=>i*Math.PI*2/rays);
  const shape=angles.map(a=>.82+rng()*.34);
  const contour=(cx,cy,rx,ry,rough)=>{
    const points=angles.map((a,i)=>`${(cx+Math.cos(a)*rx*(1+(shape[i]-1)*rough)).toFixed(1)} ${(cy+Math.sin(a)*ry*(1+(shape[i]-1)*rough)).toFixed(1)}`);
    return `M${points.join('L')}Z`;
  };
  const x=128+(variant-1)*7,y=128-(variant-1)*4;
  return `<g transform="rotate(${(variant-1)*13} 128 128)" opacity=".78">
    ${path(contour(x,y,81,69,1.25),'#46564f')}
    ${path(contour(x-2,y-5,70,60,1.05),'#667268','#899487',1.1)}
    ${path(contour(x-7,y-11,55,46,.9),'#818b7b','#b5b8a2',1.5)}
    ${path(contour(x-11,y-15,39,31,.75),'#9da593','#c6c8ae',1.4)}
    ${path(contour(x-15,y-18,20,15,.55),'#bdc1a9')}
    ${line(`M${x-68} ${y+41}q29 34 76 23t69-44`,'#aeb7a2',1.6,'opacity=".65"')}
    ${line(`M${x-49} ${y-43}q42-38 90-3`,'#c2c4ad',1.5,'opacity=".65"')}
  </g>`;
}

function feature(kind,variant){
  const v=variant-1,shift=v*5,rot=v*9;
  if(kind==='open-ground')return `<g opacity=".38">${line('M79 100l15-3m80 52 16 2M101 181l23 1','#8d9b88',2)}${line('M91 138l7-9m9 14 8-8m62-44 7-6','#9ead94',1.5)}</g>`;
  if(kind==='forest'){
    const rng=random(301+variant*471),trees=[];
    for(let i=0;i<15;i++){
      const a=rng()*Math.PI*2,d=Math.sqrt(rng())*81,x=128+Math.cos(a)*d,y=128+Math.sin(a)*d,rr=14+rng()*14;
      trees.push(`<g opacity=".77"><circle cx="${(x+3).toFixed(1)}" cy="${(y+4).toFixed(1)}" r="${(rr*.93).toFixed(1)}" fill="#304b3f"/>${poly(`${x.toFixed(1)},${(y-rr).toFixed(1)} ${(x+rr*.78).toFixed(1)},${(y-rr*.57).toFixed(1)} ${(x+rr).toFixed(1)},${(y+rr*.18).toFixed(1)} ${(x+rr*.36).toFixed(1)},${(y+rr*.86).toFixed(1)} ${(x-rr*.44).toFixed(1)},${(y+rr).toFixed(1)} ${(x-rr).toFixed(1)},${(y+rr*.12).toFixed(1)} ${(x-rr*.75).toFixed(1)},${(y-rr*.6).toFixed(1)}`,[ '#365a49','#426751','#53745a','#476b55'][i%4],'#658168',.7)}<circle cx="${(x-rr*.23).toFixed(1)}" cy="${(y-rr*.28).toFixed(1)}" r="${(rr*.35).toFixed(1)}" fill="#849c70" opacity=".32"/></g>`);
    }
    return trees.join('');
  }
  if(kind==='rubble-field')return `<g transform="translate(${shift} ${-shift})" opacity=".77">${poly('65,111 91,84 115,91 118,124 83,139','#85887d','#505c55',2)}${poly('128,86 166,78 183,109 161,132 130,118','#737b73','#a0a396',1.5)}${poly('103,147 137,134 157,161 128,185 93,173','#798177','#4c5b53',2)}${poly('174,139 193,144 183,170 162,167','#909288','#4c5b53',1.5)}${line('M81 106l24 9m43-23 18 19m-59 50 25-11','#b0ad9e',1.3)}</g>`;
  if(kind==='mountain')return mountainContours(variant);
  if(kind==='ridge')return `<g transform="rotate(${rot} 128 128)" opacity=".76">${path('M53 169Q67 140 97 135T153 102Q181 82 207 88L199 114Q172 122 150 142T97 171L67 187Z','#505f56')}${path('M59 161Q88 138 117 128T174 96L199 94Q176 118 150 133T96 160L68 177Z','#899183')}${line('M60 153Q91 132 122 123T191 94','#bdc0aa',2.2,'opacity=".7"')}${line('M67 179Q99 157 128 148T190 113','#43574f',2,'opacity=".68"')}${line('M57 190Q89 170 118 163T173 133','#a8af9e',1.5,'opacity=".44"')}</g>`;
  if(kind==='marsh')return `<g opacity=".73">${path('M64 117Q84 99 107 116T144 112Q170 100 192 126T177 152Q157 159 138 148T106 158Q78 163 64 142Z','#486d61')}${path('M76 171Q92 154 110 166T144 165Q164 153 181 171T166 191Q148 198 130 186T98 190Q78 192 76 171Z','#4b7168')}${[[75,105],[101,151],[154,104],[184,144],[71,172],[158,186]].map(([x,y])=>line(`M${x} ${y}l5 2m-2-7 1 5`,'#a9b18a',2)).join('')}${line('M78 124q17-10 36 1m29 9q16-8 31 1','#9ab3a4',1.4,'opacity=".42"')}</g>`;
  if(kind==='water')return `<g opacity=".82">${path('M54 126Q64 92 98 83T157 91Q190 104 202 132T182 178Q151 196 114 184T61 159Q50 146 54 126Z','#66847b','#a3ab98',3)}${path('M66 127Q73 99 102 96T158 102Q183 114 188 139T166 171Q137 183 111 172T71 151Q62 140 66 127Z','#3e7276')}${path('M89 122Q109 108 137 113T174 132Q154 123 133 124T99 137Z','#76a2a0','none',0,'opacity=".35"')}</g>`;
  if(kind==='urban')return `<g transform="rotate(${rot*.35} 128 128)" opacity=".75">${[[68,85,43,32],[132,78,45,35],[75,145,54,37],[151,142,35,43]].map(([x,y,w,h],i)=>`<rect x="${x+4}" y="${y+5}" width="${w}" height="${h}" fill="#40554d" opacity=".75"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${i%2?'#858b7c':'#777f75'}" stroke="#b0b2a2" stroke-width="1.1"/>`+line(`M${x+6} ${y+7}h${w-12}`,'#c0bfa9',1.3,'opacity=".56"')+line(`M${x+6} ${y+h-7}h${w-12}`,'#5b6860',1,'opacity=".52"')).join('')}${line('M120 78v111M65 131h127','#5b685d',3,'opacity=".48"')}</g>`;
  if(kind==='crater')return `<g opacity=".75">${path('M128 70q46-2 61 42t-15 65-63 20-53-42 5-65 65-20Z','#72796d','#a5aa99',3)}${path('M127 94q29-6 43 22t-6 48-49 10-35-34 12-41 35-5Z','#465b55','#9ca898',2)}${path('M126 114q18-3 22 17t-14 24-28-17 20-24Z','#53675d')}</g>`;
  return '';
}

function groundSvg(kind,variant){
  const seed=kind.split('').reduce((n,ch)=>n*31+ch.charCodeAt(0),variant+1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${esc(kind)} terrain variant ${variant}"><title>${esc(kind)} · variant ${variant}</title><defs><clipPath id="hex"><polygon points="${polygon}"/></clipPath></defs><g clip-path="url(#hex)">${sprinkles(seed,kind)}${feature(kind,variant)}</g></svg>`;
}

function extended(port){const vx=port.x-C,vy=port.y-C,length=Math.hypot(vx,vy);return {x:port.x+vx/length*5,y:port.y+vy/length*5}}
function branchPath(side){const port=ports[side],end=extended(port),vx=port.x-C,vy=port.y-C,perpX=-vy,perpY=vx;const bend=(side%2===0?1:-1)*.055;const c1x=C+vx*.32+perpX*bend,c1y=C+vy*.32+perpY*bend,c2x=C+vx*.76,c2y=C+vy*.76;return `M128 128C${c1x.toFixed(4)} ${c1y.toFixed(4)} ${c2x.toFixed(4)} ${c2y.toFixed(4)} ${end.x.toFixed(4)} ${end.y.toFixed(4)}`}
function networkSvg(type,mask){
  const active=sides.map((_,i)=>i).filter(i=>mask&(1<<i));
  const paths=active.length===2?(()=>{const pa=ports[active[0]],pb=ports[active[1]],a=extended(pa),b=extended(pb),ax=C+(pa.x-C)*.27,ay=C+(pa.y-C)*.27,bx=C+(pb.x-C)*.27,by=C+(pb.y-C)*.27;return [`M${a.x.toFixed(4)} ${a.y.toFixed(4)}C${ax.toFixed(4)} ${ay.toFixed(4)} ${bx.toFixed(4)} ${by.toFixed(4)} ${b.x.toFixed(4)} ${b.y.toFixed(4)}`]})():active.map(branchPath);
  const color=type==='river'?'#55828a':'#958d7a';
  const width=type==='river'?33:19;
  const waterShine=type==='river'?active.map(i=>{const port=ports[i],x=C+(port.x-C)*.7,y=C+(port.y-C)*.7;return line(`M${(C+(port.x-C)*.22).toFixed(2)} ${(C+(port.y-C)*.22).toFixed(2)}Q${x.toFixed(2)} ${y.toFixed(2)} ${(C+(port.x-C)*.79).toFixed(2)} ${(C+(port.y-C)*.79).toFixed(2)}`,'#a2b6aa',1.5,'opacity=".46"')}).join(''):'';
  const art=mask===0?'':`<g>${paths.map(d=>`<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="butt"/>`).join('')}${active.length>2?`<circle cx="128" cy="128" r="${width/2}" fill="${color}"/>`:''}${waterShine}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${type} connections mask ${mask}"><title>${type} · mask ${mask}</title><defs><clipPath id="hex"><polygon points="${polygon}"/></clipPath></defs>${art}</svg>`;
}

const bridgeSvg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="bridge deck"><title>Bridge deck</title><path d="M78 110h100v36H78z" fill="#555d58" stroke="#b3b5a5" stroke-width="3"/><path d="M78 115h100v26H78z" fill="#948d7b"/><path d="M84 108h88m-88 40h88" stroke="#c5c1ab" stroke-width="3"/><path d="M95 119v18m22-18v18m22-18v18m22-18v18" stroke="#777c72" stroke-width="2" opacity=".7"/></svg>`;

const neighbor=(x,y,side)=>{const odd=(y&1)===1;return [ {x:x+(odd?1:0),y:y-1},{x:x+1,y},{x:x+(odd?1:0),y:y+1},{x:x-(odd?0:1),y:y+1},{x:x-1,y},{x:x-(odd?0:1),y:y-1} ][side]};
const key=(x,y)=>`${x},${y}`;
const roadCells=new Set(Array.from({length:14},(_,x)=>key(x,5)));
roadCells.add(key(-1,5));roadCells.add(key(14,5));
for(const [x,y] of [[10,4],[10,3],[11,2]])roadCells.add(key(x,y));
const riverCells=new Set(Array.from({length:10},(_,y)=>key(6,y)));
riverCells.add(key(6,-1));riverCells.add(key(6,10));
const bridgeCell=key(6,5);
const patches=new Map();
const paint=(kind,test)=>{for(let y=0;y<10;y++)for(let x=0;x<14;x++)if(test(x,y))patches.set(key(x,y),kind)};
paint('forest',(x,y)=>x>=1&&x<=4&&y>=1&&y<=3&&(x+y)%5!==0);
paint('mountain',(x,y)=>x>=9&&x<=11&&y<=2&&x+y<13);
paint('ridge',(x,y)=>x>=8&&x<=11&&y>=2&&y<=4);
paint('marsh',(x,y)=>x>=1&&x<=4&&y>=7);
paint('urban',(x,y)=>x>=10&&x<=12&&y>=6&&y<=8);
paint('rubble-field',(x,y)=>x>=8&&x<=10&&y>=4&&y<=6);
paint('water',(x,y)=>(x===5||x===7)&&y===0);
paint('crater',(x,y)=>x===8&&y===7);
const units=[
  {assetId:'goblin-siegebreaker',team:'player',x:2,y:5,callsign:'G-1'},
  {assetId:'skimmer-scout',team:'player',x:3,y:3,callsign:'S-2'},
  {assetId:'assault-tank',team:'player',x:4,y:6,callsign:'A-3'},
  {assetId:'rocket-artillery',team:'player',x:2,y:8,callsign:'R-4'},
  {assetId:'infantry-squad',team:'player',x:5,y:6,callsign:'I-5'},
  {assetId:'guard-tank',team:'enemy',x:10,y:4,callsign:'G-6'},
  {assetId:'raider-skimmer',team:'enemy',x:11,y:7,callsign:'R-7'},
  {assetId:'command-core',team:'enemy',x:12,y:2,callsign:'CORE'},
];
const maskFor=(x,y,cells)=>sides.reduce((mask,_,side)=>{const n=neighbor(x,y,side);return cells.has(key(n.x,n.y))?mask|(1<<side):mask},0);
const cells=[];
for(let y=0;y<10;y++)for(let x=0;x<14;x++)cells.push({x,y,ground:patches.get(key(x,y))||'open-ground',variant:(x*7+y*11)%3,roadMask:roadCells.has(key(x,y))?maskFor(x,y,roadCells):0,riverMask:riverCells.has(key(x,y))?maskFor(x,y,riverCells):0,bridge:key(x,y)===bridgeCell});

// A connected network must expose the same port on both sides of every shared edge.
for(const cell of cells)for(const [field,network] of [['roadMask',roadCells],['riverMask',riverCells]])for(let side=0;side<6;side++){
  const n=neighbor(cell.x,cell.y,side),connected=network.has(key(cell.x,cell.y))&&network.has(key(n.x,n.y));
  if(Boolean(cell[field]&(1<<side))!==connected)throw Error(`Invalid ${field} at ${cell.x},${cell.y} side ${side}`);
  if(connected){
    const back=neighbor(n.x,n.y,(side+3)%6);
    if(back.x!==cell.x||back.y!==cell.y)throw Error(`Non-reciprocal hex topology ${cell.x},${cell.y} side ${side} via ${n.x},${n.y} back ${back.x},${back.y}`);
    const centerX=(x,y)=>x*Math.sqrt(3)*R+((y&1)?Math.sqrt(3)*R/2:0),centerY=y=>y*1.5*R;
    const a=ports[side],b=ports[(side+3)%6];
    if(Math.hypot(centerX(cell.x,cell.y)+a.x-centerX(n.x,n.y)-b.x,centerY(cell.y)+a.y-centerY(n.y)-b.y)>1e-6)throw Error('Connection ports do not meet');
  }
}

function mapHtml(showUnits=true){
  const radius=31,dx=Math.sqrt(3)*radius,dy=1.5*radius,ox=44,oy=42;
  const cx=(x,y)=>ox+x*dx+(y%2?dx/2:0),cy=y=>oy+y*dy;
  const width=Math.ceil(ox+13.5*dx+radius+24),height=Math.ceil(oy+9*dy+radius+35);
  const tile=cell=>{const x=cx(cell.x,cell.y)-radius,y=cy(cell.y)-radius,fmt=v=>Number(v.toFixed(3));const base=`<image href="tiles/ground/${cell.ground}-${cell.variant}.svg" x="${fmt(x)}" y="${fmt(y)}" width="${2*radius}" height="${2*radius}"/>`;const river=riverCells.has(key(cell.x,cell.y))?`<image href="tiles/river/mask-${String(cell.riverMask).padStart(2,'0')}.svg" x="${fmt(x)}" y="${fmt(y)}" width="${2*radius}" height="${2*radius}"/>`:'';const road=roadCells.has(key(cell.x,cell.y))?`<image href="tiles/road/mask-${String(cell.roadMask).padStart(2,'0')}.svg" x="${fmt(x)}" y="${fmt(y)}" width="${2*radius}" height="${2*radius}"/>`:'';const bridge=cell.bridge?`<image href="tiles/special/bridge-deck.svg" x="${fmt(x)}" y="${fmt(y)}" width="${2*radius}" height="${2*radius}"/>`:'';return base+river+road+bridge};
  const token=u=>{const x=cx(u.x,u.y),y=cy(u.y),color=u.team==='player'?'#d5f08a':'#ff8069';return `<g><circle cx="${x}" cy="${y}" r="20" fill="#112129" fill-opacity=".97" stroke="${color}" stroke-width="3.2"/><image href="../unit-art/sets/01-modular-stealth-geometry/icons/${u.assetId}.svg" x="${x-18}" y="${y-18}" width="36" height="36"/><title>${u.callsign}: ${u.assetId}</title></g>`};
  const washColors={forest:'#315b43',mountain:'#80776a',ridge:'#786f63',marsh:'#536b4e',urban:'#777467','rubble-field':'#777a6f',water:'#3c7580',crater:'#737365'};
  const defs=`<defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="17" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".11"/></feComponentTransfer></filter>${Object.entries(washColors).map(([id,color])=>`<radialGradient id="wash-${id}"><stop offset="0" stop-color="${color}" stop-opacity=".54"/><stop offset=".58" stop-color="${color}" stop-opacity=".29"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`).join('')}</defs>`;
  const washes=cells.filter(cell=>washColors[cell.ground]).map(cell=>`<circle cx="${cx(cell.x,cell.y).toFixed(3)}" cy="${cy(cell.y).toFixed(3)}" r="${(radius*1.95).toFixed(2)}" fill="url(#wash-${cell.ground})"/>`).join('');
  const contours=`<g fill="none" stroke="#b8bba9" stroke-width="1" opacity=".13"><path d="M0 176C154 126 250 220 405 169S683 176 ${width} 123"/><path d="M0 215C169 166 231 264 419 210S720 217 ${width} 163"/><path d="M0 388C193 339 254 425 433 370S707 399 ${width} 353"/><path d="M0 429C150 387 269 464 462 412S711 437 ${width} 394"/></g>`;
  const map=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Nahtlose Hexkarte mit Straße, Fluss, Brücke und Einheiten">${defs}<rect width="100%" height="100%" fill="${ground}"/><image href="ashland-ground.png" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity=".61"/><rect width="100%" height="100%" fill="#496054" opacity=".14"/>${washes}${contours}${cells.map(tile).join('')}${showUnits?units.map(token).join(''):''}</svg>`;
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASHLAND · Seamless Hex Terrain</title><style>body{margin:0;background:#0b171b;color:#e4e9df;font:15px/1.5 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:25px}h1{margin:0;font-size:27px;letter-spacing:.08em}.sub{color:#aac0b2;margin:5px 0 18px}svg{display:block;width:100%;height:auto;border:1px solid #344d4a}.foot{display:flex;justify-content:space-between;gap:20px;color:#aabeb1;font-size:13px;margin-top:12px}.foot b{color:#d8ed9d}@media(max-width:650px){.foot{display:block}}</style><main><h1>ASHLAND / TERRAIN STUDY 01</h1><p class="sub">Ruhiges Luftbild-Terrain · durchgehende Straße und Fluss · keine sichtbaren Hexkanten · ${showUnits?'Einheiten über dem Gelände':'Gelände ohne Einheiten'}</p>${map}<div class="foot"><span><b>GRÜN</b> eigene Einheit · <b style="color:#ff8069">KORALLE</b> Gegner · Hexraster optional</span><span>14 × 10 · statische Designvorschau · keine Spielregeln</span></div></main></html>`;
}

function sheetHtml(){
  const sampleMasks=[0,1,9,18,36,63],base=terrainTypes.map(t=>`<figure><img src="tiles/ground/${t.id}-0.svg"><figcaption>${t.name}</figcaption></figure>`).join('');
  const network=(type)=>sampleMasks.map(m=>`<figure><span class="sample"><img src="tiles/ground/open-ground-0.svg"><img src="tiles/${type}/mask-${String(m).padStart(2,'0')}.svg"></span><figcaption>${type.toUpperCase()} · ${m.toString(2).padStart(6,'0')}</figcaption></figure>`).join('');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASHLAND · Tile Set</title><style>body{background:#0b171b;color:#e4e9df;font:14px system-ui,sans-serif;margin:0}main{max-width:1400px;margin:auto;padding:28px}h1{letter-spacing:.08em}p{color:#aebeb0}section{border-top:1px solid #38504b;margin-top:24px;padding-top:8px}.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}figure{background:#616d62 url('ashland-ground.png') center/cover;margin:0;padding:10px;text-align:center}img{width:170px;max-width:100%}.sample{display:block;position:relative;width:170px;max-width:100%;margin:auto}.sample img:last-child{position:absolute;inset:0}figcaption{font-size:11px;letter-spacing:.08em;text-transform:uppercase;background:#0b171b;padding:3px}@media(max-width:750px){.grid{grid-template-columns:repeat(3,1fr)}}</style><main><h1>ASHLAND · Seamless Hex Set</h1><p>9 Grundgelände × 3 Varianten; Straßen und Flüsse als transparente 6-Kanten-Verbindungs-Overlays (je 64 Masken). Die gemeinsame Grundtextur liegt unter den transparenten Hexdetails.</p><section><h2>Grundgelände</h2><div class="grid">${base}</div></section><section><h2>Straße</h2><div class="grid">${network('road')}</div></section><section><h2>Fluss</h2><div class="grid">${network('river')}</div></section></main></html>`;
}

for(const terrain of terrainTypes)for(let variant=0;variant<3;variant++)await writeFile(join(baseDir,`${terrain.id}-${variant}.svg`),groundSvg(terrain.id,variant),'utf8');
for(let mask=0;mask<64;mask++)for(const [type,folder] of [['road',roadsDir],['river',riversDir]])await writeFile(join(folder,`mask-${String(mask).padStart(2,'0')}.svg`),networkSvg(type,mask),'utf8');
await writeFile(join(overlaysDir,'bridge-deck.svg'),bridgeSvg,'utf8');
await writeFile(join(root,'map.json'),JSON.stringify({schemaVersion:1,name:'ASHLAND / Terrain Study 01',width:14,height:10,edgeOrder:sides,background:ground,cells,units},null,2)+'\n','utf8');
await writeFile(join(root,'manifest.json'),JSON.stringify({schemaVersion:1,style:'Ashland Survey',geometry:'pointy-top odd-row-offset',edgeOrder:sides,bitRule:'bit i corresponds to edgeOrder[i]',ground:terrainTypes,groundVariants:3,roadMasks:64,riverMasks:64,paths:{continuousGround:'ashland-ground.png',ground:'tiles/ground/{terrain}-{variant}.svg',road:'tiles/road/mask-{mask:02}.svg',river:'tiles/river/mask-{mask:02}.svg',bridge:'tiles/special/bridge-deck.svg'},layerOrder:['continuousGround','ground','river','road','bridge','units'],gameIntegration:'prototype only'},null,2)+'\n','utf8');
await writeFile(join(root,'map.html'),mapHtml(true),'utf8');
await writeFile(join(root,'map-terrain-only.html'),mapHtml(false),'utf8');
await writeFile(join(root,'set.html'),sheetHtml(),'utf8');
console.log(`Generated ${terrainTypes.length*3+64+64+1} SVG tiles and checked all map connections.`);
