const difficulties = Object.freeze(['weak','medium','strong']);
const validId = id => typeof id==='string' && /^[a-z][a-z0-9-]*$/.test(id);
const validPolicyId = id => validId(id) || typeof id==='string'&&/^full-experiment:[a-f0-9]{64}$/.test(id);
const reject = code => {throw Object.assign(Error(code),{code});};

function meetsMinimum(difficulty,minimum) {
  return minimum===null || difficulty===null || difficulties.indexOf(difficulty)>=difficulties.indexOf(minimum);
}

// The level supplies the available seats. The profile supplies the native
// controllers it can actually run for each seat.
export function createGameManager({maxSeats,seatIds,aiAllowed=true,minimumDifficulty=null},capabilities) {
  if (!Number.isInteger(maxSeats) || maxSeats<1 || maxSeats>2 || !Array.isArray(seatIds) ||
      seatIds.length<1 || seatIds.length>maxSeats || !seatIds.every(validId) ||
      new Set(seatIds).size!==seatIds.length) reject('GAME_SEAT_LAYOUT_INVALID');
  if (typeof aiAllowed!=='boolean' || minimumDifficulty!==null && !difficulties.includes(minimumDifficulty))
    reject('GAME_AI_RULES_INVALID');
  if (!capabilities || typeof capabilities!=='object' || Array.isArray(capabilities))
    reject('GAME_SEAT_CAPABILITY_INVALID');

  const qualified = new Map();
  const seats = Object.freeze(Array.from(seatIds,id => {
    const capability = Object.hasOwn(capabilities,id)?capabilities[id]:null;
    if (typeof capability?.human!=='boolean' || !Array.isArray(capability.ai)) reject('GAME_SEAT_CAPABILITY_INVALID');
    const policies = new Map();
    for (const policy of capability.ai) {
      if (!validPolicyId(policy?.id) || policies.has(policy.id) ||
          policy.difficulty!==null && !difficulties.includes(policy.difficulty)) reject('GAME_SEAT_CAPABILITY_INVALID');
      policies.set(policy.id,Object.freeze({id:policy.id,difficulty:policy.difficulty}));
    }
    qualified.set(id,policies);
    const ai = Object.freeze(aiAllowed?[...policies.values()].filter(policy=>meetsMinimum(policy.difficulty,minimumDifficulty)):[]);
    return Object.freeze({id,humanAvailable:capability.human,ai,
      aiUnavailable:ai.length?null:!aiAllowed?'AI_LEVEL_FORBIDDEN':
        minimumDifficulty===null?'AI_SEAT_NOT_QUALIFIED':'AI_MINIMUM_UNAVAILABLE'});
  }));
  const ids = new Set(seatIds);

  function assign(selection) {
    if (!selection || typeof selection!=='object' || Array.isArray(selection) ||
        Object.keys(selection).length!==seats.length || Object.keys(selection).some(id=>!ids.has(id)))
      reject('GAME_SEAT_SELECTION_INVALID');
    return Object.freeze(seats.map(seat => {
      const id = selection[seat.id];
      if (id===null) {
        if (!seat.humanAvailable) reject('HUMAN_SEAT_UNAVAILABLE');
        return Object.freeze({seatId:seat.id,controller:'human'});
      }
      if (!aiAllowed) reject('AI_LEVEL_FORBIDDEN');
      const policy = qualified.get(seat.id).get(id);
      if (!policy) reject('AI_SEAT_NOT_QUALIFIED');
      if (!meetsMinimum(policy.difficulty,minimumDifficulty)) reject('AI_BELOW_MINIMUM');
      return Object.freeze({seatId:seat.id,controller:'ai',policyId:policy.id,difficulty:policy.difficulty});
    }));
  }

  return Object.freeze({maxSeats,seats,aiAllowed,minimumDifficulty,assign});
}

// The result is a reference in the native offer. The caller owns freshness,
// acceptance and application of the command.
export function createPlayerController(seatId,choose) {
  if (!validId(seatId) || typeof choose!=='function') reject('GAME_CONTROLLER_INVALID');
  return Object.freeze({seatId,nextCommand(decision,report) {
    if (decision?.side!==seatId || decision.view?.side!==seatId) return undefined;
    return choose(decision,report);
  }});
}
