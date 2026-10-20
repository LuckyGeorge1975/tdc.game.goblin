# UI V2 · lokale Releasevorlage

**Stand:** 20.10.2026 · **Issue:** `goblin-b22.7` · **Status:** vorbereiteter Kandidat, keine Veröffentlichungsfreigabe

## Feste Ausgangspunkte

| Gegenstand | Nachgewiesener Stand |
|---|---|
| Zuletzt veröffentlichter Build | `0.1.24`, Tag `v0.1.24` auf Commit `ceaf301c99ec35623dcf3dd323f9a7d7ee69137d` |
| Bestehender Rückfallpunkt | `v0.1.23` auf `2748063b83dbb8957d00a7b0f8523753c6b80ae9` |
| Lokaler UI-V2-Runtime-Kandidat | `56c135457c0384f08c3579af83b7ee3e724cbeba` auf `codex/ui-v2-integration` im Checkout `tdc.game.ogre-release-integration` |
| Aktuelle Metadaten | `release.js` meldet weiter `0.1.24` / Build `24`; `index.html` lädt `release.js?v=24` |
| Nächste Versionsnummer | `0.1.25` / Build `25` gemäß letzter veröffentlichter Stelle; noch nicht eingetragen oder getaggt |
| Einstieg | Standardansicht unverändert; UI V2 ausschließlich mit `?ui=v2` |

Der lokale Tag und die lesende GitHub-Verbindung bestätigten `v0.1.24` auf `ceaf301`; die GitHub-Verbindung zeigte `main` ebenfalls dort. Der normale `tools\git.ps1 ... ls-remote`-Aufruf scheiterte in der Sandbox mit `getaddrinfo() thread failed to start`. Das ist kein Beleg für einen abweichenden Remote-Stand und wurde nicht durch eine Netzwerkausnahme umgangen. Der öffentliche Pages-Einstieg wurde bei der Veröffentlichung von Build 24 in `goblin-bzs` geprüft; für diese Vorlage fand kein neuer Live-Pages-Test statt.

## Kandidatenumfang und Quellen

Der Diff von `v0.1.24` bis `56c1354` betrifft `dialogs.js`, `index.html`, `iron-dust-browser-v2.mjs`, `localization.js`, `ui-v2.js`, `ui-v2-flow.js`, `ui-v2.css`, `unit-guide.js`, den UI-V2-Implementierungsvertrag und einen Unit-Guide-Test. `src/core/`, Regelprofile, Replay-Autorität und Runtime-Assetdateien wurden in diesem Diff nicht geändert. Die neue Oberfläche zeigt die vorhandenen neun Legacy-Missionen und den getrennten IRON-DUST-v2-Core-Pfad; Missionsvorschau und Auswahl starten nichts. Team-, Ziel- und Statusmarker, Hex-Kontextmenü mit Panel-Fallback, gegliederte mobile Informationen, Hauptmenü und Levelwahl sind die sichtbaren Schwerpunkte. Das vollständige unveränderte `docs/CONTENT-NOTICES.md` Version 18 wird als englische Textansicht gelesen; sein SHA-256 ist `7869bc17a82ee9a7195b5cf4f02451638ce7253faf58ef91e3491da3f1ecbf68`.

V2 verwendet `system-ui` und CSS-/SVG-Geometrie aus dem Projekt. `index.html` und die eingebundenen Stylesheets enthalten keinen externen Webfont-Import; ältere Legacy-Schriftfamilien fallen auf lokal verfügbare Schriften zurück. Die Einheitengrafiken kommen weiter aus den vorhandenen lokalen sechs Stilen und dem [Unit-Art-Manifest](../assets/unit-art/manifest.json); Herkunft, Format und bisherige Rechte-Grenzen stehen in [Unit Visuals](UNIT_VISUALS.md) und den [Content & Asset Notices](CONTENT-NOTICES.md). Diese Quellenangaben ersetzen die ausstehende Content-/Legal-Deltaprüfung für genau den UI-V2-Releaseumfang nicht.

## QA und Grenzen

| Bereich | Beleg und Geltung |
|---|---|
| Regression vor den gezielten Nachläufen | `goblin-b22.6`: auf `655db6fbaa4007c668457389bb403d6c965d0a37` 380/380 vollständige Node-Tests, 19/19 gezielte Pfad-/Release-/Guide-Tests und 200 Locale-Schlüssel je DE/EN/ES/FR; spätere UI-Deltas benötigen die beauftragte finale Regressionskonsolidierung auf `56c1354` |
| Marker, Kontext und Menü | Unabhängige Abnahmen `.6.1` auf `6422511`, `.6.2` auf `f152ffdbcb825508d09ddc47f9bb30e310a61cb2`, `.6.3` auf `fb37795`; P2-Form/Fokus-Nachtest auf `56c1354` unabhängig bestanden (`goblin-b22.6.1`–`.6.3`) |
| Bedienung und Pages-Präfix | `.6` prüfte den lokalen Pages-Projektpfad, Backendtrennung, Touch, Fokus, vier Sprachen und fünf Ansichten auf seiner festen SHA; `.6.3` prüfte zehn Missionen, Core/Legacy-Start, Rechtshinweise mit identischem Hash und 320-px-Scroll. Frühere Belege gelten nur für unveränderte Pfade; die finale Bedienkonsolidierung auf `56c1354` steht in `.7` aus |
| Dokumentationsdelta dieser Vorlage | Unabhängiger Delta-, Link- und Konsistenzreview auf der späteren Dokumentations-SHA erforderlich; bei nachgewiesen unveränderter Runtime keine pauschale Wiederholung der Browser- oder Vollspiel-QA |

