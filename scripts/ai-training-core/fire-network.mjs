import assert from 'node:assert/strict';

export const featureVersion = 'goblin-full-fire-effects-v1';
export const rewardVersion = 'goblin-native-mission-points-pair-v1';
export const configuration = Object.freeze({inputs:19, hidden:8, outputs:1,
  activation:'tanh', outputActivation:'linear', initializationSeed:231371,
  epochs:160, learningRate:0.01, featureScaling:'native-full-fire-effects-v1'});

const vector = (value, length) => Array.isArray(value) && value.length === length &&
  Array.from({length}, (_, index) => value[index]).every(Number.isFinite);

export function validateInput(input) {
  assert.ok(vector(input, configuration.inputs), 'FULL_BPN_INPUT_INVALID');
}

export function validateWeights(model) {
  assert.ok(Array.isArray(model?.hidden) && model.hidden.length === configuration.hidden &&
    Array.from({length:configuration.hidden}, (_, i) => model.hidden[i]).every(node =>
      vector(node?.weights, configuration.inputs) && Number.isFinite(node.bias)) &&
    vector(model.output?.weights, configuration.hidden) && Number.isFinite(model.output.bias),
  'FULL_BPN_WEIGHTS_INVALID');
}

export function initialWeights(seed=configuration.initializationSeed) {
  assert.ok(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'FULL_BPN_INITIALIZATION_SEED');
  let state = seed;
  const weights = length => Array.from({length}, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2**32 - 0.5;
  });
  return {hidden:Array.from({length:configuration.hidden}, () => ({weights:weights(configuration.inputs), bias:0})),
    output:{weights:weights(configuration.hidden), bias:0}};
}

function forward(model, input) {
  validateInput(input);
  const hidden = model.hidden.map(node => {
    const value = node.weights.reduce((sum, weight, index) => sum + weight * input[index], node.bias);
    assert.ok(Number.isFinite(value), 'FULL_BPN_ACTIVATION_NONFINITE');
    return Math.tanh(value);
  });
  const score = hidden.reduce((sum, value, index) => sum + model.output.weights[index] * value, model.output.bias);
  assert.ok(Number.isFinite(score), 'FULL_BPN_SCORE_NONFINITE');
  return {hidden, score};
}

export function createScorer(model) {
  validateWeights(model);
  // The caller cannot silently change the frozen policy through its source object.
  const snapshot = structuredClone({hidden:model.hidden, output:model.output});
  return input => forward(snapshot, input).score;
}

function validPair(row) {
  validateInput(row?.reference);
  validateInput(row?.alternative);
  assert.ok([-1,-0.5,0,0.5,1].includes(row.delta), 'FULL_BPN_LABEL_INVALID');
}

export function pairGradients(model, row) {
  validateWeights(model);
  validPair(row);
  const a = forward(model, row.alternative), r = forward(model, row.reference);
  const difference = a.score - r.score;
  const error = difference - row.delta;
  assert.ok(Number.isFinite(error), 'FULL_BPN_ERROR_NONFINITE');
  const gradients = {hidden:model.hidden.map((node, i) => {
    const da = error * model.output.weights[i] * (1 - a.hidden[i]**2);
    const dr = error * model.output.weights[i] * (1 - r.hidden[i]**2);
    return {weights:node.weights.map((_, j) => da*row.alternative[j] - dr*row.reference[j]), bias:da-dr};
  }), output:{weights:a.hidden.map((value, i) => error*(value-r.hidden[i])), bias:0}};
  validateWeights(gradients);
  const loss = 0.5 * error**2;
  assert.ok(Number.isFinite(loss), 'FULL_BPN_LOSS_NONFINITE');
  return {loss, difference, error, gradients};
}

export function meanPairLoss(model, rows) {
  assert.ok(Array.isArray(rows) && rows.length > 0, 'FULL_BPN_DATASET_EMPTY');
  return rows.reduce((total, row) => total + pairGradients(model, row).loss, 0) / rows.length;
}

export function fitPairs(rows) {
  assert.ok(Array.isArray(rows) && rows.length > 0, 'FULL_BPN_DATASET_EMPTY');
  rows.forEach(validPair);
  const model = initialWeights();
  const before = meanPairLoss(model, rows);
  for (let epoch = 0; epoch < configuration.epochs; epoch++) {
    for (const row of rows) {
      // All derivatives are computed with the old common model before any update.
      const {gradients} = pairGradients(model, row);
      for (let i=0; i<configuration.hidden; i++) {
        model.hidden[i].weights = model.hidden[i].weights.map((weight, j) =>
          weight - configuration.learningRate * gradients.hidden[i].weights[j]);
        model.hidden[i].bias -= configuration.learningRate * gradients.hidden[i].bias;
        model.output.weights[i] -= configuration.learningRate * gradients.output.weights[i];
      }
      validateWeights(model);
    }
  }
  const after = meanPairLoss(model, rows);
  return {model, statistics:{before, after, pairs:rows.length, updates:rows.length*configuration.epochs,
    labels:Object.fromEntries([-1,-0.5,0,0.5,1].map(delta => [delta, rows.filter(row => row.delta===delta).length]))}};
}

export function nativeOutcomeValue(completion, outcome, side) {
  assert.ok(['player','enemy'].includes(side), 'FULL_BPN_SIDE_INVALID');
  assert.ok(['native','technical-limit','error'].includes(completion), 'FULL_BPN_COMPLETION_INVALID');
  if (completion !== 'native') {
    assert.equal(outcome, null, 'FULL_BPN_CENSORED_OUTCOME_INVALID');
    return null;
  }
  assert.ok(['player-win','enemy-win','draw'].includes(outcome), 'FULL_BPN_NATIVE_OUTCOME_INVALID');
  return outcome==='draw' ? 0.5 : outcome===side+'-win' ? 1 : 0;
}

export function nativePairLabel(reference, alternative, side) {
  const r = nativeOutcomeValue(reference.completion, reference.outcome, side);
  const a = nativeOutcomeValue(alternative.completion, alternative.outcome, side);
  return r===null || a===null ? null : a-r;
}
