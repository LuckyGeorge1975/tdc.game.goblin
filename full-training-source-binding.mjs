// Same SHA-256, LF normalization and sorted path/hash pairs as recorded product traces.
export const normalizeSource = text => text.replaceAll('\r\n', '\n');
export const canonicalSources = sources => JSON.stringify(Object.keys(sources).sort().map(path => [path, sources[path]]));
const invalid = () => { throw Error('FULL_TRAINING_SOURCE_BINDING'); };
export async function sourceHash(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export async function gameplaySourceHashes(paths, read) {
  return Object.fromEntries(await Promise.all(paths.map(async path =>
    [path, await sourceHash(new TextEncoder().encode(normalizeSource(await read(path))))])));
}
export function verifyTrainingSources(recorded, current) {
  if (!recorded || typeof recorded !== 'object' || Array.isArray(recorded) ||
      Object.values(recorded).some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) ||
      canonicalSources(recorded) !== canonicalSources(current)) invalid();
}

export async function prepareBrowserTrainingSources({document = globalThis.document, fetch = globalThis.fetch} = {}) {
  const base = new URL('./', import.meta.url);
  const response = await fetch(new URL('assets/training/full-native-sources.json', base), {cache:'no-cache'});
  if (!response.ok) invalid();
  const expected = await response.json();
  const scripts = new Map([...document.querySelectorAll('script[src]')].map(script =>
    [new URL(script.src, document.baseURI).href.split('?')[0], script]));
  const loaded = new Map();
  const actual = await gameplaySourceHashes(Object.keys(expected), async path => {
    const url = new URL(path, base);
    const script = scripts.get(url.href);
    if (path.endsWith('.js') && !script) invalid();
    const resource = await fetch(script?.src ?? url, {cache:'force-cache'});
    if (!resource.ok) invalid();
    const bytes = new Uint8Array(await resource.arrayBuffer());
    if (script) {
      // SRI binds the bytes the browser executed, even if the server changed since page load.
      const hex = await sourceHash(bytes);
      const encoded = btoa(String.fromCharCode(...hex.match(/../g).map(byte => parseInt(byte,16))));
      if (!script.integrity?.split(/\s+/).includes('sha256-' + encoded)) invalid();
    }
    const text = new TextDecoder().decode(bytes);
    loaded.set(path,text);
    return text;
  });
  verifyTrainingSources(expected, actual);
  return Object.freeze({sources:Object.freeze(actual),readSource:path=>loaded.get(path)});
}
