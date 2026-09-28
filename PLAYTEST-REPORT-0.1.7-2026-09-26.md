# Spieletestbericht – G.O.B.L.I.N Build 0.1.7

**Berichtsversion:** 1
**Datum:** 26.09.2026  
**Getestete Veröffentlichung:** [G.O.B.L.I.N — Field Test](https://luckygeorge1975.github.io/tdc.game.goblin/)  
**Build-Anzeige im Spiel:** Build 7 · 2026-09-26  
**Testart:** Black-Box-Test der veröffentlichten Browser-Oberfläche mit Playwright  
**Umfang:** Ausschließlich die unter `[0.1.7]` aufgeführten Changelog-Änderungen

## Kurzurteil

Die sichtbare Umstellung auf die G.O.B.L.I.N.-Nomenklatur ist im Startbildschirm, im Unit Guide, im Quick Start und im Footer erkennbar. Die neuen Linienbezeichnungen erscheinen im Katalog. Der Unit Guide ließ sich durch alle 20 Einträge blättern. In der Browseroberfläche wurde als Schriftstack `Segoe UI, Arial, sans-serif` angezeigt; bei einer Prüfung der geladenen Browser-Ressourcen fand sich keine externe Font-Anfrage. Die Herkunftshinweise sind deutlich im Footer platziert.

## Geprüfte Changelog-Punkte

### Eigenständige sichtbare Bezeichnungen

Im Startbildschirm und im Unit Guide sind unter anderem „GOBLIN SIEGEBREAKER“, „SKIMMER SCOUT“, „ROCKET ARTILLERY“, „ASSAULT TANK“, „RECON TANK“, „SKIMMER CARRIER“ und „FIELD ENGINEERS“ sichtbar. Die 20 Einträge des Unit Guide ließen sich mit den Schaltflächen „PREVIOUS“ und „NEXT“ durchblättern.

Der Quick Start verwendet „SKIMMER-PHASE“ und erklärt dazu die Schwebefahrzeug-Manöver. Er bezeichnet Ziele als „Command Core“ und „Relay Node“. Die Bezeichnungen waren im getesteten Spielablauf verständlich genug, um Einheiten zu bewegen und Kampfaktionen auszulösen.

### Interne Content-Linien

Im Unit Guide erscheinen Linien-/Katalogmarkierungen wie „CORE SYSTEM“, „SUPPORT“, „FRONTIER“ und „AUTONOMOUS“. Sie ersetzen die zuvor dokumentierten Produkt- und Erweiterungsbezüge durch die eigenständigen Liniennamen.

### Schriftarten und Herkunftshinweise

Die berechnete Schriftfamilie des sichtbaren Seiteninhalts lautete `"Segoe UI", Arial, sans-serif`. Bei der Playwright-Prüfung der erfolgreichen und fehlgeschlagenen Netzwerkanfragen fand sich keine externe Anfrage für Schriftdateien oder Google-Font-Hosts.

Im Footer standen die Hinweise „INDEPENDENT ORIGINAL PROTOTYPE · CODE-GENERATED VECTOR UI“ und „NO AFFILIATION OR ENDORSEMENT“ sichtbar unterhalb des Spiels.

### Clearance- und Drittanbieter-Dokumentation

Die öffentliche [Content-Clearance-Dokumentation](https://github.com/luckygeorge1975/tdc.game.goblin/blob/main/CONTENT-CLEARANCE.md) nennt Build 0.1.7. Sie führt ein Drittanbieter-Inventar auf und beschreibt lokale Systemschriften, code-generierte SVG-/CSS-Geometrie sowie keine externen Rasterbilder oder Audiodateien im Spielauftritt.

Der dort sichtbare Freigabestatus lautet **Legal Review: ausstehend**. Das Dokument benennt außerdem noch offene Prüfungen zu Markenverfügbarkeit, Eigenständigkeit von Regeln und Szenariostruktur sowie extern nachgeladenen Laufzeit-Assets. Das Vorhandensein der Dokumentation ist daher keine abgeschlossene Legal-Freigabe.

## Szenario-Durchlauf

Ich wählte „MISSION 09 / UNIT TRIAL“ und spielte den sichtbaren Zugablauf mit den im Guide benannten Einheiten und Phasen. Nach Verlusten unter anderem des Skimmer Carriers und des Field Engineers endete das Szenario in Runde 3 mit **„MISSION FAILED“**. Zu diesem Zeitpunkt zeigte „YOUR FORCE“ nur noch den Assault Tank als aktive Einheit. Der Durchlauf diente hier als spielerischer Check der aktualisierten Beschriftungen im Kontext; das Changelog 0.1.7 kündigt keine Regeländerung an.

## Einschätzung

Die Änderungen aus 0.1.7 sind auf der veröffentlichten Oberfläche konsistent und gut auffindbar. Die Umbenennungen bleiben auch in Hilfetexten und während des Szenarios präsent. Die lokalen Schriftfamilien und die Herkunftshinweise ließen sich im Browser nachvollziehen. Die Dokumentation markiert ihren offenen Legal-Status klar.
