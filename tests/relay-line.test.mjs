import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {runInNewContext} from 'node:vm';
import {fullScene} from './catalog-full-harness.mjs';
import {execute, read} from './artillery-product-harness.mjs';

const source = path => readFileSync(new URL('../' + path, import.meta.url),'utf8');
const flow = source('ui-v2-flow.js');
const cut = (from,to) => flow.slice(flow.indexOf(from),flow.indexOf(to,flow.indexOf(from)));

test('the position label names the selected campaign in all four languages', () => {
  const context = {URL, URLSearchParams, location:{href:import.meta.url}, document:{readyState:'loading',addEventListener(){}},
    campaign:{index:0,field:'relay'}, fieldCampaigns:{relay:{ids:['bridge','relay']},scorched:{ids:Array(12)}}, campaignLessons:['t01','t02']};
  runInNewContext(source('localization.js'),context);
  runInNewContext(cut('    function campaignPosition(', '    function fieldStorageKey('),context);
  for (const [lang,relay,tutorial] of [
    ['de','Relaislinie · Mission','Tutorialkampagne · Mission'],
    ['en','Relay Line · Mission','Tutorial campaign · Mission'],
    ['es','Línea de enlace · Misión','Campaña de tutorial · Misión'],
    ['fr','Ligne de relais · Mission','Campagne de tutoriel · Mission']
  ]) {
    context.t = (key,params) => context.GoblinLanguage.t(key,params,lang);
    context.campaign = {index:0,field:'relay'};
    assert.equal(context.campaignPosition(),relay + ' 1/2');
    context.campaign.index = 1;
    assert.equal(context.campaignPosition(),relay + ' 2/2');
    context.campaign = {index:0};
    assert.equal(context.campaignPosition(),tutorial + ' 1/2');
  }
});

test('Relay Line victory uses its own action labels and defeat offers no advance', () => {
  const labels = [];
  const context = {URL, URLSearchParams, location:{href:import.meta.url}, document:{readyState:'loading',addEventListener(){}},
    panel:{append(){}}, paragraph(){}, campaign:{field:'relay',index:0}, campaignPosition(){},
    advanceFieldCampaign(){}, actions(){}, button:label=>labels.push(label), fieldError:'', fieldCampaigns:{relay:{ids:['bridge','relay']}}};
  runInNewContext(source('localization.js'),context);
  const actions = cut('        if (campaign?.field) {\n          panel.append(paragraph(campaignPosition()));', "      } else if (screen === 'log')");
  runInNewContext('function renderActions(won) {\n' + actions.slice(0,actions.lastIndexOf('        }')) + '}',context);
  for (const [lang,next,finish] of [
    ['de','Weiter zu Relaisbruch','Relaislinie abschließen'],
    ['en','Continue to Relay Break','Finish Relay Line'],
    ['es','Continuar a Ruptura del enlace','Finalizar Línea de enlace'],
    ['fr','Continuer vers Rupture du relais','Terminer Ligne de relais']
  ]) {
    labels.length = 0;
    context.t = key => context.GoblinLanguage.t(key,{},lang);
    context.campaign.index = 0;
    context.renderActions(true);
    context.campaign.index = 1;
    context.renderActions(true);
    context.renderActions(false);
    assert.deepEqual(labels,[next,finish]);
  }
});

