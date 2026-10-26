// Presentation only. Never read or write gameplay settings, state or replay data.
(function(root){
  const key='goblin.presentation.animation.v1',modes=Object.freeze(['high','normal','off']);
  let mode='high';
  try{
    const saved=JSON.parse(root.localStorage.getItem(key));
    if(saved&&saved.schemaVersion===1&&Object.keys(saved).length===2&&modes.includes(saved.mode))mode=saved.mode;
  }catch{ /* Default remains usable when storage is absent, blocked or corrupt. */ }
  root.GoblinPresentationPreferences=Object.freeze({key,modes,
    read:()=>Object.freeze({schemaVersion:1,mode}),
    set(value){
      if(!modes.includes(value))return false;
      mode=value;
      try{root.localStorage.setItem(key,JSON.stringify({schemaVersion:1,mode}));}catch{ /* Session choice still applies. */ }
      return true;
    }
  });
})(globalThis);
