(function(root){
  const release=Object.freeze({version:'0.1.31',build:31,releasedAt:'2026-11-16',tag:'v0.1.31',status:'release-candidate'});
  root.GOBLIN_RELEASE=release;
  if(root.document){
    const label=root.document.querySelector('#build-version');
    if(label){label.textContent=`FIELD TEST ${release.version}`;label.title=`Build ${release.build} · ${release.releasedAt}`}
    root.document.documentElement.dataset.build=release.version;
  }
})(globalThis);
