# Austauschbare Einheitengrafiken

**Dokumentversion:** 1

Die Kartenansicht bezieht ihre Darstellung zentral aus `unit-visuals.js`. Spiellogik und Szenarien verwenden weiterhin stabile interne IDs; ein Austausch der Grafik verändert daher keine Regeln oder Spielstände.

## Lokales Bild zuweisen

Eine SVG-, PNG- oder WebP-Datei wird in einem lokalen Asset-Verzeichnis abgelegt und vor dem Start des Spiels registriert:

```js
UnitVisuals.setAsset('heavy-tank','assets/units/assault-tank.svg',{size:46});
```

Der Schlüssel entspricht normalerweise der internen Einheiten-ID, beispielsweise `ogre`, `gev`, `gev-pc`, `heavy-tank` oder `core`. Alternativ kann eine Einheit im Szenariodatensatz über `visualKey` auf einen eigenen Katalogeintrag verweisen.

## Vektormarker anpassen

Ohne Bilddatei bleiben die eingebauten, code-generierten Marker aktiv:

```js
UnitVisuals.register('heavy-tank',{shape:'tracked',label:'A',stroke:'#d1f35a'});
```

Verfügbare Grundformen sind `hex`, `fortress`, `skimmer`, `tracked`, `infantry` und `objective`. Assets bleiben lokal; der Renderer lädt keine Drittanbieter-CDNs.
