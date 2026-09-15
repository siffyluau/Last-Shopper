const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;
const WorldMap = require('./systems/world.js');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const TICK_MS = 25;
const SNAPSHOT_MS = 50;
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
const SERVER_PLACEMENT_LIMITS = {
  turrets: 12,
  walls: 60,
  traps: 24,
  buildings: 7
};

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
  shotgun: { damage: 12.5, fireRate: 600, speed: 6, pellets: 16, bulletSize: 3 },
  smg: { damage: 17, fireRate: 78, speed: 10, bulletSize: 3 },
  rifle: { damage: 29, fireRate: 115, speed: 11, bulletSize: 3 },
  marksman: { damage: 118, fireRate: 560, speed: 16, bulletSize: 5, pierce: 1 },
  minigun: { damage: 32, fireRate: 30, speed: 12, bulletSize: 2 },
  grenadeLauncher: { damage: 300, fireRate: 1250, speed: 6, explosive: true, bulletSize: 7 },
  rpg: { damage: 760, fireRate: 2100, speed: 5, explosive: true, bulletSize: 8 }
};

const rooms = new Map();
let nextBulletId = 1;

function nowMs() {
  return Date.now();
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

  if (kind === 'turret') {
    if (world.sentries.filter((item) => item.ownerId === entity.ownerId).length >= SERVER_PLACEMENT_LIMITS.turrets) return false;
    if (nearbyAny(x, y, radius, world.sentries, 78, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.walls, 26)) return false;
  } else if (kind === 'wall') {
    if (world.walls.filter((item) => item.ownerId === entity.ownerId).length >= SERVER_PLACEMENT_LIMITS.walls) return false;
    if (nearbyAny(x, y, radius, world.walls, 5, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 20)) return false;
  } else if (kind === 'trap') {
    if (world.traps.filter((item) => item.ownerId === entity.ownerId).length >= SERVER_PLACEMENT_LIMITS.traps) return false;
    if (nearbyAny(x, y, radius, world.traps, 34, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 20) || nearbyAny(x, y, radius, world.walls, 12)) return false;
  } else if (kind === 'building') {
    if (world.buildings.filter((item) => item.ownerId === entity.ownerId).length >= SERVER_PLACEMENT_LIMITS.buildings) return false;
    if (world.buildings.some((building) => building.id === entity.id)) return false;
    if (nearbyAny(x, y, radius, world.buildings, 82, entity.networkId)) return false;
    if (nearbyAny(x, y, radius, world.sentries, 44) || nearbyAny(x, y, radius, world.walls, 24)) return false;
  } else {
    return false;
  }
  return true;
}

function sanitizeBuildEntity(kind, entity, ownerId) {
  const clean = { ...entity };
  clean.x = Number(entity.x);
  clean.y = Number(entity.y);
  clean.radius = buildRadius(entity);
  clean.networkId = String(entity.networkId || `${kind}-${ownerId || 'player'}-${nowMs()}-${Math.random().toString(36).slice(2, 6)}`);
  clean.ownerId = String(entity.ownerId || ownerId || 'player');
  clean.ownerName = String(entity.ownerName || 'P1').slice(0, 24);
  if (kind === 'turret') {
    clean.angle = Number(clean.angle) || 0;
    clean.lastShot = 0;
    clean.isDisabled = 0;
    clean.health = Number(clean.health || clean.maxHealth || 180);
    clean.maxHealth = Number(clean.maxHealth || clean.health || 180);
    clean.ammo = Number(clean.ammo || clean.maxAmmo || 0);
    clean.maxAmmo = Number(clean.maxAmmo || clean.ammo || 0);
    clean.upgradeLevels = clean.upgradeLevels || { damage: 0, fireRate: 0, range: 0, ammo: 0 };
  }
  if (kind === 'wall') {
    clean.maxHealth = Number(clean.maxHealth || clean.health || 240);
    clean.health = Number(clean.health || clean.maxHealth);
  }
  return clean;
}

