import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { configurePagesSupport } from '../scripts/configure-pages-support.mjs';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const index = source('index.html');

test('missing or invalid Pages support configuration leaves the site unchanged', () => {
  for (const value of [undefined, '', ' ', 'http://example.invalid', 'https:example.invalid',
    'https:///example.invalid', 'https://user:pass@example.invalid', 'https://@example.invalid',
    'https://invalid host', 'javascript:alert(1)']) {
    assert.equal(configurePagesSupport(index, value), index);
  }
});

test('a valid Pages support URL safely reaches the existing settings footer', () => {
  const url = 'https://example.invalid/support?a=1&next=</script><script>alert(1)</script>#tip';
  const html = configurePagesSupport(index, url);
  const script = html.match(/<script>(globalThis\.GOBLIN_SUPPORT_URL = [^\n]+)<\/script>/)[1];
  assert.ok(!script.includes('<'));
  assert.ok(html.indexOf(script) < html.indexOf('src="ui-v2-flow.js?'));

  const flow = source('ui-v2-flow.js');
  const start = flow.indexOf('footer.append(actions(back, up, down));');
  const end = flow.indexOf('const observer = new ResizeObserver(updateScroll)', start);
  assert.ok(start >= 0 && end > start);

  for (const configured of [false, true]) {
    const children = [];
    const context = vm.createContext({
      footer: {append: child => children.push(child), classList: {add() {}}},
      actions: (...items) => items, back: 'back', up: 'up', down: 'down',
      document: {createElement: tag => ({tag})},
      t: key => key
    });
    if (configured) vm.runInContext(script, context);
    vm.runInContext(flow.slice(start, end), context);
    assert.deepEqual([...children[0]], ['back', 'up', 'down']);
    assert.equal(children.length, configured ? 2 : 1);
    if (!configured) continue;

    const link = children[1];
    assert.equal(link.tag, 'a');
    assert.equal(link.href, new URL(url).href);
    assert.equal(link.referrerPolicy, 'no-referrer');
    assert.equal(link.textContent, 'v2.options.supportProject');
    assert.equal(link.target, undefined);
  }
});
