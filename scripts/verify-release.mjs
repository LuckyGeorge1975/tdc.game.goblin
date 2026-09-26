import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';

function parseRelease(source){
  const context=vm.createContext({globalThis:{}});
  vm.runInContext(source,context);
  return context.globalThis.GOBLIN_RELEASE;
}

const releaseSource=readFileSync('release.js','utf8');
const release=parseRelease(releaseSource);
const changelog=readFileSync('CHANGELOG.md','utf8');
const handoff=readFileSync('TEST_HANDOFF.md','utf8');
const index=readFileSync('index.html','utf8');
const reportsIndex=readFileSync('REPORTS.md','utf8');

if(!/^0\.1\.\d+$/.test(release.version))throw new Error(`Ungültige Buildversion: ${release.version}`);
if(Number(release.version.split('.').at(-1))!==release.build)throw new Error('Buildnummer und Versionssuffix stimmen nicht überein.');
if(!changelog.includes(`## [${release.version}] - ${release.releasedAt}`))throw new Error(`Changelog-Eintrag für ${release.version} fehlt.`);
if(!handoff.includes(`| Version | \`${release.version}\` |`)||!handoff.includes(`| Build | \`${release.build}\` |`))throw new Error('Tester-Handoff enthält nicht die aktuelle Version.');
if(!index.includes(`release.js?v=${release.build}`)||!index.includes('id="build-version"'))throw new Error('Versionsanzeige ist nicht korrekt in index.html eingebunden.');
for(const report of readdirSync('.').filter(name=>/(?:REPORT|REVIEW).*\.md$/i.test(name)&&name!=='REPORTS.md')){
  const source=readFileSync(report,'utf8');
  if(!reportsIndex.includes(`](${report})`))throw new Error(`${report} fehlt in REPORTS.md.`);
  if(!/\*\*(?:Berichtsversion|Report version):\*\*\s+\d+/i.test(source))throw new Error(`${report} besitzt keine Berichtsversion.`);
}

const previousArg=process.argv.find(arg=>arg.startsWith('--previous='));
if(previousArg){
  const previousRef=previousArg.slice('--previous='.length);
  try{
    const safeDirectory=process.cwd().replaceAll('\\','/');
    const previousSource=execFileSync('git',['-c',`safe.directory=${safeDirectory}`,'show',`${previousRef}:release.js`],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const previous=parseRelease(previousSource);
    if(release.build<=previous.build)throw new Error(`Build ${release.build} ist nicht höher als der veröffentlichte Build ${previous.build}.`);
  }catch(error){
    const detail=String(error.stderr||'');
    if(detail.includes("exists on disk, but not in")||detail.includes("path 'release.js' does not exist")){
      console.log('Kein vorheriger release.js gefunden; initialer versionierter Build wird akzeptiert.');
    }else throw error;
  }
}

console.log(`Release ${release.version} (Build ${release.build}) ist konsistent.`);
