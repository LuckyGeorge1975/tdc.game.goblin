// A display-only queue. Input consists exclusively of accepted snapshots and original paths.
(function(root){
  const center=cell=>({x:58+Math.sqrt(3)*34*(cell.x+(cell.y%2)/2),y:48+51*cell.y});
  const heading=(a,b)=>(Math.atan2(center(b).y-center(a).y,center(b).x-center(a).x)*180/Math.PI+360)%360;
  const shortest=angle=>((angle%360)+540)%360-180===-180?180:((angle%360)+540)%360-180;
  const normalize=angle=>(angle%360+360)%360;
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const classes=Object.freeze({
    'guard-tank':['track',1.15],'siege-tank':['track',1.15],'assault-tank':['track',1.15],
    'recon-tank':['track',1.15],'rocket-artillery':['track',1.15],'long-range-battery':['track',1.15],
    'mobile-siege-gun':['track',1.15],'phantom-platform':['track',1.15],
    'goblin-siegebreaker':['track',1.4],'goblin-dreadnaught':['track',1.4],'strategic-missile-carrier':['track',1.4],
    'skimmer-scout':['hover',.8],'raider-skimmer':['hover',.8],'combat-skimmer':['hover',.8],
    'light-skimmer':['hover',.8],'skimmer-carrier':['hover',.8],'artillery-drone':['hover',.8],
    'infantry-squad':['foot',1.5],'infantry-platoon':['foot',1.5],'amphibious-infantry':['foot',1.5],
    'field-engineers':['foot',1.5],'forge-engineer':['foot',1.5],'local-defense':['none',1],
    'command-core':['none',1],'command-hub':['none',1],'relay-node':['none',1]
  });
  function plan(event,initialHeading){
    const runs=[];let from=event.actor.positionBefore;
    for(const to of event.path??[]){
      const angle=Math.round(heading(from,to)/60)*60,last=runs.at(-1);
      if(last&&normalize(last.angle)===normalize(angle)){last.to=to;last.n++;}
      else runs.push({from,to,n:1,angle});
      from=to;
    }
    const [kind,speed]=classes[event.actor.visualKey]??['none',1];
    let angle=initialHeading,fixed=0,travel=0;
    for(const run of runs){
      run.delta=shortest(run.angle-angle);run.initial=angle;
      run.turn=Math.abs(run.delta)>.5?60+50*Math.abs(run.delta)/60:0;
      run.ramp=Math.min(.45,run.n/2);run.drive=(run.n+2*run.ramp)*200*speed;
      fixed+=run.turn+(run.turn?30:0)+40;travel+=run.drive;angle+=run.delta;
    }
    if(fixed>=2500)return {diagnostic:'FIXED_MOVEMENT_BUDGET_EXCEEDED',fixed,runs:[],duration:0};
    const scale=travel?Math.min(1,(2500-fixed)/travel):1;
    const enemy=event.actor.team==='enemy'?1.3:1;
    let time=0;const segments=[];
    for(const run of runs){
      if(run.turn){segments.push({...run,kind:'turn',start:time,end:time+run.turn/enemy});time+=(run.turn+30)/enemy;}
      segments.push({...run,kind:'drive',start:time,end:time+run.drive*scale/enemy});
      time+=(run.drive*scale+40)/enemy;
    }
    return {segments,duration:time,finalHeading:normalize(angle),kind,fixed,scale,enemy};
  }
  function sample(plan,time,origin,initialHeading){
    let point=center(origin),angle=initialHeading,driving=false;
    for(const segment of plan.segments??[]){
      if(time<segment.start)break;
      const t=Math.min(1,(time-segment.start)/(segment.end-segment.start));
      if(segment.kind==='turn')angle=segment.initial+segment.delta*ease(t);
      else{
        angle=segment.initial+segment.delta;
        const n=segment.n,ra=segment.ramp,T=n+2*ra,tau=t*T;
        const k=tau<2*ra?tau*tau/(4*ra)/n:tau>T-2*ra?1-(T-tau)**2/(4*ra)/n:(tau-ra)/n;
        const a=center(segment.from),b=center(segment.to);
        point={x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k};driving=t<1;
      }
      if(t<1)break;
    }
    return {point,angle:normalize(angle),driving};
  }
  function particles(plan,elapsed,event){
    const result=[],scale=Math.sqrt(3)*34/112;
    for(const drive of plan.segments.filter(segment=>segment.kind==='drive')){
      let index=0;
      for(let birth=drive.start+120/plan.enemy;birth<drive.end-100/plan.enemy;birth+=75/plan.enemy){
        const salt=`${drive.start}/${index++}`,age=(elapsed-birth)*plan.enemy;
        if(age<0||age>=550)continue;
        const life=age/550,out=1-(1-life)**3,motion=sample(plan,birth,event.actor.positionBefore,drive.initial);
        const angle=motion.angle*Math.PI/180;
        const jitter=(root.GoblinPresentationState?.visualRandom(event.eventId,salt)??.5)-.5;
        result.push({x:motion.point.x-Math.cos(angle)*(30+out*14)*scale+jitter*8*scale,
          y:motion.point.y-Math.sin(angle)*(30+out*14)*scale+jitter*8*scale,
          radius:(5+10*out)*scale,opacity:.34*(1-life)**1.4});
      }
    }
    return result;
  }
  function createQueue({now,request,cancel,render,finish,diagnostic=()=>{}}){
    let queue=[],active=null,frame=null,generation=0,display=null,returnAt=null;
    function clear(){generation++;if(frame!==null)cancel(frame);frame=null;queue=[];active=null;display=null;returnAt=null;finish(false);}
    function schedule(){if(frame!==null)return;const expected=generation;
      frame=request(()=>{frame=null;if(expected===generation)tick();});}
    function next(time){
      while(!active&&queue.length){
        const item=queue.shift();
        if(!item.event){display={state:item.after,sidecar:item.sidecar};continue;}
        const event=item.event,initial=item.beforeSidecar?.facingByUnit.find(f=>f.unitId===event.actor.unitId)?.angleDegrees??(event.actor.team==='enemy'?180:0);
        const movement=event.kind==='fire'?root.GoblinFirePresentation?.plan(event,initial):plan(event,initial);
        if(!movement){display={state:item.after,sidecar:item.sidecar};continue;}
        if(movement.diagnostic){diagnostic({eventId:event.eventId,...movement});display={state:item.after,sidecar:item.sidecar};continue;}
        if(event.action.animationPreference.mode==='off'||event.kind!=='fire'&&!event.path){display={state:item.after,sidecar:item.sidecar};continue;}
        active={...item,movement,initial,start:time};returnAt=null;
        display={state:event.before,sidecar:item.beforeSidecar};
      }
    }
    function tick(){
      const time=now();next(time);
      if(active){
        const elapsed=time-active.start;
        if(elapsed>=active.movement.duration){display={state:active.after,sidecar:active.sidecar};active=null;next(time);}
      }
      if(active){
        const elapsed=time-active.start;
        if(active.event.kind==='fire'){
          const fire=root.GoblinFirePresentation.sample(active.movement,elapsed,active.event);
          render({state:fire.state,sidecar:fire.age>=50?active.sidecar:active.beforeSidecar,event:active.event,fire,
            motion:null,dust:false,overlayOpacity:Math.max(0,1-elapsed/120)});
          schedule();return;
        }
        render({...display,event:active.event,motion:sample(active.movement,elapsed,active.event.actor.positionBefore,active.initial),
          dust:active.event.action.animationPreference.mode==='high'&&active.movement.kind==='track',
          particles:active.event.action.animationPreference.mode==='high'&&active.movement.kind==='track'?
            particles(active.movement,elapsed,active.event):[],elapsed,overlayOpacity:Math.max(0,1-elapsed/120)});
        schedule();
      }else if(display){
        if(returnAt===null)returnAt=time;
        const opacity=Math.max(0,Math.min(1,(time-returnAt-100)/120));
        render({...display,event:null,motion:null,dust:false,overlayOpacity:opacity});
        if(opacity<1)schedule();else{display=null;returnAt=null;finish(true);}
      }
    }
    return Object.freeze({
      enqueue(item){
        // OFF and unrelated actions need no frame or hidden layer when the queue is idle.
        if(!active&&!queue.length&&!display&&(!item.event||item.event.action.animationPreference.mode==='off'||item.event.kind!=='fire'&&!item.event.path))return;
        queue.push(item);tick();
      },
      skip(){if(!active)return false;display={state:active.after,sidecar:active.sidecar};active=null;tick();return true;},
      clear,busy:()=>!!active||queue.length>0||!!display,read:()=>({active:active?.event.eventId??null,queued:queue.length,generation})
    });
  }
  const api=Object.freeze({plan,sample,particles,center,shortest,createQueue});
  root.GoblinMovementMath=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(!root.document||!root.GoblinPresentation?.subscribe||!root.requestAnimationFrame)return;
  const ns='http://www.w3.org/2000/svg',tickets=new WeakMap();
  let layer=null,displayContext=null,lastFrame=null,builtState=null,builtEvent=null,dustLayer=null,actorNode=null,markerLayer=null,effectLayer=null,builtFireStage=null;
  let unitNodes=[],depthOrder='',dustSequence=0,dustGradientId=null;
  let publishedState=null;
  const node=(tag,attributes={})=>{const result=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attributes))result.setAttribute(key,value);return result;};
  function finish(completed=false){layer?.remove();layer=null;displayContext=null;lastFrame=null;
    builtState=null;builtEvent=null;actorNode=null;markerLayer=null;dustLayer=null;effectLayer=null;unitNodes=[];depthOrder='';builtFireStage=null;
    publishedState=null;
    document.body.classList.remove('goblin-moving');document.body.style.removeProperty('--movement-overlays');
    if(completed)root.dispatchEvent(new Event('goblin-movement-finished'));}
  function paint(value){
    const map=document.querySelector('#battlefield-map');if(!map)return;
    lastFrame=value;displayContext=value;
    document.body.classList.add('goblin-moving');
    document.body.style.setProperty('--movement-overlays',String(value.overlayOpacity));
    if(!layer){
      layer=node('g',{'id':'goblin-movement-layer','pointer-events':'none','aria-hidden':'true'});
      dustGradientId=`goblin-movement-dust-${++dustSequence}`;
    }
    if(layer.parentNode!==map)map.appendChild(layer);
    const fireStage=value.fire?value.fire.age<120?0:1:null;
    if(builtState!==value.state||builtEvent!==value.event||builtFireStage!==fireStage){
    builtFireStage=fireStage;
    builtState=value.state;builtEvent=value.event;actorNode=null;unitNodes=[];depthOrder='';
    layer.replaceChildren();
    dustLayer=node('g');layer.appendChild(dustLayer);
    const units=root.UnitVisuals.sortMapUnits(value.state.units.filter(unit=>!unit.embarkedOn));
    for(const unit of units){
      const moving=!!value.motion&&value.event?.actor.unitId===unit.id,c=center(unit),group=node('g');
      if(moving)actorNode=group;
      group.dataset.movementUnit=unit.id;
      const old=value.fire?.effects.find(effect=>effect.subjectId===unit.id)?.before;
      const artUnit=old&&old.hp>0&&unit.hp<=0&&value.fire.age<120?old:unit;
      if(artUnit.hp<=0)root.UnitVisuals.drawWreck(group,artUnit,c,{ns});
      else{
        root.UnitVisuals.draw(group,artUnit,c,{ns,map:true,color:unit.team==='enemy'?'#ee574d':'#62cadd'});
        if(unit.disabled){group.style.opacity='.32';group.style.filter='grayscale(1)';}
        if(moving){
          group.setAttribute('transform',`translate(${value.motion.point.x-c.x} ${value.motion.point.y-c.y})`);
          // Rotation belongs to the sprite, never to its fixed screen-light shadow or HP display.
          group.querySelector('.unit-artwork')?.setAttribute('transform',`rotate(${value.motion.angle-(unit.team==='enemy'?180:0)} ${c.x} ${c.y})`);
        }
      }
      layer.appendChild(group);
      unitNodes.push({unit,group});
    }
    if(root.M1UnitMarkers){
      const core=root.IronDustBrowserV2?.mode==='ready';
      const markers=core?root.M1UnitMarkers.core({...root.IronDustBrowserV2.view,units:value.state.units,
        victory:value.state.victory},root.IronDustBrowserV2.epoch,'movement'):
        root.M1UnitMarkers.legacy(typeof legacySession==='undefined'?null:legacySession,value.state.units,'movement',value.state.gameOver);
      const targetsVisible=root.GoblinUIV2?.targetsVisible??true;
      const damageVisible=root.GoblinUIV2?.damageVisible??true;
      root.M1UnitMarkers.render(layer,markers,{t:(key,params)=>root.GoblinLanguage?.t(key,params)??key,targetsVisible,damageVisible});
    }
    markerLayer=layer.querySelector('#v2-m1-markers');
    // The live renderer queries its marker IDs across the whole map. Display clones own a namespace.
    if(markerLayer){markerLayer.id='movement-v2-m1-markers';markerLayer.setAttribute('id','movement-v2-m1-markers');}
    effectLayer=node('g',{'data-presentation-effects':'true'});layer.appendChild(effectLayer);
    }
    if(markerLayer)markerLayer.style.opacity=String(value.fire?1:value.overlayOpacity);
    if(actorNode&&value.motion){
      const c=center(value.event.actor.positionBefore),offset=`translate(${value.motion.point.x-c.x} ${value.motion.point.y-c.y})`;
      actorNode.setAttribute('transform',offset);
      actorNode.querySelector('.unit-artwork')?.setAttribute('transform',`rotate(${value.motion.angle-(value.event.actor.team==='enemy'?180:0)} ${c.x} ${c.y})`);
      markerLayer?.querySelectorAll('[data-unit-id]').forEach(mark=>{
        if(mark.getAttribute('data-unit-id')===value.event.actor.unitId)mark.setAttribute('transform',offset);
      });
    }
    const ordered=unitNodes.slice().sort((a,b)=>{
      const y=item=>item.group===actorNode&&value.motion?value.motion.point.y:center(item.unit).y;
      return (a.unit.hp>0?1:0)-(b.unit.hp>0?1:0)||y(a)-y(b)||String(a.unit.id).localeCompare(String(b.unit.id));
    });
    const order=ordered.map(item=>item.unit.id).join('/');
    if(order!==depthOrder){ordered.forEach(item=>layer.appendChild(item.group));if(markerLayer)layer.appendChild(markerLayer);if(effectLayer)layer.appendChild(effectLayer);depthOrder=order;}
    dustLayer.replaceChildren();
    if(value.dust&&value.particles?.length){
      // One layer-local gradient, replaced with the puffs and removed on every settle/reset.
      const defs=node('defs'),gradient=node('radialGradient',{id:dustGradientId,cx:'50%',cy:'50%',r:'50%'});
      gradient.appendChild(node('stop',{offset:'0%','stop-color':'#9e8a6c','stop-opacity':1}));
      gradient.appendChild(node('stop',{offset:'100%','stop-color':'#9e8a6c','stop-opacity':0}));
      defs.appendChild(gradient);dustLayer.appendChild(defs);
      // Reconstruct the bounded visual stream from event time, never gameplay RNG or particle timers.
      for(const puff of value.particles??[]){
        dustLayer.appendChild(node('circle',{cx:puff.x,cy:puff.y,r:puff.radius,fill:`url(#${dustGradientId})`,opacity:puff.opacity}));
      }
    }
    effectLayer.replaceChildren();
    if(value.fire)root.GoblinFirePresentation.paint({value,layer:effectLayer,units:unitNodes,node,ns,id:dustGradientId});
    if(publishedState!==value.state){publishedState=value.state;root.dispatchEvent(new Event('goblin-presentation-state'));}
  }
  const queue=createQueue({now:()=>performance.now(),request:fn=>requestAnimationFrame(fn),cancel:id=>cancelAnimationFrame(id),
    render:value=>{try{paint(value);}catch(error){queue.clear();console.warn('Movement display settled after render failure',error);}},
    finish,diagnostic:value=>{console.warn('Movement presentation checkpoint',value);root.dispatchEvent(new CustomEvent('goblin-movement-diagnostic',{detail:value}));}});
  root.GoblinMovement=Object.freeze({
    busy:queue.busy,skip:queue.skip,clear:queue.clear,read:queue.read,
    projectedState:()=>displayContext?JSON.parse(JSON.stringify(displayContext.state)):null,
    wrecksAt:(x,y)=>displayContext?(displayContext.sidecar?.wrecks??[]).filter(w=>w.position.x===x&&w.position.y===y):null,
    facingFor(unit){const item=displayContext?.sidecar?.facingByUnit.find(f=>f.unitId===unit.id);
      const actual=displayContext?.state.units.find(u=>u.id===unit.id),position=unit.position??unit;
      return actual?.x===position.x&&actual.y===position.y&&item?.team===unit.team&&
        item.visualKey===(unit.visualKey??root.UnitVisuals.artKey(unit))?
          displayContext.fire&&displayContext.event.actor.unitId===unit.id?displayContext.fire.angle:item.angleDegrees:null;},
    wreckFor(unit){return displayContext?.sidecar?.wrecks.find(w=>w.unitId===unit.id&&w.position.x===unit.x&&w.position.y===unit.y)??null;}
  });
  root.GoblinPresentation.subscribe((type,value)=>{
    if(type==='cancel'){queue.clear();return;}
    if(type==='begin'){tickets.set(value.ticket,value.sidecar);return;}
    if(type==='confirm'){
      const beforeSidecar=tickets.get(value.ticket);tickets.delete(value.ticket);
      if(document.hidden){queue.clear();return;}
      if(!value.events.length)queue.enqueue(value);
      for(const event of value.events)queue.enqueue({...value,event,beforeSidecar});
    }else if(type==='transition'){if(document.hidden)queue.clear();else queue.enqueue(value);}
  });
  // Reattach after either renderer rebuilds the SVG. A child-list observer never drives the clock.
  const map=document.querySelector('#battlefield-map');
  if(map)new MutationObserver(()=>{if(lastFrame&&layer?.parentNode!==map)paint(lastFrame);}).observe(map,{childList:true});
  root.addEventListener('goblin-view-settings-change',()=>{if(lastFrame){builtState=null;paint(lastFrame);}});
  root.addEventListener('goblin-language-change',()=>{if(lastFrame){builtState=null;paint(lastFrame);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)queue.clear();});
  let consumed=false;
  document.addEventListener('pointerdown',event=>{
    consumed=false;
    if(!event.target.closest?.('#battlefield-map,#v2-map,#v2-actions,#v2-command-footer,#v2-phase-action,#end-turn'))return;
    if(queue.skip()){consumed=true;event.preventDefault();event.stopImmediatePropagation();}
  },true);
  document.addEventListener('click',event=>{
    if(consumed){consumed=false;event.preventDefault();event.stopImmediatePropagation();return;}
    if(event.target.closest?.('#battlefield-map,#v2-map,#v2-actions,#v2-command-footer,#v2-phase-action,#end-turn')&&queue.skip()){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);
})(globalThis);
