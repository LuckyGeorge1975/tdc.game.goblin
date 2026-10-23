# M1: Daten und Marker

Implementierung zu `goblin-nbg.8`, auf Basis `b6b676e0ebd7e5b42aee35b3752a952d6fc653eb`. Verbindlich sind die Layerübergabe `.8.1`, der Datenvertrag `.8.2` und die drei bestätigten Nutzerentscheidungen vom 23.10.2026.

## Datenbindung

`m1-unit-markers.js` liest ausschließlich den aktuellen Snapshot. Core liefert Infanteriekennung, maximale Ketten und getrennte Waffen-Rohdaten über `buildIronDustV2View`; Legacy liest die bestehenden Einheiten und die eingefrorene `legacySession`. Binding enthält Szenario, Profil, Revision und Session-ID beziehungsweise Browser-Epoch. Keine `ensureState`-/`syncUnit`-Aufrufe und keine neue Siegerberechnung.

- Normale Einheiten: drei proportional teilgefüllte Segmente aus HP/maxHP; Infanterie: SP/maxSP. Deaktivierung zieht keine Segmente ab.
- Tatsächliche Systemträger: Segmente ausschließlich aus Ketten/maxKetten; ein separates Kreuz rechts oberhalb kennzeichnet mindestens eine zerstörte Waffe. `remaining` und `firedThisPhase` sind kein Schadensmaß. Exakte Zahlen und zerstörte Waffenbestände stehen im Detail/Systemstatus.
- Missionszielmenge: Core nur der gebundene feindliche `core`; Legacy aus dem gestarteten Objective, bei `core-and-escort` alle gebundenen Gegner. Jede Zugehörigkeit bleibt im Snapshot, HP≤0 ergibt `satisfied`, sonst `pending`, auch bei `disabled`. Nadeln erscheinen nur an sichtbaren pending-Mitgliedern; erfüllte Ziele bleiben im Missionsstatus gezählt. Niederlage und Zielerfüllung bleiben unabhängig.
- Unbekannte Profile und fehlende Maxima liefern keine erfundenen drei Lebenspunkte oder Bildnamen-Ziele.

## Layer und Herkunft

UI-V2 verwendet denselben Markerlayer für Core und Legacy: Schaden oben, ein dunkler/gefärbter Doppelstrich für Actor und angewähltes Ziel, separater gestrichelter Tastaturfokus und die Nadeln zuletzt. Die alten Teamhex-/Rauten, Zieloktagnone, Auswahl-/Target-Ringe und unteren HP-Balken entfallen in UI-V2. Non-V2 behält die vorhandene Darstellung. Der Iconrahmen bleibt unverändert 100/112 Feldbreite; keine Alpha-Boundingbox-Vergrößerung oder Palettenänderung. Alle neuen Layer sind für Picking durchlässig. CRT-Chips berücksichtigen auch die Nadel-Bildfläche bei ihrer freien Platzierung.

Feste externe Quelle: `c01ecb80bcdd813772d1433d9ae63b39e54ef050:designV2reworked-icons.md` und `design-exports/einheitengrafiken/zielmarke/zielmarke-c-nadel{,-unten}.png`. Content-main wurde am 23.10.2026 vor Umsetzung als `2fdce6ac1be30e8b2a360250b37724586469e71c` geprüft. Dokument, beide Nadeln und ihre Exportquellen sind nach dem Präfixwechsel `beratung-ui-ux/` blobgleich; aktiver Pin erhalten.

Der externe Exportcode wurde gelesen, nicht ausgeführt. Sein 200×260-Referenzcanvas mit Mittelpunkt (100,130) ist bestätigt. Der geprüfte Projekt-Export `scripts/export-objective-pins.py --archive <ZIP>` übernimmt ausschließlich die zwei C-Varianten aus dem fest gehashten Quellenarchiv, verkleinert die vollständigen 600×780-RGBA-Bilder auf 300×390 und schreibt lossless WebP. Ursprung und Ableitungen sind je Datei in [objective-pins-source.json](objective-pins-source.json) gehasht; Laufzeitbudget zusammen **13.026 Byte**. Der vollständige transparente Canvas und dessen Mittelpunkt bleiben erhalten. Oberste Kartenreihe: gelieferte untere Nadel; alle anderen Reihen: obere Nadel. Zoom oder Scrollen ändert die Kartenreihenzuordnung nicht.

## Prüfstand und offene Abnahme

Gezielte Tests prüfen unveränderte Rohdaten, HP-Maxima 1–6, 1/2 Infanteriestärke mit Teilfüllung, Deaktivierung, Kettenverlust bei 5/5 HP, zerstörte Waffen getrennt von Munition/Schusszustand, gebundene Zielmitglieder trotz Katalogänderung, Erfüllung trotz Niederlage, obere Kartenreihe, genau ein Ringpaar je Actor/Ziel, Nadelreihenfolge und Dateihashes. Bestehende Core-/Legacy-Objective-, K9-, CRT-, Zoom- und Bildfallbacktests bleiben maßgeblich.

Dieser erste integrierte Kandidat ist für den frühen unabhängigen Produktsmoke vorgesehen. Echte Core-/Legacy-Bedienung, mobile Fit-/Zoom-/Graustufenlesbarkeit, dichte Zielgruppen, Clipping/Statuskollisionen und Picking sind noch nicht abgenommen. Es gibt keine akzeptierte Fit-Ausnahme, keine Gesamtfreigabe für `.18`/M1 und keine Veröffentlichung. Schalter `.19` und Animationen sind nicht Teil dieses Abschnitts.
