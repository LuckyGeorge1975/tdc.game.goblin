# Anzeige-Texte für G.O.B.L.I.N.

`content-02.de.json` ist die deutsche Content-Quelle aus dem Unit-Art-Checkout. Die Dateien für `en`, `es` und `fr` enthalten dieselben 71 `messages`-Schlüssel und Platzhalter. Die Metadaten zu Missionen, Gültigkeit und Parametern stehen in der deutschen Quelldatei. `node assets/ui-copy/validate-locales.mjs` prüft Schlüssel, Leerwerte und Platzhalter in allen vier Sprachen.

## Laufzeit-Schnittstelle

`localization.js` stellt `globalThis.GoblinLanguage` bereit. Neue Screens warten vor dem ersten Rendern auf `await GoblinLanguage.ready` und lesen Texte mit `GoblinLanguage.t(key, params)`. Beispiel: `GoblinLanguage.t('dialog.changeMission.body', { nextMissionName })`. Platzhalter haben die Form `{name}`; Werte kommen aus Zustand und Präsentationsprojektion. Für `dialog.phaseAdvance.pending` wählt `t` bei `pendingCount` 0, 1 oder mehr automatisch `.none`, `.one` oder `.other`. Die expliziten Schlüssel können ebenfalls direkt verwendet werden.

`GoblinLanguage.choose('de' | 'en' | 'es' | 'fr')` wechselt die Sprache ohne Spielzustand zu verändern, setzt `document.documentElement.lang`, speichert die Wahl lokal und aktualisiert `?lang=`. Die Oberfläche kann auf `goblin-language-change` hören und nur ihre Anzeige neu rendern. `GoblinLanguage.current` liefert die aktive Sprache. Die Vergleichsseite reicht den Wechsel ohne Neustart an ihren eingebetteten Spielpfad weiter.

Die bestehende Legacy-Oberfläche nutzt vorerst `GoblinLanguage.translate(source)` und DOM-Textabgleich für verstreute Quelltexte. Für neue Screens ausschließlich semantische Schlüssel mit `t` verwenden; Regelcodes, Einheiten-IDs, Terrain-IDs und Core-Fehlercodes bleiben unveränderte Daten. Die UI wählt anhand des Zustands den passenden Textschlüssel und zeigt keine nicht verfügbaren Missionen an. Lange Ziel- und Dialogtexte dürfen umbrechen; vollständige Bedingungen bleiben auf Mobile im Briefing bzw. in den Missionsdetails zugänglich.
