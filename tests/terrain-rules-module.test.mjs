import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const wrapperUrl = new URL('../terrain-rules-module.mjs', import.meta.url).href;
const rulesUrl = new URL('../terrain-rules.js', import.meta.url).href;

// Run the actual UMD source as browser ESM: no CommonJS module/exports globals
// and no synthetic default export. Each process/context starts independently.
const browserProbe = `
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const [mode, wrapperUrl, rulesUrl] = process.argv.slice(1);
const wrapperSource = readFileSync(new URL(wrapperUrl), 'utf8');
const rulesSource = readFileSync(new URL(rulesUrl), 'utf8');
const context = vm.createContext({});
let imports = 0;
if (mode === 'preloaded') vm.runInContext(rulesSource, context);
const preload = context.TerrainRules;
const wrapper = new vm.SourceTextModule(wrapperSource, {
  context,
  importModuleDynamically: async specifier => {
    imports++;
    assert.equal(new URL(specifier, wrapperUrl).href, rulesUrl);
    const module = new vm.SourceTextModule(mode === 'unavailable' ? '' : rulesSource, { context });
    await module.link(() => { throw new Error('Unexpected static dependency'); });
    await module.evaluate();
    assert.equal(Object.hasOwn(module.namespace, 'default'), false);
    return module;
  }
});
await wrapper.link(() => { throw new Error('Unexpected static dependency'); });
if (mode === 'unavailable') {
  await assert.rejects(wrapper.evaluate(), { message: 'TERRAIN_RULES_UNAVAILABLE' });
  assert.equal(imports, 1);
} else {
  await wrapper.evaluate();
  const api = wrapper.namespace.default;
  assert.equal(api, context.TerrainRules);
  assert.equal(Object.isFrozen(api), true);
  assert.equal(api.movementCost('forest', { movementMode: 'tracked' }), 2);
  assert.equal(api.coverBonus('forest'), 1);
  assert.equal(api.blocksLos('forest'), true);
  assert.equal(imports, mode === 'preloaded' ? 0 : 1);
  if (mode === 'preloaded') assert.equal(api, preload);
}
`;

for (const [mode, description] of [
  ['cold', 'cold browser ESM start exposes the UMD terrain API'],
  ['preloaded', 'classic-script preload is reused without another import'],
  ['unavailable', 'missing terrain API still fails explicitly'],
]) {
  test(description, () => {
    execFileSync(process.execPath, [
      '--experimental-vm-modules', '--input-type=module', '--eval', browserProbe,
      mode, wrapperUrl, rulesUrl,
    ], { stdio: 'pipe' });
  });
}

test('Node CommonJS fallback returns the same terrain API', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    const { default: api } = await import(${JSON.stringify(wrapperUrl)});
    const { default: commonJsApi } = await import(${JSON.stringify(rulesUrl)});
    assert.equal(api, commonJsApi);
    assert.equal(api.movementCost('forest', { movementMode: 'tracked' }), 2);
    console.log('PASS');
  `], { encoding: 'utf8' });
  assert.equal(output.trim(), 'PASS');
});
