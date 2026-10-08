// The browser loads terrain-rules.js as a classic script before module entrypoints.
// Node exposes the same file through CommonJS when running the Core tests.
const TerrainRules = globalThis.TerrainRules ?? (await import('./terrain-rules.js')).default;
if (!TerrainRules?.rules) throw new Error('TERRAIN_RULES_UNAVAILABLE');
export default TerrainRules;
