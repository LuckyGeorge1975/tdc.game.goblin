import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
const context = vm.createContext({TextEncoder, TextDecoder, structuredClone});
const classic = await readFile(resolve(root, 'terrain-rules.js'), 'utf8');
vm.runInContext(classic, context, {filename:'terrain-rules.js'});

const modules = new Map();
async function load(path) {
  if (modules.has(path)) return modules.get(path);
  const source = await readFile(path, 'utf8');
  const module = new vm.SourceTextModule(source, {context, identifier:path});
  modules.set(path, module);
  return module;
}
const entry = await load(resolve(root, 'iron-dust-browser-v2.mjs'));
await entry.link((specifier, referrer) => {
  assert.ok(specifier.startsWith('.'), `unexpected browser dependency: ${specifier}`);
  return load(resolve(dirname(referrer.identifier), specifier.split('?')[0]));
});
await entry.evaluate();
const session = entry.namespace.createIronDustBrowserSession();
assert.equal(session.profile.header.ruleProfileId, 'CORE_IRON_DUST_v2');
assert.equal(session.projection.mode, 'player');
assert.ok(modules.size > 10, 'the transitive browser module graph was not linked');
