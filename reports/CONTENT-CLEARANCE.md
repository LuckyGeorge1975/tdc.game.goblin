# Content Clearance – G.O.B.L.I.N.

**Berichtsversion:** 1
Stand: 2026-09-26  
Scope: sichtbare Texte, Bezeichnungen, Bildsprache, Schriftwahl und Content-Dokumentation.  
Status: in Build `0.1.7` integriert und bereit zur Prüfung durch Legal; keine Rechtsberatung und keine formale Freigabe.

## Ziel

G.O.B.L.I.N. wird als eigenständiger Browser-Prototyp positioniert. Die öffentliche Präsentation soll keine Zugehörigkeit, Lizenzierung oder Empfehlung durch einen fremden Rechteinhaber nahelegen.

## Durchgeführte Bereinigung

- Produkt- und Erweiterungsnamen wurden aus der sichtbaren Oberfläche, dem Unit Guide und der Regelmatrix entfernt.
- Die Einheiten besitzen nun eine eigenständige Nomenklatur, unter anderem `GOBLIN SIEGEBREAKER`, `SKIMMER SCOUT`, `ROCKET ARTILLERY`, `SKIMMER CARRIER` und `FORGE ENGINEER`.
- Frühere Herkunftsbezeichnungen wurden durch die internen Content-Linien `CORE`, `EXPEDITIONARY`, `FRONTIER`, `SUPPORT` und `AUTONOMOUS` ersetzt.
- Beschreibungen im Unit Guide wurden als eigenständige Kurztexte neu formuliert.
- Der Footer bezeichnet das Projekt als unabhängigen Originalprototyp und schließt eine behauptete Verbindung oder Empfehlung aus.
- Externe Google-Webfonts wurden entfernt. Die Oberfläche verwendet ausschließlich lokale Systemschriften.
- Die vorhandene Bildsprache besteht aus programmatisch erzeugten SVG-/CSS-Formen. Im Repository wurden keine externen Rasterbilder, Audioaufnahmen oder fremden Logos als Laufzeit-Assets gefunden.

## Benennungsstandard

| Content-Funktion | Freigegebene Bezeichnung |
|---|---|
| Autonome Hauptplattform | GOBLIN SIEGEBREAKER |
| Größere Plattformvariante | GOBLIN DREADNAUGHT |
| Schwebefahrzeug-Klasse | SKIMMER |
| Transport-Schwebefahrzeug | SKIMMER CARRIER |
| Schwere Frontpanzerung | ASSAULT TANK |
| Leichte Aufklärung | RECON TANK |
| Schwere Jagdpanzerung | SIEGE TANK |
| Stationäre Fernunterstützung | LONG-RANGE BATTERY |
| Technische Plattform | FORGE ENGINEER |

## Bewusste technische Ausnahmen

Einige nicht sichtbare interne Schlüssel und historische Dateinamen bleiben vorerst erhalten, etwa `gev`, `ogre`, `ogre-systems.js` und `ogre-runtime.js`. Sie sind technische Identifikatoren, keine öffentliche Produktkennzeichnung. Eine Umbenennung würde Implementierungsarbeit und Migrationsrisiken erzeugen und liegt ausdrücklich außerhalb dieses Content-Branches.

## Drittanbieter-Inventar

| Kategorie | Befund |
|---|---|
| Schriftarten | Keine extern geladenen Webfonts; lokaler System-Fallback |
| Bilder | Keine externen Rasterbilddateien im Spielauftritt |
| Karten-/Einheitensymbole | Code-generierte SVG-/CSS-Geometrie |
| Audio | Keine Audiodateien |
| Logos fremder Anbieter | Keine vorgesehen |
| Laufzeit-CDNs | Für Content nicht erforderlich |

## Vor Veröffentlichung zu bestätigen

1. Legal bestätigt die Verfügbarkeit der Marke `G.O.B.L.I.N.` und der neuen Einzelnamen in den vorgesehenen Märkten.
2. Legal prüft, ob Regeln, Zahlenkombinationen und Szenariostruktur hinreichend eigenständig sind; diese Prüfung ist nicht Bestandteil des Content-Reviews.
3. Development bestätigt, dass keine zur Laufzeit nachgeladenen Drittanbieter-Assets außerhalb des hier geprüften HTML/CSS-Bestands existieren.
4. Die technische Bereinigung historischer interner IDs wird nur bei einem separat geplanten Refactoring vorgenommen.

## Freigabevermerk

- Content Design: vorbereitet auf Branch `codex/legal-content`
- Legal Review: ausstehend
- Development Review: in Build `0.1.7` integriert
- Veröffentlichung: Build `0.1.7`
