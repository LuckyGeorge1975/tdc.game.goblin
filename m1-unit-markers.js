(function(root){
  const NS='http://www.w3.org/2000/svg';
  const size=34, referenceScale=Math.sqrt(3)*size/112;
  const legacyProfiles=new Set(['FIELD_TEST_LEGACY_v1','FIELD_TEST_LEGACY_v2',
    'LEGACY_SUPERCOVER_PROBE_v1','FIELD_TEST_SUPERCOVER_v1','CATALOG_ARTILLERY_PILOT_v1','CATALOG_SIEGE_PILOT_v1','CATALOG_SKIMMER_PILOT_v1']);
  const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
  const amount=(current,maximum)=>Number.isFinite(current)&&Number.isFinite(maximum)&&maximum>0
    ?{current,maximum}:null;

  function snapshot(binding,roster,code,memberIds,outcome){
    const units=roster.map(unit=>{
      const systems=copy(unit.ogreSystems);
      return {unitId:unit.id,name:unit.name,team:unit.team,type:unit.type,visualKey:unit.visualKey,
        position:{x:unit.x,y:unit.y},mapVisible:!unit.embarkedOn,
        status:unit.hp<=0?'destroyed':unit.disabled?'disabled':'active',
        vitality:{kind:systems?'system-carrier':unit.infantry?'infantry-strength':'hp',
          ...(amount(unit.hp,unit.maxHp)||{current:null,maximum:null})},systems};
    });
    return {binding:{...binding},supported:true,units,objective:{code,outcome,
      members:memberIds.map(unitId=>{
        const unit=roster.find(item=>item.id===unitId);
        return {unitId,requirement:'destroy',state:!unit?'unsupported':unit.hp<=0?'satisfied':'pending'};
      })}};
  }
  const unsupported=binding=>({binding:{...binding},supported:false,units:[],objective:null});
  function legacy(session,roster,revision,outcome){
    const binding={scenarioId:session?.scenarioId,profileId:session?.ruleProfileId,
      sessionId:session?.sessionId,revision};
    const rules=session?.effectiveRules;
    if(!Object.isFrozen(session)||!Object.isFrozen(rules)||!legacyProfiles.has(binding.profileId)||
        rules?.objectiveVersion!==1||!['core','core-and-escort'].includes(rules.objective)||
        !Array.isArray(rules.units))return unsupported(binding);
    if(binding.profileId==='CATALOG_SKIMMER_PILOT_v1'&&(binding.scenarioId!=='skimmer-pilot'||session.scenarioVersion!==1||rules.movement?.version!=='skimmer-pilot-budget-v1'||rules.sourceDigest!==root.GoblinSkimmerPilot?.digest))return unsupported(binding);
    if(binding.profileId==='CATALOG_SIEGE_PILOT_v1'&&(binding.scenarioId!=='siege-pilot'||session.scenarioVersion!==1||rules.fireBudgetVersion!=='siege-tank-fire-budget-v1'||rules.sourceDigest!==root.GoblinSiegePilot?.digest))return unsupported(binding);
    if(binding.profileId==='CATALOG_ARTILLERY_PILOT_v1'&&(binding.scenarioId!=='artillery-pilot'||session.scenarioVersion!==1||rules.losMode!=='strict-supercover'||rules.fireBudgetVersion!=='artillery-spotter-v1'||rules.sourceDigest!==root.GoblinArtilleryPilot?.digest))return unsupported(binding);
    const enemies=rules.units.filter(unit=>unit.team==='enemy');
    const members=rules.objective==='core'?enemies.filter(unit=>unit.core):enemies;
    if(!members.length||(rules.objective==='core'&&members.length!==1))return unsupported(binding);
    return snapshot(binding,roster,rules.objective,members.map(unit=>unit.id),outcome);
  }
  function core(view,epoch,revision){
    const binding={scenarioId:'iron-dust-v2',profileId:view?.ruleProfileId,epoch,revision};
    if(view?.profileVersion!=='core-iron-dust-profile-v1'||binding.profileId!=='CORE_IRON_DUST_v2'||
        !view.units.some(unit=>unit.id==='core'&&unit.team==='enemy'))return unsupported(binding);
    return snapshot(binding,view.units,'core',['core'],view.victory.status==='ended'
      ?view.victory.winner==='player':null);
  }
  function damage(unit){
    const value=unit.systems?amount(unit.systems.treads,unit.systems.maxTreads):
      amount(unit.vitality.current,unit.vitality.maximum);
    return {kind:unit.systems?'treads':unit.vitality.kind,...value,
      segments:value?Array.from({length:3},(_,i)=>Math.max(0,Math.min(1,3*value.current/value.maximum-i))):null,
      destroyedWeapons:unit.systems?Object.values(unit.systems.weapons||{})
        .reduce((sum,weapon)=>sum+(Number.isFinite(weapon.destroyed)?weapon.destroyed:0),0):0};
  }
  const node=(tag,attrs={})=>{
    const element=document.createElementNS(NS,tag);
    for(const [key,value] of Object.entries(attrs))element.setAttribute(key,value);
    return element;
  };
  const center=cell=>({x:58+cell.x*Math.sqrt(3)*size+(cell.y%2?Math.sqrt(3)*size/2:0),y:48+cell.y*1.5*size});
  function hex(cell,scale=1){
    const c=center(cell);
    return Array.from({length:6},(_,i)=>{
      const angle=Math.PI/3*i+Math.PI/6;
      return `${c.x+size*scale*Math.cos(angle)},${c.y+size*scale*Math.sin(angle)}`;
    }).join(' ');
  }
  function pinLayout(unit){
    const below=unit.position.y===0;
    const asset=`assets/unit-art/markers/objective-pin${below?'-below':''}.webp`;
    if(root.UnitVisuals?.assetFailed(asset))return null;
    const pin=root.GoblinMarkerGeometry?.pins[asset];
    const icon=root.UnitVisuals?.boundsFor({...unit,id:unit.unitId});
    if(!pin||!icon)return null;
    const c=center(unit.position),width=pin.referenceCanvas[0]*referenceScale,
      height=pin.referenceCanvas[1]*referenceScale;
    const [left,top,right,bottom]=pin.bounds;
    const tip=(below?top/pin.height-.5:bottom/pin.height-.5)*height;
    const desiredTip=(below?icon.bottom:icon.top)+(below?4:-4)*referenceScale;
    const x=c.x-width/2,y=c.y-height/2+desiredTip-tip;
    return {asset,x,y,width,height,iconKind:icon.kind,
      bounds:{left:x+left/pin.width*width,top:y+top/pin.height*height,
        right:x+right/pin.width*width,bottom:y+bottom/pin.height*height}};
  }
  function obstacles(data,{targetsVisible=true}={}){
    if(!data?.supported||!targetsVisible)return [];
    return data.units.filter(unit=>unit.mapVisible&&data.objective.members
      .some(member=>member.unitId===unit.unitId&&member.state==='pending'))
      .map(pinLayout).filter(Boolean).map(layout=>layout.bounds);
  }
  function render(map,data,{actor,target,focus,t,targetsVisible=true,damageVisible=true}={}){
    map.querySelector('#v2-m1-markers')?.remove();
    // Old UI-V2 layers may still exist during an in-place render transition.
    for(const id of ['v2-team-markers','v2-actor-marker','v2-target-marker','v2-focus-marker'])
      map.querySelector(`#${id}`)?.remove();
    if(!data?.supported)return;
    const layer=node('g',{id:'v2-m1-markers','pointer-events':'none','data-revision':data.binding.revision});
    const pins=node('g',{'class':'m1-objective-pins'});
    for(const unit of data.units.filter(unit=>unit.mapVisible)){
      const c=center(unit.position),value=damage(unit);
      const label=`${unit.name} · ${t(unit.team==='player'?'ui.team.player':'ui.team.enemy')} · ${t(`v2.ui.${unit.status==='active'?'ready':unit.status}`)}`;
      const group=node('g',{'data-unit-id':unit.unitId,role:'img','aria-label':label});
      if(damageVisible&&unit.status!=='destroyed'&&value.segments){
        const title=node('title');title.textContent=`${t(value.kind==='treads'?'v2.ui.treads':value.kind==='infantry-strength'?'v2.ui.strength':'v2.ui.hitPoints')} ${value.current}/${value.maximum}`;
        group.append(title);
        value.segments.forEach((fill,index)=>{
          const x=c.x+((index-1)*14-5.5)*referenceScale,y=c.y-.70*size-2.5*referenceScale;
          group.append(node('rect',{x,y,width:11*referenceScale,height:5*referenceScale,rx:referenceScale,
            class:'m1-damage-empty'}));
          if(fill>0)group.append(node('rect',{x,y,width:11*referenceScale*fill,height:5*referenceScale,
            class:'m1-damage-fill','data-fraction':fill}));
          group.append(node('rect',{x,y,width:11*referenceScale,height:5*referenceScale,rx:referenceScale,
            class:'m1-damage-border'}));
        });
      }
      function badge(text,className,x,y,description){
        const mark=node('text',{x:c.x+x*referenceScale,y:c.y+y*referenceScale,class:className,
          'aria-label':description});mark.textContent=text;group.append(mark);
      }
      if(unit.status==='disabled')badge('!','m1-status',-31,-40,t('v2.ui.disabled'));
      if(unit.status!=='destroyed'&&value.destroyedWeapons>0)
        badge('×','m1-weapon-damage',46,-40,t('v2.ui.weaponDamage',{count:value.destroyedWeapons}));
      layer.append(group);
      if(targetsVisible&&data.objective.members.some(member=>member.unitId===unit.unitId&&member.state==='pending')){
        const layout=pinLayout(unit);
        if(!layout)continue;
        const pin=node('image',{x:layout.x,y:layout.y,width:layout.width,height:layout.height,class:'m1-objective-pin',
          'data-unit-id':unit.unitId,role:'img','aria-label':`${t('ui.hud.objective')}: ${unit.name}`});
        pins.append(pin);
        if(root.UnitVisuals.watchMapImage(pin,layout.asset,()=>pin.remove()))pin.setAttribute('href',layout.asset);
      }
    }
    // User decision: interaction contours stay visible above mission pins.
    layer.append(pins);
    function ring(id,cell,kind){
      if(!cell)return;
      const group=node('g',{id,role:'img','aria-label':t(`v2.ui.marker.${kind}`,{unit:actor?.name||'',hex:`${String.fromCharCode(65+cell.x)}-${String(cell.y+1).padStart(2,'0')}`})});
      for(const part of ['outer','inner'])group.append(node('polygon',{
        points:hex(cell,.94),class:`m1-ring m1-ring-${part} m1-ring-${kind}`,
        'stroke-width':(part==='outer'?4.5:1.5)*referenceScale}));
      layer.append(group);
    }
    ring('v2-actor-marker',actor,'selected');
    if(!actor||target?.x!==actor.x||target?.y!==actor.y)ring('v2-target-marker',target,'target');
    if(focus)layer.append(node('polygon',{id:'v2-focus-marker',points:hex(focus),role:'img',
      'aria-label':t('v2.ui.marker.focus',{hex:`${String.fromCharCode(65+focus.x)}-${String(focus.y+1).padStart(2,'0')}`})}));
    map.append(layer);
  }
  root.M1UnitMarkers=Object.freeze({legacy,core,damage,pinLayout,obstacles,render});
})(globalThis);
