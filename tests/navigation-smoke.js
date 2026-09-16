const assert = require('assert');
const world = require('../systems/world.js');

function closedStructure() {
  return {
    id: 'test-building',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    door: { id: 'door', side: 'bottom', offset: 0, width: 64, open: false, destroyed: false },
    windows: []
  };
}

const structure = closedStructure();
const zombie = { x: 200, y: 0, size: 15 };
const besideWall = { x: 118, y: 0, radius: 12 };
const behindBuilding = { x: -118, y: 0, radius: 12 };

assert.equal(
  world.segmentHitsStructure(structure, zombie.x, zombie.y, besideWall.x, besideWall.y, zombie.size + 10),
  true,
  'Control case should reproduce the old false obstruction near a wall'
);

const nearbyProbe = world.approachPoint(
  zombie.x,
  zombie.y,
  besideWall.x,
  besideWall.y,
  zombie.size + besideWall.radius + 18
);
assert.equal(
  world.segmentHitsStructure(structure, zombie.x, zombie.y, nearbyProbe.x, nearbyProbe.y, zombie.size + 4),
  false,
  'A player on the same open side of a wall must remain directly approachable'
);

const blockedProbe = world.approachPoint(
  zombie.x,
  zombie.y,
  behindBuilding.x,
  behindBuilding.y,
  zombie.size + behindBuilding.radius + 18
);
assert.equal(
  world.segmentHitsStructure(structure, zombie.x, zombie.y, blockedProbe.x, blockedProbe.y, zombie.size + 4),
  true,
  'A building between zombie and player must still require a detour'
);

console.log(JSON.stringify({ nearbyProbe, blockedProbe, result: 'PASS' }, null, 2));
