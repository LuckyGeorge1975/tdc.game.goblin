// Accepted fire facts -> a pure timeline. No resolver, command, or gameplay randomness.
(function(root){
  const scale=Math.sqrt(3)*34/112,iconScale=100*scale/256;
  const center=u=>({x:58+Math.sqrt(3)*34*(u.x+(u.y%2)/2),y:48+51*u.y});
  const copy=value=>JSON.parse(JSON.stringify(value));
  const out=t=>1-(1-t)**3,io=t=>t<.5?4*t*t*t:1-(-2*t+2)**3/2;
  const clamp=t=>Math.max(0,Math.min(1,t));
  const normalize=a=>(a%360+360)%360;
  const shortest=a=>{const value=normalize(a+180)-180;return value===-180?180:value;};
  const weapons={cannon:[16,5,1,1500,32,0],twin:[15,6,1,1500,32,0],quad:[19,7,2,1400,32,70],
    longgun:[22,8,2,950,40,0],lightgun:[9,2,0,1800,32,0],light:[9,2,0,1800,32,0],rifles:[7,0,0,2000,18,55]};
  function mapping(event){
    const key=event.actor.visualKey,record=root.GoblinFireAnchors?.[key],side=event.actor.team==='enemy'?'enemy':'own';
    const used=event.weapon.usedWeaponKey;
    if(event.weapon.semanticKind||used==='missiles'||['rockets','missile'].includes(record?.klasse))
      return {version:'fire-mapping-v1',kind:'deferred-rocket',anchors:[],fallback:false};
    // The supplied GOBLIN twin group has no per-weapon provenance. Do not reuse it for main/AP/etc.
    const fallback=!record||record.klasse==='none'||key==='goblin-siegebreaker'&&used!==null;
    return {version:'fire-mapping-v1',kind:fallback?'light':record.klasse,
      anchors:fallback?[[0,0]]:record[side],fallback,
      provenance:fallback?'spec-6-explicit-center-fallback':'pinned-anchors.json'};
  }
  function muzzle(point,anchor,angle,team){
    const rotation=(angle-(team==='enemy'?180:0))*Math.PI/180;
    const x=anchor[0]*iconScale*(team==='enemy'?-1:1),y=anchor[1]*iconScale;
    return {x:point.x+x*Math.cos(rotation)-y*Math.sin(rotation),y:point.y+x*Math.sin(rotation)+y*Math.cos(rotation)};
  }
  function delta(effect){
    const a=effect.before,b=effect.after;
    const hp=Math.max(0,a.hp-b.hp),treads=Math.max(0,(a.ogreSystems?.treads??0)-(b.ogreSystems?.treads??0));
    const systems=Object.entries(a.ogreSystems?.weapons??{}).reduce((sum,[key,value])=>
      sum+Math.max(0,(b.ogreSystems?.weapons?.[key]?.destroyed??0)-(value.destroyed??0)),0);
    return {hp,treads,systems,disabled:!!(!a.disabled&&b.disabled),changed:!!(hp>0||treads>0||systems>0||!a.disabled&&b.disabled),
      label:treads?`−${treads} ${root.GoblinLanguage?.t('v2.ui.treads')??'TREADS'}`:
        systems?`−${systems} ${root.GoblinLanguage?.t('v2.ui.weaponDamage',{count:systems})??'SYSTEM'}`:
          hp?`−${hp} ${a.infantry||a.engineering?'SP':'HP'}`:
            !a.disabled&&b.disabled?(root.GoblinLanguage?.t('v2.ui.disabled')??'DISABLED'):null};
  }
  function plan(event,initial){
    const target=event.before.units.find(unit=>unit.id===event.targetId),actor=event.before.units.find(unit=>unit.id===event.actor.unitId);
    if(!target||!actor)return {diagnostic:'INCOMPLETE_CONFIRMED_FIRE',duration:0};
    const a=center(actor),b=center(target),angle=normalize(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI),turnDelta=shortest(angle-initial);
    const turn=Math.abs(turnDelta)<1.5?0:60+50*Math.abs(turnDelta)/60,shotAt=turn+(turn?30:0);
    const map=mapping(event),config=map.kind==='deferred-rocket'?[0,0,0,1,0,0]:weapons[map.kind]??weapons.light,shots=[];
    if(map.kind!=='deferred-rocket')for(const [i,anchor]of (map.anchors??[]).entries()){
      const jitter=map.kind==='rifles'?(root.GoblinPresentationState?.visualRandom(event.eventId,`rifle-delay/${i}`)??0)*50:0;
      const origin=muzzle(a,anchor,angle,actor.team),at=shotAt+i*config[5]+jitter;
      const flight=Math.max(80,Math.hypot(b.x-origin.x,b.y-origin.y)/(config[3]*scale)*1000);
      shots.push({origin,target:b,at,arrival:at+20+flight,flight});
    }
    // All decorative muzzles share one confirmed result time, never one damage event per barrel.
    const arrival=shots.length?Math.max(...shots.map(shot=>shot.arrival)):shotAt;
    const after=copy(event.after),hitState=copy(event.before);
    for(const effect of event.effects){const index=hitState.units.findIndex(unit=>unit.id===effect.subjectId);
      if(index>=0)hitState.units[index]=copy(effect.after);}
    const facing={...event.actor,angle},speed=actor.team==='enemy'?1.3:1;
    return {kind:'fire',map,config,actor,target,angle,initial,turnDelta,turn,shotAt,shots,arrival,
      duration:(arrival+850)/speed,finalHeading:angle,speed,hitState,after,facing};
  }
  function sample(plan,elapsed,event){
    const time=elapsed*plan.speed,angle=time<plan.turn?normalize(plan.initial+plan.turnDelta*io(clamp(time/plan.turn))):plan.angle;
    const recoilAge=time-plan.shotAt,recoil=plan.config[1]*scale*(recoilAge<0?0:recoilAge<40?out(recoilAge/40):recoilAge<200?1-io((recoilAge-40)/160):0);
    const a=angle*Math.PI/180,age=time-plan.arrival;
    const state=age>=50?plan.hitState:event.before;
    return {state,time,angle,age,plan,recoil:{x:-Math.cos(a)*recoil,y:-Math.sin(a)*recoil},
      effects:event.effects.map(effect=>({...effect,delta:delta(effect),age})),high:event.action.animationPreference.mode==='high'};
  }
  function paint({value,layer,units,node,id}){
    const fire=value.fire,p=fire.plan,a=p.angle*Math.PI/180,defs=node('defs');layer.appendChild(defs);
    function gradient(name,stops){
      const gradient=node('radialGradient',{id:`${id}-${name}`,cx:'50%',cy:'50%',r:'50%'});
      for(const [offset,color,opacity]of stops)gradient.appendChild(node('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
      defs.appendChild(gradient);return `url(#${id}-${name})`;
    }
    const flashFill=gradient('flash',[['0%','#fffbe0',1],['35%','#fff1b0',1],['70%','#ffad38',.85],['100%','#ff8b20',0]]);
    function puff(point,radius,opacity,color,name){
      layer.appendChild(node('circle',{cx:point.x,cy:point.y,r:radius,opacity,
        fill:gradient(name,[['0%',color,1],['100%',color,0]])}));
    }
    function flash(point,age,size,duration,angle=0,round=false){
      if(age<0||age>=duration)return;
      const k=age/duration,growth=k<.3?.35+.65*k/.3:1-(k-.3)/.7,r=size*growth*scale;
      const g=node('g',{transform:`translate(${point.x} ${point.y}) rotate(${angle})`});
      g.appendChild(node('circle',{cx:0,cy:0,r:r*.55,fill:flashFill}));
      if(!round)g.appendChild(node('path',{d:`M0 ${-r*.38} L${r*2.2} 0 L0 ${r*.38} Z`,fill:flashFill}));layer.appendChild(g);
    }
    for(const item of units){
      const unit=item.unit,c=center(unit),actor=unit.id===value.event.actor.unitId;
      if(actor){item.group.setAttribute('transform',`translate(${fire.recoil.x} ${fire.recoil.y})`);
        item.group.querySelector('.unit-artwork')?.setAttribute('transform',`rotate(${fire.angle-(unit.team==='enemy'?180:0)} ${c.x} ${c.y})`);}
    }
    for(const [index,shot]of p.shots.entries()){
      const age=fire.time-shot.at;
      flash({x:shot.origin.x+Math.cos(a)*3*scale,y:shot.origin.y+Math.sin(a)*3*scale},age,p.config[0],p.map.kind==='rifles'?70:100,p.angle);
      const progress=(age-20)/shot.flight;
      if(progress>=0&&progress<=1){
        const dx=shot.target.x-shot.origin.x,dy=shot.target.y-shot.origin.y,distance=Math.hypot(dx,dy);
        const tail=Math.max(0,progress-p.config[4]*scale/distance);
        const attrs={x1:shot.origin.x+dx*tail,y1:shot.origin.y+dy*tail,x2:shot.origin.x+dx*progress,y2:shot.origin.y+dy*progress,'stroke-linecap':'round'};
        for(const [name,color,width]of [['glow',value.event.actor.team==='enemy'?'#ff674d':'#ffc16e',5],['core','#fff1cf',2]]){
          const gradient=node('linearGradient',{id:`${id}-tracer-${index}-${name}`,gradientUnits:'userSpaceOnUse',
            x1:attrs.x1,y1:attrs.y1,x2:attrs.x2,y2:attrs.y2});
          gradient.appendChild(node('stop',{offset:0,'stop-color':color,'stop-opacity':0}));
          gradient.appendChild(node('stop',{offset:1,'stop-color':color,'stop-opacity':name==='glow'?.9:1}));defs.appendChild(gradient);
          layer.appendChild(node('line',{...attrs,stroke:`url(#${id}-tracer-${index}-${name})`,'stroke-width':width*scale}));
        }
      }
      if(fire.high&&p.config[2]&&age>=30&&age<480){
        const k=(age-30)/450,travel=out(k);
        for(let q=0;q<p.config[2];q++)puff({x:shot.origin.x+Math.cos(a)*(10+travel*(16+q*8))*scale,
          y:shot.origin.y+Math.sin(a)*(10+travel*(16+q*8))*scale},(5+(10+q*4)*travel)*scale,.42*(1-k)**1.4,'#d2d2cd',`smoke-${index}-${q}`);
      }
    }
    for(const [index,effect]of fire.effects.entries()){
      const {delta,age}=effect;if(!delta.changed||age<0)continue;
      const c=center(effect.after),old=effect.before,art=units.find(item=>item.unit.id===effect.subjectId);
      const dead=effect.after.hp<=0&&age>=120,knock=age<50?4*out(age/50):age<250?4*(1-io((age-50)/200)):0;
      const shake=fire.high&&age<300?3*(1-age/300):0;
      const rocket=p.map.kind==='deferred-rocket';
      const offset={x:(rocket?0:Math.cos(a)*knock)*scale+Math.sin(age*.001*34*2*Math.PI)*shake*scale,
        y:(rocket?0:Math.sin(a)*knock)*scale+Math.sin(age*.001*29*2*Math.PI)*shake*.65*scale};
      if(art&&!dead)art.group.setAttribute('transform',`translate(${offset.x} ${offset.y})`);
      if(!dead&&art&&age<280){
        const image=art.group.querySelector('.unit-artwork');
        if(image){
          for(const [color,opacity]of [['#ff4438',.45*(1-io(clamp(age/280)))],['white',age<70?.85*(1-out(age/70)):0]]){
          if(opacity<=0)continue;
          const tintId=`${id}-hit-${index}-${color==='white'?'white':'red'}`;
          const tint=node('filter',{id:tintId,'color-interpolation-filters':'sRGB'});
          tint.appendChild(node('feFlood',{'flood-color':color}));
          tint.appendChild(node('feComposite',{in2:'SourceAlpha',operator:'in'}));defs.appendChild(tint);
          const overlay=node('image');
          for(const key of ['x','y','width','height','href','preserveAspectRatio'])overlay.setAttribute(key,image.getAttribute(key));
          overlay.setAttribute('transform',`translate(${offset.x} ${offset.y}) ${image.getAttribute('transform')??''}`);
          overlay.setAttribute('filter',`url(#${tintId})`);
          overlay.setAttribute('opacity',opacity);layer.appendChild(overlay);
          }
        }
      }
      if(!rocket)flash(c,age,18,90,0,true);
      if(fire.high&&age<320){
        for(let j=0;j<7;j++){
          const direction=j*Math.PI*2/7,k=age/320,r=40*out(k)*scale;
          layer.appendChild(node('line',{x1:c.x+Math.cos(direction)*r*.78,y1:c.y+Math.sin(direction)*r*.78,
            x2:c.x+Math.cos(direction)*r,y2:c.y+Math.sin(direction)*r,stroke:'#ffd26b','stroke-width':2*scale,opacity:1-k}));
        }
      }
      if(fire.high&&age>=30&&age<480){const k=(age-30)/450;
        puff({x:c.x,y:c.y-out(k)*10*scale},(5+11*out(k))*scale,.5*(1-k)**1.4,'#5a5652',`impact-${index}`);}
      if(root.GoblinUIV2?.damageVisible!==false&&age>=50&&age<500&&Math.floor((age-50)/90)%2===0){
        const before=old.ogreSystems?old.ogreSystems.treads:old.hp;
        const after=effect.after.ogreSystems?effect.after.ogreSystems.treads:effect.after.hp;
        const max=old.ogreSystems?old.ogreSystems.maxTreads:old.maxHp;
        if(max>0&&before>after){
          for(let j=0;j<3;j++){
            const oldFill=clamp(3*before/max-j),newFill=clamp(3*after/max-j);
            const width=11*(oldFill-newFill)*scale;
            if(oldFill>newFill)layer.appendChild(node('rect',{x:c.x+((j-1)*14-5.5+11*newFill)*scale-width*.175,
              y:c.y-.70*34-3.375*scale,width:width*1.35,height:6.75*scale,fill:'#ff4f43'}));
          }
        }
      }
      if(delta.label&&age<850){
        const k=age/850,text=node('text',{x:c.x,y:c.y-(26+26*out(k))*scale,'text-anchor':'middle',
          'font-size':20*scale,'font-weight':700,fill:'#ff968f',stroke:'#101419','stroke-width':2*scale,
          'paint-order':'stroke',opacity:k>.6?1-(k-.6)/.4:1});
        text.textContent=delta.label;layer.appendChild(text);
      }
    }
  }
  root.GoblinFirePresentation=Object.freeze({mapping,muzzle,delta,plan,sample,paint,scale,center,out,io,clamp});
})(globalThis);