function wavePlan(wave, playerCount) {
  const bossWave = wave % 10 === 0;
  const miniBossWave = wave > 5 && wave % 5 === 0 && !bossWave;
  const completed = wave - 1;
  const playerScale = 1 + Math.max(0, playerCount - 1) * 0.35;
  const healthPlayerScale = 1 + Math.max(0, playerCount - 1) * 0.12;
  const baseCount = Math.floor(4 + wave * 1.25 + Math.pow(wave, 0.72));
  return {
    bossWave,
    miniBossWave,
    bossCount: bossWave ? Math.max(1, Math.floor(wave / 30) + 1) : 0,
    miniBossCount: miniBossWave ? Math.max(1, Math.floor(wave / 20) + 1) : 0,
    enemyCount: Math.ceil((bossWave ? 8 + Math.floor(wave * 0.85) : baseCount) * playerScale),
    healthScale: (1 + completed * 0.045 + completed * completed * 0.0009) * healthPlayerScale,
    damageScale: 1 + completed * 0.018,
    rewardScale: 1 + completed * 0.055
  };
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
    lootEvents: [],
    lootBeacon: null,
    nextWorldDropAt: nowMs() + 18000,
    serverTime: nowMs(),
    gameStarted: false,
    wave: 0,
    waveActive: false,
    zombiesKilled: 0,
    totalZombiesInWave: 0,
    bossesToSpawn: 0,
    miniBossesToSpawn: 0,
    escortsToSpawn: 0,
    currentWavePlan: null,
    techTier: 1,
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
    bossDefeats: 0,
    killRewards: [],
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
      hostId: null,
      gameStarted: false,
      latestWorld: createWorld(`room-${roomCode}`),
      generatedChunks: new Set(),
      structureStates: new Map(),
      lastMapSnapshotRevision: -1,
      lastStructureStateRevision: -1,
      lastTick: nowMs(),
      lastSnapshot: 0
    });
  }
  return rooms.get(roomCode);
}

function send(ws, packet) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(packet));
}

function broadcast(room, packet, except) {
  for (const client of room.clients.values()) {
    if (client !== except) send(client, packet);
  }
}

function getMapStructureStates(world) {
  return (world.mapStructures || []).map((structure) => ({
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
  }));
}

function worldSnapshot(room, options = {}) {
  const world = room.latestWorld;
  const { mapStructures, ...dynamicWorld } = world;
  const includeMap = options.includeMap !== false;
  const includeMapStates = options.includeMapStates !== false;
  return {
    ...dynamicWorld,
    ...(includeMap ? { mapStructures } : {}),
    ...(includeMapStates ? { mapStructureStates: getMapStructureStates(world) } : {}),
    gameStarted: room.gameStarted,
    preparationEndsIn: world.preparationActive ? Math.max(0, world.preparationEndsAt - nowMs()) : 0,
    players: [...room.players.values()]
  };
}

function announceRoom(room) {
  if (!room.hostId || !room.clients.has(room.hostId)) {
    room.hostId = room.clients.keys().next().value || null;
  }
  broadcast(room, {
    type: 'server',
    authoritative: true,
    room: room.code,
    hostId: room.hostId,
    clientCount: room.clients.size,
    roomStarted: room.gameStarted,
    latestWorld: worldSnapshot(room)
  });
}

function registerClient(room, ws, packet) {
  if (!packet.id) return;
  if (ws.clientId === packet.id && room.clients.has(packet.id)) return;
  if (ws.clientId && room.clients.get(ws.clientId) === ws) {
    room.clients.delete(ws.clientId);
  }
  ws.clientId = packet.id;
  room.clients.set(packet.id, ws);
  if (!room.hostId) room.hostId = packet.id;
  send(ws, {
    type: 'server',
    authoritative: true,
    room: room.code,
    hostId: room.hostId,
    clientCount: room.clients.size,
    roomStarted: room.gameStarted,
    latestWorld: worldSnapshot(room)
  });
  announceRoom(room);
}

