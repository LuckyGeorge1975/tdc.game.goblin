// One modal surface for confirmations and warnings; requests are queued.
const GameDialogs = (() => {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-dialog';
  dialog.setAttribute('aria-labelledby', 'game-dialog-title');
  dialog.setAttribute('aria-describedby', 'game-dialog-message');
  dialog.innerHTML = `<small class="dialog-kind"></small><h2 id="game-dialog-title"></h2>
    <p id="game-dialog-message"></p><label class="dialog-preference"><input type="checkbox"> NEVER ASK AGAIN</label>
    <div class="dialog-actions"><button type="button" class="action-button dialog-cancel">CANCEL</button>
    <button type="button" class="action-button primary dialog-accept">CONTINUE</button></div>`;
  document.body.appendChild(dialog);
  const title = dialog.querySelector('h2'), message = dialog.querySelector('p');
  const preference = dialog.querySelector('label'), checkbox = dialog.querySelector('input');
  const cancel = dialog.querySelector('.dialog-cancel'), accept = dialog.querySelector('.dialog-accept');
  const queue = [], idle = [];
  let active = null, previousFocus = null;
  function remembered(key) { try { return key && localStorage.getItem(key) === '1'; } catch { return false; } }
  function showNext() {
    if (active || !queue.length) return;
    active = queue.shift();
    previousFocus = document.activeElement;
    title.textContent = active.title;
    message.textContent = active.message;
    dialog.querySelector('small').textContent = active.kind === 'warning' ? 'WARNING' : 'CONFIRM';
    preference.hidden = !active.rememberKey;
    checkbox.checked = false;
    cancel.hidden = active.kind === 'warning';
    cancel.textContent = active.cancelLabel || 'CANCEL';
    accept.textContent = active.acceptLabel || (active.kind === 'warning' ? 'OK' : 'CONTINUE');
    dialog.showModal();
    (cancel.hidden ? accept : cancel).focus();
  }
  function close(accepted) {
    if (!active) return;
    const request = active;
    if (accepted && checkbox.checked && request.rememberKey) {
      try { localStorage.setItem(request.rememberKey, '1'); } catch { /* Session still works without storage. */ }
    }
    active = null;
    dialog.close();
    if (previousFocus?.isConnected) previousFocus.focus();
    request.resolve(accepted);
    showNext();
    if (!active) idle.splice(0).forEach(resolve => resolve());
  }
  function open(options) {
    if (remembered(options.rememberKey)) return Promise.resolve(true);
    return new Promise(resolve => { queue.push({...options, resolve}); showNext(); });
  }
  cancel.onclick = () => close(false);
  accept.onclick = () => close(true);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(false); });
  document.addEventListener('keydown', event => {
    if (!active) return;
    // Prevent gameplay/guide shortcuts; retain native Tab and button activation.
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(false); }
  }, true);
  return {
    confirm: options => open({...options, kind:'confirm'}),
    warn: options => open({...options, kind:'warning'}),
    isOpen: () => !!active || !!queue.length,
    whenIdle: () => active ? new Promise(resolve => idle.push(resolve)) : Promise.resolve(),
    cancel: id => { if (active?.id === id) close(false); }
  };
})();

function scheduleGameTask(action, delay) {
  const firstUnit = units[0], scheduledTurn = turn;
  return setTimeout(() => { GameDialogs.whenIdle().then(() => {
    if (units[0] === firstUnit && turn === scheduledTurn && !gameOver) action();
  }); }, delay);
}
