# Vollkatalog – gebündelter Kandidat

`goblin-upe.4`, abgenommene Basis `1fef6ed55eda88681ba17d2d6c307c1f33f23312`. Dieser Bericht gehört zum neuen internen Kandidaten. Eine unabhängige Gesamtprüfung und das ausdrücklich neue FULL-Aktivierungsdelta folgen auf einer festen Commit-SHA; daraus folgt noch kein Release oder Previewwechsel.

## Spielbarer Umfang

Fünf neue feste Missionen verwenden `CATALOG_FULL_CANDIDATE_v1`: `catalog-full-atlas`, `catalog-full-terrain-course`, `catalog-full-advance`, `catalog-full-siege`, `catalog-full-specialists`. Der interne Einstieg benötigt `?catalogCandidate=1&ui=v2&scenario=<ID>` auf der vom Tester betriebenen QA-Adresse. Der stabile Nutzerpreview enthält währenddessen weiterhin den zuvor abgenommenen Snapshot. Alte Missionen, Piloten, Profile und vier historische Fixturedateien bleiben unverändert.

ATLAS umfasst alle 26 Typen. Ein Typ kann als eigene oder gegnerische Einheit vorkommen; die Rollen und wiederverwendeten A–D-Belege stehen in der Fähigkeitsmatrix. Zusätzliche Forge-Fracht und zwei vorab gebundene Verstärkungsinstanzen erhöhen die Instanzzahl, nicht die Klassenanzahl. Die beiden kleineren Systemplattformen aus dem Restpaket sind jetzt tatsächlich angebunden: Ninja mit Ketten/Komponenten und Tarnprojektion sowie der einmalige Hexschuss des Raketenträgers. Es gibt keine allgemeine Plattform-HP, keine freie Regelmischung und keinen zweiten Spielkern.

Alle fünf Missionen verlangen Kern- und Gegnervernichtung bei eigenem Überleben. Ausstehende gegnerische Verstärkung zählt zum Ziel. Nur die Spezialistenmission besitzt die angekündigten Guard-/Drohnenwellen, höchstens drei Eintrittsversuche und das Limit nach dem vollständigen gegnerischen Zug 20. Letzter Eigenverlust hat auch nach einer vollständigen Explosion Niederlagenvorrang.

## Eine gemeinsame Zustandsgrenze

Die bestehende Welt, Hexgeometrie, Bewegungskosten, CRT, Zufallsquelle, Rollcache, History und Präsentation bleiben führend. Der reine Sichtreducer erhält vollständige aktuelle Fakten und liefert die gemeinsame Bekanntheitsentscheidung für Karte, Marker, Vorschau, beide Guidewege, Find, Ziele, Spotter, Logs, Animation und Gegner. Eigene Einheiten bleiben bekannt; ein gegnerischer Tarnstatus wird nicht als eigener Badge veröffentlicht. Historische Zielreferenzen und Journale gelangen nicht in renderbare Snapshots. Logs bleiben typisiert und werden bei Darstellung nach aktueller Bekanntheit gefiltert.

Bewegungsvorschauen benutzen bekannte Belegung. Erst der bestätigte Befehl prüft verborgene Kollisionen, bewegt nur das freie Präfix, verbraucht die Aktion und deckt den ersten Kontakt auf. Benachbarte legale Fracht-/Pionierziele werden bereits durch den aktiven Actor beziehungsweise Carrier aufgeklärt; dafür wurde keine neue Kollisions- oder Kostenregel erfunden.

`CatalogHexFire` besitzt genau Actor, X/Y und Typ. Zentrum, Nachbarreihenfolge, Bodenopfer und automatische Komponentenziele werden vor Schaden festgelegt. Pro Bodenopfer läuft genau ein bestehender Wurf; Fracht teilt ihn. Leeres Feuer verbraucht Munition ohne Wurf. Die gesamte Explosion endet vor dem einzigen Terminalcheck. Die Präsentation erhält einen bestätigten Koordinatenlaunch einschließlich leerer Einschläge, keine erfundene Zieleinheit und keine Zwischenabnahme einzelner Opfer.

