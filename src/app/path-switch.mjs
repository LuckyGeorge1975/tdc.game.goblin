const paths = Object.freeze({ core: './reference.html', phase: './reference.html?scenario=phase-v2&harness=1', terrain: './reference.html?terrain=study', legacy: '../../index.html' });

export function pathFor(mode) {
  if (!Object.hasOwn(paths, mode)) throw new RangeError(`Unknown local game path: ${mode}`);
  return paths[mode];
}

export function modeFromSearch(search) {
  const mode = new URLSearchParams(search).get('path');
  return Object.hasOwn(paths, mode) ? mode : 'core';
}
