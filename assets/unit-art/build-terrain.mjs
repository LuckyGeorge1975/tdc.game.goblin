// Content-only generator for interchangeable map terrain symbols and a static level preview.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
const level = JSON.parse(await readFile(join(root,'levels','atlas-proving-grounds.json'),'utf8'));
const palettes = [
  { id:'01-modular-stealth-geometry', base:'#182830', field:'#263d42', line:'#93b3af', accent:'#c9ef54', water:'#47b5c7', secondary:'#728b87', mode:'stealth' },
  { id:'02-industrial-exoframe', base:'#213039', field:'#46545a', line:'#b1b9b8', accent:'#f4a24d', water:'#5caabd', secondary:'#87938d', mode:'frame' },
  { id:'03-monolithic-facet', base:'#192522', field:'#3b4840', line:'#a4aea1', accent:'#ff795a', water:'#4ca69f', secondary:'#7e8b7b', mode:'facet' },
  { id:'04-autonomous-drone-corps', base:'#27393c', field:'#778e89', line:'#d5e9df', accent:'#40b9ff', water:'#4aaed1', secondary:'#a4c3bb', mode:'drone' },
  { id:'05-aerospace-ground-force', base:'#1d2b32', field:'#717c7c', line:'#e4e8de', accent:'#ff605b', water:'#50a4c1', secondary:'#b4c0ba', mode:'aero' },
];
const terrains = [
  {id:'open-ground',name:'Open ground',status:'implemented',rulesKey:'open',description:'Freies Gelände ohne Deckung.'},
  {id:'rubble-field',name:'Rubble field',status:'implemented',rulesKey:'cover',description:'Trümmer und Deckung; derzeit mit dem Berg-/Trümmerfeld-Regelsatz.'},
  {id:'mountain',name:'Mountain',status:'implemented-as-cover',rulesKey:'cover',description:'Fels-/Bergmotiv; derzeit mit dem Berg-/Trümmerfeld-Regelsatz.'},
  {id:'ridge',name:'Ridge',status:'concept',rulesKey:null,description:'Höhenrücken; spätere Sicht- und Bewegungsregeln offen.'},
  {id:'forest',name:'Forest',status:'concept',rulesKey:null,description:'Dichter Bewuchs; spätere Deckungsregeln offen.'},
  {id:'marsh',name:'Marsh',status:'concept',rulesKey:null,description:'Feuchtgebiet; spätere Bewegungsregeln offen.'},
  {id:'water',name:'Water',status:'concept',rulesKey:null,description:'Gewässer; spätere Fahr- und Infanterieregeln offen.'},
  {id:'river',name:'River',status:'concept',rulesKey:null,description:'Flusslauf als Kartenfeld; Querungsregeln offen.'},
  {id:'road',name:'Road',status:'concept',rulesKey:null,description:'Befestigter Verkehrsweg; spätere Bewegungsboni offen.'},
  {id:'bridge',name:'Bridge',status:'concept',rulesKey:null,description:'Brückensegment; spätere Brücken- und Querungsregeln offen.'},
  {id:'urban',name:'Urban',status:'concept',rulesKey:null,description:'Gebautes Gebiet; spätere Kampf- und Deckungsregeln offen.'},
  {id:'crater',name:'Crater',status:'concept',rulesKey:null,description:'Einschlagkrater; spätere Geländeregeln offen.'},
];
const hex='128,8 232,68 232,188 128,248 24,188 24,68';
const p=(pts,fill,stroke='none',sw=1,extra='')=>`<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="bevel" ${extra}/>`;
const q=(d,stroke,sw=4,extra='')=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="bevel" stroke-linecap="square" ${extra}/>`;
const r=(x,y,w,h,fill,stroke='none',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

function symbol(terrain,c) {
  const a=c.accent,l=c.line,s=c.secondary,w=c.water,b=c.base,f=c.field;
  switch(terrain.id) {
    case 'open-ground': return q('M60 104h38m44-30h39M79 171h47m40-8h22',s,5)+p('118,103 128,95 138,103 128,111',a)+q('M69 133h18m96-7h13M117 184h24',l,2.5);
    case 'rubble-field': return p('62,139 90,87 120,99 137,143 95,171',s,l,4)+p('138,84 183,99 199,145 164,161 130,131',f,l,4)+p('74,171 106,154 129,184 108,204',b,l,3)+q('M92 96l31 46m39-37 16 38m-89 23 30 19',a,3);
    case 'mountain': return p('49,174 100,69 139,146 166,99 210,179',s,l,5)+p('100,69 121,113 88,113',a)+p('166,99 184,139 150,129',a)+q('M55 194h151M93 130l-23 45m98-41 23 45',l,3);
    case 'ridge': return p('38,168 75,139 92,124 122,103 154,120 184,87 217,126 217,164 183,134 155,166 126,147 87,182 54,187',s,l,4)+q('M47 204 91 161l32-25 31 13 30-35 28 27',a,5)+q('M65 112h31m54 74h35',l,2);
    case 'forest': return [[83,106],[140,93],[183,130],[104,170],[157,177]].map(([x,y],i)=>p(`${x},${y-38} ${x+25},${y-5} ${x+15},${y-5} ${x+31},${y+15} ${x-31},${y+15} ${x-15},${y-5} ${x-25},${y-5}`,i%2?a:s,l,2.5)+q(`M${x} ${y+15}v13`,l,3)).join('');
    case 'marsh': return p('57,145 81,126 108,136 132,119 169,130 192,111 209,144 194,176 158,183 127,169 99,185 68,174',w,'none',0,'opacity=".5"')+q('M57 166q28-12 52 1t47-5 47 1M70 190q23-10 46 0t43-4 34 4',l,3)+[76,113,158,186].map((x,i)=>q(`M${x} ${139+i%2*9}l-5-25m5 25 7-20`,a,3)).join('');
    case 'water': return p('49,100 93,88 132,101 179,85 208,107 208,178 169,192 123,178 76,194 49,174',w,'none',0,'opacity=".48"')+q('M48 110q25-11 50 0t50 0 60 0M47 144q28-12 54 0t50 0 58 0M53 177q24-11 48 0t50 0 56 0',l,4)+q('M68 122h19m53 41h23',a,2);
    case 'river': return p('99,31 162,30 150,82 173,112 147,153 161,218 98,226 109,164 85,120 111,83',w,l,3,'opacity=".86"')+q('M114 37 124 77l-13 43 15 38-9 51M148 39l-11 42 10 36-15 38 7 58',a,2.5,'opacity=".7"');
    case 'road': return p('29,144 77,114 118,126 166,96 228,111 228,156 169,140 124,171 73,160 29,190',s,l,4)+q('M43 165 78 137l45 13 46-33 47 17',a,5,'stroke-dasharray="14 14"')+q('M37 189 75 160m94-20 53 17',l,2);
    case 'bridge': return p('96,29 166,29 150,93 168,156 154,220 92,222 108,159 89,96',w,'none',0,'opacity=".65"')+p('31,121 79,109 127,122 176,108 225,125 225,162 176,149 128,163 79,150 31,162',s,l,4)+[68,98,128,158,188].map(x=>q(`M${x} 119v34`,b,3)).join('')+q('M39 141 80 129l48 14 48-14 41 12',a,3,'stroke-dasharray="9 12"');
    case 'urban': return [[61,74,42,42],[120,67,38,50],[172,80,32,40],[73,140,43,46],[137,141,55,42]].map(([x,y,ww,hh],i)=>r(x,y,ww,hh,i%2?s:f,l,3)+q(`M${x+8} ${y+10}h${ww-16}m-${ww-16} 11h${ww-16}`,a,2)).join('')+q('M113 72v112m53-70v29',b,4);
    case 'crater': return p('128,51 181,71 206,118 192,174 147,206 89,199 50,159 54,105 83,69',s,l,4)+p('128,80 164,94 179,125 165,162 133,181 92,169 74,138 83,103',b,a,5)+p('128,106 153,115 156,141 128,157 105,141 101,115',f,l,2)+q('M62 88 44 72m140 13 20-20M55 173l-19 19m151-17 20 21',a,3);
  }
}

function svg(terrain,c) {
  const border=c.mode==='frame'?6:c.mode==='drone'?3:4;
  const base=p(hex,c.base,c.line,border,'opacity=".92"');
  const interior=p('128,22 220,75 220,181 128,234 36,181 36,75',c.field,'none',0,'opacity=".7"');
  let deco='';
  if(c.mode==='frame') deco=q('M39 80h21m136 0h21M39 176h21m136 0h21',c.accent,4);
  if(c.mode==='facet') deco=p('128,22 220,75 179,110 128,81 77,110 36,75',c.secondary,'none',0,'opacity=".22"');
  if(c.mode==='drone') deco=q('M128 20v20m0 174v20M38 128h17m146 0h17',c.accent,3)+p('128,28 135,34 128,40 121,34',c.accent);
  if(c.mode==='aero') deco=q('M55 73 128 32l73 41M55 183l73 41 73-41',c.line,2,'opacity=".6"');
  if(c.mode==='stealth') deco=q('M45 90V76l18-10m130 0 18 10v14M45 166v14l18 10m130 0 18-10v-14',c.accent,2.5);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${terrain.name}, ${c.id}"><title>${terrain.name} · ${c.id}</title>${base}${interior}${deco}${symbol(terrain,c)}</svg>`;
}

