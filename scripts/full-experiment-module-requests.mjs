import {check,hash} from './full-training-artifacts.mjs';

// Node24.14.0 already ships this Acorn8.15.0 parser. Only this known runtime
// source is compiled, never package source. Missing/different internals fail
// closed; there is no regex fallback or dependency download.
const parserHash='fdb08546776ec6228b03e8d02b40d4ab3255bae5f401adba7ff5dad927ac5c9c';
let parser;
function moduleParser(){
 if(parser)return parser;
 let source;
 try{source=process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'];}catch{}
 check(typeof source==='string'&&hash(source.replaceAll('\r\n','\n'))===parserHash,
  'FULL_EXPERIMENT_MODULE_PARSER_UNAVAILABLE');
 const runtime={exports:{}};
 Function('exports','module',source)(runtime.exports,runtime);
 check(runtime.exports.version==='8.15.0'&&typeof runtime.exports.parse==='function',
  'FULL_EXPERIMENT_MODULE_PARSER_UNAVAILABLE');
 parser=runtime.exports;return parser;
}

export function fullExperimentModuleRequests(source){
 const acorn=moduleParser();
 let tree;
 try{tree=acorn.parse(source,{ecmaVersion:'latest',sourceType:'module'});}
 catch{throw Error('FULL_EXPERIMENT_MODULE_SYNTAX');}
 const requests=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  check(node.type!=='ImportExpression','FULL_EXPERIMENT_DYNAMIC_IMPORT');
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source){
   check(typeof node.source.value==='string','FULL_EXPERIMENT_MODULE_SYNTAX');requests.push(node.source.value);
  }
  for(const value of Object.values(node)){
   if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
  }
 }
 visit(tree);return requests;
}
