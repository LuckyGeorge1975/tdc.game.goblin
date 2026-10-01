// Content production tool. Generates standalone SVG illustrations; the game does not load this file.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

const styles = [
  { id: '01-modular-stealth-geometry', title: 'Modular Stealth Geometry', body: '#26343b', plate: '#52636b', light: '#849aa0', dark: '#101a20', accent: '#c9ef54', second: '#67d8e7', line: '#9fb5b3', mode: 'stealth' },
  { id: '02-industrial-exoframe', title: 'Industrial Exoframe', body: '#35424b', plate: '#71818a', light: '#acb6b7', dark: '#17242b', accent: '#f4a24d', second: '#f1d09a', line: '#a9b8bb', mode: 'frame' },
  { id: '03-monolithic-facet', title: 'Monolithic Facet', body: '#252d2b', plate: '#53605b', light: '#88938b', dark: '#0e1715', accent: '#ff795a', second: '#dfc49d', line: '#a6b3a7', mode: 'facet' },
  { id: '04-autonomous-drone-corps', title: 'Autonomous Drone Corps', body: '#6f7b78', plate: '#c7d1c7', light: '#f1f3e8', dark: '#202c30', accent: '#40b9ff', second: '#94e0ff', line: '#e8f1e8', mode: 'drone' },
  { id: '05-aerospace-ground-force', title: 'Aerospace Ground Force', body: '#293239', plate: '#d5d9d4', light: '#faf7ea', dark: '#131c24', accent: '#ff605b', second: '#ffc3ad', line: '#e8ece5', mode: 'aero' },
];
// Runtime SVGs come from the separately versioned Unit-Art proposal. This
// generator preserves their manifest entries but only regenerates legacy art.
const runtimeStyles = [
  ['01-tabletop-miniatures', 'Tabletop-Miniaturen'],
  ['02-technical-illustration', 'Technische Illustration'],
  ['03-industrial-realism', 'Industrieller Realismus'],
  ['04-pixel-strategy', 'Pixel-Strategie'],
  ['05-cel-shaded-comic', 'Cel-Shading / Comic'],
  ['06-military-symbols', 'Militärische Kartensymbole'],
].map(([id, title]) => ({
  id, title, directory: `sets/${id}/`,
  terrainFallback: '01-modular-stealth-geometry',
  logoFallback: 'sets/01-modular-stealth-geometry/logo.svg',
}));

