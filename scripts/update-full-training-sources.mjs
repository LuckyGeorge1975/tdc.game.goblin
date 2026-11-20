// Refresh after an intended gameplay change; never rebind historical trace evidence.
// --check verifies the deployable native export binding without changing files.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gameplaySourceHashes} from '../tests/helpers/replay-source-binding.mjs';
import {canonicalSources,normalizeSource} from '../full-training-source-binding.mjs';

const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('base64');
const sources = gameplaySourceHashes();
const manifest = new URL('assets/training/full-native-sources.json', root);
const index = new URL('index.html', root);
const oldIndex = fs.readFileSync(index, 'utf8');
const newIndex = oldIndex.replace(/<script\b[^>]*\bsrc="([^"?]+)[^"]*"[^>]*>/g, (tag, path) => {
  if (!Object.hasOwn(sources, path)) return tag;
  const file=new URL(path,root),raw=fs.readFileSync(file,'utf8'),lf=normalizeSource(raw);
  const crlf=lf.replaceAll('\n','\r\n');
  // Patches in a Windows checkout can leave mixed endings, which neither normal Git output uses.
  if(raw!==lf&&raw!==crlf){
    if(process.argv.includes('--check'))throw Error('FULL_TRAINING_SOURCE_MIXED_EOL: '+path);
    fs.writeFileSync(file,lf);
  }
  // Git archives use LF, Windows checkouts may serve CRLF. Both encode identical bound source text.
  const integrity=[...new Set([lf,crlf].map(bytes=>'sha256-'+hash(bytes)))].join(' ');
  return tag.replace(/\s+integrity="[^"]*"/g, '').replace(/>$/,
    ' integrity="' + integrity + '">');
});
if (process.argv.includes('--check')) {
  if (canonicalSources(JSON.parse(fs.readFileSync(manifest))) !== canonicalSources(sources) || newIndex !== oldIndex)
    throw Error('FULL_TRAINING_SOURCE_BINDING_STALE: node scripts/update-full-training-sources.mjs');
} else {
  fs.writeFileSync(manifest, JSON.stringify(sources, null, 2) + '\n');
  fs.writeFileSync(index, newIndex);
}
console.log('FULL training sources and script integrity ' + (process.argv.includes('--check') ? 'verified' : 'updated'));
