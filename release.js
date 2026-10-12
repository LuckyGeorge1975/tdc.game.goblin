(function(root){
  const release=Object.freeze({version:'0.1.21',build:21,releasedAt:'2026-10-12',tag:'v0.1.21'});
  root.GOBLIN_RELEASE=release;
  if(root.document){
    const label=root.document.querySelector('#build-version');
    if(label){label.textContent=`FIELD TEST ${release.version}`;label.title=`Build ${release.build} · ${release.releasedAt}`}
    root.document.documentElement.dataset.build=release.version;
  }
})(globalThis);
