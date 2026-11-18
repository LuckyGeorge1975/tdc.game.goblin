import assert from 'node:assert/strict';
import test from 'node:test';
import {renderRoundAnalysis} from '../round-analysis-ui.mjs';

const doc = {
  createElement(tag) {
    return {
      tag, ownerDocument:doc, attrs:{}, children:[], classList:{add(){}},
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren() { this.children = []; },
      setAttribute(key,value) { this.attrs[key] = String(value); },
      querySelector(tag) { return this.children.find(node => node.tag === tag); }
    };
  },
  createElementNS(namespace, tag) { return this.createElement(tag); }
};
const t = (key, params) => params ? key + ' ' + params.round : key;
const all = node => [node,...node.children.flatMap(all)];

test('unavailable fields, private extras and unobserved path gaps are not rendered', () => {
  const panel = doc.createElement('div');
  const shown = [];
  const round = {schemaVersion:1,roundNumber:5,completion:'complete',perspective:'player',rows:[
    {kind:'move',descriptionKey:'Move', actor:{labelKey:'Visible actor',cell:{x:1,y:2},token:'private-id'},
      snapshot:{width:12,height:8, units:[],visiblePathSegments:[
        {entityToken:'private-id',cells:[{x:1,y:2},{x:2,y:2}]},
        {entityToken:'private-id',cells:[{x:5,y:2},{x:6,y:2}]}
      ]}, rawWorld:'private-world'},
    {descriptionKey:'Fire', target:{labelKey:'Visible target'}, explanationKey:'In range',
      options:[{descriptionKey:'Target B',score:0,optionKey:'private-alternative'}]}
  ]};
  renderRoundAnalysis(panel,round,{
    t, back(){}, icon:name=>`<svg data-icon="${name}"></svg>`, onSelect:index=>shown.push(index),
    previewMap(map) {
      assert.deepEqual(map,{width:12,height:8,terrain:[],defaultTerrain:'open-ground',units:[]});
      const figure = doc.createElement('figure');
      figure.append(doc.createElement('svg'));
      return figure;
    }
  });
  const svg = all(panel).find(node => node.tag === 'svg');
  assert.deepEqual(svg.children.filter(node => node.tag === 'polyline').map(node => node.attrs.points),
    ['59,80 95,80','203,80 239,80']);
  assert.equal(svg.children.filter(node => node.tag === 'circle').length,2);
  assert.deepEqual(svg.children.filter(node => node.attrs.class === 'v2-round-path-start')
    .map(node => [node.attrs.x,node.attrs.y]), [['55','76'],['199','76']]);
  const marker = svg.children.find(node => node.attrs.class === 'v2-round-action-marker');
  assert.equal(marker.attrs.transform,'translate(84 60)');
  assert.equal(marker.children.find(node => node.tag === 'title').textContent,'Move');
  assert.match(marker.children.find(node => node.tag === 'g').innerHTML,/data-icon="movement"/);
  assert.ok(all(panel).some(node => node.textContent === 'v2.round.noReason'));
  all(panel).find(node => node.tag === 'button' && node.textContent.startsWith('2.')).onclick();
  assert.deepEqual(shown,[1]);
  assert.ok(all(panel).some(node => node.textContent === 'v2.round.noMap'));
  assert.ok(all(panel).some(node => node.textContent === 'Target B · 0'));
  assert.ok(all(panel).every(node => !JSON.stringify(node.attrs).includes('private') && !node.textContent?.includes('private')));
});

test('an empty terminal part is labeled separately and does not ask for a map', () => {
  const panel = doc.createElement('div');
  renderRoundAnalysis(panel,{schemaVersion:1,roundNumber:3,completion:'terminal-partial',perspective:'post-mission',rows:[]},{
    t, back(){}, previewMap(){ assert.fail('Unexpected map request'); }
  });
  assert.ok(all(panel).some(node => node.textContent === 'v2.round.partial 3'));
  assert.ok(all(panel).some(node => node.textContent === 'v2.round.noDecisions'));
});

test('the authorized fire comparison labels its two different scales and keeps zero',()=>{
  const panel=doc.createElement('div');
  renderRoundAnalysis(panel,{schemaVersion:1,roundNumber:1,completion:'complete',perspective:'spectator',rows:[
    {descriptionKey:'Fire',explanationKey:'v2.round.modelTarget',options:[
      {descriptionKey:'Target A',actor:{labelKey:'Tank',cell:{x:1,y:2}},weaponRef:null,mode:'direct',
        baseline:true,scores:{basis:0,model:0}},
      {descriptionKey:'Target B',selected:true,scores:{model:2}},
      {descriptionKey:'Target C',scores:{basis:14}}
    ]}
  ]},{t,back(){},previewMap(){assert.fail('Unexpected map request');}});
  const labels=all(all(panel).find(node=>node.tag==='details')).filter(node=>node.tag==='li')
    .map(node=>node.textContent);
  assert.deepEqual(labels,[
    'Target A · Tank B-03 · v2.round.standardWeapon · v2.ui.artillery.direct · v2.round.baselineTarget · v2.round.basisScore 0 · v2.round.modelScore 0',
    'Target B · v2.round.selected · v2.round.modelScore 2',
    'Target C · v2.round.basisScore 14'
  ]);
});

test('the deadline reason is visible with only the recorded basis value in the active locale',()=>{
  const panel=doc.createElement('div');
  renderRoundAnalysis(panel,{schemaVersion:1,roundNumber:2,completion:'complete',perspective:'spectator',rows:[
    {descriptionKey:'Fire',explanationKey:'v2.round.deadlinePriority',options:[
      {descriptionKey:'Core',selected:true,baseline:true,scores:{basis:1.25}},
      {descriptionKey:'Guard'}
    ]}
  ]},{t,locale:'de',back(){},previewMap(){assert.fail('Unexpected map request');}});
  assert.ok(all(panel).some(node=>node.tag==='p'&&node.textContent==='v2.round.deadlinePriority'));
  assert.deepEqual(all(panel).filter(node=>node.tag==='li'&&node.textContent).map(node=>node.textContent),[
    'Core · v2.round.selected · v2.round.baselineTarget · v2.round.basisScore 1,25',
    'Guard'
  ]);
});
