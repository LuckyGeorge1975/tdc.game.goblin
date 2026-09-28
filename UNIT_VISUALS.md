# Austauschbare Einheitengrafiken

**Dokumentversion:** 2

Die Kartenansicht bezieht ihre Darstellung zentral aus `unit-visuals.js`. Spiellogik und Szenarien verwenden weiterhin stabile interne IDs; ein Austausch der Grafik verändert daher keine Regeln oder Spielstände.

## Fünf fertige Sets

Das Dropdown `ICON SET` neben `SCENARIO` wählt zwischen `Modular Stealth Geometry`, `Industrial Exoframe`, `Monolithic Facet`, `Autonomous Drone Corps` und `Aerospace Ground Force`. Die Auswahl gilt für Karte, eigene Einheitenliste, Frachtanzeige und Unit Guide. Ein Wechsel startet das aktuelle Szenario neu; bei Spielfortschritt muss der Verlust des Spielstands bestätigt werden. Die Wahl bleibt lokal im Browser gespeichert.

Die Motive liegen unter `assets/unit-art/sets/{style}/icons/{unit}.svg` und `assets/unit-art/sets/{style}/library/{unit}.svg`. Das [Manifest](assets/unit-art/manifest.json) enthält alle 26 Motivschlüssel. Die Dateien stammen aus dem Content-Creator-Branch `codex/unit-art`; [Vergleich](assets/unit-art/comparison.html) und [Galerie](assets/unit-art/gallery.html) zeigen die vollständige Auswahl.

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
