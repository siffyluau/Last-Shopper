const { spawn } = require('child_process');
const WebSocket = require('ws');

const port = Number(process.env.PERF_PORT || 3210);
const durationMs = Number(process.env.PERF_DURATION_MS || 6000);
const zombieCount = Number(process.env.PERF_ZOMBIES || 240);
const projectileCount = Number(process.env.PERF_PROJECTILES || 0);
const sentryCount = Number(process.env.PERF_SENTRIES || 24);
const baseUrl = `http://127.0.0.1:${port}`;
const roomUrl = `ws://127.0.0.1:${port}/room/PERFTEST`;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error('Performance server did not start');
}

function connectPlayer(id, x) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(roomUrl);
    socket.once('open', () => {
      socket.send(JSON.stringify({
        type: 'state',
        id,
        state: {
          id,
          name: id,
          x,
          y: 720,
          angle: 0,
          health: 100,
          maxHealth: 100,
          weapons: [{ id: 'pistol', owned: true, upgradeLevel: 0 }]
        }
      }));
      resolve(socket);
    });
    socket.once('error', reject);
  });
}

async function run() {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), PERF_DEBUG: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stderr.on('data', (data) => process.stderr.write(data));
  try {
    await waitForServer();
    const host = await connectPlayer('perf-host', 1100);
    const joiner = await connectPlayer('perf-joiner', 1160);
    await delay(250);
    host.send(JSON.stringify({ type: 'action', id: 'perf-host', action: { kind: 'startGame' } }));
    host.send(JSON.stringify({
      type: 'action',
      id: 'perf-host',
      action: { kind: 'debugPopulate', zombies: zombieCount, projectiles: projectileCount, sentries: sentryCount }
    }));
    const stateTimer = setInterval(() => {
      host.send(JSON.stringify({ type: 'state', id: 'perf-host', state: { id: 'perf-host', x: 1100, y: 720, angle: 0 } }));
      joiner.send(JSON.stringify({ type: 'state', id: 'perf-joiner', state: { id: 'perf-joiner', x: 1160, y: 720, angle: Math.PI } }));
    }, 110);
    await delay(durationMs);
    clearInterval(stateTimer);
    const response = await fetch(`${baseUrl}/debug/perf`);
    const report = await response.json();
    console.log(JSON.stringify(report.rooms[0], null, 2));
    host.close();
    joiner.close();
  } finally {
    server.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