Wellen nutzen reale Terrain-/Belegungsfakten aus einer Weltrevision und feste Templates. Identische BeginTurn-Requests werden aus dem Journal wiederverwendet; doppelte Gegnercallbacks erzeugen keine zusätzlichen Züge, Versuche oder Einheiten. Undo enthält Sichtuhren, Wellenbindung, eigene Zugzähler, Journal, typisierte Logs und Terminalzustand zusätzlich zu den bisherigen Welt-/Zufallsdaten. Restore prüft Profil-, Owner-, Werte-, Wellen- und Sichtbindungen. Öffentlicher Save-/Replayimport ist weiterhin nicht vorgesehen.

## Gezielter neuer U2-Authoringdiff

Koordination hat nach einem begrenzten Taktikcheckpoint genau eine Änderung am neuen U2-Roster freigegeben: `catalog-full-siege-6`, D06 `(3,5)`, ersetzt den dort ungenutzten U12-Transporter durch den kanonischen U01/MkIII. Alle übrigen Starts, Gegner, Werte, Terrain- und Zielregeln bleiben erhalten. Die neue Leveldatei enthält den ausdrücklichen `adjustments`-Beleg und behält den unveränderten historischen Quellpfad samt Dateihash. Der separate Titel-/Briefingnachlauf beschreibt Systemduell und Belagerung statt einer nicht mehr vorhandenen Transportaufgabe.

Der kanonische Levelpaketdigest nach dieser Copybindung lautet `ff1e209a956dff2cf2ac9c45932e670fec643b0c5451574daf85bb863c5d9c79`. Das Modell prüft ihn vor Registrierung. Die historischen Showcases wurden nicht verändert. Der U2-Siegpfad ist ein längeres Systemduell und wird nicht als kurze Partie bezeichnet.

## Herkunft und Prüfpaket

Die unveränderte genehmigte Registry bleibt `catalog-approved-data-v1`, kanonischer Digest `71acac02581cf0709875bf4656418d493d21a40c5bc74ac4ffeff9b115b2e51a`, Contentpin `2fdce6ac1be30e8b2a360250b37724586469e71c`. `targetActive` bleibt unverändert; die spätere Produktaktivierung erhält ein ausdrückliches neues Profil.

Unveränderte Fachbeiträge: Sichtmodul SHA256 `9971da7c59addc892f17ae5bc5b98d04535137f1247dda18baa86ed9304e6c30`, Wellenmodul `1095bc3fddf75c70f27f623192f1aa647893ac7dc47bff3d42506207558b5abc`. Die bereits akzeptierten System-/Feueradapter werden wiederverwendet. Die 29 E/F/G-Copykeys in vier Sprachen und das enge U2-Delta mit drei Keys in vier Sprachen sind exakt übernommen; bestehende Missions-/Budgettexte werden passend zugeordnet.

Das Paket enthält vollständige interne Normalrouten, eine 26er-Matrix sowie gezielte E/F/G-, Cargo-, Engineering-, Lebenszyklus-, Leck- und Rückgängigprüfungen. Normale Partien benutzen ausschließlich reale Query-/Dispatch-/Phasen-/Gegnerpfade ohne Positions-, Werte- oder Würfelinjektion. Kontrollierte Grenzfälle sind ausdrücklich davon getrennt. Historische 55-, 213- und 318-Schritt-Orakel einschließlich Zusatzgrenzen wurden vollständig verglichen; die neue enge SourceCompatkette normalisiert nur deklarierte Quellenprovenienz, niemals Spielwerte oder Fixturebytes.

Die ersten zehn Full-v1-Aufzeichnungen sind nach der Verbraucherprüfung ausschließlich archivierte WIP-Forensik. Neben der Menüplatzierung wurden native Kartenbelegung, die effektive Gegnerbewegungs-Zielliste und der zentrale Fokuseinstieg auf die gemeinsame bekannte Belegung begrenzt. Unterscheidende Gegenproben waren zuvor rot und sind nach den Korrekturen grün. Weil die Gegnerkorrektur normale Partien verändert, werden alle zehn Verläufe tatsächlich als Full v2 neu aufgezeichnet und vollständig wiedergegeben. Bei dieser tatsächlichen v2-Neuaufzeichnung wurde keine DisplaySourceCompat oder Spielwertnormalisierung verwendet; die spätere enge Anzeige-Korrekturbrücke ist im QA-Fixabschnitt unten gesondert erklärt. Die vier zuvor akzeptierten historischen Orakel bleiben bytegleich; nur deren ausdrücklich gebundene Quellenprovenienz wird durch die bestehende enge SourceCompatkette geprüft.

