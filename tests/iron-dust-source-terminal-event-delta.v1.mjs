// Opt-in delta to the unchanged 21-command source victory oracle.
export const IRON_DUST_SOURCE_TERMINAL_EVENT_DELTA_V1 = Object.freeze({
  deltaVersion: 'iron-dust-source-terminal-event-delta-v1',
  terminalEntryVersion: 'iron-dust-source-terminal-entry-v1',
  terminalStep: 20,
  terminalEvent: {
    type: 'IronDustGameEnded',
    eventVersion: 'iron-dust-terminal-event-v1',
    winner: 'player', reason: 'core-destroyed', turn: 3, phase: 'fire',
    causedBy: {type: 'PlayerFireResolved', attackerId: 'ogre',
      targetId: 'core', eventIndex: 0}
  },
  finalRngState: 1276464017,
  finalInnerDigest: 'fnv1a64:4fc6781e704feee1'
});
