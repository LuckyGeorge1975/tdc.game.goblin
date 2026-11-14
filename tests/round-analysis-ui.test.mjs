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
    {descriptionKey:'Move', actor:{labelKey:'Visible actor',cell:{x:1,y:2},token:'private-id'},
      snapshot:{width:12,height:8, units:[],visiblePathSegments:[
        {entityToken:'private-id',cells:[{x:1,y:2},{x:2,y:2}]},
        {entityToken:'private-id',cells:[{x:5,y:2},{x:6,y:2}]}
      ]}, rawWorld:'private-world'},
    {descriptionKey:'Fire', target:{labelKey:'Visible target'}, explanationKey:'In range',
      options:[{descriptionKey:'Target B',score:0,optionKey:'private-alternative'}]}
  ]};
  renderRoundAnalysis(panel,round,{
    t, back(){}, onSelect:index=>shown.push(index),
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
