import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function listAiTrainingCorpus({seeds=[7]}={}){
  if(!Array.isArray(seeds)||!seeds.length||new Set(seeds).size!==seeds.length||
      seeds.some(seed=>!Number.isInteger(seed)||seed<0||seed>0xffffffff))
    throw Error('AI_CORPUS_SEEDS_INVALID');
  const manifest=JSON.parse(await readFile(new URL('../assets/ai/training-corpus.v1.json',import.meta.url),'utf8'));
  if(manifest.version!=='goblin-ai-training-corpus-v1'||manifest.profile!=='FULL_CATALOG_v1'||
      manifest.package!=='assets/unit-art/levels/ai-training-missions.v3.json'||
      JSON.stringify(manifest.controlledSides)!=='["player","enemy"]')throw Error('AI_CORPUS_MANIFEST_INVALID');
  const bytes=await readFile(new URL('../'+manifest.package,import.meta.url));
  // Repository text checkouts may use CRLF; the pinned package uses LF.
  if(sha256(bytes.toString('utf8').replaceAll('\r\n','\n'))!==manifest.packageSha256)throw Error('AI_CORPUS_SOURCE_MISMATCH');
  const source=JSON.parse(bytes);
  if(source.version!=='goblin-level-package-v3'||source.levels.length!==manifest.levels.length)
    throw Error('AI_CORPUS_SOURCE_MISMATCH');
  const result=[];
  for(const entry of manifest.levels){
    const level=source.levels.find(level=>level.id===entry.id);
    if(!level||sha256(JSON.stringify(level))!==entry.sha256||level.objective!=='eliminate-opponent'||
        level.ruleProfile!==manifest.profile)throw Error('AI_CORPUS_SOURCE_MISMATCH');
    for(const seed of seeds)for(const controlledSide of manifest.controlledSides)
      result.push({id:entry.id,seed,controlledSide,opponentSide:controlledSide==='player'?'enemy':'player',
        level:structuredClone(level)});
  }
  return result;
}
