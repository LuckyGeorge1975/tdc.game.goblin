import fs from 'node:fs';

const ui = fs.readFileSync(new URL('../../ui-v2.js', import.meta.url), 'utf8');
export const targetOptionsSource = [
  ui.slice(ui.indexOf('    const COMMAND_ICONS'), ui.indexOf('    function inspectTrainingTarget(')),
  ui.slice(ui.indexOf('    function coreCommands('), ui.indexOf('    const phaseNotice ='))
].join('\n');
