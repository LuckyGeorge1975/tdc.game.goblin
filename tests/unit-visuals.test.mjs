import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const fixed = '02-technical-illustration';
const prefix = `assets/unit-art/sets/${fixed}/`;
const mapPrefix = `${prefix}map-icons/`;
const manifest = JSON.parse(readFileSync(new URL('../assets/unit-art/manifest.json', import.meta.url), 'utf8'));
const receipt = JSON.parse(readFileSync(new URL('../assets/unit-art/map-icons-source.json', import.meta.url), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function visuals(file, document) {
  const context = vm.createContext({document});
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  return context.UnitVisuals;
}

for (const source of ['unit-visuals.js', 'src/legacy/scripts/unit-visuals.js']) {
  test(`${source} replaces failed map and list images and suppresses later attempts`, () => {
    const makeNode = tag => ({tag,children:[],attributes:{},classList:{add(){}},
      setAttribute(key,value){this.attributes[key]=value},
      appendChild(node){this.children.push(node);return node},
      replaceWith(node){this.replacement=node}});
    const document={createElement:makeNode,createElementNS:(_,tag)=>makeNode(tag)};
    const art=visuals(source,document);
    const unit={id:'ogre',type:'ogre',name:'GOBLIN SIEGEBREAKER',team:'player',icon:'G'};
    const asset=art.assetFor(unit);
    const group=makeNode('g');
    const map=art.draw(group,unit,{x:40,y:40},{color:'#fff',selected:true});
    const list=art.iconElement(unit,'v2-roster-art');
    assert.equal(map.tag,'image');assert.equal(list.tag,'img');
    // Both missing HTTP resources and undecodable image bodies raise image error.
    list.onerror();
    assert.equal(map.replacement.tag,'g');
    assert.equal(map.replacement.children[0].tag,'polygon');
    assert.equal(list.replacement.tag,'svg');
    assert.equal(list.replacement.children[0].tag,'polygon');
    assert.equal(list.replacement.children[1].textContent,'G');
    assert.equal(art.assetFor(unit),null);
    assert.equal(art.resolve(unit).shape,'fortress');
    for(let i=0;i<8;i++){
      assert.equal(art.draw(makeNode('g'),unit,{x:0,y:0}).tag,'polygon');
      assert.equal(art.iconElement(unit).tag,'svg');
    }
    assert.equal(art.assetFor({...unit,team:'enemy'}),asset.replace('/own/','/enemy/'));
    assert.equal(art.assetFor(unit,'library','webp'),`${prefix}library/goblin-siegebreaker@1024.webp`);
    const healthy=art.iconElement({...unit,team:'enemy'});
    healthy.onload();
    assert.equal(healthy.replacement,undefined);
    assert.equal(art.resolve({...unit,team:'enemy'}).kind,'asset');
    const corrupt=art.iconElement({id:'infantry',name:'INFANTRY SQUAD',team:'player'});
    corrupt.onerror();
    assert.equal(corrupt.replacement.children[0].tag,'polygon');
    assert.equal(art.iconElement({id:'infantry',name:'INFANTRY SQUAD',team:'player'}).tag,'svg');
  });

  test(`${source} exposes only the fixed runtime set and rejects foreign styles`, () => {
    const art = visuals(source);
    assert.deepEqual(Array.from(art.styles, item => item.id), [fixed]);
    assert.equal(art.currentStyle(), fixed);
    assert.equal(art.setStyle('06-military-symbols'), false);
    assert.equal(art.setStyle('01-tabletop-miniatures'), false);
    assert.equal(art.currentStyle(), fixed);
    assert.throws(() => art.setAsset('ogre', 'assets/unit-art/sets/06-military-symbols/icons/goblin-siegebreaker.svg'),
      /fixed technical illustration/);
    art.register('ogre', { kind: 'asset', asset: 'assets/unit-art/sets/06-military-symbols/icons/goblin-siegebreaker.svg' });
    assert.equal(art.resolve({ id:'ogre', name:'GOBLIN SIEGEBREAKER', team:'player' }).asset,
      `${mapPrefix}own/goblin-siegebreaker.webp`);
  });

  test(`${source} resolves all 26 names and canonical IDs to both fixed map sides`, () => {
    const art = visuals(source);
    assert.equal(manifest.units.length, 26);
    for (const { id, name } of manifest.units) {
      for (const [team,side] of [['player','own'],['enemy','enemy']]) {
        const unit = { id:'scenario-alias', name, team };
        const icon = `${mapPrefix}${side}/${id}.webp`;
        assert.equal(art.artKey(unit), id);
        assert.equal(art.assetFor(unit, 'icons'), icon);
        assert.equal(art.assetFor({id, name:'Scenario Alias', team}, 'icons'), icon);
        assert.equal(art.resolve(unit).asset, icon);
        assert.ok(Math.abs(art.resolve(unit).size/(Math.sqrt(3)*34)-100/112)<1e-12);
        assert.ok(existsSync(new URL(`../${icon}`, import.meta.url)), icon);
        const bytes = readFileSync(new URL(`../${icon}`, import.meta.url));
        assert.equal(bytes.toString('ascii',0,4), 'RIFF', icon);
        assert.equal(bytes.toString('ascii',8,12), 'WEBP', icon);
        const entry = receipt.icons.find(item => item.unitId===id && item.team===team);
        assert.equal(entry?.runtimePath, icon);
        assert.equal(entry.runtimeSha256, hash(bytes));
      }
      const unit={id:'scenario-alias',name,team:'player'};
      const png = art.assetFor(unit, 'library');
      const webp = art.assetFor(unit, 'library', 'webp');
      assert.equal(png, `${prefix}library/${id}@768.png`);
      assert.equal(webp, `${prefix}library/${id}@1024.webp`);
      for (const path of [png, webp]) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
      const guideBytes = readFileSync(new URL(`../${png}`, import.meta.url));
      assert.equal(guideBytes.readUInt32BE(16), 768, png);
      assert.equal(guideBytes.readUInt32BE(20), 512, png);
      const webpBytes = readFileSync(new URL(`../${webp}`, import.meta.url));
      assert.equal(webpBytes.toString('ascii',0,4), 'RIFF', webp);
      assert.equal(webpBytes.toString('ascii',8,12), 'WEBP', webp);
    }
    assert.equal(art.resolve({ id:'infantry', name:'FIELD ENGINEERS', team:'player' }).asset,
      `${mapPrefix}own/field-engineers.webp`);
    assert.equal(art.resolve({ id:'core', name:'RELAY NODE', team:'enemy' }).asset,
      `${mapPrefix}enemy/relay-node.webp`);
    assert.equal(art.assetFor({id:'guard-tank',team:'enemy',activeTeam:'enemy',viewer:'observer'}),
      `${mapPrefix}enemy/guard-tank.webp`);
    assert.equal(art.assetFor({id:'guard-tank',team:'player',activeTeam:'enemy',viewer:'observer'}),
      `${mapPrefix}own/guard-tank.webp`);
    assert.equal(art.assetFor({id:'guard-tank',team:'neutral'}),null);
    assert.equal(art.assetFor({id:'unknown',team:'player'}),null);
  });

  test(`${source} keeps terrain fallback separate from the unit set`, () => {
    const art = visuals(source);
    for (const type of ['open-ground','rubble-field','mountain','ridge','forest','marsh',
      'water','river','road','bridge','urban','crater']) {
      const path = art.terrainAssetFor(type);
      assert.equal(path, `assets/unit-art/sets/01-modular-stealth-geometry/terrain/${type}.svg`);
      assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
    }
  });
}

test('map export has exactly 52 paired, hashed, compact assets from the pinned source', () => {
  assert.equal(manifest.mapIcons.set,fixed);
  assert.equal(`assets/unit-art/${manifest.mapIcons.own}`,`${mapPrefix}own/`);
  assert.equal(`assets/unit-art/${manifest.mapIcons.enemy}`,`${mapPrefix}enemy/`);
  assert.equal(manifest.mapIcons.sourceReceipt,'map-icons-source.json');
  assert.equal(receipt.sourceCommit,'c01ecb80bcdd813772d1433d9ae63b39e54ef050');
  assert.equal(receipt.icons.length,52);
  assert.equal(receipt.sourceTotalBytes,1889554);
  assert.ok(receipt.runtimeTotalBytes<800000);
  assert.equal(receipt.runtimeTotalBytes,receipt.icons.reduce((sum,item)=>sum+item.runtimeBytes,0));
  assert.equal(new Set(receipt.icons.map(item=>item.runtimePath)).size,52);
});
