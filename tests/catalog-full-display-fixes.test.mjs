import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fullScene} from './catalog-full-harness.mjs';import {read} from './artillery-product-harness.mjs';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'),ui=process.env.DISPLAY_FIX_UI?fs.readFileSync(process.env.DISPLAY_FIX_UI,'utf8'):source('ui-v2.js'),flow=source('ui-v2-flow.js').replaceAll('\r\n','\n');
const cut=(s,a,b)=>{const start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start);return s.slice(start,end)};
test('saved FULL draft without a limit omits the counter, while a real limit is shown', async () => {
  const g = await fullScene('catalog-full-atlas',7,false,'FULL_CATALOG_v1');
  g.run(source('editor-draft.js'));
  await g.run('GoblinEditorDraft.prepare(GoblinEditorDraft.copyTemplate()).then(loadEditorDraft)');
  const body = cut(ui,'      if(state.fullStatus){','      status.title=');
  g.run(`
    function renderLimit(fullStatus) {
      const state={fullStatus},status={textContent:''},t=(key,params)=>[key,params?.current,params?.limit].join('/');
      ${body}
      return status.textContent;
    }
  `);
  assert.equal(g.run('renderLimit(GoblinCatalogFullRuntime.status())'),'');
  assert.equal(g.run('renderLimit({turnLimit:null,enemyTurns:0})'),'');
  assert.equal(g.run('renderLimit({turnLimit:8,enemyTurns:2})'),' · v2.full.limit.status/2/8');
  const briefing = cut(flow,'          if(Number.isSafeInteger(full.turnLimit)','        const conditions');
  g.run(`function briefingLimit(full){
    const output=[],header={append(value){output.push(value)}},paragraph=x=>x,t=(key,{limit})=>[key,limit].join('/');
    ${briefing.split('\n')[0]}
    return output;
  }`);
  assert.deepEqual(read(g,'briefingLimit({})'),[]);
  assert.deepEqual(read(g,'briefingLimit({turnLimit:8})'),['v2.full.limit.briefing/8']);
});
const unchanged=(g,b)=>{assert.equal(g.state(),b.state);assert.deepEqual(read(g,'GoblinCatalogFullRuntime.snapshot()'),b.full);assert.deepEqual(g.rng(),b.rng);assert.deepEqual(read(g,'({view,history:phaseCommands,rolls:phaseRolls,cursor:phaseRollCursor})'),b.viewHistory)};
const before=g=>({state:g.state(),full:read(g,'GoblinCatalogFullRuntime.snapshot()'),rng:g.rng(),viewHistory:read(g,'({view,history:phaseCommands,rolls:phaseRolls,cursor:phaseRollCursor})')});
function overlay(g){g.context.GoblinLanguage={current:"de",t:k=>k};g.context.__shapes=[];g.context.__legend={textContent:''};g.context.document.body={classList:{contains:()=>false}};g.context.document.createElementNS=()=>({classList:{add(){}},setAttribute(){}});g.run(`{const at=()=>__legend,nativeMap={querySelector(){return {replaceChildren(){__shapes.length=0},append(n){__shapes.push(n)}}},getBoundingClientRect(){return {width:790}},viewBox:{baseVal:{width:790}},style:{}},core=()=>false,planningArea=()=>null,areaData=()=>({legal:[],blocked:[],status:'blocked'}),areaCache={key:null,actors:new Map()},matchMedia=()=>({matches:false}),mode='fire',intelSections={legend:true},entriesAt=(state,actor,cell)=>actor?[{command:{type:'CatalogHexFire',actorId:actor.id,...cell},confirmSplash:true}]:[],entryResult=entry=>GoblinCatalogFullRuntime.hexQuery(entry.command);${cut(ui,'    function renderTargetBlast(', '    function focusTargetCard(')}globalThis.actualOverlay=function(state,actor){${cut(ui,'      let overlay =', '      const firePreview =')}}}`)}
test('actual empty-selection overlay clears and start/pause mission tail reaches release; U13 positive footprint stays',async()=>{const g=await fullScene();overlay(g);g.run('view.target={x:4,y:1}');const b=before(g);assert.doesNotThrow(()=>g.run('actualOverlay({revision:1},null)'));assert.equal(g.context.__shapes.length,0);g.context.__released=0;g.run(`{const GoblinUIV2={resetView(){},startView(){}};const show=()=>actualOverlay({revision:2},null),releasePause=()=>__released++;${cut(flow,'      GoblinUIV2.resetView();\n      show(\'play\');','    function openEditor').replace(/    }\s*$/,'')}}`);assert.equal(g.context.__released,1);unchanged(g,b);g.run("setTurnPhase('fire');view.intentRevision=3;actualOverlay({revision:3},units.find(u=>u.catalogId==='U13'))");assert.ok(g.context.__shapes.length>0);g.run('actualOverlay({revision:4},null)');assert.equal(g.context.__shapes.length,0);/* phase transition is real; isolate render invariance below */const c=before(g);g.run('actualOverlay({revision:5},null)');unchanged(g,c)});
test('actual Full HUD renders pending enemy in existing total without changing objective or world',async()=>{const g=await fullScene(),b=before(g);g.context.__hud={};g.run(`{const at=()=>__hud,t=(key,p)=>JSON.stringify(p);const state={turn:1,profile:legacySession.ruleProfileId,objective:objectiveSnapshot(victoryProfile(legacySession.effectiveRules),units)};${cut(ui.slice(ui.lastIndexOf("      at('#v2-turn').textContent")),"      at('#v2-turn').textContent", "      at('#v2-map').setAttribute")}}`);const text=g.context.__hud.textContent;assert.match(text,/"remainingEnemies":4,"totalEnemies":4/);unchanged(g,b)});
test('actual briefing wave paragraphs announce fixed ordered entry alternatives',async()=>{const g=await fullScene(),b=before(g);g.context.__texts=[];g.run(`{const missionId='catalog-full-specialists',header={append(n){__texts.push(n)}},paragraph=x=>x,t=(key,p)=>key==='v2.full.wave.entries'?p.entries:key;${cut(flow,'        if(globalThis.GoblinCatalogFullModel?.has(missionId)){','        const conditions =')}}`);assert.ok(g.context.__texts.some(s=>/L-01.*L-02.*L-03/.test(s)));assert.ok(g.context.__texts.some(s=>/A-06.*A-07.*A-08/.test(s)));unchanged(g,b)});
test('actual values-note consumer and guide projection distinguish system bands, U26 and true GEV budgets',async()=>{for(const [id,staticOnly] of ['U21','U01','U26','U02','U10','U11','U12'].flatMap(id=>[[id,false],[id,true]])){const g=await fullScene('catalog-full-atlas'),b=before(g);g.run(source('unit-guide-range.js'));g.context.__notes=[];g.context.classId=id;g.context.staticOnly=staticOnly;g.run(`{const actual=units.find(u=>u.catalogId===classId),live=staticOnly?null:actual,base={name:actual.name,visualKey:actual.catalogAssetId,move:'3 + 2 + 1 + 0',hp:'SYSTEMS',role:'role',copy:'copy'},card=GoblinCatalogFullRuntime.catalogCard(base),entry={...base,...card},body={append(n){__notes.push(n)}},paragraph=x=>x,t=k=>k;globalThis.__card=card;globalThis.__entry=entry;const profile=UnitGuideRange.profile(entry,null);${flow.split('\n').find(l=>l.includes('body.append')&&l.includes('skimmerManeuver'))}}`);const expected=['U02','U10','U11','U12'].includes(id);assert.equal(g.context.__notes.length>0,expected,id);const p=read(g,'UnitGuideRange.profile(__entry,null)');assert.equal(p.bonus>0,expected,id);const dto=read(g,'__card');assert.equal(dto.gevPhaseEligible,expected,id);if(['U21','U01'].includes(id)){assert.ok(dto.move.includes('/'));assert.equal(dto.move.includes('+'),false)}unchanged(g,b)}});
