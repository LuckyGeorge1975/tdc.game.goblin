(function(root) {
  const t = (key, params) => GoblinLanguage.t(key, params);
  const label = key => t('v2.editor.' + key);
  let jsonText = '';
  function node(tag, text = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }
  function button(key, action, disabled = false) {
    const element = node('button', label(key));
    element.type = 'button';
    element.disabled = disabled;
    element.onclick = action;
    return element;
  }
  function field(text, input) {
    const element = node('label', text);
    element.append(input);
    return element;
  }
  function select(options, value) {
    const element = node('select');
    for (const [id, text] of options) {
      const option = node('option', text);
      option.value = id;
      element.append(option);
    }
    element.value = value;
    return element;
  }
  function coordinate(value, limit) {
    const input = node('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(limit);
    input.value = String(value + 1);
    return input;
  }
  const sameCell = (a,b) => a.x === b.x && a.y === b.y;
  const cellLabel = cell => String.fromCharCode(65 + cell.x) + '-' + String(cell.y + 1).padStart(2, '0');
  const unitName = id => t('library.unit.' + id + '.name');
  function map(view) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox','0 0 790 480');
    svg.setAttribute('aria-label',label('map'));
    svg.classList.add('v2-editor-map');
    if (view.moving) svg.classList.add('v2-editor-map-moving');
    const tiles = new Map(view.draft.terrain.map(cell => [cellLabel(cell), cell.type]));
    const units = new Map(view.draft.units.map(unit => [cellLabel(unit), unit]));
    for (let y = 0; y < view.draft.height; y++) for (let x = 0; x < view.draft.width; x++) {
      const cell = {x,y}, name = cellLabel(cell), type = tiles.get(name) ?? 'open-ground', unit = units.get(name);
      const group = document.createElementNS(NS, 'g');
      const shape = document.createElementNS(NS, 'polygon');
      shape.setAttribute('points',hexPoints(x,y));
      shape.dataset.x = String(x);
      shape.dataset.y = String(y);
      shape.classList.add('v2-editor-hex');
      if (sameCell(cell,view.cell)) shape.classList.add('v2-editor-selected');
      const title = document.createElementNS(NS, 'title');
      title.textContent = [name,TerrainDisplay.label(type),unit && unitName(unit.assetId)].filter(Boolean).join(' · ');
      group.append(title,shape);
      const center = hexCenter(x,y);
      if (type !== 'open-ground') {
        const image = TerrainDisplay.svgIcon(type,center.x - 20,center.y - 20,40);
        if (image) group.append(image);
      }
      if (unit) {
        const marker = document.createElementNS(NS, 'text');
        marker.setAttribute('x',center.x);
        marker.setAttribute('y',center.y);
        marker.classList.add('v2-editor-token','v2-editor-token-' + unit.team);
        marker.textContent = unit.id === 'core' ? '◎' : unit.team === 'player' ? '●' : '◆';
        group.append(marker);
      }
      group.addEventListener('click', () => { if (!view.busy) view.select(cell); });
      svg.append(group);
    }
    return svg;
  }
  function render(panel, view) {
    const {draft,cell,busy,moving} = view;
    const current = draft.units.find(unit => sameCell(unit,cell));
    const types = GoblinEditorDraft.unitTypes();
    const layout = node('div'); layout.className = 'v2-editor-layout';
    const fields = node('div'); fields.className = 'v2-editor-fields';
    const terrain = select(Object.keys(TerrainRules.rules).map(id => [id,TerrainDisplay.label(id)]),
      draft.terrain.find(item => sameCell(item,cell))?.type ?? 'open-ground');
    const asset = select([['',label('chooseUnit')],...types.map(item => [item.assetId,unitName(item.assetId)])],current?.assetId ?? '');
    const team = select(['player','enemy'].map(id => [id,t('ui.team.' + id)]),current?.team ?? 'player');
    const x = coordinate(cell.x,draft.width), y = coordinate(cell.y,draft.height);
    for (const input of [terrain,asset,team,x,y]) input.disabled = busy || moving;
    const error = node('p',view.error ? label('error.' + (['json','schema','unit','terrain','bounds','collision','core','player','startTerrain','events','unavailable'].includes(view.error) ? view.error : 'unavailable')) : '');
    error.className = 'v2-status';
    error.setAttribute('role','status');
    fields.append(node('strong',cellLabel(cell)));
    if (moving) {
      const prompt = node('p',t('v2.editor.pickDestination',{unit:unitName(current.assetId)}));
      prompt.setAttribute('role','status');
      fields.append(prompt,button('cancelMove',() => view.setMoving(false),busy));
    }
    fields.append(field(label('terrain'),terrain),
      button('applyTerrain', () => {
        const tiles = draft.terrain.filter(item => !sameCell(item,cell));
        if (terrain.value !== 'open-ground') tiles.push({...cell,type:terrain.value});
        view.update({...draft,terrain:tiles});
      },busy || moving),
      field(label('unit'),asset),field(label('team'),team),field(label('column'),x),field(label('row'),y),
      button('applyUnit', () => {
        const type = types.find(item => item.assetId === asset.value);
        if (!type) { error.textContent = label('error.unit'); return; }
        const freeId = Array.from({length:96},(_,i)=>'draft-' + (i+1)).find(id => !draft.units.some(unit => unit.id === id));
        const id = asset.value === 'command-core' ? 'core' : current && current.id !== 'core' ? current.id : freeId;
        const next = {x:x.valueAsNumber-1,y:y.valueAsNumber-1};
        const unit = {id,assetId:asset.value,team:team.value,...next,...(type.squads ? {squads:current?.squads ?? 2} : {})};
        const units = current ? draft.units.map(item => item === current ? unit : item) : [...draft.units,unit];
        view.update({...draft,units},next);
      },busy || moving),
      button('moveOnMap', () => view.setMoving(true),busy || moving || !current),
      button('removeUnit', () => view.update({...draft,units:draft.units.filter(unit => unit !== current)}),busy || moving || !current),
      error);
    layout.append(map(view),fields);
    const json = node('textarea'); json.value = jsonText; json.rows = 4;
    json.oninput = () => { jsonText = json.value; };
    const controls = node('div'); controls.className = 'v2-screen-actions';
    const pilot = button('pilot',view.pilot,busy || moving);
    pilot.title = label('pilotRoute');
    controls.append(pilot,button('import', () => view.import(json.value),busy || moving),
      button('export', () => {
        json.value = jsonText = JSON.stringify(draft,null,2);
        json.focus();
        json.select();
      },busy),
      button('play',view.play,busy || moving),button('back',view.back,busy));
    panel.append(layout,field(label('json'),json),controls);
  }
  root.GoblinEditorUI = Object.freeze({render});
})(globalThis);
