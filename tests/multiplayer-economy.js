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
    const client = { id, socket, snapshots: [], events: [], sentries: new Map(), bullets: [], players: new Map(), world: {}, started: false, full: 0, seq: 1, x, y };
    const timeout = setTimeout(() => reject(new Error(`${id} timed out`)), 4000);
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
      client.snapshots.push(world);
      for (const field of ['gameStarted', 'wave', 'waveActive', 'techTier', 'workbenchLevel']) {
        if (world[field] !== undefined) client.world[field] = world[field];
      }
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

    // Only the server-recognized room host may start gameplay.
    joiner.action({ kind: 'startGame' });
    await delay(180);
    assert(!host.started && !joiner.started && !host.world.gameStarted, 'joiner was able to start the room');
    host.action({ kind: 'startGame' });
    await delay(200);
    assert(host.started && joiner.started && host.world.gameStarted, 'authoritative host start did not reach both clients');
    results.hostOnlyStart = 'ok';

    // Private resources and skill progression are server-owned and only sent to their owner.
    host.action({ kind: 'debugGrant', money: 20000, wood: 250, metal: 250, ammo: 500, parts: 30, skillPoints: 2, milestoneUpgradeCredits: 1 });
    await delay(180);
    let hostState = host.players.get('econ-host');
    assert(hostState.money >= 20000 && hostState.skillPoints === 2, `private progression grant did not sync: ${JSON.stringify(hostState)}`);
    assert(joiner.players.get('econ-host')?.money === undefined, 'host private economy leaked to joiner');
    host.sendState({ upgrades: { autoLoot: true, autoRefill: true, turretSpeed: true } });
    await delay(180);
    hostState = host.players.get('econ-host');
    assert(!hostState.upgrades.autoLoot && !hostState.upgrades.autoRefill && !hostState.upgrades.turretSpeed, 'client forged utility upgrades were trusted');
    host.action({ kind: 'buySkill', skillId: 'maxHealth' });
    await delay(180);
    hostState = host.players.get('econ-host');
    assert(hostState.skillPoints === 1 && hostState.skillLevels.maxHealth === 1, 'skill point purchase did not persist');
    assert(hostState.maxHealth === 120 && hostState.health === 120, `max-health skill did not apply: ${hostState.health}/${hostState.maxHealth}`);
    const moneyBeforeUtility = hostState.money;
    host.action({ kind: 'buyUtilityUpgrade', upgradeId: 'autoLoot' });
    await delay(180);
    hostState = host.players.get('econ-host');
    assert(hostState.upgrades.autoLoot && hostState.money === moneyBeforeUtility - 15000, 'utility upgrade was not charged and synced by the server');
    host.action({ kind: 'runUpgrade', id: 'caliber' });
    await delay(180);
    hostState = host.players.get('econ-host');
    assert(hostState.runUpgradeCounts.caliber === 1 && hostState.milestoneUpgradeCredits === 0, 'run upgrade was not server-owned');
    results.progression = 'ok';

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

    // 3. Build a canonical turret, refill from near and far, upgrade twice.
    const networkId = 'turret-econ-host-test';
    host.action({
      kind: 'build', buildKind: 'turret',
      entity: { name: 'Auto Turret', networkId, x: 1300, y: 450, radius: 15, damage: 9999, fireRate: 1, range: 260, speed: 10, health: 180, maxHealth: 180, ammo: 40, maxAmmo: 120, ownerId: 'econ-host', ownerName: 'H' }
    });
    await delay(300);
    let sentry = host.sentries.get(networkId);
    assert(sentry && sentry.ammo === 120, `turret not built from canonical data: ${JSON.stringify(sentry)}`);
    assert(Math.abs(sentry.damage - 28) < 0.1, `client forged turret damage was trusted: ${sentry.damage}`);
    host.action({ kind: 'debugSetSentry', networkId, ammo: 40 });
    await delay(160);
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

    // 4. Weapon, tech, and bench purchases are committed by the server.
    const moneyBeforeWeapon = host.players.get('econ-host').money;
    host.action({ kind: 'buyWeapon', weaponId: 'shotgun' });
    await delay(180);
    hostState = host.players.get('econ-host');
    const shotgun = hostState.weapons.find((weapon) => weapon.id === 'shotgun');
    assert(shotgun?.owned && shotgun.currentAmmo === 8, 'weapon purchase did not sync');
    assert(hostState.money === moneyBeforeWeapon - 170, 'weapon cost was not charged exactly once');
    host.action({ kind: 'upgradeTechTier', tier: 2 });
    await delay(180);
    assert(host.world.techTier === 2, `tech tier did not update: ${host.world.techTier}`);
    host.action({ kind: 'upgradeWorkbench' });
    await delay(180);
    assert(host.world.workbenchLevel === 2 && joiner.world.workbenchLevel === 2, 'workbench tier did not sync to the room');
    results.purchases = 'ok';

    // 5. Build rejection is reported without charging the authoritative economy.
    const woodBeforeRejectedBuild = host.players.get('econ-host').wood;
    host.action({ kind: 'build', buildKind: 'wall', entity: { networkId: 'wall-bad', x: 980, y: 615, radius: 25, health: 240, maxHealth: 240, ownerId: 'econ-host' } });
    await delay(250);
    assert(host.events.some((event) => event.kind === 'buildRejected' && event.networkId === 'wall-bad'), 'missing buildRejected');
    assert(host.players.get('econ-host').wood === woodBeforeRejectedBuild, 'rejected build charged resources');
    results.buildRejected = 'ok';

    // 6. Bullets are spawn-once deltas and preserve the client shot id for reconciliation.
    host.action({ kind: 'debugPopulate', zombies: 1, projectiles: 0, sentries: 0 });
    await delay(200);
    const shotId = 'econ-host:1';
    host.action({ kind: 'shot', weapon: { id: 'pistol' }, angle: 0, shotId, clientShotTime: Date.now() });
    await delay(400);
    const fullBullets = host.bullets.filter((bullet) => bullet.vx !== undefined);
    const idOnly = host.bullets.filter((bullet) => bullet.vx === undefined && Object.keys(bullet).length === 1);
    assert(fullBullets.length >= 1, 'no full bullet record seen');
    assert(fullBullets.filter((bullet) => bullet.shotId === shotId).length === 1, 'shot id did not map to exactly one authoritative pistol projectile');
    assert(idOnly.length >= 1, 'no id-only bullet delta seen');
    assert(joiner.events.filter((event) => event.kind === 'shot' && event.shotId === shotId).length === 1, 'joiner missing or duplicated shot event');
    assert(host.events.filter((event) => event.kind === 'shot' && event.shotId === shotId).length === 1, 'shooter missing or duplicated authoritative shot acknowledgement');
    results.bullets = 'ok';

    // 7. Snapshot hygiene and size.
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

    // 8. Reconnect with the same id keeps private progression and yields a full snapshot.
    joiner.action({ kind: 'debugGrant', skillPoints: 1 });
    await delay(120);
    joiner.action({ kind: 'buySkill', skillId: 'moveSpeed' });
    await delay(180);
    const beforeFull = joiner.full;
    joiner.socket.close();
    await delay(300);
    const rejoined = await connectPlayer('econ-joiner', 1150, 720, false);
    await delay(400);
    assert(rejoined.full >= 1, 'rejoin did not get a full snapshot');
    assert(rejoined.players.has('econ-host') && rejoined.players.has('econ-joiner'), 'rejoin lost players');
    assert(rejoined.players.get('econ-joiner')?.skillLevels?.moveSpeed === 1, 'rejoin lost private skill progression');
    assert(host.players.has('econ-joiner'), 'host lost the joiner during reconnect');
    results.reconnect = 'ok';
    rejoined.socket.close();

    // 9. Malformed packets do not crash the server.
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
