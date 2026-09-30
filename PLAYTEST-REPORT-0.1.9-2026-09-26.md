# Playtest-Bericht – Build 0.1.9

- **Datum:** 2026-09-26
- **Getestete Veröffentlichung:** [G.O.B.L.I.N – Field Test](https://luckygeorge1975.github.io/tdc.game.goblin/)
- **Angezeigter Stand:** FIELD TEST 0.1.9 · Build 9 · 2026-09-26
- **Szenario:** UNIT TRIAL
- **Testfokus:** ausschließlich die im Changelog für 0.1.9 genannten Änderungen am Strategic Missile Carrier und die dazugehörigen Spielerhinweise.
- **Testart:** manuelles Spielen der veröffentlichten Oberfläche mit Playwright. Keine Einsicht in die interne Implementierung.

## Ergebnis

**Die neue Einheit und ihr einmaliger Raketenangriff waren im Szenario erkennbar und spielbar.** Unit Intel zeigte den Strategic Missile Carrier mit 1/1 Raketen, Reichweite 8, Angriff 6 direkt und Angriff 3 auf benachbarte Hexe sowie den Hinweis, dass Friendly Fire möglich ist. Im Unit Guide (Eintrag 13/20) waren Sichtziel, Reichweite, Flächenschaden und Munitionsverbrauch ebenfalls beschrieben.

In der Feuerphase wählte ich ein erfasstes Feindziel. Die Oberfläche meldete „LENKFLUGKÖRPER · 1 ZIELE ERFASST“; das Kampfprotokoll meldete den Start auf den Siege Tank bei I-03 und anschließend einen direkten D-Treffer bei 1-1. Die Munitionsanzeige wechselte auf „MISSILE SPENT“.

Bei ausgeschalteter AUTO-Fortschaltung war BACK nach dem Start verfügbar. Das Zurücknehmen stellte den vorherigen Feuerzustand wieder her: Die Anzeige zeigte erneut 1/1 Raketen, der Feuerbefehl war wieder verfügbar und der Start war aus dem aktuellen Kampfprotokoll entfernt. Damit ließ sich der Raketenstart in dieser Phase tatsächlich rückgängig machen.

Der Quick Start erklärt, dass ein sichtbares Feindziel angeklickt wird und Nachbarhexen ebenfalls getroffen werden – einschließlich eigener Einheiten. Der Unit Guide nennt Angriff 6 auf das Ziel sowie Angriff 3 auf Einheiten in benachbarten Hexen. Die Sichtlinienpflicht und die Beschränkung auf eine Rakete sind damit in den geprüften Spielerhinweisen verständlich ausgewiesen.

## Durchgespielter Verlauf

Ich startete den Raketenangriff im UNIT TRIAL, machte ihn einmal rückgängig und führte ihn erneut aus. Danach ließ ich die verbleibenden Phasen und mehrere Folgerunden überwiegend verstreichen, um das Szenario bis zu einem Endzustand zu spielen. In Runde 7 zeigte die Oberfläche **MISSION FAILED**; alle fünf eigenen Einheiten waren zerstört.

Dieser passive Verlauf diente dem Erreichen eines Szenario-Endes und ist kein Urteil über die allgemeine Schwierigkeit oder Balance des UNIT TRIAL.

## Prüfpunkte aus dem Changelog 0.1.9

| Änderung | Beobachtung | Einschätzung |
|---|---|---|
| Strategic Missile Carrier als fünfte eigene Einheit im UNIT TRIAL | Die eigene Streitmacht zeigte fünf Einheiten; der Carrier war auswählbar und wurde im Unit Intel angezeigt. | Bestanden |
| Einmaliger zielgebundener Flächenschlag in der Feuerphase | Ein sichtbares Feindziel ließ sich in der Feuerphase auswählen; der Angriff und der direkte D-Treffer erschienen im Kampfprotokoll. | Bestanden |
| Munitionsanzeige und Rücknahme mit BACK | Anzeige wechselte von 1/1 auf MISSILE SPENT; BACK stellte 1/1 und den verfügbaren Feuerbefehl wieder her. | Bestanden |
| Hinweise zu Sichtlinie und einmaliger Munition | Quick Start und Unit Guide beschreiben sichtbares Ziel, Reichweite und einmalige Munition. | Bestanden |
| Schaden auf benachbarten Hexen einschließlich eigener Einheiten | Friendly Fire wird im Intel und in den Spielerhinweisen ausdrücklich genannt. In dieser Partie wurde kein benachbarter eigener Treffer ausgelöst. | Nicht praktisch verifiziert |

## Hinweis zur Rücknahme

Mit aktivierter AUTO-Fortschaltung wechselte die Partie nach dem Raketenangriff direkt zur nächsten Phase; in diesem Zustand war BACK deaktiviert. Nach Neustart und Abschalten von AUTO blieb der Angriff in der Feuerphase rücknehmbar. Für diesen Test wurde der Undo-Prüfpunkt daher mit ausgeschalteter AUTO-Fortschaltung bestätigt.

## Gesamturteil

Der 0.1.9-Testfokus ist in der veröffentlichten Oberfläche gut auffindbar. Die einmalige Munition, Reichweite, Angriffswerte und Friendly-Fire-Möglichkeit sind sowohl im Intel als auch in den Spielerhinweisen ersichtlich. Raketenstart und Undo wurden erfolgreich praktisch ausprobiert. Der tatsächliche Schadenseffekt auf benachbarte Hexe blieb in dieser Partie offen.
