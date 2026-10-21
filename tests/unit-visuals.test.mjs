import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const fixed = '02-technical-illustration';
const prefix = `assets/unit-art/sets/${fixed}/`;
const manifest = JSON.parse(readFileSync(new URL('../assets/unit-art/manifest.json', import.meta.url), 'utf8'));

function visuals(file) {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  return context.UnitVisuals;
}

for (const source of ['unit-visuals.js', 'src/legacy/scripts/unit-visuals.js']) {
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
    assert.equal(art.resolve({ id:'ogre', name:'GOBLIN SIEGEBREAKER' }).asset,
      `${prefix}icons/goblin-siegebreaker.png`);
  });

  test(`${source} resolves all 26 unit aliases to existing icon and guide variants`, () => {
    const art = visuals(source);
    assert.equal(manifest.units.length, 26);
    for (const { id, name } of manifest.units) {
      const unit = { id:'scenario-alias', name };
      assert.equal(art.artKey(unit), id);
      const icon = art.assetFor(unit, 'icons');
      const png = art.assetFor(unit, 'library');
      const webp = art.assetFor(unit, 'library', 'webp');
      assert.equal(icon, `${prefix}icons/${id}.png`);
      assert.equal(png, `${prefix}library/${id}@768.png`);
      assert.equal(webp, `${prefix}library/${id}@1024.webp`);
      for (const path of [icon, png, webp]) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
      const iconBytes = readFileSync(new URL(`../${icon}`, import.meta.url));
      assert.equal(iconBytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a', icon);
      assert.equal(iconBytes.readUInt32BE(16), 256, icon);
      assert.equal(iconBytes.readUInt32BE(20), 256, icon);
      const guideBytes = readFileSync(new URL(`../${png}`, import.meta.url));
      assert.equal(guideBytes.readUInt32BE(16), 768, png);
      assert.equal(guideBytes.readUInt32BE(20), 512, png);
      const webpBytes = readFileSync(new URL(`../${webp}`, import.meta.url));
      assert.equal(webpBytes.toString('ascii',0,4), 'RIFF', webp);
      assert.equal(webpBytes.toString('ascii',8,12), 'WEBP', webp);
    }
    assert.equal(art.resolve({ id:'infantry', name:'FIELD ENGINEERS' }).asset,
      `${prefix}icons/field-engineers.png`);
    assert.equal(art.resolve({ id:'core', name:'RELAY NODE' }).asset,
      `${prefix}icons/relay-node.png`);
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
