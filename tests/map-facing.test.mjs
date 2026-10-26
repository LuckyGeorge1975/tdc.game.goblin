import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function scene(runtime='core',team='player'){
  const node=tag=>({tag,children:[],attributes:{},classList:{add(){}},
    setAttribute(k,v){this.attributes[k]=String(v);},
    appendChild(child){this.children.push(child);return child;},
    replaceWith(child){this.replacement=child;}});
  const context=vm.createContext({document:{createElementNS:(_,tag)=>node(tag),createElement:node}});
  for(const file of ['presentation-state.js','unit-visuals.js'])
    vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
  const art=context.UnitVisuals,owner=context.GoblinPresentation;
  const unit={id:'actor',name:'GOBLIN SIEGEBREAKER',team,x:2,y:2,hp:3};
  const before={units:[{...unit,visualKey:art.artKey(unit)}]};
  const binding={runtime,scenarioId:'facing-test',scenarioVersion:1,ruleProfileId:'TEST',
    sourceStateVersion:'test',sessionId:1};
  owner.bind(binding,before);
  function move(to){
    const ticket=owner.begin({type:'Move',actorId:unit.id},before);
    const after={units:[{...before.units[0],...to}]};
    owner.confirm(ticket,after,[{type:'UnitMoved',unitId:unit.id,from:unit,to,path:[to]}],
      [{kind:'move',actorId:unit.id,from:{x:unit.x,y:unit.y},to,path:[to],sourceEventIndex:0}]);
    return {...unit,...to};
  }
  function draw(displayed=unit,map=true){
    const group=node('g'),image=art.draw(group,displayed,{x:88,y:71},{map,selected:true});
    return {group,image,shadow:group.children[1]};
  }
  return {context,art,owner,unit,before,binding,node,move,draw};
}

const directions=[[{x:3,y:2},0],[{x:2,y:3},60],[{x:1,y:3},120],
  [{x:1,y:2},180],[{x:1,y:1},240],[{x:2,y:1},300]];
for(const runtime of ['core','legacy'])for(const team of ['player','enemy']){
  test(`${runtime}/${team}: all six accepted directions rotate only the centered map sprite`,()=>{
    for(const [to,angle] of directions){
      const s=scene(runtime,team),displayed=s.move(to);
      const state=JSON.stringify(s.owner.endState()),events=JSON.stringify(s.owner.events());
      const {group,image,shadow}=s.draw(displayed);
      const actual=Number(image.attributes.transform.match(/rotate\(([^ ]+)/)[1]);
      assert.ok(Math.abs(actual-(angle-(team==='enemy'?180:0)))<1e-8);
      assert.ok(image.attributes.transform.endsWith(' 88 71)'));
      assert.equal(shadow.children[0],image);
      assert.equal(shadow.attributes.transform,undefined);
      assert.match(shadow.attributes.style,/filter:drop-shadow\([\d.]+px [\d.]+px [\d.]+px rgba\(8,10,14,.5\)\)/);
      assert.equal(group.children[0].attributes.transform,undefined,'selection does not rotate');
      assert.equal(group.attributes.transform,undefined,'HP and status siblings remain upright');
      assert.ok(Math.abs(Number(image.attributes.x)+Number(image.attributes.width)/2-88)<1e-10);
      assert.ok(Math.abs(Number(image.attributes.y)+Number(image.attributes.height)/2-71)<1e-10);
      assert.equal(s.draw(displayed,false).image.attributes.transform,undefined,'non-map images stay fixed');
      assert.equal(JSON.stringify(s.owner.endState()),state);
      assert.equal(JSON.stringify(s.owner.events()),events);
    }
  });
}

test('missing, stale or inconsistent sidecars stay at quiet side base',()=>{
  const s=scene(),displayed=s.move({x:2,y:3});
  assert.equal(s.art.mapAngle(s.unit),0,'old position cannot consume new facing');
  assert.equal(s.art.mapAngle({...displayed,team:'enemy'}),0);
  assert.equal(s.art.mapAngle({...displayed,name:'INFANTRY SQUAD'}),0);
  const valid=s.owner.read();
  s.context.GoblinPresentation={read:()=>({...valid,facingByUnit:null}),endState:()=>s.owner.endState(),owns:()=>true};
  assert.equal(s.art.mapAngle(displayed),0);
  s.context.GoblinPresentation=undefined;
  assert.equal(s.art.mapAngle(displayed),0);
});

test('reset/session change and rewind expose baseline or restored facing without animation',()=>{
  const s=scene('legacy','enemy'),saved=s.owner.read();
  const displayed=s.move({x:2,y:3});
  assert.ok(Math.abs(s.art.mapAngle(displayed)+120)<1e-8);
  s.owner.rewind(saved,s.before);
  assert.equal(s.draw().image.attributes.transform,'rotate(0 88 71)');
  s.owner.bind({...s.binding,sessionId:2},{units:[{...s.before.units[0],...displayed}]});
  assert.equal(s.draw(displayed).image.attributes.transform,'rotate(0 88 71)');
});

test('rotated measured bounds contain all original alpha-box corners; markers use same angle',()=>{
  const s=scene(),displayed=s.move({x:2,y:3}),asset=s.art.assetFor(displayed);
  s.context.GoblinMarkerGeometry={icons:{[asset]:{width:100,height:100,bounds:[10,20,90,70]}}};
  const bounds=s.art.boundsFor({...displayed,unitId:displayed.id,position:{x:displayed.x,y:displayed.y}});
  const size=s.art.resolve(displayed).size,angle=Math.PI/3;
  for(const [x,y] of [[-.4,-.3],[.4,-.3],[.4,.2],[-.4,.2]]){
    const px=size*(x*Math.cos(angle)-y*Math.sin(angle)),py=size*(x*Math.sin(angle)+y*Math.cos(angle));
    assert.ok(px>=bounds.left-1e-10&&px<=bounds.right+1e-10);
    assert.ok(py>=bounds.top-1e-10&&py<=bounds.bottom+1e-10);
  }
});

test('failed rotated images replace the whole shadow container with unrotated vector fallback',()=>{
  const s=scene(),displayed=s.move({x:2,y:3});
  const {image,shadow}=s.draw(displayed);
  image.onerror();
  assert.equal(shadow.replacement.tag,'g');
  assert.equal(shadow.replacement.attributes.style,undefined);
  assert.equal(shadow.replacement.children[0].tag,'polygon');
  assert.equal(shadow.replacement.children[0].attributes.transform,undefined);
  assert.equal(s.draw(displayed).image.tag,'polygon');
});

test('map sorting is independent of roster order, preserves input, and keeps wrecks below live units',()=>{
  const {art}=scene();
  const units=[{id:'z',y:2,hp:1},{id:'b',y:1,hp:1},{id:'a',y:1,hp:1},{id:'wreck',y:7,hp:0}];
  const saved=JSON.stringify(units);
  assert.deepEqual(Array.from(art.sortMapUnits(units),u=>u.id),['wreck','a','b','z']);
  assert.deepEqual(Array.from(art.sortMapUnits([...units].reverse()),u=>u.id),['wreck','a','b','z']);
  assert.equal(JSON.stringify(units),saved);
});
