import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('the v2 entry links and starts with browser ES modules and classic TerrainRules', () => {
  const script = fileURLToPath(new URL('./helpers/browser-esm-link.mjs', import.meta.url));
  const result = spawnSync(process.execPath,
    ['--no-warnings', '--experimental-vm-modules', script],
    {encoding:'utf8', timeout:15000});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
