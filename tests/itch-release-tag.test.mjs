import assert from 'node:assert/strict';
import test from 'node:test';
import record from '../scripts/record-itch-release.cjs';
const sha='a'.repeat(40), other='b'.repeat(40);
function setup(object=null,{race=null}={}) {
  const calls=[];
  let current=object;
  const context={eventName:'workflow_dispatch',ref:'refs/heads/main',repo:{owner:'LuckyGeorge1975',repo:'tdc.game.goblin'},runId:123,runAttempt:2};
  const env={PUBLISH_RESULT:'success',UPLOAD_VERIFIED:'true',RELEASE_VERSION:'0.1.32',RELEASE_TAG:'v0.1.32',PAGES_COMMIT:sha,
    PACKAGE_SHA256:'c'.repeat(64),UPLOAD_LOG_SHA256:'d'.repeat(64),PACKAGE_FILENAME:`goblin-v0.1.32-html5-${sha.slice(0,12)}.zip`,PAGES_RUN:'https://github.com/LuckyGeorge1975/tdc.game.goblin/actions/runs/12'};
  const github={rest:{git:{
    async getRef(){if(!current)throw {status:404};return {data:{object:current}};},
    async getTag(){return {data:{object:{type:'commit',sha:current.target??sha}}};},
    async createTag(args){calls.push(['tag',args]);return {data:{sha:'e'.repeat(40)}};},
    async createRef(args){calls.push(['ref',args]);if(race){current=race;throw {status:422};}current={type:'commit',sha};return {};}
  }}};
  return {github,context,env,calls};
}
test('successful manual upload creates an annotated tag on the Pages commit with provenance',async()=>{
  const f=setup(),receipt=await record(f);
  assert.equal(receipt.tagStatus,'created');assert.equal(receipt.commit,sha);
  assert.equal(receipt.uploadRun,'https://github.com/LuckyGeorge1975/tdc.game.goblin/actions/runs/123/attempts/2');
  assert.equal(f.calls[0][1].object,sha);assert.equal(f.calls[1][1].ref,'refs/tags/itch-v0.1.32');
  assert.equal(JSON.parse(f.calls[0][1].message).packageSha256,f.env.PACKAGE_SHA256);
});
test('package-only, failed upload and nonmanual/nonmain contexts cannot write tags',async()=>{
  for(const [key,value] of [['PUBLISH_RESULT','skipped'],['PUBLISH_RESULT','failure'],['UPLOAD_VERIFIED','']]){
    const f=setup();f.env[key]=value;await assert.rejects(record(f));assert.deepEqual(f.calls,[]);
  }
  for(const [key,value] of [['eventName','push'],['ref','refs/heads/other']]){
    const f=setup();f.context[key]=value;await assert.rejects(record(f));assert.deepEqual(f.calls,[]);
  }
});
test('existing lightweight or annotated tags on the same commit are idempotent',async()=>{
  for(const object of [{type:'commit',sha},{type:'tag',sha:other,target:sha}]){
    const f=setup(object);assert.equal((await record(f)).tagStatus,'already-present');assert.deepEqual(f.calls,[]);
  }
});
test('existing foreign tag is rejected without updating or deleting it',async()=>{
  const f=setup({type:'commit',sha:other});await assert.rejects(record(f),/another commit/);assert.deepEqual(f.calls,[]);
});
test('creation races accept only an already-created identical commit',async()=>{
  const f=setup(null,{race:{type:'commit',sha}});assert.equal((await record(f)).tagStatus,'already-present');
  await assert.rejects(record(setup(null,{race:{type:'commit',sha:other}})),/another commit/);
});
test('missing or inconsistent provenance fails before API mutations',async()=>{
  for(const [key,value] of [['PACKAGE_SHA256','bad'],['PAGES_RUN','https://example.org/12'],['RELEASE_TAG','v0.1.31'],['PACKAGE_FILENAME','goblin-v0.1.31-html5-aaaaaaaaaaaa.zip']]){
    const f=setup();f.env[key]=value;await assert.rejects(record(f));assert.deepEqual(f.calls,[]);
  }
});
