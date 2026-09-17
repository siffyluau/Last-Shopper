const http = require('http');
const fs = require('fs');
const path = require('path');
const { performance, monitorEventLoopDelay } = require('perf_hooks');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const WorldMap = require('./systems/world.js');
const SpatialHash = require('./systems/spatial-hash.js');
const GameContent = require('./systems/content.js');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PERF_DEBUG = process.env.PERF_DEBUG === '1';
const TICK_MS = 50;
const SNAPSHOT_MS = 50;
const PROTOCOL_VERSION = 'authoritative-world-v3';
const MAX_EVENT_QUEUE = 400;
const BACKPRESSURE_SKIP_BYTES = 512 * 1024;
const BACKPRESSURE_KILL_BYTES = 4 * 1024 * 1024;
const HEARTBEAT_MS = 25000;
const BUILD_COMMIT = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local';
const TARGET_UPDATE_MS = 300;
const PATH_UPDATE_MS = 650;
const INTEREST_RADIUS = 1500;
const DAY_CYCLE_MS = 8 * 60 * 1000;
const REVIVE_DURATION_MS = 2500;
const MAX_EMERGENCY_REVIVES = 5;
const EMERGENCY_RESPAWN_DELAY_MS = 6000;
const FINAL_REVIVE_WINDOW_MS = 60000;
const SKILL_CAPS = new Map(GameContent.skills.map((skill) => [skill.id, skill.max]));
const EMPTY_SKILLS = Object.freeze(Object.fromEntries(GameContent.skills.map((skill) => [skill.id, 0])));
const WEAPON_DEFINITIONS = new Map(GameContent.weaponTypes.map((weapon) => [weapon.id, weapon]));
const TURRET_DEFINITIONS = new Map(GameContent.turretTypes.map((turret) => [turret.name, turret]));
const TRAP_DEFINITIONS = new Map(GameContent.trapTypes.map((trap) => [trap.name, trap]));
const BUILDING_DEFINITIONS = new Map(GameContent.buildingTypes.map((building) => [building.id, building]));
const UTILITY_UPGRADE_DEFINITIONS = new Map(GameContent.utilityUpgrades.map((upgrade) => [upgrade.id, upgrade]));
const RUN_UPGRADE_IDS = new Set(GameContent.runUpgrades.map((upgrade) => upgrade.id));
const AMMO_FORGE_OPTIONS = Object.freeze({
  small: { cost: { money: 90, metal: 2 }, ammo: 80 },
  large: { cost: { money: 240, metal: 6 }, ammo: 240 },
  parts: { cost: { money: 450, metal: 14 }, parts: 1 }
});
const TRADER_ITEMS = Object.freeze({
  wood: { cost: { money: 55 }, reward: { wood: 12 } },
  metal: { cost: { money: 80 }, reward: { metal: 9 } },
  ammo: { cost: { money: 45 }, reward: { ammo: 75 } },
  repairs: { cost: { money: 135 }, repairAll: true },
  parts: { cost: { money: 280 }, reward: { parts: 1 } }
});
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const SHOP_RECT = { x: 980, y: 615, width: 390, height: 260 };
const WORKBENCH_RECT = { x: 1285, y: 820, width: 118, height: 62 };
const WALL_STAGES = GameContent.wallStages;

const enemyTypes = {
  normal: { color: [45, 80, 22], speed: 1, health: 100, reward: 10, xp: 10, size: 15, contactDamage: 8 },
  fast: { color: [200, 50, 50], speed: 2, health: 60, reward: 15, xp: 15, size: 12, contactDamage: 7 },
  runner: { color: [230, 70, 55], speed: 2.45, health: 65, reward: 16, xp: 16, size: 12, contactDamage: 7 },
  tank: { color: [77, 112, 22], speed: 0.7, health: 300, reward: 25, xp: 25, size: 25, contactDamage: 14 },
  spitter: { color: [150, 200, 50], speed: 0.8, health: 80, reward: 20, xp: 20, size: 14, shootRange: 300, shootRate: 1800, contactDamage: 7 },
  thrower: { color: [100, 150, 200], speed: 1.2, health: 120, reward: 22, xp: 22, size: 16, throwRange: 250, throwRate: 2500, contactDamage: 8 },
  bomber: { color: [245, 125, 35], speed: 1.8, health: 90, reward: 34, xp: 30, size: 14, explosionDamage: 180, isBomber: true },
  sapper: { color: [239, 125, 45], speed: 1.22, health: 155, reward: 46, xp: 42, size: 16, explosionDamage: 260, isBomber: true, isSapper: true, contactDamage: 10 },
  stalker: { color: [111, 45, 130], speed: 1.58, health: 135, reward: 40, xp: 38, size: 16, isFlanker: true, contactDamage: 12 },
  shield: { color: [55, 135, 180], speed: 0.92, health: 220, shieldHealth: 240, reward: 35, xp: 32, size: 19, contactDamage: 11 },
  armored: { color: [90, 105, 115], speed: 0.72, health: 420, reward: 38, xp: 35, size: 24, armor: 0.38, contactDamage: 14 },
  acidRanger: { color: [130, 215, 55], speed: 0.82, health: 125, reward: 28, xp: 26, size: 15, shootRange: 380, shootRate: 1550, isAcidRanger: true },
  healerZombie: { color: [225, 230, 215], speed: 1.02, health: 145, reward: 36, xp: 34, size: 15, isHealer: true, healRadius: 115, healRate: 1150, healAmount: 8, contactDamage: 7 },
  engineer: { color: [180, 120, 55], speed: 0.86, health: 170, reward: 34, xp: 32, size: 16, isEngineer: true, weldRate: 2800, weldRadius: 120, contactDamage: 9 },
  disruptor: { color: [0, 200, 255], speed: 1, health: 150, reward: 30, xp: 30, size: 16, isDisruptor: true, contactDamage: 8 },
  splitter: { color: [95, 160, 70], speed: 1.05, health: 175, reward: 38, xp: 35, size: 18, isSplitter: true, splitInto: 'runner', splitCount: 2, contactDamage: 9 },
  charger: { color: [210, 82, 42], speed: 1.08, health: 210, reward: 44, xp: 42, size: 19, isCharger: true, chargeRate: 3600, chargeDuration: 620, chargeSpeed: 3.35, contactDamage: 16 },
  leech: { color: [125, 30, 60], speed: 1.28, health: 150, reward: 42, xp: 40, size: 15, isLeech: true, leechAmount: 9, contactDamage: 10 },
  eliteRunner: { color: [255, 105, 70], speed: 2.75, health: 155, reward: 58, xp: 55, size: 14, isEliteVariant: true, contactDamage: 12 },
  eliteTank: { color: [95, 125, 45], speed: 0.78, health: 760, reward: 84, xp: 80, size: 28, armor: 0.2, isEliteVariant: true, contactDamage: 18 },
  riftWarden: { name: 'Rift Warden', color: [126, 54, 190], speed: 0.82, health: 880, reward: 115, xp: 105, size: 27, armor: 0.12, contactDamage: 15, isDomainWarden: true, domainRange: 480 },
  miniBoss: { color: [175, 45, 115], speed: 0.68, health: 1500, reward: 300, xp: 240, size: 32, armor: 0.18, contactDamage: 20, shootRange: 330, shootRate: 1750, isMiniBoss: true },
  boss: { name: 'Basic Brute', color: [145, 12, 12], speed: 0.55, health: 4200, reward: 900, xp: 650, size: 46, armor: 0.22, contactDamage: 28, shootRange: 440, shootRate: 900, slamRange: 120, slamRate: 4200, isBoss: true },
  burrowKing: { name: 'Burrow King', color: [114, 74, 35], speed: 0.72, health: 4600, reward: 980, xp: 720, size: 44, armor: 0.12, contactDamage: 26, isBoss: true, bossKind: 'burrow', burrowRate: 5600, spawnRate: 4200 },
  chargerBrute: { name: 'Charger Brute', color: [205, 72, 34], speed: 0.7, health: 4800, reward: 1020, xp: 740, size: 47, armor: 0.14, contactDamage: 32, isBoss: true, bossKind: 'chargerBrute', chargeRate: 4600, chargeDuration: 800, chargeSpeed: 5.2, warningDuration: 720, slamRange: 125, slamRate: 3600 },
  teslaHorror: { name: 'Tesla Horror', color: [42, 170, 215], speed: 0.62, health: 5200, reward: 1180, xp: 840, size: 45, armor: 0.1, contactDamage: 24, isBoss: true, bossKind: 'tesla', empRadius: 250, empRate: 6400, empWindup: 1100, spawnRate: 7600 },
  broodMother: { name: 'Brood Mother', color: [115, 155, 65], speed: 0.48, health: 5600, reward: 1220, xp: 880, size: 52, armor: 0.08, contactDamage: 22, isBoss: true, bossKind: 'brood', spawnRate: 2900, weakSpotDuration: 950 },
  toxicButcher: { name: 'Toxic Butcher', color: [95, 190, 55], speed: 0.86, health: 6100, reward: 1400, xp: 980, size: 50, armor: 0.12, contactDamage: 36, isBoss: true, bossKind: 'toxic', puddleRate: 1200, slamRange: 150, slamRate: 3200 },
  bossButcher: { name: 'Meat Aisle Brute', color: [170, 35, 35], speed: 0.66, health: 5100, reward: 1050, xp: 760, size: 48, armor: 0.16, contactDamage: 34, slamRange: 145, slamRate: 3800, isBoss: true },
  bossSpitter: { name: 'Toxic Store Manager', color: [105, 190, 45], speed: 0.58, health: 4550, reward: 1000, xp: 720, size: 45, armor: 0.12, contactDamage: 24, shootRange: 520, shootRate: 720, isBoss: true, isAcidRanger: true }
};

const weaponTypes = {
  pistol: { damage: 35, fireRate: 300, speed: 8, bulletSize: 4 },
  shotgun: { damage: 12.5, fireRate: 600, speed: 6, pellets: 16, bulletSize: 3, requiredWave: 2 },
  smg: { damage: 17, fireRate: 78, speed: 10, bulletSize: 3, requiredWave: 4 },
  rifle: { damage: 29, fireRate: 115, speed: 11, bulletSize: 3, requiredWave: 6 },
  marksman: { damage: 118, fireRate: 560, speed: 16, bulletSize: 5, pierce: 1, requiredWave: 9 },
  minigun: { damage: 32, fireRate: 30, speed: 12, bulletSize: 2, requiredWave: 12 },
  grenadeLauncher: { damage: 300, fireRate: 1250, speed: 6, explosive: true, bulletSize: 7, requiredWave: 15 },
  rpg: { damage: 760, fireRate: 2100, speed: 5, explosive: true, bulletSize: 8, requiredWave: 20 }
};

const rooms = new Map();
let nextBulletId = 1;
let nextAcidPoolId = 1;
let nextEventId = 1;
const eventLoopDelay = PERF_DEBUG ? monitorEventLoopDelay({ resolution: 20 }) : null;
if (eventLoopDelay) eventLoopDelay.enable();

function nowMs() {
  return Date.now();
}

function emergencyReviveLimit(player) {
  return MAX_EMERGENCY_REVIVES + Math.max(0, Math.floor(Number(player?.lifePurchases) || 0));
}

function lifePurchaseCost(player) {
  return Math.round(10000 * Math.pow(1.5, Math.max(0, Math.floor(Number(player?.lifePurchases) || 0))));
}

function createPerformanceMetrics() {
  return {
    startedAt: nowMs(),
    ticks: 0,
    tickTotalMs: 0,
    tickWorstMs: 0,
    slowTicks: 0,
    stages: {
      chunks: 0,
      spatial: 0,
      wave: 0,
      zombies: 0,
      bullets: 0,
      collisions: 0,
      sentries: 0,
      cleanup: 0,
      snapshots: 0,
      serialization: 0
    },
    outgoingMessages: 0,
    outgoingBytes: 0,
    skippedSnapshots: 0,
    wireBytesBaseline: 0,
    snapshotMessages: 0,
    snapshotBytes: 0,
    snapshotEntities: 0,
    lastSlowLogAt: 0
  };
}

function recordStageDuration(room, name, elapsed) {
  if (!room || !Number.isFinite(elapsed)) return;
  const previous = room.stageEma[name];
  room.stageEma[name] = previous === undefined ? elapsed : previous * 0.9 + elapsed * 0.1;
  if (PERF_DEBUG && room.perf?.stages && name in room.perf.stages) room.perf.stages[name] += elapsed;
}

function measureStage(room, name, callback) {
  const startedAt = performance.now();
  try {
    return callback();
  } finally {
    recordStageDuration(room, name, performance.now() - startedAt);
  }
}

function performanceReport(room) {
  const perf = room.perf;
  const elapsedSeconds = Math.max(0.001, (nowMs() - perf.startedAt) / 1000);
  const stageAverages = {};
  for (const [name, total] of Object.entries(perf.stages)) {
    stageAverages[name] = perf.ticks ? total / perf.ticks : 0;
  }
  return {
    room: room.code,
    configuredTickRate: Math.round(1000 / TICK_MS),
    configuredSnapshotRate: Math.round(1000 / SNAPSHOT_MS),
    measuredTickRate: perf.ticks / elapsedSeconds,
    averageTickMs: perf.ticks ? perf.tickTotalMs / perf.ticks : 0,
    worstTickMs: perf.tickWorstMs,
    slowTicks: perf.slowTicks,
    stageAverageMs: stageAverages,
    players: room.players.size,
    zombies: room.latestWorld.zombies.length,
    projectiles: room.latestWorld.bullets.length,
    structures: room.latestWorld.sentries.length + room.latestWorld.walls.length + room.latestWorld.traps.length + room.latestWorld.buildings.length,
    outgoingMessagesPerSecond: perf.outgoingMessages / elapsedSeconds,
    outgoingBytesPerSecond: perf.outgoingBytes / elapsedSeconds,
    outgoingWireBytesPerSecond: (wireBytesWritten(room) - perf.wireBytesBaseline) / elapsedSeconds,
    skippedSnapshots: perf.skippedSnapshots,
    snapshotIntervalMs: room.snapshotIntervalMs,
    tickEmaMs: room.tickEma,
    averageSnapshotBytes: perf.snapshotMessages ? perf.snapshotBytes / perf.snapshotMessages : 0,
    averageSnapshotEntities: perf.snapshotMessages ? perf.snapshotEntities / perf.snapshotMessages : 0,
    eventLoopDelayMeanMs: eventLoopDelay ? eventLoopDelay.mean / 1e6 : 0,
    eventLoopDelayMaxMs: eventLoopDelay ? eventLoopDelay.max / 1e6 : 0
  };
}

function wireBytesWritten(room) {
  let total = 0;
  for (const client of room.clients.values()) total += client._socket?.bytesWritten || 0;
  return total;
}

function createSpatialIndexes() {
  return {
    zombies: new SpatialHash(192),
    traps: new SpatialHash(192),
    walls: new SpatialHash(192),
    sentries: new SpatialHash(192),
    buildings: new SpatialHash(256),
    mapStructures: new SpatialHash(WorldMap.CHUNK_SIZE)
  };
}

function rebuildSpatialIndexes(room, zombiesOnly = false) {
  const world = room.latestWorld;
  room.spatial.zombies.rebuild(world.zombies);
  if (zombiesOnly) return;
  const structureSignature = `${room.structuresRevision}:${world.traps.length}:${world.walls.length}:${world.sentries.length}:${world.buildings.length}:${(world.mapStructures || []).length}`;
  if (structureSignature === room.lastSpatialSignature) return;
  room.lastSpatialSignature = structureSignature;
  room.spatial.traps.rebuild(world.traps);
  room.spatial.walls.rebuild(world.walls);
  room.spatial.sentries.rebuild(world.sentries);
  room.spatial.buildings.rebuild(world.buildings);
  room.spatial.mapStructures.rebuild(world.mapStructures || []);
}

function segmentCircleHit(x1, y1, x2, y2, circleX, circleY, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0.0001) return distance(x1, y1, circleX, circleY) <= radius;
  const amount = clamp(((circleX - x1) * dx + (circleY - y1) * dy) / lengthSquared, 0, 1);
  const nearestX = x1 + dx * amount;
  const nearestY = y1 + dy * amount;
  const offsetX = nearestX - circleX;
  const offsetY = nearestY - circleY;
  return offsetX * offsetX + offsetY * offsetY <= radius * radius;
}

function segmentAabbHit(x1, y1, x2, y2, rect, padding = 0) {
  const minX = rect.x - rect.width / 2 - padding;
  const maxX = rect.x + rect.width / 2 + padding;
  const minY = rect.y - rect.height / 2 - padding;
  const maxY = rect.y + rect.height / 2 + padding;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let low = 0;
  let high = 1;
  for (const [start, delta, min, max] of [[x1, dx, minX, maxX], [y1, dy, minY, maxY]]) {
    if (Math.abs(delta) < 0.0001) {
      if (start < min || start > max) return false;
      continue;
    }
    const first = (min - start) / delta;
    const second = (max - start) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
    if (low > high) return false;
  }
  return true;
}

function querySegment(index, x1, y1, x2, y2, padding) {
  return index.queryAabb(
    Math.min(x1, x2) - padding,
    Math.min(y1, y2) - padding,
    Math.max(x1, x2) + padding,
    Math.max(y1, y2) + padding
  );
}

function distance(a, b, x2, y2) {
  const dx = a - x2;
  const dy = b - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildRadius(entity) {
  return Number(entity.radius) || Math.max(Number(entity.width) || 0, Number(entity.height) || 0) / 2 || 20;
}

function rectBlocked(x, y, radius, rect) {
  const halfW = rect.width / 2 + radius;
  const halfH = rect.height / 2 + radius;
  return x > rect.x - halfW && x < rect.x + halfW && y > rect.y - halfH && y < rect.y + halfH;
}

function nearbyAny(x, y, radius, list, minDistance, skipNetworkId) {
  return list.some((item) => {
    if (skipNetworkId && item.networkId === skipNetworkId) return false;
    const itemRadius = buildRadius(item);
    return distance(x, y, item.x, item.y) < minDistance + radius + itemRadius;
  });
}

function buildingOnline(world, id) {
  return world.buildings.some((building) => building.id === id && building.health > 0);
}

function serverPlacementLimits(world) {
  const benchLevel = world.workbenchLevel || 1;
  return {
    turrets: 4 + benchLevel * 2 + (buildingOnline(world, 'advancedTurretBench') ? 2 : 0),
    walls: 18 + benchLevel * 10,
    traps: 6 + benchLevel * 4 + (buildingOnline(world, 'trapBench') ? 8 : 0),
    buildings: 9
  };
}

function validateBuildPlacement(kind, entity, world) {
  if (!entity) return false;
  const x = Number(entity.x);
  const y = Number(entity.y);
  const radius = buildRadius(entity);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius)) return false;
  if (rectBlocked(x, y, radius, SHOP_RECT)) return false;
  if (rectBlocked(x, y, radius, WORKBENCH_RECT)) return false;
  if ((world.mapStructures || []).some((structure) =>
    WorldMap.wallSegments(structure).some((wall) => rectBlocked(x, y, radius, wall)))) return false;
  if (kind !== 'building' && world.buildings.some((building) => rectBlocked(x, y, radius, building))) return false;

  const limits = serverPlacementLimits(world);
  if (kind === 'turret') {
    if (world.sentries.filter((item) => item.ownerId === entity.ownerId).length >= limits.turrets) return false;
    if (nearbyAny(x, y, radius, world.sentries, 78, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.walls, 26)) return false;
  } else if (kind === 'wall') {
    if (world.walls.filter((item) => item.ownerId === entity.ownerId).length >= limits.walls) return false;
    if (nearbyAny(x, y, radius, world.walls, 5, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 20)) return false;
  } else if (kind === 'trap') {
    if (world.traps.filter((item) => item.ownerId === entity.ownerId).length >= limits.traps) return false;
    if (nearbyAny(x, y, radius, world.traps, 34, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 20) || nearbyAny(x, y, radius, world.walls, 12)) return false;
  } else if (kind === 'building') {
    if (world.buildings.filter((item) => item.ownerId === entity.ownerId).length >= limits.buildings) return false;
    if (world.buildings.some((building) => building.id === entity.id)) return false;
    if (nearbyAny(x, y, radius, world.buildings, 82, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 44) || nearbyAny(x, y, radius, world.walls, 24)) return false;
  } else {
    return false;
  }
  return true;
}

