const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { WebSocketServer } = WebSocket;

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const TICK_MS = 50;
const SNAPSHOT_MS = 100;
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

const spawnGates = [
  { x: 100, y: 100 }, { x: 1900, y: 100 }, { x: 100, y: 1300 },
  { x: 1900, y: 1300 }, { x: 1000, y: 100 }, { x: 1000, y: 1300 }
];

const enemyTypes = {
  normal: { color: [45, 80, 22], speed: 1, health: 100, reward: 10, xp: 10, size: 15, contactDamage: 8 },
  fast: { color: [200, 50, 50], speed: 2, health: 60, reward: 15, xp: 15, size: 12, contactDamage: 7 },
  runner: { color: [230, 70, 55], speed: 2.45, health: 65, reward: 16, xp: 16, size: 12, contactDamage: 7 },
  tank: { color: [77, 112, 22], speed: 0.7, health: 300, reward: 25, xp: 25, size: 25, contactDamage: 14 },
  spitter: { color: [150, 200, 50], speed: 0.8, health: 80, reward: 20, xp: 20, size: 14, shootRange: 300, shootRate: 1800, contactDamage: 7 },
  thrower: { color: [100, 150, 200], speed: 1.2, health: 120, reward: 22, xp: 22, size: 16, throwRange: 250, throwRate: 2500, contactDamage: 8 },
  bomber: { color: [245, 125, 35], speed: 1.8, health: 90, reward: 34, xp: 30, size: 14, explosionDamage: 180, isBomber: true },
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
  boss: { color: [145, 12, 12], speed: 0.55, health: 4200, reward: 900, xp: 650, size: 46, armor: 0.22, contactDamage: 28, shootRange: 440, shootRate: 900, slamRange: 120, slamRate: 4200, isBoss: true },
  bossButcher: { color: [170, 35, 35], speed: 0.66, health: 5100, reward: 1050, xp: 760, size: 48, armor: 0.16, contactDamage: 34, slamRange: 145, slamRate: 3800, isBoss: true },
  bossSpitter: { color: [105, 190, 45], speed: 0.58, health: 4550, reward: 1000, xp: 720, size: 45, armor: 0.12, contactDamage: 24, shootRange: 520, shootRate: 720, isBoss: true, isAcidRanger: true }
};

const rooms = new Map();

function nowMs() {
  return Date.now();
}

function distance(a, b, x2, y2) {
  const dx = a - x2;
  const dy = b - y2;
  return Math.sqrt(dx * dx + dy * dy);
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
  const pool = ['boss'];
  if (wave >= 20) pool.push('bossButcher');
  if (wave >= 30) pool.push('bossSpitter');
  return pool;
}

function createWorld() {
  return {
    serverTime: nowMs(),
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
    acidPools: []
  };
}

