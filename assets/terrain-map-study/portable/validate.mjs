import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const read=async path=>JSON.parse(await readFile(join(here,path),'utf8'));
const fail=message=>{throw Error(message)};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validBox=b=>b&&['x','y','width','height'].every(k=>finite(b[k]))&&b.width>0&&b.height>0;

const packageManifest=await read('manifest.json');
if(packageManifest.schemaVersion!==1||packageManifest.visualMap!=='visual-map.json')fail('Invalid portable manifest');
const map=await read(packageManifest.visualMap);
if(map.schemaVersion!==1||map.mapId!=='terrain-study-02'||!validBox(map.bounds))fail('Invalid VisualMap header');
if(map.hexLayout?.orientation!=='pointy-top'||map.hexLayout?.offset!=='odd-row'||map.hexLayout?.radius!==62)fail('Invalid hex layout');
if(!Array.isArray(map.features)||map.features.length<15)fail('Missing features');
const ids=new Set(),kinds=new Set(),layers=new Set();
const allowedLayers=['ground','ground-grain','elevation','forest','water','routes','objects'];
for(const f of map.features){
  if(!f.id||ids.has(f.id))fail(`Duplicate/missing feature id: ${f.id}`);
  ids.add(f.id);kinds.add(f.kind);layers.add(f.layer);
  if(!allowedLayers.includes(f.layer))fail(`Unsupported layer: ${f.layer}`);
  if(!Number.isInteger(f.zOrder)||!validBox(f.bounds))fail(`Invalid order/bounds: ${f.id}`);
  if(f.geometry?.type==='path'){
    if(typeof f.geometry.d!=='string'||!f.geometry.d.startsWith('M'))fail(`Invalid path: ${f.id}`);
  }else if(f.geometry?.type==='polygon'){
    if(!Array.isArray(f.geometry.points)||f.geometry.points.length<3)fail(`Invalid polygon: ${f.id}`);
    for(const {x,y} of f.geometry.points){
      if(!finite(x)||!finite(y)||x<f.bounds.x||x>f.bounds.x+f.bounds.width||y<f.bounds.y||y>f.bounds.y+f.bounds.height)fail(`Polygon outside bounds: ${f.id}`);
    }
  }else fail(`Unsupported geometry: ${f.id}`);
  if(f.bounds.x>map.bounds.x+map.bounds.width||f.bounds.y>map.bounds.y+map.bounds.height||f.bounds.x+f.bounds.width<map.bounds.x||f.bounds.y+f.bounds.height<map.bounds.y)fail(`Feature outside map: ${f.id}`);
}
for(const needed of ['river','road','bridge','forest','lake','elevation','building'])if(!kinds.has(needed))fail(`Missing acceptance feature: ${needed}`);
const styleIds=new Set();
const detailPositions={};
for(const entry of packageManifest.styleSets){
  if(!/^styles\/[a-z0-9-]+\.json$/.test(entry.path))fail('Style path must stay relative');
  const style=await read(entry.path);
  if(style.schemaVersion!==1||style.setId!==entry.setId||!style.name||styleIds.has(style.setId)||style.mapId!==map.mapId)fail(`Invalid style header: ${entry.path}`);
  styleIds.add(style.setId);
  if('features' in style||'hexTerrain' in style||'rules' in style)fail(`Style contains geometry or rule data: ${style.setId}`);
  for(const kind of kinds)if(!style.tokens?.kinds?.[kind])fail(`Missing style token ${style.setId}/${kind}`);
  for(const layer of layers)if(!style.tokens?.layers?.[layer])fail(`Missing layer token ${style.setId}/${layer}`);
  const allowedPaint=new Set(['fill','stroke','strokeWidth','opacity','detail']);
  for(const group of ['layers','kinds'])for(const [key,token] of Object.entries(style.tokens[group]))for(const field of Object.keys(token))if(!allowedPaint.has(field))fail(`Unsupported paint field ${style.setId}/${group}/${key}/${field}`);
  const assets=style.detailAssets;
  if(!assets||Object.keys(assets).sort().join(',')!=='forest,ground-grain')fail(`Missing detail assets: ${style.setId}`);
  for(const layer of ['ground-grain','forest']){
    const asset=assets[layer],prefix='assets/terrain-map-study/portable/';
    if(!asset||!asset.path.startsWith(prefix)||!/^assets\/[a-z0-9/-]+\.svg$/.test(asset.path)||asset.path.includes('..'))fail(`Unsafe detail path: ${style.setId}/${layer}`);
    if(JSON.stringify(asset.bounds)!==JSON.stringify(map.bounds))fail(`Detail bounds differ from map: ${style.setId}/${layer}`);
    const svg=await readFile(join(here,asset.path.slice(prefix.length)),'utf8');
    if(!svg.includes(`viewBox="0 0 ${map.bounds.width} ${map.bounds.height}"`)||svg.includes('<rect')||svg.includes('href=')||svg.includes('<image'))fail(`Invalid transparent global detail SVG: ${style.setId}/${layer}`);
    if(layer==='forest'&&(!svg.includes('clip-path="url(#woods)"')||!map.features.filter(f=>f.kind==='forest').every(f=>svg.includes(f.geometry.d))))fail(`Forest detail does not clip to canonical shapes: ${style.setId}`);
    const positions=[...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)].map(m=>`${m[1]},${m[2]},${m[3]}`).join('|');
    if(!positions)fail(`No detail points: ${style.setId}/${layer}`);
    if(detailPositions[layer]&&detailPositions[layer]!==positions)fail(`Sets have different detail positions: ${layer}`);
    detailPositions[layer]=positions;
  }
}
if(styleIds.size!==2||!styleIds.has('verdant')||!styleIds.has('dryland'))fail('Expected two style sets');
console.log(`Valid VisualMap: ${map.features.length} stable features, ${kinds.size} kinds, ${layers.size} layers, ${styleIds.size} interchangeable sets.`);
