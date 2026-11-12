// Registered Core Iron Dust authoring data.
export const IRON_DUST_LEVEL_V3 = {
  version: "goblin-level-v3",
  id: "core-iron-dust",
  scenarioVersion: 1,
  width: 12,
  height: 8,
  ruleProfile: "CORE_IRON_DUST_v2",
  objective: "core",
  terrain: [
    {"x":3,"y":1,"type":"rubble-field"},
    {"x":8,"y":1,"type":"rubble-field"},
    {"x":1,"y":4,"type":"rubble-field"},
    {"x":5,"y":3,"type":"rubble-field"},
    {"x":9,"y":5,"type":"rubble-field"},
    {"x":2,"y":6,"type":"rubble-field"},
    {"x":7,"y":6,"type":"rubble-field"},
    {"x":10,"y":2,"type":"rubble-field"}
  ],
  units: [
    {"id":"ogre","assetId":"goblin-siegebreaker","team":"player","x":1,"y":5},
    {"id":"gev","assetId":"skimmer-scout","team":"player","x":2,"y":6},
    {"id":"missile","assetId":"rocket-artillery","team":"player","x":3,"y":6},
    {"id":"infantry","assetId":"infantry-platoon","team":"player","x":1,"y":6},
    {"id":"core","assetId":"command-core","team":"enemy","x":10,"y":2},
    {"id":"guard","assetId":"guard-tank","team":"enemy","x":8,"y":3},
    {"id":"raider","assetId":"raider-skimmer","team":"enemy","x":9,"y":5}
  ]
};
