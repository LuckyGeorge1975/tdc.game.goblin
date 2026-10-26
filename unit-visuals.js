(function(root){
  const registry=new Map();
  const defaults=Object.freeze({kind:'vector',shape:'hex',scale:1});
  const fixedStyle='02-technical-illustration';
  const styles=Object.freeze([Object.freeze({id:fixedStyle,title:'Technische Illustration'})]);
  const artKeys=new Set([
    'goblin-siegebreaker','skimmer-scout','rocket-artillery','infantry-squad','assault-tank',
    'recon-tank','siege-tank','long-range-battery','mobile-siege-gun','combat-skimmer',
    'light-skimmer','skimmer-carrier','strategic-missile-carrier','artillery-drone',
    'amphibious-infantry','field-engineers','local-defense','command-hub','goblin-dreadnaught',
    'forge-engineer','phantom-platform','infantry-platoon','command-core','relay-node',
    'guard-tank','raider-skimmer'
  ]);
  const terrainFallback='01-modular-stealth-geometry';
  const fixedAssetPrefix=`assets/unit-art/sets/${fixedStyle}/`;
  const mapIconPrefix=`${fixedAssetPrefix}map-icons/`;
  const mapIconSize=Math.sqrt(3)*34*100/112;
  const failedMapAssets=new Set();
  const pendingMapAssets=new Map();

  function register(key,descriptor){
    if(!key||!descriptor)throw new Error('Visual key and descriptor are required.');
    registry.set(key,Object.freeze({...defaults,...descriptor}));
  }

  function artKey(unit){
    const byName=unit?.name?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    return [unit?.visualKey,byName,unit?.id].find(key=>artKeys.has(key))||null;
  }

  function assetFor(unit,view='icons',format='png'){
    const key=artKey(unit);
    if(!key||!['icons','library'].includes(view))return null;
    if(view==='library'){
      if(!['png','webp'].includes(format))return null;
      return `${fixedAssetPrefix}${view}/${key}@${format==='webp'?'1024':'768'}.${format}`;
    }
    const side=unit?.team==='player'?'own':unit?.team==='enemy'?'enemy':null;
    const asset=side?`${mapIconPrefix}${side}/${key}.webp`:null;
    return failedMapAssets.has(asset)?null:asset;
  }

  const terrainKeys=new Set(['open-ground','rubble-field','mountain','ridge','forest','marsh','water','river','road','bridge','urban','crater']);
  function terrainAssetFor(type){
    return terrainKeys.has(type)?`assets/unit-art/sets/${terrainFallback}/terrain/${type}.svg`:null;
  }

  function setStyle(id){
    return id===fixedStyle;
  }

  function currentStyle(){return fixedStyle}

  function resolveVector(unit){
    return [unit.visualKey,unit.id,unit.type].map(key=>registry.get(key))
      .find(visual=>visual&&visual.kind!=='asset')||defaults;
  }

  function resolve(unit){
    const mapAsset=assetFor(unit);
    if(mapAsset)return {kind:'asset',asset:mapAsset,size:mapIconSize};
    if(artKey(unit)&&['player','enemy'].includes(unit.team))return resolveVector(unit);
    const explicit=unit.visualKey&&registry.get(unit.visualKey);
    if(explicit&&(explicit.kind!=='asset'||explicit.asset?.startsWith(fixedAssetPrefix)))return explicit;
    const registered=registry.get(unit.id)||registry.get(unit.type);
    if(registered?.kind==='asset'&&registered.asset?.startsWith(fixedAssetPrefix))return registered;
    return registered?.kind==='asset'?defaults:registered||defaults;
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
  // Read only the settled presentation belonging to this exact displayed unit.
  function mapAngle(unit){
    try{
    const owner=root.GoblinPresentation,sidecar=owner?.read(),state=owner?.endState();
    if(!sidecar||sidecar.schemaVersion!==1||!['core','legacy'].includes(sidecar.binding?.runtime)||
      sidecar.mappingVersion!=='movement-facing-v1'||
      sidecar.visualConfigVersion!=='instant-off-v1'||
      !owner.owns(sidecar.binding?.runtime)||!state||
      sidecar.settledRevision!==root.GoblinPresentationState?.stamp(state))return 0;
    const id=unit.id??unit.unitId,key=artKey(unit),position=unit.position??unit;
    const actual=state.units.find(item=>item.id===id);
    const facing=sidecar.facingByUnit.find(item=>item.unitId===id);
    if(!actual||!facing||actual.team!==unit.team||facing.team!==unit.team||
      actual.visualKey!==key||facing.visualKey!==key||
      actual.x!==position.x||actual.y!==position.y||
      !Number.isFinite(facing.angleDegrees)||facing.angleDegrees<0||facing.angleDegrees>=360)return 0;
    return facing.angleDegrees-(unit.team==='enemy'?180:0);
    }catch{return 0;}
  }

  function sortMapUnits(units){
    return units.slice().sort((a,b)=>{
      // Keep existing wrecks below live units; only reorder inside the unit layer.
      const layer=(a.hp>0?1:0)-(b.hp>0?1:0),depth=a.y-b.y;
      return layer||depth||(String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
    });
  }

  function boundsFor(unit){
    const visual=resolve(unit);
    if(visual.asset){
      const measured=root.GoblinMarkerGeometry?.icons[visual.asset];
      if(!measured)return null;
      const [left,top,right,bottom]=measured.bounds,size=visual.size||42;
      const angle=mapAngle(unit)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      const corners=[[left,top],[right,top],[right,bottom],[left,bottom]].map(([x,y])=>{
        x=(x/measured.width-.5)*size;y=(y/measured.height-.5)*size;
        return [x*cos-y*sin,x*sin+y*cos];
      });
      return {kind:'asset',left:Math.min(...corners.map(p=>p[0])),top:Math.min(...corners.map(p=>p[1])),
        right:Math.max(...corners.map(p=>p[0])),bottom:Math.max(...corners.map(p=>p[1]))};
    }
    const points=polygonPoints(visual.shape,{x:0,y:0},visual.scale).split(' ')
      .map(pair=>pair.split(',').map(Number));
    // The existing fallback polygon has a 1.5 SVG-unit stroke in M1 (unselected).
    return {kind:'vector',left:Math.min(...points.map(point=>point[0]))-.75,
      top:Math.min(...points.map(point=>point[1]))-.75,
      right:Math.max(...points.map(point=>point[0]))+.75,bottom:Math.max(...points.map(point=>point[1]))+.75};
  }

  function watchMapImage(image,asset,fallback){
    if(failedMapAssets.has(asset)){fallback();return false}
    let pending=pendingMapAssets.get(asset);
    if(!pending)pendingMapAssets.set(asset,pending=new Set());
    const cleanup=()=>{pending.delete(fallback);if(!pending.size)pendingMapAssets.delete(asset)};
    pending.add(fallback);
    image.onload=cleanup;
    image.onerror=()=>{
      failedMapAssets.add(asset);
      const callbacks=[...(pendingMapAssets.get(asset)||[])];
      pendingMapAssets.delete(asset);
      callbacks.forEach(callback=>callback());
      if(root.dispatchEvent&&root.Event)root.dispatchEvent(new root.Event('goblin-unit-art-fallback'));
    };
    return true;
  }

  function iconElement(unit,className=''){
    const vector=()=>{
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','-24 -24 48 48');
      svg.setAttribute('aria-hidden','true');
      svg.setAttribute('class',className);
      draw(svg,unit,{x:0,y:0},{color:unit.team==='enemy'?'#e59191':'#9dc8ba',vectorOnly:true});
      return svg;
    };
    const asset=assetFor(unit);
    if(!asset)return vector();
    const image=document.createElement('img');
    image.alt='';image.className=className;
    watchMapImage(image,asset,()=>image.replaceWith(vector()));
    image.src=asset;
    return image;
  }

  function draw(group,unit,center,{ns,color,selected=false,vectorOnly=false,map=false}={}){
    const visual=vectorOnly?resolveVector(unit):resolve(unit),namespace=ns||'http://www.w3.org/2000/svg';
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
      image.setAttribute('x',center.x-size/2);
      image.setAttribute('y',center.y-size/2);
      image.setAttribute('width',size);
      image.setAttribute('height',size);
      image.setAttribute('preserveAspectRatio','xMidYMid meet');
      image.classList.add('unit-artwork');
      let sprite=image;
      if(map){
        sprite=document.createElementNS(namespace,'g');
        sprite.classList.add('unit-sprite-shadow');
        // Prototype reference: offsets 3/4.5, blur 4 at a 100px sprite.
        const scale=size/100;
        sprite.setAttribute('style',`filter:drop-shadow(${3*scale}px ${4.5*scale}px ${4*scale}px rgba(8,10,14,.5))`);
        image.setAttribute('transform',`rotate(${mapAngle(unit)} ${center.x} ${center.y})`);
        sprite.appendChild(image);
      }
      group.appendChild(sprite);
      watchMapImage(image,visual.asset,()=>{
        const replacement=document.createElementNS(namespace,'g');
        draw(replacement,unit,center,{ns:namespace,color,selected,vectorOnly:true});
        sprite.replaceWith(replacement);
      });
      image.setAttribute('href',visual.asset);
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
    if(!asset?.startsWith(fixedAssetPrefix))throw new Error('Unit artwork must use the fixed technical illustration set.');
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

  root.UnitVisuals=Object.freeze({register,resolve,draw,iconElement,watchMapImage,boundsFor,mapAngle,sortMapUnits,
    assetFailed:asset=>failedMapAssets.has(asset),setAsset,polygonPoints,styles,artKey,assetFor,terrainAssetFor,setStyle,currentStyle});
})(globalThis);
