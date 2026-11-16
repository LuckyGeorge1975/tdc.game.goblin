import {dispatchIronDustProfile} from '../../src/core/iron-dust-executable-profile.mjs';
import {createIronDustCommitRecorder} from '../../src/core/iron-dust-profile-replay.mjs';

export function recordIronDustCommands(initialProfile, commands) {
  const recorder = createIronDustCommitRecorder(initialProfile);
  let profile = initialProfile;
  for (const action of commands) {
    const result = dispatchIronDustProfile(profile, action);
    if (!result.profile) throw Object.assign(new Error(result.error.code), result.error);
    recorder.accept(profile, {action, ...result});
    profile = result.profile;
  }
  return recorder.snapshot();
}
