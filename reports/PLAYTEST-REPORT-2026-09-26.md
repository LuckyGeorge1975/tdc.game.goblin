# Spieletestbericht – G.O.B.L.I.N

**Berichtsversion:** 1  
**Datum:** 26.09.2026  
**Getestete Version:** FIELD TEST 0.1.4  
**Zugang:** [Veröffentlichte Browser-Version](https://luckygeorge1975.github.io/tdc.game.goblin/)  
**Testart:** Spielerischer Black-Box-Test mit Playwright; keine Einsicht in die Implementierung  
**Szenario:** MISSION 09 / UNIT TRIAL – abgeschlossen in Runde 8

## Kurzurteil

Der Einstieg ist einladend und vermittelt schnell, dass es sich um eine rundenbasierte Hexfeld-Taktikmission handelt. Ein Szenario ließ sich vollständig spielen und endete mit einer klaren Erfolgsmeldung. Die taktische Oberfläche bietet viele Informationen, aber die Folgen von Treffern und der Status „disabled“ sind nicht immer sofort verständlich. Insgesamt ein vielversprechender, atmosphärischer Prototyp, dessen Kampf-Rückmeldungen noch klarer sein könnten.

## Durchlauf

Ich öffnete zunächst den Quick Start und den Unit Guide, wählte anschließend „UNIT TRIAL“ und bestätigte den Szenariowechsel. Im Szenario bewegte ich Heavy Tank, Light Tank, GEV-PC und Combat Engineers über das Hexfeld, führte Feuerbefehle aus und beendete mehrere Runden. Der GEV-PC und der Light Tank gingen im Gefecht verloren. Der Heavy Tank erreichte den feindlichen Command Post und schaltete ihn schließlich aus. Die Oberfläche zeigte danach „MISSION COMPLETE“, „SUCCESS“ und „CORE OFFLINE“.

## Spieler-Eindruck

- **Guter Einstieg:** Titel, Missionsziel, Szenarioauswahl, Quick Start und Unit Guide sind direkt auf der Startseite erreichbar. Der Quick Start erklärt knapp das Spielprinzip; der Unit Guide bietet Einheiteninformationen.
- **Lesbare taktische Oberfläche:** Karte, Einheitenliste, Phasenanzeige, Reichweitenansichten und Kampfprotokoll helfen dabei, den Spielstand zu verfolgen. Ein Klick auf ein Feld zeigt Gelände und Belegung an.
- **Befehle sind grundsätzlich lernbar:** Einheit auswählen, Feld anklicken und mit `F` auf einen Gegner schießen. Phasenwechsel und ein Rückgängig-Befehl sind sichtbar. Beim vorzeitigen Phasenende fragt das Spiel nach, wenn Einheiten noch handeln können.
- **Kampfmeldungen schaffen Atmosphäre, lassen Folgen aber offen:** Das Protokoll meldet wiederholt „Ziel deaktiviert“; deaktivierte Gegner können später als „wieder einsatzbereit“ erscheinen. Ob ein Treffer Schaden verursacht, nur vorübergehend deaktiviert oder ein Ziel endgültig ausschaltet, war dadurch zunächst schwer einzuschätzen.
- **Siegbedingung wird am Ende klar:** Der Abschluss wurde deutlich mit „MISSION COMPLETE“ und „CORE OFFLINE“ angezeigt.

## Auffälligkeit

Nach einem Treffer auf den Command Post zeigte dessen Feldinformation **HP 5/5** und **STATUS DISABLED**. Ein späterer Treffer führte dann zum Missionsabschluss. Diese Kombination wirkt widersprüchlich, solange nicht erklärt wird, was „disabled“ für die HP-Anzeige und die Siegbedingung bedeutet.

## Technische Beobachtung aus Spielersicht

Während des Durchlaufs blieb die Spieloberfläche benutzbar. In der Browserkonsole war ein einzelner 404-Fehler für `/favicon.ico` sichtbar. Ich habe keine weiteren technischen Prüfungen oder Tests der Implementierung vorgenommen.

## Einschätzung

Als grober erster Eindruck funktioniert der Spiel-Loop: Einheiten bewegen, Feuerphase erleben, gegnerische Züge überstehen und ein Missionsziel erreichen. Die Präsentation trägt den taktischen Charakter gut. Für die nächste Runde würde ich vor allem die Treffer- und Deaktivierungsrückmeldungen schärfen, damit Spieler jederzeit erkennen, welche Einheit oder welches Ziel wie stark beschädigt beziehungsweise dauerhaft ausgeschaltet ist.
