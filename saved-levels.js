(function (root) {
  const key = 'tdc.game.goblin.saved-levels.v1';
  const workingKey = 'tdc.game.goblin.editor-working.v1';
  function read() {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const store = JSON.parse(raw);
    if (store?.version !== 1 || !Array.isArray(store.levels)) throw Error('invalid');
    const ids = new Set();
    for (const entry of store.levels) {
      if (!entry || !/^[a-f0-9-]{36}$/.test(entry.id) || ids.has(entry.id) ||
          typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 80 ||
          typeof entry.level !== 'string') throw Error('invalid');
      ids.add(entry.id);
    }
    return store.levels;
  }
  function save(name, draft, previous = null) {
    name = name.trim();
    if (!name || name.length > 80) throw Error('name');
    const levels = read();
    const index = previous ? levels.findIndex(entry => entry.id === previous.id) : -1;
    if (previous && (index < 0 || levels[index].level !== previous.level || levels[index].name !== previous.name))
      throw Error('conflict');
    const level = GoblinEditorDraft.exportJson(draft);
    GoblinEditorDraft.parse(level);
    const entry = {id: previous?.id ?? crypto.randomUUID(), name, level};
    if (index < 0) levels.push(entry);
    else levels[index] = entry;
    localStorage.setItem(key, JSON.stringify({version:1, levels}));
    return entry;
  }
  function saveWorking(name, draft) {
    GoblinEditorDraft.validateWorking(draft);
    const data = JSON.stringify({name:name.trim().slice(0,80),draft});
    if (data.length > 67000) throw Error('schema');
    localStorage.setItem(workingKey,data);
  }
  function readWorking() {
    const raw = localStorage.getItem(workingKey);
    if (raw === null) return null;
    if (raw.length > 67000) throw Error('schema');
    const {name,draft} = JSON.parse(raw);
    if (typeof name !== 'string' || name.length > 80) throw Error('schema');
    GoblinEditorDraft.validateWorking(draft);
    return {name,draft};
  }
  function clearWorking() { localStorage.removeItem(workingKey); }
  root.GoblinSavedLevels = Object.freeze({read, save, readWorking, saveWorking, clearWorking});
})(globalThis);