async function campaignGame() {
  const g = await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  const storage = new Map();
  g.context.localStorage = {getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  g.context.fetch = async path => ({ok:true,json:()=>JSON.parse(source(path.split('?')[0]))});
  g.run(source('level-events.js'));
  g.run(source('editor-draft.js'));
  g.run(`
    let screen='menu',missionId='catalog-full-atlas',startError='',started=false,editorConfig=null,savedConfig=null;
    const show=next=>{screen=next}, renderScreen=()=>{}, releasePause=()=>{};
    const GoblinUIV2={resetView(){},startView(){},project:()=>({gameOver,objective:objectiveSnapshot(victoryProfile(legacySession.effectiveRules),units)})};
    const missionData=()=>true;
    ${cut('    const campaignLessons','    let editorDraft')}
    ${cut('    function campaignAvailable','    async function goToLevels')}
    ${cut('    async function startMission','    function openEditor')}
  `);
  return {g, storage};
}

test('Relay Line admits both maps and unlocks mission two only after a bound victory', async () => {
  const {g, storage} = await campaignGame();
  await g.run("openFieldCampaign('relay')");
  assert.equal(g.run('screen'),'relay-campaign');
  g.run('chooseFieldMission(1)');
  assert.equal(g.run('campaign'),null);
  g.run('chooseFieldMission(0)');
  await g.run('startMission()');
  assert.equal(g.run('legacySession.ruleProfileId'),'FULL_CATALOG_v1');
  const initial = read(g,'legacySession.config.units');
  assert.equal(execute(g,{type:'Move',actorId:'relay-1',x:5,y:3}).ok,true);
  g.run("units.filter(u=>u.team==='player').forEach(u=>u.hp=0);checkVictory();recordFieldVictory(GoblinUIV2.project());show('end');advanceFieldCampaign()");
  assert.equal(g.run('screen'),'end');
  assert.equal(g.run('fieldUnlocked(fieldCampaigns.relay)'),1);
  assert.equal(storage.size,0);
  await g.run('confirmRestart()');
  assert.deepEqual(read(g,'legacySession.config.units'),initial);
  g.run("units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);checkVictory();recordFieldVictory(GoblinUIV2.project());show('end')");
  assert.equal(storage.get('tdc.game.goblin.relay-line.v1'),'2');
  g.run('fieldCampaigns.relay.unlocked=1');
  assert.equal(g.run('fieldUnlocked(fieldCampaigns.relay)'),2);
  g.run('advanceFieldCampaign()');
  assert.equal(g.run('missionId'),'relay-line-relay');
  await g.run('startMission()');
  assert.equal(g.run("units.some(u=>u.catalogAssetId==='relay-node')"),true);
  assert.equal(g.run("legacySession.config.terrainTypes.some(c=>c.type==='bridge')"),false);
  g.run("units.filter(u=>u.team==='enemy').forEach(u=>u.hp=0);checkVictory();show('end');advanceFieldCampaign()");
  assert.equal(g.run('screen'),'campaign-complete');
});

test('Scorched Earth loads all twelve FULL scenarios and advances only on the bound victory', async () => {
  const {g, storage} = await campaignGame();
  const key = 'tdc.game.goblin.scorched-earth.v1';
  const relayKey = 'tdc.game.goblin.relay-line.v1';
  storage.set(relayKey, '2');
  storage.set(key, '13');
  await g.run("openFieldCampaign('scorched')");
  assert.equal(g.run('screen'), 'relay-campaign');
  const levels = JSON.parse(source('assets/unit-art/levels/scorched-earth.v3.json'));
  const ids = read(g,'fieldCampaigns.scorched.ids');
  const briefings = ['de','en','es','fr'].map(lang =>
    JSON.parse(source(`assets/ui-copy/briefing-01.${lang}.json`)).messages);
  for (const [index,id] of ids.entries()) {
    const file = `${String(index + 1).padStart(2,'0')}-${id.slice('scorched-'.length)}`;
    assert.deepEqual(JSON.parse(source(`assets/unit-art/levels/scorched-earth/${file}.v3.json`)), levels[index]);
    for (const copy of briefings) assert.ok(copy[`mission.${id}.briefing.short`], id);
  }
  g.run('chooseFieldMission(1)');
  assert.equal(g.run('campaign'), null);
  g.run('chooseFieldMission(0)');
  for (let index = 0; index < 12; index++) {
    assert.equal(g.run('campaign.index'), index);
    await g.run('startMission()');
    assert.equal(g.run('legacySession.ruleProfileId'), 'FULL_CATALOG_v1');
    assert.deepEqual(read(g,'legacySession.config.terrainTypes'), read(g,'fieldCampaigns.scorched.configs[campaign.index].terrainTypes'));
    assert.deepEqual(read(g,'legacySession.config.units'), read(g,'fieldCampaigns.scorched.configs[campaign.index].units'));
    g.run("units.filter(u=>u.team==='enemy').forEach(u=>{u.hp=0;if(u.catalogSystems)u.alive=false});checkVictory()");
    if (index === 0) {
      g.run('campaign.sessionId=null;recordFieldVictory(GoblinUIV2.project())');
      assert.equal(storage.get(key), '13');
      g.run('bindCampaignLesson()');
    }
    g.run("recordFieldVictory(GoblinUIV2.project());show('end');advanceFieldCampaign()");
    assert.equal(storage.get(key), String(Math.min(index + 2, 12)));
    assert.equal(storage.get(relayKey), '2');
  }
  assert.equal(g.run('screen'), 'campaign-complete');
  g.run("fieldCampaigns.scorched.unlocked=1;show('menu')");
  await g.run("openFieldCampaign('scorched')");
  g.run('chooseFieldMission(11)');
  assert.equal(g.run('missionId'), 'scorched-last-ember');
});