Die Prüflogzahlen, unveränderlichen Quellen-/Datenhashes, Routenlängen, finalen Scope- und Commitangaben stehen im maschinenlesbaren Handoff der Koordination. Noch offene unabhängige Browser-/Bedienungsabnahme und FULL-Aktivierung dürfen nicht aus Entwicklerprüfungen abgeleitet werden. Kein eigener Browser, Server, Previewwechsel, Push, Tag oder öffentlicher Release durch Developer.


## Gebündelter QA-Fix .4.5/.4.6

Nach unabhängigem FIX REQUIRED auf ea4e229 wurden ausschließlich vier Anzeigegrenzen korrigiert: leere Auswahl im U13-Overlay ohne Exception; geordnete öffentliche Waveentrylisten aus unveränderter Config mit einem zusätzlichen Key×4; Full-core-and-escort-HUD aus vorhandenem objective.total; explizite GEV-Eignung/Zweitbudget im reinen Card-/GuideDTO sowie alternative System-Bewegungsbänder statt additiver Plusanzeige. Kein game.js-/Objective-/World-/History-/AI-/RNG-/Recorddiff.

Unterscheidende tatsächliche Quell-Render-Gegenproben waren rot und sind grün; sie verwenden den bestehenden Harness mit gezielt geladenen Renderblöcken und sind kein nativer Browserdurchlauf. Leere Auswahl, Starttail/Pausenfreigabe, positives U13Overlay, HUD4/4, beide Entryfolgen sowie lebende/statische Systemkarten/U26 und echte Skimmer sind gezielt geprüft, einschließlich unveränderter Welt/History/Sicht/Wellen/RNG/View. Bestehende Guide-/Skimmer-/Sichtbelege werden passend wiederverwendet.

Die zehn Full-v2-Dateien einschließlich Index/TraceDigests und vier historischen Orakel bleiben bytegleich. Eine explizite DisplaySourceCompat bindet genau zehn UI-/Copy-/Cache-/Checkerpfade mit Before/Afterhashes und separatem Providerhash; im gemischten catalog-full-runtime.js ändert sich ausschließlich catalogCard. Alle Quellenheader/Bytegates, Negativgates und der komplette kurze normale U1-Siegreplay sind geprüft. Kein neuer Recorderlauf oder Spielwertnormalisierung. Die vorherigen zehn vollständigen Replays mit1907Schritten bleiben als vorausgehender Beleg mit diesem engen Displaydelta erhalten.

Native U3-Fortsetzung/Wellen/Niederlage und der gezielte gemeinsame UI-Retest bleiben beim unabhängigen Prüfer nach Koordinationsstart auf fester sauberer Fix-SHA. Daraus folgt noch kein Candidate-/FULL-PASS, keine Aktivierung oder Previewveröffentlichung.


## QA-Restfix .4.8: automatischer Phasenhinweis

Der native Turn19-Fehler auf803a888 ist im tatsächlichen notifyPhaseSkip-Code rot reproduziert und behoben: Full meldet über vorhandenes Full.log(key,{},[]), der unterdrückte Legacy-Rohlog wird nicht angesprochen. NonFull markiert nur eine tatsächlich neu eingefügte Zeile. Viewhinweis/Timeout und der reguläre maybeAutoAdvancePhase-Aufrufer bleiben unverändert; keine Timer-/AI-/Wellen-/Limit-/RNGregelkorrektur.

Bewusstes Darstellungsdelta: genau eine subjectfreie typisierte Nachrichtenzeile in Full.logs pro tatsächlichem Hinweis, damit ebenfalls im bestehenden Fullsnapshot. Kein pauschaler identischer-Fullsnapshot-Claim. Eigene World-/Historycommands-/Wellen-/Sicht-/Feueruhren-/RNGdaten bleiben durch notify unverändert. Die echte anschließende reguläre Phase/Gegnerstart wird genau einmal erreicht.

Acht gezielte Prüfungen bestehen einschließlich leerem/altem Log, NonFull/Core/unknownphase, normalem Aufrufer,15unverändertenFixturebytes/10Header-/Foreigngates und vollständigem OriginalU1-Replay. Kein altes Logoracle verändert oder normalisiert, keine Neuaufnahme. Native Fortsetzung überTurn19 bis Enemy20/Limitende und Ergebnis bleibt nach festem Fixcommit beim unabhängigen Reviewer. Bugs/QAchild/Parent bleiben bis zuständiger Abnahme offen; FULL-Aktivierung weiterhin gesperrt.