// Every visible vehicle, catalog unit, scenario opponent, and objective has a stable asset key.
const units = [
  { id: 'goblin-siegebreaker', name: 'GOBLIN SIEGEBREAKER', kind: 'platform', weapon: 'twin', size: 1.10 },
  { id: 'skimmer-scout', name: 'SKIMMER SCOUT', kind: 'hover', weapon: 'sensor', size: .72 },
  { id: 'rocket-artillery', name: 'ROCKET ARTILLERY', kind: 'tank', weapon: 'rockets', size: .86 },
  { id: 'infantry-squad', name: 'INFANTRY SQUAD', kind: 'infantry', weapon: 'rifles', size: .62 },
  { id: 'assault-tank', name: 'ASSAULT TANK', kind: 'tank', weapon: 'cannon', size: .91 },
  { id: 'recon-tank', name: 'RECON TANK', kind: 'tank', weapon: 'sensor', size: .72 },
  { id: 'siege-tank', name: 'SIEGE TANK', kind: 'tank', weapon: 'twin', size: 1.00 },
  { id: 'long-range-battery', name: 'LONG-RANGE BATTERY', kind: 'emplacement', weapon: 'longgun', size: .85 },
  { id: 'mobile-siege-gun', name: 'MOBILE SIEGE GUN', kind: 'tank', weapon: 'longgun', size: .94 },
  { id: 'combat-skimmer', name: 'COMBAT SKIMMER', kind: 'hover', weapon: 'cannon', size: .86 },
  { id: 'light-skimmer', name: 'LIGHT SKIMMER', kind: 'hover', weapon: 'sensor', size: .67 },
  { id: 'skimmer-carrier', name: 'SKIMMER CARRIER', kind: 'carrier', weapon: 'lightgun', size: .95 },
  { id: 'strategic-missile-carrier', name: 'STRATEGIC MISSILE CARRIER', kind: 'crawler', weapon: 'missile', size: .97 },
  { id: 'artillery-drone', name: 'ARTILLERY DRONE', kind: 'drone', weapon: 'longgun', size: .69 },
  { id: 'amphibious-infantry', name: 'AMPHIBIOUS INFANTRY', kind: 'infantry', weapon: 'fins', size: .65 },
  { id: 'field-engineers', name: 'FIELD ENGINEERS', kind: 'infantry', weapon: 'tools', size: .66 },
  { id: 'local-defense', name: 'LOCAL DEFENSE', kind: 'infantry', weapon: 'rifles', size: .63 },
  { id: 'command-hub', name: 'COMMAND HUB', kind: 'structure', weapon: 'antenna', size: .94 },
  { id: 'goblin-dreadnaught', name: 'GOBLIN DREADNAUGHT', kind: 'platform', weapon: 'quad', size: 1.15 },
  { id: 'forge-engineer', name: 'FORGE ENGINEER', kind: 'platform', weapon: 'tools', size: 1.04 },
  { id: 'phantom-platform', name: 'PHANTOM PLATFORM', kind: 'platform', weapon: 'sensor', size: .94 },
  { id: 'infantry-platoon', name: 'INFANTRY PLATOON', kind: 'infantry', weapon: 'rifles', size: .75 },
  { id: 'command-core', name: 'COMMAND CORE', kind: 'structure', weapon: 'core', size: .98 },
  { id: 'relay-node', name: 'RELAY NODE', kind: 'structure', weapon: 'antenna', size: .78 },
  { id: 'guard-tank', name: 'GUARD TANK', kind: 'tank', weapon: 'cannon', size: .86 },
  { id: 'raider-skimmer', name: 'RAIDER SKIMMER', kind: 'hover', weapon: 'twin', size: .79 },
];

const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const poly = (points, fill, stroke = 'none', width = 1, more = '') =>
  `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="bevel" ${more}/>`;
const line = (x1, y1, x2, y2, stroke, width = 2, more = '') =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="square" ${more}/>`;
const rect = (x, y, w, h, fill, stroke = 'none', sw = 1, more = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" ${more}/>`;

function outline(unit) {
  if (unit.kind === 'platform') return '128,17 181,26 209,48 223,94 222,175 204,223 175,239 81,239 52,223 34,175 33,94 47,48 75,26';
  if (unit.kind === 'tank') return '128,30 169,36 189,61 199,188 179,221 77,221 57,188 67,61 87,36';
  if (unit.kind === 'hover') return '128,25 172,56 210,118 177,205 128,230 79,205 46,118 84,56';
  if (unit.kind === 'carrier') return '128,30 184,44 205,72 205,192 182,219 74,219 51,192 51,72 72,44';
  if (unit.kind === 'crawler') return '128,26 164,39 186,62 194,195 173,222 83,222 62,195 70,62 92,39';
  if (unit.kind === 'drone') return '128,23 171,61 214,103 185,184 128,229 71,184 42,103 85,61';
  if (unit.kind === 'emplacement') return '128,36 180,55 211,110 190,190 128,224 66,190 45,110 76,55';
  if (unit.kind === 'structure') return '128,24 196,61 220,128 196,195 128,232 60,195 36,128 60,61';
  return '128,31 166,58 177,111 208,153 180,215 128,231 76,215 48,153 79,111 90,58';
}

function mobility(style, unit, sketch) {
  const c = style;
  if (unit.kind === 'hover') {
    return poly('65,70 49,114 69,181 83,188 88,101', c.dark, c.line, sketch ? 3 : 2)
      + poly('191,70 207,114 187,181 173,188 168,101', c.dark, c.line, sketch ? 3 : 2)
      + line(49, 123, 62, 179, c.accent, 3) + line(207, 123, 194, 179, c.accent, 3);
  }
  if (unit.kind === 'infantry') return '';
  if (unit.kind === 'structure' || unit.kind === 'emplacement') {
    return poly('44,177 69,210 94,213 82,189', c.dark, c.line, 2)
      + poly('212,177 187,210 162,213 174,189', c.dark, c.line, 2)
      + poly('106,208 128,228 150,208', c.dark, c.line, 2);
  }
  if (unit.kind === 'drone') {
    return [ [35,63], [174,63], [35,166], [174,166] ].map(([x,y])=>
      poly(`${x},${y+10} ${x+14},${y} ${x+46},${y} ${x+61},${y+10} ${x+48},${y+39} ${x+13},${y+39}`, c.dark, c.line, 2)
    ).join('');
  }
  const left = unit.kind === 'platform' ? 30 : 49;
  const right = 256-left-26;
  return [left,right].map(x =>
    rect(x, 57, 26, 148, c.dark, c.line, sketch ? 3 : 2)
    + rect(x+5, 67, 16, 128, c.body, c.line, 1)
    + [78,102,126,150,174].map(y=>line(x+4,y,x+22,y,c.light,sketch ? 1.6 : 1)).join('')
  ).join('');
}

