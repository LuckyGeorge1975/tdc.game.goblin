# Projektdokumentation

Die [Projektübersicht](../README.md) und der [Versionsverlauf](../CHANGELOG.md) stehen im Wurzelverzeichnis. Prüf- und Freigabeberichte sind getrennt in der [Berichtsübersicht](../reports/REPORTS.md) erfasst.

Der Spieleinstieg ist `index.html`. Die Root-Skripte betreiben die Field-Test- und Vollkatalog-Profile sowie ihre V2-Oberfläche. Iron Dust V2 verwendet den Core unter `src/core/`. `src/app/` enthält Diagnoseoberflächen für den Core. Deren Sprachkatalog wird wie im Spiel über das Root-Skript geladen. Die weiterhin benötigten Stylesheets und die von `rules.mjs` importierte Terrain-Tabelle liegen unter `src/legacy/`.

## Regeln und Gestaltung

- [Regelmatrix](RULE_MATRIX.md)
- [Einheitengrafiken](UNIT_VISUALS.md)
- [UI-/UX-Layoutsystem](UI_UX_LAYOUT_SYSTEM.md)
- [Content- und Asset-Hinweise](CONTENT-NOTICES.md)

## Architektur

- [Architekturübergabe](ARCHITECTURE_HANDOFF.md)
- [Modularer Schnitt 2](ARCHITECTURE_SLICE_2.md)
- [Terrain-Architektur](ARCHITECTURE_TERRAIN.md)
- [UI-Architektur](ARCHITECTURE_UI.md)

## Testplanung

- [QA-01 Testmatrix](QA-01-TESTMATRIX.md)
- [QA-03 Testmatrix](QA-03-TESTMATRIX.md)
- [QA-05 Terrain-Testmatrix](QA-05-TERRAIN-TESTMATRIX.md)
- [QA-07 UI-, Geräte- und Sprach-Testmatrix](QA-07-UI-DEVICE-LANGUAGE-TESTMATRIX.md)
