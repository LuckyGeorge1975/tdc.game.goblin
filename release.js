(function(root){
  const release=Object.freeze({version:'0.1.19',build:19,releasedAt:'2026-10-08',tag:'v0.1.19'});
  root.GOBLIN_RELEASE=release;
  if(root.document){
    const label=root.document.querySelector('#build-version');
    if(label){label.textContent=`FIELD TEST ${release.version}`;label.title=`Build ${release.build} · ${release.releasedAt}`}
    root.document.documentElement.dataset.build=release.version;
  }
})(globalThis);