function hull(style, unit, sketch) {
  const c = style, edge = sketch ? 3.5 : 2.2;
  const body = sketch ? c.body : 'url(#body-grad)';
  const shell = poly(outline(unit), body, c.line, edge);
  if (unit.kind === 'infantry') {
    const people = [[82,96],[128,67],[174,96],[104,157],[152,157]];
    return shell
      + poly('128,45 166,79 168,147 128,204 88,147 90,79', c.dark, c.line, 2)
      + people.map(([x,y],i) => poly(
          `${x},${y-12} ${x+10},${y-5} ${x+13},${y+9} ${x},${y+17} ${x-13},${y+9} ${x-10},${y-5}`,
          i===1 ? c.plate : c.body, c.line, sketch ? 2 : 1.7
        ) + rect(x-4,y-2,8,5,c.accent)).join('');
  }
  if (unit.kind === 'structure') {
    return shell
      + poly('128,40 184,70 201,128 184,186 128,216 72,186 55,128 72,70', c.plate, c.line, edge)
      + poly('128,57 169,81 184,128 169,175 128,199 87,175 72,128 87,81', c.dark, c.line, 2)
      + poly('128,73 163,92 175,128 163,164 128,183 93,164 81,128 93,92', c.body, c.line, 2);
  }
  if (unit.kind === 'drone') {
    return shell
      + poly('128,45 175,88 190,127 166,175 128,211 90,175 66,127 81,88', c.plate, c.line, edge)
      + poly('128,67 159,98 167,133 145,173 128,189 111,173 89,133 97,98', c.dark, c.line, 2);
  }
  let plates = '';
  if (c.mode === 'stealth') {
    plates = poly('128,43 165,58 173,111 153,188 128,210 103,188 83,111 91,58', c.plate, c.line, 2)
      + poly('70,73 86,61 102,83 102,184 72,199 59,163', c.light, c.dark, 2)
      + poly('186,73 170,61 154,83 154,184 184,199 197,163', c.light, c.dark, 2)
      + poly('128,50 152,71 154,154 128,189 102,154 104,71', c.body, c.line, 1.6);
  } else if (c.mode === 'frame') {
    plates = rect(79,56,98,149,c.dark,c.line,2)
      + rect(91,66,74,126,c.plate,c.dark,2)
      + rect(70,62,11,147,c.light,c.dark,1)
      + rect(175,62,11,147,c.light,c.dark,1)
      + [72,129,184].map(y=>rect(73,y,110,8,c.body,c.line,1.5)).join('')
      + rect(103,91,50,75,c.body,c.line,2);
  } else if (c.mode === 'facet') {
    plates = poly('128,41 179,84 166,182 128,220 90,182 77,84', c.plate, c.dark, 2)
      + poly('128,41 158,75 145,179 128,214 111,179 98,75', c.body, c.line, 1.4)
      + poly('73,81 91,60 101,138 82,192 56,167', c.light, c.dark, 2)
      + poly('183,81 165,60 155,138 174,192 200,167', c.light, c.dark, 2);
  } else if (c.mode === 'drone') {
    plates = poly('128,47 177,66 189,133 169,192 128,213 87,192 67,133 79,66', c.plate, c.dark, 2)
      + poly('128,61 161,76 171,130 153,177 128,191 103,177 85,130 95,76', c.light, c.line, 2)
      + rect(64,98,22,60,c.body,c.dark,2) + rect(170,98,22,60,c.body,c.dark,2)
      + rect(98,90,60,70,c.body,c.dark,2);
  } else {
    plates = poly('128,29 176,76 186,121 155,208 128,226 101,208 70,121 80,76', c.plate, c.dark, 2)
      + poly('128,36 153,85 153,187 128,217 103,187 103,85', c.body, c.line, 2)
      + poly('77,79 98,64 103,151 76,196 50,145', c.light, c.dark, 2)
      + poly('179,79 158,64 153,151 180,196 206,145', c.light, c.dark, 2)
      + line(89,97,100,155,c.accent,2) + line(167,97,156,155,c.accent,2);
  }
  return shell + plates;
}

