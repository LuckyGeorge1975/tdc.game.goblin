(function (root) {
  'use strict';

  const languages = ['de', 'en', 'es', 'fr'];
  const names = { de: 'Deutsch', en: 'English', es: 'Español', fr: 'Français' };
  const catalogBase = new URL('assets/ui-copy/', document.currentScript?.src || root.location.href);
  const contentCatalogs = {};
  const ready = Promise.all(languages.map(async (lang) => {
    const response = await fetch(new URL(`content-02.${lang}.json`, catalogBase));
    if (!response.ok) throw Error(`CONTENT-02 ${lang}: HTTP ${response.status}`);
    const catalog = await response.json();
    contentCatalogs[lang] = catalog.messages;
  })).then(() => true, (error) => { console.error('Localization catalog unavailable:', error); return false; });
  const messages = new Map();
  const add = (source, de, en, es, fr) => messages.set(source, { de, en, es, fr });

  // The source is the exact text currently emitted by the legacy and modular UI.
  // Keep rule identifiers, unit IDs and scenario IDs outside this display catalog.
  [
    ['LIVE FEED','LIVE-STATUS','LIVE FEED','SEÑAL EN VIVO','FLUX EN DIRECT'],
    ['QUICK START','KURZANLEITUNG','QUICK START','INICIO RÁPIDO','DÉMARRAGE RAPIDE'],
    ['UNIT GUIDE','EINHEITENFÜHRER','UNIT GUIDE','GUÍA DE UNIDADES','GUIDE DES UNITÉS'],
    ['OBJECTIVE','ZIEL','OBJECTIVE','OBJETIVO','OBJECTIF'],
    ['SCENARIO','SZENARIO','SCENARIO','ESCENARIO','SCÉNARIO'],
    ['ICON SET','ICON-SET','ICON SET','CONJUNTO DE ICONOS','JEU D’ICÔNES'],
    ['YOUR FORCE','EIGENE EINHEITEN','YOUR FORCE','TUS FUERZAS','VOS FORCES'],
    ['READOUT','LAGEBILD','READOUT','INFORME','RELEVÉ'],
    ['SECTOR','SEKTOR','SECTOR','SECTOR','SECTEUR'],
    ['WEATHER','WETTER','WEATHER','CLIMA','MÉTÉO'],
    ['ASH / LOW VIS','ASCHE / GERINGE SICHT','ASH / LOW VIS','CENIZA / POCA VISIBILIDAD','CENDRES / FAIBLE VISIBILITÉ'],
    ['THREAT','BEDROHUNG','THREAT','AMENAZA','MENACE'],
    ['ELEVATED','ERHÖHT','ELEVATED','ELEVADA','ÉLEVÉE'],
    ['TACTICAL MAP','TAKTISCHE KARTE','TACTICAL MAP','MAPA TÁCTICO','CARTE TACTIQUE'],
    ['MOVEMENT PHASE','BEWEGUNGSPHASE','MOVEMENT PHASE','FASE DE MOVIMIENTO','PHASE DE MOUVEMENT'],
    ['FIRE PHASE','FEUERPHASE','FIRE PHASE','FASE DE FUEGO','PHASE DE TIR'],
    ['SKIMMER MANEUVER','SKIMMER-MANÖVER','SKIMMER MANEUVER','MANIOBRA DE DESLIZADORES','MANŒUVRE DES AÉROGLISSEURS'],
    ['HOSTILE PHASE','FEINDPHASE','HOSTILE PHASE','FASE ENEMIGA','PHASE ENNEMIE'],
    ['PLAYER PHASE','SPIELERPHASE','PLAYER PHASE','FASE DEL JUGADOR','PHASE DU JOUEUR'],
    ['MOVEMENT RANGE','BEWEGUNGSREICHWEITE','MOVEMENT RANGE','ALCANCE DE MOVIMIENTO','PORTÉE DE DÉPLACEMENT'],
    ['FIRE RANGE','FEUERREICHWEITE','FIRE RANGE','ALCANCE DE FUEGO','PORTÉE DE TIR'],
    ['LINE OF SIGHT','SICHTLINIE','LINE OF SIGHT','LÍNEA DE VISIÓN','LIGNE DE VUE'],
    ['GRID','RASTER','GRID','CUADRÍCULA','GRILLE'],
    ['TURN','ZUG','TURN','TURNO','TOUR'],
    ['LIVE TERRAIN SCAN','GELÄNDEÜBERSICHT','LIVE TERRAIN SCAN','ESCANEO DEL TERRENO','RELEVÉ DU TERRAIN'],
    ['PHASE TRANSITION','PHASENWECHSEL','PHASE TRANSITION','CAMBIO DE FASE','CHANGEMENT DE PHASE'],
    ['NO UNIT SELECTED','KEINE EINHEIT AUSGEWÄHLT','NO UNIT SELECTED','NINGUNA UNIDAD SELECCIONADA','AUCUNE UNITÉ SÉLECTIONNÉE'],
    ['Wähle eine Einheit für Befehle','Wähle eine Einheit für Befehle','Select a unit to issue orders','Selecciona una unidad para dar órdenes','Sélectionnez une unité pour donner des ordres'],
    ['END TURN','ZUG BEENDEN','END TURN','TERMINAR TURNO','TERMINER LE TOUR'],
    ['RESTART','NEU STARTEN','RESTART','REINICIAR','RECOMMENCER'],
    ['COMBAT LOG','KAMPFPROTOKOLL','COMBAT LOG','REGISTRO DE COMBATE','JOURNAL DE COMBAT'],
    ['STANDBY','BEREIT','STANDBY','EN ESPERA','EN ATTENTE'],
    ['COMMANDS','BEFEHLE','COMMANDS','ÓRDENES','COMMANDES'],
    ['CLICK','KLICK','CLICK','CLIC','CLIC'],
    ['Einheit wählen / bewegen','Einheit wählen / bewegen','Select / move unit','Seleccionar / mover unidad','Sélectionner / déplacer une unité'],
    ['Feind in Reichweite feuern','Feind in Reichweite feuern','Fire at enemy in range','Disparar al enemigo al alcance','Tirer sur un ennemi à portée'],
    ['Transporter: Laden / erste Einheit entladen','Transporter: Laden / erste Einheit entladen','Transport: load / unload first unit','Transporte: cargar / descargar primera unidad','Transport : charger / débarquer la première unité'],
    ['Auswahl aufheben','Auswahl aufheben','Clear selection','Cancelar selección','Annuler la sélection'],
    ['UNIT INTEL','EINHEITENINFO','UNIT INTEL','DATOS DE UNIDAD','INFOS UNITÉ'],
    ['HOSTILE INTEL','FEINDINFO','HOSTILE INTEL','DATOS DEL ENEMIGO','INFOS ENNEMIES'],
    ['FIELD INTEL','FELDINFO','FIELD INTEL','DATOS DEL TERRENO','INFOS TERRAIN'],
    ['SECTOR BRIEF','SEKTORBERICHT','SECTOR BRIEF','INFORME DEL SECTOR','RAPPORT DE SECTEUR'],
    ['Klicke eine Einheit für taktische Informationen.','Klicke eine Einheit für taktische Informationen.','Click a unit for tactical information.','Haz clic en una unidad para ver información táctica.','Cliquez sur une unité pour voir ses informations tactiques.'],
    ['Klicke ein Feld für taktische Informationen.','Klicke ein Feld für taktische Informationen.','Click a cell for tactical information.','Haz clic en una casilla para ver información táctica.','Cliquez sur une case pour voir ses informations tactiques.'],
    ['STATUS','STATUS','STATUS','ESTADO','ÉTAT'],
    ['SCANNING','SCAN LÄUFT','SCANNING','ESCANEANDO','ANALYSE EN COURS'],
    ['FIELD MANUAL','FELDHANDBUCH','FIELD MANUAL','MANUAL DE CAMPO','MANUEL DE TERRAIN'],
    ['TACTICAL ARCHIVE','TAKTISCHES ARCHIV','TACTICAL ARCHIVE','ARCHIVO TÁCTICO','ARCHIVES TACTIQUES'],
    ['FRIENDLY SYSTEM','EIGENES SYSTEM','FRIENDLY SYSTEM','SISTEMA ALIADO','SYSTÈME ALLIÉ'],
    ['HEAVY ASSAULT','SCHWERER ANGRIFF','HEAVY ASSAULT','ASALTO PESADO','ASSAUT LOURD'],
    ['REGELSTATUS','REGELSTATUS','RULE STATUS','ESTADO DE REGLAS','STATUT DES RÈGLES'],
    ['AKTUELLE PHASE','AKTUELLE PHASE','CURRENT PHASE','FASE ACTUAL','PHASE ACTUELLE'],
    ['SZENARIEN','SZENARIEN','SCENARIOS','ESCENARIOS','SCÉNARIOS'],
    ['AKTIONEN','AKTIONEN','ACTIONS','ACCIONES','ACTIONS'],
    ['PREVIOUS','ZURÜCK','PREVIOUS','ANTERIOR','PRÉCÉDENT'],
    ['NEXT','WEITER','NEXT','SIGUIVANTE','SUIVANT'],
    ['AUF KARTE','AUF KARTE','ON MAP','EN EL MAPA','SUR LA CARTE'],
    ['AUTO','AUTO','AUTO','AUTO','AUTO'],
    ['WARNING','WARNUNG','WARNING','ADVERTENCIA','AVERTISSEMENT'],
    ['CONFIRM','BESTÄTIGEN','CONFIRM','CONFIRMAR','CONFIRMER'],
    ['CANCEL','ABBRECHEN','CANCEL','CANCELAR','ANNULER'],
    ['CONTINUE','FORTFAHREN','CONTINUE','CONTINUAR','CONTINUER'],
    ['NEVER ASK AGAIN','NICHT ERNEUT FRAGEN','NEVER ASK AGAIN','NO VOLVER A PREGUNTAR','NE PLUS DEMANDER'],
    ['NEXT: FIRE','WEITER: FEUER','NEXT: FIRE','SIGUIENTE: FUEGO','SUIVANT : TIR'],
    ['NEXT: SKIMMER','WEITER: SKIMMER','NEXT: SKIMMER','SIGUIENTE: DESLIZADOR','SUIVANT : AÉROGLISSEUR'],
    ['BACK','ZURÜCK','BACK','ATRÁS','RETOUR'],
    ['DESTROYED','ZERSTÖRT','DESTROYED','DESTRUIDO','DÉTRUIT'],
    ['DISABLED','DEAKTIVIERT','DISABLED','INHABILITADO','NEUTRALISÉ'],
    ['READY','BEREIT','READY','LISTO','PRÊT'],
    ['EMBARKED','EINGESTIEGEN','EMBARKED','EMBARCADO','EMBARQUÉ'],
    ['COVERED','IN DECKUNG','COVERED','A CUBIERTO','À COUVERT'],
    ['OPEN','OFFEN','OPEN','ABIERTO','DÉGAGÉ'],
    ['BLOCKED','BLOCKIERT','BLOCKED','BLOQUEADO','BLOQUÉ'],
    ['CLEAR','FREI','CLEAR','DESPEJADO','DÉGAGÉ'],
    ['NONE','KEINE','NONE','NINGUNO','AUCUN'],
    ['TERRAIN','GELÄNDE','TERRAIN','TERRENO','TERRAIN'],
    ['MOVE COST','BEWEGUNGSKOSTEN','MOVE COST','COSTE DE MOVIMIENTO','COÛT DE DÉPLACEMENT'],
    ['COVER','DECKUNG','COVER','COBERTURA','COUVERTURE'],
    ['OCCUPANT','BESETZUNG','OCCUPANT','OCUPANTE','OCCUPANT'],
    ['VISIBILITY','SICHT','VISIBILITY','VISIBILIDAD','VISIBILITÉ'],
    ['DEFENSE','VERTEIDIGUNG','DEFENSE','DEFENSA','DÉFENSE'],
    ['DAMAGE STATE','SCHADENSSTATUS','DAMAGE STATE','ESTADO DE DAÑO','ÉTAT DES DÉGÂTS'],
    ['RECOVERY','ERHOLUNG','RECOVERY','RECUPERACIÓN','RÉCUPÉRATION'],
    ['DESTROYS','ZERSTÖRT','DESTROYS','DESTRUYE','DÉTRUIT'],
    ['ARMOR / HP','PANZERUNG / HP','ARMOR / HP','BLINDAJE / PV','BLINDAGE / PV'],
    ['MOVE','BEWEGUNG','MOVE','MOVIMIENTO','DÉPLACEMENT'],
    ['RANGE','REICHWEITE','RANGE','ALCANCE','PORTÉE'],
    ['ATTACK / DEF','ANGRIFF / VERT.','ATTACK / DEF','ATAQUE / DEF.','ATTAQUE / DÉF.'],
    ['COMMAND','BEFEHL','COMMAND','ORDEN','COMMANDE'],
    ['HOSTILE','FEIND','HOSTILE','ENEMIGO','ENNEMI'],
    ['FRIENDLY','EIGEN','FRIENDLY','ALIADO','ALLIÉ'],
    ['MISSION COMPLETE','MISSION ERFÜLLT','MISSION COMPLETE','MISIÓN CUMPLIDA','MISSION ACCOMPLIE'],
    ['MISSION FAILED','MISSION GESCHEITERT','MISSION FAILED','MISIÓN FALLIDA','MISSION ÉCHOUÉE'],
    ['SUCCESS','ERFOLG','SUCCESS','ÉXITO','SUCCÈS'],
    ['CRITICAL','KRITISCH','CRITICAL','CRÍTICO','CRITIQUE'],
    ['PROCESSING','IN BEARBEITUNG','PROCESSING','PROCESANDO','TRAITEMENT'],
    ['CORE OFFLINE','KERN AUSGEFALLEN','CORE OFFLINE','NÚCLEO FUERA DE SERVICIO','NOYAU HORS SERVICE'],
    ['CORE OPERATIONAL','KERN BETRIEBSBEREIT','CORE OPERATIONAL','NÚCLEO OPERATIVO','NOYAU OPÉRATIONNEL'],
    ['CORE DISABLED','KERN DEAKTIVIERT','CORE DISABLED','NÚCLEO INHABILITADO','NOYAU NEUTRALISÉ'],
    ['MOVEMENT DONE','BEWEGUNG BEENDET','MOVEMENT DONE','MOVIMIENTO COMPLETADO','DÉPLACEMENT TERMINÉ'],
    ['FIRE DONE','FEUER BEENDET','FIRE DONE','FUEGO COMPLETADO','TIR TERMINÉ'],
    ['SECOND MOVE DONE','ZWEITE BEWEGUNG BEENDET','SECOND MOVE DONE','SEGUNDO MOVIMIENTO COMPLETADO','SECOND DÉPLACEMENT TERMINÉ'],
    ['NO TARGET','KEIN ZIEL','NO TARGET','SIN OBJETIVO','AUCUNE CIBLE'],
    ['DONE','ERLEDIGT','DONE','HECHO','TERMINÉ'],
    ['MISSION NEU STARTEN?','MISSION NEU STARTEN?','RESTART MISSION?','¿REINICIAR MISIÓN?','RECOMMENCER LA MISSION ?'],
    ['Der aktuelle Spielstand und die Befehle dieser Mission gehen verloren.','Der aktuelle Spielstand und die Befehle dieser Mission gehen verloren.','The current game and its orders will be lost.','Se perderán la partida actual y sus órdenes.','La partie actuelle et ses ordres seront perdus.'],
    ['NEU STARTEN','NEU STARTEN','RESTART','REINICIAR','RECOMMENCER'],
    ['WEITERSPIELEN','WEITERSPIELEN','KEEP PLAYING','SEGUIR JUGANDO','CONTINUER LA PARTIE'],
    ['SZENARIO WECHSELN?','SZENARIO WECHSELN?','CHANGE SCENARIO?','¿CAMBIAR ESCENARIO?','CHANGER DE SCÉNARIO ?'],
    ['Der aktuelle Spielstand wird verworfen. Neues Szenario:','Der aktuelle Spielstand wird verworfen. Neues Szenario:','The current game will be discarded. New scenario:','Se descartará la partida actual. Nuevo escenario:','La partie actuelle sera abandonnée. Nouveau scénario :'],
    ['WECHSELN','WECHSELN','CHANGE','CAMBIAR','CHANGER'],
    ['WÄHLE EINE EINHEIT','WÄHLE EINE EINHEIT','SELECT A UNIT','SELECCIONA UNA UNIDAD','SÉLECTIONNEZ UNE UNITÉ'],
    ['WÄHLE ZUERST EINE EINHEIT','WÄHLE ZUERST EINE EINHEIT','SELECT A UNIT FIRST','SELECCIONA PRIMERO UNA UNIDAD','SÉLECTIONNEZ D’ABORD UNE UNITÉ'],
    ['ZIEL NICHT ERREICHBAR','ZIEL NICHT ERREICHBAR','TARGET OUT OF REACH','OBJETIVO INALCANZABLE','CIBLE HORS DE PORTÉE'],
    ['FEUERPHASE NOCH NICHT AKTIV','FEUERPHASE NOCH NICHT AKTIV','FIRE PHASE NOT ACTIVE YET','FASE DE FUEGO AÚN INACTIVA','PHASE DE TIR PAS ENCORE ACTIVE'],
    ['BEFEHL AUSGEFÜHRT','BEFEHL AUSGEFÜHRT','ORDER EXECUTED','ORDEN EJECUTADA','ORDRE EXÉCUTÉ'],
    ['EINHEIT IST DEAKTIVIERT','EINHEIT IST DEAKTIVIERT','UNIT IS DISABLED','UNIDAD INHABILITADA','UNITÉ NEUTRALISÉE'],
    ['EINHEIT HAT BEREITS GEHANDELT','EINHEIT HAT BEREITS GEHANDELT','UNIT HAS ALREADY ACTED','LA UNIDAD YA HA ACTUADO','L’UNITÉ A DÉJÀ AGI'],
    ['IN DIESER PHASE NICHT MÖGLICH','IN DIESER PHASE NICHT MÖGLICH','NOT POSSIBLE IN THIS PHASE','NO ES POSIBLE EN ESTA FASE','IMPOSSIBLE DURANT CETTE PHASE'],
    ['WÄHLE EINE EINHEIT ZUM BEWEGEN','WÄHLE EINE EINHEIT ZUM BEWEGEN','SELECT A UNIT TO MOVE','SELECCIONA UNA UNIDAD PARA MOVERLA','SÉLECTIONNEZ UNE UNITÉ À DÉPLACER'],
    ['WÄHLE EINE EINHEIT ZUM FEUERN','WÄHLE EINE EINHEIT ZUM FEUERN','SELECT A UNIT TO FIRE','SELECCIONA UNA UNIDAD PARA DISPARAR','SÉLECTIONNEZ UNE UNITÉ POUR TIRER'],
    ['SKIMMER-MANÖVER: BIS ZU 2 FELDER','SKIMMER-MANÖVER: BIS ZU 2 FELDER','SKIMMER MANEUVER: UP TO 2 CELLS','MANIOBRA DE DESLIZADOR: HASTA 2 CASILLAS','MANŒUVRE AÉROGLISSEUR : JUSQU’À 2 CASES'],
    ['FEINDZUG WIRD AUSGEFÜHRT','FEINDZUG WIRD AUSGEFÜHRT','ENEMY TURN IN PROGRESS','TURNO ENEMIGO EN CURSO','TOUR ENNEMI EN COURS'],
    ['REGELSTATUS','REGELSTATUS','RULE STATUS','ESTADO DE REGLAS','STATUT DES RÈGLES'],
    ['CATALOG ONLY','NUR KATALOG','CATALOG ONLY','SOLO CATÁLOGO','CATALOGUE UNIQUEMENT'],
    ['NOT IN CURRENT SCENARIO','NICHT IM AKTUELLEN SZENARIO','NOT IN CURRENT SCENARIO','NO APARECE EN ESTE ESCENARIO','ABSENT DU SCÉNARIO ACTUEL'],
    ['LIVE IN CURRENT SCENARIO','IM AKTUELLEN SZENARIO','LIVE IN CURRENT SCENARIO','PRESENTE EN EL ESCENARIO ACTUAL','PRÉSENT DANS LE SCÉNARIO ACTUEL'],
    ['NO ACTION NOW','JETZT KEINE AKTION','NO ACTION NOW','SIN ACCIÓN AHORA','AUCUNE ACTION POUR LE MOMENT'],
    ['HOSTILE AI','FEINDLICHE KI','HOSTILE AI','IA ENEMIGA','IA ENNEMIE'],
    ['Sprache','Sprache','Language','Idioma','Langue'],
    ['Icon-Set wählen','Icon-Set wählen','Choose icon set','Elegir conjunto de iconos','Choisir un jeu d’icônes'],
    ['Reichweitenansicht','Reichweitenansicht','Range view','Vista de alcance','Vue des portées'],
    ['Hexfeld-Schlachtfeld','Hexfeld-Schlachtfeld','Hex battlefield','Campo de batalla hexagonal','Champ de bataille hexagonal'],
    ['Waffenauswahl','Waffenauswahl','Weapon selection','Selección de arma','Choix de l’arme'],
    ['Gegnerzug automatisch starten, sobald alle eigenen Einheiten gehandelt haben','Gegnerzug automatisch starten, sobald alle eigenen Einheiten gehandelt haben','Start the enemy turn automatically after all your units have acted','Iniciar automáticamente el turno enemigo cuando todas tus unidades hayan actuado','Lancer automatiquement le tour ennemi quand toutes vos unités ont agi'],
    ['Quick Start schließen','Kurzanleitung schließen','Close quick start','Cerrar inicio rápido','Fermer le démarrage rapide'],
    ['Einheitenführer schließen','Einheitenführer schließen','Close unit guide','Cerrar guía de unidades','Fermer le guide des unités'],
    ['Durchbrechen. Ausschalten. Überleben.','Durchbrechen. Ausschalten. Überleben.','Break through. Eliminate. Survive.','Avanza. Elimina. Sobrevive.','Percer. Éliminer. Survivre.'],
    ['Zerstöre den feindlichen Kommandokern, bevor Verstärkungen eintreffen.','Zerstöre den feindlichen Kommandokern, bevor Verstärkungen eintreffen.','Destroy the enemy command core before reinforcements arrive.','Destruye el núcleo de mando enemigo antes de que lleguen refuerzos.','Détruisez le noyau de commandement ennemi avant l’arrivée des renforts.'],
    ['Sichern. Halten. Extrahieren.','Sichern. Halten. Extrahieren.','Secure. Hold. Extract.','Asegura. Resiste. Extrae.','Sécuriser. Tenir. Extraire.'],
    ['Erreiche den östlichen Relaisknoten und schalte seine Eskorte aus.','Erreiche den östlichen Relaisknoten und schalte seine Eskorte aus.','Reach the eastern relay node and eliminate its escort.','Alcanza el nodo de enlace oriental y elimina su escolta.','Atteignez le relais oriental et éliminez son escorte.'],
    ['Katalog testen. Linie halten.','Katalog testen. Linie halten.','Test the catalog. Hold the line.','Prueba el catálogo. Mantén la línea.','Tester le catalogue. Tenir la ligne.'],
    ['Erprobe die neuen Einheiten gegen eine gemischte Verteidigung.','Erprobe die neuen Einheiten gegen eine gemischte Verteidigung.','Test the new units against a mixed defense.','Prueba las nuevas unidades contra una defensa mixta.','Testez les nouvelles unités contre une défense mixte.'],
    ['Regel-Prototyp: Schalte alle feindlichen Einheiten einschließlich Command Core aus.','Regel-Prototyp: Schalte alle feindlichen Einheiten einschließlich Command Core aus.','Rules prototype: eliminate every enemy unit, including the Command Core.','Prototipo de reglas: elimina todas las unidades enemigas, incluido el Núcleo de Mando.','Prototype des règles : éliminez toutes les unités ennemies, y compris le Noyau de commandement.'],
    ['Kommandokern zerstören; mindestens eine eigene Einheit erhalten.','Kommandokern zerstören; mindestens eine eigene Einheit erhalten.','Destroy the command core; keep at least one friendly unit alive.','Destruye el núcleo de mando y conserva al menos una unidad aliada.','Détruire le noyau de commandement ; garder au moins une unité alliée en vie.'],
    ['Relaisknoten und alle Feinde ausschalten; eigene Einheit erhalten.','Relaisknoten und alle Feinde ausschalten; eigene Einheit erhalten.','Eliminate the relay node and all enemies; keep a friendly unit alive.','Elimina el nodo de enlace y a todos los enemigos; conserva una unidad aliada.','Éliminer le relais et tous les ennemis ; garder une unité alliée en vie.'],
    ['Kommandozentrum und alle Feinde ausschalten; eigene Einheit erhalten.','Kommandozentrum und alle Feinde ausschalten; eigene Einheit erhalten.','Eliminate the command center and all enemies; keep a friendly unit alive.','Elimina el centro de mando y a todos los enemigos; conserva una unidad aliada.','Éliminer le centre de commandement et tous les ennemis ; garder une unité alliée en vie.'],
    ['Feindlichen Kern und alle Feinde ausschalten; eigene Einheit erhalten.','Feindlichen Kern und alle Feinde ausschalten; eigene Einheit erhalten.','Eliminate the enemy core and all enemies; keep a friendly unit alive.','Elimina el núcleo enemigo y a todos los enemigos; conserva una unidad aliada.','Éliminer le noyau ennemi et tous les ennemis ; garder une unité alliée en vie.'],
    ['G.O.B.L.I.N ist eine eigenständige, rundenbasierte Hexfeld-Taktikmission. Führe deine Einsatzgruppe durch unübersichtliches Gelände und schalte den feindlichen Kommandokern aus.','G.O.B.L.I.N ist eine eigenständige, rundenbasierte Hexfeld-Taktikmission. Führe deine Einsatzgruppe durch unübersichtliches Gelände und schalte den feindlichen Kommandokern aus.','G.O.B.L.I.N is an original turn-based hex tactics mission. Guide your force through difficult terrain and disable the enemy command core.','G.O.B.L.I.N es una misión táctica original por turnos en un mapa hexagonal. Guía a tus fuerzas por terreno difícil y neutraliza el núcleo de mando enemigo.','G.O.B.L.I.N est une mission tactique originale au tour par tour sur une carte hexagonale. Guidez vos forces sur un terrain difficile et neutralisez le noyau ennemi.'],
    ['1 · AUSWÄHLEN','1 · AUSWÄHLEN','1 · SELECT','1 · SELECCIONAR','1 · SÉLECTIONNER'],
    ['2 · BEWEGEN','2 · BEWEGEN','2 · MOVE','2 · MOVER','2 · DÉPLACER'],
    ['3 · FEUERN','3 · FEUERN','3 · FIRE','3 · DISPARAR','3 · TIRER'],
    ['4 · SKIMMER-PHASE','4 · SKIMMER-PHASE','4 · SKIMMER PHASE','4 · FASE DE DESLIZADORES','4 · PHASE DES AÉROGLISSEURS'],
    ['5 · GELÄNDE','5 · GELÄNDE','5 · TERRAIN','5 · TERRENO','5 · TERRAIN'],
    ['6 · PHASEN','6 · PHASEN','6 · PHASES','6 · FASES','6 · PHASES'],
    ['7 · KAMPFRESULTATE','7 · KAMPFRESULTATE','7 · COMBAT RESULTS','7 · RESULTADOS DE COMBATE','7 · RÉSULTATS DU COMBAT'],
    ['8 · TRANSPORT','8 · TRANSPORT','8 · TRANSPORT','8 · TRANSPORTE','8 · TRANSPORT'],
    ['9 · ZIEL','9 · ZIEL','9 · OBJECTIVE','9 · OBJETIVO','9 · OBJECTIF'],
    ['Klicke auf ein Feld oder eine Einheit. Bei einer Einheit werden Unit Intel, Feldinformationen und die verfügbaren Bereiche angezeigt.','Klicke auf ein Feld oder eine Einheit. Bei einer Einheit werden Unit Intel, Feldinformationen und die verfügbaren Bereiche angezeigt.','Click a cell or unit. Selecting a unit shows its intel, terrain details and available ranges.','Haz clic en una casilla o unidad. Al seleccionar una unidad verás sus datos, el terreno y los alcances disponibles.','Cliquez sur une case ou une unité. Une unité sélectionnée affiche ses infos, le terrain et les portées disponibles.'],
    ['hebt die Auswahl auf.','hebt die Auswahl auf.','clears the selection.','cancela la selección.','annule la sélection.'],
    ['Wähle eine eigene handlungsfähige Einheit und klicke ein grün markiertes Ziel. Gelände kostet zusätzliche Bewegung. Bereits bewegte Einheiten sind ausgegraut.','Wähle eine eigene handlungsfähige Einheit und klicke ein grün markiertes Ziel. Gelände kostet zusätzliche Bewegung. Bereits bewegte Einheiten sind ausgegraut.','Select a ready friendly unit and click a green destination. Terrain may cost extra movement. Units that have moved are dimmed.','Selecciona una unidad aliada disponible y haz clic en un destino verde. El terreno puede costar movimiento adicional. Las unidades que ya se movieron aparecen atenuadas.','Sélectionnez une unité alliée prête et cliquez sur une destination verte. Le terrain peut coûter des points de déplacement supplémentaires. Les unités déjà déplacées sont estompées.'],
    ['In der Fire Phase wählst du ein sichtbares Ziel im roten Bereich. Beim Siegebreaker wählst du zuvor unter der Karte ein noch verfügbares Waffensystem; dessen Reichweite bestimmt das Overlay. Die Feuerwahrscheinlichkeit folgt dem Verhältnis Angriff zu Verteidigung und kann NE, D oder X ergeben.','In der Fire Phase wählst du ein sichtbares Ziel im roten Bereich. Beim Siegebreaker wählst du zuvor unter der Karte ein noch verfügbares Waffensystem; dessen Reichweite bestimmt das Overlay. Die Feuerwahrscheinlichkeit folgt dem Verhältnis Angriff zu Verteidigung und kann NE, D oder X ergeben.','In the Fire Phase, select a visible target in the red area. For the Siegebreaker, first choose an available weapon below the map; its range sets the overlay. The odds depend on attack versus defense and can result in NE, D or X.','En la fase de fuego, selecciona un objetivo visible en la zona roja. Para el Siegebreaker, elige primero un arma disponible bajo el mapa; su alcance determina la zona. Las probabilidades dependen del ataque frente a la defensa y pueden dar NE, D o X.','Pendant la phase de tir, choisissez une cible visible dans la zone rouge. Pour le Siegebreaker, choisissez d’abord une arme disponible sous la carte ; sa portée détermine la zone. Les chances dépendent du rapport attaque/défense et peuvent donner NE, D ou X.'],
    ['greift das nächste gültige Ziel an.','greift das nächste gültige Ziel an.','attacks the nearest valid target.','ataca al objetivo válido más cercano.','attaque la cible valide la plus proche.'],
    ['Skimmer erhalten nach Bewegung und Feuer ein zusätzliches Manöver. Light Skimmer und Skimmer Carrier verwenden denselben Schwebefahrzeug-Modus.','Skimmer erhalten nach Bewegung und Feuer ein zusätzliches Manöver. Light Skimmer und Skimmer Carrier verwenden denselben Schwebefahrzeug-Modus.','Skimmers gain an extra maneuver after movement and fire. Light Skimmer and Skimmer Carrier use the same hovercraft mode.','Los deslizadores reciben una maniobra adicional tras moverse y disparar. Light Skimmer y Skimmer Carrier usan el mismo modo aerodeslizador.','Les aéroglisseurs gagnent une manœuvre supplémentaire après le déplacement et le tir. Light Skimmer et Skimmer Carrier utilisent le même mode.'],
    ['Wald, Berge, Stadt und Trümmer geben +1 Verteidigung und blockieren Sichtlinien dahinter; Krater geben Deckung ohne Sichtblock. Wasser und Flüsse sind nur für Skimmer und amphibische Infanterie passierbar. Die genauen Kosten zeigt','Wald, Berge, Stadt und Trümmer geben +1 Verteidigung und blockieren Sichtlinien dahinter; Krater geben Deckung ohne Sichtblock. Wasser und Flüsse sind nur für Skimmer und amphibische Infanterie passierbar. Die genauen Kosten zeigt','Forest, mountains, cities and rubble grant +1 defense and block sight beyond them; craters grant cover without blocking sight. Only skimmers and amphibious infantry can cross water and rivers. Exact costs appear in','Bosques, montañas, ciudades y escombros dan +1 de defensa y bloquean la visión detrás de ellos; los cráteres dan cobertura sin bloquearla. Solo los deslizadores y la infantería anfibia pueden cruzar agua y ríos. Los costes exactos aparecen en','Forêts, montagnes, villes et décombres donnent +1 en défense et bloquent la vue au-delà ; les cratères offrent un couvert sans bloquer la vue. Seuls les aéroglisseurs et l’infanterie amphibie traversent l’eau et les rivières. Les coûts exacts figurent dans'],
    ['Jede Runde besteht aus Movement, Fire, Skimmer Maneuver und dem automatischen Hostile Turn.','Jede Runde besteht aus Movement, Fire, Skimmer Maneuver und dem automatischen Hostile Turn.','Each turn includes Movement, Fire, Skimmer Maneuver and the automatic Hostile Turn.','Cada turno incluye movimiento, fuego, maniobra de deslizadores y el turno enemigo automático.','Chaque tour comprend le déplacement, le tir, la manœuvre des aéroglisseurs et le tour ennemi automatique.'],
    ['wechselt die Phase; offene Aktionen werden vorher bestätigt.','wechselt die Phase; offene Aktionen werden vorher bestätigt.','advances the phase; pending actions require confirmation.','avanza de fase; las acciones pendientes requieren confirmación.','passe à la phase suivante ; les actions en attente demandent confirmation.'],
    ['bedeutet kein Effekt.','bedeutet kein Effekt.','means no effect.','significa sin efecto.','signifie aucun effet.'],
    ['deaktiviert Fahrzeuge vorübergehend oder reduziert Infanterie.','deaktiviert Fahrzeuge vorübergehend oder reduziert Infanterie.','temporarily disables vehicles or reduces infantry.','inhabilita temporalmente vehículos o reduce la infantería.','neutralise temporairement les véhicules ou réduit l’infanterie.'],
    ['zerstört das Ziel. Wracks bleiben sichtbar. Der Strategic Missile Carrier besitzt genau eine Rakete: Ein sichtbares Feindziel anklicken; Nachbarhexen werden ebenfalls getroffen, auch eigene Einheiten.','zerstört das Ziel. Wracks bleiben sichtbar. Der Strategic Missile Carrier besitzt genau eine Rakete: Ein sichtbares Feindziel anklicken; Nachbarhexen werden ebenfalls getroffen, auch eigene Einheiten.','destroys the target. Wrecks remain visible. The Strategic Missile Carrier has one missile: click a visible enemy target. Adjacent hexes are also hit, including friendly units.','destruye el objetivo. Los restos permanecen visibles. El Strategic Missile Carrier tiene un solo misil: haz clic en un enemigo visible. También alcanza hexágonos adyacentes, incluso unidades aliadas.','détruit la cible. Les épaves restent visibles. Le Strategic Missile Carrier dispose d’un seul missile : cliquez sur une cible ennemie visible. Les hexagones voisins sont aussi touchés, même vos unités.'],
    ['Wähle Infanterie und klicke einen erreichbaren Skimmer Carrier oder nutze dessen','Wähle Infanterie und klicke einen erreichbaren Skimmer Carrier oder nutze dessen','Select infantry and click a reachable Skimmer Carrier, or use its','Selecciona infantería y haz clic en un Skimmer Carrier al alcance, o usa su','Sélectionnez l’infanterie et cliquez sur un Skimmer Carrier accessible, ou utilisez son'],
    ['Ein-/Aussteigen verbraucht die Infanteriebewegung. In der Fire Phase wählst du Passagiere in der Cargo-Leiste zum Feuern.','Ein-/Aussteigen verbraucht die Infanteriebewegung. In der Fire Phase wählst du Passagiere in der Cargo-Leiste zum Feuern.','Boarding or disembarking uses the infantry movement. In the Fire Phase, select passengers from the cargo bar to fire.','Embarcar o desembarcar consume el movimiento de infantería. En la fase de fuego, selecciona pasajeros en la barra de carga para disparar.','L’embarquement et le débarquement consomment le déplacement de l’infanterie. Pendant la phase de tir, sélectionnez les passagers dans la barre de transport pour tirer.'],
    ['. Ein-/Aussteigen verbraucht die Infanteriebewegung. In der Fire Phase wählst du Passagiere in der Cargo-Leiste zum Feuern.','. Ein-/Aussteigen verbraucht die Infanteriebewegung. In der Fire Phase wählst du Passagiere in der Cargo-Leiste zum Feuern.','. Boarding or disembarking uses the infantry movement. In the Fire Phase, select passengers from the cargo bar to fire.','. Embarcar o desembarcar consume el movimiento de infantería. En la fase de fuego, selecciona pasajeros en la barra de carga para disparar.','. L’embarquement et le débarquement consomment le déplacement de l’infanterie. Pendant la phase de tir, sélectionnez les passagers dans la barre de transport pour tirer.'],
    ['öffnet Laden oder Entladen.','öffnet Laden oder Entladen.','opens loading or unloading.','abre la carga o descarga.','ouvre le chargement ou le débarquement.'],
    ['IRON DUST verlangt den Command Core; in den anderen Szenarien müssen auch die verbliebenen Gegner ausgeschaltet werden. Nach Sieg oder Niederlage bleibt der Combat Log sichtbar;','IRON DUST verlangt den Command Core; in den anderen Szenarien müssen auch die verbliebenen Gegner ausgeschaltet werden. Nach Sieg oder Niederlage bleibt der Combat Log sichtbar;','IRON DUST requires the Command Core; other scenarios also require eliminating remaining enemies. The Combat Log stays visible after victory or defeat;','IRON DUST exige destruir el Command Core; en los demás escenarios también hay que eliminar a los enemigos restantes. El registro de combate sigue visible tras la victoria o derrota;','IRON DUST exige la destruction du Command Core ; les autres scénarios demandent aussi d’éliminer les ennemis restants. Le journal reste visible après la victoire ou la défaite ;'],
    ['beginnt die Mission neu.','beginnt die Mission neu.','starts the mission over.','reinicia la misión.','recommence la mission.'],
    ['TIPP · Der UNIT GUIDE zeigt Live-Werte und Aktionen und springt zur gewählten Einheit. ATLAS enthält alle zwölf Geländearten und 26 Einheitentypen.','TIPP · Der UNIT GUIDE zeigt Live-Werte und Aktionen und springt zur gewählten Einheit. ATLAS enthält alle zwölf Geländearten und 26 Einheitentypen.','TIP · UNIT GUIDE shows live values and actions and jumps to the selected unit. ATLAS includes all twelve terrain types and 26 unit types.','CONSEJO · La GUÍA DE UNIDADES muestra valores y acciones actuales y salta a la unidad seleccionada. ATLAS incluye los doce tipos de terreno y 26 tipos de unidades.','CONSEIL · Le GUIDE DES UNITÉS affiche les valeurs et actions en cours et rejoint l’unité choisie. ATLAS contient les douze terrains et 26 types d’unités.'],
    ['G.O.B.L.I.N · Lokaler Pfadvergleich','G.O.B.L.I.N · Lokaler Pfadvergleich','G.O.B.L.I.N · Local path comparison','G.O.B.L.I.N · Comparación de modos','G.O.B.L.I.N · Comparaison des parcours'],
    ['G.O.B.L.I.N · Architektur-Referenzpartie','G.O.B.L.I.N · Architektur-Referenzpartie','G.O.B.L.I.N · Architecture reference game','G.O.B.L.I.N · Partida de referencia','G.O.B.L.I.N · Partie de référence'],
    ['INTERNER SPIELPFAD · KEIN RELEASE','INTERNER SPIELPFAD · KEIN RELEASE','INTERNAL GAME PATH · NOT A RELEASE','MODO INTERNO · NO PUBLICADO','PARCOURS INTERNE · NON PUBLIÉ'],
    ['Core-Referenzpartie und bisheriges Spiel lokal vergleichen. Ein Wechsel startet den jeweiligen Pfad neu.','Core-Referenzpartie und bisheriges Spiel lokal vergleichen. Ein Wechsel startet den jeweiligen Pfad neu.','Compare the Core reference game and the previous game locally. Switching restarts the selected path.','Compara localmente la partida de referencia Core y el juego anterior. Cambiar de modo reinicia la partida elegida.','Comparez localement la partie de référence Core et le jeu précédent. Changer de parcours relance celui choisi.'],
    ['Spielpfad','Spielpfad','Game path','Modo de juego','Parcours de jeu'],
    ['Core-Referenzpartie','Core-Referenzpartie','Core reference game','Partida de referencia Core','Partie de référence Core'],
    ['Core-Phasenpartie','Core-Phasenpartie','Core phase game','Partida de fases Core','Partie à phases Core'],
    ['Terrain-Vorschau','Terrain-Vorschau','Terrain preview','Vista previa del terreno','Aperçu du terrain'],
    ['Bisheriges Spiel','Bisheriges Spiel','Previous game','Juego anterior','Jeu précédent'],
    ['Ausgewählter G.O.B.L.I.N-Spielpfad','Ausgewählter G.O.B.L.I.N-Spielpfad','Selected G.O.B.L.I.N game path','Modo de juego G.O.B.L.I.N seleccionado','Parcours G.O.B.L.I.N sélectionné'],
    ['ARCH-01 · REFERENZPARTIE','ARCH-01 · REFERENZPARTIE','ARCH-01 · REFERENCE GAME','ARCH-01 · PARTIDA DE REFERENCIA','ARCH-01 · PARTIE DE RÉFÉRENCE'],
    ['ARCH-02 · PHASENPARTIE','ARCH-02 · PHASENPARTIE','ARCH-02 · PHASE GAME','ARCH-02 · PARTIDA POR FASES','ARCH-02 · PARTIE À PHASES'],
    ['ARCH-03 · TERRAIN-VORSCHAU','ARCH-03 · TERRAIN-VORSCHAU','ARCH-03 · TERRAIN PREVIEW','ARCH-03 · VISTA DEL TERRENO','ARCH-03 · APERÇU DU TERRAIN'],
    ['Interner modularer Spielpfad mit Core-Zustand.','Interner modularer Spielpfad mit Core-Zustand.','Internal modular game path with Core state.','Modo modular interno con estado Core.','Parcours modulaire interne avec état Core.'],
    ['Einheiten','Einheiten','Units','Unidades','Unités'],
    ['Field / Unit Intel','Feld- / Einheiteninfo','Field / Unit Intel','Datos de terreno / unidad','Infos terrain / unité'],
    ['Nächste Phase →','Nächste Phase →','Next phase →','Siguiente fase →','Phase suivante →'],
    ['Gebietsansicht','Gebietsansicht','Area view','Vista de zonas','Vue des zones'],
    ['Movement','Bewegung','Movement','Movimiento','Déplacement'],
    ['Fire','Feuer','Fire','Fuego','Tir'],
    ['Stilset','Stilset','Style set','Conjunto de estilos','Jeu de styles'],
    ['Hexraster','Hexraster','Hex grid','Cuadrícula hexagonal','Grille hexagonale'],
    ['Referenz-Schlachtfeld','Referenz-Schlachtfeld','Reference battlefield','Campo de batalla de referencia','Champ de bataille de référence'],
    ['Zusammenhängende Terrainkarte','Zusammenhängende Terrainkarte','Continuous terrain map','Mapa de terreno continuo','Carte continue du terrain'],
    ['Ereignisse','Ereignisse','Events','Eventos','Événements'],
    ['Gleiche Core-v1-Partie, zwei Materialsets. Stilset und Hexraster ändern nur die Ansicht. Einheit oder Feld auf der Karte wählen.','Gleiche Core-v1-Partie, zwei Materialsets. Stilset und Hexraster ändern nur die Ansicht. Einheit oder Feld auf der Karte wählen.','Same Core v1 game, two material sets. Style set and hex grid change only the view. Select a unit or cell on the map.','La misma partida Core v1 con dos conjuntos de materiales. El estilo y la cuadrícula solo cambian la vista. Selecciona una unidad o casilla.','Même partie Core v1, deux jeux de matériaux. Le style et la grille ne changent que l’affichage. Sélectionnez une unité ou une case.'],
    ['Beide Teams werden von Hand gesteuert. Skimmer wählen → bewegen → Fire Phase → GEV Phase → erneut bewegen. Das deaktivierte Fahrzeug erholt sich zu seinem festgelegten Teamstart.','Beide Teams werden von Hand gesteuert. Skimmer wählen → bewegen → Fire Phase → GEV Phase → erneut bewegen. Das deaktivierte Fahrzeug erholt sich zu seinem festgelegten Teamstart.','Both teams are controlled manually. Select a skimmer → move → Fire Phase → GEV Phase → move again. The disabled vehicle recovers at its scheduled team start.','Ambos equipos se controlan manualmente. Selecciona un deslizador → muévelo → fase de fuego → fase GEV → vuelve a moverlo. El vehículo inhabilitado se recupera al inicio programado de su equipo.','Les deux équipes sont contrôlées manuellement. Choisissez un aéroglisseur → déplacez-le → phase de tir → phase GEV → déplacez-le à nouveau. Le véhicule neutralisé récupère au début prévu de son équipe.'],
    ['Einheit wählen → erreichbares Feld anklicken → Phase wechseln → Ziel anklicken.','Einheit wählen → erreichbares Feld anklicken → Phase wechseln → Ziel anklicken.','Select unit → click reachable cell → advance phase → click target.','Selecciona unidad → haz clic en una casilla alcanzable → cambia de fase → haz clic en el objetivo.','Sélectionnez une unité → cliquez sur une case accessible → changez de phase → cliquez sur la cible.'],
    ['bereit','bereit','ready','lista','prête'],
    ['Aktion verbraucht','Aktion verbraucht','action spent','acción consumida','action utilisée'],
    ['keine Aktion in dieser Phase','keine Aktion in dieser Phase','no action this phase','sin acción en esta fase','aucune action durant cette phase'],
    ['zerstört','zerstört','destroyed','destruida','détruite'],
    ['Feld oder Einheit anklicken.','Feld oder Einheit anklicken.','Click a cell or unit.','Haz clic en una casilla o unidad.','Cliquez sur une case ou une unité.'],
    ['Keine Einheit gewählt','Keine Einheit gewählt','No unit selected','Ninguna unidad seleccionada','Aucune unité sélectionnée'],
    ['OFFENES GELÄNDE','OFFENES GELÄNDE','OPEN GROUND','TERRENO ABIERTO','TERRAIN DÉGAGÉ'],
    ['TRÜMMERFELD','TRÜMMERFELD','RUBBLE FIELD','CAMPO DE ESCOMBROS','CHAMP DE DÉCOMBRES'],
    ['BERG','BERG','MOUNTAIN','MONTAÑA','MONTAGNE'],
    ['HÖHENRÜCKEN','HÖHENRÜCKEN','RIDGE','CRESTA','CRÊTE'],
    ['WALD','WALD','FOREST','BOSQUE','FORÊT'],
    ['SUMPF','SUMPF','MARSH','PANTANO','MARAIS'],
    ['WASSER','WASSER','WATER','AGUA','EAU'],
    ['FLUSS','FLUSS','RIVER','RÍO','RIVIÈRE'],
    ['STRASSE','STRASSE','ROAD','CARRETERA','ROUTE'],
    ['BRÜCKE','BRÜCKE','BRIDGE','PUENTE','PONT'],
    ['STADTGEBIET','STADTGEBIET','URBAN AREA','ZONA URBANA','ZONE URBAINE'],
    ['KRATER','KRATER','CRATER','CRÁTER','CRATÈRE'],
    ['Normale Bewegung; keine Deckung.','Normale Bewegung; keine Deckung.','Normal movement; no cover.','Movimiento normal; sin cobertura.','Déplacement normal ; aucun couvert.'],
    ['Schwer passierbar, Deckung +1; blockiert Sichtlinien dahinter.','Schwer passierbar, Deckung +1; blockiert Sichtlinien dahinter.','Difficult terrain, +1 cover; blocks sight beyond it.','Terreno difícil, +1 de cobertura; bloquea la visión detrás.','Terrain difficile, couvert +1 ; bloque la vue au-delà.'],
    ['Passierbar mit Kosten 2, Deckung +1; blockiert Sichtlinien dahinter.','Passierbar mit Kosten 2, Deckung +1; blockiert Sichtlinien dahinter.','Passable at cost 2, +1 cover; blocks sight beyond it.','Transitable con coste 2, +1 de cobertura; bloquea la visión detrás.','Franchissable au coût de 2, couvert +1 ; bloque la vue au-delà.'],
    ['Verlangsamt alle beweglichen Einheiten; Deckung +1 und Sichtblocker.','Verlangsamt alle beweglichen Einheiten; Deckung +1 und Sichtblocker.','Slows all mobile units; +1 cover and blocks sight.','Ralentiza a todas las unidades móviles; +1 de cobertura y bloquea la visión.','Ralentit toutes les unités mobiles ; couvert +1 et bloque la vue.'],
    ['Kettenfahrzeuge und Infanterie zahlen 2; Skimmer gleiten für 1 darüber.','Kettenfahrzeuge und Infanterie zahlen 2; Skimmer gleiten für 1 darüber.','Tracked vehicles and infantry pay 2; skimmers cross for 1.','Los vehículos de orugas y la infantería pagan 2; los deslizadores cruzan por 1.','Les véhicules à chenilles et l’infanterie paient 2 ; les aéroglisseurs passent pour 1.'],
    ['Nur Skimmer und amphibische Infanterie können das Feld betreten.','Nur Skimmer und amphibische Infanterie können das Feld betreten.','Only skimmers and amphibious infantry can enter this cell.','Solo los deslizadores y la infantería anfibia pueden entrar en esta casilla.','Seuls les aéroglisseurs et l’infanterie amphibie peuvent entrer sur cette case.'],
    ['Nur Skimmer und amphibische Infanterie können den Fluss betreten.','Nur Skimmer und amphibische Infanterie können den Fluss betreten.','Only skimmers and amphibious infantry can enter the river.','Solo los deslizadores y la infantería anfibia pueden entrar en el río.','Seuls les aéroglisseurs et l’infanterie amphibie peuvent entrer dans la rivière.'],
    ['Übergang für alle beweglichen Einheiten; keine Deckung.','Übergang für alle beweglichen Einheiten; keine Deckung.','Crossing for all mobile units; no cover.','Paso para todas las unidades móviles; sin cobertura.','Passage pour toutes les unités mobiles ; aucun couvert.'],
    ['Bewegungskosten 2, Deckung +1 und Sichtblocker.','Bewegungskosten 2, Deckung +1 und Sichtblocker.','Movement cost 2, +1 cover and blocks sight.','Coste de movimiento 2, +1 de cobertura y bloquea la visión.','Coût de déplacement 2, couvert +1 et bloque la vue.'],
    ['Deckung +1; Kosten 2 am Boden, 1 für Skimmer. Freie Sicht darüber.','Deckung +1; Kosten 2 am Boden, 1 für Skimmer. Freie Sicht darüber.','+1 cover; cost 2 on the ground, 1 for skimmers. Sight passes over it.','+1 de cobertura; coste 2 en tierra, 1 para deslizadores. No bloquea la visión.','Couvert +1 ; coût de 2 au sol, 1 pour les aéroglisseurs. Ne bloque pas la vue.'],
    ['Dieses Feld liegt hinter einem Sichtblocker.','Dieses Feld liegt hinter einem Sichtblocker.','This cell is behind a sight blocker.','Esta casilla está detrás de un obstáculo visual.','Cette case se trouve derrière un obstacle à la vue.'],
    ['Autonome Belagerungsplattform mit getrennt verwalteten Batterien, Lenkflugkörpern, Nahbereichsschutz und Kettensegmenten. Kettenschäden reduzieren die Bewegung stufenweise.','Autonome Belagerungsplattform mit getrennt verwalteten Batterien, Lenkflugkörpern, Nahbereichsschutz und Kettensegmenten. Kettenschäden reduzieren die Bewegung stufenweise.','Autonomous siege platform with separate batteries, guided missiles, close defense and track segments. Track damage reduces movement in stages.','Plataforma de asedio autónoma con baterías, misiles guiados, defensa cercana y segmentos de oruga independientes. El daño en las orugas reduce el movimiento por etapas.','Plateforme de siège autonome avec batteries, missiles guidés, défense rapprochée et segments de chenilles distincts. Les dégâts aux chenilles réduisent progressivement la mobilité.'],
    ['Schnelles Aufklärungsfahrzeug für Flankenmanöver. Sein zusätzlicher Manöverschritt macht es beweglich, verlangt aber eine vorausschauende Positionierung.','Schnelles Aufklärungsfahrzeug für Flankenmanöver. Sein zusätzlicher Manöverschritt macht es beweglich, verlangt aber eine vorausschauende Positionierung.','Fast scout vehicle for flanking. Its extra maneuver adds mobility but requires careful positioning.','Vehículo de reconocimiento rápido para flanquear. Su maniobra adicional mejora la movilidad, pero exige planificar la posición.','Véhicule de reconnaissance rapide pour les flancs. Sa manœuvre supplémentaire accroît sa mobilité mais exige de bien se placer.'],
    ['Leicht gepanzerte Raketenartillerie mit hoher Reichweite. Sie wirkt am besten hinter der Front und ist im Nahkampf verwundbar.','Leicht gepanzerte Raketenartillerie mit hoher Reichweite. Sie wirkt am besten hinter der Front und ist im Nahkampf verwundbar.','Lightly armored long-range rocket artillery. Best used behind the front line; vulnerable at close range.','Artillería de cohetes de largo alcance y blindaje ligero. Rinde mejor detrás del frente y es vulnerable de cerca.','Artillerie à roquettes de longue portée et faiblement blindée. Elle excelle derrière le front et reste vulnérable de près.'],
    ['Infanterie wird in einzelnen Trupps gezählt. Bis zu drei Trupps können für Angriff und Verteidigung zusammenwirken.','Infanterie wird in einzelnen Trupps gezählt. Bis zu drei Trupps können für Angriff und Verteidigung zusammenwirken.','Infantry is counted in squads. Up to three squads can combine for attack and defense.','La infantería se cuenta por escuadras. Hasta tres escuadras pueden combinarse para atacar y defender.','L’infanterie se compte par escouades. Jusqu’à trois escouades peuvent se regrouper pour attaquer et se défendre.'],
    ['Robustes Kettenfahrzeug für den direkten Schlagabtausch und das Halten wichtiger Korridore.','Robustes Kettenfahrzeug für den direkten Schlagabtausch und das Halten wichtiger Korridore.','Sturdy tracked vehicle for direct combat and holding key corridors.','Vehículo de orugas robusto para el combate directo y la defensa de corredores clave.','Véhicule à chenilles robuste pour le combat direct et la tenue de couloirs clés.'],
    ['Schneller und leichter Spähpanzer für Vorstöße, Flankenschutz und das Besetzen freier Räume.','Schneller und leichter Spähpanzer für Vorstöße, Flankenschutz und das Besetzen freier Räume.','Fast, light scout tank for advances, flank cover and occupying open ground.','Tanque de reconocimiento rápido y ligero para avanzar, proteger flancos y ocupar espacios libres.','Char de reconnaissance rapide et léger pour avancer, couvrir les flancs et occuper le terrain libre.'],
    ['Schwerer Jagdpanzer mit zwei getrennt einsetzbaren Geschützen und zusätzlichem Nahbereichsschutz.','Schwerer Jagdpanzer mit zwei getrennt einsetzbaren Geschützen und zusätzlichem Nahbereichsschutz.','Heavy tank destroyer with two independently operated guns and extra close defense.','Cazacarros pesado con dos cañones independientes y defensa cercana adicional.','Chasseur de chars lourd avec deux canons indépendants et une défense rapprochée supplémentaire.'],
    ['Stationäre Fernunterstützung mit großer Reichweite. Ohne Transport bleibt sie an ihre Ausgangsstellung gebunden.','Stationäre Fernunterstützung mit großer Reichweite. Ohne Transport bleibt sie an ihre Ausgangsstellung gebunden.','Long-range fixed support. Without transport it remains at its starting position.','Apoyo fijo de largo alcance. Sin transporte permanece en su posición inicial.','Appui fixe à longue portée. Sans transport, il reste à sa position initiale.'],
    ['Langsame mobile Artillerie für Stellungswechsel zwischen Feueraufträgen.','Langsame mobile Artillerie für Stellungswechsel zwischen Feueraufträgen.','Slow mobile artillery that can reposition between fire missions.','Artillería móvil lenta que puede cambiar de posición entre misiones de fuego.','Artillerie mobile lente pouvant changer de position entre les missions de tir.'],
    ['Schwebefahrzeug mit einem zusätzlichen Manöverschritt. Seine Stärke liegt in schnellen Richtungswechseln.','Schwebefahrzeug mit einem zusätzlichen Manöverschritt. Seine Stärke liegt in schnellen Richtungswechseln.','Hovercraft with an extra maneuver. Its strength is changing direction quickly.','Aerodeslizador con una maniobra adicional. Destaca por cambiar de dirección rápidamente.','Aéroglisseur doté d’une manœuvre supplémentaire. Il excelle dans les changements rapides de direction.'],
    ['Sehr schnelles, leicht bewaffnetes Schwebefahrzeug für Aufklärung und Störangriffe.','Sehr schnelles, leicht bewaffnetes Schwebefahrzeug für Aufklärung und Störangriffe.','Very fast, lightly armed hovercraft for scouting and harassment.','Aerodeslizador muy rápido y poco armado para reconocimiento y hostigamiento.','Aéroglisseur très rapide et légèrement armé pour la reconnaissance et le harcèlement.'],
    ['Transportiert bis zu drei Infanterietrupps und folgt den Manöverregeln der Schwebefahrzeuge.','Transportiert bis zu drei Infanterietrupps und folgt den Manöverregeln der Schwebefahrzeuge.','Carries up to three infantry squads and follows hovercraft maneuver rules.','Transporta hasta tres escuadras de infantería y sigue las reglas de maniobra de los aerodeslizadores.','Transporte jusqu’à trois escouades d’infanterie et suit les règles de manœuvre des aéroglisseurs.'],
    ['Mobiler Träger mit einem Lenkflugkörper. In der Feuerphase ein sichtbares Feindziel innerhalb von acht Hexfeldern wählen: Angriff 6 auf das Ziel, Angriff 3 auf Einheiten in benachbarten Hexen – auch eigene. Nach dem Start ist die Munition verbraucht.','Mobiler Träger mit einem Lenkflugkörper. In der Feuerphase ein sichtbares Feindziel innerhalb von acht Hexfeldern wählen: Angriff 6 auf das Ziel, Angriff 3 auf Einheiten in benachbarten Hexen – auch eigene. Nach dem Start ist die Munition verbraucht.','Mobile carrier with one guided missile. In the Fire Phase, choose a visible enemy within eight hexes: attack 6 on the target and attack 3 on units in adjacent hexes, including friendlies. The missile is spent after launch.','Plataforma móvil con un misil guiado. En la fase de fuego, elige un enemigo visible a ocho hexágonos o menos: ataque 6 al objetivo y ataque 3 a unidades adyacentes, incluso aliadas. El misil se agota al lanzarlo.','Lanceur mobile doté d’un seul missile guidé. Pendant la phase de tir, choisissez un ennemi visible à huit hexagones au plus : attaque 6 sur la cible et attaque 3 sur les unités voisines, même alliées. Le missile est consommé après le tir.'],
    ['Unbemannte leichte Artillerie ohne Eigenbewegung. Für eine Verlegung benötigt sie einen Transporter.','Unbemannte leichte Artillerie ohne Eigenbewegung. Für eine Verlegung benötigt sie einen Transporter.','Uncrewed light artillery with no movement of its own. It needs transport to relocate.','Artillería ligera no tripulada sin movimiento propio. Necesita transporte para reubicarse.','Artillerie légère sans équipage ni mouvement propre. Elle nécessite un transport pour changer de position.'],
    ['Spezialisierte Infanterie für Gewässer, Uferzonen und Nahbereichsoperationen.','Spezialisierte Infanterie für Gewässer, Uferzonen und Nahbereichsoperationen.','Specialized infantry for water, riverbanks and close-range operations.','Infantería especializada en agua, riberas y operaciones a corta distancia.','Infanterie spécialisée dans l’eau, les rives et les opérations rapprochées.'],
    ['Unterstützungstrupps für Übergänge, Hindernisse und Feldstellungen. Erweiterte Bauaktionen folgen in einer späteren Ausbaustufe.','Unterstützungstrupps für Übergänge, Hindernisse und Feldstellungen. Erweiterte Bauaktionen folgen in einer späteren Ausbaustufe.','Support squads for crossings, obstacles and field positions. Advanced construction actions are planned for a later stage.','Escuadras de apoyo para pasos, obstáculos y posiciones de campaña. Las acciones de construcción avanzadas llegarán más adelante.','Escouades de soutien pour les passages, obstacles et positions de campagne. Des actions de construction avancées sont prévues ultérieurement.'],
    ['Leicht ausgerüstete lokale Kräfte für Sicherungsaufgaben und die Verteidigung von Missionszielen.','Leicht ausgerüstete lokale Kräfte für Sicherungsaufgaben und die Verteidigung von Missionszielen.','Lightly equipped local forces for security and defending mission objectives.','Fuerzas locales con equipo ligero para seguridad y defensa de objetivos.','Forces locales légèrement équipées pour sécuriser et défendre les objectifs.'],
    ['Stationäres Führungsziel. Kommandozentren und Relaisknoten bilden zentrale Szenarioziele.','Stationäres Führungsziel. Kommandozentren und Relaisknoten bilden zentrale Szenarioziele.','Fixed command objective. Command centers and relay nodes are key scenario targets.','Objetivo de mando fijo. Los centros de mando y nodos de enlace son objetivos clave.','Objectif de commandement fixe. Les centres de commandement et relais sont des cibles essentielles.'],
    ['Schwere gegnerische Plattform. Im ATLAS-Teststand noch als einzelnes Fahrzeug modelliert; getrennte Systemschäden folgen später.','Schwere gegnerische Plattform. Im ATLAS-Teststand noch als einzelnes Fahrzeug modelliert; getrennte Systemschäden folgen später.','Heavy enemy platform. In the ATLAS prototype it is still a single vehicle; separate system damage is planned.','Plataforma enemiga pesada. En el prototipo ATLAS aún es un solo vehículo; el daño por sistemas llegará más adelante.','Plateforme ennemie lourde. Dans le prototype ATLAS, elle reste un seul véhicule ; les dégâts par système sont prévus plus tard.'],
    ['Mobile Plattform. Ein eigener Tarnmechanismus ist noch nicht implementiert.','Mobile Plattform. Ein eigener Tarnmechanismus ist noch nicht implementiert.','Mobile platform. Its own stealth mechanic is not implemented yet.','Plataforma móvil. Su mecánica de camuflaje aún no está implementada.','Plateforme mobile. Sa mécanique de furtivité n’est pas encore implémentée.'],
    ['Gegnerische Infanterie. Ein D-Treffer reduziert ihre Stärke statt sie vorübergehend zu deaktivieren.','Gegnerische Infanterie. Ein D-Treffer reduziert ihre Stärke statt sie vorübergehend zu deaktivieren.','Enemy infantry. A D result reduces its strength instead of disabling it temporarily.','Infantería enemiga. Un resultado D reduce su fuerza en vez de inhabilitarla temporalmente.','Infanterie ennemie. Un résultat D réduit sa force au lieu de la neutraliser temporairement.'],
    ['Stationäres Missionsziel. Im ATLAS-Szenario müssen zusätzlich die übrigen Gegner ausgeschaltet werden.','Stationäres Missionsziel. Im ATLAS-Szenario müssen zusätzlich die übrigen Gegner ausgeschaltet werden.','Fixed mission objective. The ATLAS scenario also requires eliminating the remaining enemies.','Objetivo de misión fijo. El escenario ATLAS también exige eliminar a los enemigos restantes.','Objectif de mission fixe. Le scénario ATLAS demande aussi d’éliminer les ennemis restants.'],
    ['Stationärer Relaisknoten. Missionsziele und Siegbedingungen unterscheiden sich je nach Szenario.','Stationärer Relaisknoten. Missionsziele und Siegbedingungen unterscheiden sich je nach Szenario.','Fixed relay node. Objectives and victory conditions vary by scenario.','Nodo de enlace fijo. Los objetivos y condiciones de victoria varían según el escenario.','Relais fixe. Les objectifs et conditions de victoire varient selon le scénario.'],
    ['Gegnerischer Sicherungspanzer. Die KI feuert auf erreichbare Ziele und rückt sonst vor.','Gegnerischer Sicherungspanzer. Die KI feuert auf erreichbare Ziele und rückt sonst vor.','Enemy guard tank. Its AI fires at reachable targets and advances otherwise.','Tanque de guardia enemigo. Su IA dispara a objetivos al alcance y, si no los hay, avanza.','Char de garde ennemi. Son IA tire sur les cibles à portée et avance sinon.'],
    ['Gegnerischer Skimmer. Kann Wasser und Flüsse überqueren; die eigenständige KI nutzt derzeit keine zusätzliche Skimmer-Phase.','Gegnerischer Skimmer. Kann Wasser und Flüsse überqueren; die eigenständige KI nutzt derzeit keine zusätzliche Skimmer-Phase.','Enemy skimmer. Can cross water and rivers; its AI does not currently use an extra skimmer phase.','Deslizador enemigo. Puede cruzar agua y ríos; su IA aún no usa una fase adicional de deslizadores.','Aéroglisseur ennemi. Il traverse l’eau et les rivières ; son IA n’utilise pas encore de phase supplémentaire.'],
    ['Autonome Reparatur- und Bergeplattform. Im ATLAS-Teststand noch als normales Fahrzeug spielbar; Reparatur, Bergung und Drohnen folgen später.','Autonome Reparatur- und Bergeplattform. Im ATLAS-Teststand noch als normales Fahrzeug spielbar; Reparatur, Bergung und Drohnen folgen später.','Autonomous repair and recovery platform. In ATLAS it plays as a normal vehicle; repair, recovery and drones are planned.','Plataforma autónoma de reparación y recuperación. En ATLAS funciona como vehículo normal; la reparación, recuperación y drones llegarán después.','Plateforme autonome de réparation et de récupération. Dans ATLAS, elle se joue comme un véhicule normal ; réparation, récupération et drones viendront plus tard.'],
    ['AUTONOMOUS ASSAULT FORTRESS','AUTONOME ANGRIFFSFESTUNG','AUTONOMOUS ASSAULT FORTRESS','FORTALEZA DE ASALTO AUTÓNOMA','FORTERESSE D’ASSAUT AUTONOME'],
    ['HOVER RECON · PROTOTYPE','SCHWEBESPÄHER · PROTOTYP','HOVER RECON · PROTOTYPE','RECONOCIMIENTO AÉREO · PROTOTIPO','RECONNAISSANCE AÉROGLISSEUR · PROTOTYPE'],
    ['TRACKED ROCKET LAUNCHER','RAKETENWERFER AUF KETTEN','TRACKED ROCKET LAUNCHER','LANZACOHETES DE ORUGAS','LANCE-ROQUETTES À CHENILLES'],
    ['BATTLESUIT INFANTRY','KAMPFANZUG-INFANTERIE','BATTLESUIT INFANTRY','INFANTERÍA CON EXOTRAJES','INFANTERIE EN COMBINAISON DE COMBAT'],
    ['FRONTLINE ARMOR','FRONTPANZER','FRONTLINE ARMOR','BLINDADO DE PRIMERA LÍNEA','BLINDÉ DE PREMIÈRE LIGNE'],
    ['SCOUT ARMOR','SPÄHPANZER','SCOUT ARMOR','BLINDADO EXPLORADOR','BLINDÉ DE RECONNAISSANCE'],
    ['TWIN-GUN TANK DESTROYER','JAGDPANZER MIT ZWEI GESCHÜTZEN','TWIN-GUN TANK DESTROYER','CAZACARROS DE DOS CAÑONES','CHASSEUR DE CHARS À DEUX CANONS'],
    ['FIXED ROCKET ARTILLERY','STATIONÄRE RAKETENARTILLERIE','FIXED ROCKET ARTILLERY','ARTILLERÍA FIJA DE COHETES','ARTILLERIE À ROQUETTES FIXE'],
    ['MOBILE ARTILLERY','MOBILE ARTILLERIE','MOBILE ARTILLERY','ARTILLERÍA MÓVIL','ARTILLERIE MOBILE'],
    ['HOVERCRAFT','SCHWEBEFAHRZEUG','HOVERCRAFT','AERODESLIZADOR','AÉROGLISSEUR'],
    ['LIGHT HOVERCRAFT','LEICHTES SCHWEBEFAHRZEUG','LIGHT HOVERCRAFT','AERODESLIZADOR LIGERO','AÉROGLISSEUR LÉGER'],
    ['PERSONNEL CARRIER','MANNSCHAFTSTRANSPORTER','PERSONNEL CARRIER','TRANSPORTE DE PERSONAL','TRANSPORT DE TROUPES'],
    ['ONE-SHOT MISSILE PLATFORM','EINWEG-RAKETENPLATTFORM','ONE-SHOT MISSILE PLATFORM','PLATAFORMA DE UN SOLO MISIL','PLATEFORME À MISSILE UNIQUE'],
    ['AUTONOMOUS ARTILLERY','AUTONOME ARTILLERIE','AUTONOMOUS ARTILLERY','ARTILLERÍA AUTÓNOMA','ARTILLERIE AUTONOME'],
    ['RIVER ASSAULT TROOPS','FLUSSANGRIFFSTRUPPEN','RIVER ASSAULT TROOPS','TROPAS DE ASALTO FLUVIAL','TROUPES D’ASSAUT FLUVIAL'],
    ['COMBAT ENGINEERING','KAMPFPIONIERE','COMBAT ENGINEERING','INGENIERÍA DE COMBATE','GÉNIE DE COMBAT'],
    ['RESERVE INFANTRY','RESERVEINFANTERIE','RESERVE INFANTRY','INFANTERÍA DE RESERVA','INFANTERIE DE RÉSERVE'],
    ['FIXED COMMAND UNIT','STATIONÄRE KOMMANDOEINHEIT','FIXED COMMAND UNIT','UNIDAD DE MANDO FIJA','UNITÉ DE COMMANDEMENT FIXE'],
    ['HEAVY ASSAULT PLATFORM','SCHWERE ANGRIFFSPLATTFORM','HEAVY ASSAULT PLATFORM','PLATAFORMA DE ASALTO PESADA','PLATEFORME D’ASSAUT LOURDE'],
    ['MOBILE PLATFORM','MOBILE PLATTFORM','MOBILE PLATFORM','PLATAFORMA MÓVIL','PLATEFORME MOBILE'],
    ['MOBILE INFANTRY','MOBILE INFANTERIE','MOBILE INFANTRY','INFANTERÍA MÓVIL','INFANTERIE MOBILE'],
    ['FORTIFIED OBJECTIVE','BEFESTIGTES ZIEL','FORTIFIED OBJECTIVE','OBJETIVO FORTIFICADO','OBJECTIF FORTIFIÉ'],
    ['HOSTILE ARMOR','FEINDPANZER','HOSTILE ARMOR','BLINDADO ENEMIGO','BLINDÉ ENNEMI'],
    ['HOSTILE HOVERCRAFT','FEINDLICHES SCHWEBEFAHRZEUG','HOSTILE HOVERCRAFT','AERODESLIZADOR ENEMIGO','AÉROGLISSEUR ENNEMI'],
    ['ENGINEERING FORTRESS','PIONIERFESTUNG','ENGINEERING FORTRESS','FORTALEZA DE INGENIERÍA','FORTERESSE DU GÉNIE'],
    ['CORE SYSTEM','KERNSYSTEM','CORE SYSTEM','SISTEMA CENTRAL','SYSTÈME CENTRAL'],
    ['EXPEDITIONARY','EXPEDITIONSTRUPPE','EXPEDITIONARY','EXPEDICIONARIO','EXPÉDITIONNAIRE'],
    ['FRONTIER','GRENZTRUPPE','FRONTIER','FRONTERA','FRONTIÈRE'],
    ['SUPPORT','UNTERSTÜTZUNG','SUPPORT','APOYO','SOUTIEN'],
    ['HOSTILE SYSTEM','FEINDSYSTEM','HOSTILE SYSTEM','SISTEMA ENEMIGO','SYSTÈME ENNEMI'],
    ['FRIENDLY · LIVE','EIGEN · AKTIV','FRIENDLY · LIVE','ALIADO · ACTIVO','ALLIÉ · ACTIF'],
    ['HOSTILE · LIVE','FEIND · AKTIV','HOSTILE · LIVE','ENEMIGO · ACTIVO','ENNEMI · ACTIF'],
    ['Bewegen','Bewegen','Move','Mover','Déplacer'],
    ['Feuern','Feuern','Fire','Disparar','Tirer'],
    ['Bewegen und feuern','Bewegen und feuern','Move and fire','Mover y disparar','Se déplacer et tirer'],
    ['Auf sichtbare Ziele feuern','Auf sichtbare Ziele feuern','Fire at visible targets','Disparar a objetivos visibles','Tirer sur les cibles visibles'],
    ['Bewegen und gegnerische Fahrzeuge rammen','Bewegen und gegnerische Fahrzeuge rammen','Move and ram enemy vehicles','Mover y embestir vehículos enemigos','Se déplacer et percuter les véhicules ennemis'],
    ['Waffensystem wählen; intakte Batterien separat abfeuern','Waffensystem wählen; intakte Batterien separat abfeuern','Select weapon; fire intact batteries separately','Elegir arma; disparar las baterías intactas por separado','Choisir une arme ; tirer séparément avec les batteries intactes'],
    ['Ketten- und Systemschäden verwalten','Ketten- und Systemschäden verwalten','Manage track and system damage','Gestionar daños de orugas y sistemas','Gérer les dégâts aux chenilles et aux systèmes'],
    ['Zusätzliches Skimmer-Manöver nach der Feuerphase','Zusätzliches Skimmer-Manöver nach der Feuerphase','Extra skimmer maneuver after the Fire Phase','Maniobra adicional tras la fase de fuego','Manœuvre supplémentaire après la phase de tir'],
    ['Als Passagier ein- und aussteigen; vom Transporter feuern','Als Passagier ein- und aussteigen; vom Transporter feuern','Board and disembark as passenger; fire from transport','Embarcar y desembarcar; disparar desde el transporte','Embarquer et débarquer ; tirer depuis le transport'],
    ['Bewegen und feuern','Bewegen und feuern','Move and fire','Mover y disparar','Se déplacer et tirer'],
    ['Geteiltes Feuer: geplant, derzeit ein Angriff','Geteiltes Feuer: geplant, derzeit ein Angriff','Split fire planned; currently one attack','Fuego dividido previsto; actualmente un ataque','Tir réparti prévu ; actuellement une attaque'],
    ['Fernfeuer; keine Eigenbewegung','Fernfeuer; keine Eigenbewegung','Long-range fire; cannot move independently','Fuego de largo alcance; sin movimiento propio','Tir à longue portée ; aucun déplacement autonome'],
    ['Transportverlegung: geplant','Transportverlegung: geplant','Transport relocation planned','Traslado por transporte previsto','Déplacement par transport prévu'],
    ['Langsam bewegen','Langsam bewegen','Move slowly','Mover lentamente','Se déplacer lentement'],
    ['Fernfeuer','Fernfeuer','Long-range fire','Fuego de largo alcance','Tir à longue portée'],
    ['Zusätzliches Skimmer-Manöver','Zusätzliches Skimmer-Manöver','Extra skimmer maneuver','Maniobra adicional de deslizador','Manœuvre supplémentaire d’aéroglisseur'],
    ['Bewegen, feuern und Skimmer-Manöver','Bewegen, feuern und Skimmer-Manöver','Move, fire and skimmer maneuver','Mover, disparar y maniobrar','Se déplacer, tirer et manœuvrer'],
    ['Infanterie per Karte laden/entladen; Fracht in der Leiste wählen','Infanterie per Karte laden/entladen; Fracht in der Leiste wählen','Load or unload infantry on the map; select cargo in the bar','Cargar o descargar infantería en el mapa; elegir carga en la barra','Embarquer ou débarquer l’infanterie sur la carte ; choisir la cargaison dans la barre'],
    ['Einmaliger Lenkflugkörper mit Flächenschaden; auch Friendly Fire','Einmaliger Lenkflugkörper mit Flächenschaden; auch Friendly Fire','One guided missile with blast damage; friendly fire possible','Un misil guiado con daño de área; puede afectar a aliados','Un missile guidé à dégâts de zone ; peut toucher les alliés'],
    ['Wasser und Flüsse betreten','Wasser und Flüsse betreten','Enter water and rivers','Entrar en agua y ríos','Entrer dans l’eau et les rivières'],
    ['Bewegen, feuern und transportieren','Bewegen, feuern und transportieren','Move, fire and transport','Mover, disparar y transportar','Se déplacer, tirer et transporter'],
    ['Bau- und Räumaktionen: geplant','Bau- und Räumaktionen: geplant','Construction and clearing planned','Construcción y despeje previstos','Construction et déblaiement prévus'],
    ['Stellung halten und feuern','Stellung halten und feuern','Hold position and fire','Mantener posición y disparar','Tenir la position et tirer'],
    ['Keine Eigenbewegung im ATLAS-Teststand','Keine Eigenbewegung im ATLAS-Teststand','Cannot move independently in ATLAS prototype','Sin movimiento propio en el prototipo ATLAS','Aucun déplacement autonome dans le prototype ATLAS'],
    ['Stationäres Missionsziel; keine aktive Aktion','Stationäres Missionsziel; keine aktive Aktion','Fixed mission objective; no active action','Objetivo fijo; sin acción activa','Objectif fixe ; aucune action active'],
    ['Gegner-KI: bewegen und feuern','Gegner-KI: bewegen und feuern','Enemy AI: move and fire','IA enemiga: mover y disparar','IA ennemie : se déplacer et tirer'],
    ['Getrennte Plattform-Systeme: geplant','Getrennte Plattform-Systeme: geplant','Separate platform systems planned','Sistemas de plataforma separados previstos','Systèmes de plateforme distincts prévus'],
    ['Tarnung: geplant','Tarnung: geplant','Stealth planned','Camuflaje previsto','Furtivité prévue'],
    ['Wasserpassage; kein eigener KI-Zusatzschritt','Wasserpassage; kein eigener KI-Zusatzschritt','Crosses water; no extra AI maneuver','Cruza agua; sin maniobra adicional de IA','Traverse l’eau ; aucune manœuvre IA supplémentaire'],
    ['Reparatur, Bergung und Drohnen: geplant','Reparatur, Bergung und Drohnen: geplant','Repair, recovery and drones planned','Reparación, recuperación y drones previstos','Réparation, récupération et drones prévus'],
    ['INDEPENDENT ORIGINAL PROTOTYPE · CODE-GENERATED VECTOR UI','EIGENSTÄNDIGER PROTOTYP · CODEGENERIERTE VEKTOROBERFLÄCHE','INDEPENDENT ORIGINAL PROTOTYPE · CODE-GENERATED VECTOR UI','PROTOTIPO ORIGINAL INDEPENDIENTE · INTERFAZ VECTORIAL GENERADA POR CÓDIGO','PROTOTYPE ORIGINAL INDÉPENDANT · INTERFACE VECTORIELLE GÉNÉRÉE PAR CODE'],
    ['NO AFFILIATION OR ENDORSEMENT · © 2026 TACTICAL DESIGN CELL','KEINE VERBINDUNG ODER UNTERSTÜTZUNG · © 2026 TACTICAL DESIGN CELL','NO AFFILIATION OR ENDORSEMENT · © 2026 TACTICAL DESIGN CELL','SIN AFILIACIÓN NI RESPALDO · © 2026 TACTICAL DESIGN CELL','AUCUNE AFFILIATION NI APPROBATION · © 2026 TACTICAL DESIGN CELL'],
    ['ZIELFELD NICHT VERFUEGBAR','ZIELFELD NICHT VERFÜGBAR','DESTINATION UNAVAILABLE','DESTINO NO DISPONIBLE','DESTINATION INDISPONIBLE'],
    ['EINHEIT AUSGESCHIFFT','EINHEIT AUSGESCHIFFT','UNIT DISEMBARKED','UNIDAD DESEMBARCADA','UNITÉ DÉBARQUÉE'],
    ['PASSAGIER HAT BEREITS GEFEUERT','PASSAGIER HAT BEREITS GEFEUERT','PASSENGER HAS ALREADY FIRED','EL PASAJERO YA DISPARÓ','LE PASSAGER A DÉJÀ TIRÉ'],
    ['RAMMSTOSS: ZIEL ZERSTÖRT','RAMMSTOSS: ZIEL ZERSTÖRT','RAM: TARGET DESTROYED','EMBESTIDA: OBJETIVO DESTRUIDO','PERCUSSION : CIBLE DÉTRUITE'],
    ['RAMMEN NICHT MÖGLICH','RAMMEN NICHT MÖGLICH','CANNOT RAM TARGET','NO SE PUEDE EMBESTIR','PERCUSSION IMPOSSIBLE'],
    ['SZENARIOWECHSEL ABGEBROCHEN','SZENARIOWECHSEL ABGEBROCHEN','SCENARIO CHANGE CANCELED','CAMBIO DE ESCENARIO CANCELADO','CHANGEMENT DE SCÉNARIO ANNULÉ'],
    ['Keine Befehle in dieser Phase','Keine Befehle in dieser Phase','No orders in this phase','Sin órdenes en esta fase','Aucun ordre dans cette phase'],
    ['Letzten Befehl dieser Phase rückgängig machen','Letzten Befehl dieser Phase rückgängig machen','Undo the last order in this phase','Deshacer la última orden de esta fase','Annuler le dernier ordre de cette phase'],
    ['Verladbare Einheit auswählen','Verladbare Einheit auswählen','Choose a unit to load','Elegir una unidad para cargar','Choisir une unité à embarquer'],
    ['Verladbare Einheit auswaehlen','Verladbare Einheit auswählen','Choose a unit to load','Elegir una unidad para cargar','Choisir une unité à embarquer'],
    ['SICHTLINIE BLOCKIERT','SICHTLINIE BLOCKIERT','LINE OF SIGHT BLOCKED','LÍNEA DE VISIÓN BLOQUEADA','LIGNE DE VUE BLOQUÉE'],
    ['FEUERPHASE ODER EINHEIT BEREITS VERBRAUCHT','FEUERPHASE ODER EINHEIT BEREITS VERBRAUCHT','FIRE PHASE OR UNIT ALREADY SPENT','FASE DE FUEGO O UNIDAD YA UTILIZADA','PHASE DE TIR OU UNITÉ DÉJÀ UTILISÉE'],
    ['ZIEL AUSGESCHALTET','ZIEL AUSGESCHALTET','TARGET DESTROYED','OBJETIVO DESTRUIDO','CIBLE DÉTRUITE'],
    ['ZIEL DEAKTIVIERT','ZIEL DEAKTIVIERT','TARGET DISABLED','OBJETIVO INHABILITADO','CIBLE NEUTRALISÉE'],
    ['KEIN EFFEKT','KEIN EFFEKT','NO EFFECT','SIN EFECTO','AUCUN EFFET'],
    ['PHASE BEENDEN','PHASE BEENDEN','END PHASE','TERMINAR FASE','TERMINER LA PHASE'],
    ['Zur Feuerphase wechseln','Zur Feuerphase wechseln','Advance to Fire Phase','Avanzar a la fase de fuego','Passer à la phase de tir'],
    ['Zum Skimmer-Manöver wechseln','Zum Skimmer-Manöver wechseln','Advance to Skimmer Maneuver','Avanzar a la maniobra de deslizadores','Passer à la manœuvre des aéroglisseurs'],
    ['Gegnerzug starten','Gegnerzug starten','Start enemy turn','Iniciar turno enemigo','Lancer le tour ennemi'],
    ['KAMPFBERICHT VERFÜGBAR','KAMPFBERICHT VERFÜGBAR','COMBAT REPORT AVAILABLE','INFORME DE COMBATE DISPONIBLE','RAPPORT DE COMBAT DISPONIBLE'],
    ['ARTILLERY','ARTILLERIE','ARTILLERY','ARTILLERÍA','ARTILLERIE'],
    ['CARGO','FRACHT','CARGO','CARGA','CARGAISON'],
    ['SECOND MOVE 2','ZWEITE BEWEGUNG 2','SECOND MOVE 2','SEGUNDO MOVIMIENTO 2','SECOND DÉPLACEMENT 2'],
    ['HARDENED OBJECTIVE','BEFESTIGTES ZIEL','HARDENED OBJECTIVE','OBJETIVO FORTIFICADO','OBJECTIF FORTIFIÉ'],
    ['DAMAGE','SCHADEN','DAMAGE','DAÑO','DÉGÂTS'],
    ['Mission online. Awaiting command.','Mission aktiv. Warte auf Befehle.','Mission online. Awaiting command.','Misión activa. Esperando órdenes.','Mission active. En attente d’ordres.'],
    ['COMBAT LOG AVAILABLE','KAMPFPROTOKOLL VERFÜGBAR','COMBAT LOG AVAILABLE','REGISTRO DE COMBATE DISPONIBLE','JOURNAL DE COMBAT DISPONIBLE'],
    ['ICON-SET WECHSELN?','ICON-SET WECHSELN?','CHANGE ICON SET?','¿CAMBIAR CONJUNTO DE ICONOS?','CHANGER LE JEU D’ICÔNES ?'],
    ['Der aktuelle Spielstand wird verworfen und das Szenario neu gestartet.','Der aktuelle Spielstand wird verworfen und das Szenario neu gestartet.','The current game will be discarded and the scenario restarted.','Se descartará la partida actual y se reiniciará el escenario.','La partie actuelle sera abandonnée et le scénario redémarré.'],
    ['AUSLADEN IN DIESER PHASE NICHT MOEGLICH','AUSLADEN IN DIESER PHASE NICHT MÖGLICH','CANNOT UNLOAD IN THIS PHASE','NO SE PUEDE DESEMBARCAR EN ESTA FASE','DÉBARQUEMENT IMPOSSIBLE DURANT CETTE PHASE'],
    ['AUSLADEN NICHT MÖGLICH','AUSLADEN NICHT MÖGLICH','CANNOT UNLOAD','NO SE PUEDE DESEMBARCAR','DÉBARQUEMENT IMPOSSIBLE'],
    ['EINHEIT EINGESCHIFFT','EINHEIT EINGESCHIFFT','UNIT EMBARKED','UNIDAD EMBARCADA','UNITÉ EMBARQUÉE'],
    ['VERLADBARE EINHEIT WÄHLEN','VERLADBARE EINHEIT WÄHLEN','SELECT A UNIT TO LOAD','SELECCIONA UNA UNIDAD PARA CARGAR','SÉLECTIONNEZ UNE UNITÉ À EMBARQUER'],
    ['VERLADEN NICHT MÖGLICH','VERLADEN NICHT MÖGLICH','CANNOT LOAD','NO SE PUEDE CARGAR','EMBARQUEMENT IMPOSSIBLE'],
    ['VERLADEN NUR IN DER BEWEGUNGSPHASE','VERLADEN NUR IN DER BEWEGUNGSPHASE','LOAD ONLY IN THE MOVEMENT PHASE','CARGAR SOLO EN LA FASE DE MOVIMIENTO','EMBARQUEMENT UNIQUEMENT EN PHASE DE MOUVEMENT'],
    ['ZIELFELD FÜR AUSLADEN WÄHLEN','ZIELFELD FÜR AUSLADEN WÄHLEN','SELECT A CELL TO UNLOAD','SELECCIONA UNA CASILLA PARA DESEMBARCAR','SÉLECTIONNEZ UNE CASE POUR DÉBARQUER'],
    ['WAFFE IN DIESER PHASE NICHT VERFÜGBAR','WAFFE IN DIESER PHASE NICHT VERFÜGBAR','WEAPON UNAVAILABLE IN THIS PHASE','ARMA NO DISPONIBLE EN ESTA FASE','ARME INDISPONIBLE DURANT CETTE PHASE'],
    ['LENKFLUGKÖRPER NICHT VERFÜGBAR','LENKFLUGKÖRPER NICHT VERFÜGBAR','GUIDED MISSILE UNAVAILABLE','MISIL GUIADO NO DISPONIBLE','MISSILE GUIDÉ INDISPONIBLE'],
    ['NUR GEGEN INFANTERIE','NUR GEGEN INFANTERIE','INFANTRY TARGETS ONLY','SOLO CONTRA INFANTERÍA','CIBLES D’INFANTERIE UNIQUEMENT'],
    ['ZIEL NICHT IN WAFFENREICHWEITE','ZIEL NICHT IN WAFFENREICHWEITE','TARGET OUT OF WEAPON RANGE','OBJETIVO FUERA DEL ALCANCE DEL ARMA','CIBLE HORS DE PORTÉE DE L’ARME'],
    ['Keine Systeme verfügbar','Keine Systeme verfügbar','No systems available','No hay sistemas disponibles','Aucun système disponible'],
    ['Waffe auswählen','Waffe auswählen','Select weapon','Seleccionar arma','Choisir une arme'],
    ['Kein Ziel in Reichweite','Kein Ziel in Reichweite','No target in range','Ningún objetivo al alcance','Aucune cible à portée'],
    ['SELECTED WEAPON','AUSGEWÄHLTE WAFFE','SELECTED WEAPON','ARMA SELECCIONADA','ARME SÉLECTIONNÉE'],
    ['ATTACK / RANGE','ANGRIFF / REICHWEITE','ATTACK / RANGE','ATAQUE / ALCANCE','ATTAQUE / PORTÉE'],
    ['MISSILE SPENT','RAKETE VERBRAUCHT','MISSILE SPENT','MISIL AGOTADO','MISSILE ÉPUISÉ'],
    ['MISSILE','RAKETE','MISSILE','MISIL','MISSILE'],
    ['BLAST','DRUCKWELLE','BLAST','EXPLOSIÓN','SOUFFLE'],
    ['6 DIRECT · 3 ADJACENT','6 DIREKT · 3 BENACHBART','6 DIRECT · 3 ADJACENT','6 DIRECTO · 3 ADYACENTE','6 DIRECT · 3 ADJACENT'],
    ['FRIENDLY FIRE','EIGENBESCHUSS','FRIENDLY FIRE','FUEGO AMIGO','TIR FRATRICIDE'],
    ['POSSIBLE','MÖGLICH','POSSIBLE','POSIBLE','POSSIBLE'],
    ['EIGENE EINHEIT','EIGENE EINHEIT','FRIENDLY UNIT','UNIDAD ALIADA','UNITÉ ALLIÉE'],
    ['DIREKTTREFFER','DIREKTTREFFER','DIRECT HIT','IMPACTO DIRECTO','COUP DIRECT'],
    ['DRUCKWELLE','DRUCKWELLE','BLAST','ONDA EXPLOSIVA','SOUFFLE'],
    ['TREADS','KETTEN','TREADS','ORUGAS','CHENILLES'],
    ['MAIN / SECONDARY','HAUPT- / SEKUNDÄRWAFFE','MAIN / SECONDARY','PRINCIPAL / SECUNDARIA','PRINCIPALE / SECONDAIRE'],
    ['MISSILES / AP','RAKETEN / AP','MISSILES / AP','MISILES / AP','MISSILES / AP'],
    ['SYSTEM ZERSTÖRT','SYSTEM ZERSTÖRT','SYSTEM DESTROYED','SISTEMA DESTRUIDO','SYSTÈME DÉTRUIT'],
    ['D OHNE WIRKUNG','D OHNE WIRKUNG','D WITHOUT EFFECT','D SIN EFECTO','D SANS EFFET'],
    ['ZWEITES D — CORE OFFLINE','ZWEITES D — KERN AUSGEFALLEN','SECOND D — CORE OFFLINE','SEGUNDO D — NÚCLEO FUERA DE SERVICIO','SECOND D — NOYAU HORS SERVICE'],
    ['ZWEITES D — ZIEL AUSGESCHALTET','ZWEITES D — ZIEL AUSGESCHALTET','SECOND D — TARGET DESTROYED','SEGUNDO D — OBJETIVO DESTRUIDO','SECOND D — CIBLE DÉTRUITE'],
    ['CORE OFFLINE — ZIEL ZERSTÖRT','KERN AUSGEFALLEN — ZIEL ZERSTÖRT','CORE OFFLINE — TARGET DESTROYED','NÚCLEO FUERA DE SERVICIO — OBJETIVO DESTRUIDO','NOYAU HORS SERVICE — CIBLE DÉTRUITE'],
    ['OPERATIONAL','BETRIEBSBEREIT','OPERATIONAL','OPERATIVO','OPÉRATIONNEL'],
    ['NEXT D / X','NÄCHSTES D / X','NEXT D / X','PRÓXIMO D / X','PROCHAIN D / X'],
    ['EFFECTIVE DEF','EFFEKTIVE VERT.','EFFECTIVE DEF','DEF. EFECTIVA','DÉF. EFFECTIVE'],
    ['ATLAS-Level konnte nicht geladen werden.','ATLAS-Level konnte nicht geladen werden.','ATLAS level could not be loaded.','No se pudo cargar el nivel ATLAS.','Impossible de charger le niveau ATLAS.'],
    ['INFANTRY','INFANTERIE','INFANTRY','INFANTERÍA','INFANTERIE'],
    ['SIEGE ARMOR','BELAGERUNGSPANZER','SIEGE ARMOR','BLINDADO DE ASEDIO','BLINDÉ DE SIÈGE'],
    ['FIXED ARTILLERY','STATIONÄRE ARTILLERIE','FIXED ARTILLERY','ARTILLERÍA FIJA','ARTILLERIE FIXE'],
    ['MISSILE PLATFORM','RAKETENPLATTFORM','MISSILE PLATFORM','PLATAFORMA DE MISILES','PLATEFORME DE MISSILES'],
    ['ARTILLERY DRONE','ARTILLERIEDROHNE','ARTILLERY DRONE','DRON DE ARTILLERÍA','DRONE D’ARTILLERIE'],
    ['AMPHIBIOUS INFANTRY','AMPHIBISCHE INFANTERIE','AMPHIBIOUS INFANTRY','INFANTERÍA ANFIBIA','INFANTERIE AMPHIBIE'],
    ['FIELD ENGINEERING','FELDPIONIERE','FIELD ENGINEERING','INGENIERÍA DE CAMPAÑA','GÉNIE DE TERRAIN'],
    ['STATIC DEFENSE','STATIONÄRE VERTEIDIGUNG','STATIC DEFENSE','DEFENSA ESTÁTICA','DÉFENSE STATIQUE'],
    ['FORTIFIED TARGET','BEFESTIGTES ZIEL','FORTIFIED TARGET','OBJETIVO FORTIFICADO','CIBLE FORTIFIÉE'],
    ['Kartenbefehl','Kartenbefehl','map order','orden del mapa','ordre sur la carte'],
    ['Feuerbefehl','Feuerbefehl','fire order','orden de fuego','ordre de tir'],
    ['Verladen','Verladen','loading','carga','embarquement'],
    ['Entladen','Entladen','unloading','descarga','débarquement'],
    ['LENKFLUGKÖRPER','LENKFLUGKÖRPER','GUIDED MISSILE','MISIL GUIADO','MISSILE GUIDÉ'],
    ['ZIELE ERFASST','ZIELE ERFASST','TARGETS ACQUIRED','OBJETIVOS DETECTADOS','CIBLES ACQUISES'],
    ['AUSGESCHALTET','AUSGESCHALTET','DESTROYED','DESTRUIDO','DÉTRUIT'],
    ['GETROFFEN','GETROFFEN','HIT','ALCANZADO','TOUCHÉ'],
    ['tank','Panzer','tank','tanque','char'],
    ['core','Kern','core','núcleo','noyau'],
    ['player','Spieler','player','jugador','joueur'],
    ['enemy','Feind','enemy','enemigo','ennemi'],
    ['mountain','Berg','mountain','montaña','montagne'],
    ['water','Wasser','water','agua','eau'],
    ['open','offen','open','abierto','dégagé'],
    ['movement','Bewegung','movement','movimiento','déplacement'],
    ['fire','Feuer','fire','fuego','tir'],
    ['sight','Sicht','sight','visión','vue'],
    ['gev','Skimmer','skimmer','deslizador','aéroglisseur'],
  ].forEach((row) => add(...row));

  // New UI code can use stable keys and {name} placeholders. Plural templates
  // select one/other with Intl.PluralRules using count or pendingCount.
  // Existing screens use rendered source text until they migrate to this API.
  const semanticSources = Object.freeze({
    'language.label': 'Sprache',
    'nav.quickStart': 'QUICK START',
    'nav.unitGuide': 'UNIT GUIDE',
    'nav.restart': 'RESTART',
    'action.endTurn': 'END TURN',
    'action.cancel': 'CANCEL',
    'phase.movement': 'MOVEMENT PHASE',
    'phase.fire': 'FIRE PHASE',
    'phase.skimmer': 'SKIMMER MANEUVER',
    'phase.enemy': 'HOSTILE PHASE',
    'status.ready': 'READY',
    'status.disabled': 'DISABLED',
    'status.destroyed': 'DESTROYED',
    'intel.unit': 'UNIT INTEL',
    'intel.field': 'FIELD INTEL',
    'map.movementRange': 'MOVEMENT RANGE',
    'map.fireRange': 'FIRE RANGE',
    'map.lineOfSight': 'LINE OF SIGHT',
    'map.grid': 'GRID',
  });
  const templates = Object.freeze({
    'phase.readyUnits': {
      de: { one: '{count} Einheit kann in dieser Phase noch handeln.', other: '{count} Einheiten können in dieser Phase noch handeln.' },
      en: { one: '{count} unit can still act in this phase.', other: '{count} units can still act in this phase.' },
      es: { one: '{count} unidad aún puede actuar en esta fase.', other: '{count} unidades aún pueden actuar en esta fase.' },
      fr: { one: '{count} unité peut encore agir durant cette phase.', other: '{count} unités peuvent encore agir durant cette phase.' },
    },
    'map.sector': { de: 'Sektor {id}', en: 'Sector {id}', es: 'Sector {id}', fr: 'Secteur {id}' },
  });

  const patterns = [
    [/^MOVE (\d+\/\d+)$/, ['BEWEGUNG $1','MOVE $1','MOVIMIENTO $1','DÉPLACEMENT $1']],
    [/^FIRE (\d+\/\d+)$/, ['FEUER $1','FIRE $1','FUEGO $1','TIR $1']],
    [/^SKIMMER (\d+\/\d+)$/, ['SKIMMER $1','SKIMMER $1','DESLIZADOR $1','AÉROGLISSEUR $1']],
    [/^BACK \((\d+)\)$/, ['ZURÜCK ($1)','BACK ($1)','ATRÁS ($1)','RETOUR ($1)']],
    [/^SECTOR ([A-Z]-\d+)$/, ['SEKTOR $1','SECTOR $1','SECTOR $1','SECTEUR $1']],
    [/^CORE (\d+\/\d+ HP)$/, ['KERN $1','CORE $1','NÚCLEO $1','NOYAU $1']],
    [/^HOSTILES (\d+\/\d+)$/, ['FEINDE $1','HOSTILES $1','ENEMIGOS $1','ENNEMIS $1']],
    [/^TURN (\d+)$/, ['ZUG $1','TURN $1','TURNO $1','TOUR $1']],
    [/^([A-ZÄÖÜ0-9 -]+) · CARGO (\d+\/\d+)$/, ['$1 · FRACHT $2','$1 · CARGO $2','$1 · CARGA $2','$1 · CARGAISON $2']],
    [/^Zug (\d+)$/, ['Zug $1','Turn $1','Turno $1','Tour $1']],
    [/^· Bereit (\d+\/\d+)$/, ['· Bereit $1','· Ready $1','· Listas $1','· Prêtes $1']],
    [/^Feld (\d+), (\d+)$/, ['Feld $1, $2','Cell $1, $2','Casilla $1, $2','Case $1, $2']],
    [/^Zur (Fire|GEV) Phase →$/, ['Zur $1-Phase →','To $1 phase →','A la fase $1 →','Vers la phase $1 →']],
    [/^Zur (Enemy|Player) Movement →$/, ['Zur Bewegung: $1 →','To $1 movement →','Al movimiento: $1 →','Vers le déplacement : $1 →']],
    [/^(Player|Enemy) · (movement|fire|gev) phase$/, ['$1 · $2-Phase','$1 · $2 phase','$1 · fase $2','$1 · phase $2']],
    [/^([A-Z0-9-]+) gewählt · (movement|fire|sight)$/, ['$1 gewählt · $2','$1 selected · $2','$1 seleccionada · $2','$1 sélectionnée · $2']],
    [/^Sieg: (player|enemy)$/, ['Sieg: $1','Victory: $1','Victoria: $1','Victoire : $1']],
    [/^Abgelehnt: (.+)$/, ['Abgelehnt: $1','Rejected: $1','Rechazado: $1','Refusé : $1']],
    [/^Terrainpaket nicht geladen: (.+)$/, ['Terrainpaket nicht geladen: $1','Terrain package failed to load: $1','No se pudo cargar el terreno: $1','Impossible de charger le terrain : $1']],
    [/^(.+) AUSGEWÄHLT · BEREITS GEHANDELT$/, ['$1 AUSGEWÄHLT · BEREITS GEHANDELT','$1 SELECTED · ALREADY ACTED','$1 SELECCIONADA · YA ACTUÓ','$1 SÉLECTIONNÉE · A DÉJÀ AGI']],
    [/^(.+) AUSGEWÄHLT$/, ['$1 AUSGEWÄHLT','$1 SELECTED','$1 SELECCIONADA','$1 SÉLECTIONNÉE']],
    [/^(.+) IST DEAKTIVIERT$/, ['$1 IST DEAKTIVIERT','$1 IS DISABLED','$1 ESTÁ INHABILITADA','$1 EST NEUTRALISÉE']],
    [/^(.+) FEUERBEREIT$/, ['$1 FEUERBEREIT','$1 READY TO FIRE','$1 LISTA PARA DISPARAR','$1 PRÊTE À TIRER']],
    [/^(.+) ausladen$/, ['$1 ausladen','Unload $1','Desembarcar $1','Débarquer $1']],
    [/^(.+) zum Feuern wählen$/, ['$1 zum Feuern wählen','Select $1 to fire','Seleccionar $1 para disparar','Choisir $1 pour tirer']],
    [/^(.+) rückgängig machen$/, ['$1 rückgängig machen','Undo $1','Deshacer $1','Annuler $1']],
    [/^([A-Z0-9-]+) · CATALOG$/, ['$1 · KATALOG','$1 · CATALOG','$1 · CATÁLOGO','$1 · CATALOGUE']],
    [/^DAMAGE (\d+\/\d+)$/, ['SCHADEN $1','DAMAGE $1','DAÑO $1','DÉGÂTS $1']],
    [/^MOVE (\d+)$/, ['BEWEGUNG $1','MOVE $1','MOVIMIENTO $1','DÉPLACEMENT $1']],
    [/^READY (\d+)$/, ['BEREIT $1','READY $1','LISTAS $1','PRÊTES $1']],
    [/^\+(\d+) DEF$/, ['+$1 VERT.','+$1 DEF','+$1 DEF.','+$1 DÉF.']],
    [/^(\d+) ZIELE ERFASST$/, ['$1 ZIELE ERFASST','$1 TARGETS ACQUIRED','$1 OBJETIVOS DETECTADOS','$1 CIBLES ACQUISES']],
    [/^(\d+) KETTENEINHEITEN ZERSTÖRT$/, ['$1 KETTENEINHEITEN ZERSTÖRT','$1 TRACK UNITS DESTROYED','$1 SEGMENTOS DE ORUGA DESTRUIDOS','$1 SEGMENTS DE CHENILLES DÉTRUITS']],
    [/^INFANTERIE VERLIERT 1 STÄRKEPUNKT — (\d+\/\d+) VERBLEIBEND$/, ['INFANTERIE VERLIERT 1 STÄRKEPUNKT — $1 VERBLEIBEND','INFANTRY LOSES 1 STRENGTH — $1 REMAINING','LA INFANTERÍA PIERDE 1 FUERZA — QUEDAN $1','L’INFANTERIE PERD 1 POINT DE FORCE — $1 RESTANTS']],
    [/^(.+) startet Lenkflugkörper auf (.+) \(([A-Z]-\d+)\)\.$/, ['$1 startet Lenkflugkörper auf $2 ($3).','$1 launches a guided missile at $2 ($3).','$1 lanza un misil guiado contra $2 ($3).','$1 lance un missile guidé sur $2 ($3).']],
    [/^Unit render failed: (.+)$/, ['Einheitendarstellung fehlgeschlagen: $1','Unit render failed: $1','Error al mostrar la unidad: $1','Échec de l’affichage de l’unité : $1']],
    [/^(.+) online\. Awaiting command\.$/, ['$1 aktiv. Warte auf Befehle.','$1 online. Awaiting command.','$1 activa. Esperando órdenes.','$1 active. En attente d’ordres.']],
    [/^(.+) bewegt sich nach ([A-Z]-\d+)\.$/, ['$1 bewegt sich nach $2.','$1 moves to $2.','$1 se mueve a $2.','$1 se déplace vers $2.']],
    [/^(.+) rückt nach ([A-Z]-\d+) vor\.$/, ['$1 rückt nach $2 vor.','$1 advances to $2.','$1 avanza a $2.','$1 avance vers $2.']],
    [/^(.+) steigt in (.+) ein\.$/, ['$1 steigt in $2 ein.','$1 boards $2.','$1 embarca en $2.','$1 embarque dans $2.']],
    [/^(.+) verlässt (.+)\.$/, ['$1 verlässt $2.','$1 disembarks from $2.','$1 desembarca de $2.','$1 débarque de $2.']],
    [/^(.+) hält Position\.$/, ['$1 hält Position.','$1 holds position.','$1 mantiene la posición.','$1 maintient sa position.']],
    [/^(.+) ist wieder einsatzbereit\.$/, ['$1 ist wieder einsatzbereit.','$1 is operational again.','$1 vuelve a estar operativa.','$1 est de nouveau opérationnelle.']],
    [/^(.+) rammt (.+)\. Ziel zerstört\.$/, ['$1 rammt $2. Ziel zerstört.','$1 rams $2. Target destroyed.','$1 embiste a $2. Objetivo destruido.','$1 percute $2. Cible détruite.']],
    [/^(.+) feuert auf (.+): ([NDXE]+) bei ([^ ]+) — (.+)\.$/, ['$1 feuert auf $2 : $3 bei $4 — $5.','$1 fires at $2: $3 at $4 — $5.','$1 dispara a $2: $3 con $4 — $5.','$1 tire sur $2 : $3 à $4 — $5.']],
    [/^END (MOVEMENT PHASE|FIRE PHASE|SKIMMER MANEUVER)\?$/, ['PHASE $1 BEENDEN?','END $1?','¿TERMINAR $1?','TERMINER $1 ?']],
    [/^(\d+) Einheit kann in dieser Phase noch handeln\.$/, ['$1 Einheit kann in dieser Phase noch handeln.','$1 unit can still act in this phase.','$1 unidad aún puede actuar en esta fase.','$1 unité peut encore agir durant cette phase.']],
    [/^(\d+) Einheiten können in dieser Phase noch handeln\.$/, ['$1 Einheiten können in dieser Phase noch handeln.','$1 units can still act in this phase.','$1 unidades aún pueden actuar en esta fase.','$1 unités peuvent encore agir durant cette phase.']],
  ];

  const readLocale = () => {
    const fromUrl = new URLSearchParams(root.location?.search || '').get('lang');
    let saved;
    try { saved = root.localStorage.getItem('goblin-language'); } catch { /* Storage is optional. */ }
    const browser = (root.navigator?.language || 'de').slice(0, 2).toLowerCase();
    return languages.find((lang) => lang === fromUrl) || languages.find((lang) => lang === saved) || languages.find((lang) => lang === browser) || 'de';
  };
  let locale = readLocale();
  const initialTitle = document.title;
  const state = new WeakMap();

  function translate(source, lang = locale) {
    const exact = messages.get(source);
    if (exact) return exact[lang];
    const phase = /^(Player|Enemy) · (movement|fire|gev) phase$/.exec(source);
    if (phase) {
      const team = { de: { Player: 'Spieler', Enemy: 'Feind' }, en: { Player: 'Player', Enemy: 'Enemy' }, es: { Player: 'Jugador', Enemy: 'Enemigo' }, fr: { Player: 'Joueur', Enemy: 'Ennemi' } }[lang][phase[1]];
      const step = { de: { movement: 'Bewegungsphase', fire: 'Feuerphase', gev: 'Skimmer-Phase' }, en: { movement: 'Movement phase', fire: 'Fire phase', gev: 'Skimmer phase' }, es: { movement: 'Fase de movimiento', fire: 'Fase de fuego', gev: 'Fase de deslizadores' }, fr: { movement: 'Phase de mouvement', fire: 'Phase de tir', gev: 'Phase des aéroglisseurs' } }[lang][phase[2]];
      return `${team} · ${step}`;
    }
    const nextPhase = /^Zur (Fire|GEV) Phase →$/.exec(source);
    if (nextPhase) {
      const step = { de: { Fire: 'Feuerphase', GEV: 'Skimmer-Phase' }, en: { Fire: 'Fire Phase', GEV: 'Skimmer Phase' }, es: { Fire: 'fase de fuego', GEV: 'fase de deslizadores' }, fr: { Fire: 'phase de tir', GEV: 'phase des aéroglisseurs' } }[lang][nextPhase[1]];
      return { de: `Zur ${step} →`, en: `To ${step} →`, es: `A la ${step} →`, fr: `Vers la ${step} →` }[lang];
    }
    const nextTeam = /^Zur (Enemy|Player) Movement →$/.exec(source);
    if (nextTeam) {
      const team = { de: { Enemy: 'Feind', Player: 'Spieler' }, en: { Enemy: 'Enemy', Player: 'Player' }, es: { Enemy: 'enemigo', Player: 'jugador' }, fr: { Enemy: 'ennemi', Player: 'joueur' } }[lang][nextTeam[1]];
      return { de: `Zur Bewegung: ${team} →`, en: `To ${team} movement →`, es: `Al movimiento del ${team} →`, fr: `Vers le déplacement ${team} →` }[lang];
    }
    const shot = /^(.+) feuert auf (.+): ([NDXE]+) bei ([^ ]+) — (.+)\.$/.exec(source);
    if (shot) {
      const verb = { de: 'feuert auf', en: 'fires at', es: 'dispara a', fr: 'tire sur' }[lang];
      const odds = { de: 'bei', en: 'at', es: 'con', fr: 'à' }[lang];
      return `${shot[1]} ${verb} ${shot[2]}: ${shot[3]} ${odds} ${shot[4]} — ${translate(shot[5], lang)}.`;
    }
    const disabledEffect = /^(CORE|ZIEL) DEAKTIVIERT(?: BIS RUNDE (\d+))? — NÄCHSTES D ODER X ZERSTÖRT$/.exec(source);
    if (disabledEffect) {
      const subject = { de: { CORE: 'KERN', ZIEL: 'ZIEL' }, en: { CORE: 'CORE', ZIEL: 'TARGET' }, es: { CORE: 'NÚCLEO', ZIEL: 'OBJETIVO' }, fr: { CORE: 'NOYAU', ZIEL: 'CIBLE' } }[lang][disabledEffect[1]];
      const until = disabledEffect[2] ? { de: ` BIS RUNDE ${disabledEffect[2]}`, en: ` UNTIL TURN ${disabledEffect[2]}`, es: ` HASTA EL TURNO ${disabledEffect[2]}`, fr: ` JUSQU’AU TOUR ${disabledEffect[2]}` }[lang] : '';
      const text = { de: 'DEAKTIVIERT', en: 'DISABLED', es: 'INHABILITADO', fr: 'NEUTRALISÉ' }[lang];
      const next = { de: 'NÄCHSTES D ODER X ZERSTÖRT', en: 'NEXT D OR X DESTROYS', es: 'EL PRÓXIMO D O X DESTRUYE', fr: 'LE PROCHAIN D OU X DÉTRUIT' }[lang];
      return `${subject} ${text}${until} — ${next}`;
    }
    const passengerHit = /^(.+): Mitfahrer (.+) (NE|D|X) bei ([^ ]+) — (.+)\.$/.exec(source);
    if (passengerHit) {
      const rider = { de: 'Mitfahrer', en: 'passenger', es: 'pasajero', fr: 'passager' }[lang];
      const odds = { de: 'bei', en: 'at', es: 'con', fr: 'à' }[lang];
      return `${passengerHit[1]}: ${rider} ${passengerHit[2]} ${passengerHit[3]} ${odds} ${passengerHit[4]} — ${translate(passengerHit[5], lang)}.`;
    }
    const missileHit = /^(.+?)( \(EIGENE EINHEIT\))?: (NE|D|X) bei ([^ ]+) · (DIREKTTREFFER|DRUCKWELLE)\.$/.exec(source);
    if (missileHit) {
      const friendly = missileHit[2] ? ` (${translate('EIGENE EINHEIT', lang)})` : '';
      const odds = { de: 'bei', en: 'at', es: 'con', fr: 'à' }[lang];
      return `${missileHit[1]}${friendly}: ${missileHit[3]} ${odds} ${missileHit[4]} · ${translate(missileHit[5], lang)}.`;
    }
    const cell = /^Feld (\d+), (\d+)(.*)$/.exec(source);
    if (cell) {
      const label = { de: 'Feld', en: 'Cell', es: 'Casilla', fr: 'Case' }[lang];
      let rest = cell[3];
      if (rest.startsWith(': ')) {
        const details = /^: (\S+) (\S+), (.+)$/.exec(rest);
        if (details) rest = `: ${translate(details[1], lang)} ${details[2]}, ${translate(details[3], lang)}`;
      }
      return `${label} ${cell[1]}, ${cell[2]}${rest}`;
    }
    const undoTitle = /^(.+) rückgängig machen$/.exec(source);
    if (undoTitle) return { de: `${undoTitle[1]} rückgängig machen`, en: `Undo ${translate(undoTitle[1], lang)}`, es: `Deshacer ${translate(undoTitle[1], lang)}`, fr: `Annuler ${translate(undoTitle[1], lang)}` }[lang];
    const undone = /^(KARTENBEFEHL|FEUERBEFEHL|VERLADEN|ENTLADEN) ZURÜCKGENOMMEN$/.exec(source);
    if (undone) {
      const label = translate(undone[1].slice(0, 1) + undone[1].slice(1).toLowerCase(), lang);
      return { de: source, en: `${label.toUpperCase()} UNDONE`, es: `${label.toUpperCase()} DESHECHA`, fr: `${label.toUpperCase()} ANNULÉ` }[lang];
    }
    for (const [pattern, values] of patterns) if (pattern.test(source)) return source.replace(pattern, values[languages.indexOf(lang)]);
    if (source.includes(' · ')) {
      const parts = source.split(' · ');
      const result = parts.map((part) => translate(part, lang)).join(' · ');
      if (result !== source) return result;
    }
    if (source.includes(' — ')) {
      const parts = source.split(' — ');
      const result = parts.map((part) => translate(part, lang)).join(' — ');
      if (result !== source) return result;
    }
    if (source.endsWith(' Dieses Feld liegt hinter einem Sichtblocker.')) {
      const note = source.slice(0, -' Dieses Feld liegt hinter einem Sichtblocker.'.length);
      return `${translate(note, lang)} ${translate('Dieses Feld liegt hinter einem Sichtblocker.', lang)}`;
    }
    return source;
  }

  function t(key, params = {}, lang = locale) {
    if (key === 'dialog.phaseAdvance.pending') key += params.pendingCount === 0 ? '.none' : params.pendingCount === 1 ? '.one' : '.other';
    const catalogText = contentCatalogs[lang]?.[key];
    const value = templates[key]?.[lang];
    const pluralCount = params.count ?? params.pendingCount;
    const template = catalogText ?? (typeof value === 'string' ? value : value ? value[new Intl.PluralRules(lang).select(Number(pluralCount))] ?? value.other : semanticSources[key] ? translate(semanticSources[key], lang) : key);
    return template.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match);
  }

  function applyText(node) {
    const current = node.nodeValue;
    if (!current?.trim()) return;
    const old = state.get(node);
    const preserved = node.parentElement?.getAttribute('data-l10n-source');
    const source = preserved || (old && current === old.rendered ? old.source : current.trim());
    const translated = translate(source);
    const next = current.replace(current.trim(), translated);
    state.set(node, { source, rendered: next });
    if (current !== next) node.nodeValue = next;
  }

  function applyAttributes(element) {
    for (const attribute of ['title', 'aria-label', 'placeholder']) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute);
      const key = `${attribute}:${current}`;
      const old = state.get(element)?.[attribute];
      const source = old && current === old.rendered ? old.source : current;
      const translated = translate(source);
      state.set(element, { ...state.get(element), [attribute]: { source, rendered: translated } });
      if (current !== translated) element.setAttribute(attribute, translated);
    }
  }

  function apply(rootNode) {
    if (rootNode.nodeType === Node.TEXT_NODE) { applyText(rootNode); return; }
    if (rootNode.nodeType !== Node.ELEMENT_NODE) return;
    applyAttributes(rootNode);
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.nodeType === Node.TEXT_NODE) applyText(walker.currentNode);
      else applyAttributes(walker.currentNode);
    }
  }

  function choose(lang) {
    if (!languages.includes(lang)) return;
    locale = lang;
    document.documentElement.lang = lang;
    document.title = translate(initialTitle, lang);
    try {
      const url = new URL(root.location.href);
      url.searchParams.set('lang', lang);
      root.history.replaceState(root.history.state, '', url);
    } catch { /* Embedded previews may restrict history. */ }
    try { root.localStorage.setItem('goblin-language', lang); } catch { /* Storage is optional. */ }
    document.querySelectorAll('[data-language-select]').forEach((select) => { select.value = lang; });
    apply(document.body);
    root.dispatchEvent(new CustomEvent('goblin-language-change', { detail: { language: lang } }));
  }

  function mountSelect() {
    const target = document.querySelector('.top-status, header');
    if (!target || target.querySelector('[data-language-select]')) return;
    const label = document.createElement('label');
    label.className = 'language-picker';
    const caption = document.createElement('span');
    caption.textContent = 'Sprache';
    const select = document.createElement('select');
    select.setAttribute('data-language-select', '');
    select.setAttribute('aria-label', 'Sprache');
    for (const lang of languages) {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = names[lang];
      select.append(option);
    }
    select.value = locale;
    select.addEventListener('change', () => choose(select.value));
    label.append(caption, select);
    target.append(label);
  }

  function start() {
    mountSelect();
    choose(locale);
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        if (change.type === 'characterData') apply(change.target);
        else if (change.type === 'attributes') applyAttributes(change.target);
        else for (const node of change.addedNodes) apply(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  }

  root.GoblinLanguage = Object.freeze({ get current() { return locale; }, choose, t, translate, start, languages, ready });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(globalThis);
