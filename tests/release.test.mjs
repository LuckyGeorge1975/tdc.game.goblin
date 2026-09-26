import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('release metadata, UI, changelog, and handoff use the same build',()=>{
  const context=vm.createContext({globalThis:{}});
  vm.runInContext(readFileSync(new URL('../release.js',import.meta.url),'utf8'),context);
  const release=context.globalThis.GOBLIN_RELEASE;
  const changelog=readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
  const handoff=readFileSync(new URL('../TEST_HANDOFF.md',import.meta.url),'utf8');
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.equal(release.version,`0.1.${release.build}`);
  assert.match(changelog,new RegExp(`## \\[${release.version.replaceAll('.','\\.')}\\] - ${release.releasedAt}`));
  assert.ok(handoff.includes(`| Version | \`${release.version}\` |`));
  assert.ok(index.includes('id="build-version"'));
});
