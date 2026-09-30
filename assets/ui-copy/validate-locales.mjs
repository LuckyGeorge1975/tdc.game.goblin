import { readFile } from 'node:fs/promises';

const languages = ['de', 'en', 'es', 'fr'];
const catalogs = Object.fromEntries(await Promise.all(languages.map(async (lang) => {
  const file = new URL(`./content-02.${lang}.json`, import.meta.url);
  return [lang, JSON.parse(await readFile(file, 'utf8'))];
})));
const source = catalogs.de;
const expected = Object.keys(source.messages).sort();
const placeholders = (value) => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]).sort();

for (const lang of languages) {
  const catalog = catalogs[lang];
  if (catalog.schemaVersion !== 1 || (lang === 'de' ? catalog.sourceLocale !== 'de' : catalog.locale !== lang)) throw Error(`Invalid header: ${lang}`);
  const actual = Object.keys(catalog.messages).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`Key mismatch: ${lang}`);
  for (const key of expected) {
    const value = catalog.messages[key];
    if (typeof value !== 'string' || !value.trim()) throw Error(`Empty text: ${lang}/${key}`);
    if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(source.messages[key]))) throw Error(`Placeholder mismatch: ${lang}/${key}`);
  }
}
console.log(`Valid CONTENT-02 localization: ${expected.length} matching keys and placeholders in ${languages.join(', ')}.`);
