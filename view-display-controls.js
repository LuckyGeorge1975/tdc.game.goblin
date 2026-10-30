(function(root){
  function create(container,{disclosure,panel,buttons}){
    let compact=false,open=false,resizeFrame=null;
    const measure=document.createElement('div');
    measure.className='v2-control-measure';measure.inert=true;
    measure.setAttribute('aria-hidden','true');container.append(measure);
    const track=document.createElement('div');track.className='v2-control-measure-track';measure.append(track);
    function show(){
      if(compact&&!open&&panel.contains(document.activeElement))disclosure.focus({preventScroll:true});
      if(panel.hidden!==(compact&&!open))panel.hidden=compact&&!open;
      if(disclosure.hidden!==!compact)disclosure.hidden=!compact;
      const expanded=String(compact&&open),mode=String(compact);
      if(disclosure.getAttribute('aria-expanded')!==expanded)disclosure.setAttribute('aria-expanded',expanded);
      if(container.dataset.compact!==mode)container.dataset.compact=mode;
    }
    function update(){
      const available=container.clientWidth;
      if(!available)return;
      track.replaceChildren(...buttons.map(button=>{
        const clone=button.cloneNode(true);clone.removeAttribute('id');clone.removeAttribute('data-area');
        clone.tabIndex=-1;return clone;
      }));
      const next=track.getBoundingClientRect().width>available;
      if(next&&panel.contains(document.activeElement))open=true;
      const focusDisclosure=!next&&document.activeElement===disclosure;
      compact=next;show();
      if(focusDisclosure)buttons[3].focus({preventScroll:true});
    }
    disclosure.onclick=()=>{open=!open;show();};
    function handleKeydown(event){
      if(event.key!=='Escape'||!compact||!open||!container.contains(event.target))return false;
      open=false;show();disclosure.focus({preventScroll:true});
      event.preventDefault();event.stopImmediatePropagation();return true;
    }
    function scheduleUpdate(){
      if(resizeFrame!==null)return;
      resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;update();});
    }
    new ResizeObserver(scheduleUpdate).observe(container);
    return Object.freeze({update,handleKeydown});
  }
  root.GoblinDisplayControls=Object.freeze({create});
})(globalThis);
