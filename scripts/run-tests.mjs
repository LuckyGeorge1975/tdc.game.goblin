// Runs the regression suite in two parts:
//   node scripts/run-tests.mjs          fast suite for everyday work (default)
//   node scripts/run-tests.mjs --slow   recorded product replays (bound to gameplay sources, see tests/helpers/replay-source-binding.mjs)
//   node scripts/run-tests.mjs --all    both, as the release workflow does with `node --test tests/*.test.mjs`
// Other arguments (for example --test-name-pattern=...) are passed to node --test.
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';

const SLOW = [
  'artillery-product-trace.test.mjs',
  'catalog-full-display-compatibility.test.mjs',
  'catalog-full-trace.test.mjs',
  'catalog-product-trace.test.mjs',
  'catalog-specialists-boundary-trace.test.mjs',
  'catalog-specialists-trace.test.mjs',
];
const root = new URL('../', import.meta.url), tests = new URL('tests/', root);
const missing = SLOW.filter(file => !existsSync(new URL(file, tests)));
if (missing.length) throw new Error(`slow test files not found: ${missing.join(', ')}`);
const args = process.argv.slice(2), mode = args.includes('--all') ? 'all' : args.includes('--slow') ? 'slow' : 'fast';
const files = readdirSync(tests).filter(file => file.endsWith('.test.mjs'))
  .filter(file => mode === 'all' || SLOW.includes(file) === (mode === 'slow')).map(file => `tests/${file}`);
const passthrough = args.filter(arg => !['--all', '--slow', '--fast'].includes(arg));
const result = spawnSync(process.execPath, ['--test', ...passthrough, ...files], {cwd: root, stdio: 'inherit'});
process.exit(result.status ?? 1);