function weaponry(style, unit, sketch) {
  const c = style, w = sketch ? 2.4 : 1.8;
  if (unit.kind === 'infantry') {
    if (unit.weapon === 'tools') return poly('119,121 128,104 137,121 137,145 146,151 128,166 110,151 119,145', c.accent, c.dark, 1.8);
    if (unit.weapon === 'fins') return poly('128,101 149,131 128,163 107,131', c.second, c.dark, 2);
    return line(113,127,143,127,c.accent,3) + line(128,112,128,146,c.accent,3);
  }
  if (unit.kind === 'structure') {
    const core = unit.weapon === 'core'
      ? poly('128,92 159,110 159,146 128,164 97,146 97,110', c.accent, c.dark, 3)
      : poly('128,95 158,113 147,153 109,153 98,113', c.second, c.dark, 3);
    return core + poly('128,103 147,114 141,143 115,143 109,114', c.dark, c.line, 1.4)
      + [0,1,2,3].map(i=>line(72+i*36,73,72+i*36,54,c.line,2)).join('');
  }
  if (unit.weapon === 'tools') {
    return rect(113,83,30,88,c.dark,c.line,2)
      + poly('111,60 118,49 128,73 138,49 145,60 137,95 119,95', c.accent,c.dark,2)
      + line(96,91,83,123,c.second,4) + line(160,91,173,123,c.second,4);
  }
  if (unit.weapon === 'sensor') {
    return poly('128,81 150,100 144,135 128,149 112,135 106,100',c.dark,c.line,2)
      + poly('128,95 141,106 137,128 128,136 119,128 115,106',c.accent,c.dark,1.5)
      + line(88,104,106,88,c.second,2) + line(168,104,150,88,c.second,2);
  }
  if (unit.weapon === 'antenna') {
    return poly('128,72 147,106 128,148 109,106', c.accent,c.dark,2)
      + line(128,70,128,35,c.line,3) + poly('128,29 137,41 128,50 119,41',c.second,c.dark,1.5);
  }
  if (unit.weapon === 'rockets' || unit.weapon === 'missile') {
    const cluster = unit.weapon === 'missile';
    if (cluster) return rect(99,62,58,136,c.dark,c.line,2)
      + poly('128,31 151,65 151,157 128,191 105,157 105,65',c.plate,c.dark,2)
      + poly('128,37 141,69 141,151 128,176 115,151 115,69',c.accent,c.dark,2)
      + line(128,70,128,160,c.second,2);
    return [83,143].map(x=>rect(x,65,30,77,c.dark,c.line,2)
      + [0,1].map(i=>rect(x+4+i*12,72,9,58,c.plate,c.line,1)).join('')
      + rect(x+5,67,20,7,c.accent,c.dark,1)).join('')
      + rect(103,139,50,32,c.plate,c.line,2);
  }
  if (unit.kind === 'carrier') return rect(93,75,70,95,c.dark,c.line,2)
    + rect(102,84,52,76,c.plate,c.line,1.5)
    + [100,116,132,148].map(y=>line(108,y,148,y,c.dark,2)).join('')
    + rect(121,40,14,34,c.accent,c.dark,1.5);
  if (unit.weapon === 'quad' || unit.weapon === 'twin') {
    const xs = unit.weapon === 'quad' ? [77,105,137,165] : [90,154];
    return xs.map(x=>rect(x,40,12,96,c.dark,c.line,w)
      + rect(x+3,28,6,100,c.plate,c.line,1.2)
      + rect(x+1,28,10,8,c.accent,c.dark,1)).join('')
      + poly('128,92 149,109 146,150 128,164 110,150 107,109',c.plate,c.line,2);
  }
  const barrel = unit.weapon === 'longgun' ? 24 : 51;
  return rect(120,barrel,16,96,c.dark,c.line,w)
    + rect(124,barrel+7,8,75,c.light,c.dark,1)
    + rect(119,barrel,18,10,c.accent,c.dark,1.5)
    + poly('128,99 151,113 147,153 128,168 109,153 105,113',c.plate,c.line,2)
    + rect(113,128,30,8,c.second,c.dark,1);
}

