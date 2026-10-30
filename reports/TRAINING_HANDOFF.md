Aktuelle Zuordnung 30.10.2026: Das vollständige .5-Paket einschließlich beider UI-Fixstände ist unabhängig auf `df1ba35d935971f7cc28835ae7d8d32f3d65178a` abgenommen und auf Root4183 bereitgestellt. Der folgende Developer-Kandidatentext bleibt als damaliger Stand erhalten; seine offenen Abnahmemarker sind historisch. Aktuelle Releasebezüge und Grenzen stehen im [Build-27-Handoff](TEST_HANDOFF.md#build-0127--erstes-lokales-releasepaket).

# T01–T03 und Mission Control – gebündelter Kandidat

30.10.2026 · `goblin-upe.5` · Basis `e71e1969c041806c649bb77e656b5ce50bf14e0d`. Developer-Selbstprüfung; unabhängige Produkt- und Bedienabnahme steht aus. Kein öffentlicher Releasebeleg.

## Nutzerpfad

Die Missionsauswahl bietet drei kurze Lektionen mit eigenem Lernziel und Briefing. T01 übt Vorschau, Abbruch, Bewegung, BACK, erneute Bewegung und eine freie Infanteriebewegung. T02 verlangt einen echten Schuss unabhängig von NE/D/X und einen vollständig ausgeführten Gegnerzug. T03 verbindet tatsächliche Geländekosten, blockierte Sicht, zwei legale Ausweichstellungen und einen Schuss auf ein Ziel in Deckung. Der Rückblick bleibt bis zur Bestätigung reversibel; danach folgen Wiederholen, nächste Lektion oder Missionsauswahl. Pause, Hilfe, Neustart und Missionswechsel verwenden die vorhandene Navigation.

Das optionale Intro und genau ein bedingter Hinweis hängen ausschließlich am normalen Legacy-`iron-dust` / `FIELD_TEST_LEGACY_v2`. Wegklicken beendet die Hinweise; Spielregeln, Welt, Befehlsbudget und Zufallswürfe bleiben gleich. Der separate Iron-Dust-Corepfad wird nicht zum Training umgewidmet.

## Feste Bindung und Architektur

- Genau `training-t01`, `training-t02`, `training-t03`; `TRAINING_FIELD_TEST_v1`, scenario/objective/script version 1, `training-field-test-data-v1`, `legacy-field-test-training-v1`, `learning`, `legacy-pixel-los-v1`.
- Feste Field-Test-Werte und Seeds 37093377/37093378/37093379. Keine Übernahme der 26 FULL-Klassen oder A–G-Regeln in die Lektionen. Der letzte Gegner-X und T01 ohne Feinde sind kein Kampfsieg.
- Unveränderter Core-PureDirector: SHA256 `f0b5064ab6ce484032baf8753afaf1e89c3483eac7b4fd1358ca2c3677561654`. Die Aufnahme ergänzt nur die autorisierten tatsächlichen Phasen `enemy`/`over`; historische Purelieferung bleibt erhalten.
- Levelpaket kanonisch `f68869da180df36a2d485940ca8155953d8c36f581d993a20514acf855d01d73`; Scriptpaket einschließlich semantischer Highlights kanonisch `5407c9e7d97a9583a002ef3aae54f528a27e21bb315a310016ff29703477e37b`. Vor Registrierung vollständig gebunden und validiert.
- Herkunft: Trainingsvertrag `88a2a9dde0ea9c9b4db347e09bd42d59fe2410abd8fcec0e07e1a0fcbec9b13b`; L10n-Lieferung `4b08f7f861494d77044a1cf4ba28fd58fa56268ed1e171f9c6ab7deb9f8f9a13`, exakt 47 Keys in DE/EN/ES/FR. Contentquelle bleibt `2fdce6ac1be30e8b2a360250b37724586469e71c`; kein privates Repository als Build-/Testabhängigkeit.
- `training-runtime.js` beobachtet die äußeren bestehenden Befehle, Resolver und Phasen. Director und RNG-Lesecursor liegen im vorhandenen `phaseCommands`-Checkpoint. BACK restauriert zuerst Welt, Facing, Progress und Cursor; danach folgen neue monotone Auditsequence/Historyrevision/Branch und Restore-Witness. Keine zweite Welthistory und kein öffentliches Saveformat.
- Der sessionlokale Seedkanal umfasst Spieler- und Gegnerwürfe. `Math.random` wird ausschließlich während des synchronen vorhandenen Resolvers im `finally` restauriert. Der bestehende Rollcache bleibt zuständig: BACK dreht den logischen Cursor zurück, nicht bereits erzeugte Zufallswerte oder den physischen Generator. Normale Missionen behalten ihren RNG.
- Positive Autophasenhalte schützen T01-BACK und den unbestätigten Rückblick. Manueller Verlust der T01-BACK-Gelegenheit wird bestätigt und bietet endlichen Neustart/Exit. Tatsächlicher Verlust aller eigenen Einheiten hat Vorrang; ein bereits vorgeführter Actor darf bei überlebendem Mitspieler fehlen, sofern er keine offene Pflicht hat.

## Reproduzierbare eigene Belege

Aus dem Game-Checkout:

```text
node --test tests/training-runtime.test.mjs tests/training-product-trace.test.mjs tests/scenario-profile-manifest.test.mjs
```

22 Gruppen bestanden: drei vollständige neue Game-/Teaching-Replays, echte V2-Select/Hex/Cancel-Handler, NE/D/X im tatsächlichen CRT als ausdrücklich kontrollierte Grenzfälle, BACK/Wurfbindung/Restorebranch, Reject/Stale, Autohalt/manuelle Bestätigung, benötigter/verzichtbarer Actorverlust, Gesamtverlust vor Debrief, vollständiger/idempotenter Gegnercallback/Reset, Ausnahme-RNG-Restaurierung, vier Runden Normalmission mit/ohne Hinweise und nach Trainings-Exit, vier Sprach-Key-/Placeholderprüfungen sowie bestehende Profil-Guards und fail-closed Quellen-/Daten-/Scriptänderungen einschließlich Classic-Loadergrenze, Erhalt des laufenden Directors bei abgelehntem Szenarienstart und getrenntem normalem Endscreen.

Die drei normalen Fixtures unter `tests/fixtures/training-t0*.game-teaching.v1.json.gz` enthalten feste Quellen-/Script-/Seedheader, sämtliche ausgeführten Befehle/Lehraktionen und nach jedem Schritt die vollständige Welt, bestehende History ohne reine Darstellungslogtexte, Directorprogress, Callerreceipts und beide RNG-Zustände. Die kontrollierten NE/D/X-Grenzfälle sind davon getrennt. Keine Stats-, Positions- oder RNG-Injektion in den normalen Aufnahmen. Die semantische Lehrspur ersetzt keinen nativen Bedienlauf.

Vorhandene 15 historische Fixturedateien und zehn Candidate-Trace-Digests bleiben bytegleich. Die neue eng begrenzte `training-source-compatibility.v1.json` bildet nur 17 explizite Quellenpaare auf e71 und bindet sieben neue Quellen, bevor die unveränderten früheren Provenienzstufen greifen. Sie normalisiert keinerlei Welt-, Ereignis-, Profil-, History- oder RNG-Werte. FULL-Harness lädt die neuen dort inaktiven Wrapper ausdrücklich mit. Fünf öffentliche/interne FULL-Starts, echte Query/Move/Hex/BACK, fünf Gegnerzüge mit beiden Wellen und der vollständige ursprüngliche U1-Weg behalten ihre Spielparität.

## Unabhängiger Gesamtcheck auf fester SHA

Ein Desktoplauf T01 → T02 → T03 → Normalmission mit Auswahl/Briefing/Anweisung, Vorschau/Cancel, BACK und Rückblick-BACK, manuellem Phasenabbruch, Debriefbestätigung, Retry/Next/Exit, Pause/Hilfe und Sprachwechsel. Besonders prüfen: lange französische Anweisung, sichtbare Ziel-/Actor-/Control-Highlights, keine verdeckte Karte/Bestätigung, keine Raw-Keys/CORE-0-Anzeige, tatsächliche Terrain-/Deckungsparameter und endliche Recovery nach abweichendem legalem Zug. Keine vier kompletten Sprachpartien oder neue 26er-Matrix.

Bekannter separater Rest aus dem vorherigen Stand: zwei isolierte stacklose ResizeObserver-Warnungen in unterschiedlichen Browserkontexten, bisher ohne belegte Funktionseinschränkung. Nicht pauschal als behoben/unbedenklich einstufen; finaler UI-/Releasecheck `.6` bleibt zuständig. Keine eigenen Browser, Server oder Previewwechsel durch Developer. Root aktualisiert 4183 erst nach gebündelter Abnahme; der geprüfte e71-Snapshot bleibt bis dahin online.
