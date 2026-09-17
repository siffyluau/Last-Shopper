const { spawn } = require('child_process');
const WebSocket = require('ws');

const port = Number(process.env.GAMEPLAY_PORT || 3314);
const room = `RULES${Date.now().toString(36).slice(-5)}`.toUpperCase();
const httpUrl = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}/room/${room}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${httpUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Server did not start');
}

function foldList(map, entries, idField) {
  if (!entries) return;
  const seen = new Set();
  for (const entry of entries) {
    const id = entry[idField];
    if (!id) continue;
    seen.add(id);
    map.set(id, { ...(map.get(id) || {}), ...entry });
  }
  for (const id of [...map.keys()]) if (!seen.has(id)) map.delete(id);
}

function connect(id, wantsHost, x, y) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const client = {
      id, socket, x, y, seq: 1, started: false, world: {}, events: [],
      players: new Map(), zombies: new Map(), sentries: new Map(), traps: new Map(), buildings: new Map()
    };
    const timeout = setTimeout(() => reject(new Error(`${id} connection timed out`)), 4000);
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', id, room, wantsHost }));
      client.sendState = () => socket.send(JSON.stringify({
        type: 'state', id, room,
        state: {
          name: id, x: client.x, y: client.y, angle: 0, seq: client.seq++,
          weapons: [{ id: 'pistol', owned: true, upgradeLevel: 0 }]
        }
      }));
      client.action = (action) => socket.send(JSON.stringify({ type: 'action', id, room, action }));
      client.sendState();
    });
    socket.on('message', (raw) => {
      const packet = JSON.parse(raw);
      if (packet.type === 'server' && !client.ready) {
        client.ready = true;
        clearTimeout(timeout);
        resolve(client);
      }
      if (packet.type === 'startGame') client.started = true;
      if (packet.type !== 'world') return;
      const world = packet.world;
      for (const field of ['gameStarted', 'gameOver', 'wave', 'waveActive', 'techTier', 'workbenchLevel']) {
        if (world[field] !== undefined) client.world[field] = world[field];
      }
      for (const event of world.events || []) client.events.push(event);
      if (world.full) {
        client.players.clear();
        client.zombies.clear();
        client.sentries.clear();
        client.traps.clear();
        client.buildings.clear();
      }
      foldList(client.players, world.players, 'id');
      foldList(client.zombies, world.zombies, 'id');
      foldList(client.sentries, world.sentries, 'networkId');
      foldList(client.traps, world.traps, 'networkId');
      foldList(client.buildings, world.buildings, 'networkId');
    });
    socket.on('error', reject);
  });
}

