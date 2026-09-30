import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('phase fixture instructions and Skimmer phase displays translate without visible GEV jargon', () => {
  const source = readFileSync(new URL('../localization.js', import.meta.url), 'utf8');
  const document = {
    currentScript: { src: 'http://127.0.0.1/localization.js' },
    readyState: 'loading', title: '',
    addEventListener() {},
  };
  const context = {
    document, URL, URLSearchParams,
    location: { href: 'http://127.0.0.1/src/app/reference.html', search: '' },
    navigator: { language: 'de' },
    localStorage: { getItem: () => null },
    fetch: async () => ({ ok: true, json: async () => ({ messages: {} }) }),
    console,
  };
  runInNewContext(source, context);
  const instruction = 'Beide Teams werden von Hand gesteuert. Skimmer wählen → bewegen → Fire Phase → Skimmer-Manöver → erneut bewegen. Das deaktivierte Fahrzeug erholt sich zu seinem festgelegten Teamstart.';
  const expected = {
    de: ['Skimmer-Manöver', 'Zum Skimmer-Manöver →', 'Spieler · Skimmer-Manöver'],
    en: ['Skimmer Maneuver', 'To Skimmer Maneuver →', 'Player · Skimmer Maneuver'],
    es: ['maniobra de deslizadores', 'A la maniobra de deslizadores →', 'Jugador · Maniobra de deslizadores'],
    fr: ['manœuvre des aéroglisseurs', 'Vers la manœuvre des aéroglisseurs →', 'Joueur · Manœuvre des aéroglisseurs'],
  };
  for (const [lang, [term, button, phase]] of Object.entries(expected)) {
    const translated = context.GoblinLanguage.translate(instruction, lang);
    assert.ok(translated.includes(term), `${lang}: ${translated}`);
    assert.equal(context.GoblinLanguage.translate('Zum Skimmer-Manöver →', lang), button);
    assert.equal(context.GoblinLanguage.translate('Player · Skimmer-Manöver', lang), phase);
    assert.doesNotMatch(translated, /\bGEV\b/i);
  }
});
