import assert from 'node:assert/strict';
import test from 'node:test';
import {fullExperimentModuleRequests as requests} from '../scripts/full-experiment-module-requests.mjs';

test('module AST reads real import/re-export requests across comments, including decoded specifiers',()=>{
 assert.deepEqual(requests(`
  import /* one */ assert from /* two */ 'node:assert/strict';
  import // side-effect comment
    './side-effect.mjs';
  import {x as y} from /* nested-looking // text */ './listed.mjs';
  export * from /* three */ './star.mjs';
  export {x} from // four
    './named.mjs';
  import {z} from './esc\\u0061ped.mjs';
 `),['node:assert/strict','./side-effect.mjs','./listed.mjs','./star.mjs','./named.mjs','./escaped.mjs']);
});

test('every dynamic import expression is rejected without executing it, including template interpolations',()=>{
 for(const source of ["import('./unlisted.mjs');", "import /* comment */ ('./unlisted.mjs');",
  "import // line\n ('./unlisted.mjs');", "async function later(){ return import /* c */ ('node:fs'); }",
  "const sample = `${import /* c */ ('./unlisted.mjs')}`;"])
  assert.throws(()=>requests(source),/FULL_EXPERIMENT_DYNAMIC_IMPORT/);
});

test('comments, ordinary strings, regexps, template text and member names are not treated as imports',()=>{
 assert.deepEqual(requests(`
  // import('./unlisted.mjs')
  /* export * from './unlisted.mjs' */
  const note = "import /* text */ ('./unlisted.mjs')";
  const from = './unlisted.mjs';
  const sample = \`import('text') \${'still just text'}\`;
  const expression = /import.*from\\/x/;
  const ratio = 8 / 2;
  const object = {import(value){return value;}};
  object.import('./ordinary-argument.mjs');
 `),[]);
});

test('invalid module syntax fails closed rather than falling back to textual heuristics',()=>{
 for(const source of ["import /* unfinished", "import {x} from ;", "const x = `unfinished"])
  assert.throws(()=>requests(source),/FULL_EXPERIMENT_MODULE_SYNTAX/);
});

test('a missing or changed bundled runtime parser fails closed without evaluating replacement source',async()=>{
 const original=process.binding;
 try{
  for(const [index,source] of [undefined,'globalThis.__goblinUnverifiedParser = true;'].entries()){
   process.binding=()=>({'internal/deps/acorn/acorn/dist/acorn':source});
   const fresh=await import('../scripts/full-experiment-module-requests.mjs?unavailable-parser='+index);
   assert.throws(()=>fresh.fullExperimentModuleRequests('export const value=1;'),/FULL_EXPERIMENT_MODULE_PARSER_UNAVAILABLE/);
   assert.equal(globalThis.__goblinUnverifiedParser,undefined);
  }
 }finally{process.binding=original;}
});
