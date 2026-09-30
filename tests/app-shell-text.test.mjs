import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createShellText } from '../src/app/shell-text.mjs';

test('shell labels use semantic catalog keys in all four languages', async () => {
  const catalogs = Object.fromEntries(await Promise.all(['de', 'en', 'es', 'fr'].map(async code => [code, JSON.parse(await readFile(new URL(`../assets/ui-copy/content-02.${code}.json`, import.meta.url))).messages])));
  const language = { current: 'de', t(key, params = {}) { return (catalogs[this.current][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`); } };
  const t = createShellText(language);
  for (const code of ['de', 'en', 'es', 'fr']) {
    language.current = code;
    for (const key of ['ui.build.internal', 'ui.hud.map', 'ui.hud.zoomIn', 'ui.hud.zoomOut', 'ui.hud.terrain', 'ui.hud.hex', 'ui.dialog.leaveMission.body', 'ui.error.WRONG_PHASE']) {
      assert.notEqual(t(key), key, `${code}: ${key}`);
    }
    assert.match(t('ui.hud.turn', { turn: 3 }), /3/);
  }
});
