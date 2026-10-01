# Austauschbare Einheitengrafiken

**Dokumentversion:** 3

Die Kartenansicht bezieht ihre Darstellung zentral aus `unit-visuals.js`. Spiellogik und Szenarien verwenden weiterhin stabile interne IDs; ein Austausch der Grafik verändert daher keine Regeln oder Spielstände.

## Sechs wählbare Sets

Das Dropdown `ICON SET` neben `SCENARIO` wählt Tabletop-Miniaturen, Technische Illustration, Industriellen Realismus, Pixel-Strategie, Cel-Shading / Comic oder Militärische Kartensymbole. Technische Illustration ist anfänglich gewählt. Die Auswahl gilt gemeinsam für Karte, eigene Einheitenliste, Frachtanzeige und die breite 1024 × 768-Ansicht im Unit Guide. Ein Wechsel startet das aktuelle Szenario neu; bei Spielfortschritt muss der Verlust des Spielstands bestätigt werden. Die Wahl bleibt lokal im Browser gespeichert.

Die Motive liegen unter `assets/unit-art/sets/{style}/icons/{unit}.svg` und `assets/unit-art/sets/{style}/library/{unit}.svg`. Das [Manifest](assets/unit-art/manifest.json) enthält 26 Einheiten- und zwölf Terrainschlüssel. Die zwölf Terrainansichten stammen für alle sechs Sets aus `sets/01-modular-stealth-geometry/terrain/`; `UnitVisuals.terrainAssetFor(type)` liefert diesen lokalen Fallbackpfad. Die ältere [Vergleichsseite](assets/unit-art/comparison.html), [Einheitengalerie](assets/unit-art/gallery.html) und [Terrain-Galerie](assets/unit-art/terrain-gallery.html) zeigen die getrennt erhaltenen Galerie-Sets. Der Laufzeit-Stilwechsel ändert nur die Einheitengrafiken und zeichnet die Karte neu.

Die Regeln der Terrainarten stehen getrennt von den SVGs in `terrain-rules.js`. Ein Icon-Set-Wechsel ändert nur die Darstellung, nicht Bewegung, Deckung oder Sicht. Der Unit Guide enthält alle 26 Motive, zeigt Live-Werte der aktuell vorhandenen Einheit und markiert nicht umgesetzte Spezialaktionen als geplant.

## Lokales Bild zuweisen

Eine SVG-, PNG- oder WebP-Datei wird in einem lokalen Asset-Verzeichnis abgelegt und vor dem Start des Spiels registriert:

```js
UnitVisuals.setAsset('heavy-tank','assets/units/assault-tank.svg',{size:46});
```

Der Schlüssel entspricht normalerweise der internen Einheiten-ID, beispielsweise `ogre`, `gev`, `gev-pc`, `heavy-tank` oder `core`. Alternativ kann eine Einheit im Szenariodatensatz über `visualKey` auf einen eigenen Katalogeintrag verweisen.
Individuell registrierte Bilddateien haben Vorrang vor dem gewählten Set. Szenario-Varianten werden über ihren Anzeigenamen zugeordnet, etwa `FIELD ENGINEERS` und `RELAY NODE` trotz geteilter technischer IDs.

## Vektormarker anpassen

Für Einheiten ohne Motiv bleiben die eingebauten, code-generierten Marker als Fallback aktiv:

```js
UnitVisuals.register('heavy-tank',{shape:'tracked',label:'A',stroke:'#d1f35a'});
```

Verfügbare Grundformen sind `hex`, `fortress`, `skimmer`, `tracked`, `infantry` und `objective`. Assets bleiben lokal; der Renderer lädt keine Drittanbieter-CDNs.
