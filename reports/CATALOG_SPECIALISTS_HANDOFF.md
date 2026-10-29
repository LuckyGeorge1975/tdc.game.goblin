# Systeme und Engineering – Kandidatenübergabe

`goblin-upe.3`, Basis `435873178ebf443280fcc592560604624635ac78`. Dieser Bericht gehört zum lokalen Kandidatencommit; eine unabhängige Bedienungsabnahme und die Umschaltung des stabilen Previews erfolgen danach durch Koordination.

## Spielbarer Umfang

Die Missionen **Systeme im Gefecht** (`catalog-siege`) und **Bergen und Bauen** (`catalog-specialists`) verwenden `CATALOG_SPECIALISTS_v1`. Ihre gemeinsame Belegung umfasst 24 Klassen. U13 und U21 bleiben dem Folgepaket vorbehalten; das vollständige Katalogprofil bleibt inaktiv. Ziel beider Missionen: gegnerischen Kern zerstören und mindestens eine eigene Einheit erhalten; gleichzeitiger letzter Eigenverlust hat Niederlagenvorrang.

MkIII, MkV und Forge besitzen echte Ketten und einzelne Waffen, Werkzeuge beziehungsweise Buchten ohne erfundene Gesamt-HP. Waffen- und Komponentenziele werden über gruppierte Auswahllisten gewählt. U07 bindet jeden einzelnen Hauptwaffenschuss an das konkrete Ziel; U08/U09 verwenden die vorhandene direkte/indirekte Artillerieregel mit benanntem Spotter. Alte Piloten bleiben erhalten.

Pionieraktionen, Material, reparierte Module mit Bereitschaft ab dem nächsten eigenen Zug, sichtbare einmalig bergbare Wracks und zwei individuell belegte Forge-Buchten laufen durch dieselbe Befehls-, Geländeregel-, CRT-, Zufalls- und Rückgängig-Verarbeitung. Eine Forge ohne Ketten kann weiterhin arbeiten und Drohnen aufstellen, solange ihre dafür nötigen Komponenten und Budgets bestehen.

## Herkunft und Grenzen

- Daten: `assets/unit-art/rules/unit-profiles.catalog-approved.v1.json`, unveränderte geprüfte Adoption; Content-main erneut am 29.10.2026 um 18:27:37 UTC gelesen, unverändert `2fdce6ac1be30e8b2a360250b37724586469e71c`. Keine Content-Arbeitsbaumänderung und keine neuen Bildassets.
- Additiver Core-Beitrag `ogre-systems.js`: SHA256 `1de2ab821f0021f1a8204d15783d15848ea28f3f80ce0fc705f47b094141c411`. Fire-Binding: `50aa505a33a4c4b2313ff258e7d072e22cfe21bdc58cacf8b3e3fcd5392a4ac3`. Alte reine U07/U08/U09-Helfer bleiben unverändert.
- 65 genehmigte Copykeys plus ein Kettenhinweis in vier Sprachen exakt übernommen. Die Feldstellung benutzt einen Vektormarker. Unbelegte Plattform-Mündungspositionen verwenden den bestehenden Mittelpunktfallback.
- Kein neuer öffentlicher Save-/Replayimport, kein öffentlicher Release, Push, Tag oder eigener Browser-/Serverbetrieb. Die neuen Missionen werden im modernen Menü angeboten; bestehende Classic-Missionen bleiben erhalten.

## Reproduzierbare Belege

Developer-Abschlusslauf: **649/649 Tests bestanden**, ausgeführt mit `node --test tests/*.test.mjs` aus dem Spielcheckout. Die Handoffdatei im Verwaltungsroot nennt Log, feste SHA und Prüfgrenzen. Dies ist keine unabhängige native Bedienungsabnahme.

| Normale Partie, Seed 7 | Ende | Schritte | neue Zufallswerte |
| --- | --- | --- | --- |
| catalog-siege Sieg | Runde 2 | 24 | 18 |
| catalog-siege Niederlage | Runde 29 | 129 | 355 |
| catalog-specialists Sieg | Runde 4 | 40 | 18 |
| catalog-specialists Niederlage | Runde 26 | 125 | 103 |

`tests/fixtures/catalog-specialists-product-traces.v1.json.gz` enthält vollständige Profilköpfe, Startzustände, Befehle, Zustände, History, M1, Ereignisse und Präsentationszustände. Eine verlustfreie Objekttabelle spart wiederholte Daten. Der Replayvergleich prüft jede tatsächliche Befehlsausführung einschließlich aller Schrittwerte; der Quellenkopf ist fest gebunden.

`catalog-specialists-boundary-traces.v1.json.gz` ergänzt sechs **kontrollierte Schadensfälle**: je Komponente und Ketten für MkIII, MkV und Forge, mit expliziter benachbarter Positionierung vorhandener Einheiten, echtem Seed, Rückgängig und gecachtem Wiederholungsschuss. Diese Fälle sind keine normalen Missionserfolge. Zwei weitere unveränderte Missionsstarts belegen Räumen, Feldstellung und Brücke samt Material und Rückgängig.

Die alten Artillerie-JSON-55-Schritte und Katalog-Gzip-213-Schritte bleiben bytegleich. Neue explizite Source-Compatibility-Manifeste erlauben nur deklarierte Quellenwechsel; alle ursprünglichen Spiel-, Zufalls-, History- und Präsentationswerte bleiben die Vergleichsreferenz. Fehlende, veränderte oder unvollständige Manifeste werden abgelehnt.

Gezielte Fälle prüfen außerdem D/NE ohne Modulzerstörung, Kettenwurf 4/5, letzte Rakete vor Hilflosigkeit, gleichzeitigen Kern-/Eigenverlust, deduplizierten mechanischen Frachtverlust, reparierte Bucht/Waffe erst ab nächstem eigenen Zug, identische Frachtidentität, tatsächliche Loader/DOM-Auswahl und die relevante Skriptreihenfolge aus `index.html` einschließlich Vergleichseinstieg. Isolierte ältere Tests laden den echten gemeinsamen Life-Provider; ihre ursprünglichen Werte und Negativgrenzen bleiben erhalten.

## Unabhängige Prüfung

Ein gemeinsamer Prüfer übernimmt den festen sauberen Commit. Schwerpunkt: tatsächliche Desktopbedienung beider Missionen, Komponentenwahl/Slotbudgets und Kettenvorschau, Engineeringkosten/-gründe, Buchtidentität und Bereitschaft, Rückgängig, sichtbare Schäden/Wracks/Guide und eine normale Sieg-/Niederlagenstrecke. Automatisierte VM-/DOM-Prüfungen ersetzen diese native Abnahme nicht. Der bisher geprüfte 4183-Snapshot bleibt bis zur erfolgreichen unabhängigen Abnahme und atomaren Umschaltung online.
