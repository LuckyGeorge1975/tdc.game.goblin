import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stagePages} from '../scripts/stage-pages.mjs';
import {verifyPagesArtifact} from '../scripts/verify-pages-artifact.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('Pages stages exactly committed HEAD files, excludes private output canaries and configures support only in staging',async()=>{
 const token=randomUUID(),temporary=await mkdtemp(join(dirname(root),'pages-staging-'));
 const privateDirs=[resolve(root,'.tools','pages-private-'+token),resolve(root,'training-runs','pages-private-'+token)];
 const canaries=[...privateDirs.map(dir=>join(dir,'dataset.json')),resolve(root,'pages-output-'+token+'.log')];
 const originalIndex=await readFile(resolve(root,'index.html'));
 try{
  for(const dir of privateDirs)await mkdir(dir,{recursive:true});
  for(const path of canaries)await writeFile(path,'SYNTHETIC PRIVATE OUTPUT CANARY\n',{flag:'wx'});
  const output=resolve(temporary,'pages site'),result=await stagePages({sourceRoot:root,output});
  const expected=execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+root.replaceAll('\\','/'),'ls-tree','-rz','--name-only','HEAD'],{cwd:root}).toString().split('\0').filter(Boolean).sort();
  const actual=[],before=new Map();
  async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())await walk(join(dir,entry.name),path+'/');else{actual.push(path);before.set(path,hash(await readFile(join(output,path))));}}}
  await walk(output);assert.deepEqual(actual.sort(),expected);assert.equal(result.files,expected.length);
  assert.ok(actual.every(path=>!path.startsWith('.tools/')&&!path.startsWith('training-runs/')&&!path.includes(token)));
  execFileSync(process.execPath,[join(output,'scripts/configure-pages-support.mjs')],{cwd:output,env:{...process.env,GOBLIN_SUPPORT_URL:'https://example.org/goblin-support'}});
  assert.match(await readFile(join(output,'index.html'),'utf8'),/globalThis\.GOBLIN_SUPPORT_URL = "https:\/\/example.org\/goblin-support"/);
  assert.deepEqual(await readFile(resolve(root,'index.html')),originalIndex);
  for(const path of actual)if(path!=='index.html')assert.equal(hash(await readFile(join(output,path))),before.get(path),path);
  const configured=hash(await readFile(join(output,'index.html')));
  await assert.rejects(stagePages({sourceRoot:root,output}),error=>error.code==='EEXIST');
  assert.equal(hash(await readFile(join(output,'index.html'))),configured);
  await assert.rejects(stagePages({sourceRoot:root,output:resolve(root,'unsafe-pages-stage')}),/OUTSIDE_CHECKOUT/);
  const workflow=await readFile(resolve(root,'.github/workflows/deploy-pages.yml'),'utf8');
  assert.match(workflow,/node scripts\/stage-pages\.mjs --output "\$RUNNER_TEMP\/pages-site"/);
  assert.match(workflow,/working-directory: \$\{\{ runner\.temp \}\}\/pages-site/);
  assert.match(workflow,/path: \$\{\{ runner\.temp \}\}\/pages-site/);
  await writeFile(join(temporary,'proof.json'),JSON.stringify({commit:result.commit,trackedFiles:expected.length,excludedCanaries:canaries.length,supportOnlyInStaging:true,existingStageRejected:true},null,2));
 }finally{
  for(const path of canaries)try{await unlink(path);}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const dir of privateDirs)try{await rmdir(dir);}catch(error){if(error.code!=='ENOENT')throw error;}
 }
});
function syntheticTar(entries){
 const chunks=[];for(const {name,bytes=Buffer.alloc(0),type='0'}of entries){const header=Buffer.alloc(512);header.write(name,0,100);header.write('0000644\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(bytes.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);header.write('00',263);const sum=header.reduce((a,b)=>a+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);chunks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));}return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
test('actual Pages tar must match committed blobs and staging, allowing only the declared support transformation',async()=>{
 const temp=await mkdtemp(join(dirname(root),'pages-artifact-')),source=join(temp,'source'),stage=join(temp,'stage'),artifact=join(temp,'artifact.tar');await mkdir(source);
 const git=(args,input)=>execFileSync(process.env.GIT_EXECUTABLE||'git',['-c','safe.directory='+source.replaceAll('\\','/'),...args],{cwd:source,input}).toString().trim();
 git(['init']);const index=Buffer.from('<html><!-- GOBLIN_PAGES_SUPPORT --></html>\n'),asset=Buffer.from('committed asset\n');
 const indexBlob=git(['hash-object','-w','--stdin'],index),assetBlob=git(['hash-object','-w','--stdin'],asset);
 const tree=git(['mktree'],`100644 blob ${assetBlob}\tasset.txt\n100644 blob ${indexBlob}\tindex.html\n`);
 const commit=git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree], 'Synthetic artifact verification fixture\n');git(['update-ref','HEAD',commit]);
 await mkdir(stage);await writeFile(join(stage,'index.html'),index);await writeFile(join(stage,'asset.txt'),asset);
 const check=(supportUrl='')=>verifyPagesArtifact({sourceRoot:source,stagingRoot:stage,artifactPath:artifact,supportUrl});
 const entries=[{name:'./index.html',bytes:index},{name:'./asset.txt',bytes:asset}];await writeFile(artifact,syntheticTar(entries));
 const positive=await check();assert.equal(positive.commit,commit);assert.equal(positive.files,2);assert.equal(positive.supportConfigured,false);
 for(const name of ['./.tools/private.json','./training-runs/weights.json','./untracked-output.log']){await writeFile(artifact,syntheticTar([...entries,{name,bytes:Buffer.from('canary')} ]));await assert.rejects(check(),/FILE_COUNT/);}
 await writeFile(artifact,syntheticTar([{name:'./index.html',bytes:index},{name:'./asset.txt',type:'2'}]));await assert.rejects(check(),/LINK_OR_SPECIAL/);
 await writeFile(artifact,syntheticTar([...entries,{name:'./asset.txt',bytes:asset}]));await assert.rejects(check(),/DUPLICATE/);
 const changed=Buffer.from('forged asset\n');await writeFile(join(stage,'asset.txt'),changed);await writeFile(artifact,syntheticTar([entries[0],{name:'./asset.txt',bytes:changed}]));await assert.rejects(check(),/GIT_BLOB/);await writeFile(join(stage,'asset.txt'),asset);
 const support='https://example.org/goblin-support',configured=Buffer.from('<html><script>globalThis.GOBLIN_SUPPORT_URL = "'+support+'";</script></html>\n');await writeFile(join(stage,'index.html'),configured);await writeFile(artifact,syntheticTar([{name:'./index.html',bytes:configured},entries[1]]));assert.equal((await check(support)).supportConfigured,true);await assert.rejects(check('https://example.org/different'),/INDEX_TRANSFORMATION/);
 const workflow=await readFile(resolve(root,'.github/workflows/deploy-pages.yml'),'utf8');assert.ok(workflow.indexOf('Verify actual Pages artifact')>workflow.indexOf('Upload static site'));assert.ok(workflow.indexOf('Verify actual Pages artifact')<workflow.indexOf('name: Deploy to GitHub Pages'));assert.match(workflow,/--artifact "\$RUNNER_TEMP\/artifact.tar" --proof "\$RUNNER_TEMP\/pages-artifact-proof.json"/);
});
