import {IRON_DUST_LEVEL_V3} from './iron-dust.v3.mjs';
import {IRON_DUST_START_ROSTER} from '../core/iron-dust-start-roster.mjs';
import {effectiveIronDustDifficulty} from '../core/iron-dust-enemy-policy.mjs';

// Versioned historical Legacy snapshot retained by the executable profile.
// The Siegebreaker systems are data dependencies, not a claim of Core support.
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};

freeze(IRON_DUST_LEVEL_V3);
const {minimumDifficulty: configuredMinimum, ...fixedLayout} = IRON_DUST_LEVEL_V3;
export const IRON_DUST_HISTORICAL_LAYOUT = freeze(fixedLayout);

// Preserve the historical source snapshot consumed by Core and its replay digests.
export const IRON_DUST_LEVEL_V1 = freeze({
  schemaVersion:1,id:'iron-dust',scenarioVersion:1,ruleProfileId:'FIELD_TEST_LEGACY_v1',
  objectiveVersion:1,objective:IRON_DUST_LEVEL_V3.objective,width:IRON_DUST_LEVEL_V3.width,height:IRON_DUST_LEVEL_V3.height,
  defaultTerrain:'open-ground',terrain:IRON_DUST_LEVEL_V3.terrain.map(({x,y})=>x+','+y),
  units:IRON_DUST_LEVEL_V3.units.map(({id,assetId,team,x,y})=>{
    const {name,type,...stats}=IRON_DUST_START_ROSTER[assetId];
    return {id,name,type,team,x,y,...stats};
  })
});

const same = (actual, expected) => {
  if (expected === null || typeof expected !== 'object') return actual === expected;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual) !== Array.isArray(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length &&
    keys.every(key => Object.hasOwn(actual, key) && same(actual[key], expected[key]));
};

export function validateIronDustLevelV1(value) {
  if (value?.schemaVersion !== 1 || value?.scenarioVersion !== 1 || value?.objectiveVersion !== 1)
    throw new Error('UNSUPPORTED_LEVEL_VERSION');
  if (value.id !== 'iron-dust' || value.ruleProfileId !== 'FIELD_TEST_LEGACY_v1' || value.objective !== 'core')
    throw new Error('UNSUPPORTED_LEVEL_PROFILE');
  if (!same(value, IRON_DUST_LEVEL_V1)) throw new Error('LEVEL_DATA_MISMATCH');
  return IRON_DUST_LEVEL_V1;
}

export function validateIronDustLevelV3(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('LEVEL_DATA_MISMATCH');
  const {minimumDifficulty,...layout} = value;
  if (!same(layout,IRON_DUST_HISTORICAL_LAYOUT)) throw new Error('LEVEL_DATA_MISMATCH');
  if (Object.hasOwn(value,'minimumDifficulty') && minimumDifficulty === undefined) throw new Error('IRON_DUST_DIFFICULTY_INVALID');
  effectiveIronDustDifficulty('medium',minimumDifficulty);
  return freeze({...IRON_DUST_HISTORICAL_LAYOUT,...(minimumDifficulty === undefined ? {} : {minimumDifficulty})});
}
