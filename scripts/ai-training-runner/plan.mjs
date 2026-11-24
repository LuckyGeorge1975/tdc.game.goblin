import {hash,canonical} from './files.mjs';
export function random(seed){let state=seed>>>0;return ()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const shuffled=(items,rng)=>{const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;};
export function configuration(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('CONFIG_OBJECT_REQUIRED');
 const result={maxGames:1000,evaluationGames:300,masterSeed:7,workers:1,maxHeapMb:1024,minFreeMemoryMb:512,minFreeDiskMb:512,commandLimit:6276,roundLimit:516,maxEpochs:5000,patience:50,minDelta:1e-6,learningRate:.01,strategies:['weak','medium','strong','trained'],...input};
 const keys=['maxGames','evaluationGames','masterSeed','workers','maxHeapMb','minFreeMemoryMb','minFreeDiskMb','commandLimit','roundLimit','maxEpochs','patience','minDelta','learningRate','strategies'];
 if(Object.keys(result).some(k=>!keys.includes(k)))throw Error('CONFIG_UNKNOWN_FIELD');
 for(const name of ['maxGames','evaluationGames','masterSeed','workers','maxHeapMb','minFreeMemoryMb','minFreeDiskMb','commandLimit','roundLimit','maxEpochs','patience'])if(!Number.isSafeInteger(result[name])||result[name]<0)throw Error('CONFIG_INVALID: '+name);
 if(result.maxGames<3||result.maxGames>1000||result.evaluationGames<3||result.evaluationGames>=result.maxGames||result.evaluationGames%3||result.workers!==1||result.masterSeed>0xffffffff||result.maxEpochs<1||result.maxEpochs>5000||result.patience<1||result.commandLimit<1||result.roundLimit<1||result.maxHeapMb<128||!Number.isFinite(result.minDelta)||result.minDelta<0||!Number.isFinite(result.learningRate)||result.learningRate<=0)throw Error('CONFIG_BOUNDS_INVALID');
 if(!Array.isArray(result.strategies)||!result.strategies.length||new Set(result.strategies).size!==result.strategies.length||result.strategies.some(s=>!['weak','medium','strong','trained'].includes(s)))throw Error('CONFIG_STRATEGIES_INVALID');
 return result;
}
export function makePlan(pool,config,allowed,overlayAllowed=allowed){
 const rng=random(config.masterSeed),usedSeeds=new Set(),combinations=[];
 for(const level of pool.levels)for(const player of config.strategies)for(const enemy of config.strategies)if(allowed(level,player,enemy))combinations.push({levelId:level.id,seats:{player,enemy}});
 if(!combinations.length||pool.levels.some(l=>!combinations.some(c=>c.levelId===l.id)))throw Error('LEVEL_HAS_NO_COMPATIBLE_PAIRING');
 const evaluationCombinations=combinations.map(c=>{const allowed=overlayAllowed(pool.levels.find(l=>l.id===c.levelId),c.seats.player,c.seats.enemy);return {...c,sides:Array.isArray(allowed)?allowed:allowed?['player','enemy']:[]};}).filter(c=>c.sides.length);
 const nextSeed=()=>{let seed;do{seed=Math.floor(rng()*0x100000000);}while(usedSeeds.has(seed));usedSeeds.add(seed);return seed;};
 function families(count,split,candidates=combinations){const jobs=[],pairDecks=new Map();let levels=[];for(let i=0;i<count;i++){
  if(!levels.length)levels=shuffled(pool.levels.map(l=>l.id).filter(id=>candidates.some(c=>c.levelId===id)),rng);
  const levelId=levels.pop();let deck=pairDecks.get(levelId);
  if(!deck?.length){deck=shuffled(candidates.filter(c=>c.levelId===levelId),rng);pairDecks.set(levelId,deck);}
  jobs.push({...deck.pop(),id:split+'-'+String(i).padStart(5,'0'),seed:nextSeed(),split});
 }return jobs;}
 const dataBudget=config.maxGames-config.evaluationGames;
 const data=families(Math.floor(dataBudget/3),'data').map((item,i)=>({...item,split:i%5===4?'validation':'train'}));
 const evaluation=evaluationCombinations.length?families(config.evaluationGames/3,'test',evaluationCombinations):[];
 return {version:'goblin-ai-plan-v1',config,poolDigest:hash(canonical(pool)),dataBudget,evaluationBudget:config.evaluationGames,data,evaluation,combinations,evaluationCombinations,evaluationExcludedLevels:pool.levels.filter(l=>!evaluationCombinations.some(c=>c.levelId===l.id)).map(l=>l.id)};
}
