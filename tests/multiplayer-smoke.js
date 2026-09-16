const WebSocket = require('ws');

const room = `SMOKE${Date.now().toString(36).slice(-6)}`.toUpperCase();
const url = `ws://localhost:3000/room/${room}`;

function connect(id, wantsHost) {
  const socket = new WebSocket(url);
  const snapshots = [];
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${id} connection timed out`)), 4000);
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'hello', id, room, wantsHost }));
      socket.send(JSON.stringify({
        type: 'state', id, room,
        state: { name: id, x: 1000 + (wantsHost ? 0 : 40), y: 850, health: 100, maxHealth: 100, weapons: [{ id: 'pistol', owned: true }] }
      }));
    });
    socket.on('message', (raw) => {
      const packet = JSON.parse(raw);
      if (packet.latestWorld) snapshots.push(packet.latestWorld);
      if (packet.type === 'world' && packet.world) snapshots.push(packet.world);
      if (packet.type === 'server') {
        clearTimeout(timeout);
        resolve({ socket, snapshots });
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

(async () => {
  const host = await connect('smoke-host', true);
  const joiner = await connect('smoke-joiner', false);
  host.socket.send(JSON.stringify({ type: 'action', id: 'smoke-host', room, action: { kind: 'startGame' } }));
  await new Promise((resolve) => setTimeout(resolve, 4200));

  const hostWorld = host.snapshots.at(-1);
  const joinWorld = joiner.snapshots.at(-1);
  if (!hostWorld || !joinWorld) throw new Error('Both clients did not receive world snapshots');
  if (!hostWorld.gameStarted || !joinWorld.gameStarted) throw new Error('Shared game did not start');
  if (hostWorld.serverTime <= host.snapshots[0].serverTime) throw new Error('Server world clock did not advance');

  const hostIds = (hostWorld.zombies || []).map((zombie) => zombie.id).sort();
  const joinIds = (joinWorld.zombies || []).map((zombie) => zombie.id).sort();
  if (JSON.stringify(hostIds) !== JSON.stringify(joinIds)) throw new Error('Zombie snapshots diverged between clients');

  const blocked = (hostWorld.zombies || []).filter((zombie) =>
    (hostWorld.mapStructures || []).some((structure) => blockedByStructure(zombie, structure)));
  if (blocked.length) throw new Error(`${blocked.length} zombie(s) spawned inside structures`);

  host.socket.close();
  joiner.socket.close();
  console.log(JSON.stringify({
    room,
    clients: 2,
    wave: hostWorld.wave,
    zombies: hostIds.length,
    serverAdvancedMs: hostWorld.serverTime - host.snapshots[0].serverTime,
    dayTime: hostWorld.dayTime,
    result: 'PASS'
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