function decoration(style, unit, sketch) {
  const c = style;
  let markup = '';
  if (c.mode === 'frame') {
    markup += [70,184].map(x=>[95,158].map(y=>rect(x,y,6,6,c.accent,c.dark,1)).join('')).join('');
    markup += line(89,61,89,195,c.line,sketch?1.7:1.2)
      + line(167,61,167,195,c.line,sketch?1.7:1.2);
  } else if (c.mode === 'facet') {
    markup += line(128,44,128,88,c.light,1.4)
      + line(96,179,128,210,c.light,1.4)
      + line(160,179,128,210,c.light,1.4);
  } else if (c.mode === 'drone') {
    markup += [78,168].map(x=>rect(x,121,10,16,c.accent,c.dark,1)).join('');
    markup += poly('128,174 142,187 128,201 114,187',c.accent,c.dark,1.2);
  } else if (c.mode === 'aero') {
    markup += line(105,66,90,136,c.accent,2.5)
      + line(151,66,166,136,c.accent,2.5);
  } else {
    markup += [70,181].map(x=>rect(x,144,5,24,c.accent,c.dark,1)).join('');
    markup += line(105,184,128,208,c.second,1.6)
      + line(151,184,128,208,c.second,1.6);
  }
  if (sketch) {
    markup += poly(outline(unit),'none',c.light,1.1,'transform="translate(1.4 -1.1)" opacity=".62"');
    markup += [57,61,65].map((y,i)=>line(98+i*7,y,106+i*7,y+8,c.line,.9,'opacity=".45"')).join('');
  } else {
    markup += [0,1,2,3].map(i=>line(103+i*14,175,107+i*14,179,c.line,.8,'opacity=".48"')).join('');
  }
  return markup;
}

function renderVehicle(style, unit, sketch) {
  const c = style;
  const mobilityMarkup = mobility(c,unit,sketch);
  return mobilityMarkup + hull(c,unit,sketch) + weaponry(c,unit,sketch) + decoration(c,unit,sketch);
}

function defs(style) {
  return `<defs>
    <linearGradient id="body-grad" x1="0" y1="0" x2=".82" y2="1">
      <stop offset="0" stop-color="${style.light}"/>
      <stop offset=".31" stop-color="${style.plate}"/>
      <stop offset=".78" stop-color="${style.body}"/>
      <stop offset="1" stop-color="${style.dark}"/>
    </linearGradient>
    <filter id="vehicle-shadow" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="6" dy="13" stdDeviation="9" flood-color="#000" flood-opacity=".32"/>
    </filter>
  </defs>`;
}

function iconSvg(style, unit) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${esc(unit.name)} top view, ${esc(style.title)}">
  <title>${esc(unit.name)} – ${esc(style.title)} – Top view</title>
  <g transform="translate(128 128) scale(${unit.size}) translate(-128 -128)">
    ${renderVehicle(style,unit,true)}
  </g></svg>`;
}

function librarySvg(style, unit) {
  const outlineMarkup = poly(outline(unit),style.dark,style.line,2.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 384" width="512" height="384" role="img" aria-label="${esc(unit.name)} oblique view, ${esc(style.title)}">
  <title>${esc(unit.name)} – ${esc(style.title)} – Three quarter view</title>
  ${defs(style)}
  <g transform="translate(125 47) matrix(1.23 .21 -.39 .83 0 0) translate(128 128) scale(${unit.size}) translate(-128 -128)">
    <g transform="translate(0 30)" opacity=".98">${outlineMarkup}${mobility(style,unit,false)}</g>
    <g transform="translate(0 14)" opacity=".94">${outlineMarkup}</g>
    <g filter="url(#vehicle-shadow)">${renderVehicle(style,unit,false)}</g>
  </g></svg>`;
}