function startWave(room) {
  const world = room.latestWorld;
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
  world.supplyDrop = null;
  world.trader = null;
  world.techTier = Math.max(world.techTier, Math.min(3, 1 + Math.floor((world.wave - 1) / 10)));
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
        money: Math.floor(120 * waveScale),
        wood: Math.ceil(12 * waveScale),
        metal: Math.ceil(9 * waveScale),
        ammo: Math.ceil(70 * waveScale)
      }
    };
    world.trader = null;
  } else {
    world.supplyDrop = null;
    world.trader = { x: 760, y: 790, interactionRadius: 78 };
  }
}

function spawnZombie(room) {
  const world = room.latestWorld;
  const activePlayers = [...room.players.values()].filter((player) =>
    Number.isFinite(player.x) && Number.isFinite(player.y) && nowMs() - player.lastSeen < 5000);
  const anchor = activePlayers[Math.floor(Math.random() * activePlayers.length)] || { x: 1100, y: 720 };
  let spawnX = anchor.x;
  let spawnY = anchor.y;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDistance = 620 + Math.random() * 220;
    spawnX = anchor.x + Math.cos(spawnAngle) * spawnDistance;
    spawnY = anchor.y + Math.sin(spawnAngle) * spawnDistance;
    const blocked = (world.mapStructures || []).some((structure) =>
      rectBlocked(spawnX, spawnY, 34, structure));
    if (!blocked) break;
  }
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
  const health = Math.floor(type.health * plan.healthScale * eliteScale);
  const shieldHealth = type.shieldHealth ? Math.floor(type.shieldHealth * plan.healthScale) : 0;
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

function getTargets(room, zombie, includeStructures = true) {
  const world = room.latestWorld;
  const playerTargets = [...room.players.values()]
    .filter((player) => nowMs() - player.lastSeen < 5000 && (player.health ?? 100) > 0)
    .map((player) => ({ entity: player, x: player.x, y: player.y, radius: 12, kind: 'player' }));
  const structureTargets = [];
  if (includeStructures) {
    for (const wall of world.walls) structureTargets.push({ entity: wall, x: wall.x, y: wall.y, radius: wall.radius || 25, kind: 'structure' });
    for (const sentry of world.sentries) structureTargets.push({ entity: sentry, x: sentry.x, y: sentry.y, radius: sentry.radius || 15, kind: 'structure' });
    for (const building of world.buildings) structureTargets.push({ entity: building, x: building.x, y: building.y, radius: Math.max(building.width || 0, building.height || 0) / 2, kind: 'structure' });
  }
  const candidates = zombie.isSapper && structureTargets.length ? structureTargets : [...playerTargets, ...structureTargets];
  if (!candidates.length) return null;
  return candidates.reduce((nearest, candidate) => {
    const d = distance(zombie.x, zombie.y, candidate.x, candidate.y);
    return !nearest || d < nearest.distance ? { ...candidate, distance: d } : nearest;
  }, null);
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
    world.acidPools.push({ x: z.x, y: z.y, radius: 42, life: 260, damage: 0.55, toxicBoss: true });
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
  world.bullets.push({
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
    pierce: Math.max(0, Math.floor(options.pierce || 0)),
    life: options.life || 240,
    hitIds: []
  });
}

function spawnRemoteShot(room, player, weapon) {
  const world = room.latestWorld;
  const shooter = room.players.get(player.id);
  const type = weaponTypes[weapon.id];
  const ownedWeapon = shooter?.weapons?.find((entry) => entry.id === weapon.id && entry.owned);
  if (!shooter || !type || !ownedWeapon || !world.waveActive) return;
  const now = nowMs();
  const level = clamp(Math.floor(Number(ownedWeapon.upgradeLevel) || 0), 0, 5);
  const cooldown = type.fireRate * Math.pow(0.92, level);
  const cooldownKey = `${player.id}:${weapon.id}`;
  if (now - (room.weaponCooldowns.get(cooldownKey) || 0) < cooldown) return;
  room.weaponCooldowns.set(cooldownKey, now);
  const angle = Number.isFinite(shooter.angle) ? shooter.angle : 0;
  const originX = shooter.x + Math.cos(angle) * 15;
  const originY = shooter.y + Math.sin(angle) * 15;
  const pellets = type.pellets || 0;
  const damage = type.damage * Math.pow(1.18, level);
  const fireOne = (spread) => pushBullet(world, originX, originY, angle + spread, type.speed, damage, {
    explosive: type.explosive,
    pierce: type.pierce,
    size: type.bulletSize || 4,
    ownerId: player.id
  });
  if (pellets) {
    for (let i = 0; i < pellets; i++) fireOne((Math.random() - 0.5) * 0.4);
  } else {
    fireOne(0);
  }
}

