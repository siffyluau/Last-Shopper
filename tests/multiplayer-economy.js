// Integration test for the v3 multiplayer protocol: rewards, turret actions, delta snapshots, reconnect, hardening.
const { spawn } = require('child_process');
const WebSocket = require('ws');

const port = Number(process.env.ECON_PORT || 3312);
const baseUrl = `http://127.0.0.1:${port}`;
const room = 'ECON';
const roomUrl = `ws://127.0.0.1:${port}/room/${room}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return response.json();
    } catch {}
    await delay(100);
  }
  throw new Error('Server did not start');
}

function connectPlayer(id, x, y, wantsHost) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(roomUrl);
    const client = { id, socket, snapshots: [], events: [], sentries: new Map(), bullets: [], players: new Map(), full: 0, seq: 1, x, y };
    const timeout = setTimeout(() => reject(new Error(`${id} timed out`)), 4000);
    socket.on('message', (raw) => {
      const packet = JSON.parse(raw);
      if (packet.type === 'server' && !client.ready) {
        client.ready = true;
        clearTimeout(timeout);
        resolve(client);
      }
      if (packet.type !== 'world') return;
      const world = packet.world;
      client.snapshots.push(world);
      if (world.full) {
        client.full += 1;
        client.sentries.clear();
        client.players.clear();
      }
      for (const event of world.events || []) client.events.push(event);
      const seenSentries = new Set();
      for (const entry of world.sentries || []) {
        seenSentries.add(entry.networkId);
        client.sentries.set(entry.networkId, { ...(client.sentries.get(entry.networkId) || {}), ...entry });
      }
      for (const id of [...client.sentries.keys()]) if (!seenSentries.has(id)) client.sentries.delete(id);
      for (const entry of world.players || []) client.players.set(entry.id, { ...(client.players.get(entry.id) || {}), ...entry });
      client.bullets.push(...(world.bullets || []));
    });
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', id, room, wantsHost }));
      client.sendState = (state = {}) => socket.send(JSON.stringify({
        type: 'state', id, room,
        state: { name: id, x: client.x, y: client.y, angle: 0, health: 100, maxHealth: 100, seq: client.seq++, weapons: [{ id: 'pistol', owned: true, upgradeLevel: 0 }], ...state }
      }));
      client.action = (action) => socket.send(JSON.stringify({ type: 'action', id, room, action }));
      client.sendState();
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
  let serverLog = '';
  server.stdout.on('data', (data) => { serverLog += data; });
  server.stderr.on('data', (data) => { serverLog += data; });
  const results = {};
  try {
    const health = await waitForServer();
    assert(health.protocol === 'authoritative-world-v3', 'healthz protocol is not v3');

    const host = await connectPlayer('econ-host', 1300, 400, true);
    const joiner = await connectPlayer('econ-joiner', 1150, 720, false);
    const stateTimer = setInterval(() => { host.sendState(); joiner.sendState(); }, 100);
    await delay(200);
    host.action({ kind: 'startGame' });
    await delay(200);

    // 1. Kill rewards: one event per client, credited to the host via debugKillAll.
    host.action({ kind: 'debugPopulate', zombies: 2, projectiles: 0, sentries: 0 });
    await delay(300);
    host.action({ kind: 'debugKillAll' });
    await delay(600);
    const hostKills = host.events.filter((event) => event.kind === 'killReward');
    const joinKills = joiner.events.filter((event) => event.kind === 'killReward');
    assert(hostKills.length === 2, `host expected 2 killReward events, got ${hostKills.length}`);
    assert(joinKills.length === 2, `joiner expected 2 killReward events, got ${joinKills.length}`);
    assert(hostKills.every((event) => event.ownerId === 'econ-host' && event.money >= 1 && event.xp > 0), 'killReward payload wrong');
    assert(new Set(hostKills.map((event) => event.id)).size === 2, 'duplicate killReward ids');
    results.killRewards = 'ok';

    // 2. Wave cleared reaches both clients.
    assert(host.events.some((event) => event.kind === 'waveCleared'), 'host missing waveCleared');
    assert(joiner.events.some((event) => event.kind === 'waveCleared'), 'joiner missing waveCleared');
    results.waveCleared = 'ok';

    // 3. Build a turret, refill from near and far, upgrade twice.
    const networkId = 'turret-econ-host-test';
    host.action({
      kind: 'build', buildKind: 'turret',
      entity: { networkId, x: 1300, y: 450, radius: 15, damage: 28, fireRate: 170, range: 260, speed: 10, health: 180, maxHealth: 180, ammo: 40, maxAmmo: 120, ownerId: 'econ-host', ownerName: 'H' }
    });
    await delay(300);
    let sentry = host.sentries.get(networkId);
    assert(sentry && sentry.ammo === 40, `turret not built or wrong ammo: ${JSON.stringify(sentry)}`);
    joiner.action({ kind: 'refillTurret', networkId });
    await delay(300);
    assert(joiner.events.some((event) => event.kind === 'actionRejected' && event.action === 'refillTurret'), 'far refill was not rejected');
    host.action({ kind: 'refillTurret', networkId });
    await delay(300);
    sentry = host.sentries.get(networkId);
    assert(sentry.ammo === 120, `near refill failed: ammo ${sentry.ammo}`);
    host.action({ kind: 'upgradeTurret', networkId, stat: 'damage' });
    host.action({ kind: 'upgradeTurret', networkId, stat: 'damage' });
    await delay(300);
    sentry = host.sentries.get(networkId);
    assert(sentry.upgradeLevels && sentry.upgradeLevels.damage === 2, `upgrade levels wrong: ${JSON.stringify(sentry.upgradeLevels)}`);
    assert(Math.abs(sentry.damage - 28 * 1.44) < 0.1, `upgrade damage wrong: ${sentry.damage}`);
    host.action({ kind: 'upgradeWall', networkId: 'nope', stage: 1 });
    await delay(200);
    assert(host.events.some((event) => event.kind === 'actionRejected' && event.action === 'upgradeWall'), 'missing wall rejection');
    results.turretActions = 'ok';

    // 4. Build rejection refunds via event (inside the shop rectangle).
    host.action({ kind: 'build', buildKind: 'wall', entity: { networkId: 'wall-bad', x: 980, y: 615, radius: 25, health: 240, maxHealth: 240, ownerId: 'econ-host' } });
    await delay(250);
    assert(host.events.some((event) => event.kind === 'buildRejected' && event.networkId === 'wall-bad'), 'missing buildRejected');
    results.buildRejected = 'ok';

    // 5. Bullets are spawn-once deltas; a shot only produces an event for the other client.
    host.action({ kind: 'debugPopulate', zombies: 1, projectiles: 0, sentries: 0 });
    await delay(200);
    host.action({ kind: 'shot', weapon: { id: 'pistol' }, angle: 0 });
    await delay(400);
    const fullBullets = host.bullets.filter((bullet) => bullet.vx !== undefined);
    const idOnly = host.bullets.filter((bullet) => bullet.vx === undefined && Object.keys(bullet).length === 1);
    assert(fullBullets.length >= 1, 'no full bullet record seen');
    assert(idOnly.length >= 1, 'no id-only bullet delta seen');
    assert(joiner.events.some((event) => event.kind === 'shot' && event.shooterId === 'econ-host'), 'joiner missing shot event');
    assert(!host.events.some((event) => event.kind === 'shot'), 'host received its own shot event');
    results.bullets = 'ok';

    // 6. Snapshot hygiene and size.
    host.action({ kind: 'debugKillAll' });
    await delay(1500);
    const last = host.snapshots.at(-1);
    for (const key of ['lootEvents', 'killRewards', 'shotEvents', 'nextSpawnAt', 'cycleStartedAt', 'lastPowerRelayTick']) {
      assert(!(key in last), `snapshot leaks ${key}`);
    }
    const idleBytes = JSON.stringify(last).length;
    assert(idleBytes < 1500, `idle snapshot too large: ${idleBytes}`);
    assert(!('lastSeen' in (last.players?.[0] || {})), 'players still carry lastSeen');
    results.idleSnapshotBytes = idleBytes;

    // 7. Reconnect with the same id keeps the player and yields a full snapshot.
    const beforeFull = joiner.full;
    joiner.socket.close();
    await delay(300);
    const rejoined = await connectPlayer('econ-joiner', 1150, 720, false);
    await delay(400);
    assert(rejoined.full >= 1, 'rejoin did not get a full snapshot');
    assert(rejoined.players.has('econ-host') && rejoined.players.has('econ-joiner'), 'rejoin lost players');
    assert(host.players.has('econ-joiner'), 'host lost the joiner during reconnect');
    results.reconnect = 'ok';
    rejoined.socket.close();

    // 8. Malformed packets do not crash the server.
    host.socket.send(JSON.stringify({ type: 'action', id: 'econ-host', action: { kind: 'build', entity: 'x' } }));
    host.socket.send(JSON.stringify({ type: 'state', id: 'econ-host', state: { x: 'NaN', y: {}, weapons: 'q', upgrades: 5, maxHealth: -3 } }));
    host.socket.send(JSON.stringify({ type: 'action', id: 'econ-host', action: { kind: 'upgradeTurret', networkId: {}, stat: [] } }));
    host.socket.send(JSON.stringify({ type: 'action', id: 'econ-host', action: null }));
    host.socket.send('not json');
    host.socket.send(JSON.stringify({ type: 'state', id: 'x'.repeat(5000), state: {} }));
    await delay(400);
    const healthAfter = await fetch(`${baseUrl}/healthz`);
    assert(healthAfter.ok, 'server died after malformed packets');
    assert(host.snapshots.at(-1) !== last, 'snapshots stopped after malformed packets');
    results.hardening = 'ok';

    clearInterval(stateTimer);
    host.socket.close();
    const report = await (await fetch(`${baseUrl}/debug/perf`)).json();
    results.serverTickEmaMs = Number(report.rooms[0]?.tickEmaMs?.toFixed?.(2) || 0);
    console.log(JSON.stringify({ ...results, result: 'PASS' }, null, 2));
  } catch (error) {
    console.error('SERVER LOG:\n' + serverLog.slice(-2000));
    throw error;
  } finally {
    server.kill('SIGTERM');
    setTimeout(() => process.exit(process.exitCode || 0), 200).unref();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
