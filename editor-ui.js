(function(root) {
  const t = (key, params) => GoblinLanguage.t(key, params);
  const label = key => t('v2.editor.' + key);
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
    const limit = node('input');
    limit.type = 'number'; limit.min = '1'; limit.step = '1'; limit.value = draft.goals?.[0]?.turns ?? '';
    let briefing = draft.briefing ?? '';
    const limits = GoblinEditorDraft.size;
    const width = coordinate(draft.width-1,limits.maxWidth), height = coordinate(draft.height-1,limits.maxHeight);
    width.min = String(limits.minWidth); height.min = String(limits.minHeight);
    group.append(field(label('boardWidth'),width),field(label('boardHeight'),height),
      button('applySize',() => {
        const next = {...draft,width:width.valueAsNumber,height:height.valueAsNumber};
        view.update(next,{x:Math.min(view.cell.x,next.width-1),y:Math.min(view.cell.y,next.height-1)});
      }),field(label('turnLimit'),limit));
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
    events.forEach((event,index) => {
      const row = node('details'); row.className = 'v2-editor-event';
      row.append(node('summary',event.id),editEvent(event,index));
      eventList.append(row);
    });
    if (events.length < 24) {
      const fresh = Array.from({length:25},(_,i) => 'event-' + (i + 1)).find(id => !events.some(event => event.id === id));
      const add = button('newEvent',() => {
        const event = {id:fresh,when:{event:'UnitActed',unitId:draft.units[0].id},effect:{type:'dialog',title:'',text:''}};
        add.replaceWith(editEvent(event,events.length));
      },!draft.units.length);
      if (!draft.units.length) add.title = label('eventNeedsUnit');
      eventList.append(add);
    }
    group.append(eventList);
    return group;
  }
  function map(view, blocked) {
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
      group.addEventListener('click', () => { if (!view.busy && !blocked()) view.select(cell); });
      svg.append(group);
    }
    return svg;
  }
  function cameraView(view) {
    const viewport = node('div');
    viewport.className = 'v2-editor-viewport';
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label',label('map'));
    const camera = view.camera;
    let pointer = null, suppressClick = false;
    const svg = map(view,() => suppressClick);
    const controls = node('div'); controls.className = 'v2-editor-zoom';
    const zoomOut = button('zoomOut',() => zoom(camera.zoom / 1.25));
    const zoomIn = button('zoomIn',() => zoom(camera.zoom * 1.25));
    const fit = button('zoomFit',() => {
      Object.assign(camera,{zoom:1,x:0,y:0});
      resize();
    });
    controls.append(zoomOut,zoomIn,fit);
    function resize() {
      if (!viewport.isConnected || !viewport.clientWidth || !viewport.clientHeight) return;
      const box = svg.viewBox.baseVal;
      const scale = Math.min(viewport.clientWidth / box.width,viewport.clientHeight / box.height) * camera.zoom;
      svg.style.width = Math.floor(box.width * scale) + 'px';
      svg.style.height = Math.floor(box.height * scale) + 'px';
      svg.style.marginTop = Math.max(0,(viewport.clientHeight - box.height * scale) / 2) + 'px';
      viewport.scrollTo(camera.x,camera.y);
      zoomOut.disabled = camera.zoom <= 1;
      zoomIn.disabled = camera.zoom >= 4;
    }
    function zoom(next,x,y) {
      next = Math.max(1,Math.min(4,next));
      if (next === camera.zoom) return;
      const bounds = viewport.getBoundingClientRect();
      const point = new DOMPoint(x ?? bounds.left + bounds.width/2,y ?? bounds.top + bounds.height/2);
      const before = svg.getScreenCTM();
      if (!before) return;
      const anchor = point.matrixTransform(before.inverse());
      camera.zoom = next;
      resize();
      const after = anchor.matrixTransform(svg.getScreenCTM());
      viewport.scrollBy(after.x-point.x,after.y-point.y);
      camera.x = viewport.scrollLeft; camera.y = viewport.scrollTop;
    }
    viewport.addEventListener('scroll',() => {
      if (!viewport.isConnected || !viewport.clientWidth || !viewport.clientHeight) return;
      camera.x = viewport.scrollLeft; camera.y = viewport.scrollTop;
    },{passive:true});
    viewport.addEventListener('wheel',event => {
      event.preventDefault();
      zoom(camera.zoom * (event.deltaY < 0 ? 1.1 : 0.9),event.clientX,event.clientY);
    },{passive:false});
    viewport.addEventListener('pointerdown',event => {
      if (!event.isPrimary || event.button !== 0) return;
      suppressClick = false;
      pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    });
    viewport.addEventListener('pointermove',event => {
      if (pointer?.id !== event.pointerId) return;
      const x = pointer.x-event.clientX, y = pointer.y-event.clientY;
      if (!suppressClick && Math.hypot(x,y) < 8) return;
      if (!suppressClick) {
        suppressClick = true;
        viewport.setPointerCapture(event.pointerId);
        viewport.classList.add('v2-editor-panning');
      }
      viewport.scrollTo(pointer.left+x,pointer.top+y);
      event.preventDefault();
    });
    const stopPan = event => {
      if (pointer?.id !== event.pointerId) return;
      pointer = null;
      viewport.classList.remove('v2-editor-panning');
      setTimeout(() => { if (!pointer) suppressClick = false; },0);
    };
    viewport.addEventListener('pointerup',stopPan);
    viewport.addEventListener('pointercancel',stopPan);
    viewport.addEventListener('pointerleave',event => { if (!suppressClick) stopPan(event); });
    viewport.append(svg);
    requestAnimationFrame(() => {
      if (!viewport.isConnected) return;
      resize();
      new ResizeObserver(resize).observe(viewport);
    });
    return {viewport,controls};
  }
  function dialog(panel,title) {
    const modal = node('dialog'); modal.className = 'v2-editor-dialog';
    modal.setAttribute('aria-label',title);
    modal.append(node('h2',title));
    panel.append(modal);
    return modal;
  }
  function newLevel(panel,view) {
    const modal = dialog(panel,label('new'));
    const limits = GoblinEditorDraft.size;
    const width = coordinate(view.draft.width-1,limits.maxWidth);
    const height = coordinate(view.draft.height-1,limits.maxHeight);
    width.min = String(limits.minWidth); height.min = String(limits.minHeight);
    width.required = height.required = true;
    const form = node('form');
    const submit = button('create',null);
    submit.type = 'submit';
    form.append(field(label('boardWidth'),width),field(label('boardHeight'),height),
      submit,button('cancel',() => modal.close()));
    form.onsubmit = event => {
      event.preventDefault();
      modal.close();
      view.create(width.valueAsNumber,height.valueAsNumber);
    };
    modal.append(form);
    modal.onclose = () => modal.remove();
    modal.showModal();
  }
  function palette(className, title) {
    const list = node('div'); list.className = 'v2-editor-palette ' + className;
    list.setAttribute('role','group'); list.setAttribute('aria-label',title);
    return list;
  }
  function paletteOption(title, action, disabled, active, icon) {
    const item = button('',action,disabled);
    item.textContent = '';
    item.title = title; item.setAttribute('aria-label',title);
    item.setAttribute('aria-pressed',String(active));
    if (icon) item.append(icon);
    else item.textContent = title;
    return item;
  }
  function render(panel, view) {
    const {draft,cell,busy,moving} = view;
    const current = draft.units.find(unit => !unit.embarkedOn && sameCell(unit,cell));
    const cargo = current ? draft.units.filter(unit => unit.embarkedOn === current.id) : [];
    const work = node('div'); work.className = 'v2-editor-work';
    const disabled = busy || moving;
    const terrain = palette('v2-editor-terrain',label('terrain'));
    const activeTerrain = draft.terrain.find(item => sameCell(item,cell))?.type ?? 'open-ground';
    for (const id of Object.keys(TerrainRules.rules)) {
      const icon = document.createElementNS(NS,'svg');
      icon.setAttribute('viewBox','0 0 40 40'); icon.setAttribute('aria-hidden','true');
      const tile = TerrainDisplay.svgIcon(id,0,0,40);
      if (tile) icon.append(tile);
      const option = paletteOption(TerrainDisplay.label(id),() => {
        const tiles = draft.terrain.filter(item => !sameCell(item,cell));
        if (id !== 'open-ground') tiles.push({...cell,type:id});
        view.update({...draft,terrain:tiles});
      },disabled,id === activeTerrain,tile ? icon : null);
      option.id = 'v2-editor-terrain-' + id;
      option.dataset.terrain = id;
      terrain.append(option);
    }
    const types = GoblinEditorDraft.unitTypes();
    const unitPalette = team => {
      const list = palette('v2-editor-units-' + team,t('ui.team.'+team));
      for (const type of types) {
        const {assetId,squads} = type;
        if (team === 'player' && assetId === 'command-core') continue;
        const icon = UnitVisuals.iconElement({visualKey:assetId,team},'v2-editor-unit-icon');
        const option = paletteOption(unitName(assetId),() => {
          const freeId = Array.from({length:draft.units.length+(draft.waveTemplates?.length??0)+1},(_,i) => 'draft-'+(i+1))
            .find(id => !draft.units.some(unit=>unit.id===id) && !draft.waveTemplates?.some(unit=>unit.id===id));
          const id = assetId === 'command-core' ? 'core' : current && current.id !== 'core' ? current.id : freeId;
          const unit = {id,assetId,team,...cell,...(squads ? {squads:current?.squads ?? 2} : {}),
            ...(current?.name && assetId===current.assetId ? {name:current.name} : {})};
          const units = current ? draft.units.map(item=>item===current ? unit : item) : [...draft.units,unit];
          view.update({...draft,units});
        },disabled,current?.assetId===assetId && current.team===team,icon);
        option.id = 'v2-editor-unit-' + team + '-' + assetId;
        option.dataset.unit = assetId;
        list.append(option);
      }
      return list;
    };
    const {viewport,controls:cameraControls} = cameraView(view);
    const layout = node('div'); layout.className = 'v2-editor-layout';
    const light = unitPalette('player'), dark = unitPalette('enemy');
    layout.append(light,viewport,dark);
    for (const [key,element,axis] of [['terrain',terrain,'scrollLeft'],['player',light,'scrollTop'],['enemy',dark,'scrollTop']]) {
      const positions = view.camera.palettes;
      element.addEventListener('scroll',() => { positions[key] = element[axis]; },{passive:true});
      requestAnimationFrame(() => { if (element.isConnected) element[axis] = positions[key] ?? 0; });
    }
    const status = node('div'); status.className = 'v2-editor-status';
    const selected = node('strong',cellLabel(cell)); selected.className = 'v2-editor-cell';
    status.append(selected,cameraControls);
    if (!moving) status.append(node('p',label('fieldTools')));
    if (moving && current) status.append(node('p',t('v2.editor.pickDestination',{unit:unitName(current.assetId)})));
    if (cargo.length) status.append(node('p',t('v2.editor.cargo',{units:cargo.map(unit=>unitName(unit.assetId)).join(', ')})));
    const error = node('p',view.error ? label('error.' + (['json','schema','unit','terrain','bounds','collision','core','player','startTerrain','events','unavailable','references','briefing','goals','cargo','waves'].includes(view.error) ? view.error : 'unavailable')) : '');
    error.className = 'v2-status'; error.setAttribute('role','status'); error.hidden = !view.error;
    const controls = node('div'); controls.className = 'v2-screen-actions v2-editor-actions';
    const file = node('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
    file.onchange = () => view.importFile(file.files[0]);
    const metadata = button('missionFields',() => { view.setMissionOpen(true); showMetadata(); },disabled);
    metadata.id = 'v2-editor-metadata';
    const create = button('new',() => newLevel(panel,view),disabled); create.id = 'v2-editor-new';
    controls.append(create,view.save);
    if (view.overwrite) controls.append(view.overwrite);
    controls.append(button('export',view.exportFile,disabled),button('import',() => file.click(),disabled),
      button('play',view.play,disabled),metadata,button('pilot',view.pilot,disabled));
    const back = button('back',view.back,busy);
    back.textContent = t('ui.nav.back');
    controls.append(moving ? button('cancelMove',() => view.setMoving(false),busy)
      : button('moveOnMap',() => view.setMoving(true),busy || !current),
      button('removeUnit',() => view.update({...draft,units:draft.units.filter(unit=>unit!==current)}),
        disabled || !current));
    const footer = node('footer'); footer.className = 'v2-screen-footer v2-editor-footer'; footer.append(back);
    work.append(terrain,layout,status);
    panel.append(error,work,view.name,controls,file,footer);
    function showMetadata() {
      const modal = dialog(panel,label('missionFields'));
      const closeMetadata = () => {
        view.setMissionOpen(false);
        modal.close();
      };
      const close = button('back',closeMetadata);
      close.textContent = t('ui.nav.back');
      if (view.error) modal.append(error);
      modal.append(renderMissionFields(view),close);
      modal.oncancel = event => { event.preventDefault(); closeMetadata(); };
      modal.onclose = () => modal.remove();
      modal.showModal();
    }
    if (view.missionOpen && !view.importLevels) showMetadata();
    if (view.importLevels) {
      const choices = view.importLevels;
      const modal = dialog(panel,label('import'));
      const importControls = node('div'); importControls.className = 'v2-editor-import';
      const level = select(choices.map((entry,i)=>[String(i),entry.name]),'0');
      const name = node('input'); name.maxLength = 80; name.value = choices[0].name;
      level.onchange = () => { name.value = choices[Number(level.value)].name; };
      if (choices.length>1) importControls.append(field(label('openPackageLevel'),level));
      importControls.append(field(t('v2.saved.name'),name),button('importSave',() => view.saveImported(choices[Number(level.value)],name.value),busy),
        button('cancel',view.cancelImport,busy));
      if (view.importMessage) {
        const status = node('p',view.importMessage); status.setAttribute('role','status'); modal.append(status);
      }
      modal.append(importControls);
      modal.oncancel = event => { event.preventDefault(); view.cancelImport(); };
      modal.showModal();
    }
  }
  root.GoblinEditorUI = Object.freeze({render});
})(globalThis);
