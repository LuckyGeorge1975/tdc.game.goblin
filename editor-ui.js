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
  const coordinateFields = (container, cell, draft) => {
    const x = coordinate(cell.x,draft.width), y = coordinate(cell.y,draft.height);
    container.append(field(label('column'),x),field(label('row'),y));
    return () => ({x:x.valueAsNumber-1,y:y.valueAsNumber-1});
  };
  function messageEditor(container, title, value, limit, onchange) {
    const locales = ['de','en','es','fr'];
    const localized = typeof value === 'object';
    const toggle = node('input');
    toggle.type = 'checkbox';
    toggle.checked = localized;
    const fields = node('div');
    function renderFields() {
      fields.replaceChildren();
      for (const lang of toggle.checked ? locales : ['']) {
        const input = node('textarea');
        input.rows = limit === 100 ? 1 : 3;
        input.maxLength = limit;
        input.value = lang ? typeof value === 'string' ? value : value[lang] : typeof value === 'string' ? value : value.en;
        input.oninput = () => {
          value = lang ? {...value,[lang]:input.value} : input.value;
          onchange(value);
        };
        fields.append(field([title,lang.toUpperCase()].filter(Boolean).join(' · '), input));
      }
    }
    toggle.onchange = () => {
      if (toggle.checked) value = Object.fromEntries(locales.map(lang => [lang,value]));
      else value = value[GoblinLanguage.current] ?? value.en;
      onchange(value);
      renderFields();
    };
    container.append(field(label('localized'),toggle),fields);
    renderFields();
  }
  function conditionEditor(value, draft, change, depth = 0) {
    const box = node('fieldset');
    const unitTypes = ['UnitActed','UnitMoved','UnitDestroyed'];
    const types = [...unitTypes,...(draft.hotspots?.length ? ['pathCrossesHotspot'] : []),...(depth < 4 ? ['all','any'] : [])];
    const kind = value.event ?? Object.keys(value)[0];
    const fallback = () => ({event:'UnitActed',unitId:draft.units[0].id});
    const selector = select(types.map(type => [type,label('trigger.' + type)]),kind);
    selector.onchange = () => {
      const next = selector.value;
      change(unitTypes.includes(next) ? {event:next,unitId:draft.units[0].id} :
        next === 'pathCrossesHotspot' ? {[next]:draft.hotspots?.[0]?.id ?? ''} : {[next]:[fallback(),fallback()]});
    };
    box.append(field(label('trigger'),selector));
    if (value.all || value.any) {
      const children = value[kind];
      for (const [index,child] of children.entries()) {
        box.append(conditionEditor(child,draft,next => change({[kind]:children.map((item,i) => i === index ? next : item)}),depth+1),
          button('removeCondition',() => change({[kind]:children.filter((_,i) => i !== index)}),children.length <= 2));
      }
      box.append(button('addCondition',() => change({[kind]:[...children,fallback()]}),children.length >= 6));
    } else {
      const hotspot = kind === 'pathCrossesHotspot';
      const refs = hotspot ? draft.hotspots ?? [] : draft.units;
      const inputs = select(refs.map(entry => [entry.id,hotspot ? entry.id : `${entry.id} · ${unitName(entry.assetId)}`]),
        hotspot ? value.pathCrossesHotspot : value.unitId);
      inputs.onchange = () => change(hotspot ? {pathCrossesHotspot:inputs.value} : {event:kind,unitId:inputs.value});
      box.append(field(label(hotspot ? 'hotspot' : 'unit'),inputs));
    }
    return box;
  }
  function renderMissionFields(view) {
    const {draft,busy,moving} = view;
    const group = node('fieldset');
    group.disabled = busy || moving;
    group.append(node('legend','FULL_CATALOG_v1'));
    const limit = node('input');
    limit.type = 'number'; limit.min = '1'; limit.step = '1'; limit.value = draft.goals?.[0]?.turns ?? '';
    let briefing = draft.briefing ?? '';
    group.append(field(label('turnLimit'),limit));
    messageEditor(group,label('briefing'),briefing,600,next => { briefing = next; });
    group.append(button('applyMission',() => {
      const next = {...draft};
      if (limit.value === '') delete next.goals;
      else next.goals = [{type:'enemy-turn-limit',turns:limit.valueAsNumber}];
      if (briefing === '') delete next.briefing;
      else next.briefing = briefing;
      view.update(next);
    }));
    const hotspots = draft.hotspots ?? [];
    const hotList = node('section'); hotList.append(node('h3',label('hotspots')));
    const events = draft.waveTemplates ? [] : draft.events ?? [];
    function editHotspot(item, index) {
      const box = node('fieldset');
      const id = node('input'); id.value = item.id; id.maxLength = 48;
      box.append(field(label('entryId'),id));
      const center = coordinateFields(box,item.center,draft);
      const radius = node('input'); radius.type = 'number'; radius.min = '0'; radius.max = '8'; radius.value = String(item.radius);
      box.append(field(label('radius'),radius),button('applyHotspot',() => {
        const next = [...hotspots];
        next[index] = {id:id.value,center:center(),radius:radius.valueAsNumber};
        view.update({...draft,hotspots:next});
      }));
      if (index < hotspots.length) box.append(button('removeHotspot',() => view.update({...draft,hotspots:hotspots.filter((_,i) => i !== index)})));
      return box;
    }
    hotspots.forEach((item,index) => hotList.append(editHotspot(item,index)));
    if (hotspots.length < 24) {
      const fresh = Array.from({length:25},(_,i) => 'hotspot-' + (i + 1)).find(id => !hotspots.some(item => item.id === id));
      hotList.append(editHotspot({id:fresh,center:view.cell,radius:0},hotspots.length));
    }
    group.append(hotList);
    if (draft.waveTemplates) {
      group.append(node('p',label('wavesPreserved')));
      return group;
    }
    const eventList = node('section'); eventList.append(node('h3',label('events')));
    function editEvent(source, index) {
      const box = node('fieldset');
      if (source.effect.type === 'remove-enemy-turn-limit') {
        box.append(node('p',label('removeEnemyTurnLimit')),
          button('removeEvent',() => view.update({...draft,events:events.filter((_,i) => i !== index)})));
        return box;
      }
      const id = node('input'); id.value = source.id; id.maxLength = 48;
      const type = select(['dialog','general-dialog'].map(id => [id,label(id)]),source.effect.type);
      let when = source.when, {title,text} = source.effect;
      let tree;
      const draw = () => {
        const next = conditionEditor(when,draft,value => { when = value; draw(); });
        if (tree) tree.replaceWith(next);
        else box.append(next);
        tree = next;
      };
      box.append(field(label('entryId'),id),field(label('effect'),type));
      draw();
      messageEditor(box,label('dialogTitle'),title,100,next => { title = next; });
      messageEditor(box,label('dialogText'),text,600,next => { text = next; });
      box.append(button('applyEvent',() => {
        const next = [...events];
        next[index] = {id:id.value,when,effect:{type:type.value,title,text}};
        view.update({...draft,events:next});
      }));
      if (index < events.length) box.append(button('removeEvent',() => view.update({...draft,events:events.filter((_,i) => i !== index)})));
      return box;
    }
    events.forEach((event,index) => eventList.append(editEvent(event,index)));
    if (events.length < 24) {
      const fresh = Array.from({length:25},(_,i) => 'event-' + (i + 1)).find(id => !events.some(event => event.id === id));
      eventList.append(editEvent({id:fresh,when:{event:'UnitActed',unitId:draft.units[0].id},effect:{type:'dialog',title:'',text:''}},events.length));
    }
    group.append(eventList);
    return group;
  }
  function map(view) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox',boardViewBox(view.draft.width,view.draft.height));
    svg.setAttribute('aria-label',label('map'));
    svg.classList.add('v2-editor-map');
    if (view.moving) svg.classList.add('v2-editor-map-moving');
    const tiles = new Map(view.draft.terrain.map(cell => [cellLabel(cell), cell.type]));
    const units = new Map(view.draft.units.filter(unit => !unit.embarkedOn).map(unit => [cellLabel(unit), unit]));
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
    const current = draft.units.find(unit => !unit.embarkedOn && sameCell(unit,cell));
    const cargo = current ? draft.units.filter(unit => unit.embarkedOn === current.id) : [];
    const types = GoblinEditorDraft.unitTypes();
    const layout = node('div'); layout.className = 'v2-editor-layout';
    const fields = node('div'); fields.className = 'v2-editor-fields';
    const limits = GoblinEditorDraft.size;
    const width = coordinate(draft.width-1,limits.maxWidth), height = coordinate(draft.height-1,limits.maxHeight);
    width.min = String(limits.minWidth); height.min = String(limits.minHeight);
    width.disabled = height.disabled = busy || moving;
    fields.append(field(label('boardWidth'),width),field(label('boardHeight'),height),
      button('applySize',() => {
        const next = {...draft,width:width.valueAsNumber,height:height.valueAsNumber};
        view.update(next,{x:Math.min(cell.x,next.width-1),y:Math.min(cell.y,next.height-1)});
      },busy || moving));
    const terrain = select(Object.keys(TerrainRules.rules).map(id => [id,TerrainDisplay.label(id)]),
      draft.terrain.find(item => sameCell(item,cell))?.type ?? 'open-ground');
    const asset = select([['',label('chooseUnit')],...types.map(item => [item.assetId,unitName(item.assetId)])],current?.assetId ?? '');
    const team = select(['player','enemy'].map(id => [id,t('ui.team.' + id)]),current?.team ?? 'player');
    const x = coordinate(cell.x,draft.width), y = coordinate(cell.y,draft.height);
    for (const input of [terrain,asset,team,x,y]) input.disabled = busy || moving;
    const error = node('p',view.error ? label('error.' + (['json','schema','unit','terrain','bounds','collision','core','player','startTerrain','events','unavailable','references','briefing','goals','cargo','waves'].includes(view.error) ? view.error : 'unavailable')) : '');
    error.className = 'v2-status';
    error.setAttribute('role','status');
    fields.append(node('strong',cellLabel(cell)));
    if (cargo.length) fields.append(node('p',t('v2.editor.cargo',{units:cargo.map(unit => unitName(unit.assetId)).join(', ')})));
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
        const freeId = Array.from({length:draft.units.length+(draft.waveTemplates?.length??0)+1},(_,i)=>'draft-' + (i+1)).find(id =>
          !draft.units.some(unit => unit.id === id) && !draft.waveTemplates?.some(unit => unit.id === id));
        const id = asset.value === 'command-core' ? 'core' : current && current.id !== 'core' ? current.id : freeId;
        const next = {x:x.valueAsNumber-1,y:y.valueAsNumber-1};
        const unit = {id,assetId:asset.value,team:team.value,...next,...(type.squads ? {squads:current?.squads ?? 2} : {}),
          ...(current?.name && asset.value === current.assetId ? {name:current.name} : {})};
        const units = current ? draft.units.map(item => item === current ? unit :
          item.embarkedOn === current.id ? {...item,...next} : item) : [...draft.units,unit];
        view.update({...draft,units},next);
      },busy || moving),
      button('moveOnMap', () => view.setMoving(true),busy || moving || !current),
      button('removeUnit', () => view.update({...draft,units:draft.units.filter(unit => unit !== current)}),busy || moving || !current));
    layout.append(map(view),fields);
    const json = node('textarea'); json.value = jsonText; json.rows = 4;
    json.oninput = () => { jsonText = json.value; };
    const controls = node('div'); controls.className = 'v2-screen-actions';
    const pilot = button('pilot',view.pilot,busy || moving);
    pilot.title = label('pilotRoute');
    controls.append(pilot,button('import', () => view.import(json.value),busy || moving),
      button('export', () => {
        json.value = jsonText = GoblinEditorDraft.exportJson(draft);
        json.focus();
        json.select();
      },busy),
      button('play',view.play,busy || moving),button('back',view.back,busy));
    const mission = node('details');
    mission.open = view.missionOpen;
    mission.ontoggle = () => view.setMissionOpen(mission.open);
    mission.append(node('summary',label('missionFields')),renderMissionFields(view));
    panel.append(error,layout,mission,field(label('json'),json),controls);
  }
  root.GoblinEditorUI = Object.freeze({render});
})(globalThis);
