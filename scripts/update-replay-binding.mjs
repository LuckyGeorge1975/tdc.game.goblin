// Maintains tests/fixtures/replay-source-binding.v1.json.
//   node scripts/update-replay-binding.mjs              re-pin the gameplay sources after an intended rules change
//   node scripts/update-replay-binding.mjs --dry-run    show what would change
//   node scripts/update-replay-binding.mjs --bootstrap --base=<commit>  rebuild the whole manifest (traces and fixtures too);
//                                                       only after re-recording traces or with a verified green replay run
// After a re-pin run node scripts/run-tests.mjs --slow: the replays must still pass, otherwise re-record the traces.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decode} from '../tests/helpers/trace-object-table.mjs';

const root = new URL('../', import.meta.url), fixtures = new URL('tests/fixtures/', root);
const manifestUrl = new URL('replay-source-binding.v1.json', fixtures);
const hash = value => createHash('sha256').update(value).digest('hex');
const source = path => fs.readFileSync(new URL(path, root), 'utf8').replaceAll('\r\n', '\n');
const canonical = sources => JSON.stringify(Object.keys(sources).sort().map(path => [path, sources[path]]));

const GAMEPLAY = ['artillery-pilot-runtime.js', 'artillery-spotter-rules.js', 'assets/training/levels.v1.json', 'assets/training/scripts.v1.json',
  'assets/unit-art/levels/artillery-pilot.v1.json', 'assets/unit-art/levels/catalog-full-levels.v1.json', 'assets/unit-art/rules/artillery-pilot.v1.js',
  'assets/unit-art/rules/siege-pilot.v1.js', 'assets/unit-art/rules/skimmer-pilot.v1.js', 'assets/unit-art/rules/unit-profiles.catalog-approved.v1.json',
  'assets/unit-art/rules/unit-profiles.v1.json', 'catalog-base-loader.js', 'catalog-base-model.js', 'catalog-base-runtime.js', 'catalog-full-loader.js',
  'catalog-full-model.js', 'catalog-full-runtime.js', 'catalog-specialists-fire.js', 'catalog-specialists-loader.js', 'catalog-specialists-model.js',
  'catalog-specialists-runtime.js', 'catalog-visibility.js', 'catalog-waves.js', 'command-history.js', 'game.js', 'legacy-supercover.js', 'ogre-runtime.js',
  'ogre-systems.js', 'scenario-profile-manifest.js', 'scenario.js', 'siege-pilot-runtime.js', 'siege-tank-fire-budget.js', 'siegebreaker-weapons.js',
  'skimmer-budget.js', 'strategic-missile.js', 'terrain-rules.js', 'training-director.js', 'training-loader.js', 'training-model.js', 'training-runtime.js',
  'unit-life.js'];
const UI = ['index.html', 'localization.js', 'ui-v2.css', 'ui-v2-flow.js', 'ui-v2.js', 'assets/ui-copy/briefing-01.de.json', 'assets/ui-copy/briefing-01.en.json',
  'assets/ui-copy/briefing-01.es.json', 'assets/ui-copy/briefing-01.fr.json', 'unit-guide.js', 'unit-guide-range.js', 'catalog-specialists-ui.js'];
const PRESENTATION = ['combat-feedback.js', 'fire-presentation.js', 'legacy-presentation.js', 'm1-unit-markers.js', 'presentation-state.js', 'unit-visuals.js'];
const IGNORED = {...Object.fromEntries(UI.map(path => [path, 'ui'])), ...Object.fromEntries(PRESENTATION.map(path => [path, 'presentation']))};

