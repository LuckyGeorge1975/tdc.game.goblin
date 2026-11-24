import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, open, readFile, realpath} from 'node:fs/promises';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function canonicalJson(value) {
  if (value===null || typeof value==='boolean' || typeof value==='string') return JSON.stringify(value);
  if (typeof value==='number') {
    assert.ok(Number.isFinite(value), 'SEAL_NONFINITE_NUMBER');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    assert.equal(Object.keys(value).length, value.length, 'SEAL_SPARSE_OR_EXTENDED_ARRAY');
    return '['+Array.from({length:value.length}, (_, i) => canonicalJson(value[i])).join(',')+']';
  }
  assert.ok(value && Object.getPrototypeOf(value)===Object.prototype, 'SEAL_NON_JSON_VALUE');
  return '{'+Object.keys(value).sort().map(key => JSON.stringify(key)+':'+canonicalJson(value[key])).join(',')+'}';
}

export const jsonBytes = value => Buffer.from(canonicalJson(value)+'\n', 'utf8');
// Native DTOs can cross the VM boundary. Use their JSON representation, as in the
// observation trace, and exclude the process-local ticket only.
export const semanticCandidate = ({key, ...candidate}) => JSON.parse(JSON.stringify(candidate));
export const candidateFingerprint = candidate => sha256(jsonBytes(semanticCandidate(candidate)));

function resolveChild(root, name) {
  assert.ok(typeof name==='string' && name.length>0 && !isAbsolute(name) &&
    !name.includes('\\') && !name.split('/').some(part => part==='' || part==='.' || part==='..') &&
    !name.includes(':'), 'SEAL_PATH_INVALID');
  const path = resolve(root, name);
  const rel = relative(resolve(root), path);
  assert.ok(rel && rel!=='..' && !rel.startsWith('..'+sep) && !isAbsolute(rel), 'SEAL_PATH_ESCAPE');
  return path;
}

async function confinedRealpath(root, path) {
  const absoluteRoot = await realpath(root), absolute = await realpath(path);
  const rel = relative(absoluteRoot, absolute);
  assert.ok(!isAbsolute(rel) && rel!=='..' && !rel.startsWith('..'+sep), 'SEAL_SYMLINK_ESCAPE');
  return absolute;
}

export async function readArtifact(root, path, expectedHash, {text=false}={}) {
  assert.match(expectedHash, /^[a-f0-9]{64}$/);
  const absolute = await confinedRealpath(root, resolveChild(root, path));
  const bytes = await readFile(absolute);
  const hashed = text ? Buffer.from(new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes).replace(/\r\n?/g,'\n')) : bytes;
  assert.equal(sha256(hashed), expectedHash, 'SEAL_ARTIFACT_HASH_MISMATCH');
  return bytes;
}

export async function writeOnce(root, path, bytes) {
  assert.ok(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, 'SEAL_BYTES_REQUIRED');
  const destination = resolveChild(root, path);
  // Every parent must already exist inside the trusted root; no untrusted mkdir traversal.
  await confinedRealpath(root, dirname(destination));
  const file = await open(destination, 'wx');
  try {await file.writeFile(bytes); await file.sync();}
  finally {await file.close();}
  return {path, sha256:sha256(bytes), bytes:bytes.byteLength};
}

export async function createArtifactDirectory(root, name) {
  const destination = resolveChild(root, name);
  await confinedRealpath(root, dirname(destination));
  await mkdir(destination); // Existing identities cannot be silently reused.
  return destination;
}

export async function inventory(root, files) {
  assert.equal(new Set(files).size, files.length, 'SEAL_DUPLICATE_SOURCE');
  return Promise.all([...files].sort().map(async path => {
    const absolute = await confinedRealpath(root, resolveChild(root, path));
    const bytes = await readFile(absolute);
    const text = new TextDecoder('utf-8', {fatal:true, ignoreBOM:true}).decode(bytes).replace(/\r\n?/g,'\n');
    return {path, sha256:sha256(Buffer.from(text, 'utf8'))};
  }));
}
