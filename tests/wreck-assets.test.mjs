import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('assets/unit-art/manifest.json'));
const receipt=JSON.parse(read('assets/unit-art/wrecks-source.json'));
const set='assets/unit-art/sets/02-technical-illustration';

test('wreck derivatives have exactly 26 own/enemy pairs and verified public provenance',()=>{
  const ids=manifest.units.map(unit=>unit.id).sort();
  assert.equal(ids.length,26);
  assert.equal(receipt.previewOnly,false);
  assert.equal(receipt.sourceFileCount,54);
  assert.equal(receipt.wrecks.length,52);
  assert.equal(receipt.sourceArchives.length,2);
  assert.equal(receipt.export.scriptSha256,hash(read(receipt.export.script)));
  assert.equal(receipt.manifestSha256,hash(read('assets/unit-art/manifest.json').toString('utf8').replace(/\r\n/g,'\n')));
  assert.equal(receipt.export.crop,false);
  assert.equal(receipt.export.lossless,true);
  assert.equal(receipt.provenance.enemyLibraryImported,false);
  const sources=receipt.sourceArchives.flatMap(archive=>archive.sourcePaths);
  assert.equal(new Set(sources).size,54);
  for(const side of ['own','enemy']){
    const expected=ids.map(id=>id+'.webp');
    assert.deepEqual(readdirSync(new URL(`${set}/wrecks/${side}/`,root)).sort(),expected);
    for(const id of ids){
      const item=receipt.wrecks.find(item=>item.unitId===id&&item.team===(side==='own'?'player':'enemy'));
      assert.ok(item);
      assert.equal(item.runtimePath,`${set}/wrecks/${side}/${id}.webp`);
      assert.ok(sources.includes(item.sourcePath));
      assert.match(item.sourceSha256,/^[a-f0-9]{64}$/);
      const bytes=read(item.runtimePath);
      assert.equal(bytes.length,item.runtimeBytes);
      assert.equal(hash(bytes),item.runtimeSha256);
      assert.equal(bytes.toString('ascii',0,4),'RIFF');
      assert.equal(bytes.toString('ascii',8,12),'WEBP');
      assert.deepEqual(item.sourceImage.size,[256,256]);
      assert.deepEqual(item.runtimeImage.size,[192,192]);
      assert.deepEqual(item.runtimeImage.canvasCenter,[96,96]);
      assert.equal(item.resizedPixelsLossless,true);
    }
  }
  assert.equal(receipt.runtimeImageTotalBytes,receipt.wrecks.reduce((n,item)=>n+item.runtimeBytes,0));
  assert.ok(receipt.runtimeImageTotalBytes<receipt.sourceImageTotalBytes);
});

test('wreck classes and anchors retain exact source bytes and 256px coordinates as inactive data',()=>{
  const ids=manifest.units.map(unit=>unit.id).sort();
  for(const item of receipt.metadata){
    assert.equal(hash(read(item.runtimePath)),item.runtimeSha256);
    assert.equal(item.runtimeSha256,item.sourceSha256);
    assert.equal(read(item.runtimePath).length,item.sourceBytes);
  }
  const anchors=JSON.parse(read(`${set}/anchors.json`));
  const classes=JSON.parse(read(`${set}/wreck-classes.json`));
  assert.deepEqual(Object.keys(anchors).sort(),ids);
  assert.deepEqual(Object.keys(classes).sort(),ids.flatMap(id=>[id+'-eigen',id+'-gegner']).sort());
  assert.deepEqual(anchors['goblin-siegebreaker'].own,[[113,-7],[113,23]]);
  assert.equal(anchors['goblin-siegebreaker'].main,undefined,'no invented weapon-group mapping');
});
