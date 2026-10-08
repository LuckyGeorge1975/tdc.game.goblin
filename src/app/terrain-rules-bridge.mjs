// Browser-only compatibility for the existing UMD terrain table.
// The query suffix bypasses the import-map alias without copying rules.
import '../legacy/scripts/terrain-rules.js?browser-bridge';
export default globalThis.TerrainRules;
