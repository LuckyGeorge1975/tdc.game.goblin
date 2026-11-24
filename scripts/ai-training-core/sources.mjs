import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
export const engineRoot=fileURLToPath(new URL('../../',import.meta.url));
export const normalize=text=>text.replaceAll('\r\n','\n');
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function gameplaySourceHashes(){
  const expected=JSON.parse(fs.readFileSync(new URL('../../assets/training/full-native-sources.json',import.meta.url),'utf8'));
  return Object.fromEntries(Object.keys(expected).sort().map(path=>{
    assert.ok(!path.includes('\\')&&!path.includes(':')&&!path.split('/').some(part=>!part||part==='.'||part==='..'),'AI_CORE_SOURCE_PATH');
    const actual=sha256(normalize(fs.readFileSync(new URL('../../'+path,import.meta.url),'utf8')));
    assert.equal(actual,expected[path],'AI_CORE_GENERATED_SOURCE_DRIFT '+path);return [path,actual];
  }));
}
