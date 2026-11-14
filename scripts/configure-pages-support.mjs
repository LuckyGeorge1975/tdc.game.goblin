import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const marker = '<!-- GOBLIN_PAGES_SUPPORT -->';

export function configurePagesSupport(html, value) {
  const input = value?.trim();
  if (!input || !/^https:\/\/[^/\\?#\s]/i.test(input) || /[\s\\]/u.test(input)) return html;
  let url;
  try {
    url = new URL(input);
  } catch {
    return html;
  }
  if (url.protocol !== 'https:' || url.username || url.password ||
      input.slice(8).split(/[/?#]/, 1)[0].includes('@')) return html;

  if (html.split(marker).length !== 2) throw new Error('Expected one Pages support configuration marker.');
  const encoded = JSON.stringify(url.href).replaceAll('<', '\\u003c');
  return html.replace(marker, () => `<script>globalThis.GOBLIN_SUPPORT_URL = ${encoded};</script>`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const index = new URL('../index.html', import.meta.url);
  const original = readFileSync(index, 'utf8');
  const configured = configurePagesSupport(original, process.env.GOBLIN_SUPPORT_URL);
  if (configured !== original) writeFileSync(index, configured);
}
