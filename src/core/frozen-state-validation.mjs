// A frozen container with mutable children or an accessor can still change
// what a validator observes. Only immutable data graphs may skip repeat work.
export function isDeepFrozenData(value,seen=new WeakSet()) {
  if(typeof value==='function') return false;
  if(!value||typeof value!=='object') return true;
  if(seen.has(value)) return true;
  if(!Object.isFrozen(value)) return false;
  seen.add(value);
  return Reflect.ownKeys(value).every(key=>{
    const property=Object.getOwnPropertyDescriptor(value,key);
    return Object.hasOwn(property,'value')&&isDeepFrozenData(property.value,seen);
  });
}
