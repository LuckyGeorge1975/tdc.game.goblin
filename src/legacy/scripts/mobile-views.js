(()=>{
  const query=matchMedia('(max-width:760px), (max-height:500px) and (pointer:coarse)');
  const buttons=[...document.querySelectorAll('[data-mobile-view]')];
  const panels=[...document.querySelectorAll('[data-mobile-panel]')];
  const map=document.querySelector('#battlefield-map');
  function show(view,{focus=false}={}){
    if(!panels.some(panel=>panel.dataset.mobilePanel===view))return;
    document.documentElement.dataset.mobileView=view;
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.mobileView===view));
    if(query.matches){
      const target=panels.find(panel=>panel.dataset.mobilePanel===view);
      target.scrollIntoView({block:'start',behavior:'instant'});
      if(focus){(view==='map'?map:target).focus({preventScroll:true})}
    }
  }
  for(const panel of panels)panel.tabIndex=-1;
  for(const button of buttons)button.addEventListener('click',()=>show(button.dataset.mobileView,{focus:true}));
  document.querySelector('#unit-roster').addEventListener('click',event=>{
    if(query.matches&&event.target.closest('.unit-card'))show('map',{focus:true});
  });
  document.documentElement.dataset.mobileView='map';
  globalThis.GoblinMobileViews={show,isMobile:()=>query.matches};
  addEventListener('load',()=>{if(query.matches)show('map')},{once:true});
})();
