import assert from 'node:assert/strict';
import test from 'node:test';
import { createShellText } from '../src/app/shell-text.mjs';

test('provisional shell labels include map controls in all four languages', () => {
  const language = { current: 'de', t: key => key };
  const t = createShellText(language);
  for (const code of ['de', 'en', 'es', 'fr']) {
    language.current = code;
    for (const key of ['ui.build.internal', 'ui.hud.map', 'ui.hud.zoomIn', 'ui.hud.zoomOut', 'ui.hud.terrain', 'ui.hud.hex']) {
      assert.notEqual(t(key), key, `${code}: ${key}`);
    }
  }
});
