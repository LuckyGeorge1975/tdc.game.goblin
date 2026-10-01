(function(root){
  const registry=new Map();
  const defaults=Object.freeze({kind:'vector',shape:'hex',scale:1});
  const styles=Object.freeze([
    Object.freeze({id:'01-modular-stealth-geometry',title:'Modular Stealth Geometry'}),
    Object.freeze({id:'02-industrial-exoframe',title:'Industrial Exoframe'}),
    Object.freeze({id:'03-monolithic-facet',title:'Monolithic Facet'}),
    Object.freeze({id:'04-autonomous-drone-corps',title:'Autonomous Drone Corps'}),
    Object.freeze({id:'05-aerospace-ground-force',title:'Aerospace Ground Force'}),
    Object.freeze({id:'06-technical-illustration',title:'Technische Illustration'})
  ]);
  const artKeys=new Set([
    'goblin-siegebreaker','skimmer-scout','rocket-artillery','infantry-squad','assault-tank',
    'recon-tank','siege-tank','long-range-battery','mobile-siege-gun','combat-skimmer',
    'light-skimmer','skimmer-carrier','strategic-missile-carrier','artillery-drone',
    'amphibious-infantry','field-engineers','local-defense','command-hub','goblin-dreadnaught',
    'forge-engineer','phantom-platform','infantry-platoon','command-core','relay-node',
    'guard-tank','raider-skimmer'
  ]);
  let activeStyle=null;
  const technicalStyle='06-technical-illustration';
  const terrainFallback='01-modular-stealth-geometry';

  function register(key,descriptor){
    if(!key||!descriptor)throw new Error('Visual key and descriptor are required.');
    registry.set(key,Object.freeze({...defaults,...descriptor}));
  }

  function artKey(unit){
    const byName=unit?.name?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return [unit?.visualKey,byName,unit?.id].find(key=>artKeys.has(key))||null;
  }

  function assetFor(unit,view='icons'){
    const key=artKey(unit);
    if(!activeStyle||!key||!['icons','library'].includes(view))return null;
    if(activeStyle===technicalStyle&&view==='library')return librarySymbolFor(unit);
    return `assets/unit-art/sets/${activeStyle}/${view}/${key}.svg`;
  }

  function librarySymbolFor(unit){
    const key=artKey(unit);
    return key?`assets/unit-art/library/military-symbols/${key}.svg`:null;
  }

  const terrainKeys=new Set(['open-ground','rubble-field','mountain','ridge','forest','marsh','water','river','road','bridge','urban','crater']);
  function terrainAssetFor(type){
    const style=activeStyle===technicalStyle?terrainFallback:activeStyle;
    return style&&terrainKeys.has(type)?`assets/unit-art/sets/${style}/terrain/${type}.svg`:null;
  }

  function setStyle(id){
    if(!styles.some(style=>style.id===id))return false;
    activeStyle=id;
    return true;
  }

  function currentStyle(){return activeStyle}

  function resolve(unit){
    const explicit=unit.visualKey&&registry.get(unit.visualKey);
    if(explicit)return explicit;
    const registered=registry.get(unit.id)||registry.get(unit.type);
    if(registered?.kind==='asset')return registered;
    const asset=assetFor(unit);
    return asset?{kind:'asset',asset,size:54}:registered||defaults;
  }

  function polygonPoints(shape,c,scale=1){
    const shapes={
      hex:[[0,-18],[15,-8],[12,10],[0,17],[-12,10],[-15,-8]],
      fortress:[[0,-20],[17,-13],[19,8],[10,17],[-10,17],[-19,8],[-17,-13]],
      skimmer:[[0,-17],[18,0],[9,14],[-9,14],[-18,0]],
      tracked:[[-17,-13],[13,-13],[18,-5],[14,14],[-14,14],[-18,-5]],
      infantry:[[0,-17],[14,-9],[14,9],[0,17],[-14,9],[-14,-9]],
      objective:[[-16,-16],[16,-16],[16,16],[-16,16]]
    };
    return (shapes[shape]||shapes.hex).map(([x,y])=>`${c.x+x*scale},${c.y+y*scale}`).join(' ');
  }

  function draw(group,unit,center,{ns,color,selected=false}={}){
    const visual=resolve(unit),namespace=ns||'http://www.w3.org/2000/svg';
    if(visual.asset){
      if(selected){
        const ring=document.createElementNS(namespace,'polygon');
        ring.setAttribute('points',polygonPoints('hex',center,1.26));
        ring.setAttribute('fill','none');
        ring.setAttribute('stroke','#d1f35a');
        ring.setAttribute('stroke-width','3');
        ring.classList.add('unit-selection-ring');
        group.appendChild(ring);
      }
      const size=visual.size||42,image=document.createElementNS(namespace,'image');
      image.setAttribute('href',visual.asset);
      image.setAttribute('x',center.x-size/2);
      image.setAttribute('y',center.y-size/2);
      image.setAttribute('width',size);
      image.setAttribute('height',size);
      image.setAttribute('preserveAspectRatio','xMidYMid meet');
      image.classList.add('unit-artwork');
      group.appendChild(image);
      return image;
    }
    const shape=document.createElementNS(namespace,'polygon');
    shape.setAttribute('points',polygonPoints(visual.shape,center,visual.scale));
    shape.setAttribute('fill',visual.fill||(unit.team==='player'?'#17302d':'#391e24'));
    shape.setAttribute('stroke',visual.stroke||color);
    shape.setAttribute('stroke-width',selected?'3':'1.5');
    shape.classList.add('unit-artwork');
    group.appendChild(shape);
    const text=document.createElementNS(namespace,'text');
    text.setAttribute('x',center.x);
    text.setAttribute('y',center.y+5);
    text.setAttribute('text-anchor','middle');
    text.classList.add('unit-label');
    text.textContent=visual.label||unit.icon;
    group.appendChild(text);
    return shape;
  }

  function setAsset(key,asset,options={}){
    if(!asset||/^(?:https?:)?\/\//i.test(asset))throw new Error('Unit artwork must use a local project path.');
    register(key,{...options,kind:'asset',asset});
  }

  register('ogre',{shape:'fortress',label:'G'});
  register('gev',{shape:'skimmer',label:'S'});
  register('gev-pc',{shape:'skimmer',label:'P'});
  register('raider',{shape:'skimmer',label:'R'});
  register('light-gev',{shape:'skimmer',label:'L'});
  register('infantry',{shape:'infantry',label:'I',scale:.92});
  register('core',{shape:'objective',label:'X'});
  register('missile',{shape:'tracked',label:'M'});
  register('missile-crawler',{shape:'tracked',label:'C'});
  register('heavy-tank',{shape:'tracked',label:'A'});
  register('light-tank',{shape:'tracked',label:'R'});
  register('guard',{shape:'tracked',label:'G'});

  root.UnitVisuals=Object.freeze({register,resolve,draw,setAsset,polygonPoints,styles,artKey,assetFor,librarySymbolFor,terrainAssetFor,setStyle,currentStyle});
})(globalThis);
