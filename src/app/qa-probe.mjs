// Read-only browser probe for the internal modular shell. It is installed only
// when shell.html is opened with ?qa=1; regular play has no global test API.
export function createQaProbe() {
  let app = null;
  let unsubscribe = null;
  let commands = [];

  return Object.freeze({
    attach(nextApp) {
      unsubscribe?.();
      app = nextApp;
      commands = [];
      unsubscribe = app?.subscribeCommand(({ command, result }) => {
        commands.push(structuredClone({
          command,
          accepted: !result.error,
          error: result.error ?? null,
          events: result.events ?? [],
        }));
      }) ?? null;
    },
    snapshot() {
      if (!app) return null;
      const { state, view, areas, error } = app.snapshot();
      return structuredClone({ state, view, areas, error, actions: app.actions(), commands });
    },
  });
}
