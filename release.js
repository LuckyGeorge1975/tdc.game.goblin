(function(root){
  const release=Object.freeze({version:'0.1.25',build:25,releasedAt:'2026-10-21',tag:'v0.1.25',status:'approved-for-release'});
  root.GOBLIN_RELEASE=release;
  if(root.document){
    const label=root.document.querySelector('#build-version');
    if(label){label.textContent=`FIELD TEST ${release.version}`;label.title=`Build ${release.build} · ${release.releasedAt}`}
    root.document.documentElement.dataset.build=release.version;
  }
})(globalThis);
