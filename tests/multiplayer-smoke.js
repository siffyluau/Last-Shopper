const WebSocket = require('ws');

const room = `SMOKE${Date.now().toString(36).slice(-6)}`.toUpperCase();
const port = Number(process.env.SMOKE_PORT || 3000);
const url = `ws://localhost:${port}/room/${room}`;

function connect(id, wantsHost) {
  const socket = new WebSocket(url);
  const snapshots = [];
  const events = [];
  const structures = new Map();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${id} connection timed out`)), 4000);
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', id, room, wantsHost }));
      socket.send(JSON.stringify({
        type: 'state', id, room,
        state: { name: id, x: 1000 + (wantsHost ? 0 : 40), y: 850, health: 100, maxHealth: 100, seq: 1, weapons: [{ id: 'pistol', owned: true }] }
      }));
    });
    socket.on('message', (raw) => {
      const packet = JSON.parse(raw);
      if (packet.type === 'world' && packet.world) {
        snapshots.push(packet.world);
        for (const event of packet.world.events || []) events.push(event);
        for (const structure of packet.world.mapStructures || []) structures.set(structure.id, structure);
        for (const removed of packet.world.mapStructuresRemoved || []) structures.delete(removed);
      }
      if (packet.type === 'server') {
        clearTimeout(timeout);
        resolve({ socket, snapshots, events, structures });
      }
    });
    socket.on('error', reject);
  });
}

function blockedByStructure(zombie, structure) {
  const halfW = structure.width / 2 + zombie.size + 12;
  const halfH = structure.height / 2 + zombie.size + 12;
  return Math.abs(zombie.x - structure.x) < halfW && Math.abs(zombie.y - structure.y) < halfH;
}

// Snapshots are deltas: fold them into a per-zombie map so we can read full records.
function foldZombies(snapshots) {
  const zombies = new Map();
  for (const snapshot of snapshots) {
    if (snapshot.full) zombies.clear();
    const seen = new Set();
    for (const entry of snapshot.zombies || []) {
      seen.add(entry.id);
      zombies.set(entry.id, { ...(zombies.get(entry.id) || {}), ...entry });
    }
    for (const id of [...zombies.keys()]) if (!seen.has(id)) zombies.delete(id);
  }
  return zombies;
}

(async () => {
  const host = await connect('smoke-host', true);
  const joiner = await connect('smoke-joiner', false);
  host.socket.send(JSON.stringify({ type: 'action', id: 'smoke-host', room, action: { kind: 'startGame' } }));
  await new Promise((resolve) => setTimeout(resolve, 700));
  host.socket.send(JSON.stringify({
    type: 'action',
    id: 'smoke-host',
    room,
    action: { kind: 'shot', weapon: { id: 'pistol' }, angle: 0, clientTime: Date.now() }
  }));
  await new Promise((resolve) => setTimeout(resolve, 3500));

  const hostWorld = host.snapshots.at(-1);
  const joinWorld = joiner.snapshots.at(-1);
  if (!hostWorld || !joinWorld) throw new Error('Both clients did not receive world snapshots');
  const hostStarted = host.snapshots.some((snapshot) => snapshot.gameStarted === true);
  const joinStarted = joiner.snapshots.some((snapshot) => snapshot.gameStarted === true);
  if (!hostStarted || !joinStarted) throw new Error('Shared game did not start');
  if (hostWorld.serverTime <= host.snapshots[0].serverTime) throw new Error('Server world clock did not advance');
  const shotSynced = joiner.events.some((event) => event.kind === 'shot' && event.shooterId === 'smoke-host');
  if (!shotSynced) throw new Error('Server-validated shot event did not reach the second client');
  if (host.events.some((event) => event.kind === 'shot' && event.shooterId === 'smoke-host')) throw new Error('Shooter received its own shot event');

  const hostZombies = foldZombies(host.snapshots);
  const joinZombies = foldZombies(joiner.snapshots);
  const hostIds = [...hostZombies.keys()].sort();
  const joinIds = [...joinZombies.keys()].sort();
  if (JSON.stringify(hostIds) !== JSON.stringify(joinIds)) throw new Error('Zombie snapshots diverged between clients');
  for (const zombie of hostZombies.values()) {
    if (!Number.isFinite(zombie.size) || !Number.isFinite(zombie.x)) throw new Error(`Zombie ${zombie.id} missing full record fields`);
  }
  const forbidden = ['lootEvents', 'killRewards', 'shotEvents', 'nextSpawnAt', 'cycleStartedAt'].filter((key) => key in hostWorld);
  if (forbidden.length) throw new Error(`Snapshot leaks internal fields: ${forbidden.join(', ')}`);

  const blocked = [...hostZombies.values()].filter((zombie) =>
    [...host.structures.values()].some((structure) => blockedByStructure(zombie, structure)));
  if (blocked.length) throw new Error(`${blocked.length} zombie(s) spawned inside structures`);

  host.socket.close();
  joiner.socket.close();
  console.log(JSON.stringify({
    room,
    clients: 2,
    wave: hostWorld.wave ?? host.snapshots.findLast((snapshot) => snapshot.wave !== undefined)?.wave,
    zombies: hostIds.length,
    shotVisualSynced: shotSynced,
    serverAdvancedMs: hostWorld.serverTime - host.snapshots[0].serverTime,
    lastSnapshotBytes: JSON.stringify(hostWorld).length,
    result: 'PASS'
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
