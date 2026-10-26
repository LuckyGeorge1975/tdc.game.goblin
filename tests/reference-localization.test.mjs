import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {formatIronDustV2Event, formatIronDustV2Error} from '../iron-dust-v2-view.mjs';

test('phase fixture instructions and Skimmer phase displays translate without visible GEV jargon', () => {
  const source = readFileSync(new URL('../localization.js', import.meta.url), 'utf8');
  const document = {
    currentScript: { src: 'http://127.0.0.1/localization.js' },
    readyState: 'loading', title: '',
    addEventListener() {},
  };
  const context = {
    document, URL, URLSearchParams,
    location: { href: 'http://127.0.0.1/src/app/reference.html', search: '' },
    navigator: { language: 'de' },
    localStorage: { getItem: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ messages: {} }) }),
    console,
  };
  runInNewContext(source, context);
  const instruction = 'Beide Teams werden von Hand gesteuert. Skimmer wählen → bewegen → Fire Phase → Skimmer-Manöver → erneut bewegen. Das deaktivierte Fahrzeug erholt sich zu seinem festgelegten Teamstart.';
  const expected = {
    de: ['Skimmer-Manöver', 'Zum Skimmer-Manöver →', 'Spieler · Skimmer-Manöver'],
    en: ['Skimmer Maneuver', 'To Skimmer Maneuver →', 'Player · Skimmer Maneuver'],
    es: ['maniobra de deslizadores', 'A la maniobra de deslizadores →', 'Jugador · Maniobra de deslizadores'],
    fr: ['manœuvre des aéroglisseurs', 'Vers la manœuvre des aéroglisseurs →', 'Joueur · Manœuvre des aéroglisseurs'],
  };
  for (const [lang, [term, button, phase]] of Object.entries(expected)) {
    const translated = context.GoblinLanguage.translate(instruction, lang);
    assert.ok(translated.includes(term), `${lang}: ${translated}`);
    assert.equal(context.GoblinLanguage.translate('Zum Skimmer-Manöver →', lang), button);
    assert.equal(context.GoblinLanguage.translate('Player · Skimmer-Manöver', lang), phase);
    const wreck={de:'Wrack: Alpha',en:'Wreck: Alpha',es:'Restos: Alpha',fr:'Épave : Alpha'};
    assert.equal(context.GoblinLanguage.t('v2.field.wreck',{name:'Alpha'},lang),wreck[lang]);
    assert.doesNotMatch(context.GoblinLanguage.t('v2.field.wreck',{name:'Alpha'},lang),/\{name\}|v2\.field/);
    assert.doesNotMatch(translated, /\bGEV\b/i);
  }
  const v2Titles = {
    de: 'IRON DUST v2',
    en: 'IRON DUST v2',
    es: 'IRON DUST v2',
    fr: 'IRON DUST v2',
  };
  for (const [lang, title] of Object.entries(v2Titles)) {
    assert.equal(context.GoblinLanguage.t('mission.iron-dust-v2.title', {}, lang), title);
    assert.notEqual(title, context.GoblinLanguage.translate('Durchbrechen. Ausschalten. Überleben.', lang));
    for (const key of ['ready','view','selectUnitOrHex','hostileIntel','unitIntel','noUnit',
      'selectFriendly','sector','defense','moveRange','status','destroyed','disabled',
      'moved','treads','weapon','profile','fieldIntel','sectorBrief','selectHex','terrain',
      'selectAria','team.player','team.enemy','type.ogre','type.gev','type.missile',
      'type.infantry','type.core','type.guard','type.raider','terrain.open-ground',
      'terrain.rubble-field','coreHp','move','fire','skimmer','success','critical',
      'guideFriendlyLive','guideHostileLive','noAction','hostileAi','armorHp','range',
      'attack','attackDef','byWeapon','bySystem','weapon.main','weapon.secondary',
      'weapon.missiles','weapon.antipersonnel']) {
      const fullKey=`v2.ui.${key}`;
      assert.notEqual(context.GoblinLanguage.t(fullKey,{unit:'Siegebreaker'},lang),fullKey,
        `${lang}: ${fullKey}`);
    }
  }
  const quickSource = readFileSync(new URL('../quick-start.js', import.meta.url), 'utf8');
  const intro = {textContent:'Legacy intro'}, footer = {textContent:'Legacy footer'};
  const grid = {style:{}}, classes = {remove(){},add(){},contains(){return false}};
  const modal = {classList:classes,addEventListener(){},querySelector(selector){
    return selector === '.quick-guide-intro' ? intro :
      selector === '.quick-guide-grid' ? grid : footer;
  }};
  const open = {}, close = {};
  let lang = 'de';
  const quickContext = {document:{querySelector(selector){return selector === '#quick-start-modal' ? modal :
    selector === '#quick-start-open' ? open : close;},addEventListener(){}},
    GoblinLanguage:{t:key=>context.GoblinLanguage.t(key,{},lang)},
    IronDustBrowserV2:{mode:'ready'}};
  runInNewContext(quickSource,quickContext);
  const commandTank = {de:'Kommandopanzer',en:'command tank',es:'tanque de mando',
    fr:'char de commandement'};
  for (const [locale,name] of Object.entries(commandTank)) {
    lang=locale;
    open.onclick();
    assert.ok(footer.textContent.includes(name), `${locale}: ${footer.textContent}`);
    assert.doesNotMatch(footer.textContent,/\bogre\b/i);
    assert.equal(grid.style.display,'none');
  }
  const previousLanguage=globalThis.GoblinLanguage;
  const events=['UnitMoved','EnemyMoved','EnemyHeld','EnemySkipped','UnitRecovered',
    'PhaseChanged','EnemyPassRecorded','PlayerFireResolved','EnemySystemFireResolved',
    'EnemyUnitFireResolved','RamResolved','WeaponSelected','IronDustGameEnded'];
  const sample=Object.freeze({type:'EnemySystemFireResolved',actorId:'guard',targetId:'ogre'});
  const before=JSON.stringify(sample);
  try {
    for(const lang of Object.keys(v2Titles)){
      globalThis.GoblinLanguage={t:(key,params)=>context.GoblinLanguage.t(key,params,lang)};
      for(const type of events){
        const text=formatIronDustV2Event({...sample,type});
        assert.ok(text.length>5,`${lang} ${type}`);
        assert.doesNotMatch(text,/EnemySystemFireResolved|EnemyPassRecorded|UnitMoved|\bogre\b|\bguard\b/);
        assert.doesNotMatch(text,/^v2\./);
      }
      assert.doesNotMatch(formatIronDustV2Event({type:'FutureEvent',actorId:'mystery'}),
        /FutureEvent|mystery|^v2\./);
      for(const code of ['GAME_ENDED','ACTION_SPENT','WRONG_PHASE','UNREACHABLE',
        'WEAPON_OUT_OF_RANGE','WEAPON_SIGHT_BLOCKED','UNKNOWN_CODE']){
        const text=formatIronDustV2Error(code);
        assert.doesNotMatch(text,/GAME_ENDED|ACTION_SPENT|WRONG_PHASE|UNREACHABLE|WEAPON_|UNKNOWN_CODE|^v2\./);
      }
    }
    assert.equal(JSON.stringify(sample),before);
  } finally {globalThis.GoblinLanguage=previousLanguage;}
});
