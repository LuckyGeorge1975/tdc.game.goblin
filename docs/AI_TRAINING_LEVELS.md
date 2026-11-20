# Vier symmetrische Trainingskarten

Die am 20.11.2026 angenommenen Karten aus `goblin-09qu.5` stehen regulär in der Missionsauswahl. Kreuzviertel umfasst 8×8 Felder und sechs Einheiten je Seite, Weites Feld 12×12 und acht, Drei Pässe 18×16 und zwölf, Gezeitenbogen 24×24 und achtzehn. Terrain, Roster, Aufstellung und Infanteriestärke entsprechen den angenommenen Vorschlägen. Der vorhandene Spielrenderer stellt diese Daten dar.

Die Definitionen liegen in `assets/unit-art/levels/ai-training-missions.v3.json`. Sie verwenden das vorhandene Format `goblin-level-v3` mit dem bekannten Ziel `eliminate-opponent`. Beide Seiten müssen den gegnerischen Verband vollständig ausschalten und eigene Einheiten erhalten. Ein Command Core hat dabei dieselbe Zielrolle wie andere Einheiten. Für dieses Ziel sind zunächst keine Verstärkungswellen oder Zuglimits zugelassen. Bekannte Dialoge und Hotspots bleiben verfügbar. Historische Missionsziele und deren zulässige Kombinationen bleiben erhalten.

Der Editor unterstützt bis zu 24×24 Felder. Das Viererpaket umfasst kompakt 42.169 Zeichen und passt in das bestehende Importlimit von 65.536 Zeichen. Der Export einzelner Karten verwendet bei Bedarf bereits vorhandene kompakte JSON-Ausgabe. Die Karten behalten ihre Missions-ID auch beim Import nativer Trainingsarchive. Die Quell- und Konvertierungsbelege stehen in `docs/ai-training-levels-source.json`.

`assets/ai/training-corpus.v1.json` bindet den Trainingskorpus an Paket- und Levelprüfsummen. Trainingswerkzeuge können die Stichproben über den vorhandenen Node-Modulmechanismus auflisten:

```js
import {listAiTrainingCorpus} from './scripts/ai-training-corpus.mjs';
const samples = await listAiTrainingCorpus({seeds: [7, 101]});
```

Für jede Karte und jeden angegebenen Seed entstehen zwei unabhängige Stichproben, einmal mit der gesteuerten Seite `player`, einmal mit `enemy`. Die Startdaten werden weder umgeschrieben noch mit eigenen Regeln versehen. Aufteilung in Trainings- und Evaluationsseeds sowie Modellqualifikation gehören zum jeweiligen Trainingsauftrag. Dieser Korpus startet kein Training und belegt keine überlegene Spielstärke eines Modells.
