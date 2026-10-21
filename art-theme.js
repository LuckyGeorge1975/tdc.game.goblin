(function(){
  if(globalThis.goblinBootProfileError)return;
  const fixedStyle=UnitVisuals.currentStyle();
  try{if(localStorage.getItem('goblin-art-style')!==fixedStyle)
    localStorage.setItem('goblin-art-style',fixedStyle)}catch{/* Storage is optional. */}

  function replaceWithArt(container,unit,view='icons'){
    const asset=view==='icons'?(UnitVisuals.resolve(unit).asset||null)
      :UnitVisuals.assetFor(unit,view);
    if(!asset||!container)return;
    const image=document.createElement('img');
    image.src=asset;
    image.alt='';
    image.className='unit-art-image';
    if(view==='library'){
      const picture=document.createElement('picture');
      picture.className='unit-art-picture';
      const source=document.createElement('source');
      source.type='image/webp';
      source.srcset=UnitVisuals.assetFor(unit,view,'webp');
      picture.append(source,image);
      container.replaceChildren(picture);
    }else container.replaceChildren(image);
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

  draw();
})();
