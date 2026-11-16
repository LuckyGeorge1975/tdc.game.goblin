import {createIronDustAiAdapter} from './iron-dust-ai-adapter.mjs?v=6';

const reject = code => ({ok:false,code});
const mechanicalKinds = new Set(['skip','pass','end-phase']);
const holdsDefense = ({session,defenderIsHuman}) =>
  defenderIsHuman === true && session?.projection.mode === 'enemy';
const authorized = (context,seat) => holdsDefense(context) &&
  !!seat && context.defenderSeat === seat;

// The owner supplies the current browser session and the opaque handoff permit.
// A pending or paused human handoff must supply a null defenderSeat.
export function createIronDustHumanDefensePort({read, install}) {
  const adapter = createIronDustAiAdapter(() => {
    const {session,epoch} = read();
    return {state:session?.profile,generation:epoch};
  }, {explicitEnemyMovement:true});
  let active = null;

  function invalidate() {
    active = null;
    adapter.invalidate();
  }

  function open(seat) {
    const current = read();
    if (!authorized(current,seat)) return reject('IRON_DUST_DEFENDER_NOT_AUTHORIZED');
    if (active?.seat === seat && active.session === current.session && active.epoch === current.epoch)
      return active.offer;
    invalidate();
    const decision = adapter.open('enemy');
    if (!decision.ok) return decision;
    const [first] = decision.candidates;
    const mechanical = decision.candidates.length === 1 && first.facts.automatic === true &&
      mechanicalKinds.has(first.kind);
    if (!decision.candidates.length || (!mechanical && decision.candidates.some(item => item.facts.automatic))) {
      invalidate();
      return reject('IRON_DUST_DEFENDER_OFFER_INVALID');
    }
    const candidates = mechanical ? [] : decision.candidates.map(candidate => {
      const {baseline, ...facts} = candidate.facts;
      return Object.freeze({...candidate,facts:Object.freeze(facts)});
    });
    const offer = Object.freeze({ok:true,kind:mechanical?'mechanical':'choice',
      ticket:Object.freeze({}),side:decision.side,slot:decision.slot,view:decision.view,
      candidates:Object.freeze(candidates)});
    active = {seat,session:current.session,epoch:current.epoch,offer,decision,
      mechanicalKey:mechanical?first.key:null};
    return offer;
  }

  function execute(seat,ticket,key,kind) {
    const current = read();
    if (!authorized(current,seat)) return reject('IRON_DUST_DEFENDER_NOT_AUTHORIZED');
    if (!active || active.seat !== seat || active.session !== current.session ||
        active.epoch !== current.epoch || active.offer.ticket !== ticket)
      return reject('IRON_DUST_DEFENDER_STALE');
    if (active.offer.kind !== kind) return reject('IRON_DUST_DEFENDER_WRONG_STEP');
    const {decision,mechanicalKey,offer} = active;
    if (kind === 'choice' && !offer.candidates.some(candidate=>candidate.key===key))
      return reject('AI_UNKNOWN_CANDIDATE');
    active = null;
    const result = adapter.execute({schemaVersion:decision.schemaVersion,
      decisionId:decision.decisionId,revision:decision.revision,key:mechanicalKey??key});
    if (!result.ok) return result;
    // The browser owner commits presentation, round history and replay here.
    install(current.session,result);
    return {ok:true};
  }

  return Object.freeze({open,invalidate,
    commit: (seat,ticket,key) => execute(seat,ticket,key,'choice'),
    advanceMechanical: (seat,ticket) => execute(seat,ticket,undefined,'mechanical'),
    get suppressesAutomaticDefense() {return holdsDefense(read());}
  });
}