function canonicalBuildDefinition(kind, entity) {
  if (kind === 'turret') return TURRET_DEFINITIONS.get(String(entity.name || '')) || null;
  if (kind === 'wall') return WALL_STAGES[clamp(Math.floor(Number(entity.wallStage) || 0), 0, WALL_STAGES.length - 1)] || null;
  if (kind === 'trap') return TRAP_DEFINITIONS.get(String(entity.name || '')) || null;
  if (kind === 'building') return BUILDING_DEFINITIONS.get(String(entity.id || '')) || null;
  return null;
}

function sanitizeBuildEntity(kind, entity, ownerId, player) {
  const definition = canonicalBuildDefinition(kind, entity);
  if (!definition) return null;
  const x = Number(entity.x);
  const y = Number(entity.y);
  const common = {
    ...definition,
    x,
    y,
    networkId: String(entity.networkId || `${kind}-${ownerId || 'player'}-${nowMs()}-${Math.random().toString(36).slice(2, 6)}`).slice(0, 64),
    ownerId: String(ownerId || 'player'),
    ownerName: String(player?.name || 'P1').slice(0, 24)
  };
  if (kind === 'turret') {
    const upgrades = player?.runUpgradeCounts || {};
    const damageScale = Math.pow(1.15, upgrades.turretCore || 0);
    const fireRateScale = Math.pow(0.87, upgrades.turretCore || 0);
    const rangeScale = Math.pow(1.15, upgrades.longShot || 0);
    const healthScale = Math.pow(1.2, upgrades.fortify || 0);
    return {
      ...common,
      radius: definition.radius || 15,
      angle: 0,
      lastShot: 0,
      isDisabled: 0,
      damage: definition.damage * damageScale,
      fireRate: definition.fireRate * fireRateScale,
      range: definition.range * rangeScale,
      maxHealth: definition.maxHealth * healthScale,
      health: definition.maxHealth * healthScale,
      ammo: definition.maxAmmo,
      maxAmmo: definition.maxAmmo,
      upgradeLevels: { damage: 0, fireRate: 0, range: 0, ammo: 0 }
    };
  }
  if (kind === 'wall') {
    const wallStage = WALL_STAGES.indexOf(definition);
    const fortify = Math.pow(1.2, player?.runUpgradeCounts?.fortify || 0);
    const skinScale = playerSkinPerk(player || {}, 'wallHealth') ? 1.03 : 1;
    const maxHealth = definition.health * fortify * skinScale;
    return { ...common, wallStage, radius: 25, maxHealth, health: maxHealth };
  }
  if (kind === 'trap') {
    const maxUses = Math.max(1, Number(definition.maxUses) || 10);
    return {
      ...common,
      radius: definition.radius || 20,
      maxUses,
      usesRemaining: maxUses,
      lastTriggeredAt: 0,
      upgradeLevels: { damage: 0, radius: 0, uses: 0 }
    };
  }
  const maxHealth = 900 + definition.techLevel * 200;
  return {
    ...common,
    width: definition.width,
    height: definition.height,
    radius: Math.max(definition.width, definition.height) / 2,
    interactionRadius: Math.max(definition.width, definition.height) * 0.92,
    health: maxHealth,
    maxHealth
  };
}

function wavePlan(wave, playerCount) {
  const bossWave = wave % 10 === 0;
  const miniBossWave = wave > 5 && wave % 5 === 0 && !bossWave;
  const completed = wave - 1;
  const playerScale = 1 + Math.max(0, playerCount - 1) * 0.35;
  const healthPlayerScale = 1 + Math.max(0, playerCount - 1) * 0.12;
  const baseCount = Math.floor(6 + wave * 1.35 + Math.pow(wave, 0.72));
  return {
    bossWave,
    miniBossWave,
    bossCount: bossWave ? Math.max(1, Math.floor(wave / 30) + 1) : 0,
    miniBossCount: miniBossWave ? Math.max(1, Math.floor(wave / 20) + 1) : 0,
    enemyCount: Math.ceil((bossWave ? 8 + Math.floor(wave * 0.85) : baseCount) * playerScale),
    healthScale: (1.1 + completed * 0.047 + completed * completed * 0.0009) * healthPlayerScale,
    damageScale: 1.05 + completed * 0.019,
    rewardScale: (1 + completed * 0.055) * (1 + Math.max(0, playerCount - 1) * 0.18),
    waveReward: {
      money: Math.floor(28 * Math.pow(wave, 1.12)),
      wood: Math.max(2, Math.floor(1 + wave * 0.55)),
      metal: Math.max(1, Math.floor(wave * 0.36))
    }
  };
}

function bossPartyHealthScale(playerCount, type) {
  const extraPlayers = Math.max(0, playerCount - 1);
  if (type.isBoss) return 1 + Math.min(extraPlayers, 1) * 0.45 + Math.max(0, extraPlayers - 1) * 0.75;
  if (type.isMiniBoss) return 1 + extraPlayers * 0.4;
  return 1;
}

function enemyPool(wave) {
  const pool = ['normal', 'normal', 'normal', 'normal'];
  if (wave >= 2) pool.push('fast');
  if (wave >= 3) pool.push('runner');
  if (wave >= 4) pool.push('tank');
  if (wave >= 5) pool.push('spitter');
  if (wave >= 6) pool.push('sapper', 'stalker');
  if (wave >= 7) pool.push('bomber', 'healerZombie');
  if (wave >= 8) pool.push('shield');
  if (wave >= 9) pool.push('armored', 'acidRanger');
  if (wave >= 11) pool.push('engineer', 'splitter');
  if (wave >= 12) pool.push('charger', 'leech');
  if (wave >= 14) pool.push('thrower');
  if (wave >= 15) pool.push('riftWarden');
  if (wave >= 16) pool.push('disruptor');
  if (wave >= 20) pool.push('eliteRunner', 'eliteTank', 'bomber', 'acidRanger');
  return pool;
}

function bossPool(wave) {
  const pool = ['boss', 'burrowKing', 'chargerBrute'];
  if (wave >= 20) pool.push('teslaHorror', 'broodMother');
  if (wave >= 30) pool.push('toxicButcher', 'bossButcher', 'bossSpitter');
  return pool;
}

function createWorld(seed) {
  return {
    mapSeed: seed || `last-shopper-${nowMs()}`,
    mapStructures: [],
    lootBeacon: null,
    nextWorldDropAt: nowMs() + 45000,
    serverTime: nowMs(),
    cycleStartedAt: nowMs(),
    dayTime: 0.34,
    dayNumber: 1,
    gameStarted: false,
    gameOver: false,
    wave: 0,
    waveActive: false,
    zombiesKilled: 0,
    totalZombiesInWave: 0,
    bossesToSpawn: 0,
    miniBossesToSpawn: 0,
    escortsToSpawn: 0,
    currentWavePlan: null,
    techTier: 1,
    workbenchLevel: 1,
    nextSpawnAt: 0,
    nextWaveAt: 0,
    preparationActive: false,
    preparationEndsAt: 0,
    preparationEvent: null,
    supplyDrop: null,
    trader: null,
    zombies: [],
    bullets: [],
    sentries: [],
    walls: [],
    traps: [],
    buildings: [],
    drops: [],
    acidPools: [],
    domainEvent: null,
    bossDefeats: 0,
    mapRevision: 0,
    structureStateRevision: 0
  };
}

function getRoom(code) {
  const roomCode = String(code || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'STORE';
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      code: roomCode,
      clients: new Map(),
      players: new Map(),
      weaponCooldowns: new Map(),
      acceptedShotIds: new Map(),
      hostId: null,
      gameStarted: false,
      latestWorld: createWorld(`room-${roomCode}`),
      generatedChunks: new Set(),
      structureStates: new Map(),
      spatial: createSpatialIndexes(),
      worldChunkSignature: '',
      clientEntityKnowledge: new Map(),
      clientEvents: new Map(),
      structuresRevision: 0,
      lastSpatialSignature: '',
      snapshotIntervalMs: SNAPSHOT_MS,
      tickEma: 0,
      stageEma: {},
      reportedPerf: {},
      nextPerfPublishAt: 0,
      governorRecoverAt: 0,
      lastTick: nowMs(),
      lastSnapshot: 0,
      snapshotAccumulator: 0,
      perf: createPerformanceMetrics()
    });
  }
  return rooms.get(roomCode);
}

function send(ws, packet, room = ws.room) {
  if (ws.readyState !== WebSocket.OPEN) return false;
  const serializationStartedAt = performance.now();
  const payload = JSON.stringify(packet);
  recordStageDuration(room, 'serialization', performance.now() - serializationStartedAt);
  ws.send(payload);
  if (!PERF_DEBUG || !room?.perf) return true;
  const bytes = Buffer.byteLength(payload);
  room.perf.outgoingMessages += 1;
  room.perf.outgoingBytes += bytes;
  if (packet.type === 'world') {
    room.perf.snapshotMessages += 1;
    room.perf.snapshotBytes += bytes;
    room.perf.snapshotEntities += (packet.world?.players?.length || 0)
      + (packet.world?.zombies?.length || 0)
      + (packet.world?.bullets?.length || 0)
      + (packet.world?.sentries?.length || 0)
      + (packet.world?.walls?.length || 0)
      + (packet.world?.traps?.length || 0)
      + (packet.world?.buildings?.length || 0);
  }
  return true;
}

function broadcast(room, packet, except) {
  for (const client of room.clients.values()) {
    if (client !== except) send(client, packet, room);
  }
}

// --- Per-client reliable event queue (kill rewards, loot, wave clears, shots, rejections) ---
function queueEvent(room, event, targetId = null, exceptId = null) {
  event.id = event.id || `e${nextEventId++}`;
  event.at = event.at || nowMs();
  const push = (clientId) => {
    let queue = room.clientEvents.get(clientId);
    if (!queue) {
      queue = [];
      room.clientEvents.set(clientId, queue);
    }
    queue.push(event);
    if (queue.length > MAX_EVENT_QUEUE) queue.splice(0, queue.length - MAX_EVENT_QUEUE);
  };
  if (targetId) {
    if (room.clients.has(targetId)) push(targetId);
    return;
  }
  for (const clientId of room.clients.keys()) {
    if (clientId !== exceptId) push(clientId);
  }
}

function rejectAction(room, clientId, action, networkId, reason) {
  queueEvent(room, { kind: 'actionRejected', action, networkId: networkId || null, reason }, clientId);
}

const round1 = (value) => Math.round(value * 10) / 10;
const round2 = (value) => Math.round(value * 100) / 100;
const roundInt = (value) => Math.round(value);
const identity = (value) => value;

const ZOMBIE_SERVER_ONLY = new Set([
  'targetId', 'targetKind', 'nextTargetAt', 'nextPathAt', 'detourX', 'detourY', 'detourUntil', 'detourObstacleId',
  'breachTargetId', 'lastShot', 'lastSlam', 'lastMelee', 'lastHeal', 'lastWeld', 'lastBreachHit', 'lastCharge',
  'lastSpawn', 'lastBurrow', 'lastEmp', 'lastPuddle', 'lastDodge', 'lastHitBy', 'wallTurn', 'wallBlockedTicks',
  'flankSign', 'emergeAt', 'emergeX', 'emergeY', 'domainCastUsed', 'chargeAngle', 'empChargeUntil', 'empPulseUntil'
]);

const ZOMBIE_DYNAMIC = {
  x: round1, y: round1, health: roundInt, shieldHealth: roundInt, maxShieldHealth: roundInt, hidden: identity, phase: identity,
  burrowWarning: identity, warningLine: identity, chargeWindupUntil: identity, chargeUntil: identity, dodgeUntil: identity,
  weakSpotUntil: identity, stunnedUntil: identity, domainCastingUntil: identity, empChargeUntil: identity, empPulseUntil: identity
};
const SENTRY_DYNAMIC = {
  x: round1, y: round1, angle: round2, health: roundInt, maxHealth: roundInt, ammo: roundInt, maxAmmo: roundInt,
  damage: round2, fireRate: round2, range: round1, upgradeLevels: identity, disabledMs: identity
};
const WALL_DYNAMIC = {
  x: round1, y: round1, health: roundInt, maxHealth: roundInt, isElectric: identity, shockDamage: identity,
  wallStage: identity, name: identity, color: identity, armor: identity
};
const TRAP_DYNAMIC = {
  x: round1, y: round1, damage: round2, radius: round1,
  usesRemaining: roundInt, maxUses: roundInt, upgradeLevels: identity
};
const BUILDING_DYNAMIC = { x: round1, y: round1, health: roundInt, maxHealth: roundInt };
const PLAYER_DYNAMIC = {
  x: round1, y: round1, angle: round2, health: roundInt, maxHealth: roundInt, downed: identity, downedAt: identity,
  respawnAt: identity, giveUpAt: identity, reviveProgress: identity, reviverId: identity, emergencyRespawns: identity,
  eliminated: identity,
  lifePurchases: identity,
  seq: identity, name: identity, skinId: identity, level: identity, wave: identity, weapons: identity,
  money: roundInt, wood: roundInt, metal: roundInt, reserveAmmo: roundInt, rareTurretParts: roundInt,
  xp: roundInt, xpToNext: roundInt, skillPoints: roundInt, skillLevels: identity, runUpgradeCounts: identity,
  baseMaxHealth: roundInt, moveSpeedMultiplier: round2, reloadSpeedMultiplier: round2, resourceMultiplier: round2,
  potionExpiries: identity, nextEmergencyReloadAt: identity, milestoneUpgradeCredits: roundInt, upgrades: identity
};
const PLAYER_SERVER_ONLY = new Set(['lastSeen', 'lastReviveTick', 'invulnerableUntil', 'upgrades', 'damageMultiplier',
  'fireRateMultiplier', 'armorMultiplier', 'critChance', 'lifesteal', 'pickupRadius', 'disconnectedAt',
  'progressionInitialized', 'money', 'wood', 'metal', 'reserveAmmo', 'rareTurretParts', 'xp', 'xpToNext',
  'skillPoints', 'skillLevels', 'runUpgradeCounts', 'baseMaxHealth', 'moveSpeedMultiplier',
  'reloadSpeedMultiplier', 'resourceMultiplier', 'potionExpiries', 'nextEmergencyReloadAt', 'milestoneUpgradeCredits', 'lifePurchases']);

function privatePlayerSnapshot(player) {
  return {
    money: player.money,
    wood: player.wood,
    metal: player.metal,
    reserveAmmo: player.reserveAmmo,
    rareTurretParts: player.rareTurretParts,
    xp: player.xp,
    xpToNext: player.xpToNext,
    skillPoints: player.skillPoints,
    skillLevels: player.skillLevels,
    runUpgradeCounts: player.runUpgradeCounts,
    baseMaxHealth: player.baseMaxHealth,
    moveSpeedMultiplier: player.moveSpeedMultiplier,
    reloadSpeedMultiplier: player.reloadSpeedMultiplier,
    resourceMultiplier: player.resourceMultiplier,
    potionExpiries: player.potionExpiries,
    nextEmergencyReloadAt: player.nextEmergencyReloadAt,
    milestoneUpgradeCredits: player.milestoneUpgradeCredits,
    lifePurchases: player.lifePurchases,
    upgrades: player.upgrades
  };
}

