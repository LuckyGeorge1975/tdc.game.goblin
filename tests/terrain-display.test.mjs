import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('assets/terrain-icons/manifest.json', root), 'utf8'));
const displaySource = readFileSync(new URL('terrain-display.js', root), 'utf8');

class Element {
  constructor(tag, namespaceURI = '') {
    this.tag = tag; this.namespaceURI = namespaceURI;
    this.children = []; this.attributes = {}; this.dataset = {};
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, callback) { this[`on${name}`] = callback; }
  remove() { this.removed = true; }
}

function setup() {
  let language = 'de';
  const document = {
    createElement: tag => new Element(tag),
    createElementNS: (ns, tag) => new Element(tag, ns)
  };
  const labels = {de: 'GELÄNDE', en: 'TERRAIN'};
  const context = {document, UnitVisuals:{terrainAssetFor:id=>`assets/fallback/${id}.svg`},
    TerrainRules:{get:id=>({label:id.toUpperCase()})},
    GoblinLanguage:{get current(){return language;},
      t:key=>key==='v2.ui.terrain'?labels[language]:key.startsWith('v2.ui.terrain.')?
        `${language}:${key.slice('v2.ui.terrain.'.length)}`:key,
      translate:value=>value}};
  context.globalThis = context;
  runInNewContext(`${displaySource}\nglobalThis.display = TerrainDisplay;`, context);
  return {display:context.display, context, setLanguage:value=>{language=value;}};
}

test('all twelve display entries match the pinned ID, icon and original mapping', () => {
  const {display} = setup();
  assert.equal(Object.keys(display.types).length, 12);
  assert.deepEqual(Object.keys(display.types), Object.keys(manifest.types));
  for (const [id, item] of Object.entries(manifest.types)) {
    assert.equal(display.entry(id).key, `v2.ui.terrain.${id}`);
    assert.equal(display.entry(id).icon, item.icon);
    assert.equal(display.entry(id).source, item.source);
  }
  assert.deepEqual(Array.from(display.activeIds(['road','rubble-field','open-ground','water'], true)),
    ['open-ground','rubble-field']);
  assert.equal(display.entry('unknown'), null);
  assert.equal(display.label('unknown'), 'GELÄNDE');
});

test('twelve terrain labels are keyed in all four languages', async () => {
  const source = readFileSync(new URL('localization.js', root), 'utf8');
  const document = {currentScript:{src:'https://example.test/localization.js'},
    readyState:'loading',addEventListener(){}};
  const context = {document, URL, URLSearchParams, Intl, console, navigator:{language:'de'},
    location:{href:'https://example.test/'},
    fetch:async()=>({ok:true,json:async()=>({messages:{}})})};
  context.globalThis = context;
  runInNewContext(source, context);
  await context.GoblinLanguage.ready;
  const expected = {
    'open-ground':['OFFENES GELÄNDE','OPEN GROUND','TERRENO ABIERTO','TERRAIN DÉGAGÉ'],
    'rubble-field':['TRÜMMERFELD','RUBBLE FIELD','CAMPO DE ESCOMBROS','CHAMP DE DÉCOMBRES'],
    mountain:['BERG','MOUNTAIN','MONTAÑA','MONTAGNE'],
    ridge:['HÖHENRÜCKEN','RIDGE','CRESTA','CRÊTE'],
    forest:['WALD','FOREST','BOSQUE','FORÊT'],
    marsh:['SUMPF','MARSH','PANTANO','MARAIS'],
    water:['WASSER','WATER','AGUA','EAU'],
    river:['FLUSS','RIVER','RÍO','RIVIÈRE'],
    road:['STRASSE','ROAD','CARRETERA','ROUTE'],
    bridge:['BRÜCKE','BRIDGE','PUENTE','PONT'],
    urban:['STADTGEBIET','URBAN AREA','ZONA URBANA','ZONE URBAINE'],
    crater:['KRATER','CRATER','CRÁTER','CRATÈRE']
  };
  for (const [id, values] of Object.entries(expected))
    ['de','en','es','fr'].forEach((language, index) =>
      assert.equal(context.GoblinLanguage.t(`v2.ui.terrain.${id}`, {}, language), values[index]));
});