async function run() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PERF_DEBUG: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  server.stdout.on('data', (data) => { log += data; });
  server.stderr.on('data', (data) => { log += data; });
  let stateTimer;
  const clients = [];
  try {
    await waitForServer();
    const host = await connect('rules-host', true, 1300, 400);
    const joiner = await connect('rules-joiner', false, 1150, 720);
    const third = await connect('rules-third', false, 1110, 750);
    clients.push(host, joiner, third);
    stateTimer = setInterval(() => clients.forEach((client) => client.sendState()), 100);

    host.action({ kind: 'startGame' });
    await delay(250);
    assert(clients.every((client) => client.started), 'authoritative start did not reach all three clients');

    host.action({ kind: 'debugGrant', money: 100000, wood: 1000, metal: 1000, parts: 100 });
    host.action({ kind: 'upgradeTechTier', tier: 2 });
    await delay(160);
    host.action({ kind: 'upgradeWorkbench' });
    await delay(220);
    assert(host.world.techTier === 2 && host.world.workbenchLevel === 2, 'test tech setup failed');

    const lockedTurretId = 'rules-gatling-locked';
    host.action({ kind: 'build', buildKind: 'turret', entity: { name: 'Gatling Turret', networkId: lockedTurretId, x: 1450, y: 450 } });
    await delay(180);
    assert(!host.sentries.has(lockedTurretId), 'station-gated turret built without its support building');
    assert(host.events.some((event) => event.kind === 'actionRejected' && event.networkId === lockedTurretId), 'missing support-building rejection');

    host.action({ kind: 'debugBuildStation', stationId: 'advancedTurretBench', x: 1600, y: 300 });
    await delay(180);
    const gatlingId = 'rules-gatling';
    host.action({ kind: 'build', buildKind: 'turret', entity: { name: 'Gatling Turret', networkId: gatlingId, x: 1450, y: 450 } });
    await delay(260);
    assert(host.sentries.get(gatlingId)?.name === 'Gatling Turret', 'Gatling Turret did not unlock after support building placement');

    const trapId = 'rules-spike';
    host.action({ kind: 'build', buildKind: 'trap', entity: { name: 'Spike Trap', networkId: trapId, x: 1450, y: 650 } });
    await delay(240);
    let trap = host.traps.get(trapId);
    assert(trap?.usesRemaining === 10 && trap.maxUses === 10, `trap did not start with 10 uses: ${JSON.stringify(trap)}`);
    host.action({ kind: 'upgradeTrap', networkId: trapId, stat: 'uses' });
    host.action({ kind: 'upgradeTrap', networkId: trapId, stat: 'damage' });
    await delay(260);
    trap = host.traps.get(trapId);
    assert(trap.maxUses === 15 && trap.usesRemaining === 15, 'trap charge upgrade did not sync');
    assert(Math.abs(trap.damage - 384) < 0.1, `trap damage upgrade wrong: ${trap.damage}`);

    host.action({ kind: 'debugBuildStation', stationId: 'potionHut', x: 1300, y: 400 });
    host.action({ kind: 'debugSetPlayer', x: 1300, y: 400, health: 30 });
    await delay(180);
    host.action({ kind: 'buyPotion', recipeId: 'heal_now' });
    await delay(240);
    let hostState = host.players.get(host.id);
    assert(hostState.health === 75, `Emergency Heal did not restore 45 HP: ${hostState.health}`);
    assert(host.events.some((event) => event.kind === 'healed' && event.source === 'Emergency Heal'), 'heal feedback event missing');

    host.action({ kind: 'debugGrant', milestoneUpgradeCredits: 1 });
    host.action({ kind: 'debugSetPlayer', health: 30 });
    await delay(120);
    host.action({ kind: 'runUpgrade', id: 'vitality' });
    await delay(240);
    hostState = host.players.get(host.id);
    assert(hostState.maxHealth === 125 && hostState.health === 55, `Vitality heal/max HP wrong: ${hostState.health}/${hostState.maxHealth}`);

    host.action({ kind: 'upgradeTechTier', tier: 3 });
    await delay(180);
    host.action({ kind: 'upgradeWorkbench' });
    await delay(240);
    assert(host.world.techTier === 3 && host.world.workbenchLevel === 3, 'Life Contract tech setup failed');

    hostState = host.players.get(host.id);
    const moneyBeforeLives = hostState.money;
    host.action({ kind: 'buyLife' });
    await delay(220);
    hostState = host.players.get(host.id);
    assert(hostState.lifePurchases === 1, 'first Life Contract did not sync');
    assert(hostState.money === moneyBeforeLives - 10000, `first Life Contract cost was not $10,000: ${moneyBeforeLives - hostState.money}`);
    host.action({ kind: 'buyLife' });
    await delay(220);
    hostState = host.players.get(host.id);
    assert(hostState.lifePurchases === 2, 'second Life Contract did not sync');
    assert(hostState.money === moneyBeforeLives - 25000, `second Life Contract cost was not $15,000: ${moneyBeforeLives - 10000 - hostState.money}`);

    host.action({ kind: 'debugSpawnBoss', wave: 10 });
    await delay(260);
    const boss = [...host.zombies.values()].find((zombie) => zombie.isBoss);
    assert(boss && boss.maxHealth > 20000, `three-player boss scaling too low: ${boss?.maxHealth}`);

    host.action({ kind: 'debugSetPlayer', emergencyRespawns: 4, downed: true, respawnDelayMs: 100 });
    await delay(180);
    host.action({ kind: 'requestRespawn' });
    await delay(260);
    hostState = host.players.get(host.id);
    assert(!hostState.downed && hostState.emergencyRespawns === 5, 'emergency revive did not work after expanding the revive limit');

    joiner.action({ kind: 'debugSetPlayer', emergencyRespawns: 5, downed: true, finalWindowMs: 220 });
    await delay(420);
    let joinerState = joiner.players.get(joiner.id);
    assert(joinerState.downed && joinerState.eliminated, 'player was not eliminated after final teammate-revive window');
    host.action({ kind: 'debugStartNextWave' });
    await delay(260);
    joinerState = joiner.players.get(joiner.id);
    assert(!joinerState.downed && !joinerState.eliminated && joinerState.emergencyRespawns === 5, 'eliminated player did not return at next wave');

    host.action({ kind: 'debugSetPlayer', emergencyRespawns: 7, downed: true, finalWindowMs: 220 });
    joiner.action({ kind: 'debugSetPlayer', emergencyRespawns: 5, downed: true, finalWindowMs: 220 });
    third.action({ kind: 'debugSetPlayer', emergencyRespawns: 5, downed: true, finalWindowMs: 220 });
    await delay(500);
    assert(clients.every((client) => client.world.gameOver === true), 'full-party elimination did not end the authoritative run');
    assert(host.events.some((event) => event.kind === 'gameOver'), 'game-over event missing');

    console.log(JSON.stringify({
      clients: clients.length,
      bossHealth: boss.maxHealth,
      reusableTrap: `${trap.usesRemaining}/${trap.maxUses}`,
      emergencyRevivesUsed: hostState.emergencyRespawns,
      lifePurchases: hostState.lifePurchases,
      reviveLimit: 7,
      result: 'PASS'
    }, null, 2));
  } catch (error) {
    console.error(`SERVER LOG:\n${log.slice(-2500)}`);
    throw error;
  } finally {
    if (stateTimer) clearInterval(stateTimer);
    for (const client of clients) client.socket.close();
    server.kill('SIGTERM');
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