function stableValue(value) {
  if (value === undefined) return null;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function prepareEntity(entity, serverOnly, dynamic, extra) {
  const record = {};
  for (const key of Object.keys(entity)) {
    if (serverOnly && serverOnly.has(key)) continue;
    const value = entity[key];
    if (value === undefined || typeof value === 'function') continue;
    record[key] = dynamic[key] && typeof value === 'number' ? dynamic[key](value) : value;
  }
  if (extra) Object.assign(record, extra);
  return record;
}

// Sends the full record the first time this client sees an entity, then only the id plus fields that changed.
function diffKnownEntities(knowledge, key, entities, idField, dynamic, options = {}) {
  const previous = knowledge[key] || new Map();
  const next = new Map();
  const result = [];
  for (const entity of entities) {
    const id = entity[idField] || entity.id;
    if (!id) continue;
    const extra = options.extra ? options.extra(entity) : null;
    const record = prepareEntity(entity, options.serverOnly, dynamic, extra);
    const last = previous.get(id);
    const snapshotValues = {};
    for (const field of Object.keys(dynamic)) snapshotValues[field] = stableValue(record[field]);
    next.set(id, snapshotValues);
    if (!last) {
      result.push(record);
      continue;
    }
    if (options.staticAfterSpawn) {
      result.push({ [idField]: id });
      continue;
    }
    const compact = { [idField]: id };
    for (const field of Object.keys(dynamic)) {
      if (snapshotValues[field] !== last[field]) compact[field] = record[field] === undefined ? null : record[field];
    }
    result.push(compact);
  }
  knowledge[key] = next;
  return result;
}

function withinInterest(entity, anchor, radius = INTEREST_RADIUS) {
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return true;
  const dx = entity.x - anchor.x;
  const dy = entity.y - anchor.y;
  return dx * dx + dy * dy <= radius * radius;
}

function structureState(structure) {
  return {
    id: structure.id,
    door: {
      open: Boolean(structure.door.open),
      destroyed: Boolean(structure.door.destroyed),
      health: Number(structure.door.health)
    },
    windows: (structure.windows || []).map((entry) => ({
      id: entry.id,
      breached: Boolean(entry.breached),
      health: Number(entry.health)
    })),
    lootClaimed: Boolean(structure.loot.claimed)
  };
}

function bumpStructureState(world, structure) {
  structure.stateRevision = (structure.stateRevision || 0) + 1;
  world.structureStateRevision = (world.structureStateRevision || 0) + 1;
}

function networkWorldSnapshot(room, clientId) {
  const world = room.latestWorld;
  const now = nowMs();
  const anchor = room.players.get(clientId) || null;
  let knowledge = room.clientEntityKnowledge.get(clientId);
  const full = !knowledge || knowledge.full;
  if (!knowledge) {
    knowledge = {};
    room.clientEntityKnowledge.set(clientId, knowledge);
  }
  if (knowledge.full) {
    for (const key of Object.keys(knowledge)) delete knowledge[key];
  }
  const snapshot = {};
  if (full) snapshot.full = true;

  const globals = {
    gameStarted: room.gameStarted,
    gameOver: world.gameOver,
    wave: world.wave,
    waveActive: world.waveActive,
    zombiesKilled: world.zombiesKilled,
    totalZombiesInWave: world.totalZombiesInWave,
    bossesToSpawn: world.bossesToSpawn,
    miniBossesToSpawn: world.miniBossesToSpawn,
    escortsToSpawn: world.escortsToSpawn,
    currentWavePlan: world.currentWavePlan,
    techTier: world.techTier,
    workbenchLevel: world.workbenchLevel,
    dayTime: Math.round(world.dayTime * 10000) / 10000,
    dayNumber: world.dayNumber,
    preparationActive: world.preparationActive,
    preparationEvent: world.preparationEvent,
    supplyDrop: world.supplyDrop,
    trader: world.trader,
    lootBeacon: world.lootBeacon,
    domainEvent: world.domainEvent,
    bossDefeats: world.bossDefeats,
    mapSeed: world.mapSeed,
    serverPerf: room.reportedPerf
  };
  const lastGlobals = knowledge.globals || (knowledge.globals = {});
  for (const [field, value] of Object.entries(globals)) {
    const stable = stableValue(value);
    if (lastGlobals[field] !== stable) {
      lastGlobals[field] = stable;
      snapshot[field] = value === undefined ? null : value;
    }
  }
  snapshot.serverTime = now;
  snapshot.preparationEndsIn = world.preparationActive ? Math.max(0, world.preparationEndsAt - now) : 0;

  const interestedZombies = world.zombies.filter((entity) => entity.isBoss || entity.isMiniBoss || withinInterest(entity, anchor));
  const interestedBullets = world.bullets.filter((entity) => withinInterest(entity, anchor, INTEREST_RADIUS + 350));
  const interestedSentries = world.sentries.filter((entity) => withinInterest(entity, anchor));
  const interestedWalls = world.walls.filter((entity) => withinInterest(entity, anchor));
  const interestedTraps = world.traps.filter((entity) => withinInterest(entity, anchor));
  const interestedBuildings = world.buildings.filter((entity) => withinInterest(entity, anchor, INTEREST_RADIUS + 300));
  const interestedMap = (world.mapStructures || []).filter((entity) => withinInterest(entity, anchor, INTEREST_RADIUS + 650));

  snapshot.zombies = diffKnownEntities(knowledge, 'zombies', interestedZombies, 'id', ZOMBIE_DYNAMIC, { serverOnly: ZOMBIE_SERVER_ONLY });
  snapshot.bullets = diffKnownEntities(knowledge, 'bullets', interestedBullets, 'id', { x: round1, y: round1 }, {
    serverOnly: new Set(['hitIds', 'pierce', 'damage']),
    staticAfterSpawn: true
  });
  snapshot.sentries = diffKnownEntities(knowledge, 'sentries', interestedSentries, 'networkId', SENTRY_DYNAMIC, {
    serverOnly: new Set(['lastShot', 'isDisabled']),
    extra: (sentry) => ({ disabledMs: sentry.isDisabled > now ? Math.ceil((sentry.isDisabled - now) / 250) * 250 : 0 })
  });
  snapshot.walls = diffKnownEntities(knowledge, 'walls', interestedWalls, 'networkId', WALL_DYNAMIC);
  snapshot.traps = diffKnownEntities(knowledge, 'traps', interestedTraps, 'networkId', TRAP_DYNAMIC, { serverOnly: new Set(['consumed', 'lastTriggeredAt']) });
  snapshot.buildings = diffKnownEntities(knowledge, 'buildings', interestedBuildings, 'networkId', BUILDING_DYNAMIC);
  snapshot.drops = diffKnownEntities(knowledge, 'drops', world.drops.filter((entity) => withinInterest(entity, anchor)), 'id', { x: round1, y: round1 }, {
    serverOnly: new Set(['life']),
    staticAfterSpawn: true
  });
  snapshot.acidPools = diffKnownEntities(knowledge, 'acidPools', world.acidPools.filter((entity) => withinInterest(entity, anchor)), 'id', { x: round1, y: round1 }, {
    staticAfterSpawn: true
  });
  snapshot.players = diffKnownEntities(knowledge, 'players', [...room.players.values()], 'id', PLAYER_DYNAMIC, {
    serverOnly: PLAYER_SERVER_ONLY,
    extra: (player) => player.id === clientId ? privatePlayerSnapshot(player) : null
  });

  // Map structures: per-client add/remove plus per-structure state revisions.
  const knownMap = knowledge.mapStructures || (knowledge.mapStructures = new Map());
  const nextMap = new Map();
  const addedStructures = [];
  const changedStates = [];
  for (const structure of interestedMap) {
    const seenRevision = knownMap.get(structure.id);
    const revision = structure.stateRevision || 0;
    if (seenRevision === undefined) {
      addedStructures.push(structure);
    } else if (revision !== seenRevision) {
      changedStates.push(structureState(structure));
    }
    nextMap.set(structure.id, revision);
  }
  const removedStructures = [];
  for (const id of knownMap.keys()) {
    if (!nextMap.has(id)) removedStructures.push(id);
  }
  knowledge.mapStructures = nextMap;
  if (addedStructures.length) snapshot.mapStructures = addedStructures;
  if (removedStructures.length) snapshot.mapStructuresRemoved = removedStructures;
  if (changedStates.length) snapshot.mapStructureStates = changedStates;

  const events = room.clientEvents.get(clientId);
  if (events && events.length) {
    snapshot.events = events;
    room.clientEvents.set(clientId, []);
  }
  return snapshot;
}

function announceRoom(room) {
  if (!room.hostId || !room.clients.has(room.hostId)) {
    room.hostId = room.clients.keys().next().value || null;
  }
  broadcast(room, {
    type: 'server',
    authoritative: true,
    protocol: PROTOCOL_VERSION,
    room: room.code,
    hostId: room.hostId,
    clientCount: room.clients.size,
    roomStarted: room.gameStarted
  });
}

function registerClient(room, ws, packet) {
  if (!packet.id) return;
  if (ws.clientId === packet.id && room.clients.get(packet.id) === ws) return;
  if (ws.clientId && room.clients.get(ws.clientId) === ws) {
    room.clients.delete(ws.clientId);
  }
  const existing = room.clients.get(packet.id);
  if (existing && existing !== ws) {
    // Same player id reconnecting (page reload / network blip): replace the stale socket, keep the player.
    existing.replacedByReconnect = true;
    try { existing.terminate(); } catch {}
  }
  ws.clientId = packet.id;
  room.clients.set(packet.id, ws);
  room.clientEntityKnowledge.set(packet.id, { full: true });
  if (!room.clientEvents.has(packet.id)) room.clientEvents.set(packet.id, []);
  const player = room.players.get(packet.id);
  if (player) {
    player.lastSeen = nowMs();
    player.disconnectedAt = 0;
  }
  if (!room.hostId) room.hostId = packet.id;
  if (PERF_DEBUG && room.perf) room.perf.wireBytesBaseline += ws._socket?.bytesWritten || 0;
  send(ws, {
    type: 'server',
    authoritative: true,
    protocol: PROTOCOL_VERSION,
    room: room.code,
    hostId: room.hostId,
    clientCount: room.clients.size,
    roomStarted: room.gameStarted,
    gameStarted: room.gameStarted
  });
  announceRoom(room);
}

function startWave(room) {
  const world = room.latestWorld;
  if (world.gameOver) return;
  for (const player of room.players.values()) {
    if (!player.downed && !player.eliminated) continue;
    player.x = 980 + Math.random() * 36 - 18;
    player.y = 850 + Math.random() * 24 - 12;
    revivePlayer(player, 0.45);
    queueEvent(room, { kind: 'waveReturn', wave: world.wave + 1 }, player.id);
  }
  world.wave += 1;
  world.waveActive = true;
  world.zombiesKilled = 0;
  world.currentWavePlan = wavePlan(world.wave, Math.max(1, room.players.size));
  world.bossesToSpawn = world.currentWavePlan.bossCount;
  world.miniBossesToSpawn = world.currentWavePlan.miniBossCount;
  world.escortsToSpawn = world.currentWavePlan.enemyCount;
  world.totalZombiesInWave = world.bossesToSpawn + world.miniBossesToSpawn + world.escortsToSpawn;
  world.nextSpawnAt = nowMs() + 250;
  world.nextWaveAt = 0;
  world.preparationActive = false;
  world.preparationEvent = null;
  world.domainEvent = null;
  world.supplyDrop = null;
  world.trader = null;
  world.techTier = Math.max(world.techTier, Math.min(4, 1 + Math.floor(world.wave / 10)));
}

function startBossPreparation(room, seconds = 35) {
  const world = room.latestWorld;
  const eventType = Math.random() < 0.5 ? 'supply' : 'trader';
  world.preparationActive = true;
  world.preparationEvent = eventType;
  world.preparationEndsAt = nowMs() + seconds * 1000;
  world.waveActive = false;
  world.zombies = [];
  world.bullets = [];
  if (eventType === 'supply') {
    const waveScale = 1 + world.wave * 0.08;
    world.supplyDrop = {
      x: 760,
      y: 930,
      interactionRadius: 72,
      collected: false,
      rewards: {
        money: Math.floor(65 * waveScale),
        wood: Math.ceil(12 * waveScale),
        metal: Math.ceil(9 * waveScale),
        ammo: Math.ceil(70 * waveScale)
      }
    };
    world.trader = null;
  } else {
    world.supplyDrop = null;
    const ammoDeals = GameContent.ammoPacks
      .map((pack) => pack.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.random() < 0.55 ? 2 : 3);
    world.trader = {
      id: `trader-wave-${world.wave + 1}`,
      x: 760,
      y: 790,
      interactionRadius: 78,
      ammoDeals,
      stock: { wood: 3, metal: 3, ammo: 3, repairs: 2, parts: 1, small: 2, medium: 2, large: 1, full: 1 }
    };
  }
}

function spawnZombie(room) {
  const world = room.latestWorld;
  const activePlayers = [...room.players.values()].filter((player) =>
    Number.isFinite(player.x) && Number.isFinite(player.y) && !player.downed && nowMs() - player.lastSeen < 5000);
  const anchor = activePlayers[Math.floor(Math.random() * activePlayers.length)] || { x: 1100, y: 720 };
  const spawnPoint = findSafeZombieSpawn(world, anchor, 34);
  const spawnX = spawnPoint.x;
  const spawnY = spawnPoint.y;
  let typeKey;
  if (world.bossesToSpawn > 0) {
    const pool = bossPool(world.wave);
    typeKey = pool[Math.floor(Math.random() * pool.length)];
    world.bossesToSpawn -= 1;
  } else if (world.miniBossesToSpawn > 0) {
    typeKey = 'miniBoss';
    world.miniBossesToSpawn -= 1;
  } else {
    const pool = enemyPool(world.wave);
    typeKey = pool[Math.floor(Math.random() * pool.length)];
  }
  const type = enemyTypes[typeKey] || enemyTypes.normal;
  const plan = world.currentWavePlan || wavePlan(world.wave, Math.max(1, room.players.size));
  const eliteScale = (type.isBoss || type.isMiniBoss) ? 1 + world.wave * 0.015 : 1;
  const partyScale = bossPartyHealthScale(Math.max(1, room.players.size), type);
  const health = Math.floor(type.health * plan.healthScale * eliteScale * partyScale);
  const shieldHealth = type.shieldHealth ? Math.floor(type.shieldHealth * plan.healthScale * partyScale) : 0;
  world.zombies.push({
    ...type,
    type: typeKey,
    id: `z-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: spawnX,
    y: spawnY,
    speed: type.speed * Math.min(1.25, 1 + world.wave * 0.004),
    health,
    maxHealth: health,
    shieldHealth,
    maxShieldHealth: shieldHealth,
    reward: Math.floor((type.reward || 10) * plan.rewardScale),
    xp: Math.floor((type.xp || type.reward || 10) * Math.sqrt(plan.rewardScale)),
    damageScale: plan.damageScale,
    lastShot: 0,
    lastSlam: 0,
    lastMelee: 0,
    lastHeal: 0,
    lastWeld: 0
  });
}

function zombieSpawnBlocked(world, x, y, radius) {
  const fixedBlockers = [SHOP_RECT, WORKBENCH_RECT];
  return fixedBlockers.some((blocker) => rectBlocked(x, y, radius + 20, blocker))
    || (world.mapStructures || []).some((structure) => rectBlocked(x, y, radius + 18, structure))
    || (world.buildings || []).some((building) => rectBlocked(x, y, radius + 16, building));
}

function findSafeZombieSpawn(world, anchor, radius) {
  for (let attempt = 0; attempt < 36; attempt += 1) {
    const angle = Math.random() * Math.PI * 2;
    const range = 620 + Math.random() * 300;
    const point = { x: anchor.x + Math.cos(angle) * range, y: anchor.y + Math.sin(angle) * range };
    if (!zombieSpawnBlocked(world, point.x, point.y, radius)) return point;
  }
  for (const range of [700, 850, 1000, 1150]) {
    for (let step = 0; step < 32; step += 1) {
      const angle = (step / 32) * Math.PI * 2;
      const point = { x: anchor.x + Math.cos(angle) * range, y: anchor.y + Math.sin(angle) * range };
      if (!zombieSpawnBlocked(world, point.x, point.y, radius)) return point;
    }
  }
  let fallback = { x: anchor.x + 1200, y: anchor.y };
  for (let step = 0; step < 200 && zombieSpawnBlocked(world, fallback.x, fallback.y, radius); step += 1) {
    fallback = { x: fallback.x + 120, y: anchor.y + ((step % 5) - 2) * 90 };
  }
  return fallback;
}

function getZombieDetour(world, zombie, target, now) {
  if (now < (zombie.nextPathAt || 0)) {
    if (zombie.detourUntil > now && Number.isFinite(zombie.detourX) && Number.isFinite(zombie.detourY)
      && distance(zombie.x, zombie.y, zombie.detourX, zombie.detourY) > 28) {
      return { ...target, x: zombie.detourX, y: zombie.detourY, distance: distance(zombie.x, zombie.y, zombie.detourX, zombie.detourY) };
    }
    return target;
  }
  const stagger = String(zombie.id || '').charCodeAt(String(zombie.id || '').length - 1) % 220;
  zombie.nextPathAt = now + PATH_UPDATE_MS + stagger;
  const probe = WorldMap.approachPoint(
    zombie.x,
    zombie.y,
    target.x,
    target.y,
    zombie.size + (target.radius || 12) + 18
  );
  const obstacle = (world.mapStructures || []).find((structure) =>
    !WorldMap.pointInside(structure, zombie.x, zombie.y, 2)
    && WorldMap.segmentHitsStructure(structure, zombie.x, zombie.y, probe.x, probe.y, zombie.size + 4));
  if (!obstacle) {
    zombie.detourUntil = 0;
    zombie.detourObstacleId = null;
    return target;
  }
  if (zombie.detourObstacleId === obstacle.id && zombie.detourUntil > now
    && Number.isFinite(zombie.detourX) && Number.isFinite(zombie.detourY)) {
    if (distance(zombie.x, zombie.y, zombie.detourX, zombie.detourY) > 28) {
      return { ...target, x: zombie.detourX, y: zombie.detourY, distance: distance(zombie.x, zombie.y, zombie.detourX, zombie.detourY) };
    }
  }
  zombie.detourUntil = 0;
  const padding = zombie.size + 34;
  const halfW = obstacle.width / 2 + padding;
  const halfH = obstacle.height / 2 + padding;
  const corners = [
    { x: obstacle.x - halfW, y: obstacle.y - halfH },
    { x: obstacle.x + halfW, y: obstacle.y - halfH },
    { x: obstacle.x - halfW, y: obstacle.y + halfH },
    { x: obstacle.x + halfW, y: obstacle.y + halfH }
  ].filter((point) => !(world.mapStructures || []).some((structure) => rectBlocked(point.x, point.y, zombie.size + 8, structure)));
  if (!corners.length) return target;
  corners.sort((a, b) =>
    distance(zombie.x, zombie.y, a.x, a.y) + distance(a.x, a.y, target.x, target.y)
    - distance(zombie.x, zombie.y, b.x, b.y) - distance(b.x, b.y, target.x, target.y));
  zombie.detourX = corners[0].x;
  zombie.detourY = corners[0].y;
  zombie.detourObstacleId = obstacle.id;
  zombie.detourUntil = now + 2600;
  return { ...target, ...corners[0], distance: distance(zombie.x, zombie.y, corners[0].x, corners[0].y) };
}

function targetEntityId(entity) {
  return String(entity.id || entity.networkId || '');
}

function buildTargetContext(room, now) {
  const world = room.latestWorld;
  const players = [];
  const playersById = new Map();
  for (const player of room.players.values()) {
    if (now - player.lastSeen >= 5000 || player.downed || (player.health ?? 100) <= 0) continue;
    const target = {
      entity: player,
      x: player.x,
      y: player.y,
      radius: 12,
      kind: 'player',
      shelter: (world.mapStructures || []).find((entry) => WorldMap.pointInside(entry, player.x, player.y, 2)) || null
    };
    players.push(target);
    playersById.set(player.id, target);
  }
  const structures = [];
  const structuresById = new Map();
  const addStructure = (entity, radius) => {
    if ((entity.health ?? 1) <= 0) return;
    const target = { entity, x: entity.x, y: entity.y, radius, kind: 'structure' };
    structures.push(target);
    structuresById.set(targetEntityId(entity), target);
  };
  for (const wall of world.walls) addStructure(wall, wall.radius || 25);
  for (const sentry of world.sentries) addStructure(sentry, sentry.radius || 15);
  for (const building of world.buildings) addStructure(building, Math.max(building.width || 0, building.height || 0) / 2);
  return { players, playersById, structures, structuresById };
}

function getTargets(zombie, context, now, includeStructures = true) {
  const cached = zombie.targetKind === 'player'
    ? context.playersById.get(zombie.targetId)
    : context.structuresById.get(zombie.targetId);
  if (cached && now < (zombie.nextTargetAt || 0)) {
    cached.x = cached.entity.x;
    cached.y = cached.entity.y;
    return { ...cached, distance: distance(zombie.x, zombie.y, cached.x, cached.y) };
  }

  const structureTargets = includeStructures ? context.structures : [];
  const candidateGroups = zombie.isSapper && structureTargets.length
    ? [structureTargets]
    : [context.players, structureTargets];
  let nearest = null;
  let nearestDistanceSquared = Infinity;
  for (const candidates of candidateGroups) {
    for (const candidate of candidates) {
      const dx = zombie.x - candidate.entity.x;
      const dy = zombie.y - candidate.entity.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared >= nearestDistanceSquared) continue;
      nearest = candidate;
      nearestDistanceSquared = distanceSquared;
    }
  }
  if (!nearest) return null;
  zombie.targetId = targetEntityId(nearest.entity);
  zombie.targetKind = nearest.kind;
  const stagger = String(zombie.id || '').charCodeAt(String(zombie.id || '').length - 1) % 140;
  zombie.nextTargetAt = now + TARGET_UPDATE_MS + stagger;
  return { ...nearest, x: nearest.entity.x, y: nearest.entity.y, distance: Math.sqrt(nearestDistanceSquared) };
}

function damagePlayer(player, amount, now = nowMs()) {
  if (!player || player.downed || player.eliminated) return;
  if (now < (player.invulnerableUntil || 0)) return;
  const scaled = amount * (Number.isFinite(player.armorMultiplier) ? player.armorMultiplier : 1);
  const currentHealth = Number.isFinite(Number(player.health)) ? Number(player.health) : 100;
  player.health = Math.max(0, currentHealth - scaled);
}

function healPlayer(player, amount) {
  if (!player || player.downed || player.eliminated || !(amount > 0)) return 0;
  const maxHealth = Number.isFinite(Number(player.maxHealth)) ? Number(player.maxHealth) : 100;
  const currentHealth = Number.isFinite(Number(player.health)) ? Number(player.health) : 0;
  player.health = Math.min(maxHealth, currentHealth + amount);
  return player.health - currentHealth;
}

function damageZombie(zombie, amount) {
  if (zombie.weakSpotUntil && nowMs() < zombie.weakSpotUntil) amount *= 1.35;
  let remaining = amount;
  if (zombie.shieldHealth > 0) {
    const absorbed = Math.min(zombie.shieldHealth, remaining);
    zombie.shieldHealth -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) zombie.health -= remaining * (1 - (zombie.armor || 0));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function xpToNext(level) {
  return Math.floor(80 + Math.pow(level, 1.32) * 45);
}

function initialWeapons() {
  return GameContent.weaponTypes.map((weapon, index) => ({
    id: weapon.id,
    owned: index === 0,
    upgradeLevel: 0,
    currentAmmo: index === 0 ? weapon.maxAmmo : 0
  }));
}

function weaponMaxAmmo(weaponId, level = 0, deepPockets = 0) {
  const definition = WEAPON_DEFINITIONS.get(weaponId);
  if (!definition) return 0;
  let maxAmmo = definition.maxAmmo;
  for (let index = 0; index < clamp(Math.floor(level), 0, 5); index += 1) {
    maxAmmo += Math.max(1, Math.ceil(maxAmmo * 0.12));
  }
  for (let index = 0; index < Math.max(0, Math.floor(deepPockets)); index += 1) {
    maxAmmo += Math.max(1, Math.floor(maxAmmo * 0.2));
  }
  return maxAmmo;
}

function initializePlayerProgression(player, skinId) {
  if (player.progressionInitialized) return player;
  const skin = GameContent.skins.find((entry) => entry.id === skinId) || GameContent.skins[0];
  const starterWood = skin?.perk?.type === 'starterPack' ? 5 : 0;
  const starterMetal = skin?.perk?.type === 'starterPack' ? 5 : 0;
  const starterCash = skin?.perk?.type === 'cash' ? 40 : 0;
  Object.assign(player, {
    progressionInitialized: true,
    money: starterCash,
    wood: 12 + starterWood,
    metal: 8 + starterMetal,
    reserveAmmo: 60,
    rareTurretParts: 0,
    xp: 0,
    xpToNext: xpToNext(1),
    level: 1,
    skillPoints: 0,
    skillLevels: { ...EMPTY_SKILLS },
    runUpgradeCounts: {},
    upgrades: { autoLoot: false, autoRefill: false, turretSpeed: false },
    milestoneUpgradeCredits: 0,
    lifePurchases: 0,
    weapons: initialWeapons(),
    potionExpiries: {},
    nextEmergencyReloadAt: 0
  });
  return player;
}

function playerSkinPerk(player, type) {
  const skin = GameContent.skins.find((entry) => entry.id === player.skinId);
  return skin?.perk?.type === type;
}

function refreshPlayerDerivedStats(player, options = {}) {
  initializePlayerProgression(player, player.skinId || 'shopper');
  const previousMax = Number.isFinite(Number(player.maxHealth)) ? Number(player.maxHealth) : 100;
  const skills = player.skillLevels || EMPTY_SKILLS;
  const upgrades = player.runUpgradeCounts || {};
  const maxHealth = 100 + (skills.maxHealth || 0) * 20 + (upgrades.vitality || 0) * 25;
  player.baseMaxHealth = maxHealth;
  player.maxHealth = maxHealth;
  if (options.healIncrease && maxHealth > previousMax) {
    const currentHealth = Number.isFinite(Number(player.health)) ? Number(player.health) : previousMax;
    player.health = Math.min(maxHealth, currentHealth + maxHealth - previousMax);
  } else {
    const currentHealth = Number.isFinite(Number(player.health)) ? Number(player.health) : maxHealth;
    player.health = clamp(currentHealth, 0, maxHealth);
  }
  const now = nowMs();
  const potions = player.potionExpiries || {};
  player.damageMultiplier = 1 + (skills.bulletDamage || 0) * 0.1 + (upgrades.caliber || 0) * 0.12
    + (playerSkinPerk(player, 'bossDamage') ? 0.03 : 0);
  player.fireRateMultiplier = Math.pow(0.9, upgrades.rapidFire || 0) * (potions.fireRate > now ? 0.5 : 1);
  player.armorMultiplier = 1 - (potions.armor > now ? 0.35 : 0) - (playerSkinPerk(player, 'acidGuard') ? 0.04 : 0);
  player.critChance = potions.crit > now ? 0.18 : 0;
  player.lifesteal = potions.lifesteal > now;
  player.pickupRadius = (player.upgrades?.autoLoot ? 300 : 30) + (skills.pickupRange || 0) * 25;
  player.moveSpeedMultiplier = Math.pow(1.05, skills.moveSpeed || 0) * (playerSkinPerk(player, 'moveSpeed') ? 1.03 : 1);
  player.reloadSpeedMultiplier = Math.pow(0.92, skills.reloadSpeed || 0);
  player.resourceMultiplier = 1 + (skills.resourceMultiplier || 0) * 0.1 + (upgrades.salvage || 0) * 0.15
    + (potions.resource > now ? 0.75 : 0) + (potions.loot > now ? 1 : 0)
    + (playerSkinPerk(player, 'cashMultiplier') ? 0.03 : 0);
  return player;
}

function canAffordPlayer(player, cost = {}) {
  return (!cost.money || player.money >= cost.money)
    && (!cost.wood || player.wood >= cost.wood)
    && (!cost.metal || player.metal >= cost.metal)
    && (!cost.parts || player.rareTurretParts >= cost.parts);
}

function spendPlayerCost(player, cost = {}) {
  if (!canAffordPlayer(player, cost)) return false;
  player.money -= cost.money || 0;
  player.wood -= cost.wood || 0;
  player.metal -= cost.metal || 0;
  player.rareTurretParts -= cost.parts || 0;
  return true;
}

function grantPlayerResources(player, resources = {}, useMultiplier = false) {
  const multiplier = useMultiplier ? Math.max(1, Number(player.resourceMultiplier) || 1) : 1;
  if (resources.money) player.money += Math.max(0, Math.floor(resources.money * multiplier));
  if (resources.wood) player.wood += Math.max(0, Math.round(resources.wood * multiplier));
  if (resources.metal) player.metal += Math.max(0, Math.round(resources.metal * multiplier));
  if (resources.ammo) player.reserveAmmo += Math.max(0, Math.floor(resources.ammo));
  if (resources.parts) player.rareTurretParts += Math.max(0, Math.floor(resources.parts));
}

function grantPlayerXp(player, amount) {
  player.xp += Math.max(0, Math.floor(amount || 0));
  let levels = 0;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.skillPoints += 1;
    player.xpToNext = xpToNext(player.level);
    levels += 1;
  }
  if (levels) {
    healPlayer(player, levels * 15);
    refreshPlayerDerivedStats(player);
  }
  return levels;
}

function sanitizePlayerState(previous, incoming, id, now) {
  const requestedX = Number(incoming.x);
  const requestedY = Number(incoming.y);
  let x = Number.isFinite(requestedX) ? requestedX : (Number(previous.x) || 1100);
  let y = Number.isFinite(requestedY) ? requestedY : (Number(previous.y) || 720);
  const seq = Math.floor(Number(incoming.seq));
  if (Number.isFinite(previous.seq) && Number.isFinite(seq) && seq <= previous.seq) {
    // Out-of-order or duplicate packet: keep the newer position.
    x = previous.x;
    y = previous.y;
  }
  if (Number.isFinite(previous.x) && Number.isFinite(previous.y)) {
    const elapsed = Math.max(16, Math.min(500, now - (previous.lastSeen || now - 50)));
    const maxTravel = 30 + elapsed * 0.9;
    const travel = distance(previous.x, previous.y, x, y);
    if (travel > maxTravel) {
      const scale = maxTravel / travel;
      x = previous.x + (x - previous.x) * scale;
      y = previous.y + (y - previous.y) * scale;
    }
    if (previous.downed) {
      x = previous.x;
      y = previous.y;
    }
  }
  const upgrades = {
    autoRefill: Boolean(previous.upgrades?.autoRefill),
    turretSpeed: Boolean(previous.upgrades?.turretSpeed),
    autoLoot: Boolean(previous.upgrades?.autoLoot)
  };
  const player = {
    ...previous,
    id,
    seq: Number.isFinite(seq) ? Math.max(seq, previous.seq || 0) : (previous.seq || 0),
    upgrades,
    wave: clamp(Math.floor(Number(incoming.wave ?? previous.wave) || 0), 0, 9999),
    name: String(incoming.name ?? previous.name ?? 'Shopper').slice(0, 24),
    skinId: String(incoming.skinId ?? previous.skinId ?? 'shopper').slice(0, 32),
    x,
    y,
    angle: Number.isFinite(Number(incoming.angle)) ? Number(incoming.angle) : (previous.angle || 0),
    health: previous.health ?? 100,
    downed: Boolean(previous.downed),
    downedAt: previous.downedAt || 0,
    respawnAt: previous.respawnAt || 0,
    giveUpAt: previous.giveUpAt || 0,
    reviveProgress: previous.reviveProgress || 0,
    reviverId: previous.reviverId || null,
    lastReviveTick: previous.lastReviveTick || 0,
    invulnerableUntil: previous.invulnerableUntil || 0,
    emergencyRespawns: previous.emergencyRespawns || 0,
    lifePurchases: Math.max(0, Math.floor(Number(previous.lifePurchases) || 0)),
    eliminated: Boolean(previous.eliminated),
    disconnectedAt: 0,
    lastSeen: now
  };
  initializePlayerProgression(player, player.skinId);
  refreshPlayerDerivedStats(player);
  return player;
}

function spawnBossMinion(world, typeKey, x, y, scale = 0.75) {
  const type = enemyTypes[typeKey] || enemyTypes.normal;
  const health = Math.max(35, Math.floor(type.health * scale));
  world.zombies.push({
    ...type,
    type: typeKey,
    id: `z-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    x: x + Math.random() * 70 - 35,
    y: y + Math.random() * 70 - 35,
    health,
    maxHealth: health,
    reward: Math.max(4, Math.floor((type.reward || 8) * 0.35)),
    xp: Math.max(4, Math.floor((type.xp || type.reward || 8) * 0.35)),
    damageScale: world.currentWavePlan?.damageScale || 1,
    lastShot: 0,
    lastSlam: 0,
    lastMelee: 0,
    lastHeal: 0,
    lastWeld: 0
  });
}

function startDomainEvent(room, warden, target, now) {
  const world = room.latestWorld;
  if (world.domainEvent || !target || target.kind !== 'player') return false;
  world.domainEvent = {
    id: `domain-${now}-${Math.random().toString(36).slice(2, 6)}`,
    casterId: warden.id,
    targetPlayerId: target.entity.id,
    x: target.x,
    y: target.y,
    radius: 260,
    startedAt: now,
    endsAt: now + 12000,
    nextSpawnAt: now + 650,
    spawned: 0,
    maxSpawns: 6
  };
  warden.domainCastUsed = true;
  warden.domainCastingUntil = now + 1200;
  return true;
}

function updateDomainEvent(room, now) {
  const world = room.latestWorld;
  const event = world.domainEvent;
  if (!event) return;
  if (now >= event.endsAt) {
    world.domainEvent = null;
    return;
  }
  if (event.spawned >= event.maxSpawns || now < event.nextSpawnAt) return;
  const angle = (event.spawned / event.maxSpawns) * Math.PI * 2 + Math.random() * 0.35;
  const range = event.radius * (0.62 + Math.random() * 0.18);
  const type = event.spawned >= 4 ? 'runner' : (Math.random() < 0.35 ? 'spitter' : 'normal');
  spawnBossMinion(world, type, event.x + Math.cos(angle) * range, event.y + Math.sin(angle) * range, 0.72);
  event.spawned += 1;
  event.nextSpawnAt = now + 1150;
  world.totalZombiesInWave += 1;
}

function runBossMechanics(room, z, target, dt, now) {
  if (!z.isBoss || !target) return false;
  const world = room.latestWorld;
  if (z.stunnedUntil && now < z.stunnedUntil) return true;

  if (z.bossKind === 'burrow') {
    if (z.hidden) {
      if (now >= z.emergeAt) {
        z.x = z.emergeX;
        z.y = z.emergeY;
        z.hidden = false;
        z.burrowWarning = null;
        z.lastBurrow = now;
        for (let i = 0; i < 3; i++) spawnBossMinion(world, i === 0 ? 'runner' : 'normal', z.x, z.y, 0.65);
      }
      return true;
    }
    if (now - (z.lastBurrow || 0) > (z.burrowRate || 5600) && target.distance > 140) {
      const angle = Math.random() * Math.PI * 2;
      z.emergeX = target.x + Math.cos(angle) * (70 + Math.random() * 55);
      z.emergeY = target.y + Math.sin(angle) * (70 + Math.random() * 55);
      z.emergeAt = now + 1150;
      z.hidden = true;
      z.burrowWarning = { x: z.emergeX, y: z.emergeY, until: z.emergeAt };
      return true;
    }
    if (now - (z.lastSpawn || 0) > (z.spawnRate || 4200)) {
      z.lastSpawn = now;
      spawnBossMinion(world, Math.random() < 0.5 ? 'runner' : 'normal', z.x, z.y, 0.7);
    }
  }

  if (z.bossKind === 'chargerBrute') {
    if (z.chargeWindupUntil && now < z.chargeWindupUntil) return true;
    if (z.chargeWindupUntil && now >= z.chargeWindupUntil) {
      z.chargeWindupUntil = 0;
      z.chargeUntil = now + (z.chargeDuration || 800);
      z.warningLine = null;
    }
    if (z.chargeUntil && now < z.chargeUntil) {
      const speed = (z.chargeSpeed || 5) * (dt / 16.67);
      z.x += Math.cos(z.chargeAngle || 0) * speed;
      z.y += Math.sin(z.chargeAngle || 0) * speed;
      for (const wall of world.walls) {
        if (distance(z.x, z.y, wall.x, wall.y) < z.size + (wall.radius || 25)) {
          if ((wall.wallStage || 0) < 2) {
            wall.health = 0;
          } else {
            z.stunnedUntil = now + 1500;
            z.chargeUntil = 0;
          }
          break;
        }
      }
      return true;
    }
    if (z.chargeUntil && now >= z.chargeUntil) z.chargeUntil = 0;
    if (target.distance < 520 && now - (z.lastCharge || 0) > (z.chargeRate || 4600)) {
      z.lastCharge = now;
      z.chargeAngle = Math.atan2(target.y - z.y, target.x - z.x);
      z.chargeWindupUntil = now + (z.warningDuration || 720);
      z.warningLine = { x1: z.x, y1: z.y, x2: target.x, y2: target.y, until: z.chargeWindupUntil };
      return true;
    }
  }

  if (z.bossKind === 'tesla') {
    if (z.empChargeUntil) {
      if (now >= z.empChargeUntil) {
        z.empChargeUntil = 0;
        z.empPulseUntil = now + 650;
        for (const sentry of world.sentries) {
          if (distance(z.x, z.y, sentry.x, sentry.y) < (z.empRadius || 240)) sentry.isDisabled = now + 5200;
        }
        for (let i = 0; i < 2; i++) spawnBossMinion(world, 'disruptor', z.x, z.y, 0.68);
      }
      return true;
    }
    if (z.empPulseUntil && now >= z.empPulseUntil) z.empPulseUntil = 0;
    if (now - (z.lastEmp || 0) > (z.empRate || 6400)) {
      z.lastEmp = now;
      z.empChargeUntil = now + (z.empWindup || 1100);
      return true;
    }
    if (now - (z.lastSpawn || 0) > (z.spawnRate || 7600)) {
      z.lastSpawn = now;
      spawnBossMinion(world, 'disruptor', z.x, z.y, 0.65);
    }
  }

  if (z.bossKind === 'brood' && now - (z.lastSpawn || 0) > (z.spawnRate || 2900)) {
    z.lastSpawn = now;
    z.weakSpotUntil = now + (z.weakSpotDuration || 950);
    for (let i = 0; i < 2; i++) spawnBossMinion(world, Math.random() < 0.5 ? 'runner' : 'splitter', z.x, z.y, 0.55);
  }

  if (z.bossKind === 'toxic' && now - (z.lastPuddle || 0) > (z.puddleRate || 1200)) {
    z.lastPuddle = now;
    world.acidPools.push({ id: `ap-${nextAcidPoolId++}`, x: z.x, y: z.y, radius: 42, life: 260, damage: 0.55, toxicBoss: true });
  }

  return false;
}

function tryBossDodge(world, z, bullet, now) {
  if (!z.isBoss || !bullet.explosive || bullet.fromZombie) return false;
  const projectileSpeed = Math.sqrt((bullet.vx || 0) ** 2 + (bullet.vy || 0) ** 2);
  const d = distance(bullet.x, bullet.y, z.x, z.y);
  if (projectileSpeed > 7 || d < z.size + 26 || d > 165 || now - (z.lastDodge || 0) < 4200) return false;
  z.lastDodge = now;
  z.dodgeUntil = now + 360;
  const sign = Math.random() < 0.5 ? -1 : 1;
  const angle = Math.atan2(bullet.vy || 0, bullet.vx || 1) + Math.PI / 2 * sign;
  z.x += Math.cos(angle) * 76;
  z.y += Math.sin(angle) * 76;
  return true;
}

function pushBullet(world, x, y, angle, speed, damage, options = {}) {
  const bullet = {
    id: `b-${nextBulletId++}`,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    size: options.size || 4,
    explosive: options.explosive,
    fromZombie: options.fromZombie,
    fromTurret: options.fromTurret,
    spitter: options.spitter,
    acid: options.acid,
    ownerId: options.ownerId,
    shotId: options.shotId,
    pelletIndex: options.pelletIndex,
    weaponId: options.weaponId,
    pierce: Math.max(0, Math.floor(options.pierce || 0)),
    life: options.life || 240,
    hitIds: []
  };
  world.bullets.push(bullet);
  return bullet;
}

function spawnRemoteShot(room, player, weapon) {
  const world = room.latestWorld;
  const shooter = room.players.get(player.id);
  const type = weaponTypes[weapon.id];
  const ownedWeapon = shooter?.weapons?.find((entry) => entry.id === weapon.id && entry.owned);
  const shotId = cleanId(weapon.shotId, 80) || `${player.id}:server:${nextEventId}`;
  const reject = (reason) => {
    queueEvent(room, { kind: 'shotRejected', shotId, shooterId: player.id, reason }, player.id);
    if (PERF_DEBUG) console.debug(`[shot:${shotId}] rejected: ${reason}`);
    return false;
  };
  if (!shooter || !type || !ownedWeapon || !world.waveActive || world.wave < (type.requiredWave || 0)) {
    return reject('Shot was not valid for the current player or wave.');
  }
  const now = nowMs();
  const maxAmmo = weaponMaxAmmo(weapon.id, ownedWeapon.upgradeLevel, shooter.runUpgradeCounts?.deepPockets || 0);
  if (!Number.isFinite(ownedWeapon.currentAmmo)) ownedWeapon.currentAmmo = maxAmmo;
  const infiniteAmmo = (shooter.potionExpiries?.infiniteAmmo || 0) > now;
  if (!infiniteAmmo && ownedWeapon.currentAmmo <= 0) return reject('Magazine is empty.');
  for (const [id, acceptedAt] of room.acceptedShotIds) {
    if (now - acceptedAt > 10000) room.acceptedShotIds.delete(id);
  }
  if (room.acceptedShotIds.has(shotId)) return false;
  const level = clamp(Math.floor(Number(ownedWeapon.upgradeLevel) || 0), 0, 5);
  const fireRateMultiplier = clamp(Number(shooter.fireRateMultiplier) || 1, 0.25, 1);
  const cooldown = type.fireRate * Math.pow(0.92, level) * fireRateMultiplier;
  const cooldownKey = `${player.id}:${weapon.id}`;
  // The client is the real rate limiter; only reject clearly impossible bursts (frame timing makes legit shots jittery).
  const gate = room.weaponCooldowns.get(cooldownKey) || { last: 0, windowStart: now, count: 0 };
  if (now - gate.last < cooldown * 0.55) return reject('Shot arrived faster than the weapon cooldown.');
  if (now - gate.windowStart > 1000) {
    gate.windowStart = now;
    gate.count = 0;
  }
  if (gate.count >= Math.ceil(1000 / cooldown) * 1.35 + 2) return reject('Shot rate exceeded the allowed burst window.');
  gate.count += 1;
  gate.last = now;
  room.weaponCooldowns.set(cooldownKey, gate);
  room.acceptedShotIds.set(shotId, now);
  if (!infiniteAmmo) ownedWeapon.currentAmmo = Math.max(0, ownedWeapon.currentAmmo - 1);
  const requestedAngle = Number(weapon.angle);
  const angle = Number.isFinite(requestedAngle) ? requestedAngle : (Number.isFinite(shooter.angle) ? shooter.angle : 0);
  const originX = shooter.x + Math.cos(angle) * 15;
  const originY = shooter.y + Math.sin(angle) * 15;
  const pellets = type.pellets || 0;
  let damage = type.damage * Math.pow(1.18, level) * clamp(Number(shooter.damageMultiplier) || 1, 1, 4);
  if (Math.random() < clamp(Number(shooter.critChance) || 0, 0, 0.5)) damage *= 2;
  const fireOne = (spread, pelletIndex) => pushBullet(world, originX, originY, angle + spread, type.speed, damage, {
    explosive: type.explosive,
    pierce: type.pierce,
    size: type.bulletSize || 4,
    ownerId: player.id,
    shotId,
    pelletIndex,
    weaponId: weapon.id
  });
  if (pellets) {
    for (let i = 0; i < pellets; i++) fireOne((Math.random() - 0.5) * 0.4, i);
  } else {
    fireOne(0, 0);
  }
  if (PERF_DEBUG) console.debug(`[shot:${shotId}] accepted with ${pellets || 1} projectile(s)`);
  queueEvent(room, {
    kind: 'shot',
    shotId,
    shooterId: player.id,
    weaponId: weapon.id,
    x: round1(originX),
    y: round1(originY),
    angle: round2(angle),
    speed: type.speed,
    pellets,
    bulletSize: type.bulletSize || 4,
    explosive: Boolean(type.explosive),
    clientShotTime: Number.isFinite(Number(weapon.clientShotTime)) ? Number(weapon.clientShotTime) : null
  });
  return true;
}

function getShelterBreachPlan(world, zombie, target) {
  if (!target || target.kind !== 'player') return null;
  const structure = target.shelter || null;
  if (!structure || WorldMap.pointInside(structure, zombie.x, zombie.y, -zombie.size)) return null;

  const entries = [{
    id: `${structure.id}:door`,
    kind: 'door',
    entity: structure.door,
    width: structure.door.width,
    ...WorldMap.doorPoint(structure)
  }, ...WorldMap.windowPoints(structure).map((entry) => ({
    id: entry.id,
    kind: 'window',
    entity: structure.windows.find((candidate) => candidate.id === entry.id),
    width: entry.width,
    x: entry.x,
    y: entry.y
  }))];
  const usableEntries = entries.filter((entry) => (entry.width || 0) >= zombie.size * 2 + 12);
  const choicesBySize = usableEntries.length ? usableEntries : entries;
  const passable = choicesBySize.filter((entry) => entry.kind === 'door'
    ? entry.entity.open || entry.entity.destroyed
    : entry.entity.breached);
  const sealed = choicesBySize.filter((entry) => !passable.includes(entry));
  let entry = choicesBySize.find((candidate) => candidate.id === zombie.breachTargetId);
  if (!entry) {
    const preferWindow = zombie.isFlanker || zombie.type === 'runner' || zombie.type === 'fast'
      || String(zombie.id || '').charCodeAt(String(zombie.id || '').length - 1) % 3 === 0;
    const preferred = preferWindow ? sealed.filter((candidate) => candidate.kind === 'window') : [];
    const choices = preferred.length ? preferred : (passable.length ? passable : sealed);
    entry = choices.reduce((nearest, candidate) => {
      const candidateDistance = distance(zombie.x, zombie.y, candidate.x, candidate.y);
      return !nearest || candidateDistance < nearest.distance
        ? { ...candidate, distance: candidateDistance }
        : nearest;
    }, null);
    if (entry) zombie.breachTargetId = entry.id;
  }
  if (!entry) return null;
  return {
    structure,
    entry,
    distance: distance(zombie.x, zombie.y, entry.x, entry.y),
    passable: entry.kind === 'door'
      ? Boolean(entry.entity.open || entry.entity.destroyed)
      : Boolean(entry.entity.breached)
  };
}

function damageShelterEntry(world, zombie, breachPlan, now) {
  if (!breachPlan || breachPlan.passable) return false;
  if (breachPlan.distance > zombie.size + 24) return false;
  const entry = breachPlan.entry.entity;
  if (zombie.isBomber) {
    entry.health -= zombie.explosionDamage || 180;
    zombie.health = 0;
  } else if (now - (zombie.lastBreachHit || 0) >= (zombie.attackRate || 650)) {
    zombie.lastBreachHit = now;
    const bossScale = zombie.isBoss || zombie.isMiniBoss ? 2.4 : 1;
    entry.health -= Math.max(12, (zombie.contactDamage || 8) * 1.45) * (zombie.damageScale || 1) * bossScale;
  } else {
    return true;
  }
  bumpStructureState(world, breachPlan.structure);
  if (entry.health <= 0) {
    entry.health = 0;
    if (breachPlan.entry.kind === 'door') {
      entry.destroyed = true;
      entry.open = true;
    } else {
      entry.breached = true;
    }
    zombie.breachTargetId = null;
  }
  return true;
}

function updateZombies(room, dt) {
  const world = room.latestWorld;
  const now = nowMs();
  const targetContext = buildTargetContext(room, now);
  updateDomainEvent(room, now);
  for (const z of world.zombies) {
    if (z.isHealer && now - z.lastHeal > z.healRate) {
      z.lastHeal = now;
      const nearbyZombies = room.spatial.zombies.queryRadius(z.x, z.y, z.healRadius);
      for (const other of nearbyZombies) {
        if (other !== z && other.health < other.maxHealth && distance(z.x, z.y, other.x, other.y) < z.healRadius) {
          other.health = Math.min(other.maxHealth, other.health + z.healAmount);
          break;
        }
      }
    } else if (z.isDisruptor && now - (z.lastEmp || 0) > (z.empRate || 10000)) {
      z.lastEmp = now;
      z.empPulseUntil = now + 600;
      const radius = z.empRadius || 200;
      for (const sentry of room.spatial.sentries.queryRadius(z.x, z.y, radius)) {
        if (distance(z.x, z.y, sentry.x, sentry.y) < radius) sentry.isDisabled = now + 5000;
      }
    } else if (z.isEngineer && now - z.lastWeld > z.weldRate) {
      z.lastWeld = now;
      const nearbyZombies = room.spatial.zombies.queryRadius(z.x, z.y, z.weldRadius);
      for (const other of nearbyZombies) {
        if (other !== z && distance(z.x, z.y, other.x, other.y) < z.weldRadius) {
          other.maxShieldHealth = Math.max(other.maxShieldHealth || 0, 90);
          other.shieldHealth = Math.min(other.maxShieldHealth, (other.shieldHealth || 0) + 30);
          break;
        }
      }
    }
  }

  for (let i = world.zombies.length - 1; i >= 0; i--) {
    const z = world.zombies[i];
    const target = getTargets(z, targetContext, now, true);
    if (!target) continue;
    const targetDist = target.distance;
    const breachPlan = getShelterBreachPlan(world, z, target);
    let didAction = false;
    if (z.isDomainWarden && !z.domainCastUsed && !world.domainEvent && target.kind === 'player' && targetDist < (z.domainRange || 480)) {
      didAction = startDomainEvent(room, z, target, now);
    }
    if (z.domainCastingUntil && now < z.domainCastingUntil) didAction = true;
    if (runBossMechanics(room, z, target, dt, now)) didAction = true;
    if (z.hidden) continue;
    if (!breachPlan && (z.type === 'spitter' || z.type === 'boss' || z.type === 'miniBoss' || z.isAcidRanger || z.isBoss || z.isMiniBoss) && z.shootRange && targetDist < z.shootRange) {
      didAction = true;
      if (now - z.lastShot > z.shootRate) {
        z.lastShot = now;
        const angle = Math.atan2(target.y - z.y, target.x - z.x);
        pushBullet(world, z.x, z.y, angle, 6, 20 * (z.damageScale || 1), { fromZombie: true, spitter: true, size: 8 });
      }
    } else if (!breachPlan && z.type === 'thrower' && targetDist < z.throwRange) {
      didAction = true;
      if (now - z.lastShot > z.throwRate) {
        z.lastShot = now;
        const angle = Math.atan2(target.y - z.y, target.x - z.x);
        pushBullet(world, z.x, z.y, angle, 4, 30 * (z.damageScale || 1), { fromZombie: true, acid: true, size: 12 });
      }
    }

    if (!didAction) {
      const moveTarget = breachPlan
        ? { ...target, x: breachPlan.entry.x, y: breachPlan.entry.y, distance: breachPlan.distance }
        : getZombieDetour(world, z, target, now);
      if (damageShelterEntry(world, z, breachPlan, now)) didAction = true;
      if (z.isCharger && now - (z.lastCharge || 0) > z.chargeRate && targetDist < 330) {
        z.lastCharge = now;
        z.chargeUntil = now + z.chargeDuration;
      }
      const moveSpeed = (z.isCharger && now < (z.chargeUntil || 0) ? z.chargeSpeed : z.speed) * (dt / 16.67);
      if (didAction) {
        // Hold position while tearing down a sealed entrance.
      } else if (!breachPlan && targetDist <= z.size + target.radius) {
        if (z.isBomber) {
          if (target.kind === 'structure') target.entity.health -= z.explosionDamage;
          else damagePlayer(target.entity, z.explosionDamage * 0.35, now);
          z.health = 0;
        } else if (now - (z.lastMelee || 0) > (z.attackRate || 700)) {
          z.lastMelee = now;
          const amount = (z.contactDamage || 8) * (z.damageScale || 1);
          if (target.kind === 'structure') target.entity.health -= amount;
          else damagePlayer(target.entity, amount, now);
          if (z.isLeech) z.health = Math.min(z.maxHealth, z.health + (z.leechAmount || 6));
          if (target.entity.isElectric) {
            z.lastHitBy = target.entity.ownerId || z.lastHitBy || null;
            damageZombie(z, target.entity.shockDamage || 20);
          }
        }
      } else {
        const moveDistance = Math.max(1, moveTarget.distance);
        let moveX = (moveTarget.x - z.x) / moveDistance;
        let moveY = (moveTarget.y - z.y) / moveDistance;
        if (z.isFlanker && target.kind === 'player' && targetDist > 90) {
          const flankSign = z.flankSign || (z.flankSign = Math.random() < 0.5 ? -1 : 1);
          const baseX = moveX;
          const baseY = moveY;
          moveX += -baseY * 0.72 * flankSign;
          moveY += baseX * 0.72 * flankSign;
          const length = Math.hypot(moveX, moveY) || 1;
          moveX /= length;
          moveY /= length;
        }
        const previousX = z.x;
        const previousY = z.y;
        z.x += moveX * moveSpeed;
        z.y += moveY * moveSpeed;
        const nearbyMapStructures = room.spatial.mapStructures.queryRadius(z.x, z.y, WorldMap.CHUNK_SIZE);
        const isWallBlocked = () => nearbyMapStructures.some((structure) =>
          WorldMap.structureNearPoint(structure, z.x, z.y, z.size + 12) &&
          WorldMap.wallSegments(structure).some((wall) => rectBlocked(z.x, z.y, z.size, wall)));
        const hitBuildingWall = isWallBlocked();
        if (hitBuildingWall) {
          z.wallBlockedTicks = (z.wallBlockedTicks || 0) + 1;
          z.x = previousX;
          z.y = previousY;
          const turn = z.wallTurn || (z.wallTurn = Math.random() < 0.5 ? -1 : 1);
          z.x += -moveY * moveSpeed * turn;
          z.y += moveX * moveSpeed * turn;
          if (isWallBlocked()) {
            z.x = previousX;
            z.y = previousY;
            z.wallTurn *= -1;
          }
          if (z.wallBlockedTicks >= 3) z.detourUntil = 0;
        } else {
          z.wallTurn = 0;
          z.wallBlockedTicks = 0;
        }
      }
    }

    const nearbyTraps = room.spatial.traps.queryRadius(z.x, z.y, 100);
    for (const trap of nearbyTraps) {
      if (z.health <= 0) break;
      if (trap.consumed || (trap.usesRemaining || 0) <= 0) continue;
      if (now - (trap.lastTriggeredAt || 0) < (trap.triggerCooldown || 700)) continue;
      if (Math.abs(z.x - trap.x) <= trap.radius && Math.abs(z.y - trap.y) <= trap.radius) {
        trap.lastTriggeredAt = now;
        trap.usesRemaining = Math.max(0, (trap.usesRemaining || trap.maxUses || 10) - 1);
        z.lastHitBy = trap.ownerId || z.lastHitBy || null;
        damageZombie(z, trap.damage || 250);
        if (trap.usesRemaining <= 0) {
          trap.consumed = true;
          const trapIndex = world.traps.indexOf(trap);
          if (trapIndex >= 0) world.traps.splice(trapIndex, 1);
          room.structuresRevision += 1;
        }
      }
    }

    if (z.health <= 0) {
      world.zombiesKilled += 1;
      recordKillReward(room, z);
      if (z.isSplitter) spawnSplitChildren(world, z);
      if (z.isBoss) {
        for (let d = 0; d < 4; d++) dropLoot(world, z.x + Math.random() * 60 - 30, z.y + Math.random() * 60 - 30);
      } else if (z.isMiniBoss) {
        for (let d = 0; d < 2; d++) dropLoot(world, z.x + Math.random() * 45 - 22, z.y + Math.random() * 45 - 22);
      } else if (Math.random() < 0.3) {
        dropLoot(world, z.x, z.y);
      }
      world.zombies.splice(i, 1);
    }
  }
}

function spawnSplitChildren(world, zombie) {
  const type = enemyTypes[zombie.splitInto || 'runner'] || enemyTypes.runner;
  const count = zombie.splitCount || 2;
  for (let i = 0; i < count; i++) {
    const health = Math.max(35, Math.floor(type.health * 0.65));
    world.zombies.push({
      ...type,
      type: zombie.splitInto || 'runner',
      id: `z-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      x: zombie.x + Math.cos((Math.PI * 2 / count) * i) * 18,
      y: zombie.y + Math.sin((Math.PI * 2 / count) * i) * 18,
      health,
      maxHealth: health,
      reward: Math.max(4, Math.floor((type.reward || 8) * 0.35)),
      xp: Math.max(4, Math.floor((type.xp || type.reward || 8) * 0.35)),
      damageScale: zombie.damageScale || 1,
      lastShot: 0,
      lastSlam: 0,
      lastMelee: 0,
      lastHeal: 0
    });
  }
}

function updateBullets(room, dt) {
  const world = room.latestWorld;
  const now = nowMs();
  let collisionTotalMs = 0;
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    const previousX = b.x;
    const previousY = b.y;
    b.x += b.vx * (dt / 16.67);
    b.y += b.vy * (dt / 16.67);
    b.life = (b.life || 240) - dt / 16.67;
    if (b.life <= 0) {
      world.bullets.splice(i, 1);
      continue;
    }
    const collisionStartedAt = performance.now();
    try {
    const hitMapWall = querySegment(room.spatial.mapStructures, previousX, previousY, b.x, b.y, 420).some((structure) =>
      WorldMap.structureNearSegment(structure, previousX, previousY, b.x, b.y, b.size || 4) &&
      WorldMap.segmentHitsStructure(structure, previousX, previousY, b.x, b.y, b.size || 4));
    if (hitMapWall) {
      world.bullets.splice(i, 1);
      continue;
    }
    if (b.fromZombie) {
      let hit = false;
      for (const wall of querySegment(room.spatial.walls, previousX, previousY, b.x, b.y, 70)) {
        if (segmentCircleHit(previousX, previousY, b.x, b.y, wall.x, wall.y, (wall.radius || 25) + (b.size || 4))) {
          wall.health -= b.damage;
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const sentry of querySegment(room.spatial.sentries, previousX, previousY, b.x, b.y, 55)) {
          if (segmentCircleHit(previousX, previousY, b.x, b.y, sentry.x, sentry.y, (sentry.radius || 15) + (b.size || 4))) {
            sentry.health -= b.damage;
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const building of querySegment(room.spatial.buildings, previousX, previousY, b.x, b.y, 220)) {
          if (segmentAabbHit(previousX, previousY, b.x, b.y, building, b.size || 4)) {
            building.health -= b.damage;
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const player of room.players.values()) {
          if (segmentCircleHit(previousX, previousY, b.x, b.y, player.x, player.y, 12 + (b.size || 4))) {
            const sheltered = (world.mapStructures || []).some((structure) =>
              WorldMap.pointInside(structure, player.x, player.y, 2));
            if (!sheltered) damagePlayer(player, b.damage, now);
            hit = true;
            break;
          }
        }
      }
      if (hit) world.bullets.splice(i, 1);
    } else {
      const nearbyZombies = querySegment(room.spatial.zombies, previousX, previousY, b.x, b.y, 70);
      for (const z of nearbyZombies) {
        if (b.hitIds?.includes(z.id)) continue;
        if (tryBossDodge(world, z, b, now)) continue;
        if (segmentCircleHit(previousX, previousY, b.x, b.y, z.x, z.y, z.size + (b.size || 4))) {
          z.lastHitBy = b.ownerId || z.lastHitBy || null;
          if (b.explosive) {
            damageZombie(z, b.damage);
            for (const nearby of room.spatial.zombies.queryRadius(b.x, b.y, 105)) {
              if (nearby !== z && distance(b.x, b.y, nearby.x, nearby.y) < 95) {
                nearby.lastHitBy = b.ownerId || nearby.lastHitBy || null;
                damageZombie(nearby, b.damage * 0.5);
              }
            }
          } else {
            damageZombie(z, b.damage);
          }
          if (!b.fromTurret && b.ownerId) {
            const owner = room.players.get(b.ownerId);
            if (owner && owner.lifesteal) healPlayer(owner, Math.min(12, b.damage * 0.08));
          }
          if (b.pierce > 0 && !b.explosive) {
            b.pierce--;
            b.hitIds.push(z.id);
          } else {
            world.bullets.splice(i, 1);
          }
          break;
        }
      }
    }
    } finally {
      collisionTotalMs += performance.now() - collisionStartedAt;
    }
  }
  recordStageDuration(room, 'collisions', collisionTotalMs);
}

function updateSentries(room) {
  const world = room.latestWorld;
  const now = nowMs();
  const powerRelayOnline = world.buildings.some((building) => building.id === 'powerRelay' && building.health > 0);
  const armoryOnline = world.buildings.some((building) => building.id === 'emergencyArmory' && building.health > 0);
  const canRefill = (powerRelayOnline || armoryOnline) && now - (world.lastPowerRelayTick || 0) >= (armoryOnline ? 1800 : 3000);
  if (canRefill) world.lastPowerRelayTick = now;
  for (let i = world.sentries.length - 1; i >= 0; i--) {
    const sentry = world.sentries[i];
    if (sentry.health <= 0) {
      world.sentries.splice(i, 1);
      room.structuresRevision += 1;
      continue;
    }
    if (sentry.isDisabled > now) continue;
    let closest = null;
    let closestDist = (sentry.range || 260) * (powerRelayOnline ? 1.15 : 1);
    if (canRefill && sentry.ammo < sentry.maxAmmo) sentry.ammo = Math.min(sentry.maxAmmo, sentry.ammo + (armoryOnline ? 6 : 1));
    const ownerUpgrades = room.players.get(sentry.ownerId)?.upgrades;
    for (const z of room.spatial.zombies.queryRadius(sentry.x, sentry.y, closestDist + 55)) {
      const d = distance(sentry.x, sentry.y, z.x, z.y);
      if (d < closestDist) {
        closest = z;
        closestDist = d;
      }
    }
    if (!closest) continue;
    sentry.angle = Math.atan2(closest.y - sentry.y, closest.x - sentry.x);
    if (now - (sentry.lastShot || 0) <= (sentry.fireRate || 200) / (ownerUpgrades?.turretSpeed ? 1.5 : 1)) continue;
    if ((sentry.ammo || 0) <= 0) {
      if (ownerUpgrades?.autoRefill) sentry.ammo = sentry.maxAmmo || 0;
      if ((sentry.ammo || 0) <= 0) continue;
    }
    sentry.lastShot = now;
    sentry.ammo -= 1;
    const pellets = sentry.pellets || 0;
    const fireOne = (spread) => pushBullet(world, sentry.x, sentry.y, sentry.angle + spread, sentry.speed || 8, sentry.damage || 20, {
      explosive: sentry.explosive,
      pierce: sentry.pierce || 0,
      fromTurret: true,
      size: sentry.bulletSize || 4,
      ownerId: sentry.ownerId
    });
    if (pellets) {
      for (let p = 0; p < pellets; p++) fireOne((Math.random() - 0.5) * 0.4);
    } else {
      fireOne(0);
    }
  }
}

function dropLoot(world, x, y) {
  const rand = Math.random();
  let type = 'money';
  if (rand < 0.1) type = 'medkit';
  else if (rand < 0.3) type = 'ammo';
  else if (rand < 0.6) type = 'wood';
  else if (rand < 0.8) type = 'metal';
  world.drops.push({ id: `drop-${nowMs()}-${Math.random().toString(36).slice(2, 7)}`, x, y, type, life: 1800 });
}

function ensureWorldChunks(room) {
  const world = room.latestWorld;
  const anchors = [...room.players.values()].filter((player) => Number.isFinite(player.x) && Number.isFinite(player.y));
  if (!anchors.length) anchors.push({ x: 1100, y: 720 });
  const desiredChunks = new Set();
  for (const anchor of anchors) {
    const centerX = Math.floor(anchor.x / WorldMap.CHUNK_SIZE);
    const centerY = Math.floor(anchor.y / WorldMap.CHUNK_SIZE);
    for (let ox = -1; ox <= 1; ox += 1) {
      for (let oy = -1; oy <= 1; oy += 1) {
        const cx = centerX + ox;
        const cy = centerY + oy;
        const key = WorldMap.chunkKey(cx, cy);
        desiredChunks.add(key);
      }
    }
  }
  const signature = [...desiredChunks].sort().join('|');
  if (signature === room.worldChunkSignature) return;
  const previousChunkKeys = room.generatedChunks;
  for (const key of desiredChunks) {
    if (previousChunkKeys.has(key)) continue;
    const [cx, cy] = key.split(':').map(Number);
    const structures = WorldMap.generateChunk(world.mapSeed, cx, cy);
    for (const structure of structures) {
      const saved = room.structureStates.get(structure.id);
      if (!saved) continue;
      structure.door.open = saved.doorOpen;
      structure.door.destroyed = saved.doorDestroyed;
      if (Number.isFinite(saved.doorHealth)) structure.door.health = saved.doorHealth;
      structure.loot.claimed = saved.lootClaimed;
      for (const windowEntry of structure.windows || []) {
        const savedWindow = saved.windows?.find((entry) => entry.id === windowEntry.id);
        if (!savedWindow) continue;
        if (Number.isFinite(savedWindow.health)) windowEntry.health = savedWindow.health;
        windowEntry.breached = savedWindow.breached;
      }
    }
    world.mapStructures.push(...structures);
  }
  for (const structure of world.mapStructures) {
    if (desiredChunks.has(structure.chunkKey)) continue;
    room.structureStates.set(structure.id, {
      doorOpen: Boolean(structure.door.open),
      doorDestroyed: Boolean(structure.door.destroyed),
      doorHealth: Number(structure.door.health),
      windows: (structure.windows || []).map((entry) => ({
        id: entry.id,
        health: Number(entry.health),
        breached: Boolean(entry.breached)
      })),
      lootClaimed: Boolean(structure.loot.claimed)
    });
  }
  world.mapStructures = world.mapStructures.filter((structure) => desiredChunks.has(structure.chunkKey));
  room.generatedChunks = desiredChunks;
  room.worldChunkSignature = signature;
  world.mapRevision = (world.mapRevision || 0) + 1;
  room.structuresRevision += 1;
}

function spawnWorldDrop(room) {
  const world = room.latestWorld;
  const players = [...room.players.values()].filter((player) => Number.isFinite(player.x) && Number.isFinite(player.y));
  if (!players.length) return;
  const player = players[Math.floor(Math.random() * players.length)];
  const angle = Math.random() * Math.PI * 2;
  const range = 150 + Math.random() * 110;
  const x = player.x + Math.cos(angle) * range;
  const y = player.y + Math.sin(angle) * range;
  world.lootBeacon = { id: `beacon-${nowMs()}`, x, y, expiresAt: nowMs() + 90000 };
  for (let i = 0; i < 3; i += 1) dropLoot(world, x + Math.random() * 50 - 25, y + Math.random() * 50 - 25);
  world.nextWorldDropAt = nowMs() + 90000 + Math.random() * 50000;
}

function collectNearbyDrops(room) {
  const world = room.latestWorld;
  if (!world.drops.length) {
    if (world.lootBeacon) world.lootBeacon = null;
    return;
  }
  const now = nowMs();
  const players = [];
  for (const player of room.players.values()) {
    if (!Number.isFinite(player.x) || player.downed || now - player.lastSeen > 5000) continue;
    const pickup = clamp(Number(player.pickupRadius) || 30, 30, 340);
    players.push({ player, pickup });
  }
  if (players.length) {
    for (let i = world.drops.length - 1; i >= 0; i -= 1) {
      const drop = world.drops[i];
      let collector = null;
      for (const entry of players) {
        if (distance(drop.x, drop.y, entry.player.x, entry.player.y) < entry.pickup) {
          collector = entry.player;
          break;
        }
      }
      if (!collector) continue;
      const amount = drop.type === 'ammo' ? 24 : drop.type === 'money' ? 8 : drop.type === 'medkit' ? 30 : 1;
      if (drop.type === 'medkit') healPlayer(collector, amount);
      else if (drop.type === 'money') grantPlayerResources(collector, { money: amount }, true);
      else if (drop.type === 'wood') grantPlayerResources(collector, { wood: amount }, true);
      else if (drop.type === 'metal') grantPlayerResources(collector, { metal: amount }, true);
      else if (drop.type === 'ammo') grantPlayerResources(collector, { ammo: amount });
      queueEvent(room, { kind: 'loot', playerId: collector.id, type: drop.type, amount, x: round1(drop.x), y: round1(drop.y) }, collector.id);
      world.drops.splice(i, 1);
    }
  }
  if (world.lootBeacon && (now > world.lootBeacon.expiresAt || !world.drops.length)) world.lootBeacon = null;
}

function recordKillReward(room, zombie) {
  const world = room.latestWorld;
  if (zombie.isBoss) world.bossDefeats = (world.bossDefeats || 0) + 1;
  const ownerId = zombie.lastHitBy || null;
  const money = Math.max(1, Math.floor((zombie.reward || 0) * 0.55));
  const xp = zombie.xp || 0;
  for (const player of room.players.values()) {
    const share = !ownerId || player.id === ownerId ? 1 : 0.5;
    grantPlayerResources(player, {
      money: Math.max(1, Math.floor(money * share)),
      parts: player.id === ownerId && zombie.isBoss ? 1 : 0
    }, true);
    grantPlayerXp(player, Math.max(1, Math.floor(xp * share)));
  }
  queueEvent(room, {
    kind: 'killReward',
    zombieId: zombie.id,
    zombieType: zombie.type,
    boss: Boolean(zombie.isBoss),
    miniBoss: Boolean(zombie.isMiniBoss),
    ownerId,
    x: round1(zombie.x),
    y: round1(zombie.y),
    money,
    xp,
    parts: zombie.isBoss ? 1 : 0
  });
}

function updateAcidPoolDamage(room, dt) {
  const world = room.latestWorld;
  if (!world.acidPools.length) return;
  const now = nowMs();
  for (const player of room.players.values()) {
    if (!Number.isFinite(player.x) || player.downed) continue;
    for (const pool of world.acidPools) {
      if (distance(pool.x, pool.y, player.x, player.y) < (pool.radius || 30) + 12) {
        damagePlayer(player, (pool.damage || 0.3) * (dt / 16.67), now);
      }
    }
  }
}

function cleanupWorld(room, world, dt) {
  const before = world.walls.length + world.sentries.length + world.buildings.length;
  world.walls = world.walls.filter((wall) => wall.health > 0);
  world.sentries = world.sentries.filter((sentry) => sentry.health > 0);
  world.buildings = world.buildings.filter((building) => building.health > 0);
  if (world.walls.length + world.sentries.length + world.buildings.length !== before) room.structuresRevision += 1;
  for (let i = world.acidPools.length - 1; i >= 0; i--) {
    world.acidPools[i].life -= dt / 16.67;
    if (world.acidPools[i].life <= 0) world.acidPools.splice(i, 1);
  }
  for (let i = world.drops.length - 1; i >= 0; i--) {
    world.drops[i].life -= dt / 16.67;
    if (world.drops[i].life <= 0) world.drops.splice(i, 1);
  }
}

function updateWaveState(room) {
  const world = room.latestWorld;
  const now = nowMs();
  if (!room.gameStarted) return;
  if (world.gameOver) return;
  if (!room.players.size) return;
  if (world.wave === 0 && !world.waveActive && !world.preparationActive) {
    startWave(room);
    return;
  }
  if (world.preparationActive) {
    if (now >= world.preparationEndsAt) startWave(room);
    return;
  }
  if (!world.waveActive) {
    if (world.nextWaveAt && now >= world.nextWaveAt) startWave(room);
    return;
  }
  if (world.zombies.length + world.zombiesKilled < world.totalZombiesInWave && now >= world.nextSpawnAt) {
    spawnZombie(room);
    world.nextSpawnAt = now + Math.max(520, 1300 - world.wave * 10);
  }
  if (world.zombiesKilled >= world.totalZombiesInWave && world.zombies.length === 0) {
    world.waveActive = false;
    const plan = world.currentWavePlan || wavePlan(world.wave, Math.max(1, room.players.size));
    const reward = plan.waveReward;
    const teamScale = 1 + Math.max(0, room.players.size - 1) * 0.65;
    for (const player of room.players.values()) {
      grantPlayerResources(player, {
        money: Math.floor(reward.money * teamScale),
        wood: Math.max(1, Math.round(reward.wood * teamScale)),
        metal: Math.max(1, Math.round(reward.metal * teamScale))
      }, true);
      if (world.wave % 5 === 0) player.milestoneUpgradeCredits = (player.milestoneUpgradeCredits || 0) + 1;
    }
    const bossPrep = (world.wave + 1) % 10 === 0;
    if (bossPrep) {
      startBossPreparation(room, 35);
    } else {
      world.nextWaveAt = now + 4000;
    }
    queueEvent(room, { kind: 'waveCleared', wave: world.wave, playerCount: Math.max(1, room.players.size), nextWaveIn: bossPrep ? 35000 : 4000, bossPrep });
  }
}

function revivePlayer(player, healthPercent = 0.45) {
  player.health = Math.max(1, Math.ceil((player.maxHealth || 100) * healthPercent));
  player.downed = false;
  player.eliminated = false;
  player.downedAt = 0;
  player.respawnAt = 0;
  player.giveUpAt = 0;
  player.reviveProgress = 0;
  player.reviverId = null;
  player.lastReviveTick = 0;
  player.invulnerableUntil = nowMs() + 2200;
}

function updatePlayerLifeStates(room, now) {
  for (const player of room.players.values()) {
    if ((player.health ?? 100) <= 0 && !player.downed) {
      player.health = 0;
      player.downed = true;
      player.eliminated = false;
      player.downedAt = now;
      if ((player.emergencyRespawns || 0) < emergencyReviveLimit(player)) {
        player.respawnAt = now + EMERGENCY_RESPAWN_DELAY_MS;
        player.giveUpAt = 0;
      } else {
        player.respawnAt = 0;
        player.giveUpAt = now + FINAL_REVIVE_WINDOW_MS;
      }
      player.reviveProgress = 0;
      player.reviverId = null;
      player.lastReviveTick = 0;
    }
    if (!player.downed) continue;
    if (player.lastReviveTick && now - player.lastReviveTick > 420) {
      player.reviveProgress = Math.max(0, (player.reviveProgress || 0) - 180);
      if (player.reviveProgress === 0) player.reviverId = null;
    }
    if (!player.eliminated && (player.emergencyRespawns || 0) >= emergencyReviveLimit(player)
      && player.giveUpAt > 0 && now >= player.giveUpAt) {
      player.eliminated = true;
      player.reviveProgress = 0;
      player.reviverId = null;
      queueEvent(room, { kind: 'playerEliminated', playerId: player.id }, null);
    }
  }
  const players = [...room.players.values()];
  if (room.gameStarted && !room.latestWorld.gameOver && players.length && players.every((player) => player.eliminated)) {
    const world = room.latestWorld;
    world.gameOver = true;
    world.waveActive = false;
    world.preparationActive = false;
    world.zombies = [];
    world.bullets = [];
    queueEvent(room, { kind: 'gameOver', wave: world.wave });
  }
}

function worldScrapPlayerTurrets(room, world, playerId) {
  const before = world.sentries.length;
  world.sentries = world.sentries.filter((sentry) => sentry.ownerId !== playerId);
  if (world.sentries.length !== before) room.structuresRevision += 1;
}

function emergencyRespawn(room, player) {
  if (!player?.downed || player.eliminated || (player.emergencyRespawns || 0) >= emergencyReviveLimit(player)) return false;
  worldScrapPlayerTurrets(room, room.latestWorld, player.id);
  player.emergencyRespawns = (player.emergencyRespawns || 0) + 1;
  player.money = Math.floor((player.money || 0) * 0.8);
  player.x = 980;
  player.y = 850;
  revivePlayer(player, 0.45);
  queueEvent(room, {
    kind: 'respawned',
    emergency: true,
    remaining: Math.max(0, emergencyReviveLimit(player) - player.emergencyRespawns),
    limit: emergencyReviveLimit(player)
  }, player.id);
  return true;
}

function updateDayNight(world, now) {
  const elapsed = Math.max(0, now - (world.cycleStartedAt || now));
  world.dayNumber = 1 + Math.floor(elapsed / DAY_CYCLE_MS);
  world.dayTime = (0.34 + (elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS) % 1;
}

function tickRoom(room) {
  const tickStartedAt = performance.now();
  const now = nowMs();
  const dt = Math.min(200, Math.max(1, now - room.lastTick));
  room.lastTick = now;
  room.snapshotAccumulator += dt;
  room.latestWorld.serverTime = now;
  updateDayNight(room.latestWorld, now);
  if (now >= room.nextPerfPublishAt) {
    room.nextPerfPublishAt = now + 500;
    room.reportedPerf = {
      tickMs: round2(room.tickEma || 0),
      zombieAiMs: round2(room.stageEma.zombies || 0),
      collisionMs: round2(room.stageEma.collisions || 0),
      projectileMs: round2(Math.max(0, (room.stageEma.bullets || 0) - (room.stageEma.collisions || 0))),
      serializationMs: round2(room.stageEma.serialization || 0)
    };
  }

  for (const [id, player] of room.players) {
    const idleLimit = player.disconnectedAt ? 6000 : 15000;
    if (now - player.lastSeen > idleLimit) {
      room.players.delete(id);
      worldScrapPlayerTurrets(room, room.latestWorld, id);
    }
  }
  updatePlayerLifeStates(room, now);

  measureStage(room, 'chunks', () => ensureWorldChunks(room));
  measureStage(room, 'spatial', () => rebuildSpatialIndexes(room));
  if (now >= room.latestWorld.nextWorldDropAt) spawnWorldDrop(room);
  collectNearbyDrops(room);

  measureStage(room, 'wave', () => updateWaveState(room));
  if (room.latestWorld.zombies.length) {
    measureStage(room, 'zombies', () => updateZombies(room, dt));
    measureStage(room, 'spatial', () => rebuildSpatialIndexes(room, true));
  }
  // Bullets, turrets, acid and cleanup keep running between waves so nothing freezes mid-air.
  measureStage(room, 'bullets', () => updateBullets(room, dt));
  measureStage(room, 'sentries', () => updateSentries(room));
  updateAcidPoolDamage(room, dt);
  measureStage(room, 'cleanup', () => cleanupWorld(room, room.latestWorld, dt));

  if (room.snapshotAccumulator >= room.snapshotIntervalMs) {
    room.snapshotAccumulator %= room.snapshotIntervalMs;
    room.lastSnapshot = now;
    measureStage(room, 'snapshots', () => {
      for (const [clientId, client] of room.clients) {
        const buffered = client.bufferedAmount || 0;
        if (buffered > BACKPRESSURE_KILL_BYTES) {
          console.warn(`[room:${room.code}] dropping client ${clientId}: ${Math.round(buffered / 1024)} KB unsent`);
          try { client.terminate(); } catch {}
          continue;
        }
        if (buffered > BACKPRESSURE_SKIP_BYTES) {
          room.perf.skippedSnapshots += 1;
          continue;
        }
        send(client, {
          type: 'world',
          id: 'server',
          authoritative: true,
          room: room.code,
          world: networkWorldSnapshot(room, clientId)
        }, room);
      }
    });
  }

  // Overload governor: back off the snapshot rate when a tick costs more than the budget, recover when it is cheap again.
  const tickCost = performance.now() - tickStartedAt;
  room.tickEma = room.tickEma ? room.tickEma * 0.9 + tickCost * 0.1 : tickCost;
  if (room.tickEma > 45) {
    room.snapshotIntervalMs = 100;
    room.governorRecoverAt = now + 3000;
  } else if (room.tickEma > 30) {
    if (room.snapshotIntervalMs < 66) room.snapshotIntervalMs = 66;
    room.governorRecoverAt = now + 3000;
  } else if (room.snapshotIntervalMs !== SNAPSHOT_MS && now >= room.governorRecoverAt && room.tickEma < 18) {
    room.snapshotIntervalMs = room.snapshotIntervalMs === 100 ? 66 : SNAPSHOT_MS;
    room.governorRecoverAt = now + 3000;
  }

  if (PERF_DEBUG) {
    const tickMs = tickCost;
    room.perf.ticks += 1;
    room.perf.tickTotalMs += tickMs;
    room.perf.tickWorstMs = Math.max(room.perf.tickWorstMs, tickMs);
    if (tickMs > 30) {
      room.perf.slowTicks += 1;
      if (now - room.perf.lastSlowLogAt > 1000) {
        room.perf.lastSlowLogAt = now;
        console.warn(`[perf:${room.code}] Slow tick ${tickMs.toFixed(1)}ms with ${room.latestWorld.zombies.length} zombies and ${room.latestWorld.bullets.length} projectiles`);
      }
    }
  }
}

function cleanId(value, max = 48) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).slice(0, max) : '';
}

function findByNetworkId(list, networkId) {
  if (!networkId) return null;
  return list.find((entry) => entry.networkId === networkId || entry.id === networkId) || null;
}

function turretUpgradeCost(level) {
  return { money: 80 + level * 80, wood: 2 + level, metal: 3 + level * 2 };
}

function trapUpgradeCost(level) {
  return { money: 60 + level * 60, wood: 2 + level, metal: 2 + level * 2 };
}

function turretRepairCost(sentry) {
  if (!sentry?.maxHealth || sentry.health >= sentry.maxHealth) return null;
  const missing = 1 - sentry.health / sentry.maxHealth;
  return { wood: Math.max(1, Math.ceil(missing * 4)), metal: Math.max(1, Math.ceil(missing * 5)) };
}

function wallRepairCost(wall) {
  if (!wall?.maxHealth || wall.health >= wall.maxHealth) return null;
  const missing = 1 - wall.health / wall.maxHealth;
  return {
    wood: Math.max(1, Math.ceil(missing * 5)),
    metal: wall.wallStage >= 2 ? Math.max(1, Math.ceil(missing * 4)) : 0
  };
}

function repairAllCost(world, player) {
  const defenses = [...world.sentries, ...world.walls, ...world.buildings];
  const missing = defenses.reduce((total, defense) => total + Math.max(0, (defense.maxHealth || 0) - (defense.health || 0)), 0);
  const discount = playerSkinPerk(player, 'repairDiscount') ? 0.95 : 1;
  return {
    money: Math.ceil(missing / 28 * discount),
    wood: Math.ceil(missing / 95 * discount),
    metal: Math.ceil(missing / 125 * discount)
  };
}

function repairAllStructures(world) {
  for (const entity of [...world.sentries, ...world.walls, ...world.buildings]) {
    if (entity.maxHealth) entity.health = entity.maxHealth;
  }
}

function weaponUpgradeCost(level) {
  return { money: 650 + level * 650, metal: 10 + level * 7, parts: level >= 2 ? 1 : 0 };
}

function techTierUpgradeCost(tier) {
  return { money: 1800 * tier, wood: 25 * tier, metal: 30 * tier, parts: tier };
}

function rejectPurchase(room, clientId, action, reason) {
  rejectAction(room, clientId, action, action, reason);
  return false;
}

function handleAction(room, packet) {
  try {
    handleActionUnsafe(room, packet);
  } catch (error) {
    console.warn(`[room:${room.code}] action ${packet?.action?.kind} from ${packet?.id} failed: ${error.message}`);
  }
}

function handleActionUnsafe(room, packet) {
  const action = packet.action && typeof packet.action === 'object' ? packet.action : {};
  const world = room.latestWorld;
  const clientId = cleanId(packet.id);
  const kind = cleanId(action.kind, 32);
  const player = room.players.get(clientId) || null;
  const now = nowMs();
  if (PERF_DEBUG && kind === 'debugPopulate' && clientId === room.hostId) {
    const anchor = player || { x: 1100, y: 720 };
    const zombieCount = clamp(Math.floor(Number(action.zombies) || 0), 0, 800);
    const projectileCount = clamp(Math.floor(Number(action.projectiles) || 0), 0, 1000);
    const sentryCount = clamp(Math.floor(Number(action.sentries) || 0), 0, 100);
    world.wave = Math.max(20, world.wave || 0);
    world.waveActive = true;
    world.gameStarted = true;
    room.gameStarted = true;
    world.zombies.length = 0;
    world.bullets.length = 0;
    world.sentries.length = 0;
    for (let i = 0; i < zombieCount; i += 1) {
      const typeKey = i % 17 === 0 ? 'healerZombie' : i % 19 === 0 ? 'engineer' : i % 7 === 0 ? 'armored' : 'normal';
      const type = enemyTypes[typeKey];
      const angle = (i / Math.max(1, zombieCount)) * Math.PI * 2;
      const ring = 220 + (i % 10) * 34;
      world.zombies.push({
        ...type,
        type: typeKey,
        id: `debug-z-${i}`,
        x: anchor.x + Math.cos(angle) * ring,
        y: anchor.y + Math.sin(angle) * ring,
        health: type.health,
        maxHealth: type.health,
        shieldHealth: type.shieldHealth || 0,
        maxShieldHealth: type.shieldHealth || 0,
        reward: type.reward,
        xp: type.xp,
        damageScale: 1,
        lastShot: 0,
        lastSlam: 0,
        lastMelee: 0,
        lastHeal: 0,
        lastWeld: 0
      });
    }
    for (let i = 0; i < projectileCount; i += 1) {
      const angle = (i / Math.max(1, projectileCount)) * Math.PI * 2;
      pushBullet(world, anchor.x + Math.cos(angle) * 520, anchor.y + Math.sin(angle) * 520, angle, 1.2, 2, {
        fromZombie: true,
        life: 10000
      });
    }
    for (let i = 0; i < sentryCount; i += 1) {
      const angle = (i / Math.max(1, sentryCount)) * Math.PI * 2;
      world.sentries.push({
        networkId: `debug-s-${i}`,
        x: anchor.x + Math.cos(angle) * 150,
        y: anchor.y + Math.sin(angle) * 150,
        range: 360,
        damage: 1,
        fireRate: 200,
        speed: 8,
        ammo: 100000,
        maxAmmo: 100000,
        health: 100000,
        maxHealth: 100000,
        ownerId: clientId,
        lastShot: 0
      });
    }
    world.totalZombiesInWave = zombieCount;
    world.zombiesKilled = 0;
    room.structuresRevision += 1;
    room.perf = createPerformanceMetrics();
    return;
  }
  if (PERF_DEBUG && kind === 'debugKillAll') {
    for (const zombie of world.zombies) {
      zombie.lastHitBy = clientId;
      zombie.health = 0;
    }
    return;
  }
  if (PERF_DEBUG && kind === 'debugSetSentry') {
    const sentry = findByNetworkId(world.sentries, cleanId(action.networkId, 64));
    if (!sentry) return;
    if (Number.isFinite(Number(action.ammo))) sentry.ammo = clamp(Math.floor(Number(action.ammo)), 0, sentry.maxAmmo || 0);
    if (Number.isFinite(Number(action.health))) sentry.health = clamp(Number(action.health), 0, sentry.maxHealth || 0);
    return;
  }
  if (PERF_DEBUG && kind === 'debugSetPlayer' && player) {
    if (Number.isFinite(Number(action.x))) player.x = Number(action.x);
    if (Number.isFinite(Number(action.y))) player.y = Number(action.y);
    if (Number.isFinite(Number(action.health))) {
      player.health = clamp(Number(action.health), 0, player.maxHealth || 100);
    }
    if (Number.isFinite(Number(action.emergencyRespawns))) {
      player.emergencyRespawns = clamp(Math.floor(Number(action.emergencyRespawns)), 0, emergencyReviveLimit(player));
    }
    if (action.downed) {
      player.health = 0;
      player.downed = true;
      player.eliminated = false;
      player.downedAt = now;
      player.reviveProgress = 0;
      player.reviverId = null;
      if (player.emergencyRespawns < emergencyReviveLimit(player)) {
        player.respawnAt = now + clamp(Math.floor(Number(action.respawnDelayMs) || EMERGENCY_RESPAWN_DELAY_MS), 50, EMERGENCY_RESPAWN_DELAY_MS);
        player.giveUpAt = 0;
      } else {
        player.respawnAt = 0;
        player.giveUpAt = now + clamp(Math.floor(Number(action.finalWindowMs) || FINAL_REVIVE_WINDOW_MS), 100, FINAL_REVIVE_WINDOW_MS);
      }
    }
    return;
  }
  if (PERF_DEBUG && kind === 'debugBuildStation' && clientId === room.hostId && player) {
    const stationId = cleanId(action.stationId, 32);
    if (world.buildings.some((building) => building.id === stationId)) return;
    const definition = BUILDING_DEFINITIONS.get(stationId);
    if (!definition) return;
    const station = sanitizeBuildEntity('building', {
      id: stationId,
      x: Number(action.x) || player.x,
      y: Number(action.y) || player.y,
      networkId: `debug-${stationId}`
    }, clientId, player);
    world.buildings.push(station);
    room.structuresRevision += 1;
    return;
  }
  if (PERF_DEBUG && kind === 'debugSpawnBoss' && clientId === room.hostId) {
    world.zombies = [];
    world.bullets = [];
    world.wave = Math.max(10, clamp(Math.floor(Number(action.wave) || 10), 10, 999));
    world.currentWavePlan = wavePlan(world.wave, Math.max(1, room.players.size));
    world.bossesToSpawn = 1;
    world.miniBossesToSpawn = 0;
    world.escortsToSpawn = 0;
    world.totalZombiesInWave = 1;
    world.zombiesKilled = 0;
    world.waveActive = true;
    spawnZombie(room);
    return;
  }
  if (PERF_DEBUG && kind === 'debugStartNextWave' && clientId === room.hostId) {
    world.gameOver = false;
    startWave(room);
    return;
  }
  if (PERF_DEBUG && kind === 'debugGrant' && player) {
    grantPlayerResources(player, {
      money: clamp(Math.floor(Number(action.money) || 0), 0, 100000),
      wood: clamp(Math.floor(Number(action.wood) || 0), 0, 10000),
      metal: clamp(Math.floor(Number(action.metal) || 0), 0, 10000),
      ammo: clamp(Math.floor(Number(action.ammo) || 0), 0, 10000),
      parts: clamp(Math.floor(Number(action.parts) || 0), 0, 1000)
    });
    player.skillPoints += clamp(Math.floor(Number(action.skillPoints) || 0), 0, 100);
    player.milestoneUpgradeCredits += clamp(Math.floor(Number(action.milestoneUpgradeCredits) || 0), 0, 20);
    grantPlayerXp(player, clamp(Math.floor(Number(action.xp) || 0), 0, 100000));
    return;
  }
  if (kind === 'startGame') {
    if (!clientId || clientId !== room.hostId) return rejectAction(room, clientId, kind, null, 'Only the room host can start the run.');
    if (room.gameStarted) return;
    room.gameStarted = true;
    world.gameStarted = true;
    world.gameOver = false;
    broadcast(room, { type: 'startGame', id: 'server', room: room.code, hostId: room.hostId });
    announceRoom(room);
    return;
  }
  if (kind === 'build') {
    if (!player || !action.entity || typeof action.entity !== 'object' || Array.isArray(action.entity)) return;
    const buildKind = cleanId(action.buildKind, 16);
    const target = buildKind === 'turret'
      ? world.sentries
      : buildKind === 'wall'
        ? world.walls
        : buildKind === 'trap'
          ? world.traps
          : buildKind === 'building'
            ? world.buildings
            : null;
    const networkId = cleanId(action.entity.networkId, 64);
    if (!target) return;
    if (networkId && target.some((entry) => entry.networkId === networkId)) return;
    const definition = canonicalBuildDefinition(buildKind, action.entity);
    if (!definition) return rejectAction(room, clientId, kind, networkId, 'That build recipe does not exist.');
    const requiredTier = Math.max(1, Number(definition.techLevel) || 1);
    if (requiredTier > (world.techTier || 1) || requiredTier > (world.workbenchLevel || 1)) {
      return rejectAction(room, clientId, kind, networkId, `Requires Tech and Workbench Tier ${requiredTier}.`);
    }
    if (definition.requiredBuilding && !buildingOnline(world, definition.requiredBuilding)) {
      const station = BUILDING_DEFINITIONS.get(definition.requiredBuilding);
      return rejectAction(room, clientId, kind, networkId, `Build ${station?.name || 'the required support station'} first.`);
    }
    const entity = sanitizeBuildEntity(buildKind, {
      ...action.entity,
      x: action.x ?? action.entity.x,
      y: action.y ?? action.entity.y
    }, clientId, player);
    if (!validateBuildPlacement(buildKind, entity, world)) {
      queueEvent(room, { kind: 'buildRejected', buildKind, networkId: entity.networkId, reason: 'The server could not place that here.' }, clientId);
      return;
    }
    if (!spendPlayerCost(player, definition.cost || {})) {
      return rejectAction(room, clientId, kind, entity.networkId, 'Not enough resources for that build.');
    }
    target.push(entity);
    room.structuresRevision += 1;
    return;
  }
  if (kind === 'shot') {
    if (!action.weapon || typeof action.weapon !== 'object') return;
    spawnRemoteShot(room, { id: clientId }, {
      id: cleanId(action.weapon.id, 32),
      angle: Number(action.angle),
      shotId: cleanId(action.shotId, 80),
      clientShotTime: Number(action.clientShotTime)
    });
    return;
  }
  if (kind === 'revive') {
    const reviver = player;
    const target = room.players.get(cleanId(action.targetId));
    if (!reviver || !target || reviver.downed || target.eliminated || !target.downed) return;
    if (distance(reviver.x, reviver.y, target.x, target.y) > 82) return;
    const continued = target.reviverId === clientId && target.lastReviveTick && now - target.lastReviveTick <= 420;
    target.reviverId = clientId;
    target.reviveProgress = (continued ? target.reviveProgress || 0 : 0) + Math.min(180, Math.max(90, now - (target.lastReviveTick || now - 110)));
    target.lastReviveTick = now;
    if (target.reviveProgress >= REVIVE_DURATION_MS) revivePlayer(target, 0.5);
    return;
  }
  if (kind === 'requestRespawn') {
    if (!player || !player.downed || player.eliminated || (player.emergencyRespawns || 0) >= emergencyReviveLimit(player)) return;
    if (!player.respawnAt || now < player.respawnAt) return;
    emergencyRespawn(room, player);
    return;
  }
  if (kind === 'buySkill') {
    if (!player) return;
    const skillId = cleanId(action.skillId, 32);
    const cap = SKILL_CAPS.get(skillId);
    const current = Number(player.skillLevels?.[skillId]) || 0;
    if (!cap || current >= cap) return rejectPurchase(room, clientId, kind, 'That skill is already maxed.');
    if (player.skillPoints <= 0) return rejectPurchase(room, clientId, kind, 'No skill points available.');
    player.skillPoints -= 1;
    player.skillLevels[skillId] = current + 1;
    refreshPlayerDerivedStats(player, { healIncrease: true });
    queueEvent(room, { kind: 'progressionNotice', message: `${GameContent.skills.find((skill) => skill.id === skillId)?.name || 'Skill'} upgraded.` }, clientId);
    return;
  }
  if (kind === 'buyUtilityUpgrade') {
    if (!player) return;
    const upgradeId = cleanId(action.upgradeId, 32);
    const definition = UTILITY_UPGRADE_DEFINITIONS.get(upgradeId);
    if (!definition) return rejectPurchase(room, clientId, kind, 'That workbench upgrade does not exist.');
    if (player.upgrades?.[upgradeId]) return rejectPurchase(room, clientId, kind, 'That workbench upgrade is already installed.');
    if (!spendPlayerCost(player, definition.cost)) return rejectPurchase(room, clientId, kind, 'Not enough resources for that workbench upgrade.');
    player.upgrades ||= { autoLoot: false, autoRefill: false, turretSpeed: false };
    player.upgrades[upgradeId] = true;
    refreshPlayerDerivedStats(player);
    queueEvent(room, { kind: 'progressionNotice', message: `${definition.name} installed.` }, clientId);
    return;
  }
  if (kind === 'buyWeapon') {
    if (!player) return;
    const weaponId = cleanId(action.weaponId, 32);
    const definition = WEAPON_DEFINITIONS.get(weaponId);
    const owned = player.weapons.find((weapon) => weapon.id === weaponId);
    if (!definition || !owned || owned.owned) return rejectPurchase(room, clientId, kind, 'That weapon cannot be purchased.');
    if (world.wave < (definition.requiredWave || 0)) return rejectPurchase(room, clientId, kind, `Unlocks at wave ${definition.requiredWave}.`);
    if (!spendPlayerCost(player, { money: definition.cost || 0 })) return rejectPurchase(room, clientId, kind, 'Not enough cash.');
    owned.owned = true;
    owned.currentAmmo = weaponMaxAmmo(weaponId, owned.upgradeLevel, player.runUpgradeCounts?.deepPockets || 0);
    player.reserveAmmo += definition.ammoCost || definition.maxAmmo * 2;
    return;
  }
  if (kind === 'upgradeWeapon') {
    if (!player) return;
    const weaponId = cleanId(action.weaponId, 32);
    const owned = player.weapons.find((weapon) => weapon.id === weaponId);
    const level = Number(owned?.upgradeLevel) || 0;
    if (!owned?.owned || level >= 5) return rejectPurchase(room, clientId, kind, 'That weapon cannot be upgraded.');
    if (!spendPlayerCost(player, weaponUpgradeCost(level))) return rejectPurchase(room, clientId, kind, 'Not enough resources for the weapon upgrade.');
    const oldMax = weaponMaxAmmo(weaponId, level, player.runUpgradeCounts?.deepPockets || 0);
    owned.upgradeLevel = level + 1;
    const newMax = weaponMaxAmmo(weaponId, level + 1, player.runUpgradeCounts?.deepPockets || 0);
    owned.currentAmmo = Math.min(newMax, (owned.currentAmmo || 0) + newMax - oldMax);
    return;
  }
  if (kind === 'reloadWeapon') {
    if (!player) return;
    const weaponId = cleanId(action.weaponId, 32);
    const definition = WEAPON_DEFINITIONS.get(weaponId);
    const owned = player.weapons.find((weapon) => weapon.id === weaponId && weapon.owned);
    if (!definition || !owned) return rejectPurchase(room, clientId, kind, 'Weapon is not owned.');
    const maxAmmo = weaponMaxAmmo(weaponId, owned.upgradeLevel, player.runUpgradeCounts?.deepPockets || 0);
    const currentAmmo = clamp(Math.floor(Number(owned.currentAmmo) || 0), 0, maxAmmo);
    if (currentAmmo >= maxAmmo) return;
    if (definition.ammoCost) {
      if (player.reserveAmmo < definition.ammoCost) return rejectPurchase(room, clientId, kind, 'Not enough reserve ammo.');
      player.reserveAmmo -= definition.ammoCost;
      owned.currentAmmo = maxAmmo;
      return;
    }
    const transfer = Math.min(maxAmmo - currentAmmo, player.reserveAmmo);
    if (transfer <= 0) return rejectPurchase(room, clientId, kind, 'No reserve ammo.');
    player.reserveAmmo -= transfer;
    owned.currentAmmo = currentAmmo + transfer;
    return;
  }
  if (kind === 'emergencyReload') {
    if (!player || !playerSkinPerk(player, 'emergencyReload')) return;
    if (now < (player.nextEmergencyReloadAt || 0)) return rejectPurchase(room, clientId, kind, 'Emergency reload is cooling down.');
    const weaponId = cleanId(action.weaponId, 32);
    const owned = player.weapons.find((weapon) => weapon.id === weaponId && weapon.owned);
    if (!owned) return rejectPurchase(room, clientId, kind, 'Weapon is not owned.');
    const maxAmmo = weaponMaxAmmo(weaponId, owned.upgradeLevel, player.runUpgradeCounts?.deepPockets || 0);
    if ((owned.currentAmmo || 0) >= maxAmmo) return;
    owned.currentAmmo = maxAmmo;
    player.nextEmergencyReloadAt = now + 40000;
    return;
  }
  if (kind === 'heal') {
    return rejectPurchase(room, clientId, kind, 'Healing must come from a server-validated item.');
  }
  if (kind === 'toggleDoor') {
    const structure = world.mapStructures.find((entry) => entry.id === cleanId(action.structureId, 64));
    if (!structure || !player || structure.door.destroyed) return;
    const door = WorldMap.doorPoint(structure);
    if (distance(player.x, player.y, door.x, door.y) > 95) return;
    structure.door.open = !structure.door.open;
    bumpStructureState(world, structure);
    return;
  }
  if (kind === 'openStructureLoot') {
    const structure = world.mapStructures.find((entry) => entry.id === cleanId(action.structureId, 64));
    if (!structure || !player || structure.loot.claimed) return;
    if (distance(player.x, player.y, structure.loot.x, structure.loot.y) > 75) return;
    structure.loot.claimed = true;
    bumpStructureState(world, structure);
    for (let i = 0; i < 2; i += 1) {
      dropLoot(world, structure.loot.x + Math.random() * 35 - 17, structure.loot.y + Math.random() * 35 - 17);
    }
    return;
  }
  if (kind === 'collectSupply') {
    const drop = world.supplyDrop;
    if (!drop || drop.collected || !player || !world.preparationActive) return;
    if (distance(player.x, player.y, drop.x, drop.y) > (drop.interactionRadius || 72) + 16) return;
    drop.collected = true;
    drop.collectedBy = clientId;
    grantPlayerResources(player, drop.rewards || {});
    queueEvent(room, { kind: 'supplyCollected', playerId: clientId, rewards: drop.rewards });
    return;
  }
  if (kind === 'buyAmmoPack') {
    if (!player) return;
    const packId = cleanId(action.packId, 24);
    const source = cleanId(action.source, 16) || 'shop';
    const pack = GameContent.ammoPacks.find((entry) => entry.id === packId);
    if (!pack || !['shop', 'workbench', 'trader'].includes(source)) return rejectPurchase(room, clientId, kind, 'Ammo pack not found.');
    const traderPurchase = source === 'trader';
    if (traderPurchase) {
      const trader = world.trader;
      if (!world.preparationActive || !trader || !trader.ammoDeals?.includes(packId) || (trader.stock?.[packId] || 0) <= 0) {
        return rejectPurchase(room, clientId, kind, 'That trader stock is unavailable.');
      }
      if (distance(player.x, player.y, trader.x, trader.y) > (trader.interactionRadius || 78) + 30) {
        return rejectPurchase(room, clientId, kind, 'Move closer to the trader.');
      }
    }
    const cost = { ...(pack.cost || {}) };
    if (traderPurchase && cost.money) cost.money = Math.max(1, Math.floor(cost.money * 0.72));
    if (!spendPlayerCost(player, cost)) return rejectPurchase(room, clientId, kind, 'Not enough resources for ammo.');
    player.reserveAmmo += pack.ammo || 0;
    if (pack.refillWeapons) {
      for (const weapon of player.weapons) {
        if (weapon.owned) weapon.currentAmmo = weaponMaxAmmo(weapon.id, weapon.upgradeLevel, player.runUpgradeCounts?.deepPockets || 0);
      }
    }
    if (traderPurchase) world.trader.stock[packId] -= 1;
    return;
  }
  if (kind === 'buyTraderItem') {
    if (!player || !world.preparationActive || !world.trader) return rejectPurchase(room, clientId, kind, 'The trader is not available.');
    const itemId = cleanId(action.itemId, 24);
    const item = TRADER_ITEMS[itemId];
    if (!item || (world.trader.stock?.[itemId] || 0) <= 0) return rejectPurchase(room, clientId, kind, 'That item is sold out.');
    if (distance(player.x, player.y, world.trader.x, world.trader.y) > (world.trader.interactionRadius || 78) + 30) {
      return rejectPurchase(room, clientId, kind, 'Move closer to the trader.');
    }
    if (!spendPlayerCost(player, item.cost)) return rejectPurchase(room, clientId, kind, 'Not enough cash.');
    world.trader.stock[itemId] -= 1;
    if (item.reward) grantPlayerResources(player, item.reward);
    if (item.repairAll) repairAllStructures(world);
    return;
  }
  if (kind === 'buyPotion') {
    if (!player) return;
    const recipe = GameContent.potionRecipes.find((entry) => entry.id === cleanId(action.recipeId, 32));
    const station = world.buildings.find((entry) => entry.id === 'potionHut');
    if (!recipe || !station || distance(player.x, player.y, station.x, station.y) > (station.interactionRadius || 90) + 35) {
      return rejectPurchase(room, clientId, kind, 'Use a nearby Potion Hut.');
    }
    if (recipe.type === 'instantHeal' && player.health >= player.maxHealth) {
      return rejectPurchase(room, clientId, kind, 'Health is already full.');
    }
    if (!spendPlayerCost(player, recipe.cost)) return rejectPurchase(room, clientId, kind, 'Not enough resources for that potion.');
    if (recipe.type === 'instantHeal') {
      const healed = healPlayer(player, recipe.multiplier || 0);
      queueEvent(room, { kind: 'healed', amount: Math.round(healed), source: recipe.name }, clientId);
    } else player.potionExpiries[recipe.type] = now + recipe.duration;
    refreshPlayerDerivedStats(player);
    return;
  }
  if (kind === 'buyLife') {
    if (!player || player.downed || player.eliminated) return rejectPurchase(room, clientId, kind, 'You cannot buy a life while downed.');
    if ((world.techTier || 1) < 3 || (world.workbenchLevel || 1) < 3) {
      return rejectPurchase(room, clientId, kind, 'Life Contracts unlock at Tech III and Workbench Level 3.');
    }
    const price = lifePurchaseCost(player);
    if (!spendPlayerCost(player, { money: price })) return rejectPurchase(room, clientId, kind, 'Not enough cash for another Life Contract.');
    player.lifePurchases = (player.lifePurchases || 0) + 1;
    queueEvent(room, {
      kind: 'progressionNotice',
      message: `Life Contract purchased. Emergency revive limit: ${emergencyReviveLimit(player)}.`
    }, clientId);
    return;
  }
  if (kind === 'buyAmmoForge') {
    if (!player) return;
    const option = AMMO_FORGE_OPTIONS[cleanId(action.optionId, 24)];
    const station = world.buildings.find((entry) => entry.id === 'ammoForge');
    if (!option || !station || distance(player.x, player.y, station.x, station.y) > (station.interactionRadius || 90) + 35) {
      return rejectPurchase(room, clientId, kind, 'Use a nearby Ammo Forge.');
    }
    if (!spendPlayerCost(player, option.cost)) return rejectPurchase(room, clientId, kind, 'Not enough resources for the forge.');
    grantPlayerResources(player, option);
    return;
  }
  if (kind === 'upgradeWorkbench') {
    if (!player) return;
    const current = world.workbenchLevel || 1;
    const next = GameContent.workbenchLevels[current];
    if (!next) return rejectPurchase(room, clientId, kind, 'Workbench is already maxed.');
    if ((world.techTier || 1) < next.level) return rejectPurchase(room, clientId, kind, `Unlock Tech Tier ${next.level} first.`);
    if (!spendPlayerCost(player, next.cost)) return rejectPurchase(room, clientId, kind, 'Not enough resources for the workbench upgrade.');
    world.workbenchLevel = next.level;
    return;
  }
  if (kind === 'upgradeTechTier') {
    const requested = clamp(Math.floor(Number(action.tier) || 0), 1, 4);
    const current = world.techTier || 1;
    if (!player || requested !== current + 1) return rejectPurchase(room, clientId, kind, 'Invalid tech tier request.');
    if (!spendPlayerCost(player, techTierUpgradeCost(current))) return rejectPurchase(room, clientId, kind, 'Not enough resources for the tech tier.');
    world.techTier = requested;
    return;
  }
  if (kind === 'refillTurret') {
    const networkId = cleanId(action.networkId, 64);
    const sentry = findByNetworkId(world.sentries, networkId);
    if (!player || !sentry) return rejectAction(room, clientId, kind, networkId, 'That turret is gone.');
    if (distance(player.x, player.y, sentry.x, sentry.y) > 70) return rejectAction(room, clientId, kind, networkId, 'Move closer to refill.');
    if (sentry.ammo >= sentry.maxAmmo) return rejectAction(room, clientId, kind, networkId, 'Turret already full.');
    if (!spendPlayerCost(player, { wood: 1, metal: 1 })) return rejectAction(room, clientId, kind, networkId, 'Need 1 wood and 1 metal.');
    sentry.ammo = sentry.maxAmmo;
    return;
  }
  if (kind === 'upgradeTurret') {
    const networkId = cleanId(action.networkId, 64);
    const stat = cleanId(action.stat, 16);
    const sentry = findByNetworkId(world.sentries, networkId);
    if (!player || !sentry || !['damage', 'fireRate', 'range', 'ammo'].includes(stat)) return rejectAction(room, clientId, kind, networkId, 'That turret is gone.');
    sentry.upgradeLevels = sentry.upgradeLevels && typeof sentry.upgradeLevels === 'object' ? sentry.upgradeLevels : { damage: 0, fireRate: 0, range: 0, ammo: 0 };
    const level = Number(sentry.upgradeLevels[stat]) || 0;
    const hasAdvancedBench = world.buildings.some((building) => building.id === 'advancedTurretBench');
    const cap = (world.workbenchLevel || 1) * 2 + (hasAdvancedBench ? 2 : 0);
    if (level >= cap) return rejectAction(room, clientId, kind, networkId, 'Turret upgrade maxed for this bench.');
    if (!spendPlayerCost(player, turretUpgradeCost(level))) return rejectAction(room, clientId, kind, networkId, 'Not enough resources for the turret upgrade.');
    sentry.upgradeLevels[stat] = level + 1;
    if (stat === 'damage') sentry.damage = (sentry.damage || 20) * 1.2;
    if (stat === 'fireRate') sentry.fireRate = (sentry.fireRate || 200) * 0.88;
    if (stat === 'range') sentry.range = (sentry.range || 260) + 35;
    if (stat === 'ammo') {
      sentry.maxAmmo = Math.ceil((sentry.maxAmmo || 0) * 1.25);
      sentry.ammo = sentry.maxAmmo;
    }
    return;
  }
  if (kind === 'upgradeTrap') {
    const networkId = cleanId(action.networkId, 64);
    const stat = cleanId(action.stat, 16);
    const trap = findByNetworkId(world.traps, networkId);
    if (!player || !trap || !['damage', 'radius', 'uses'].includes(stat)) {
      return rejectAction(room, clientId, kind, networkId, 'That trap is gone.');
    }
    trap.upgradeLevels = trap.upgradeLevels && typeof trap.upgradeLevels === 'object'
      ? trap.upgradeLevels
      : { damage: 0, radius: 0, uses: 0 };
    const level = Number(trap.upgradeLevels[stat]) || 0;
    const cap = (world.workbenchLevel || 1) + (buildingOnline(world, 'trapBench') ? 2 : 0);
    if (level >= cap) return rejectAction(room, clientId, kind, networkId, 'Trap upgrade maxed for this bench.');
    if (!spendPlayerCost(player, trapUpgradeCost(level))) {
      return rejectAction(room, clientId, kind, networkId, 'Not enough resources for the trap upgrade.');
    }
    trap.upgradeLevels[stat] = level + 1;
    if (stat === 'damage') trap.damage = (trap.damage || 250) * 1.2;
    if (stat === 'radius') trap.radius = (trap.radius || 20) + 4;
    if (stat === 'uses') {
      trap.maxUses = (trap.maxUses || 10) + 5;
      trap.usesRemaining = Math.min(trap.maxUses, (trap.usesRemaining || 0) + 5);
    }
    return;
  }
  if (kind === 'repairStructure') {
    const networkId = cleanId(action.networkId, 64);
    const structureKind = cleanId(action.structureKind, 16);
    const list = structureKind === 'turret' ? world.sentries : structureKind === 'wall' ? world.walls : structureKind === 'building' ? world.buildings : null;
    const entity = list ? findByNetworkId(list, networkId) : null;
    if (!player || !entity) return rejectAction(room, clientId, kind, networkId, 'That defense is gone.');
    const cost = structureKind === 'turret' ? turretRepairCost(entity) : structureKind === 'wall' ? wallRepairCost(entity) : null;
    if (!cost) return rejectAction(room, clientId, kind, networkId, 'That defense is already repaired.');
    if (!spendPlayerCost(player, cost)) return rejectAction(room, clientId, kind, networkId, 'Not enough resources to repair it.');
    entity.health = entity.maxHealth || entity.health;
    return;
  }
  if (kind === 'repairAll') {
    if (!player) return;
    const cost = repairAllCost(world, player);
    if (!spendPlayerCost(player, cost)) return rejectAction(room, clientId, kind, 'all', 'Not enough resources for crew repairs.');
    repairAllStructures(world);
    return;
  }
  if (kind === 'upgradeWall') {
    const networkId = cleanId(action.networkId, 64);
    const wall = findByNetworkId(world.walls, networkId);
    const stage = Math.floor(Number(action.stage));
    if (!player || !wall) return rejectAction(room, clientId, kind, networkId, 'That wall is gone.');
    if (!Number.isFinite(stage) || stage !== (wall.wallStage || 0) + 1 || !WALL_STAGES[stage]) return rejectAction(room, clientId, kind, networkId, 'Wall cannot be upgraded further.');
    const next = WALL_STAGES[stage];
    if (next.techLevel > (world.workbenchLevel || 1) || next.techLevel > (world.techTier || 1)) {
      return rejectAction(room, clientId, kind, networkId, `Requires Tech and Workbench Tier ${next.techLevel}.`);
    }
    if (!spendPlayerCost(player, next.upgradeCost || {})) return rejectAction(room, clientId, kind, networkId, 'Not enough resources for the wall upgrade.');
    const ratio = wall.maxHealth ? wall.health / wall.maxHealth : 1;
    wall.name = next.name;
    wall.color = next.color;
    wall.armor = next.armor || 0;
    wall.isElectric = Boolean(next.isElectric);
    wall.shockDamage = next.shockDamage || 0;
    wall.techLevel = next.techLevel;
    wall.wallStage = stage;
    wall.maxHealth = next.health;
    wall.health = Math.max(next.health * ratio, next.health * 0.55);
    wall.radius = 25;
    return;
  }
  if (kind === 'runUpgrade') {
    if (!player) return;
    const id = cleanId(action.id, 24);
    if (!RUN_UPGRADE_IDS.has(id) || (player.milestoneUpgradeCredits || 0) <= 0) {
      return rejectPurchase(room, clientId, kind, 'No milestone upgrade choice is available.');
    }
    player.milestoneUpgradeCredits -= 1;
    player.runUpgradeCounts[id] = (player.runUpgradeCounts[id] || 0) + 1;
    const ownedSentries = world.sentries.filter((entry) => entry.ownerId === clientId);
    const ownedWalls = world.walls.filter((entry) => entry.ownerId === clientId);
    if (id === 'vitality') {
      refreshPlayerDerivedStats(player);
      const healed = healPlayer(player, 25);
      queueEvent(room, { kind: 'healed', amount: Math.round(healed), source: 'Emergency Rations' }, clientId);
    } else if (id === 'caliber' || id === 'rapidFire' || id === 'salvage') {
      refreshPlayerDerivedStats(player);
    } else if (id === 'turretCore') {
      for (const sentry of ownedSentries) {
        sentry.damage = (sentry.damage || 20) * 1.15;
        sentry.fireRate = (sentry.fireRate || 200) * 0.87;
      }
    } else if (id === 'fortify') {
      for (const defense of [...ownedSentries, ...ownedWalls]) {
        defense.maxHealth = (defense.maxHealth || defense.health || 100) * 1.2;
        defense.health = (defense.health || 0) * 1.2;
      }
    } else if (id === 'longShot') {
      for (const sentry of ownedSentries) sentry.range = (sentry.range || 260) * 1.15;
    } else if (id === 'fieldRepair') {
      for (const defense of [...ownedSentries, ...ownedWalls]) {
        defense.health = Math.min(defense.maxHealth || defense.health, (defense.health || 0) + (defense.maxHealth || 0) * 0.4);
      }
    } else if (id === 'deepPockets') {
      player.reserveAmmo += 80;
      const count = player.runUpgradeCounts.deepPockets || 0;
      for (const weapon of player.weapons) {
        if (!weapon.owned) continue;
        const previousMax = weaponMaxAmmo(weapon.id, weapon.upgradeLevel, count - 1);
        const nextMax = weaponMaxAmmo(weapon.id, weapon.upgradeLevel, count);
        weapon.currentAmmo = Math.min(nextMax, (weapon.currentAmmo || 0) + nextMax - previousMax);
      }
    }
    return;
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      service: 'last-shopper',
      commit: BUILD_COMMIT,
      simulationHz: Math.round(1000 / TICK_MS),
      snapshotHz: Math.round(1000 / SNAPSHOT_MS),
      protocol: PROTOCOL_VERSION
    }));
    return;
  }
  if (url.pathname === '/debug/perf' && PERF_DEBUG) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ rooms: [...rooms.values()].map(performanceReport) }, null, 2));
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const requested = path.normalize(path.join(ROOT, pathname));
  if (!requested.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(requested, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const extension = path.extname(requested);
    const headers = { 'Content-Type': MIME[extension] || 'application/octet-stream' };
    if (extension === '.html' || extension === '.js' || extension === '.css') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 256 * 1024,
  perMessageDeflate: {
    threshold: 1024,
    zlibDeflateOptions: { level: 1, memLevel: 7 },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 12,
    concurrencyLimit: 4
  }
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const match = url.pathname.match(/^\/room\/([A-Za-z0-9_-]{1,24})$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const room = getRoom(match[1]);
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, room);
  });
});

wss.on('connection', (ws, req, room) => {
  ws.room = room;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', (error) => {
    console.warn(`[room:${room.code}] socket error: ${error.message}`);
    try { ws.terminate(); } catch {}
  });

  ws.on('message', (raw) => {
    try {
      handleMessage(room, ws, raw);
    } catch (error) {
      console.warn(`[room:${room.code}] message handling failed: ${error.message}`);
    }
  });

  ws.on('close', () => {
    if (ws.clientId && room.clients.get(ws.clientId) === ws) {
      room.clients.delete(ws.clientId);
      room.clientEntityKnowledge.delete(ws.clientId);
      room.clientEvents.delete(ws.clientId);
      const player = room.players.get(ws.clientId);
      if (player) {
        // Keep the player briefly so a reload / network blip can resume the same run.
        player.disconnectedAt = nowMs();
        player.lastSeen = Math.min(player.lastSeen, nowMs());
      }
      if (room.hostId === ws.clientId) room.hostId = null;
      announceRoom(room);
    }
    if (room.clients.size === 0) rooms.delete(room.code);
  });
});

function handleMessage(room, ws, raw) {
  let packet;
  try {
    packet = JSON.parse(raw.toString());
  } catch {
    send(ws, { type: 'error', message: 'Bad JSON packet' });
    return;
  }
  if (!packet || typeof packet !== 'object') return;
  if (packet.id !== undefined) packet.id = cleanId(packet.id, 48);
  if (!packet.id) return;
  registerClient(room, ws, packet);

  if (packet.type === 'ping') {
    send(ws, { type: 'pong', sentAt: packet.sentAt, serverTime: nowMs() }, room);
    return;
  }

  if (packet.type === 'state' && packet.state && typeof packet.state === 'object') {
    const previous = room.players.get(packet.id) || {};
    room.players.set(packet.id, sanitizePlayerState(previous, packet.state, packet.id, nowMs()));
    return;
  }

  if (packet.type === 'action') {
    handleAction(room, packet);
    return;
  }

  if (packet.type === 'hello') {
    broadcast(room, { type: 'hello', id: packet.id, room: room.code }, ws);
  }
}

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch {}
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch {}
  }
}, HEARTBEAT_MS).unref();

let nextServerTick = performance.now() + TICK_MS;
function runServerTickLoop() {
  const loopStartedAt = performance.now();
  for (const room of rooms.values()) tickRoom(room);
  nextServerTick += TICK_MS;
  if (loopStartedAt - nextServerTick > TICK_MS * 3) nextServerTick = performance.now() + TICK_MS;
  setTimeout(runServerTickLoop, Math.max(1, nextServerTick - performance.now()));
}
setTimeout(runServerTickLoop, TICK_MS);

if (PERF_DEBUG) {
  setInterval(() => {
    for (const room of rooms.values()) {
      const report = performanceReport(room);
      console.log(`[perf:${room.code}] ${report.measuredTickRate.toFixed(1)}Hz avg=${report.averageTickMs.toFixed(2)}ms worst=${report.worstTickMs.toFixed(1)}ms zombies=${report.zombies} projectiles=${report.projectiles} snapshots=${(report.averageSnapshotBytes / 1024).toFixed(1)}KB outbound=${(report.outgoingBytesPerSecond / 1024).toFixed(1)}KB/s`);
    }
  }, 5000).unref();
}

server.listen(PORT, () => {
  console.log(`Last Shopper server running at http://localhost:${PORT}`);
  console.log('Players can join with the same room code; networking is detected automatically.');
});
