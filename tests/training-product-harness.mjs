import fs from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
import {artilleryScene,queryBridge,read,execute} from './artillery-product-harness.mjs';
export function advanceEnemy(g){
 g.run("if(turnPhase==='movement')setTurnPhase('fire');if(turnPhase==='fire')setTurnPhase('gev');startEnemyTurn()");
 const entry=[...g.timers.entries()].find(([,fn])=>String(fn).includes('const foes='));if(!entry)throw Error('Missing actual enemy callback');g.timers.delete(entry[0]);entry[1]();return entry[1];
}
export async function trainingScene(id='training-t01',advisory=false){
 const g=artilleryScene(false,7,true,['training-director.js','training-model.js','training-runtime.js']);
 g.context.crypto=webcrypto;g.context.TextEncoder=TextEncoder;
 g.context.trainingLevels=JSON.parse(fs.readFileSync(new URL('../assets/training/levels.v1.json',import.meta.url)));
 g.context.trainingScripts=JSON.parse(fs.readFileSync(new URL('../assets/training/scripts.v1.json',import.meta.url)));
 await g.run('GoblinTrainingModel.initialize(trainingLevels,trainingScripts)');
 if(advisory)await g.run("GoblinTrainingModel.initializeAdvisory(scenarioCatalog['iron-dust'])");
 g.run(`Object.assign(scenarioCatalog,GoblinTrainingModel.configs);loadScenario(${JSON.stringify(id)})`);queryBridge(g);return g;
}
export function inspect(g,command){g.run(`GoblinTrainingRuntime.inspect(${JSON.stringify(command)},query(${JSON.stringify(command)}),${command.type==='Fire'?`previewFire(${JSON.stringify(command)})`:'null'})`)}
export function snapshot(g){return {world:JSON.parse(g.state()),history:read(g,'phaseCommands.map(({log,...checkpoint})=>checkpoint)'),director:read(g,'GoblinTrainingRuntime.view()'),audit:read(g,'GoblinTrainingRuntime.audit()'),trainingRng:read(g,'GoblinTrainingRuntime.rng()'),ambientRng:g.rng()}}
export function route(id){const tank=id+'-tank',infantry=id+'-infantry',move={type:'Move',actorId:tank,x:3,y:3},shot={type:'Fire',actorId:tank,x:5,y:3};const list=[{ui:'ack',action:'continue'},{ui:'select',actorId:tank}];
 if(id==='training-t01')return [...list,{ui:'inspect',command:move},{ui:'cancel'},{command:move},{undo:true},{command:move},{command:{type:'Move',actorId:infantry,x:2,y:5}},{undo:true},{command:{type:'Move',actorId:infantry,x:3,y:5}},{ui:'ack',action:'debrief'}];
 if(id==='training-t03')list.push({ui:'inspect',command:{type:'Move',actorId:tank,x:2,y:3}});
 list.push({command:move});
 if(id==='training-t03')list.push({ui:'inspect',command:shot},{ui:'ack',action:'continue'},{enemy:true},{command:{type:'Move',actorId:tank,x:4,y:3}});
 list.push({phase:'fire'},{ui:'inspect',command:shot},{command:shot});
 if(id==='training-t02')list.push({ui:'ack',action:'continue'});
 list.push({enemy:true});if(id==='training-t03')list.push({command:{type:'Move',actorId:infantry,x:2,y:5}});
 list.push({ui:'ack',action:'debrief'});return list;
}
export function apply(g,action){
 if(action.ui==='ack')g.run(`GoblinTrainingRuntime.ack(${JSON.stringify(action.action)})`);
 else if(action.ui==='select')g.run(`GoblinTrainingRuntime.select(${JSON.stringify(action.actorId)})`);
 else if(action.ui==='inspect')inspect(g,action.command);
 else if(action.ui==='cancel')g.run('GoblinTrainingRuntime.cancel()');
 else if(action.command){const result=execute(g,action.command);if(!result.ok)throw Error('Actual command rejected: '+JSON.stringify({action,result}))}
 else if(action.undo)g.run('undoPhaseCommand()');
 else if(action.phase)g.run(`setTurnPhase(${JSON.stringify(action.phase)})`);
 else if(action.enemy)advanceEnemy(g);else throw Error('Unknown recorded action');
}
export const trainingSources=['training-director.js','training-model.js','training-runtime.js','training-loader.js','assets/training/levels.v1.json','assets/training/scripts.v1.json','scenario-profile-manifest.js','game.js','scenario.js','command-history.js','combat-feedback.js','ogre-runtime.js','ui-v2.js','ui-v2-flow.js','ui-v2.css','localization.js','index.html','tests/training-product-harness.mjs','tests/artillery-product-harness.mjs','unit-life.js','unit-visuals.js','terrain-rules.js','ogre-systems.js','legacy-supercover.js','artillery-spotter-rules.js','assets/unit-art/rules/artillery-pilot.v1.js','siege-tank-fire-budget.js','assets/unit-art/rules/siege-pilot.v1.js','skimmer-budget.js','assets/unit-art/rules/skimmer-pilot.v1.js','catalog-specialists-fire.js','catalog-base-model.js','catalog-specialists-model.js','siegebreaker-weapons.js','strategic-missile.js','siege-pilot-runtime.js','artillery-pilot-runtime.js','catalog-base-runtime.js','catalog-specialists-runtime.js','catalog-specialists-ui.js','m1-unit-markers.js'];
export function sourceHashes(){return Object.fromEntries(trainingSources.map(path=>[path,createHash('sha256').update(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8').replaceAll('\r\n','\n')).digest('hex')]))}
export async function record(id){const g=await trainingScene(id),actions=route(id),states=[snapshot(g)];for(const action of actions){apply(g,action);states.push(snapshot(g))}return {version:'training-game-and-teaching-trace-v1',scenarioId:id,header:{sourceHashes:sourceHashes(),definition:states[0].director.definition,seed:states[0].trainingRng.seed,gameplayObservations:'complete World, existing phase history except presentation log, both RNG channels and caller audit',teachingObservations:'semantic bridge Select/Query/Intent/Cancel/Ack plus full Director progress; native UI independently required'},actions,states}}
