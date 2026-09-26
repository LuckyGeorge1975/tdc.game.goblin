(function(root){
  const registry=new Map();
  const defaults=Object.freeze({kind:'vector',shape:'hex',scale:1});

  function register(key,descriptor){
    if(!key||!descriptor)throw new Error('Visual key and descriptor are required.');
    registry.set(key,Object.freeze({...defaults,...descriptor}));
  }

  function resolve(unit){
    return registry.get(unit.visualKey)||registry.get(unit.id)||registry.get(unit.type)||defaults;
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
  register('heavy-tank',{shape:'tracked',label:'A'});
  register('light-tank',{shape:'tracked',label:'R'});
  register('guard',{shape:'tracked',label:'G'});

  root.UnitVisuals=Object.freeze({register,resolve,draw,setAsset,polygonPoints});
})(globalThis);
