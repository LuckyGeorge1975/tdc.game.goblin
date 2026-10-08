(function(root){
  const WEAPONS=Object.freeze({
    main:Object.freeze({label:'MAIN BATTERY',count:1,attack:4,range:3,defense:4}),
    secondary:Object.freeze({label:'SECONDARY BATTERY',count:4,attack:3,range:2,defense:3}),
    missiles:Object.freeze({label:'MISSILES',count:2,attack:6,range:5,defense:3,expendable:true}),
    antipersonnel:Object.freeze({label:'ANTI-PERSONNEL',count:8,attack:1,range:1,defense:1,infantryOnly:true})
  });

  function createMarkIII(){
    return {model:'SIEGEBREAKER',selectedWeapon:'main',maxTreads:45,treads:45,weapons:Object.fromEntries(Object.entries(WEAPONS).map(([key,spec])=>[key,{...spec,destroyed:0,remaining:spec.count,firedThisPhase:0}]))};
  }
  function weaponRemaining(weapon){return Math.max(0,Math.min(weapon.remaining,weapon.count-weapon.destroyed))}
  function weaponReady(weapon){return weapon.expendable?weaponRemaining(weapon):Math.max(0,weaponRemaining(weapon)-(weapon.firedThisPhase||0))}
  function recordFire(weapon){if(weapon.expendable)weapon.remaining=Math.max(0,weaponReady(weapon)-1);else weapon.firedThisPhase=(weapon.firedThisPhase||0)+1}
  function resetFireState(state){Object.values(state.weapons).forEach(weapon=>{weapon.firedThisPhase=0})}
  function movementForTreads(treads){return treads>=31?3:treads>=16?2:treads>0?1:0}
  function targets(state){
    return [...Object.entries(state.weapons).filter(([,weapon])=>weaponRemaining(weapon)>0).map(([key,weapon])=>({key,label:weapon.label,defense:weapon.defense,type:'weapon'})),{key:'treads',label:'TREADS',defense:null,type:'treads'}];
  }
  function chooseTarget(state){
    const priority=['missiles','main','secondary','treads','antipersonnel'];
    return priority.map(key=>targets(state).find(target=>target.key===key)).find(Boolean)||null;
  }
  function applyHit(state,key,result,attackStrength=0){
    if(key==='treads'){
      const loss=result==='X'?Math.min(state.treads,Math.max(0,attackStrength)):0;
      state.treads-=loss;
      return {result,loss,remaining:state.treads};
    }
    const weapon=state.weapons[key];
    if(!weapon)return {result:'NE',loss:0,remaining:0};
    const loss=result==='X'&&weaponRemaining(weapon)>0?1:0;
    weapon.destroyed=Math.min(weapon.count,weapon.destroyed+loss);
    return {result,loss,remaining:weaponRemaining(weapon)};
  }
  function isHelpless(state){return state.treads<=0&&Object.values(state.weapons).every(weapon=>weaponRemaining(weapon)<=0)}
  function summary(state){
    return {movement:movementForTreads(state.treads),treads:`${state.treads}/${state.maxTreads}`,weapons:Object.fromEntries(Object.entries(state.weapons).map(([key,weapon])=>[key,`${weaponRemaining(weapon)}/${weapon.count}`]))};
  }
  root.GoblinSystems=Object.freeze({WEAPONS,createMarkIII,weaponRemaining,weaponReady,recordFire,resetFireState,movementForTreads,targets,chooseTarget,applyHit,isHelpless,summary});
})(globalThis);
