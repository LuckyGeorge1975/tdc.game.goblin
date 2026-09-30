import { modeFromSearch, pathFor } from './path-switch.mjs';

const select = document.getElementById('path-select');
const frame = document.getElementById('game-frame');

function show(mode, updateUrl = false) {
  select.value = mode;
  const destination = new URL(pathFor(mode), location.href);
  destination.searchParams.set('lang', globalThis.GoblinLanguage.current);
  frame.src = destination.href;
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('path', mode);
    history.replaceState(null, '', url);
  }
}

show(modeFromSearch(location.search));
select.addEventListener('change', () => show(select.value, true));
addEventListener('goblin-language-change', () => {
  const language = globalThis.GoblinLanguage.current;
  const childLanguage = frame.contentWindow?.GoblinLanguage;
  if (childLanguage) childLanguage.choose(language);
  else {
    const destination = new URL(frame.src);
    destination.searchParams.set('lang', language);
    frame.src = destination.href;
  }
});
