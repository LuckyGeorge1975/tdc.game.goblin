(function(){
  const picker=document.querySelector('#art-style-select');
  if(!picker)return;

  for(const style of UnitVisuals.styles){
    const option=document.createElement('option');
    option.value=style.id;
    option.textContent=style.title;
    picker.appendChild(option);
  }

  let saved=null;
  try{saved=localStorage.getItem('goblin-art-style')}catch{/* Storage is optional. */}
  const initial=UnitVisuals.styles.some(style=>style.id===saved)?saved:'02-technical-illustration';
  UnitVisuals.setStyle(initial);
  picker.value=initial;

  function replaceWithArt(container,unit,view='icons'){
    const asset=view==='icons'?(UnitVisuals.resolve(unit).asset||null)
      :UnitVisuals.assetFor(unit,view);
    if(!asset||!container)return;
    const picture=document.createElement('img');
    picture.src=asset;
    picture.alt='';
    picture.className='unit-art-image';
    container.replaceChildren(picture);
  }

  const baseUpdateRoster=updateRoster;
  updateRoster=function(){
    baseUpdateRoster();
    const players=units.filter(unit=>unit.team==='player');
    document.querySelectorAll('#unit-roster .unit-card').forEach((card,index)=>{
      if(players[index]?.hp>0)replaceWithArt(card.querySelector('.unit-token'),players[index]);
    });
  };

  const baseShowCarrierCargo=showCarrierCargo;
  showCarrierCargo=function(){
    baseShowCarrierCargo();
    if(!selected?.transportCapacity)return;
    const cargo=carrierCargo(selected);
    document.querySelectorAll('#carrier-cargo .cargo-slot:not(.transport-slot)').forEach((slot,index)=>{
      replaceWithArt(slot,cargo[index]);
    });
  };

  const baseUpdateSelection=updateSelection;
  updateSelection=function(){
    baseUpdateSelection();
    if(selected?.hp>0)replaceWithArt(document.querySelector('#selection-readout .selection-icon'),selected);
  };

  const baseRenderUnitGuide=renderUnitGuide;
  renderUnitGuide=function(){
    baseRenderUnitGuide();
    const symbol=document.querySelector('#guide-symbol');
    symbol.classList.add('art-active');
    replaceWithArt(symbol,unitGuideEntries[guideIndex],'library');
  };

  let changing=false;
  picker.addEventListener('change',async()=>{
    const requested=picker.value,previous=UnitVisuals.currentStyle();
    picker.value=previous;
    if(changing||requested===previous||!UnitVisuals.styles.some(style=>style.id===requested)||GameDialogs.isOpen())return;
    changing=true;
    try{
      if((hasScenarioProgress()||gameOver)&&!await GameDialogs.confirm({
        id:'art-style',title:'ICON-SET WECHSELN?',
        message:'Der aktuelle Spielstand wird verworfen und das Szenario neu gestartet.',
        acceptLabel:'WECHSELN',cancelLabel:'WEITERSPIELEN'
      }))return;
      UnitVisuals.setStyle(requested);
      picker.value=requested;
      try{localStorage.setItem('goblin-art-style',requested)}catch{/* Session still works. */}
      loadScenario(currentScenario);
    }finally{changing=false}
  });

  draw();
})();
