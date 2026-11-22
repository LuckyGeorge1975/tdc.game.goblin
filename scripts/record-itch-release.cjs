// Invoked only after the manual publish job succeeds. Never update an existing ref.
const assert = require('node:assert/strict');
module.exports = async function record({github, context, env}) {
  assert.equal(context.eventName, 'workflow_dispatch');
  assert.equal(context.ref, 'refs/heads/main');
  assert.equal(`${context.repo.owner}/${context.repo.repo}`, 'LuckyGeorge1975/tdc.game.goblin');
  assert.equal(env.PUBLISH_RESULT, 'success');
  assert.equal(env.UPLOAD_VERIFIED, 'true');
  assert.match(env.RELEASE_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(env.RELEASE_TAG, `v${env.RELEASE_VERSION}`);
  assert.match(env.PAGES_COMMIT, /^[a-f0-9]{40}$/);
  assert.match(env.PACKAGE_SHA256, /^[a-f0-9]{64}$/);
  assert.match(env.UPLOAD_LOG_SHA256, /^[a-f0-9]{64}$/);
  assert.match(env.PACKAGE_FILENAME, /^goblin-v\d+\.\d+\.\d+-html5-[a-f0-9]{12}\.zip$/);
  assert.equal(env.PACKAGE_FILENAME, `goblin-${env.RELEASE_TAG}-html5-${env.PAGES_COMMIT.slice(0,12)}.zip`);
  const prefix = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/`;
  assert.ok(env.PAGES_RUN.startsWith(prefix));
  assert.match(env.PAGES_RUN.slice(prefix.length), /^\d+$/);
  const receipt = {version:env.RELEASE_VERSION, tag:`itch-v${env.RELEASE_VERSION}`,
    pagesTag:env.RELEASE_TAG, commit:env.PAGES_COMMIT, package:env.PACKAGE_FILENAME,
    packageSha256:env.PACKAGE_SHA256, pagesRun:env.PAGES_RUN,
    uploadRun:`${prefix}${context.runId}/attempts/${context.runAttempt}`,
    uploadLogSha256:env.UPLOAD_LOG_SHA256, channel:'luckygeorge/goblin:html5'};
  const api = github.rest.git, repo = context.repo;
  async function existing() {
    try { return (await api.getRef({...repo,ref:`tags/${receipt.tag}`})).data; }
    catch (error) { if (error.status === 404) return null; throw error; }
  }
  async function verify(ref) {
    let object = ref.object;
    for (let depth=0; object.type==='tag' && depth<8; depth++)
      object = (await api.getTag({...repo,tag_sha:object.sha})).data.object;
    assert.equal(object.type, 'commit', 'itch tag must resolve to a commit');
    assert.equal(object.sha, receipt.commit, 'Existing itch tag belongs to another commit; never retag');
  }
  let ref = await existing();
  if (ref) { await verify(ref); return {...receipt,tagStatus:'already-present'}; }
  const tag = await api.createTag({...repo,tag:receipt.tag,object:receipt.commit,type:'commit',
    message:JSON.stringify(receipt,null,2)});
  try { await api.createRef({...repo,ref:`refs/tags/${receipt.tag}`,sha:tag.data.sha}); }
  catch (error) {
    // Concurrent/retried runs can only accept the same final commit, never overwrite.
    if (error.status !== 422) throw error;
    ref = await existing(); if (!ref) throw error;
    await verify(ref); return {...receipt,tagStatus:'already-present'};
  }
  await verify(await existing());
  return {...receipt,tagStatus:'created'};
};
