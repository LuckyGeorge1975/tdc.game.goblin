import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the active UI's real field paragraphs, not the hidden legacy intel panel.
const source=readFileSync(new URL('../ui-v2.js',import.meta.url),'utf8');
const begin="      const intel = at('#v2-intel'); intel.replaceChildren();";
const first=source.indexOf(begin),second=source.indexOf(begin,first+begin.length);
const blocks=[first,second].map(start=>source.slice(start,source.indexOf('      renderSystems(state, actor);',start)));
assert.ok(first>=0&&second>first&&blocks.every(block=>block.includes('v2-terrain-info')));

function scene(lang,runtime){
  const node=()=>({children:[],textContent:'',replaceChildren(){this.children=[];},
    appendChild(child){this.children.push(child);},append(child){this.children.push(child);},prepend(){}});
  const intel=node(),context=vm.createContext({console,URL,URLSearchParams,
    document:{currentScript:{src:'http://127.0.0.1/localization.js'},readyState:'loading',title:'',
      addEventListener(){},createElement:node},
    location:{href:'http://127.0.0.1/',search:''},navigator:{language:'de'},
    localStorage:{getItem:()=>null},fetch:async()=>({ok:true,json:async()=>({messages:{}})}),
    view:{target:{x:7,y:5},infoCell:null},at:()=>intel,
    hexLabel:()=> 'H-06',terrainTypeAt:()=> 'open',strengthText:()=> 'HP5',
    TerrainDisplay:{label:()=> 'OPEN',icon:()=>null}});
  for(const file of ['localization.js','presentation-state.js','unit-visuals.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  const language=context.GoblinLanguage;
  context.GoblinLanguage={t:(key,params)=>language.t(key,params,lang),translate:text=>language.translate(text,lang)};
  context.t=context.GoblinLanguage.t;
  const live={id:'ogre',name:'GOBLIN SIEGEBREAKER',visualKey:'goblin-siegebreaker',team:'player',x:7,y:5,hp:5};
  const wreck={id:'raider',name:'RAIDER SKIMMER',visualKey:'raider-skimmer',team:'enemy',x:7,y:5,hp:0};
  context.state={units:[live,wreck],cells:[{x:7,y:5,type:'open'}]};
  context.GoblinPresentation.bind({runtime,sessionId:1},context.state);
  return {context,intel,live,wreck};
}

for(const [index,runtime] of ['core','legacy'].entries())test(`active ${runtime} intel includes live occupant and localized wrecks, then drops undone wrecks`,()=>{
  for(const lang of ['de','en','es','fr']){
    const {context,intel,live,wreck}=scene(lang,runtime),before=JSON.stringify(context.state);
    vm.runInContext(blocks[index],context);
    const text=intel.children.map(child=>child.textContent).join(' ');
    assert.ok(text.includes(live.name));
    assert.ok(text.includes(context.UnitVisuals.wreckLabel(wreck)),`${runtime}/${lang}: ${text}`);
    assert.doesNotMatch(text,/\{name\}|v2\.field\.wreck/);
    assert.equal(JSON.stringify(context.state),before);
    context.GoblinPresentation.synchronize({...context.state,units:[live]});
    vm.runInContext(`{${blocks[index]}}`,context);
    assert.ok(!intel.children.some(child=>child.textContent.includes(wreck.name)));
  }
});