function logoSvg(style) {
  const c = style;
  const wordmark = `<text x="245" y="158" fill="${c.light}" font-family="Arial Black, Impact, Segoe UI, sans-serif" font-size="91" font-weight="900" letter-spacing="7">G.O.B.L.I.N.</text>`;
  const subtitle = `<text x="250" y="208" fill="${c.line}" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="3.4">GROUND OPERATIONS · BATTLEFIELD LOGISTICS · INTELLIGENCE NETWORK</text>`;
  let mark;
  if (c.mode === 'stealth') {
    mark = `<g fill="${c.accent}"><path d="M40 167 82 45h25L65 167z"/><path d="m82 167 35-99h23l-35 99z"/><path d="m123 167 27-77h19l-27 77z"/></g><path d="M43 189h132" stroke="${c.second}" stroke-width="6"/>`;
  } else if (c.mode === 'frame') {
    mark = `<path d="M42 36h134l26 26v140l-26 26H42l-26-26V62z" fill="none" stroke="${c.accent}" stroke-width="11"/><path d="M62 89h89v31h-45v22h43v29H62z" fill="${c.light}"/><path d="M28 62h25M165 62h25M28 201h25M165 201h25" stroke="${c.second}" stroke-width="8"/>`;
  } else if (c.mode === 'facet') {
    mark = `<path d="M106 24 201 80v102l-95 55-94-55V80z" fill="${c.dark}" stroke="${c.line}" stroke-width="6"/><path d="M106 24v112L12 80z" fill="${c.plate}"/><path d="M106 24 201 80l-95 56z" fill="${c.light}"/><path d="M106 136 201 80v102l-95 55z" fill="${c.body}"/><path d="M61 99h87v28H91v29h58v29H61z" fill="${c.accent}"/>`;
  } else if (c.mode === 'drone') {
    mark = `<path d="M106 17 198 71v113l-92 55-92-55V71z" fill="none" stroke="${c.second}" stroke-width="5"/><path d="M106 48 171 85v85l-65 37-65-37V85z" fill="${c.dark}" stroke="${c.line}" stroke-width="4"/><circle cx="106" cy="128" r="44" fill="none" stroke="${c.accent}" stroke-width="9"/><circle cx="106" cy="128" r="15" fill="${c.accent}"/><path d="M106 17v53m0 116v53M14 128h56m72 0h56" stroke="${c.second}" stroke-width="4"/>`;
  } else {
    mark = `<path d="M15 67 111 107 206 67l-40 108-55 63-55-63z" fill="${c.dark}" stroke="${c.line}" stroke-width="6"/><path d="M15 67 111 107l-28 43zM206 67l-95 40 28 43z" fill="${c.light}"/><path d="m83 150 28-43 28 43-28 57z" fill="${c.accent}"/><path d="M15 193h48m96 0h47" stroke="${c.second}" stroke-width="5"/>`;
  }
  const rule = c.mode === 'frame' ? `<path d="M241 228h769" stroke="${c.accent}" stroke-width="5"/>` : `<path d="M241 228h769" stroke="${c.accent}" stroke-width="3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 256" width="1024" height="256" role="img" aria-label="G.O.B.L.I.N. logo, ${esc(c.title)}"><title>G.O.B.L.I.N. – ${esc(c.title)}</title>${mark}${wordmark}${subtitle}${rule}</svg>`;
}

