// Pins come from trusted application configuration. A valid artifact cannot
// grant itself profile access or approval by supplying its own manifest.
export function createAiPolicyRegistry(pins, crypto = globalThis.crypto) {
  const trusted = new Map();
  const admitted = new Map();
  const sides = ['player','enemy'];
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  const sha256 = /^[0-9a-f]{64}$/;
  const scopeKey = ({engine,profile,side,slot,feature}) => JSON.stringify([engine,profile,side,slot,feature]);
  const validScope = scope => scope && sides.includes(scope.side) &&
    [scope.engine,scope.profile,scope.slot,scope.feature].every(nonempty);
  for (const pin of pins) {
    if (!nonempty(pin?.id) || !nonempty(pin.label) || typeof pin.sha256 !== 'string' || !sha256.test(pin.sha256) ||
        !nonempty(pin.evaluation) || pin.schemaVersion !== 1 || trusted.has(pin.id) ||
        !Array.isArray(pin.scopes) || !pin.scopes.length || !pin.scopes.every(validScope))
      throw new Error('AI_POLICY_PIN_INVALID');
    trusted.set(pin.id,{...pin,scopes:new Set(pin.scopes.map(scopeKey))});
  }
  async function install(id, bytes, compile) {
    const pin = trusted.get(id);
    if (!pin || !(bytes instanceof Uint8Array)) throw new Error('AI_POLICY_UNPINNED');
    const artifact = Uint8Array.from(bytes);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',artifact));
    const hash = Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('');
    if (hash !== pin.sha256) throw new Error('AI_POLICY_HASH_MISMATCH');
    const select = await compile(artifact);
    if (typeof select !== 'function') throw new Error('AI_POLICY_INVALID');
    if (admitted.has(id)) throw new Error('AI_POLICY_ALREADY_INSTALLED');
    admitted.set(id,{pin,select});
  }
  const covers = (entry,scopes) => !!entry && Array.isArray(scopes) && scopes.length > 0 &&
    scopes.every(scope => validScope(scope) && entry.pin.scopes.has(scopeKey(scope)));
  function choices(scopes) {
    return [...admitted.values()].filter(entry=>covers(entry,scopes))
      .map(({pin})=>Object.freeze({id:pin.id,label:pin.label}));
  }
  function bind(id,scopes) {
    const entry = admitted.get(id);
    if (!covers(entry,scopes)) return null;
    const permitted = new Set(scopes.map(scopeKey));
    return Object.freeze({
      select(context,decision) {
        const scope = {...context,side:decision.side,slot:decision.slot};
        if (decision.schemaVersion !== entry.pin.schemaVersion || !permitted.has(scopeKey(scope)))
          throw new Error('AI_POLICY_SCOPE_MISMATCH');
        return entry.select(decision);
      }
    });
  }
  return Object.freeze({install,choices,bind});
}
