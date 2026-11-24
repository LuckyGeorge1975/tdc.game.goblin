import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {getBinding,validateLevel,runCase,verifyCase,buildPair,fitFireTarget} from '../scripts/ai-training-core/index.mjs';
import {jsonBytes,sha256} from '../scripts/ai-training-core/sealed-artifacts.mjs';
const base=fileURLToPath(new URL('../.tools/ai-training-core-tests/',import.meta.url));
async function directory(){await mkdir(base,{recursive:true});return mkdtemp(resolve(base,'case-'));}
const level=(side='player')=>({version:'goblin-level-v3',id:'native-test-arbitrary-id',scenarioVersion:1,width:6,height:5,
  ruleProfile:'FULL_CATALOG_v1',objective:'eliminate-opponent',terrain:[],units:[
    {id:'p',team:'player',assetId:side==='player'?'assault-tank':'command-core',x:1,y:1},
    {id:'e',team:'enemy',assetId:side==='enemy'?'assault-tank':'field-engineers',x:3,y:1}]});
const pairLevel=()=>({...level(),units:[
  {id:'p',team:'player',assetId:'long-range-battery',x:1,y:1},
  {id:'pi',team:'player',assetId:'field-engineers',x:1,y:2},
  {id:'e',team:'enemy',assetId:'assault-tank',x:3,y:1},
  {id:'ei',team:'enemy',assetId:'field-engineers',x:3,y:2}]});
const limits={commandLimit:120,roundLimit:10,wallMs:null,workers:1};

test('verified DTOs keep trusted final references for repeat verification and censored pair audit',async()=>{
  const root=await directory(),manifest={version:'goblin-ai-run-v1',binding:await getBinding()};
  const options={manifest,level:level(),seed:30,seats:{player:'medium',enemy:'weak'},limits};
  const native=await runCase({...options,caseId:'native',runRoot:resolve(root,'native')});assert.equal(native.completion,'native');
  const first=await verifyCase({caseRoot:native.caseRoot,result:native,manifest});
  assert.equal((await verifyCase({caseRoot:native.caseRoot,result:first,manifest})).verified,true);
  const limited=await runCase({...options,caseId:'limit',runRoot:resolve(root,'limit'),limits:{...limits,commandLimit:1}});
  const censored=await verifyCase({caseRoot:limited.caseRoot,result:limited,manifest});
  assert.deepEqual(censored.artifactRefs.final,limited.artifactRefs.final);
  assert.equal(await buildPair({reference:first,alternative:censored,side:'player'}),null);
});

test('native validation discovers qualified seats, minimum and malformed level rejection without fixed level IDs',async()=>{
  assert.deepEqual((await validateLevel({level:level()})).strategies,
    {player:['weak','medium','strong','trained'],enemy:['weak','medium','strong','trained']});
  const higher=await validateLevel({level:{...level(),minimumDifficulty:'strong'}});
  assert.deepEqual(higher.strategies,{player:['strong','trained'],enemy:['strong','trained']});
  assert.deepEqual(higher.pairStrategies,{player:['strong'],enemy:['strong']});
  assert.deepEqual((await getBinding()).interventionStrategies.player,['weak','medium','strong']);
  await assert.rejects(()=>validateLevel({level:{...level(),aiAllowed:false}}));
  await assert.rejects(()=>validateLevel({level:{...level(),units:[level().units[0]]}}));
});

