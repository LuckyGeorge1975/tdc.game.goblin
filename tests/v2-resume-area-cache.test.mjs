import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createIronDustBrowserSession, dispatchIronDustBrowserAction} from '../iron-dust-browser-v2.mjs';
import {queryIronDustProfile, queryIronDustCrtPreview} from '../src/core/iron-dust-executable-profile.mjs';
import {buildIronDustV2View} from '../iron-dust-v2-view.mjs';

const ui = readFileSync(new URL('../ui-v2.js', import.meta.url), 'utf8');
const flow = readFileSync(new URL('../ui-v2-flow.js', import.meta.url), 'utf8');
const bridge = readFileSync(new URL('../iron-dust-browser-v2.mjs', import.meta.url), 'utf8');
function between(source, start, end) {
  const first = source.indexOf(start), last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first, start);
  return source.slice(first, last);
}
const areaSource = between(ui, '    function areaQuery(', '    function freeRatioChipCenter(');
const cacheSource = between(ui, '      const key = JSON.stringify([core()', '      const hexWidth');
const releaseSource = between(flow, '    function releasePause()', '    function enterPause()');
const modeSource = between(ui, '    function activeAreaMode(', '    function areaQuery(');
const hiddenSource = between(ui, "      if (!mode || document.body.classList.contains('v2-screen-open'))", '      const runtime');
const refreshSource = ui.match(/refresh: (\(\) => [\s\S]*?) \}\);/)[1];
const querySource = between(bridge, '    query: command =>', '    previewFire:').trim().slice(7, -1);
const resumeSource = bridge.match(/    resume: (\(\) => \{[^\n]+\}),/)[1];

function scene() {
  let session = createIronDustBrowserSession();
  function command(value) {
    const result = dispatchIronDustBrowserAction(session, {playerId:'player', ...value});
    assert.ok(result.session, JSON.stringify(result.error));
    session = result.session;
  }
  command({type:'Move', unitId:'ogre', to:{x:4,y:5}});
  command({type:'EndPhase'});
  command({type:'SelectWeapon', unitId:'ogre', weaponKey:'missiles'});
  const records = [];
  const context = {
    mode:'ready', paused:false, pauseActive:false, screen:'play', savedAuto:false, waiting:[],
    get session() { return session; }, enemyFlow:{running:false,start(){}}, queryIronDustProfile,
    areaCache:{key:null,value:null}, GoblinLanguage:{current:'de'}, core:()=>true,
    previewWeaponKey:actor=>actor.selectedWeapon, t:key=>key,
    view:{target:{x:8,y:3}}, legend:{textContent:''},
    document:{querySelector:()=>({checked:false}),body:{classList:{contains:()=>false}}},
    maybeAutoAdvancePhase(){},
    project() {
      const source = buildIronDustV2View(session.projection, session.profile.header.ruleProfileId);
      return {...source, profile:source.ruleProfileId, revision:`core:1:${session.profile.digest}`,
        phase:source.mode, turnPhase:source.phase, gameOver:source.mode==='ended'};
    },
    previewFire(value) {
      if (context.paused) return null;
      const result = queryIronDustCrtPreview(session.profile, value);
      return result && {...result, stateRevision:`core:1:${result.stateRevision}`};
    },
    record(value) { records.push(value); },
  };
  runInNewContext(`
    globalThis.IronDustBrowserV2 = {
      query: ${querySource}, formatError: code=>code,
      resume: ${resumeSource}
    };
    ${modeSource}
    ${areaSource}
    function render() {
      const state=project(), actor=state.units.find(unit=>unit.id==='ogre');
      const mode=activeAreaMode(state), weaponKey=actor.selectedWeapon;
      ${hiddenSource}
      ${cacheSource}
      const preview=selectedFirePreview(state,actor,actor,mode,weaponKey,data.legal);
      record({key:areaCache.key, weaponKey, legal:data.legal.length, reason:data.reason,
        crt:preview?.ratioCategory??null, revision:state.revision});
    }
    globalThis.GoblinUIV2={refresh:${refreshSource}};
    ${releaseSource}
    globalThis.render=render;
    globalThis.release=releasePause;
  `, context);
  return {context, records, command, snapshot:()=>JSON.stringify(session),
    draw:()=>{context.render();return records.at(-1);},
    resumeFrench() {
      context.paused=true; context.pauseActive=true; context.GoblinLanguage.current='fr';
      assert.equal(context.IronDustBrowserV2.query({type:'PlayerFire',playerId:'player',
        unitId:'ogre',targetId:'guard',weaponKey:'missiles'}).available,false);
      // Actual show('play') refreshes after removing the overlay, before releasePause.
      context.GoblinUIV2.refresh();
      const pausedFrame=records.at(-1);
      context.release();
      return {pausedFrame,resumedFrame:records.at(-1)};
    }};
}

test('post-resume refresh replaces paused FR rejection with legal targets and selected CRT', () => {
  const model=scene(), before=model.draw(), state=model.snapshot();
  assert.equal(before.legal,2);
  assert.equal(before.crt,'2-1');
  const {pausedFrame,resumedFrame}=model.resumeFrench();
  assert.equal(pausedFrame.legal,0);
  assert.equal(pausedFrame.reason,'V2_NOT_READY');
  assert.equal(resumedFrame.revision,before.revision);
  assert.equal(resumedFrame.legal,2);
  assert.equal(resumedFrame.crt,'2-1');
  assert.equal(model.snapshot(),state,'resume/render must not change session or RNG');
  const frames=model.records.length;
  model.context.view.areaMode='none';
  model.context.render();
  assert.equal(model.records.length,frames,'area off returns before cache evaluation');
  model.context.view.areaMode='fire';
  assert.equal(model.draw().legal,2);
});

test('actual Main and Missiles commands render distinct keys after resume without firing', t => {
  const model=scene();
  model.draw(); model.resumeFrench();
  model.command({type:'SelectWeapon',unitId:'ogre',weaponKey:'main'});
  const main=model.draw();
  assert.equal(main.weaponKey,'main');
  assert.equal(main.legal,0);
  model.command({type:'SelectWeapon',unitId:'ogre',weaponKey:'missiles'});
  const missiles=model.draw();
  assert.equal(missiles.weaponKey,'missiles');
  assert.notEqual(main.key,missiles.key);
  assert.equal(missiles.legal,2);
  assert.equal(missiles.crt,'2-1');
  t.diagnostic(JSON.stringify([main,missiles]));
});
