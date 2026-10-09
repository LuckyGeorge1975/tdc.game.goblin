(function(root){
  // Independent G.O.B.L.I.N. playtest rules. A cell's artwork and mechanics
  // share this stable type key; no visual theme changes gameplay.
  const rules=Object.freeze({
    'open-ground':{label:'OFFENES GELÄNDE',cost:1,cover:0,blocksLos:false,note:'Normale Bewegung; keine Deckung.'},
    'rubble-field':{label:'TRÜMMERFELD',cost:2,cover:1,blocksLos:true,note:'Schwer passierbar, Deckung +1; blockiert Sichtlinien dahinter.'},
    mountain:{label:'BERG',cost:2,cover:1,blocksLos:true,note:'Passierbar mit Kosten 2, Deckung +1; blockiert Sichtlinien dahinter.'},
    ridge:{label:'HÖHENRÜCKEN',cost:2,cover:1,blocksLos:true,note:'Passierbar mit Kosten 2, Deckung +1; blockiert Sichtlinien dahinter.'},
    forest:{label:'WALD',cost:2,cover:1,blocksLos:true,note:'Verlangsamt alle beweglichen Einheiten; Deckung +1 und Sichtblocker.'},
    marsh:{label:'SUMPF',cost:2,hoverCost:1,cover:0,blocksLos:false,note:'Kettenfahrzeuge und Infanterie zahlen 2; Skimmer gleiten für 1 darüber.'},
    water:{label:'WASSER',cost:Infinity,hoverCost:1,amphibiousCost:1,cover:0,blocksLos:false,note:'Nur Skimmer und amphibische Infanterie können das Feld betreten.'},
    river:{label:'FLUSS',cost:Infinity,hoverCost:1,amphibiousCost:1,cover:0,blocksLos:false,note:'Nur Skimmer und amphibische Infanterie können den Fluss betreten.'},
    road:{label:'STRASSE',cost:1,cover:0,blocksLos:false,note:'Normale Bewegung; keine Deckung.'},
    bridge:{label:'BRÜCKE',cost:1,cover:0,blocksLos:false,note:'Übergang für alle beweglichen Einheiten; keine Deckung.'},
    urban:{label:'STADTGEBIET',cost:2,cover:1,blocksLos:true,note:'Bewegungskosten 2, Deckung +1 und Sichtblocker.'},
    crater:{label:'KRATER',cost:2,hoverCost:1,cover:1,blocksLos:false,note:'Deckung +1; Kosten 2 am Boden, 1 für Skimmer. Freie Sicht darüber.'}
  });
  for(const value of Object.values(rules))Object.freeze(value);
  function get(type){return rules[type]||rules['open-ground']}
  function movementCost(type,unit){
    const rule=get(type),mode=typeof unit==='string'?unit:unit?.movementMode||(unit?.gev?'gev':unit?.infantry?'infantry':unit?.move===0?'fixed':'tracked');
    if(mode==='fixed')return Infinity;
    if(unit?.amphibious&&rule.amphibiousCost!==undefined)return rule.amphibiousCost;
    if(mode==='gev'&&rule.hoverCost!==undefined)return rule.hoverCost;
    return rule.cost;
  }
  function coverBonus(type){return get(type).cover}
  function blocksLos(type){return get(type).blocksLos}
  const api=Object.freeze({rules,get,movementCost,coverBonus,blocksLos});
  root.TerrainRules=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
