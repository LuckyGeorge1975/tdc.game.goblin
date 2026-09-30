// Fixed CE-04 oracle: full states, commands, RNG, errors, and event payloads for phase-v2.
export const expectedPhaseReplay = Object.freeze({
  "initialState": {
    "rulesVersion": "core-v2",
    "scenarioVersion": "phase-v2",
    "map": {
      "width": 8,
      "height": 6,
      "terrain": []
    },
    "units": [
      {
        "id": "p-gev",
        "type": "tank",
        "team": "player",
        "x": 1,
        "y": 1,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 3,
        "range": 2,
        "damage": 1,
        "movementMode": "gev",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "p-tank",
        "type": "tank",
        "team": "player",
        "x": 1,
        "y": 4,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 2,
        "range": 4,
        "damage": 2,
        "movementMode": "tracked",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "e-tank",
        "type": "tank",
        "team": "enemy",
        "x": 4,
        "y": 4,
        "hp": 3,
        "maxHp": 3,
        "defense": 2,
        "move": 2,
        "range": 2,
        "damage": 2,
        "movementMode": "tracked",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "e-core",
        "type": "core",
        "team": "enemy",
        "x": 7,
        "y": 5,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 0,
        "range": 0,
        "damage": 0,
        "movementMode": "fixed",
        "core": true,
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      }
    ],
    "activeTeam": "player",
    "phase": "movement",
    "turn": 1,
    "victory": {
      "status": "ongoing",
      "winner": null
    },
    "rng": {
      "seed": 5,
      "state": 5
    }
  },
  "steps": [
    {
      "command": {
        "type": "Move",
        "playerId": "player",
        "unitId": "p-gev",
        "to": {
          "x": 2,
          "y": 1
        }
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 2,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "movement",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 5
          }
        },
        "events": [
          {
            "type": "UnitMoved",
            "unitId": "p-gev",
            "from": {
              "x": 1,
              "y": 1
            },
            "to": {
              "x": 2,
              "y": 1
            },
            "path": [
              {
                "x": 2,
                "y": 1
              }
            ],
            "phase": "movement"
          }
        ]
      }
    },
    {
      "command": {
        "type": "Move",
        "playerId": "player",
        "unitId": "p-gev",
        "to": {
          "x": 3,
          "y": 1
        }
      },
      "result": {
        "error": {
          "code": "ACTION_SPENT",
          "details": {
            "unitId": "p-gev"
          }
        }
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 2,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "fire",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 5
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "movement",
            "to": "fire",
            "activeTeam": "player",
            "turn": 1
          }
        ]
      }
    },
    {
      "command": {
        "type": "Fire",
        "playerId": "player",
        "unitId": "p-tank",
        "targetId": "e-tank"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 2,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "fire",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "ShotResolved",
            "attackerId": "p-tank",
            "targetId": "e-tank",
            "roll": 2,
            "ratio": "1-1",
            "result": "D",
            "hpBefore": 3,
            "hpAfter": 3,
            "disabled": true
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 2,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "gev",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "fire",
            "to": "gev",
            "activeTeam": "player",
            "turn": 1
          }
        ]
      }
    },
    {
      "command": {
        "type": "Move",
        "playerId": "player",
        "unitId": "p-gev",
        "to": {
          "x": 5,
          "y": 1
        }
      },
      "result": {
        "error": {
          "code": "UNREACHABLE",
          "details": {
            "to": {
              "x": 5,
              "y": 1
            }
          }
        }
      }
    },
    {
      "command": {
        "type": "Move",
        "playerId": "player",
        "unitId": "p-gev",
        "to": {
          "x": 4,
          "y": 1
        }
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": true,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "gev",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "UnitMoved",
            "unitId": "p-gev",
            "from": {
              "x": 2,
              "y": 1
            },
            "to": {
              "x": 4,
              "y": 1
            },
            "path": [
              {
                "x": 3,
                "y": 1
              },
              {
                "x": 4,
                "y": 1
              }
            ],
            "phase": "gev"
          }
        ]
      }
    },
    {
      "command": {
        "type": "Move",
        "playerId": "player",
        "unitId": "p-gev",
        "to": {
          "x": 5,
          "y": 1
        }
      },
      "result": {
        "error": {
          "code": "ACTION_SPENT",
          "details": {
            "unitId": "p-gev"
          }
        }
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": true,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "enemy",
          "phase": "movement",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "gev",
            "to": "movement",
            "activeTeam": "enemy",
            "turn": 1
          }
        ]
      }
    },
    {
      "command": {
        "type": "Move",
        "playerId": "enemy",
        "unitId": "e-tank",
        "to": {
          "x": 3,
          "y": 4
        }
      },
      "result": {
        "error": {
          "code": "UNIT_DISABLED",
          "details": {
            "unitId": "e-tank"
          }
        }
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "enemy"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": true,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "enemy",
          "phase": "fire",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "movement",
            "to": "fire",
            "activeTeam": "enemy",
            "turn": 1
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "enemy"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": true,
              "fired": false,
              "secondMoved": true,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": true,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "enemy",
          "phase": "gev",
          "turn": 1,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "fire",
            "to": "gev",
            "activeTeam": "enemy",
            "turn": 1
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "enemy"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "movement",
          "turn": 2,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "gev",
            "to": "movement",
            "activeTeam": "player",
            "turn": 2
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "fire",
          "turn": 2,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "movement",
            "to": "fire",
            "activeTeam": "player",
            "turn": 2
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": true,
              "disabledUntil": 2
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "player",
          "phase": "gev",
          "turn": 2,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "PhaseChanged",
            "from": "fire",
            "to": "gev",
            "activeTeam": "player",
            "turn": 2
          }
        ]
      }
    },
    {
      "command": {
        "type": "EndPhase",
        "playerId": "player"
      },
      "result": {
        "state": {
          "rulesVersion": "core-v2",
          "scenarioVersion": "phase-v2",
          "map": {
            "width": 8,
            "height": 6,
            "terrain": []
          },
          "units": [
            {
              "id": "p-gev",
              "type": "tank",
              "team": "player",
              "x": 4,
              "y": 1,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 3,
              "range": 2,
              "damage": 1,
              "movementMode": "gev",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "p-tank",
              "type": "tank",
              "team": "player",
              "x": 1,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 2,
              "range": 4,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-tank",
              "type": "tank",
              "team": "enemy",
              "x": 4,
              "y": 4,
              "hp": 3,
              "maxHp": 3,
              "defense": 2,
              "move": 2,
              "range": 2,
              "damage": 2,
              "movementMode": "tracked",
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            },
            {
              "id": "e-core",
              "type": "core",
              "team": "enemy",
              "x": 7,
              "y": 5,
              "hp": 3,
              "maxHp": 3,
              "defense": 3,
              "move": 0,
              "range": 0,
              "damage": 0,
              "movementMode": "fixed",
              "core": true,
              "moved": false,
              "fired": false,
              "secondMoved": false,
              "disabled": false,
              "disabledUntil": 0
            }
          ],
          "activeTeam": "enemy",
          "phase": "movement",
          "turn": 2,
          "victory": {
            "status": "ongoing",
            "winner": null
          },
          "rng": {
            "seed": 5,
            "state": 1022226848
          }
        },
        "events": [
          {
            "type": "UnitRecovered",
            "unitId": "e-tank",
            "activeTeam": "enemy",
            "turn": 2
          },
          {
            "type": "PhaseChanged",
            "from": "gev",
            "to": "movement",
            "activeTeam": "enemy",
            "turn": 2
          }
        ]
      }
    }
  ],
  "finalState": {
    "rulesVersion": "core-v2",
    "scenarioVersion": "phase-v2",
    "map": {
      "width": 8,
      "height": 6,
      "terrain": []
    },
    "units": [
      {
        "id": "p-gev",
        "type": "tank",
        "team": "player",
        "x": 4,
        "y": 1,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 3,
        "range": 2,
        "damage": 1,
        "movementMode": "gev",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "p-tank",
        "type": "tank",
        "team": "player",
        "x": 1,
        "y": 4,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 2,
        "range": 4,
        "damage": 2,
        "movementMode": "tracked",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "e-tank",
        "type": "tank",
        "team": "enemy",
        "x": 4,
        "y": 4,
        "hp": 3,
        "maxHp": 3,
        "defense": 2,
        "move": 2,
        "range": 2,
        "damage": 2,
        "movementMode": "tracked",
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      },
      {
        "id": "e-core",
        "type": "core",
        "team": "enemy",
        "x": 7,
        "y": 5,
        "hp": 3,
        "maxHp": 3,
        "defense": 3,
        "move": 0,
        "range": 0,
        "damage": 0,
        "movementMode": "fixed",
        "core": true,
        "moved": false,
        "fired": false,
        "secondMoved": false,
        "disabled": false,
        "disabledUntil": 0
      }
    ],
    "activeTeam": "enemy",
    "phase": "movement",
    "turn": 2,
    "victory": {
      "status": "ongoing",
      "winner": null
    },
    "rng": {
      "seed": 5,
      "state": 1022226848
    }
  }
});