test('all four actual native selectors run on either AI seat, including asynchronous Strong, with complete original recording',async()=>{
  const root=await directory(),manifest={version:'goblin-ai-run-v1',binding:await getBinding()};
  for(const side of ['player','enemy'])for(const strategy of ['weak','medium','strong','trained']){
    const result=await runCase({runRoot:resolve(root,side+'-'+strategy),manifest,caseId:side+'-'+strategy,level:level(side),seed:30,
      seats:{player:'weak',enemy:'weak',[side]:strategy},limits});
    assert.equal(result.completion,'native',JSON.stringify(result.error));
    const diagnostics=JSON.parse(await readFile(resolve(result.caseRoot,'diagnostics.json')));
    assert.ok(diagnostics.diagnostics.some(row=>row.side===side),'the named seat must actually select');
    assert.ok(diagnostics.diagnostics.filter(row=>row.side===side).every(row=>row.policy===result.recordedSeats[side].policy));
    const verified=await verifyCase({caseRoot:result.caseRoot,result,manifest});assert.equal(verified.verified,true);
    assert.equal(verified.provenance.status,'verified-local-capture');
    const archive=JSON.parse(await readFile(resolve(result.caseRoot,'archive.json')));
    assert.equal(archive.seats[side].policy,result.recordedSeats[side].policy);
    assert.equal(archive.replay.entries.length,result.commands);
    if(strategy==='trained'){
      assert.ok(result.samplingUnsupported.some(item=>item.side===side));
      assert.ok(result.sampled.every(item=>item.side!==side));
    }
  }
});

test('real native reference/intervention yields a verified pair; fresh process and receipt/source tamper guards fail closed',async()=>{
  const root=await directory(),manifest={version:'goblin-ai-run-v1',binding:await getBinding()};
  const options={manifest,level:pairLevel(),seed:30,seats:{player:'medium',enemy:'medium'},limits};
  const reference=await runCase({...options,caseId:'reference',runRoot:resolve(root,'reference')});
  assert.equal(reference.completion,'native');const intervention=reference.sampled.find(row=>row.side==='player');assert.ok(intervention);
  const alternative=await runCase({...options,intervention,caseId:'alternative',runRoot:resolve(root,'alternative')});
  assert.equal(alternative.completion,'native',JSON.stringify(alternative.error));
  const pair=await buildPair({reference,alternative,side:'player'});
  assert.equal(pair.reference.length,19);assert.equal(pair.alternative.length,19);assert.ok([-1,-0.5,0,0.5,1].includes(pair.delta));
  const validationReference=await runCase({...options,seed:31,caseId:'validation-reference',runRoot:resolve(root,'validation-reference')});
  assert.equal(validationReference.completion,'native');
  const validationSample=validationReference.sampled.find(item=>item.side==='player');assert.ok(validationSample);
  const validationAlternative=await runCase({...options,seed:31,intervention:validationSample,caseId:'validation-alternative',runRoot:resolve(root,'validation-alternative')});
  assert.equal(validationAlternative.completion,'native');
  const validationPair=await buildPair({reference:validationReference,alternative:validationAlternative,side:'player'});
  const fitted=await fitFireTarget({train:[pair],validation:[validationPair],config:{side:'player',maxEpochs:2,patience:5,minDelta:0,
    seed:231371,runManifestSha256:sha256(jsonBytes(manifest)),outputRoot:resolve(root,'fit')}});
  assert.equal(fitted.status,'FITTED');const frozen=await readFile(fitted.modelRef.path);
  const evaluated=await runCase({...options,seed:32,model:fitted.modelRef,caseId:'frozen-evaluation',runRoot:resolve(root,'evaluation')});
  assert.equal(evaluated.completion,'native',JSON.stringify(evaluated.error));
  assert.equal((await verifyCase({caseRoot:evaluated.caseRoot,result:evaluated,manifest})).verified,true);
  assert.deepEqual(await readFile(fitted.modelRef.path),frozen);
  const request=resolve(root,'verify.json');await writeFile(request,JSON.stringify({caseRoot:reference.caseRoot,result:reference,manifest}));
  const module=new URL('../scripts/ai-training-core/index.mjs',import.meta.url).href;
  const child=`import fs from 'node:fs';import{verifyCase}from ${JSON.stringify(module)};const r=await verifyCase(JSON.parse(fs.readFileSync(process.argv[1])));console.log(r.verified);`;
  assert.equal(execFileSync(process.execPath,['--input-type=module','-e',child,request],{encoding:'utf8'}).trim(),'true');
  const before=sha256(await readFile(resolve(reference.caseRoot,'archive.json')));
  await assert.rejects(()=>runCase({...options,caseId:'reference',runRoot:reference.caseRoot}),/AI_CORE_ATTEMPT_NOT_EMPTY/);
  assert.equal(sha256(await readFile(resolve(reference.caseRoot,'archive.json'))),before);
  const receipt=resolve(reference.caseRoot,'receipt.json'),original=await readFile(receipt);
  await writeFile(receipt,Buffer.concat([original,Buffer.from(' ')]));
  await assert.rejects(()=>verifyCase({caseRoot:reference.caseRoot,result:reference,manifest}),/SEAL_ARTIFACT_HASH_MISMATCH/);
  await writeFile(receipt,original);
  const changed=structuredClone(reference);changed.binding.codeSha256='f'.repeat(64);
  await assert.rejects(()=>verifyCase({caseRoot:reference.caseRoot,result:changed,manifest}),/AI_CORE_RESULT_DRIFT/);
  assert.equal((await verifyCase({caseRoot:reference.caseRoot,result:reference,manifest})).verified,true);
});