test('legend only creates icons for present types and falls back to SVG or text', () => {
  const {display, setLanguage} = setup();
  const legend = new Element('div');
  display.fillLegend(legend, ['road','water','road']);
  assert.equal(legend.children.length, 1);
  const list = legend.children[0];
  assert.deepEqual(list.children.map(item=>item.children[1].textContent), ['de:water','de:road']);
  assert.deepEqual(list.children.map(item=>item.children[0].src),
    ['assets/terrain-icons/water.webp','assets/terrain-icons/road.webp']);
  const roadImage = list.children[1].children[0];
  roadImage.onerror();
  assert.equal(roadImage.src, 'assets/fallback/road.svg');
  roadImage.onerror();
  assert.equal(roadImage.removed, true);
  assert.equal(list.children[1].children[1].textContent, 'de:road');
  setLanguage('en');
  display.fillLegend(legend, ['road','water']);
  assert.deepEqual(legend.children[0].children.map(item=>item.children[1].textContent),
    ['en:water','en:road']);
});

test('missing translation and icon cannot expose a raw key or remove the type label', () => {
  const {display, context} = setup();
  context.GoblinLanguage.t = key => key === 'v2.ui.terrain' ? 'TERRAIN' : key;
  assert.equal(display.label('river'), 'RIVER');
  assert.equal(display.label('unknown'), 'TERRAIN');
  const legend = new Element('div');
  display.fillLegend(legend, ['river']);
  const [image, name] = legend.children[0].children[0].children;
  assert.equal(name.textContent, 'RIVER');
  image.onerror(); image.onerror();
  assert.equal(image.removed, true);
  assert.equal(name.textContent, 'RIVER');
});

test('actual mission preview uses each canonical type and small icon, with a matching caption', () => {
  const {display, context} = setup();
  const source = readFileSync(new URL('ui-v2-flow.js', root), 'utf8');
  const match = source.match(/    function missionPreview\(data\) \{[\s\S]*?\n    \}\n    function missionStats/);
  assert.ok(match);
  context.TerrainDisplay = display;
  context.UnitVisuals.assetFor = () => null;
  context.t = key => key;
  context.missionId = 'atlas-proving-grounds';
  context.paragraph = () => new Element('p');
  runInNewContext(`${match[0].slice(0,-'    function missionStats'.length)}\nglobalThis.preview = missionPreview;`, context);
  const ids = Object.keys(manifest.types);
  const figure = context.preview({width:12,height:1,defaultTerrain:'open-ground',
    terrain:ids.map((type,x)=>({x,y:0,type})),units:[]});
  const [svg, caption] = figure.children;
  const polygons = svg.children.filter(node=>node.tag==='polygon');
  const images = svg.children.filter(node=>node.tag==='image');
  assert.deepEqual(polygons.map(node=>node.getAttribute('data-terrain-id')), ids);
  assert.deepEqual(images.map(node=>node.getAttribute('href')),
    ids.map(id=>`assets/terrain-icons/${id}.webp`));
  assert.equal(images.every(node=>node.getAttribute('width')==='36' && node.getAttribute('height')==='42'), true);
  assert.equal(caption.children[1].children.length, 12);
  assert.equal(svg.children.some(node=>node.getAttribute('href')?.includes('map-bakes')), false);
  context.missionId = 'iron-dust-v2';
  const core = context.preview({width:2,height:1,defaultTerrain:'open-ground',
    terrain:[{x:1,y:0,type:'rubble-field'}],units:[]});
  assert.deepEqual(core.children[1].children[1].children.map(item=>item.children[1].textContent),
    ['de:open-ground','de:rubble-field']);
});
