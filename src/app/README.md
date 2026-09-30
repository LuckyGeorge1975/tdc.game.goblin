# Internal modular shell

From the project root, run `node tests/app-local-server.mjs` and open
`http://127.0.0.1:4174/src/app/shell.html`. The reference and comparison pages
remain separate entry points.

For independent UI checks, open `shell.html?qa=1`. This installs the read-only
`globalThis.__GOBLIN_QA__` probe. `snapshot()` returns copies of the current
Core state, UI view state, legal areas and actions, current error, and the
session's confirmed Core command trace. Calling it does not dispatch a command.
The trace resets when a mission starts or is left. The probe is absent on the
ordinary URL. It is intended for local development and QA, not game features.
