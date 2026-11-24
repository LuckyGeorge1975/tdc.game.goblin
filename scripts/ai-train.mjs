import {resolve,dirname} from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {start,train,stopRun,inspect} from './ai-training-runner/controller.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const help=`Lokales KI-Werkzeug (keine Modellpromotion)
node scripts/ai-train.mjs autoplay --output <Runordner> [--levels <Ordner>] [--config <JSON>] [--max-games 1000] [--evaluation-games 300] [--seed 7] [--workers 1]
node scripts/ai-train.mjs training --dataset <Runordner> [--max-epochs <bis zur gebundenen Obergrenze>] [--resume]
node scripts/ai-train.mjs autoplay --output <Runordner> --resume
node scripts/ai-train.mjs status|verify|stop --output <Runordner>
STOP-Datei oder Ctrl+C stoppt eigene Kinder. Resume bewahrt Fragmente und zählt Wiederholungen gegen dasselbe Gesamtbudget. training startet nach Fit automatisch die reservierten Prüfspiele.`;
try{
 const args=process.argv.slice(2),command=args.shift();
 if(!command||['help','--help','-h'].includes(command)){console.log(help);}else{
  if(!['autoplay','training','status','verify','stop'].includes(command))throw Error('UNKNOWN_COMMAND');
  const options={};
  while(args.length){const key=args.shift();if(!['--output','--dataset','--levels','--config','--max-games','--evaluation-games','--seed','--workers','--max-epochs','--resume'].includes(key)||Object.hasOwn(options,key))throw Error('UNKNOWN_OR_DUPLICATE_OPTION: '+key);if(key==='--resume')options[key]=true;else{if(!args.length||args[0].startsWith('--'))throw Error('OPTION_VALUE_MISSING: '+key);options[key]=args.shift();}}
  const output=options['--output']??options['--dataset'];if(!output)throw Error('OUTPUT_OR_DATASET_REQUIRED');
  if(options['--dataset']&&options['--output'])throw Error('OUTPUT_AND_DATASET_AMBIGUOUS');
  const run=resolve(output);
  if(command==='autoplay'){
   let config=options['--config']?JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readFile(resolve(options['--config'])))):{};
   const levelDirectory=options['--levels']?resolve(options['--levels']):config.levelDirectory?resolve(options['--config']?dirname(resolve(options['--config'])):root,config.levelDirectory):resolve(root,'training-levels');
   delete config.levelDirectory;
   for(const [arg,key]of [['--max-games','maxGames'],['--evaluation-games','evaluationGames'],['--seed','masterSeed'],['--workers','workers'],['--max-epochs','maxEpochs']])if(options[arg]!==undefined)config[key]=Number(options[arg]);
   if(options['--resume']&&(Object.keys(config).length||options['--levels']||options['--config']))throw Error('RESUME_USES_BOUND_CONFIG_NO_OVERRIDES');
   await mkdir(dirname(run),{recursive:true});await start({output:run,levelDirectory,config,resume:!!options['--resume']});
  }else if(command==='training'){
   await train({output:run,resume:!!options['--resume'],maxEpochs:options['--max-epochs']===undefined?undefined:Number(options['--max-epochs'])});
  }else if(command==='stop')await stopRun(run);
  else console.log(JSON.stringify(await inspect(run,command==='verify'),null,2));
 }
}catch(error){console.error(error.stack??String(error));process.exitCode=2;}
