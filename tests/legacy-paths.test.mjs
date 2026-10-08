import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, parse, relative, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = ['index.html', 'src/app/compare.html', 'src/app/reference.html', 'src/app/shell.html'];
const prefix = '/tdc.game.goblin/';

function exactCase(path) {
  const { root: drive } = parse(path);
  let current = drive;
  for (const segment of path.slice(drive.length).split(sep).filter(Boolean)) {
    assert.ok(readdirSync(current).includes(segment), `incorrect path case: ${path}`);
    current = join(current, segment);
  }
}

test('all page-local scripts, styles and icons resolve under the Pages project prefix with exact case', () => {
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    const urls = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(match => match[1]);
    assert.ok(urls.length, `${page}: no local resources found`);
    for (const url of urls) {
      if (/^(?:https?:|data:|#)/.test(url)) continue;
      const resolved = new URL(url, `https://example.test${prefix}${page}`);
      assert.ok(resolved.pathname.startsWith(prefix), `${page}: path escapes Pages prefix: ${url}`);
      const local = join(root, decodeURIComponent(resolved.pathname.slice(prefix.length)));
      assert.ok(!relative(root, local).startsWith('..'), `${page}: path escapes repository: ${url}`);
      exactCase(local);
    }
  }
});

test('legacy localization catalog remains rooted at the published asset directory', () => {
  const script = new URL('src/legacy/scripts/localization.js', `https://example.test${prefix}`);
  const catalog = new URL('../../../assets/ui-copy/content-02.de.json', script);
  assert.equal(catalog.pathname, `${prefix}assets/ui-copy/content-02.de.json`);
  exactCase(join(root, catalog.pathname.slice(prefix.length)));
});
