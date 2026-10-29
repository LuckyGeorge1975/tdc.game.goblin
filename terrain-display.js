// Canonical type display for the twelve pinned terrain representatives.
// Source PNGs and output hashes are recorded in assets/terrain-icons/manifest.json.
const TerrainDisplay = (() => {
  const sourceNames = Object.freeze({
    'open-ground': 'open-ground.png', 'rubble-field': 'rubble-field.png',
    mountain: 'mountain.png', ridge: 'ridge.png', forest: 'forest.png',
    marsh: 'marsh.png', water: 'water.png', river: 'river-straight.png',
    road: 'road-straight.png', bridge: 'bridge.png', urban: 'urban-s0.png',
    crater: 'crater.png'
  });
  const types = Object.freeze(Object.fromEntries(Object.entries(sourceNames).map(([id, source]) =>
    [id, Object.freeze({id, key: `v2.ui.terrain.${id}`,
      icon: `assets/terrain-icons/${id}.webp`,
      source: `beratung-ui-ux/design-exports/uebergabe-karte/icons-terrain/${source}`})])));
  const coreTypes = new Set(['open-ground', 'rubble-field']);
  const fallback = id => globalThis.UnitVisuals?.terrainAssetFor(id) || null;
  const t = key => globalThis.GoblinLanguage?.t(key) || key;

  function entry(id) { return id==='field-position'?{id,key:'v2.ui.terrain.field-position',icon:null}:Object.hasOwn(types, id) ? types[id] : null; }
  function label(id) {
    const item = entry(id), generic = t('v2.ui.terrain');
    if (!item) return generic;
    const keyed = t(item.key);
    if (keyed !== item.key) return keyed;
    const ruleLabel = globalThis.TerrainRules?.get(id)?.label;
    const translated = ruleLabel && globalThis.GoblinLanguage?.translate(ruleLabel);
    return translated && translated !== ruleLabel ? translated : ruleLabel || generic;
  }
  function activeIds(ids, core = false) {
    const present = new Set(ids);
    const result=Object.keys(types).filter(id => present.has(id) && (!core || coreTypes.has(id)));if(!core&&present.has('field-position'))result.push('field-position');return result;
  }
  function positionMarker(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 40 40');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M8 15V8H15 M25 8H32V15 M32 25V32H25 M15 32H8V25 M12 20H28');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','2');svg.appendChild(path);return svg}
  function icon(id, className = 'v2-terrain-icon') {
    if(id==='field-position'){const marker=positionMarker();marker.setAttribute('class',className);marker.setAttribute('aria-hidden','true');return marker}
    const item = entry(id);
    if (!item) return null;
    const image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'lazy';
    image.onerror = () => {
      image.onerror = () => image.remove();
      const svg = fallback(id);
      if (svg) image.src = svg;
      else image.remove();
    };
    image.src = item.icon;
    return image;
  }
  function svgIcon(id, x, y, width = 36) {
    if(id==='field-position'){const marker=positionMarker();for(const [k,v] of Object.entries({x,y,width,height:width,'pointer-events':'none'}))marker.setAttribute(k,v);return marker}
    const item = entry(id);
    if (!item) return null;
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttribute('href', item.icon);
    image.setAttribute('x', x);
    image.setAttribute('y', y);
    image.setAttribute('width', width);
    image.setAttribute('height', width * 7 / 6);
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    image.setAttribute('pointer-events', 'none');
    image.addEventListener('error', () => {
      const svg = fallback(id);
      if (svg && image.getAttribute('href') !== svg) image.setAttribute('href', svg);
      else image.remove();
    });
    return image;
  }
  function fillLegend(container, ids, core = false, withHeading = false) {
    const selected = activeIds(ids, core);
    const signature = `${globalThis.GoblinLanguage?.current || 'de'}:${withHeading}:${selected.join(',')}`;
    if (container.dataset.terrainSignature === signature) return;
    container.dataset.terrainSignature = signature;
    const heading = document.createElement('span');
    heading.className = 'v2-label';
    heading.textContent = t('v2.ui.terrain');
    const list = document.createElement('ul');
    list.className = 'v2-terrain-list';
    for (const id of selected) {
      const item = document.createElement('li');
      const image = icon(id);
      if (image) item.append(image);
      const name = document.createElement('span');
      name.textContent = label(id);
      item.append(name);
      list.append(item);
    }
    container.setAttribute('aria-label', t('v2.ui.terrain'));
    container.replaceChildren(...(withHeading ? [heading, list] : [list]));
  }
  return Object.freeze({types, entry, label, activeIds, icon, svgIcon, fillLegend});
})();
