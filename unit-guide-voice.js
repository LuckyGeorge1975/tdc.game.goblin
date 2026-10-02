(function(root){
  'use strict';
  // Flavor text only. Gameplay facts and availability stay in unit-guide.js.
  const labels={de:'RANDNOTIZ DES GENERALS',en:"THE GENERAL'S MARGIN NOTE",es:'NOTA AL MARGEN DEL GENERAL',fr:'NOTE EN MARGE DU GÉNÉRAL'};
  const lines={
    'GOBLIN SIEGEBREAKER':{
      de:'Eine Festung auf Ketten. Wenn die Ketten weg sind, bleibt immer noch eine Festung. Sagt die Beschaffung.',
      en:'A fortress on tracks. Lose the tracks and it is still a fortress. Procurement says so.',
      es:'Una fortaleza sobre orugas. Si pierde las orugas, sigue siendo una fortaleza. Eso dice Compras.',
      fr:'Une forteresse sur chenilles. Sans les chenilles, elle reste une forteresse. C’est ce que dit l’Intendance.'},
    'SKIMMER SCOUT':{
      de:'Unser Skimmer ist schnell. Richtig schnell. Vorfahren, schießen, verschwinden – bevor der Gegner an der Reihe ist.',
      en:'Our skimmer is fast. Very fast. Move in, fire, get out—before the enemy gets a turn.',
      es:'Nuestro deslizador es rápido. Muy rápido. Entra, dispara y se va antes de que le toque al enemigo.',
      fr:'Notre aéroglisseur est rapide. Très rapide. Il avance, tire et file avant le tour adverse.'},
    'ROCKET ARTILLERY':{
      de:'Wir nennen es Fernunterstützung. Aus der Nähe wirkt das Wort weniger beruhigend.',
      en:'We call it long-range support. The phrase sounds less comforting up close.',
      es:'Lo llamamos apoyo de largo alcance. De cerca, la expresión tranquiliza bastante menos.',
      fr:'Nous appelons cela un appui à longue portée. De près, la formule rassure beaucoup moins.'},
    'INFANTRY SQUAD':{
      de:'Drei Trupps auf dem Papier. Auf dem Feld zählt jeder einzelne. Papier hält länger.',
      en:'Three squads on paper. In the field, every one of them counts. Paper lasts longer.',
      es:'Tres escuadras sobre el papel. En el campo cuenta cada una. El papel dura más.',
      fr:'Trois escouades sur le papier. Sur le terrain, chacune compte. Le papier dure plus longtemps.'},
    'ASSAULT TANK':{
      de:'Vorne ist es gefährlich. Deshalb haben wir den Panzer dicker gemacht und es Strategie genannt.',
      en:'The front is dangerous. So we made the armor thicker and called it strategy.',
      es:'El frente es peligroso. Así que reforzamos el blindaje y lo llamamos estrategia.',
      fr:'Le front est dangereux. Nous avons donc épaissi le blindage et appelé cela une stratégie.'},
    'RECON TANK':{
      de:'Er findet den Feind meist zuerst. Im Bericht gilt das als Vorteil.',
      en:'It usually finds the enemy first. The report calls that an advantage.',
      es:'Suele encontrar primero al enemigo. El informe lo considera una ventaja.',
      fr:'Il trouve généralement l’ennemi en premier. Le rapport appelle cela un avantage.'},
    'SIEGE TANK':{
      de:'Zwei Rohre, ein großer Schatten. Der Auftrag bleibt derselbe: näher ran, als einem lieb ist.',
      en:'Two barrels, one long shadow. The assignment is still to get closer than anyone would like.',
      es:'Dos cañones, una sombra larga. La orden sigue siendo acercarse más de lo que a nadie le gustaría.',
      fr:'Deux canons, une longue ombre. L’ordre reste de s’approcher plus que de raison.'},
    'LONG-RANGE BATTERY':{
      de:'Sie bewegt sich nicht. In der Planung war das ein Standortvorteil.',
      en:'It does not move. In the plan, that was listed as a location advantage.',
      es:'No se mueve. En el plan figuraba como ventaja de emplazamiento.',
      fr:'Elle ne bouge pas. Dans le plan, c’était un avantage de position.'},
    'MOBILE SIEGE GUN':{
      de:'Mobil ist hier ein dehnbarer Begriff. Die Reichweite ist es nicht.',
      en:'Mobile is a flexible term here. Its firing range is not.',
      es:'Móvil es aquí un término flexible. Su alcance no lo es.',
      fr:'Mobile est ici un terme assez souple. Sa portée, beaucoup moins.'},
    'COMBAT SKIMMER':{
      de:'Er kommt, schießt und verschwindet. Der Feind bekommt die Rechnung im nächsten Zug.',
      en:'It arrives, fires and vanishes. The enemy gets the bill on the next turn.',
      es:'Llega, dispara y desaparece. El enemigo recibe la cuenta en el siguiente turno.',
      fr:'Il arrive, tire et disparaît. L’ennemi reçoit la facture au tour suivant.'},
    'LIGHT SKIMMER':{
      de:'Schnell genug für mutige Pläne. Dünn genug, dass Mut Pflicht wird.',
      en:'Fast enough for bold plans. Light enough to make courage mandatory.',
      es:'Lo bastante rápido para planes audaces. Lo bastante frágil para que el valor sea obligatorio.',
      fr:'Assez rapide pour les plans audacieux. Assez fragile pour rendre le courage obligatoire.'},
    'SKIMMER CARRIER':{
      de:'Drei Plätze für Infanterie. In der Logistik heißt das Fürsorge.',
      en:'Three seats for infantry. Logistics calls that care.',
      es:'Tres plazas para infantería. Logística lo llama atención al personal.',
      fr:'Trois places pour l’infanterie. La logistique appelle cela de la sollicitude.'},
    'STRATEGIC MISSILE CARRIER':{
      de:'Eine Rakete, ein großer Radius und unangenehm viele Nachbarn. Die Nachbesprechung wird kurz.',
      en:'One missile, a wide blast and far too many neighbors. The debrief will be short.',
      es:'Un misil, una gran explosión y demasiados vecinos. La reunión posterior será breve.',
      fr:'Un missile, une large explosion et beaucoup trop de voisins. Le débriefing sera bref.'},
    'ARTILLERY DRONE':{
      de:'Die Drohne spart Besatzung. Die Verantwortung hat noch niemand eingespart.',
      en:'The drone saves a crew. Nobody has worked out how to save the responsibility.',
      es:'El dron ahorra una tripulación. Nadie ha conseguido ahorrar la responsabilidad.',
      fr:'Le drone épargne un équipage. Personne n’a encore trouvé comment épargner la responsabilité.'},
    'AMPHIBIOUS INFANTRY':{
      de:'Wasser hält sie nicht auf. Die Frage, wer sie zurückholt, steht in einem anderen Formular.',
      en:'Water will not stop them. Who brings them back is covered by another form.',
      es:'El agua no los detiene. Quién los trae de vuelta consta en otro formulario.',
      fr:'L’eau ne les arrête pas. La question du retour figure sur un autre formulaire.'},
    'FIELD ENGINEERS':{
      de:'Sie kommen mit Werkzeug und einem Plan. Beides ist im Feuergefecht schwer zu erklären.',
      en:'They bring tools and a plan. Both are hard to explain under fire.',
      es:'Traen herramientas y un plan. Ambas cosas son difíciles de explicar bajo fuego.',
      fr:'Ils apportent des outils et un plan. Sous le feu, les deux sont difficiles à expliquer.'},
    'LOCAL DEFENSE':{
      de:'Heimvorteil klingt großartig, bis die Heimat zur Front wird.',
      en:'Home advantage sounds wonderful until home becomes the front.',
      es:'La ventaja de jugar en casa suena bien hasta que la casa se convierte en el frente.',
      fr:'L’avantage du terrain sonne bien jusqu’à ce que le terrain devienne le front.'},
    'COMMAND HUB':{
      de:'Hier werden Befehle beschlossen. Die Folgen liegen außerhalb des Kartenraums.',
      en:'Orders are decided here. The consequences lie beyond the map room.',
      es:'Aquí se deciden las órdenes. Las consecuencias quedan fuera de la sala de mapas.',
      fr:'C’est ici que les ordres sont décidés. Leurs conséquences dépassent la salle des cartes.'},
    'GOBLIN DREADNAUGHT':{
      de:'Groß, laut und schwer zu übersehen. Die Beschaffung nennt das Abschreckung.',
      en:'Big, loud and impossible to miss. Procurement calls that deterrence.',
      es:'Grande, ruidoso e imposible de pasar por alto. Compras lo llama disuasión.',
      fr:'Grand, bruyant et impossible à manquer. L’Intendance appelle cela de la dissuasion.'},
    'PHANTOM PLATFORM':{
      de:'Phantom ist ein guter Name. Man bemerkt es leider trotzdem, sobald es schießt.',
      en:'Phantom is a fine name. People still notice it once it fires.',
      es:'Fantasma es un buen nombre. Por desgracia, se nota en cuanto dispara.',
      fr:'Fantôme est un joli nom. On le remarque tout de même dès qu’il tire.'},
    'INFANTRY PLATOON':{
      de:'Mehr Stiefel auf der Karte. Weniger Platz für einfache Antworten.',
      en:'More boots on the map. Less room for easy answers.',
      es:'Más botas en el mapa. Menos espacio para respuestas fáciles.',
      fr:'Plus de bottes sur la carte. Moins de place pour les réponses faciles.'},
    'COMMAND CORE':{
      de:'Ein Ziel mit Mauern. Für die Leute dahinter ist es vermutlich mehr als ein Symbol.',
      en:'A target with walls. To the people behind them, it is probably more than a symbol.',
      es:'Un objetivo con muros. Para quienes están detrás, seguramente es más que un símbolo.',
      fr:'Une cible entourée de murs. Pour les gens derrière, c’est sans doute plus qu’un symbole.'},
    'RELAY NODE':{
      de:'Es sendet Befehle weiter. Leider auch die schlechten.',
      en:'It relays orders. Unfortunately, the bad ones too.',
      es:'Transmite órdenes. Por desgracia, también las malas.',
      fr:'Il transmet les ordres. Malheureusement, les mauvais aussi.'},
    'GUARD TANK':{
      de:'Er hält die Linie. Wer die Linie gezogen hat, sitzt selten darin.',
      en:'It holds the line. Whoever drew that line is rarely inside.',
      es:'Mantiene la línea. Quien la trazó rara vez va dentro.',
      fr:'Il tient la ligne. Celui qui l’a tracée se trouve rarement à bord.'},
    'RAIDER SKIMMER':{
      de:'Er gleitet übers Wasser. Vor der Verantwortung gleitet niemand davon.',
      en:'It glides over water. Nobody glides away from responsibility.',
      es:'Se desliza sobre el agua. De la responsabilidad no se escapa nadie.',
      fr:'Il glisse sur l’eau. Personne ne glisse hors de sa responsabilité.'},
    'FORGE ENGINEER':{
      de:'Reparieren klingt friedlich. Bis die Maschine wieder schießen kann.',
      en:'Repair sounds peaceful. Until the machine can fire again.',
      es:'Reparar suena pacífico. Hasta que la máquina puede volver a disparar.',
      fr:'Réparer semble pacifique. Jusqu’à ce que la machine puisse tirer à nouveau.'}
  };
  let currentName;
  function render(name){
    currentName=name;
    const lang=root.GoblinLanguage?.current||'de';
    document.querySelector('#guide-voice-label').textContent=labels[lang]||labels.de;
    document.querySelector('#guide-voice-copy').textContent=lines[name]?.[lang]||lines[name]?.de||'';
  }
  root.UnitGuideVoice=Object.freeze({lines,render});
  root.addEventListener?.('goblin-language-change',()=>{if(currentName)render(currentName)});
})(globalThis);
