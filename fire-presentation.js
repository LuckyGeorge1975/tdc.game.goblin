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
        systems?`−${root.GoblinLanguage?.t('v2.ui.weaponDamage',{count:systems})??`${systems} SYSTEM`}`:
          hp?`−${hp} ${a.infantry||a.engineering?'SP':'HP'}`:
            !a.disabled&&b.disabled?(root.GoblinLanguage?.t('v2.ui.disabled')??'DISABLED'):null};
  }
  function wreckClass(unit){return root.GoblinWreckKlassen?.[unit.visualKey]??'fahrzeug';}
  function destruction(effect){
    const cls=wreckClass(effect.after);
    return {cls,size:({infanterie:.7,fahrzeug:1,schwer:1.3,bauwerk:1.7})[cls]??1,
      detonations:cls==='bauwerk'?3:cls==='infanterie'?1:2,debris:cls==='bauwerk'?18:cls==='infanterie'?6:11,
      start:120,fade:220,end:3420};
  }
  function rocketPose(rocket,k){
    k=clamp(k);
    const ground=.55*k+.45*k*k,h=Math.pow(Math.max(0,Math.sin(Math.PI*k)),.8);
    const gx=rocket.start.x+(rocket.end.x-rocket.start.x)*ground,gy=rocket.start.y+(rocket.end.y-rocket.start.y)*ground;
    const point=t=>{const travel=.55*t+.45*t*t,height=Math.pow(Math.max(0,Math.sin(Math.PI*t)),.8);
      return {x:rocket.start.x+(rocket.end.x-rocket.start.x)*travel,
        y:rocket.start.y+(rocket.end.y-rocket.start.y)*travel-height*rocket.apexOffset*scale};};
    const a=point(Math.max(0,k-.01)),b=point(Math.min(1,k+.01));
    return {gx,gy,x:gx,y:gy-h*rocket.apexOffset*scale,h,
      size:(1+(rocket.apexScale-1)*h)*scale,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
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
    const rockets=[];
    if(map.kind==='deferred-rocket'){
      const strategic=event.weapon.semanticKind==='missile'||root.GoblinFireAnchors?.[event.actor.visualKey]?.klasse==='missile';
      const count=strategic?1:3,rocketInterval=strategic?160:100;
      const apexScale=strategic?2.1:1.6,apexOffset=strategic?44:30,bodyLength=strategic?42:32,bodyWidth=strategic?12:9;
      const launch={x:a.x+Math.cos(angle*Math.PI/180)*8*scale,y:a.y+Math.sin(angle*Math.PI/180)*8*scale};
      const screenDist=Math.hypot(b.x-launch.x,b.y-launch.y),hexDist=screenDist/(Math.sqrt(3)*34);
      const baseFlight=Math.min(1600,550+120*hexDist),flightMs=strategic?Math.min(2000,baseFlight*1.25):baseFlight;
      const vr=(salt)=>root.GoblinPresentationState?.visualRandom(event.eventId,salt)??0.5;
      for(let i=0;i<count;i++){
        const jx=(vr(`rjx/${i}`)-.5)*14*scale,jy=(vr(`rjy/${i}`)-.5)*14*scale;
        const jtx=(vr(`rjtx/${i}`)-.5)*26*scale,jty=(vr(`rjty/${i}`)-.5)*18*scale;
        const apexJitter=(vr(`rapex/${i}`)-.5)*.12;
        rockets.push({start:{x:launch.x+jx,y:launch.y+jy},end:{x:b.x+jtx,y:b.y+jty},strategic,
          delay:i*rocketInterval,flight:flightMs,
          apexScale:apexScale*(1+(strategic?0:apexJitter)),apexOffset,bodyLength,bodyWidth});
      }
    }
    // All decorative muzzles share one confirmed result time, never one damage event per barrel.
    const lastArrival=rockets.length?Math.max(...rockets.map(rocket=>shotAt+rocket.delay+rocket.flight)):shotAt;
    const arrival=shots.length?Math.max(...shots.map(shot=>shot.arrival)):lastArrival;
    const after=copy(event.after),hitState=copy(event.before);
    for(const effect of event.effects){const index=hitState.units.findIndex(unit=>unit.id===effect.subjectId);
      if(index>=0)hitState.units[index]=copy(effect.after);}
    const facing={...event.actor,angle},speed=actor.team==='enemy'?1.3:1;
    const high=event.action.animationPreference.mode==='high';
    const deaths=event.effects.filter(effect=>effect.before.hp>0&&effect.after.hp<=0&&!effect.after.embarkedOn);
    const end=Math.max(arrival+(rockets.length||deaths.length?900:850),rockets.length?lastArrival+(high?2200:400):0,
      deaths.length?arrival+(high?3420:340):0);
    return {kind:'fire',map,config,actor,target,angle,initial,turnDelta,turn,shotAt,shots,rockets,arrival,
      lastArrival,duration:end/speed,finalHeading:angle,speed,hitState,after,facing};
  }
  function sample(plan,elapsed,event){
    const time=elapsed*plan.speed,angle=time<plan.turn?normalize(plan.initial+plan.turnDelta*io(clamp(time/plan.turn))):plan.angle;
    const recoilAge=time-plan.shotAt,rocket=plan.rockets.length>0,peak=rocket?3:plan.config[1],rise=rocket?50:40,fall=rocket?200:160;
    const recoil=peak*scale*(recoilAge<0?0:recoilAge<rise?out(recoilAge/rise):recoilAge<rise+fall?1-io((recoilAge-rise)/fall):0);
    const a=angle*Math.PI/180,age=time-plan.arrival;
    const state=age>=50?plan.hitState:event.before;
    return {state,time,angle,age,plan,recoil:{x:-Math.cos(a)*recoil,y:-Math.sin(a)*recoil},
      effects:event.effects.map(effect=>({...effect,delta:delta(effect),age})),high:event.action.animationPreference.mode==='high'};
  }
  function paint({value,layer,ground=layer,units,node,id}){
    const fire=value.fire,p=fire.plan,a=p.angle*Math.PI/180,defs=node('defs');layer.appendChild(defs);
    function gradient(name,stops){
      const gradient=node('radialGradient',{id:`${id}-${name}`,cx:'50%',cy:'50%',r:'50%'});
      for(const [offset,color,opacity]of stops)gradient.appendChild(node('stop',{offset,'stop-color':color,'stop-opacity':opacity}));
      defs.appendChild(gradient);return `url(#${id}-${name})`;
    }
    const flashFill=gradient('flash',[['0%','#fffbe0',1],['35%','#fff1b0',1],['70%','#ffad38',.85],['100%','#ff8b20',0]]);
    function puff(point,radius,opacity,color,name,destination=layer){
      destination.appendChild(node('circle',{cx:point.x,cy:point.y,r:radius,opacity,
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
    const random=salt=>root.GoblinPresentationState?.visualRandom(value.event.eventId,salt)??.5;
    function fireball(point,age,duration,radius,name){
      if(age<0||age>=duration)return;
      const k=age/duration;
      layer.appendChild(node('circle',{cx:point.x,cy:point.y,r:radius*out(k)*scale,
        fill:gradient(name,[['0%','#fffadc',.95*(1-k)],['40%','#ffaa3c',.9*(1-k)],
          ['80%','#c83c18',.6*(1-k)],['100%','#781e0c',0]])}));
    }
    function sparks(point,age,duration,count,radius,name){
      if(age<0||age>=duration)return;
      const k=age/duration;
      for(let j=0;j<count;j++){
        const angle=random(`${name}/angle/${j}`)*Math.PI*2,r=radius*(.4+.8*random(`${name}/distance/${j}`))*out(k)*scale;
        layer.appendChild(node('line',{x1:point.x+Math.cos(angle)*r*.78,y1:point.y+Math.sin(angle)*r*.78,
          x2:point.x+Math.cos(angle)*r,y2:point.y+Math.sin(angle)*r,stroke:'#ffd26b','stroke-width':2*scale,opacity:1-k}));
      }
    }
    for(const [ri,rocket]of (p.rockets??[]).entries()){
      const rt=fire.time-p.shotAt-rocket.delay,impactAge=rt-rocket.flight,impactScale=rocket.strategic?1.6:1;
      flash(rocket.start,rt,rocket.strategic?24:15,120,p.angle);
      if(fire.high&&rt>=20&&rt<720){
        const k=(rt-20)/700;
        for(let j=0;j<3;j++)puff({x:rocket.start.x+(random(`launch/${ri}/${j}/x`)-.5)*8*scale+(random(`launch/${ri}/${j}/vx`)-.5)*26*out(k)*scale,
          y:rocket.start.y+(random(`launch/${ri}/${j}/y`)-.5)*8*scale+(random(`launch/${ri}/${j}/vy`)-.5)*26*out(k)*scale},
          (8+((rocket.strategic?34:24)-8)*out(k))*scale,.5*(1-k)**1.4,'#e1e1dc',`launch-${ri}-${j}`,ground);
      }
      if(fire.high&&rt>=0){
        for(let birth=40;birth<Math.min(rt,rocket.flight);birth+=16){
          const age=rt-birth;if(age>=550)continue;
          const pose=rocketPose(rocket,birth/rocket.flight),k=age/550;
          const angle=pose.angle*Math.PI/180;
          puff({x:pose.x-Math.cos(angle)*15*pose.size,y:pose.y-Math.sin(angle)*15*pose.size},
            (2.5+(3.5+3*pose.h)*out(k))*scale,(1-k)*.55,k<.3?'#ffb428':'#808078',`trail-${ri}-${birth}`,ground);
        }
      }
      if(impactAge>=0){
        flash(rocket.end,impactAge,44*impactScale,90,0,true);
        fireball(rocket.end,impactAge,340,32*impactScale,`impact-fire-${ri}`);
        if(impactAge<400)layer.appendChild(node('circle',{cx:rocket.end.x,cy:rocket.end.y,r:70*impactScale*out(impactAge/400)*scale,
          fill:'none',stroke:'#ffe2aa','stroke-width':(5-4*impactAge/400)*scale,opacity:.7*(1-impactAge/400)}));
        if(fire.high){
          if(impactAge<2200){const k=impactAge/2200,alpha=(k<.1?k/.1:1-clamp((k-.1)/.9))*.55;
            puff(rocket.end,26*impactScale*scale,alpha,'#120e0c',`scorch-${ri}`,ground);}
          sparks(rocket.end,impactAge,500,14,65*impactScale,`impact-${ri}`);
          for(let j=0;j<7;j++){
            const age=impactAge-50-random(`impact/${ri}/${j}/delay`)*80;
            if(age<0||age>=950)continue;
            const k=age/950,angle=random(`impact/${ri}/${j}/angle`)*Math.PI*2,speed=6+22*random(`impact/${ri}/${j}/speed`);
            puff({x:rocket.end.x+Math.cos(angle)*(8+speed*out(k))*scale,
              y:rocket.end.y+(Math.sin(angle)*(8+speed*out(k))-14*out(k))*scale},
              (10*impactScale+(14+12*random(`impact/${ri}/${j}/radius`))*out(k))*scale,.55*(1-k)**1.4,'#46423e',`impact-smoke-${ri}-${j}`);
          }
        }
      }
      if(rt<0||rt>rocket.flight)continue;
      const pose=rocketPose(rocket,rt/rocket.flight),sz=pose.size,L=rocket.bodyLength*sz/2,w=rocket.bodyWidth*sz/2;
      ground.appendChild(node('ellipse',{cx:pose.gx+(2+14*pose.h)*scale,cy:pose.gy+(4+22*pose.h)*scale,
        rx:14*scale,ry:4*scale,fill:'#000',opacity:.5*(1-.4*pose.h)}));
      const angle=pose.angle*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      const R=(x,y)=>`${pose.x+x*cos-y*sin},${pose.y+x*sin+y*cos}`;
      function metal(name,colors){
        const grad=node('linearGradient',{id:`${id}-${name}-${ri}`,gradientUnits:'userSpaceOnUse',
          x1:pose.x-w*.4,y1:pose.y-w*1.2,x2:pose.x+w*.4,y2:pose.y+w*1.2});
        for(const [offset,color]of colors)grad.appendChild(node('stop',{offset,'stop-color':color}));defs.appendChild(grad);
        return `url(#${id}-${name}-${ri})`;
      }
      const plume=node('g',{style:'mix-blend-mode:screen'}),flame=(14+5*Math.sin(fire.time*.09)*Math.sin(fire.time*.037+1))*sz;
      plume.appendChild(node('circle',{cx:pose.x-L*cos,cy:pose.y-L*sin,r:15*sz,
        fill:gradient(`exhaust-${ri}`,[['0%','#ffbe5a',.55],['100%','#ff7830',0]])}));
      plume.appendChild(node('path',{d:`M${R(-L,-w*.5)} Q${R(-L-flame*.55,-w*.45)} ${R(-L-flame,0)} Q${R(-L-flame*.55,w*.45)} ${R(-L,w*.5)} Z`,
        fill:metal('plume',[['0%','#fffce0'],['45%','#ffaa3c'],['100%','#ff5014']])}));layer.appendChild(plume);
      const own=value.event.actor.team!=='enemy',body=`M${R(-L,-w)} L${R(L*.42,-w)} Q${R(L*.84,-w*.86)} ${R(L,0)} Q${R(L*.84,w*.86)} ${R(L*.42,w)} L${R(-L,w)} Z`;
      for(const sign of [-1,1])layer.appendChild(node('path',{d:`M${R(-L*.78,sign*w*.9)} L${R(-L*1.1,sign*(w+7*sz))} L${R(-L*.96,sign*(w+7*sz))} L${R(-L*.5,sign*w*.9)} Z`,
        fill:metal(`fin-${sign}`,[['0%','#c0c2c8'],['100%','#606264']]),stroke:own?'#181a1c':'#c8cad0','stroke-width':sz}));
      layer.appendChild(node('path',{d:body,fill:metal('body',[['0%','#c8cace'],['35%','#80828a'],['100%','#323436']]),
        stroke:own?'#181a1c':'#c8cad0','stroke-width':1.5*sz}));
      layer.appendChild(node('path',{d:`M${R(L*.42,-w)} Q${R(L*.84,-w*.86)} ${R(L,0)} Q${R(L*.84,w*.86)} ${R(L*.42,w)} Z`,
        fill:metal('nose',[['0%','#eef0f2'],['40%','#a4a8ad'],['100%','#383a3c']])}));
      layer.appendChild(node('path',{d:`M${R(L*.02,-w)} L${R(L*.22,-w)} L${R(L*.22,w)} L${R(L*.02,w)} Z`,
        fill:metal('band',own?[['0%','#ffc078'],['40%','#d06810'],['100%','#603008']]:[['0%','#f08078'],['40%','#b81818'],['100%','#500c0c']])}));
      layer.appendChild(node('path',{d:`M${R(-L,-w)} L${R(-L*.84,-w)} L${R(-L*.84,w)} L${R(-L,w)} Z`,fill:'#202224',opacity:.85}));
      for(const x of [-L*.55,-L*.28,L*.3])layer.appendChild(node('path',{d:`M${R(x,-w)} L${R(x,w)}`,stroke:'#181a1c','stroke-width':.8*sz,opacity:.6}));
      layer.appendChild(node('path',{d:`M${R(-L*.98,0)} L${R(-L*.5,0)}`,stroke:'#080a0e','stroke-width':2.2*sz}));
      layer.appendChild(node('path',{d:`M${R(-L*.98,-.7*sz)} L${R(-L*.5,-.7*sz)}`,stroke:'#eee','stroke-width':.9*sz}));
    }
    for(const [index,effect]of fire.effects.entries()){
      const {delta,age}=effect;if(!delta.changed||age<0||effect.after.embarkedOn)continue;
      const c=center(effect.after),old=effect.before,art=units.find(item=>item.unit.id===effect.subjectId);
      const dying=old.hp>0&&effect.after.hp<=0;
      const dead=effect.after.hp<=0&&age>=120,knock=age<50?4*out(age/50):age<250?4*(1-io((age-50)/200)):0;
      const shake=fire.high&&age<300?3*(1-age/300):0;
      const rocket=p.map.kind==='deferred-rocket';
      const offset={x:(rocket?0:Math.cos(a)*knock)*scale+Math.sin(age*.001*34*2*Math.PI)*shake*scale,
        y:(rocket?0:Math.sin(a)*knock)*scale+Math.sin(age*.001*29*2*Math.PI)*shake*.65*scale};
      if(dying&&fire.high&&age>=100){const amplitude=6.5*(1-out(clamp((age-100)/420)))*scale;
        offset.x=Math.sin(age*.214)*amplitude;offset.y=Math.sin(age*.182)*amplitude*.65;}
      if(art&&(!dead||art.artUnit?.hp>0))art.group.setAttribute('transform',`translate(${offset.x} ${offset.y})`);
      if(dying&&fire.high&&age>=80&&age<340&&art){
        const image=art.group.querySelector('.unit-artwork');
        if(image){
          const tintId=`${id}-char-${index}`,filter=node('filter',{id:tintId,'color-interpolation-filters':'sRGB'});
          filter.appendChild(node('feFlood',{'flood-color':'#101214'}));filter.appendChild(node('feComposite',{in2:'SourceAlpha',operator:'in'}));defs.appendChild(filter);
          const imageCopy=node('image');for(const key of ['x','y','width','height','href','preserveAspectRatio','transform'])imageCopy.setAttribute(key,image.getAttribute(key));
          imageCopy.setAttribute('transform',`translate(${offset.x} ${offset.y}) ${image.getAttribute('transform')??''}`);
          imageCopy.setAttribute('filter',`url(#${tintId})`);imageCopy.setAttribute('opacity',.92*io(clamp((age-80)/240))*(1-clamp((age-120)/220)));
          layer.appendChild(imageCopy);
        }
      }
      if(dead&&dying){
        const timeline=destruction(effect),S=timeline.size,explAge=age-timeline.start,fade=clamp(explAge/timeline.fade);
        const liveSprite=art?.artUnit?.hp>0;
        if(art){
          art.group.setAttribute('opacity',liveSprite?1-fade:1);
        }
        if(fade>0&&liveSprite){
          if(!art.wreckOverlay){art.wreckOverlay=node('g');root.UnitVisuals.drawWreck(art.wreckOverlay,effect.after,c,{ns:'http://www.w3.org/2000/svg'});}
          art.wreckOverlay.setAttribute('opacity',fade);layer.appendChild(art.wreckOverlay);
        }
        flash(c,explAge,(fire.high?64:56)*S,fire.high?100:90,0,true);
        if(fire.high){
          fireball(c,explAge,500,48*S,`death-fire-${index}`);
          if(explAge<500)layer.appendChild(node('circle',{cx:c.x,cy:c.y,r:96*S*out(explAge/500)*scale,
            fill:'none',stroke:'#ffe2aa','stroke-width':(5-4*clamp(explAge/500))*scale,opacity:.7*(1-explAge/500)}));
          sparks(c,explAge,600,22,85*S,`death-${index}`);
          for(let j=1;j<timeline.detonations;j++){
            const point={x:c.x+(random(`death/${index}/det/${j}/x`)-.5)*34*S*scale,y:c.y+(random(`death/${index}/det/${j}/y`)-.5)*28*S*scale},age=explAge-170*j;
            flash(point,age,42*S,90,0,true);fireball(point,age,400,34*S,`death-secondary-${index}-${j}`);
            sparks(point,age,450,12,55*S,`death-secondary-${index}-${j}`);
          }
          for(let j=0;j<9;j++){
            const k=(explAge-50-random(`death/${index}/smoke/${j}/delay`)*180)/1400;if(k<0||k>=1)continue;
            const angle=random(`death/${index}/smoke/${j}/angle`)*Math.PI*2,speed=8+22*random(`death/${index}/smoke/${j}/speed`);
            puff({x:c.x+Math.cos(angle)*(10+speed*out(k))*S*scale,y:c.y+(Math.sin(angle)*(10+speed*out(k))-26*out(k))*S*scale},
              (14+(22+16*random(`death/${index}/smoke/${j}/radius`))*out(k))*S*scale,.62*(1-k)**1.4,'#403c38',`death-smoke-${index}-${j}`);
          }
          const debrisAge=explAge-20;
          if(debrisAge>=0&&debrisAge<950)for(let j=0;j<timeline.debris;j++){
            const k=debrisAge/950,angle=random(`death/${index}/debris/${j}/angle`)*Math.PI*2,distance=(50+60*random(`death/${index}/debris/${j}/distance`))*S*out(k)*scale;
            const r=(3+5*random(`death/${index}/debris/${j}/size`))*(1-.3*k)*scale,spin=(random(`death/${index}/debris/${j}/spin`)-.5)*14*k*180/Math.PI;
            const shade=Math.round(50+40*random(`death/${index}/debris/${j}/shade`));
            layer.appendChild(node('path',{d:`M${r} 0 L${-r*.6} ${r*.8} L${-r*.4} ${-r*.7} Z`,
              transform:`translate(${c.x+Math.cos(angle)*distance} ${c.y+Math.sin(angle)*distance}) rotate(${spin})`,
              fill:`rgb(${shade},${shade-4},${shade-8})`,stroke:'#141212','stroke-width':1.2*scale,opacity:1-k*k}));
          }
          for(let j=0;j<8;j++){
            const k=(explAge-150-random(`death/${index}/ember/${j}/delay`)*300)/1200;if(k<0||k>=1)continue;
            const angle=random(`death/${index}/ember/${j}/angle`)*Math.PI*2;
            layer.appendChild(node('circle',{cx:c.x+((random(`death/${index}/ember/${j}/x`)-.5)*30*S+Math.cos(angle)*14*k)*scale,
              cy:c.y+((random(`death/${index}/ember/${j}/y`)-.5)*24*S-(18+22*random(`death/${index}/ember/${j}/speed`))*k)*scale,
              r:1.9*scale,fill:'#ff9646',opacity:(1-k)*(.6+.4*Math.sin(fire.time*.04+j*3.1))}));
          }
          for(let j=0;j<4;j++){
            const k=(explAge-600-j*400)/1500;if(k<0||k>=1)continue;
            puff({x:c.x+((random(`death/${index}/after/${j}/x`)-.5)*16*S+(6+8*random(`death/${index}/after/${j}/vx`))*out(k))*scale,
              y:c.y+((random(`death/${index}/after/${j}/y`)-.5)*12*S-(24+10*random(`death/${index}/after/${j}/vy`))*out(k))*scale},
              (7+15*out(k))*S*scale,.3*(1-k)**1.4,'#56524e',`death-after-${index}-${j}`);
          }
        }
        const damageOpacity=1-clamp((age-220)/300);
        if(root.GoblinUIV2?.damageVisible!==false&&damageOpacity>0){
          for(let j=0;j<3;j++){
            const x=c.x+((j-1)*14-5.5)*scale,y=c.y-.7*34-2.5*scale;
            layer.appendChild(node('rect',{x,y,width:11*scale,height:5*scale,fill:'#28222c',stroke:'#b8a9e0','stroke-width':scale,opacity:damageOpacity}));
            const maximum=old.ogreSystems?.maxTreads??old.maxHp,before=old.ogreSystems?.treads??old.hp,fill=clamp(3*before/maximum-j);
            if(fill>0&&age<500&&Math.floor((age-50)/90)%2===0)layer.appendChild(node('rect',{x:x-1.925*scale,y:y-.875*scale,width:14.85*scale*fill,height:6.75*scale,fill:'#ff4f43',opacity:damageOpacity}));
          }
        }
        if(delta.label&&age>=50&&age<900){
          const k=(age-50)/850,text=node('text',{x:c.x,y:c.y-(26+26*out(k))*scale,'text-anchor':'middle','font-size':20*scale,
            'font-weight':700,fill:'#ff968f',stroke:'#101419','stroke-width':2*scale,'paint-order':'stroke',opacity:k>.6?1-(k-.6)/.4:1});
          text.textContent=delta.label;layer.appendChild(text);
        }
        continue;
      }
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
      if(!rocket&&fire.high&&age<320){
        for(let j=0;j<7;j++){
          const direction=j*Math.PI*2/7,k=age/320,r=40*out(k)*scale;
          layer.appendChild(node('line',{x1:c.x+Math.cos(direction)*r*.78,y1:c.y+Math.sin(direction)*r*.78,
            x2:c.x+Math.cos(direction)*r,y2:c.y+Math.sin(direction)*r,stroke:'#ffd26b','stroke-width':2*scale,opacity:1-k}));
        }
      }
      if(!rocket&&fire.high&&age>=30&&age<480){const k=(age-30)/450;
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
      const captionAge=rocket?age-50:age;
      if(delta.label&&captionAge>=0&&captionAge<850){
        const k=captionAge/850,text=node('text',{x:c.x,y:c.y-(26+26*out(k))*scale,'text-anchor':'middle',
          'font-size':20*scale,'font-weight':700,fill:'#ff968f',stroke:'#101419','stroke-width':2*scale,
          'paint-order':'stroke',opacity:k>.6?1-(k-.6)/.4:1});
        text.textContent=delta.label;layer.appendChild(text);
      }
    }
  }
  root.GoblinFirePresentation=Object.freeze({mapping,muzzle,delta,plan,sample,paint,rocketPose,destruction,scale,center,out,io,clamp});
})(globalThis);