Reale Smartphone-/Tablet-Fingerproben `goblin-wtg` bleiben offen; Emulator- und Desktopbelege sind kein Hardware-PASS. `goblin-5an` ist für die Standard-Legacy-FR320-Ansicht weiterhin offen; der V2-Retest bei FR320 überträgt sich nicht darauf. Das Desktop-Randpanel und Leerraum im Querformat sind bedienbare Layoutreste. Der Core-Niederlagepfad hat einen reproduzierbaren Node-Trace, aber keinen hier behaupteten vollständigen Browser- oder Hardwarelauf. Für diese Vorlage werden weder alle zehn Missionen erneut vollständig durchgespielt noch die bekannten Grenzen als behoben erklärt.

## Prüf- und Veröffentlichungsverfahren

1. **Lokale Kandidatenentscheidung:** Tester Regression und Tester Release/Bedienung konsolidieren ihre unabhängigen Ergebnisse auf `56c1354`; Content und Legal prüfen das konkrete UI-/Text-/Font-/Asset-Delta. Koordination dokumentiert offene Grenzen und klärt mit dem Nutzer die Standardansicht sowie die konkrete öffentliche Veröffentlichung. Bis zu einer anderen Produktentscheidung bleibt V2 opt-in.
2. **Metadaten erst nach Gates:** Für einen freigegebenen Build 25 `release.js` auf Version `0.1.25`, Build `25` und das tatsächliche Releasedatum setzen; den Cacheparameter `release.js?v=25` anpassen. Den Changelog-Kandidaten in einen datierten Build-25-Eintrag umwandeln und Handoff, README sowie Release-Issue mit dem exakten finalen Commit aktualisieren. Diese Dokumentations-SHA ist noch nicht der finale Release-Commit.
3. **Finale lokale Prüfung:** Auf sauberem, festem Release-Commit `node scripts/verify-release.mjs --previous=v0.1.24` und die durch das Metadatendelta erforderlichen Release-/Regression-/Bediengates ausführen. Beide Testerrollen prüfen die finale SHA oder übernehmen frühere Belege nur nach dokumentiertem Delta-Abgleich. Content-/Legal-Grenzen und die Nutzerfreigabe gehören zur selben festen Paketentscheidung.
4. **Remote und Pages:** Vor einem Push den aktuellen `main`- und Tagstand erneut lesend prüfen. Der vorhandene Workflow `.github/workflows/deploy-pages.yml` wird bei Push auf `main` automatisch ausgelöst, führt Release-Verifier und Regression aus und lädt danach Pages hoch. Deshalb erst nach allen lokalen Gates und gültiger Nutzerfreigabe integrieren und `main` pushen. Workflow-Ergebnis, tatsächliche Deploy-SHA und den öffentlichen Einstieg `https://luckygeorge1975.github.io/tdc.game.goblin/` einschließlich `?ui=v2` nach dem Deploy prüfen; den bisherigen Stand nicht durch einen ungeprüften Kandidaten ersetzen.
5. **Tag und Rückfall:** Nach erfolgreichem Deploy und öffentlicher Prüfung ein eindeutiges, nicht umgehängtes `v0.1.25` am tatsächlich veröffentlichten Commit anlegen und die Remote-Referenz bestätigen. Bei fehlgeschlagenem Workflow oder öffentlicher Nachprüfung keine Build-25-Freigabe melden. Für eine Rückkehr den zuletzt öffentlich geprüften Commit `ceaf301` aus dem unveränderten Tag `v0.1.24` per autorisiertem `workflow_dispatch` mit genau diesem Ref erneut bereitstellen; vor Ausführung Ref-Checkout und Verifier-Vergleich gegen dessen Vorgänger `v0.1.23` prüfen, danach den öffentlichen Einstieg testen. Ein bloßer Revert auf `main` mit `release.js` Build 24 würde am vorhandenen Versions-Gate scheitern und ist kein geprüfter Rückfallweg. Falls der manuelle Workflow das Tag-Ref nicht annimmt, bleibt die Wiederherstellung bis zu einem separat geprüften Verfahren stehen. `v0.1.23` bleibt als älterer Rückfallpunkt erhalten. Kein vorhandenes Versionstag umhängen.

Version, Build, exakte Release-SHA, Tag, URL, Workflow- und öffentliche Prüfbelege sowie der tatsächliche Rückfallpunkt werden in `goblin-b22.7` und dem finalen Handoff ergänzt und dem Nutzer gemeldet. Diese Vorlage autorisiert keinen Push, Tag, Deploy oder Wechsel der Standardansicht.