test('Weak and asynchronous Strong interventions retain their declared base and fresh native pair guards',async()=>{
  const root=await directory(),manifest={version:'goblin-ai-run-v1',binding:await getBinding()};
  const source={...pairLevel(),units:pairLevel().units.filter(unit=>unit.id!=='pi')};
  for(const strategy of ['weak','strong']){
    const options={manifest,level:source,seed:30,seats:{player:strategy,enemy:'medium'},limits};
    const reference=await runCase({...options,caseId:strategy+'-reference',runRoot:resolve(root,strategy+'-reference')});
    assert.equal(reference.completion,'native',JSON.stringify(reference.error));
    const sample=reference.sampled.find(item=>item.side==='player');assert.ok(sample);
    const alternative=await runCase({...options,intervention:sample,caseId:strategy+'-alternative',runRoot:resolve(root,strategy+'-alternative')});
    assert.equal(alternative.completion,'native',JSON.stringify(alternative.error));
    assert.equal((await buildPair({reference,alternative,side:'player'})).side,'player');
    assert.equal(alternative.recordedSeats.player.difficulty,strategy);
  }
});

test('bounded and cooperatively stopped cases retain fragments without terminal labels; humans and binding drift reject',async()=>{
  const root=await directory(),manifest={version:'goblin-ai-run-v1',binding:await getBinding()};
  const options={manifest,level:pairLevel(),seed:30,seats:{player:'medium',enemy:'weak'},limits:{...limits,commandLimit:1}};
  const limited=await runCase({...options,caseId:'limit',runRoot:resolve(root,'limit')});
  assert.equal(limited.completion,'technical-limit');assert.equal(limited.outcome,null);assert.equal(limited.receipt,undefined);
  assert.equal((await verifyCase({caseRoot:limited.caseRoot,result:limited,manifest})).verified,true);
  const signal=new AbortController();signal.abort();
  const stopped=await runCase({...options,caseId:'stopped',runRoot:resolve(root,'stopped'),signal:signal.signal});
  assert.equal(stopped.completion,'stopped');assert.equal(stopped.outcome,null);
  await assert.rejects(()=>runCase({...options,caseId:'human',runRoot:resolve(root,'human'),seats:{player:'human',enemy:'weak'}}),/AI_CORE_AI_SEATS_REQUIRED/);
  await assert.rejects(()=>runCase({...options,caseId:'trained-overlay',runRoot:resolve(root,'trained-overlay'),
    seats:{player:'trained',enemy:'weak'},intervention:{side:'player'}}),/AI_CORE_TRAINED_OVERLAY_UNSUPPORTED/);
  await assert.rejects(()=>runCase({...options,caseId:'foreign',runRoot:resolve(root,'foreign'),manifest:{...manifest,binding:{...manifest.binding,codeSha256:'f'.repeat(64)}}}),/AI_CORE_RUN_BINDING/);
});