function getRoom(code) {
  const roomCode = String(code || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'STORE';
  if (!rooms.has(roomCode)) {
    rooms.set(roomCode, {
      code: roomCode,
      clients: new Map(),
      players: new Map(),
      hostId: null,
      latestWorld: createWorld(),
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

function worldSnapshot(room) {
  const world = room.latestWorld;
  return {
    ...world,
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
  const gate = spawnGates[Math.floor(Math.random() * spawnGates.length)];
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
    x: gate.x + Math.random() * 80 - 40,
    y: gate.y + Math.random() * 80 - 40,
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
  const candidates = [...room.players.values()]
    .filter((player) => nowMs() - player.lastSeen < 5000 && (player.health ?? 100) > 0)
    .map((player) => ({ entity: player, x: player.x, y: player.y, radius: 12, kind: 'player' }));
  if (includeStructures) {
    for (const wall of world.walls) candidates.push({ entity: wall, x: wall.x, y: wall.y, radius: wall.radius || 25, kind: 'structure' });
    for (const sentry of world.sentries) candidates.push({ entity: sentry, x: sentry.x, y: sentry.y, radius: sentry.radius || 15, kind: 'structure' });
    for (const building of world.buildings) candidates.push({ entity: building, x: building.x, y: building.y, radius: Math.max(building.width || 0, building.height || 0) / 2, kind: 'structure' });
  }
  if (!candidates.length) return null;
  return candidates.reduce((nearest, candidate) => {
    const d = distance(zombie.x, zombie.y, candidate.x, candidate.y);
    return !nearest || d < nearest.distance ? { ...candidate, distance: d } : nearest;
  }, null);
}

function damageZombie(zombie, amount) {
  let remaining = amount;
  if (zombie.shieldHealth > 0) {
    const absorbed = Math.min(zombie.shieldHealth, remaining);
    zombie.shieldHealth -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) zombie.health -= remaining * (1 - (zombie.armor || 0));
}

function pushBullet(world, x, y, angle, speed, damage, options = {}) {
  world.bullets.push({
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
    ownerId: options.ownerId
  });
}

function spawnRemoteShot(room, player, weapon) {
  const world = room.latestWorld;
  const angle = player.angle || 0;
  const originX = player.x + Math.cos(angle) * 15;
  const originY = player.y + Math.sin(angle) * 15;
  const pellets = weapon.pellets || 0;
  const fireOne = (spread) => pushBullet(world, originX, originY, angle + spread, weapon.speed || 8, weapon.damage || 20, {
    explosive: weapon.explosive,
    size: weapon.bulletSize || 4,
    ownerId: player.id
  });
  if (pellets) {
    for (let i = 0; i < pellets; i++) fireOne((Math.random() - 0.5) * 0.4);
  } else {
    fireOne(0);
  }
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
    let didAction = false;
    if ((z.type === 'spitter' || z.type === 'boss' || z.type === 'miniBoss' || z.isAcidRanger || z.isBoss || z.isMiniBoss) && z.shootRange && targetDist < z.shootRange) {
      didAction = true;
      if (now - z.lastShot > z.shootRate) {
        z.lastShot = now;
        const angle = Math.atan2(target.y - z.y, target.x - z.x);
        pushBullet(world, z.x, z.y, angle, 6, 20 * (z.damageScale || 1), { fromZombie: true, spitter: true, size: 8 });
      }
    } else if (z.type === 'thrower' && targetDist < z.throwRange) {
      didAction = true;
      if (now - z.lastShot > z.throwRate) {
        z.lastShot = now;
        const angle = Math.atan2(target.y - z.y, target.x - z.x);
        pushBullet(world, z.x, z.y, angle, 4, 30 * (z.damageScale || 1), { fromZombie: true, acid: true, size: 12 });
      }
    }

    if (!didAction) {
      if (z.isCharger && now - (z.lastCharge || 0) > z.chargeRate && targetDist < 330) {
        z.lastCharge = now;
        z.chargeUntil = now + z.chargeDuration;
      }
      const moveSpeed = (z.isCharger && now < (z.chargeUntil || 0) ? z.chargeSpeed : z.speed) * (dt / 16.67);
      if (targetDist <= z.size + target.radius) {
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
        z.x += ((target.x - z.x) / targetDist) * moveSpeed;
        z.y += ((target.y - z.y) / targetDist) * moveSpeed;
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
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * (dt / 16.67);
    b.y += b.vy * (dt / 16.67);
    if (b.x < 0 || b.x > 2000 || b.y < 0 || b.y > 1400) {
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
            player.health = Math.max(0, (player.health || 100) - b.damage);
            hit = true;
            break;
          }
        }
      }
      if (hit) world.bullets.splice(i, 1);
    } else {
      for (const z of world.zombies) {
        if (distance(b.x, b.y, z.x, z.y) < z.size) {
          if (b.explosive) {
            for (const nearby of world.zombies) {
              if (distance(b.x, b.y, nearby.x, nearby.y) < 95) damageZombie(nearby, b.damage * 0.5);
            }
          } else {
            damageZombie(z, b.damage);
          }
          world.bullets.splice(i, 1);
          break;
        }
      }
    }
  }
}

function updateSentries(room) {
  const world = room.latestWorld;
  const now = nowMs();
  for (let i = world.sentries.length - 1; i >= 0; i--) {
    const sentry = world.sentries[i];
    if (sentry.health <= 0) {
      world.sentries.splice(i, 1);
      continue;
    }
    if (sentry.isDisabled > now) continue;
    let closest = null;
    let closestDist = sentry.range || 260;
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
  world.drops.push({ x, y, type, life: 600 });
}

function cleanupWorld(world, dt) {
  world.walls = world.walls.filter((wall) => wall.health > 0);
  world.sentries = world.sentries.filter((sentry) => sentry.health > 0);
  world.buildings = world.buildings.filter((building) => building.health > 0);
  for (let i = world.drops.length - 1; i >= 0; i--) {
    world.drops[i].life -= dt / 16.67;
    if (world.drops[i].life <= 0) world.drops.splice(i, 1);
  }
}

function updateWaveState(room) {
  const world = room.latestWorld;
  const now = nowMs();
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

  updateWaveState(room);
  if (room.latestWorld.waveActive) {
    updateZombies(room, dt);
    updateBullets(room, dt);
    updateSentries(room);
    cleanupWorld(room.latestWorld, dt);
  }

  if (now - room.lastSnapshot >= SNAPSHOT_MS) {
    room.lastSnapshot = now;
    broadcast(room, { type: 'world', id: 'server', authoritative: true, room: room.code, world: worldSnapshot(room) });
  }
}

function handleAction(room, packet) {
  const action = packet.action || {};
  const world = room.latestWorld;
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
    target.push(action.entity);
    return;
  }
  if (action.kind === 'shot' && action.player && action.weapon) {
    spawnRemoteShot(room, action.player, action.weapon);
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
  console.log(`Use ws://localhost:${PORT}/room as the cloud relay URL.`);
});
