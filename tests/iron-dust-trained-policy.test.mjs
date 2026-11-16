import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createIronDustAiAdapter} from '../src/core/iron-dust-ai-adapter.mjs?v=5';
import {createIronDustProfile, dispatchIronDustProfile, projectIronDustProfile,
  queryIronDustProfile} from '../src/core/iron-dust-executable-profile.mjs?v=3';
import {choosePlayerAction} from '../src/core/iron-dust-objective-policy.mjs?v=1';
import {IRON_DUST_TRAINED_SCOPE, prepareIronDustTrainedPolicy} from '../src/core/iron-dust-trained-policy.mjs?v=1';
import {hexDistance} from '../src/core/hex.mjs';
import {createPlayerController} from '../src/core/game-manager.mjs';

const {base64} = JSON.parse(readFileSync(new URL('../assets/ai/iron-dust-target-bpn.json', import.meta.url)));
const bytes = Buffer.from(base64, 'base64');

test('the packaged Iron Dust model requires the pinned bytes', async () => {
  const changed = Buffer.from(bytes);
  changed[0] ^= 1;
  await assert.rejects(prepareIronDustTrainedPolicy(changed));
  assert.ok(await prepareIronDustTrainedPolicy(bytes));
});

test('the qualified holdout changes only the target at the first divergent native commit', async () => {
  const policy = await prepareIronDustTrainedPolicy(bytes);
  let profile = createIronDustProfile(390729996, {difficulty:'strong'});
  const adapter = createIronDustAiAdapter(() => ({state:profile,generation:1}));
  for (let step = 1; step <= 21; step++) {
    const {state,mode} = projectIronDustProfile(profile);
    const baseline = mode === 'enemy' ? {type:'AutoEnemyAdvance',playerId:'enemy'} :
      choosePlayerAction({state,hexDistance,query:command=>queryIronDustProfile(profile,command),
        queryWithWeapon(command,fire) {
          const next = dispatchIronDustProfile(profile,command);
          return next.profile ? queryIronDustProfile(next.profile,fire) : {available:false,error:next.error};
        }}).command;
    const ordinary = dispatchIronDustProfile(profile,baseline);
    assert.ok(ordinary.profile);
    if (baseline.type === 'PlayerFire') {
      const batch = adapter.open('player',{actorId:baseline.unitId,weaponRef:baseline.weaponKey??null});
      assert.equal(batch.ok,true);
      assert.throws(() => policy.select({...IRON_DUST_TRAINED_SCOPE,profile:'FULL_CATALOG_v1'}, {...batch,baseline}),
        /AI_POLICY_SCOPE_MISMATCH/);
      const controller=createPlayerController('player',(decision,report)=>
        policy.select(IRON_DUST_TRAINED_SCOPE,{...decision,baseline},report));
      assert.equal(controller.nextCommand({...batch,side:'enemy'}),undefined);
      const key=controller.nextCommand(batch);
      const {actorId,weaponRef,target} = batch.candidates.find(candidate=>candidate.key===key);
      assert.equal(actorId,baseline.unitId);
      assert.equal(weaponRef,baseline.weaponKey??null);
      assert.equal(target.unitId,step===21?'raider':baseline.targetId);
      if (step === 21) {
        assert.deepEqual([baseline.unitId,baseline.weaponKey,baseline.targetId],['ogre','missiles','guard']);
        const trained=adapter.execute({schemaVersion:batch.schemaVersion,
          decisionId:batch.decisionId,revision:batch.revision,key});
        assert.equal(trained.ok,true);
        assert.deepEqual(trained.action,{...baseline,targetId:target.unitId});
        assert.ok(trained.events.some(event=>event.type==='PlayerFireResolved'));
        assert.equal(projectIronDustProfile(trained.profile).state.rng.state,
          projectIronDustProfile(ordinary.profile).state.rng.state);
      }
    } else assert.notEqual(step,21);
    profile = ordinary.profile;
  }
});
