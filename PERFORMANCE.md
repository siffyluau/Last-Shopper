# Multiplayer Performance

## Runtime targets

- Server simulation: 20 Hz fixed schedule
- Network snapshots: 20 Hz
- Zombie target selection: roughly 2-4 Hz, staggered per zombie
- Zombie path/detour checks: roughly 1-2 Hz, cached between checks
- Client rendering: browser refresh rate with timestamped interpolation
- Local input and shot effects: immediate, before server acknowledgement

## Reproducing the server benchmark

Run the benchmark from the project root:

```powershell
npm run benchmark:performance
```

The benchmark starts an isolated server, connects two WebSocket clients, and holds 240 zombies plus 24 sentries for six seconds. Set `PERF_ZOMBIES`, `PERF_PROJECTILES`, `PERF_SENTRIES`, or `PERF_DURATION_MS` to change the load.

For live development metrics, start the server with `PERF_DEBUG=1`. Slow ticks over 30 ms are rate-limited in the console, a five-second summary is logged, and detailed room metrics are available at `/debug/perf`. The debug endpoint and periodic logs are disabled in normal production runs.

Press `F3` in the game to show client FPS, ping, snapshot rate, inbound bandwidth, interpolation delay, and rendered entity counts.

## Measured comparison

Measurements used Node 24 on Windows with two clients, 240 zombies, and 24 sentries. Path/detour work was part of the original monolithic zombie-AI measurement, so it cannot be separated accurately in the baseline.

| Metric | Before | After |
| --- | ---: | ---: |
| Configured simulation rate | 40 Hz | 20 Hz |
| Sustained simulation rate | 32.16 Hz | 20.14 Hz |
| Average server tick | 5.31 ms | 2.16 ms |
| Worst server tick | 21.17 ms | 21.01 ms |
| Zombie AI + path/detour | 4.28 ms/tick | 0.83 ms/tick |
| Bullet collision | 0.15 ms/tick | 0.04 ms/tick |
| Snapshot construction/send | 0.64 ms/tick | 0.92 ms/tick |
| Average snapshot | 106.7 KB | 28.7 KB |
| Outgoing messages | 48.3/sec | 40.0/sec |
| Outgoing bandwidth | 3.42 MB/sec | 1.15 MB/sec |

The largest CPU improvement came from removing 40 Hz target/path recomputation and quadratic support-zombie scans. Network traffic stays well below the baseline through compact 20 Hz interest snapshots with static entity data sent only when an entity first enters a client's interest set. The 20 Hz rate is intentional: 10 Hz made movement feel delayed and allowed short-lived bullets to exist entirely between snapshots.

## Render hosting notes

Application optimization cannot remove internet latency. On Render, use a service region close to the players and inspect CPU, memory, event-loop delay, WebSocket reconnects, and `/debug/perf` in a temporary debug deployment before increasing instance size. Free or sleeping instances can add cold-start delay; sustained high event-loop delay with low measured tick cost points to host contention rather than game logic.
