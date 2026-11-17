export const TRAINING_ARCHIVE_VERSION='goblin-training-archive-v1';
const profile='CORE_IRON_DUST_v2';
const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).length===keys.length && keys.every(key=>Object.hasOwn(value,key));
const invalid=()=>{throw Object.assign(Error('TRAINING_ARCHIVE_INVALID'),{code:'TRAINING_ARCHIVE_INVALID'});};

export function createIronDustTrainingArchive(replay,{attacker,defender,outcome}) {
  return {version:TRAINING_ARCHIVE_VERSION,profile,seats:{
    player:attacker==='human'?{controller:'human'}:{controller:'ai',policy:attacker},
    enemy:defender==='human'?{controller:'human'}:{controller:'ai',policy:defender}
  },outcome,replay};
}

function validSeat(seat,policies) {
  return exact(seat,['controller'])&&seat.controller==='human' ||
    exact(seat,['controller','policy'])&&seat.controller==='ai'&&policies.includes(seat.policy);
}

function sameCommand(recorded, option) {
  const inclusive = {...option,...recorded};
  return Object.keys(inclusive).every(key=>{
    if(key==='weaponKey'&&recorded.type==='PlayerFire'&&!Object.hasOwn(recorded,key))return true;
    const a=recorded[key],b=option[key];
    return key==='to'?a?.x===b?.x&&a?.y===b?.y:a===b;
  });
}

export async function importIronDustTrainingArchive(archive) {
  if (!exact(archive,['version','profile','seats','outcome','replay']) ||
      archive.version!==TRAINING_ARCHIVE_VERSION || archive.profile!==profile ||
      !exact(archive.seats,['player','enemy']) ||
      !validSeat(archive.seats.player,['weak','trained']) ||
      !validSeat(archive.seats.enemy,['weak','medium','strong']) ||
      ![archive.seats.player,archive.seats.enemy].some(seat=>seat.controller==='human')) invalid();
  if(archive.seats.enemy.controller==='ai'&&
     (archive.replay?.header?.profileHeader?.enemyPolicy?.difficulty??'medium')!==archive.seats.enemy.policy) invalid();

  const {dispatchIronDustCommittedCommand,playIronDustProfileReplay}=
    await import('./src/core/iron-dust-profile-replay.mjs?v=4');
  const {describeIronDustDemonstration}=await import('./src/core/iron-dust-ai-adapter.mjs?v=8');
  const replay=playIronDustProfileReplay(archive.replay);
  if(replay.finalState.mode!=='ended'||!['player','enemy'].includes(archive.outcome)||
     replay.finalState.state.victory.winner!==archive.outcome) invalid();

  const demonstrations=[];
  let before=archive.replay.initialSnapshot;
  for (const {command,commandIndex,events} of replay.steps) {
    const side=command.playerId;
    if(archive.seats[side]?.controller==='human') {
      const decision=describeIronDustDemonstration(before,side);
      const index=decision.options?.findIndex(({command:option})=>sameCommand(command,option));
      if(!decision.ok||index<0||index===undefined) invalid();
      if(command.type==='AutoEnemyAdvance') {
        if(side!=='enemy'||decision.options.length!==1||!decision.options[index].candidate.facts.automatic) invalid();
      } else {
        if(decision.options[index].candidate.facts.automatic) invalid();
        const candidates=decision.options.map(({candidate})=>{
          const {baseline,automatic,...facts}=candidate.facts;
          return {...candidate,facts};
        });
        demonstrations.push({kind:'human-demonstration',commandIndex,side,slot:decision.slot,
          view:decision.view,command,selected:index,candidates,events});
      }
    }
    before=dispatchIronDustCommittedCommand(before,command).profile;
    if(!before)invalid();
  }
  return {profile,outcome:archive.outcome,seed:archive.replay.initialSeed,
    acceptedCommands:replay.steps.length,demonstrations};
}
