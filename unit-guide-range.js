(function(root){
  'use strict';
  const labels={
    de:{move:'BEWEGUNG',attack:'ANGRIFF',hex:'Hex',none:'Keine Eigenbewegung',unarmed:'Kein Angriff',bonus:'Zusatzmanöver',maxWeapon:'Max. Reichweite intakter Waffen:',noWeapon:'Keine intakte Waffe',weapon:'Die gewählte Waffe kann kürzer reichen.',missile:'Rote Felder sind mögliche Einschlagziele; der Splash trifft Nachbarfelder des gewählten Ziels, auch außerhalb des roten Bereichs.',spent:'Rakete verbraucht.',preview:'Schematisch: freies Gelände, ohne Belegung, Sichtlinie und Phasenstatus.',catalog:'Katalogwert',live:'Aktueller Wert'},
    en:{move:'MOVEMENT',attack:'ATTACK',hex:'hexes',none:'No independent movement',unarmed:'No attack',bonus:'Extra maneuver',maxWeapon:'Max. range of intact weapons:',noWeapon:'No intact weapon',weapon:'The selected weapon may have shorter range.',missile:'Red hexes are possible impact targets; the blast hits neighbors of the chosen target, even outside the red area.',spent:'Missile spent.',preview:'Diagram: open terrain; occupancy, line of sight and phase status excluded.',catalog:'Catalog value',live:'Current value'},
    es:{move:'MOVIMIENTO',attack:'ATAQUE',hex:'hexágonos',none:'Sin movimiento propio',unarmed:'Sin ataque',bonus:'Maniobra adicional',maxWeapon:'Alcance máx. de armas intactas:',noWeapon:'Sin armas intactas',weapon:'El arma seleccionada puede tener menos alcance.',missile:'Los hexágonos rojos son posibles objetivos; la explosión alcanza a los vecinos del objetivo elegido, también fuera de la zona roja.',spent:'Misil agotado.',preview:'Esquema: terreno libre, sin ocupación, línea de visión ni estado de fase.',catalog:'Valor de catálogo',live:'Valor actual'},
    fr:{move:'DÉPLACEMENT',attack:'ATTAQUE',hex:'hexagones',none:'Aucun déplacement autonome',unarmed:'Aucune attaque',bonus:'Manœuvre supplémentaire',maxWeapon:'Portée max. des armes intactes :',noWeapon:'Aucune arme intacte',weapon:'L’arme choisie peut avoir une portée plus courte.',missile:'Les hexagones rouges sont des cibles possibles ; l’explosion touche les voisins de la cible choisie, même hors de la zone rouge.',spent:'Missile épuisé.',preview:'Schéma : terrain libre, sans occupation, ligne de vue ni état de phase.',catalog:'Valeur du catalogue',live:'Valeur actuelle'}
  };
  const language=()=>labels[root.GoblinLanguage?.current]||labels.de;
  const detailsLabels={de:'WERTE & RANDNOTIZ ↓',en:'STATS & MARGIN NOTE ↓',es:'DATOS Y NOTA AL MARGEN ↓',fr:'DONNÉES ET NOTE EN MARGE ↓'};
  const previewLabels={de:'Reichweitenvorschau',en:'Range preview',es:'Vista previa del alcance',fr:'Aperçu des portées'};
  const number=value=>Math.max(0,Number.parseInt(String(value),10)||0);
  function profile(entry,live){
    const movement=live?number(live.move):number(entry.move);
    const skimmer=/SKIMMER/.test(entry.name)&&entry.name!=='RAIDER SKIMMER';
    const bonus=skimmer?(live?2:number(String(entry.move).split('+')[1])):0;
    let range=live?number(live.range):number(String(entry.range).split(/[–-]/).at(-1));
    let weapon=false;
    if(entry.name==='GOBLIN SIEGEBREAKER'){
      weapon=true;
      if(live?.ogreSystems){
        const available=Object.values(live.ogreSystems.weapons||{}).filter(item=>Math.min(item.remaining,item.count-item.destroyed)>0).map(item=>number(item.range));
        range=available.length?Math.max(...available):0;
      }
    }
    const missile=entry.name==='STRATEGIC MISSILE CARRIER';
    if(missile&&live&&live.missilesRemaining<=0)range=0;
    return {movement,bonus,range,weapon,missile,spent:missile&&!!live&&live.missilesRemaining<=0,live:!!live};
  }
  const distance=(q,r)=>Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r));
  function mapSvg(profile,mode){
    const cells=[];
    const radius=8,size=8.5;
    for(let r=-radius;r<=radius;r++)for(let q=-radius;q<=radius;q++){
      const d=distance(q,r);if(d>radius)continue;
      const x=Math.sqrt(3)*size*(q+r/2),y=1.5*size*r;
      const points=Array.from({length:6},(_,i)=>{const a=Math.PI/180*(60*i-30);return `${(x+size*Math.cos(a)).toFixed(1)},${(y+size*Math.sin(a)).toFixed(1)}`}).join(' ');
      const kind=d===0?'origin':mode==='move'?(d<=profile.movement?'primary':d<=profile.movement+profile.bonus?'bonus':'empty'):(d<=profile.range?'attack':'empty');
      cells.push(`<polygon class="guide-range-cell ${kind}" points="${points}"/>`);
    }
    return `<svg class="guide-range-svg" viewBox="-135 -120 270 240" role="img" aria-hidden="true">${cells.join('')}<circle class="guide-range-center" cx="0" cy="0" r="3"/></svg>`;
  }
  let mode='move',current;
  function render(entry,live){
    current={entry,live};
    const p=profile(entry,live),l=language();
    const lang=root.GoblinLanguage?.current||'de';
    document.querySelector('#guide-details-jump').textContent=detailsLabels[lang]||detailsLabels.de;
    document.querySelector('.guide-range-panel').setAttribute('aria-label',previewLabels[lang]||previewLabels.de);
    for(const [key,label] of [['move',l.move],['attack',l.attack]]){
      const button=document.querySelector(`#guide-range-${key}`);
      button.textContent=label;
      button.setAttribute('aria-pressed',String(mode===key));
    }
    const summary=mode==='move'?(p.movement?`${p.movement} ${l.hex}`:l.none)+(p.bonus?` + ${p.bonus} ${l.hex} ${l.bonus.toLowerCase()}`:''):p.weapon?(p.range?`${l.maxWeapon} ${p.range} ${l.hex}`:l.noWeapon):(p.range?`${p.range} ${l.hex}`:l.unarmed);
    const note=mode==='attack'&&p.spent?l.spent:mode==='attack'&&p.missile?l.missile:mode==='attack'&&p.weapon?l.weapon:'';
    document.querySelector('#guide-range-map').innerHTML=mapSvg(p,mode);
    document.querySelector('#guide-range-summary').textContent=`${p.live?l.live:l.catalog} · ${summary}`;
    document.querySelector('#guide-range-note').textContent=[note,l.preview].filter(Boolean).join(' ');
  }
  for(const key of ['move','attack'])document.querySelector(`#guide-range-${key}`).onclick=()=>{mode=key;if(current)render(current.entry,current.live)};
  root.UnitGuideRange=Object.freeze({profile,render,mapSvg});
  root.addEventListener?.('goblin-language-change',()=>{if(current)render(current.entry,current.live)});
})(globalThis);
