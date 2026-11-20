import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';
import {createFullCatalogAiHost} from '../src/core/full-catalog-ai-adapter.mjs';
const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const ui=source('ui-v2.js'),flow=source('ui-v2-flow.js');
const outcomeCode=ui.slice(ui.indexOf('    function outcomeKey('),ui.indexOf('    const core ='));
class Node {
  constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.value='';this.attributes={};}
  append(...children){this.children.push(...children);}
  setAttribute(key,value){this.attributes[key]=value;}
}
const texts=node=>[node.textContent,...node.children.flatMap(texts)];
const nodes=node=>[node,...node.children.flatMap(nodes)];
const translate=(key,params)=>key+(params?':'+JSON.stringify(params):'');

test('draw has explicit long and short labels and preserves the existing boolean results',()=>{
  const context=vm.createContext({});vm.runInContext(outcomeCode,context);
  for(const [outcome,key,short] of [['draw','draw','draw'],[true,'victory','win'],[false,'defeat','lose']]){
    assert.equal(context.outcomeKey(outcome),'screen.missionEnd.'+key+'.title');
    assert.equal(context.outcomeKey(outcome,true),'v2.'+short);
  }
});

const commands=[{type:'Move',actorId:'own',x:1,y:2},{type:'Engineer',actorId:'own',job:'clear',x:2,y:2},
  {type:'Embark',actorId:'own',carrierId:'other',x:2,y:2},{type:'Unload',actorId:'own',cargoId:'other',x:2,y:2},
  {type:'CatalogLoad',actorId:'own',cargoId:'other'},{type:'CatalogDeploy',actorId:'own',x:2,y:2},
  {type:'CatalogRam',actorId:'own',targetId:'other'},
  {type:'CatalogFire',actorId:'own',target:{runtimeUnitId:'other'}},{type:'CatalogHexFire',actorId:'own',x:2,y:2}];
function seat(side,outcome=null,withoutSnapshot=false,native=null){
  const panel=new Node('panel'),session={},permit={side},commits=[],undos=[];
  let ticket=0,refreshed=0,confirmed=0,downloaded=null;
  const state=native?.port.state()??{side:outcome===null?side:null,phase:outcome===null?'movement':'over',humanReady:outcome===null,ended:outcome!==null,outcome};
  const port=native?.port??{state:()=>state,canUndo:()=>!state.ended,canExportTraining:()=>state.ended,trainingArchive:()=>({outcome}),
    ticket:mode=>({side,mode,number:++ticket}),undo:value=>{undos.push(value);return value?.number===ticket;},
    open:()=>state.ended?null:{permit,pass:state.phase,entries:null}};
  const snapshot=native?.snapshot??{view:{side,phase:'movement',turn:2,ended:state.ended,outcome,objectiveRemaining:1,
    units:[{id:'own',assetId:'field-engineers'},{id:'other',assetId:'assault-tank'}]},log:[]};
  const binding={session,port,owner:{playerCommands:()=>commands,
    commitHuman:(...args)=>{commits.push(args);return {ok:true};}},lifecycle:{paused:false,pause(){},resume(){},sync(){}}};
  const context=vm.createContext({panel,fullSeatBinding:binding,legacySession:session,editorConfig:null,
    screen:'full-seat',units:[],GoblinUIV2:{fullSeatPresentation:()=>withoutSnapshot?null:snapshot},
    GoblinFullRoundSource:{view:()=>null},document:{createElement:tag=>new Node(tag)},
    t:translate,heading:text=>new Node('heading',text),paragraph:(text,cls)=>new Node('p',text),
    actions:(...children)=>{const node=new Node('actions');node.append(...children);return node;},
    button:(text,onclick)=>Object.assign(new Node('button',text),{onclick}),fullSeatMap:view=>Object.assign(new Node('map'),{view}),
    confirmRestart(){},leaveMission(){},openRoundAnalysis(){},renderFullSpectator(){},
    downloadTrainingArchive:archive=>{downloaded=archive;},
    renderScreen(){refreshed++;},confirmPhaseAdvance:async apply=>{confirmed++;apply();}});
  const code=flow.slice(flow.indexOf('    function fullOutcomeText('),flow.indexOf('    // The caller owns the isolated match;'));
  vm.runInContext(code+'\nrenderFullSeat(panel,false);',context);
  return {panel,commits,undos,permit,port,context,get downloaded(){return downloaded;},get refreshed(){return refreshed;},get confirmed(){return confirmed;}};
}

