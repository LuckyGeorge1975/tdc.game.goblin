import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {fullScene} from './catalog-full-harness.mjs';

async function ownerFor(game,tag) {
  const replacements={
    document:{},GoblinV2Flow:{},
    GoblinCatalogFullRuntime:game.context.GoblinCatalogFullRuntime,
    GoblinSpecialistsUI:game.context.GoblinSpecialistsUI,
    GoblinSpecialistsRuntime:game.context.GoblinSpecialistsRuntime,
    GoblinLanguage:{t:key=>key},
    fetch:async input=>{
      const url=new URL(input);
      url.search='';
      const bytes=await readFile(url);
      return {ok:true,json:async()=>JSON.parse(bytes.toString('utf8')),
        arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    }
  };
  const previous=Object.fromEntries(Object.keys(replacements).map(key=>[key,globalThis[key]]));
  const originalOwner=globalThis.GoblinFullSeatOwner;
  try {
    Object.assign(globalThis,replacements);
    await import('../full-standard-seat-owner.mjs?exploration='+tag);
    const owner=globalThis.GoblinFullSeatOwner;
    await owner.ready;
    assert.deepEqual(owner.unavailable,[]);
    return owner;
  } finally {
    for(const [key,value] of Object.entries(previous)) {
      if(value===undefined)delete globalThis[key];
      else globalThis[key]=value;
    }
    if(originalOwner===undefined)delete globalThis.GoblinFullSeatOwner;
    else globalThis.GoblinFullSeatOwner=originalOwner;
  }
}

test('real low, medium and trained players search after the known core falls without using a hidden location',async()=>{
  for(const policy of ['player-weak','player-medium','full-attack-2a']) {
    const actions=[];
    for(const x of [10,11]) {
      const game=await fullScene();
      for(const file of ['level-events.js','editor-draft.js'])
        game.run(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
      const owner=await ownerFor(game,policy+'-'+x);
      game.context.phantomX=x;
      const config=await game.run(`GoblinEditorDraft.prepare({version:'goblin-level-v3',
        width:12,height:8,objective:'core-and-escort',terrain:[],units:[
          {id:'assault',assetId:'assault-tank',team:'player',x:1,y:2},
          {id:'core',assetId:'command-core',team:'enemy',x:2,y:2},
          {id:'phantom',assetId:'phantom-platform',team:'enemy',x:phantomX,y:7}
        ]})`);
      const selection={player:policy,enemy:null},handoffs=[];
      game.context.prepared=config;
      game.context.control={...owner.nativeSetup(config,selection),seed:4,
        ui:{handoff:(seat,take)=>{handoffs.push({seat,take});return true;}}};
      const port=game.run('loadEditorDraft(prepared,control)');
      const host=owner.bind(game.run('legacySession'),selection,{refresh(){}},port);
      try {
        for(let step=0;port.state().side==='player'&&step<8;step++)
          assert.deepEqual(await host.advance(),{ok:true});
        assert.equal(game.run('units.find(unit=>unit.id==="core").hp'),0,policy);
        assert.equal(port.state().ended,false);
        assert.equal(handoffs.at(-1).take(),true);
        for(let phase=0;phase<3;phase++)
          assert.equal(port.commit('human',port.open('human').permit,{type:'EndPhase'}).ok,true);
        assert.equal(port.state().side,'player');
        const view=port.project('ai').view;
        assert.equal(view.units.some(unit=>unit.id==='phantom'),false);
        assert.equal(view.objectiveRemaining,1);
        const before=game.run('JSON.stringify(units.find(unit=>unit.id==="assault"))');
        assert.deepEqual(await host.advance(),{ok:true});
        const after=game.run('units.find(unit=>unit.id==="assault")');
        assert.notEqual(JSON.stringify(after),before);
        assert.equal(after.moved,true);
        assert.equal(port.state().ended,false);
        actions.push({x:after.x,y:after.y});
      } finally {host.leave();}
    }
    assert.deepEqual(actions[0],actions[1],policy);
  }
});