function terrainGallery(){return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G.O.B.L.I.N. · Terrain Sets</title><style>body{background:#0a1217;color:#e4ece8;font:14px system-ui,sans-serif;margin:0}main{max-width:1520px;margin:auto;padding:30px}h1{letter-spacing:.08em}section{padding:18px 0;border-top:1px solid #30474c}.tiles{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}article{background:#15262c;padding:10px;text-align:center}img{width:150px;max-width:100%}b{display:block;text-transform:uppercase;font-size:11px;letter-spacing:.08em}small{color:#8eaaa5}@media(max-width:900px){.tiles{grid-template-columns:repeat(3,1fr)}}</style><main><h1>G.O.B.L.I.N. · Terrain-Icons</h1><p>12 Geländemotive in fünf austauschbaren Stilen. Neue Typen sind Content-Konzepte, keine bereits implementierten Regeln.</p>${palettes.map(c=>`<section><h2>${manifest.styles.find(s=>s.id===c.id).title}</h2><div class="tiles">${terrains.map(t=>`<article><img src="sets/${c.id}/terrain/${t.id}.svg" alt="${t.name}"><b>${t.name}</b><small>${t.status}</small></article>`).join('')}</div></section>`).join('')}</main></html>`}

function levelPreview(){
  const S=28,dx=Math.sqrt(3)*S,dy=1.5*S,width=Math.ceil((level.width+.8)*dx+80),height=Math.ceil((level.height+1.3)*dy+65);
  const terrainAt=new Map(level.terrain.map(t=>[`${t.x},${t.y}`,t.type]));
  const hexes=[];
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){
    const cx=45+x*dx+(y%2?dx/2:0),cy=42+y*dy,terrain=terrainAt.get(`${x},${y}`)||'open-ground';
    hexes.push(`<image href="sets/01-modular-stealth-geometry/terrain/${terrain}.svg" x="${cx-S}" y="${cy-S}" width="${2*S}" height="${2*S}"/><text x="${cx-17}" y="${cy+19}" fill="#b7cbc3" font-size="6" opacity=".7">${String.fromCharCode(65+x)}${y+1}</text>`);
  }
  const units=level.units.map(u=>{const cx=45+u.x*dx+(u.y%2?dx/2:0),cy=42+u.y*dy,color=u.team==='player'?'#c9ef54':'#ff795a';return `<polygon points="${cx},${cy-17} ${cx+16},${cy-8} ${cx+16},${cy+8} ${cx},${cy+17} ${cx-16},${cy+8} ${cx-16},${cy-8}" fill="#0b151b" stroke="${color}" stroke-width="2.7"/><image href="sets/01-modular-stealth-geometry/icons/${u.assetId}.svg" x="${cx-15}" y="${cy-15}" width="30" height="30"/><title>${u.name} · ${u.team} · ${String.fromCharCode(65+u.x)}-${u.y+1}</title>`}).join('');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ATLAS · Content Level</title><style>body{margin:0;background:#091218;color:#dfe9e5;font:14px/1.45 system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:28px}h1{letter-spacing:.08em}svg{width:100%;height:auto;background:#0e1c22;border:1px solid #385155}.legend{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.legend span{padding:8px;background:#182a31}p{color:#9db3ae}</style><main><h1>${level.title}</h1><p>${level.description}</p><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Showcase-Level mit allen Terrain- und Einheitentypen">${hexes.join('')}${units}</svg><p>Grün: eigene Einheiten · Koralle: gegnerische Einheiten. Das ist eine statische Content-Vorschau, kein spielbares Szenario.</p><div class="legend">${terrains.map(t=>`<span>${t.name}</span>`).join('')}</div></main></html>`;
}

for(const c of palettes){const folder=join(root,'sets',c.id,'terrain');await mkdir(folder,{recursive:true});for(const terrain of terrains)await writeFile(join(folder,terrain.id+'.svg'),svg(terrain,c),'utf8')}
manifest.viewFormats.terrain='256×256 SVG · transparent outside hex · map tile';
manifest.terrain=terrains;
manifest.pathPattern.terrain='sets/{style}/terrain/{terrain}.svg';
manifest.levels=[{id:level.id,title:level.title,path:'levels/atlas-proving-grounds.json',preview:'level-preview.html',status:'content-specification'}];
await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
await writeFile(join(root,'terrain-gallery.html'),terrainGallery(),'utf8');
await writeFile(join(root,'level-preview.html'),levelPreview(),'utf8');
console.log(`Generated ${palettes.length*terrains.length} terrain SVGs, gallery and static level preview.`);