function recordedHeaders() {
  const load = path => { const raw = fs.readFileSync(new URL(path, fixtures)); return JSON.parse(path.endsWith('.gz') ? gunzipSync(raw) : raw); };
  const headers = {};
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (value.traceDigest && value.header?.sources) { headers[value.traceDigest] = value.header.sources; return; }
    for (const item of Array.isArray(value) ? value : Object.values(value)) walk(item);
  };
  walk(load('artillery-product-traces.v1.json'));
  walk(load('catalog-base-product-traces.v1.json.gz'));
  walk(decode(load('catalog-specialists-product-traces.v1.json.gz')));
  walk(decode(load('catalog-specialists-boundary-traces.v1.json.gz')));
  for (const info of Object.values(load('catalog-full/index.v2.json').traces)) walk(decode(load('catalog-full/' + info.file)));
  for (const id of ['training-t01', 'training-t02', 'training-t03']) headers[id] = load(id + '.game-teaching.v1.json.gz').header.sourceHashes;
  return headers;
}
const FIXTURES = ['artillery-product-traces.v1.json', 'catalog-base-product-traces.v1.json.gz', 'catalog-specialists-product-traces.v1.json.gz',
  'catalog-specialists-boundary-traces.v1.json.gz', 'catalog-full/index.v2.json', ...['atlas', 'terrain-course', 'advance', 'siege', 'specialists']
    .flatMap(id => ['victory', 'defeat'].map(outcome => `catalog-full/catalog-full-${id}-${outcome}.v2.json.gz`)),
  'training-t01.game-teaching.v1.json.gz', 'training-t02.game-teaching.v1.json.gz', 'training-t03.game-teaching.v1.json.gz'];

const args = process.argv.slice(2), dryRun = args.includes('--dry-run');
const gameplaySources = Object.fromEntries(GAMEPLAY.map(path => [path, hash(source(path))]));
let manifest;
if (args.includes('--bootstrap')) {
  const headers = recordedHeaders();
  const unclassified = [...new Set(Object.values(headers).flatMap(Object.keys))]
    .filter(path => !path.startsWith('tests/') && !GAMEPLAY.includes(path) && !IGNORED[path]);
  if (unclassified.length) throw new Error('unclassified recorded sources: ' + unclassified.join(', '));
  const harness = Object.fromEntries([...new Set(Object.values(headers).flatMap(Object.keys))].filter(path => path.startsWith('tests/')).sort().map(path => [path, 'harness']));
  // The retired source-compatibility manifests stay recorded from the first bootstrap.
  const previous = fs.existsSync(manifestUrl) ? JSON.parse(fs.readFileSync(manifestUrl, 'utf8')) : null;
  const supersedes = previous?.supersedes ?? fs.readdirSync(fixtures).filter(name => name.includes('source-compatibility')).sort()
    .map(name => ({file: 'tests/fixtures/' + name, sha256: hash(fs.readFileSync(new URL(name, fixtures)))}));
  manifest = {version: 'replay-source-binding-v1',
    baseCommit: args.find(arg => arg.startsWith('--base='))?.slice(7) ?? (() => { throw new Error('--bootstrap needs --base=<commit>'); })(),
    note: 'Gameplay-only binding of recorded product traces; UI, presentation and harness files are unbound.',
    gameplaySources, ignoredPaths: Object.fromEntries(Object.entries({...IGNORED, ...harness}).sort(([a], [b]) => a.localeCompare(b))),
    traces: Object.fromEntries(Object.entries(headers).map(([reference, sources]) => [reference, hash(canonical(sources))])),
    immutableFixtures: Object.fromEntries(FIXTURES.map(path => [path, hash(fs.readFileSync(new URL(path, fixtures)))])),
    supersedes};
} else {
  manifest = JSON.parse(fs.readFileSync(manifestUrl, 'utf8'));
  for (const [path, next] of Object.entries(gameplaySources))
    if (manifest.gameplaySources[path] !== next) console.log(`gameplay ${path}: ${String(manifest.gameplaySources[path]).slice(0, 8)} -> ${next.slice(0, 8)}`);
  manifest.gameplaySources = gameplaySources;
}
if (!dryRun) fs.writeFileSync(manifestUrl, JSON.stringify(manifest, null, 2) + '\n');
console.log(dryRun ? 'dry run, nothing written' : 'written ' + manifestUrl.pathname);
