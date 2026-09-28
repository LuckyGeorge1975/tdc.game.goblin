(function(root){
  const release=Object.freeze({version:'0.1.12',build:12,releasedAt:'2026-09-28',tag:'v0.1.12'});
  root.GOBLIN_RELEASE=release;
  if(root.document){
    const label=root.document.querySelector('#build-version');
    if(label){label.textContent=`FIELD TEST ${release.version}`;label.title=`Build ${release.build} · ${release.releasedAt}`}
    root.document.documentElement.dataset.build=release.version;
  }
})(globalThis);