test('both human seats present and forward every admitted canonical option plus EndPhase',async()=>{
  for(const side of ['player','enemy']){
    const view=seat(side),select=nodes(view.panel).find(node=>node.tag==='select');
    assert.equal(select.children.length,commands.length+1);
    assert.ok(select.children.every(option=>!option.textContent.includes('v2.feedback.action')));
    const confirm=nodes(view.panel).find(node=>node.textContent==='ui.dialog.confirm');
    for(let index=0;index<commands.length;index++){
      select.value=String(index);await confirm.onclick();
      assert.equal(view.commits.at(-1)[1],view.permit);
      assert.deepEqual(view.commits.at(-1)[3],commands[index]);
    }
    select.value=String(commands.length);await confirm.onclick();
    assert.equal(view.confirmed,1);
    assert.equal(view.commits.at(-1)[3].type,'EndPhase');
    const undo=nodes(view.panel).find(node=>node.textContent==='v2.full.undo');
    undo.onclick();undo.onclick();
    assert.deepEqual(view.undos.map(ticket=>ticket.number),[1,2]);
    assert.ok(view.undos.every(ticket=>ticket.side===side&&ticket.mode==='human'));
  }
});

test('the human seat result displays draw and identifies the global winner for either boolean result',()=>{
  for(const side of ['player','enemy']){
    const draw=seat(side,'draw');
    assert.ok(texts(draw.panel).includes('screen.missionEnd.draw.title'));
    assert.ok(texts(draw.panel).includes('screen.missionEnd.draw.allUnits'));
    assert.equal(nodes(draw.panel).some(node=>node.tag==='select'),false);
    for(const result of [true,false]){
      const view=seat(side,result);
      assert.ok(texts(view.panel).some(text=>text.startsWith('v2.full.winner:')&&
        text.includes(result?'v2.full.seat.player':'v2.full.seat.enemy')));
    }
  }
});

test('interactive FULL map undo uses current human permission rather than legacy phase assumptions',()=>{
  const tickets=[],accepted=[];let canUndo=true,rendered=0,legacyUndos=0;
  const mapPort={canUndo:()=>canUndo,ticket:mode=>{const value={mode,number:tickets.length+1};tickets.push(value);return value;},
    undo:ticket=>{accepted.push(ticket);return ticket===tickets.at(-1);}};
  const context=vm.createContext({core:()=>false,view:{busy:false},gameOver:false,phaseCommands:[],phase:'enemy',
    GoblinCatalogFullRuntime:{ownsPresentation:()=>false,mapPort:()=>mapPort},t:translate,
    clearContext(){},render(){rendered++;},undoPhaseCommand(){legacyUndos++;}});
  vm.runInContext(ui.slice(ui.indexOf('    function undo()'),ui.indexOf('    function resetView()')),context);
  assert.equal(context.undo().ok,true);
  assert.equal(accepted[0],tickets[0]);
  assert.equal(accepted[0].mode,'human');
  assert.equal(rendered,1);assert.equal(legacyUndos,0);
  canUndo=false;
  assert.equal(context.undo().ok,false);assert.equal(accepted.length,1);
});

test('the end screen distinguishes draw, force victory and defeat without missing mission copy',()=>{
  const keyContext=vm.createContext({});vm.runInContext(outcomeCode,keyContext);
  const start=flow.indexOf('        const won = state.objective.outcome === true;');
  const code=flow.slice(start,flow.indexOf('        const mapPort=',start));
  for(const [outcome,body] of [['draw','screen.missionEnd.draw.allUnits'],
    [true,'v2.full.symmetricVictory'],[false,'screen.missionEnd.defeat.allUnits']]){
    const panel=new Node('panel');
    const context=vm.createContext({panel,state:{objective:{outcome,goalMode:'eliminate-opponent',playerAlive:outcome===true},
      scenario:'ai-urban-8',turn:3},editorConfig:null,campaign:null,missionId:'ai-urban-8',t:key=>key,
      GoblinUIV2:{outcomeKey:keyContext.outcomeKey},GoblinCatalogFullRuntime:{active:()=>true},
      heading:text=>new Node('heading',text),paragraph:text=>new Node('p',text),
      actions:(...children)=>{const node=new Node('actions');node.append(...children);return node;},
      button:(text,onclick)=>Object.assign(new Node('button',text),{onclick}),
      confirmRestart(){},goToLevels(){},openSection(){}});
    vm.runInContext(code,context);
    assert.equal(panel.children[0].textContent,keyContext.outcomeKey(outcome));
    assert.equal(panel.children[1].textContent,body);
    assert.equal(nodes(panel).filter(node=>node.tag==='button').length,3);
  }
});