function galleryHtml() {
  const cells = styles.map(style => `<section id="${style.id}"><header><img class="logo" src="sets/${style.id}/logo.svg" alt="${esc(style.title)} logo"><h2>${esc(style.title)}</h2></header><div class="tiles">${units.map(unit => `<article><div class="art"><img class="icon" src="sets/${style.id}/icons/${unit.id}.svg" alt="${esc(unit.name)} top view"><img class="library" src="sets/${style.id}/library/${unit.id}.svg" alt="${esc(unit.name)} oblique view"></div><p>${esc(unit.name)}</p></article>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G.O.B.L.I.N. · Art Sets</title><style>body{margin:0;background:#0a1217;color:#dee9e6;font:14px/1.45 system-ui,sans-serif}main{max-width:1600px;margin:auto;padding:32px}h1{font-size:32px;letter-spacing:.08em}p{color:#95aaa8}section{margin:52px 0;border-top:1px solid #34474c;padding-top:26px}header{display:flex;align-items:center;gap:24px}header h2{font-size:21px;letter-spacing:.08em}.logo{width:340px;max-width:45%}.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:14px;margin-top:22px}article{background:#122028;border:1px solid #294047;padding:12px}article p{margin:4px 0 0;color:#d9e6e2;font-size:11px;letter-spacing:.08em}.art{display:flex;align-items:center;justify-content:center;height:140px;background:radial-gradient(circle,#20333b,#0d1a1f)}.icon{width:78px;height:78px}.library{width:145px;height:110px;object-fit:contain}</style><main><h1>G.O.B.L.I.N. · Interchangeable Art Sets</h1><p>Fünf vollständige Stilsets · je 26 Motive · Draufsicht, Schrägansicht und Logo. Transparente SVGs, identische Dateinamen.</p>${cells}</main></html>`;
}

function comparisonHtml() {
  const picks = ['goblin-siegebreaker','assault-tank','skimmer-scout','strategic-missile-carrier','infantry-squad'];
  const rows = styles.map(style => `<section><header><img src="sets/${style.id}/logo.svg" alt="${esc(style.title)} logo"><h2>${esc(style.title)}</h2></header><div class="examples">${picks.map(id => `<figure><img src="sets/${style.id}/icons/${id}.svg" alt="${id} top"><img src="sets/${style.id}/library/${id}.svg" alt="${id} oblique"><figcaption>${id.replaceAll('-',' ')}</figcaption></figure>`).join('')}</div></section>`).join('');
  return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>G.O.B.L.I.N. · Stilvergleich</title><style>body{margin:0;background:#0a1217;color:#dce8e5;font:13px system-ui,sans-serif}main{max-width:1700px;margin:auto;padding:24px}h1{letter-spacing:.08em}section{display:grid;grid-template-columns:250px 1fr;gap:18px;margin:17px 0;padding:14px;border:1px solid #31464b;background:#111f25}header img{width:230px}h2{font-size:16px;letter-spacing:.06em}.examples{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}figure{margin:0;background:#1a2b32;display:flex;align-items:center;justify-content:center;position:relative;min-height:150px}figure img:first-child{width:68px}figure img:nth-child(2){width:132px}figcaption{position:absolute;bottom:5px;left:8px;color:#adbfbb;text-transform:uppercase;font-size:10px;letter-spacing:.06em}@media(max-width:900px){section{display:block}.examples{grid-template-columns:repeat(2,1fr)}}</style><main><h1>G.O.B.L.I.N. · Fünf Stilrichtungen</h1>${rows}</main></html>`;
}

const manifest = { schemaVersion: 1, viewFormats: { icon: '256×256 SVG · transparent · unit icon', library: '1024×768 SVG · transparent · unit guide view', logo: '1024×256 SVG · transparent' }, styles: runtimeStyles, legacyStyles: styles.map(({id,title}) => ({id,title,directory:`sets/${id}/`})), units: units.map(({id,name,kind,weapon}) => ({id,name,kind,weapon})), pathPattern: {icon:'sets/{style}/icons/{unit}.svg',library:'sets/{style}/library/{unit}.svg',logo:'sets/{style}/logo.svg'} };
for (const style of styles) {
  const base = join(root,'sets',style.id);
  await mkdir(join(base,'icons'),{recursive:true});
  await mkdir(join(base,'library'),{recursive:true});
  for (const unit of units) {
    await writeFile(join(base,'icons',`${unit.id}.svg`),iconSvg(style,unit),'utf8');
    await writeFile(join(base,'library',`${unit.id}.svg`),librarySvg(style,unit),'utf8');
  }
  await writeFile(join(base,'logo.svg'),logoSvg(style),'utf8');
}
await writeFile(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
await writeFile(join(root,'gallery.html'),galleryHtml(),'utf8');
await writeFile(join(root,'comparison.html'),comparisonHtml(),'utf8');
console.log(`Generated ${styles.length} sets, ${units.length} motifs each, ${styles.length * (2*units.length+1)} SVG assets.`);