function getShelterBreachPlan(world, zombie, target) {
  if (!target || target.kind !== 'player') return null;
  const structure = (world.mapStructures || []).find((entry) =>
    WorldMap.pointInside(entry, target.x, target.y, 2));
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
  world.structureStateRevision = (world.structureStateRevision || 0) + 1;
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
  for (const z of world.zombies) {
    if (z.isHealer && now - z.lastHeal > z.healRate) {
      z.lastHeal = now;
      for (const other of world.zombies) {
        if (other !== z && other.health < other.maxHealth && distance(z.x, z.y, other.x, other.y) < z.healRadius) {
          other.health = Math.min(other.maxHealth, other.health + z.healAmount);
          break;
        }
      }
    } else if (z.isEngineer && now - z.lastWeld > z.weldRate) {
      z.lastWeld = now;
      for (const other of world.zombies) {
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
    const target = getTargets(room, z, true);
    if (!target) continue;
    const targetDist = target.distance;
    const breachPlan = getShelterBreachPlan(world, z, target);
    let didAction = false;
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
        : target;
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
          else target.entity.health = Math.max(0, (target.entity.health || 100) - z.explosionDamage * 0.35);
          z.health = 0;
        } else if (now - (z.lastMelee || 0) > (z.attackRate || 700)) {
          z.lastMelee = now;
          const amount = (z.contactDamage || 8) * (z.damageScale || 1);
          if (target.kind === 'structure') target.entity.health -= amount;
          else target.entity.health = Math.max(0, (target.entity.health || 100) - amount);
          if (z.isLeech) z.health = Math.min(z.maxHealth, z.health + (z.leechAmount || 6));
          if (target.entity.isElectric) damageZombie(z, target.entity.shockDamage || 20);
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
        const isWallBlocked = () => (world.mapStructures || []).some((structure) =>
          WorldMap.structureNearPoint(structure, z.x, z.y, z.size + 12) &&
          WorldMap.wallSegments(structure).some((wall) => rectBlocked(z.x, z.y, z.size, wall)));
        const hitBuildingWall = isWallBlocked();
        if (hitBuildingWall) {
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
        } else {
          z.wallTurn = 0;
        }
      }
    }

    for (let t = world.traps.length - 1; t >= 0 && z.health > 0; t--) {
      const trap = world.traps[t];
      if (distance(z.x, z.y, trap.x, trap.y) < trap.radius) {
        damageZombie(z, trap.damage || 250);
        if (trap.oneTimeUse) world.traps.splice(t, 1);
      }
    }

    if (z.health <= 0) {
      world.zombiesKilled += 1;
      recordKillReward(room, z);
      if (z.isSplitter) spawnSplitChildren(world, z);
      if (z.isBoss || z.isMiniBoss) {
        for (let d = 0; d < 5; d++) dropLoot(world, z.x + Math.random() * 60 - 30, z.y + Math.random() * 60 - 30);
      } else {
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
    const hitMapWall = (world.mapStructures || []).some((structure) =>
      WorldMap.structureNearSegment(structure, previousX, previousY, b.x, b.y, b.size || 4) &&
      WorldMap.segmentHitsStructure(structure, previousX, previousY, b.x, b.y, b.size || 4));
    if (hitMapWall) {
      world.bullets.splice(i, 1);
      continue;
    }
    if (b.fromZombie) {
      let hit = false;
      for (const wall of world.walls) {
        if (Math.abs(b.x - wall.x) < (wall.radius || 25) && Math.abs(b.y - wall.y) < (wall.radius || 25)) {
          wall.health -= b.damage;
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const sentry of world.sentries) {
          if (distance(b.x, b.y, sentry.x, sentry.y) < (sentry.radius || 15)) {
            sentry.health -= b.damage;
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const building of world.buildings) {
          if (Math.abs(b.x - building.x) < building.width / 2 && Math.abs(b.y - building.y) < building.height / 2) {
            building.health -= b.damage;
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (const player of room.players.values()) {
          if (distance(b.x, b.y, player.x, player.y) < 12) {
            const sheltered = (world.mapStructures || []).some((structure) =>
              WorldMap.pointInside(structure, player.x, player.y, 2));
            if (!sheltered) player.health = Math.max(0, (player.health || 100) - b.damage);
            hit = true;
            break;
          }
        }
      }
      if (hit) world.bullets.splice(i, 1);
    } else {
      for (const z of world.zombies) {
        if (b.hitIds?.includes(z.id)) continue;
        if (tryBossDodge(world, z, b, now)) continue;
        if (distance(b.x, b.y, z.x, z.y) < z.size) {
          z.lastHitBy = b.ownerId || z.lastHitBy || null;
          if (b.explosive) {
            for (const nearby of world.zombies) {
              if (distance(b.x, b.y, nearby.x, nearby.y) < 95) {
                nearby.lastHitBy = b.ownerId || nearby.lastHitBy || null;
                damageZombie(nearby, b.damage * 0.5);
              }
            }
          } else {
            damageZombie(z, b.damage);
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
  }
}

function updateSentries(room) {
  const world = room.latestWorld;
  const now = nowMs();
  const powerRelayOnline = world.buildings.some((building) => building.id === 'powerRelay' && building.health > 0);
  const canRefill = powerRelayOnline && now - (world.lastPowerRelayTick || 0) >= 3000;
  if (canRefill) world.lastPowerRelayTick = now;
  for (let i = world.sentries.length - 1; i >= 0; i--) {
    const sentry = world.sentries[i];
    if (sentry.health <= 0) {
      world.sentries.splice(i, 1);
      continue;
    }
    if (sentry.isDisabled > now) continue;
    let closest = null;
    let closestDist = (sentry.range || 260) * (powerRelayOnline ? 1.15 : 1);
    if (canRefill && sentry.ammo < sentry.maxAmmo) sentry.ammo++;
    for (const z of world.zombies) {
      const d = distance(sentry.x, sentry.y, z.x, z.y);
      if (d < closestDist) {
        closest = z;
        closestDist = d;
      }
    }
    if (!closest) continue;
    sentry.angle = Math.atan2(closest.y - sentry.y, closest.x - sentry.x);
    if (now - (sentry.lastShot || 0) <= (sentry.fireRate || 200)) continue;
    if ((sentry.ammo || 0) <= 0) continue;
    sentry.lastShot = now;
    sentry.ammo -= 1;
    const pellets = sentry.pellets || 0;
    const fireOne = (spread) => pushBullet(world, sentry.x, sentry.y, sentry.angle + spread, sentry.speed || 8, sentry.damage || 20, {
      explosive: sentry.explosive,
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
  const previousChunkKeys = new Set(room.generatedChunks);
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
        if (room.generatedChunks.has(key)) continue;
        room.generatedChunks.add(key);
        const structures = WorldMap.generateChunk(world.mapSeed, cx, cy);
        for (const structure of structures) {
          const saved = room.structureStates.get(structure.id);
          if (saved) {
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
        }
        world.mapStructures.push(...structures);
      }
    }
  }
  for (const structure of world.mapStructures) {
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
  for (const key of [...room.generatedChunks]) {
    if (!desiredChunks.has(key)) room.generatedChunks.delete(key);
  }
  if (previousChunkKeys.size !== desiredChunks.size || [...desiredChunks].some((key) => !previousChunkKeys.has(key))) {
    world.mapRevision = (world.mapRevision || 0) + 1;
  }
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
  for (let i = 0; i < 5; i += 1) dropLoot(world, x + Math.random() * 50 - 25, y + Math.random() * 50 - 25);
  world.nextWorldDropAt = nowMs() + 60000 + Math.random() * 30000;
}

function collectNearbyDrops(room) {
  const world = room.latestWorld;
  for (let i = world.drops.length - 1; i >= 0; i -= 1) {
    const drop = world.drops[i];
    const player = [...room.players.values()].find((candidate) =>
      Number.isFinite(candidate.x) && distance(drop.x, drop.y, candidate.x, candidate.y) < 30);
    if (!player) continue;
    const amount = drop.type === 'ammo' ? 24 : drop.type === 'money' ? 18 : drop.type === 'medkit' ? 30 : 1;
    world.lootEvents.push({ id: `loot-${drop.id}-${player.id}`, playerId: player.id, type: drop.type, amount, createdAt: nowMs() });
    world.drops.splice(i, 1);
  }
  if (world.lootEvents.length > 80) world.lootEvents.splice(0, world.lootEvents.length - 80);
  if (world.lootBeacon && (nowMs() > world.lootBeacon.expiresAt || !world.drops.length)) world.lootBeacon = null;
}

function recordKillReward(room, zombie) {
  const world = room.latestWorld;
  if (zombie.isBoss) world.bossDefeats = (world.bossDefeats || 0) + 1;
  const reward = {
    id: `reward-${nowMs()}-${Math.random().toString(36).slice(2, 6)}`,
    zombieId: zombie.id,
    zombieType: zombie.type,
    boss: Boolean(zombie.isBoss),
    miniBoss: Boolean(zombie.isMiniBoss),
    ownerId: zombie.lastHitBy || null,
    money: zombie.reward || 0,
    xp: zombie.xp || 0,
    parts: zombie.isBoss ? 1 : 0,
    createdAt: nowMs()
  };
  world.killRewards.push(reward);
  if (world.killRewards.length > 40) {
    world.killRewards.splice(0, world.killRewards.length - 40);
  }
}

function cleanupWorld(world, dt) {
  world.walls = world.walls.filter((wall) => wall.health > 0);
  world.sentries = world.sentries.filter((sentry) => sentry.health > 0);
  world.buildings = world.buildings.filter((building) => building.health > 0);
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
    if ((world.wave + 1) % 10 === 0) {
      startBossPreparation(room, 35);
    } else {
      world.nextWaveAt = now + 4000;
    }
  }
}

function tickRoom(room) {
  const now = nowMs();
  const dt = Math.min(200, Math.max(1, now - room.lastTick));
  room.lastTick = now;
  room.latestWorld.serverTime = now;

  for (const [id, player] of room.players) {
    if (now - player.lastSeen > 15000) room.players.delete(id);
  }

  ensureWorldChunks(room);
  if (now >= room.latestWorld.nextWorldDropAt) spawnWorldDrop(room);
  collectNearbyDrops(room);

  updateWaveState(room);
  if (room.latestWorld.waveActive) {
    updateZombies(room, dt);
    updateBullets(room, dt);
    updateSentries(room);
    cleanupWorld(room.latestWorld, dt);
  }

  if (now - room.lastSnapshot >= SNAPSHOT_MS) {
    room.lastSnapshot = now;
    const includeMap = room.lastMapSnapshotRevision !== room.latestWorld.mapRevision;
    const includeMapStates = includeMap || room.lastStructureStateRevision !== room.latestWorld.structureStateRevision;
    if (includeMap) room.lastMapSnapshotRevision = room.latestWorld.mapRevision;
    if (includeMapStates) room.lastStructureStateRevision = room.latestWorld.structureStateRevision;
    broadcast(room, {
      type: 'world',
      id: 'server',
      authoritative: true,
      room: room.code,
      world: worldSnapshot(room, { includeMap, includeMapStates })
    });
  }
}

function handleAction(room, packet) {
  const action = packet.action || {};
  const world = room.latestWorld;
  if (action.kind === 'startGame') {
    if (packet.id && packet.id !== room.hostId) return;
    room.gameStarted = true;
    world.gameStarted = true;
    broadcast(room, { type: 'startGame', id: 'server', room: room.code, hostId: room.hostId });
    announceRoom(room);
    return;
  }
  if (action.kind === 'build' && action.entity) {
    const target = action.buildKind === 'turret'
      ? world.sentries
      : action.buildKind === 'wall'
        ? world.walls
        : action.buildKind === 'trap'
          ? world.traps
          : action.buildKind === 'building'
            ? world.buildings
            : null;
    if (!target) return;
    if (target.some((entry) => entry.networkId && entry.networkId === action.entity.networkId)) return;
    const entity = sanitizeBuildEntity(action.buildKind, {
      ...action.entity,
      x: action.x ?? action.entity.x,
      y: action.y ?? action.entity.y
    }, packet.id);
    if (!validateBuildPlacement(action.buildKind, entity, world)) return;
    target.push(entity);
    broadcast(room, { type: 'world', id: 'server', authoritative: true, room: room.code, world: worldSnapshot(room) });
    return;
  }
  if (action.kind === 'shot' && action.player && action.weapon) {
    spawnRemoteShot(room, action.player, action.weapon);
    return;
  }
  if (action.kind === 'toggleDoor') {
    const structure = world.mapStructures.find((entry) => entry.id === action.structureId);
    const player = room.players.get(packet.id);
    if (!structure || !player || structure.door.destroyed) return;
    const door = WorldMap.doorPoint(structure);
    if (distance(player.x, player.y, door.x, door.y) > 95) return;
    structure.door.open = !structure.door.open;
    world.structureStateRevision = (world.structureStateRevision || 0) + 1;
    return;
  }
  if (action.kind === 'openStructureLoot') {
    const structure = world.mapStructures.find((entry) => entry.id === action.structureId);
    const player = room.players.get(packet.id);
    if (!structure || !player || structure.loot.claimed) return;
    if (distance(player.x, player.y, structure.loot.x, structure.loot.y) > 75) return;
    structure.loot.claimed = true;
    world.structureStateRevision = (world.structureStateRevision || 0) + 1;
    for (let i = 0; i < 4; i += 1) {
      dropLoot(world, structure.loot.x + Math.random() * 35 - 17, structure.loot.y + Math.random() * 35 - 17);
    }
    return;
  }
  if (action.kind === 'collectSupply' && world.supplyDrop && !world.supplyDrop.collected) {
    world.supplyDrop.collected = true;
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'last-shopper' }));
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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(requested)] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ noServer: true });

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

  ws.on('message', (raw) => {
    let packet;
    try {
      packet = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'error', message: 'Bad JSON packet' });
      return;
    }

    if (packet.id) registerClient(room, ws, packet);

    if (packet.type === 'state' && packet.id && packet.state) {
      const previous = room.players.get(packet.id) || {};
      room.players.set(packet.id, {
        id: packet.id,
        ...previous,
        ...packet.state,
        health: previous.health ?? packet.state.health ?? 100,
        maxHealth: packet.state.maxHealth ?? previous.maxHealth ?? 100,
        lastSeen: nowMs()
      });
      broadcast(room, packet, ws);
      return;
    }

    if (packet.type === 'action') {
      handleAction(room, packet);
      return;
    }

    if (packet.type !== 'world') broadcast(room, packet, ws);
  });

  ws.on('close', () => {
    if (ws.clientId && room.clients.get(ws.clientId) === ws) {
      room.clients.delete(ws.clientId);
      room.players.delete(ws.clientId);
      if (room.hostId === ws.clientId) room.hostId = null;
      announceRoom(room);
    }
    if (room.clients.size === 0) rooms.delete(room.code);
  });
});

setInterval(() => {
  for (const room of rooms.values()) tickRoom(room);
}, TICK_MS);

server.listen(PORT, () => {
  console.log(`Last Shopper server running at http://localhost:${PORT}`);
  console.log('Players can join with the same room code; networking is detected automatically.');
});