test('a terminal result replaces the phase-action caption even when the last phase was fire',()=>{
  const start=ui.indexOf("      const next = { movement: 'dialog.phaseAdvance.confirm.toFire'");
  const code=ui.slice(start,ui.indexOf('      phaseButton.setAttribute',start));
  for(const outcome of ['draw',true,false]){
    const action={};
    const context=vm.createContext({state:{gameOver:true,objective:{outcome},turnPhase:'fire',ready:0},
      learningResult:null,t:key=>key,at:()=>action});
    vm.runInContext(outcomeCode+code,context);
    assert.equal(action.textContent,context.outcomeKey(outcome));
  }
});

test('terminal human results remain visible when native human projection is closed',()=>{
  for(const side of ['player','enemy'])for(const outcome of ['draw',true,false]){
    const view=seat(side,outcome,true),content=texts(view.panel);
    assert.equal(nodes(view.panel).some(node=>node.tag==='select'),false);
    assert.equal(view.port.state().side,null);assert.equal(view.port.state().phase,'over');
    assert.equal(nodes(view.panel).some(node=>['v2.full.undo','ui.nav.pause','ui.nav.resume','ui.dialog.confirm'].includes(node.textContent)),false);
    nodes(view.panel).find(node=>node.textContent==='v2.training.exportMatch').onclick();
    assert.equal(view.downloaded.outcome,outcome);
    if(outcome==='draw'){
      assert.equal(content.filter(text=>text==='screen.missionEnd.draw.title').length,1);
      assert.ok(content.includes('screen.missionEnd.draw.allUnits'));
    }else assert.ok(content.some(text=>text.startsWith('v2.full.winner:')&&
      text.includes(outcome?'v2.full.seat.player':'v2.full.seat.enemy')));
  }
});

test('the real seeded terminal human Draw frame renders the final map on either last human seat',async()=>{
  for(const side of ['player','enemy']){
  const game=await fullScene();for(const file of ['level-events.js','editor-draft.js'])game.run(source(file));
  game.context.source={version:'goblin-level-v3',width:8,height:8,objective:'eliminate-opponent',terrain:[],units:[
    {id:'p',assetId:'strategic-missile-carrier',team:side,x:1,y:1},
    {id:'e',assetId:'field-engineers',team:side==='player'?'enemy':'player',x:2,y:1}]};
  await game.run(`GoblinEditorDraft.prepare(source).then(config=>{globalThis.port=loadEditorDraft(config,
    {roles:{player:'human',enemy:'human'},seed:30,ui:{handoff(_seat,take){take()}}})})`);
  const port=game.context.port,full=game.context.GoblinCatalogFullRuntime;
  const host=createFullCatalogAiHost(full,game.context.GoblinSpecialistsUI,full.nativePlayerGateway,
    ()=>port.state()?.side,game.context.GoblinSpecialistsRuntime);
  if(side==='enemy')for(let i=0;i<3;i++)assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'},host.dispatch).ok,true);
  for(const command of [{type:'EndPhase'},{type:'CatalogHexFire',actorId:'p',x:1,y:1}])
    assert.equal(port.commit('human',port.open('human').permit,command,host.dispatch).ok,true);
  assert.equal(port.state().side,null);assert.equal(port.state().phase,'over');
  assert.equal(port.state().outcome,'draw');assert.equal(port.open('human'),null);
  const snapshot=port.project('human');assert.ok(snapshot,'terminal human presentation remains readable');
  assert.equal(snapshot.view.side,side);
  const view=seat(side,'draw',false,{port,snapshot}),map=nodes(view.panel).find(node=>node.tag==='map');
  assert.ok(map);assert.equal(map.view.terrain.width,8);assert.equal(map.view.units.filter(unit=>unit.alive).length,0);
  assert.ok(texts(view.panel).includes('screen.missionEnd.draw.title'));
  assert.equal(nodes(view.panel).some(node=>node.tag==='select'),false);
  nodes(view.panel).find(node=>node.textContent==='v2.training.exportMatch').onclick();
  assert.equal(view.downloaded.outcome,'draw');assert.equal(view.downloaded.replay.seed,30);
  }
});
