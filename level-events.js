(function(root) {
  const version = 'goblin-level-draft-v2';
  const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
  const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,47}$/.test(value);
  const languages = ['de','en','es','fr'];
  const text = (value, limit) => typeof value === 'string' && value.trim() && value.length <= limit;
  const message = (value, limit) => text(value,limit) ||
    exact(value,languages) && languages.every(lang => text(value[lang],limit));
  function validate(draft, ids, position) {
    const fail = () => { throw Error('events'); };
    if (!Array.isArray(draft.hotspots) || draft.hotspots.length > 24 ||
        !Array.isArray(draft.hooks) || draft.hooks.length > 24) fail();
    const hotspots = new Set(), hooks = new Set();
    for (const entry of draft.hotspots) {
      if (!exact(entry,['id','center','radius']) || !validId(entry.id) || hotspots.has(entry.id) ||
          !exact(entry.center,['x','y']) || !position(entry.center) ||
          !Number.isInteger(entry.radius) || entry.radius < 0 || entry.radius > 8) fail();
      hotspots.add(entry.id);
    }
    function condition(value, depth = 0) {
      if (depth > 4) fail();
      if (exact(value,['event','unitId']) && ['UnitActed','UnitMoved','UnitDestroyed'].includes(value.event) && ids.has(value.unitId)) return;
      if (exact(value,['pathCrossesHotspot']) && hotspots.has(value.pathCrossesHotspot)) return;
      for (const group of ['all','any']) {
        if (exact(value,[group]) && Array.isArray(value[group]) && value[group].length >= 2 && value[group].length <= 6) {
          value[group].forEach(child => condition(child,depth+1));
          return;
        }
      }
      fail();
    }
    for (const hook of draft.hooks) {
      if (!exact(hook,['id','when','show']) || !validId(hook.id) || hooks.has(hook.id)) fail();
      const show = hook.show;
      if (!(exact(show,['style','title','text']) && show.style === 'standard' ||
          exact(show,['style','title','text','portrait']) && show.style === 'general' && show.portrait === null) ||
          !message(show.title,100) || !message(show.text,600)) fail();
      hooks.add(hook.id);
      condition(hook.when);
    }
  }
  const sessions = new WeakMap();
  let transaction = null;
  function begin(session, actorId) {
    if (!session?.config?.levelEvents?.hooks.length) return null;
    return transaction = {session,actorId,paths:[]};
  }
  function move(actorId, path) {
    if (transaction?.actorId === actorId && path.length) transaction.paths.push(...path);
  }
  function finish(work, session, before, after, accepted, distance, alive) {
    if (!work) return [];
    transaction = null;
    if (!accepted || work.session !== session) return [];
    const spec = session.config.levelEvents;
    let fired = sessions.get(session);
    if (!fired) sessions.set(session,fired = new Set());
    const destroyed = new Set(before.filter(unit => alive(unit) && after.some(next => next.id === unit.id && !alive(next))).map(unit => unit.id));
    const matches = condition => {
      if (condition.all) return condition.all.every(matches);
      if (condition.any) return condition.any.some(matches);
      if (condition.pathCrossesHotspot) {
        const spot = spec.hotspots.find(item => item.id === condition.pathCrossesHotspot);
        return work.paths.some(cell => distance(cell,spot.center) <= spot.radius);
      }
      if (condition.event === 'UnitDestroyed') return destroyed.has(condition.unitId);
      return condition.unitId === work.actorId && (condition.event === 'UnitActed' || work.paths.length > 0);
    };
    const hits = spec.hooks.filter(hook => !fired.has(hook.id) && matches(hook.when));
    hits.forEach(hook => fired.add(hook.id));
    return hits;
  }
  const pending = new WeakSet();
  function show(hits, session) {
    const lang = root.GoblinLanguage?.current ?? 'de';
    const local = value => typeof value === 'string' ? value : value[lang] ?? value.en;
    pending.add(session);
    const warnings = hits.map(({show}) => GameDialogs.warn({
      id:'level-event', title:local(show.title), message:local(show.text),
      portrait:show.style === 'general',
      heading:root.GoblinLanguage?.t('v2.editor.levelEvent') ?? 'Level event',
      acceptLabel:root.GoblinLanguage?.t('ui.dialog.confirm') ?? 'OK'
    }));
    Promise.all(warnings).then(() => {
      pending.delete(session);
      if (session === legacySession) root.GoblinUIV2?.refresh();
    });
  }
  root.GoblinLevelEvents = Object.freeze({version,validId,validate,begin,move,finish,show,pending:session=>pending.has(session)});
  // An enemy turn can destroy units too, but has no reversible player command.
  const scheduleWithoutLevelEvents = scheduleGameTask;
  scheduleGameTask = function(action, delay) {
    const session = legacySession;
    if (phase !== 'enemy' || !session?.config?.levelEvents?.hooks.length)
      return scheduleWithoutLevelEvents(action,delay);
    const observe = () => {
      if (session !== legacySession) return;
      const before = structuredClone(units), work = begin(session,null);
      let completed = false;
      try { action(); completed = true; }
      finally {
        const hits = finish(work,legacySession,before,units,completed,dist,unitAlive);
        if (hits.length) show(hits,session);
      }
    };
    observe.toString = () => action.toString();
    return scheduleWithoutLevelEvents(observe,delay);
  };

})(globalThis);
