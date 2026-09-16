# Multiplayer fix notes (2026-09-16)

Protocol bumped to `authoritative-world-v3` (`/healthz` reports it). No deploy changes needed on Render:
`npm install` + `npm start` as before.

## What was broken and why

* **No money / XP in multiplayer.** The server recorded kill rewards but the client never applied them
  (`killRewards` was stored and ignored). Wave-clear rewards, milestone upgrade cards and meta stats only
  ran inside the single-player wave loop.
* **Turrets could not be refuelled/upgraded/repaired.** Those buttons edited the local copy of a turret;
  the next server snapshot (every 50 ms) overwrote it, while the wood/metal was still spent.
* **Heals never applied** (medkits, health potions, level-ups): the server owns player health.
* **Supply drop / tech tier** purchases reverted the same way; the supply crate could be looted repeatedly.
* **Lag:** every snapshot re-sent full entity records, the whole loot/kill history (up to ~18 KB), unrounded
  floats, and every bullet position, at 20 Hz to every player. Nothing throttled slow connections, so
  snapshots queued up and the game drifted further behind. Local movement was also dragged backwards by a
  reconciliation rule that compared against a server position that is always RTT/2 old.
* Shots were dropped by a strict server fire-rate gate; bullets froze between waves; disruptors never
  EMP'd turrets; acid pools did not hurt players; traps/electric walls gave no kill credit.

## What changed

Server (`server.js`)
* Per-client reliable **event queue** in each snapshot: `killReward`, `loot`, `waveCleared`, `shot`,
  `buildRejected`, `actionRejected`, `respawned`, `supplyCollected`.
* **Delta snapshots**: full record the first time a client sees an entity, then only changed fields
  (rounded); bullets are spawn-once and extrapolated client-side; drops/acid pools/map structures use
  per-client add/remove; global fields only when they change.
* New actions: `refillTurret`, `upgradeTurret`, `repairStructure`, `repairAll`, `upgradeWall`,
  `runUpgrade`, `heal`, `upgradeTechTier`, validated `collectSupply`. Rejections refund the client.
* Player state carries `seq`, turret upgrades (auto-refill / speed), damage / fire-rate / armor
  multipliers, crit, lifesteal and pickup radius so potions, skills and workbench upgrades work online.
* Tolerant fire-rate gate, bullets/turrets/cleanup run between waves, disruptor EMP, acid pool damage,
  trap and electric-wall kill credit, direct-hit explosive damage.
* Backpressure (skip snapshots for a congested client, drop at 4 MB), ws heartbeat, reconnect keeps the
  player for 6 s, `perMessageDeflate`, `maxPayload`, hardened packet parsing, overload governor that
  lowers the snapshot rate only when a tick exceeds 30 ms.

Client (`client.js`, `systems/survival.js`, `systems/multiplayer.js`)
* Applies server events (killer gets the full reward, teammates get a 50% assist share, loot potions
  and skills still multiply), wave rewards + milestone cards in multiplayer, refunds on rejection.
* In-place entity merging (no per-snapshot object churn), linear interpolation, bullet extrapolation.
* Sequence-based position reconciliation (no more rubber-banding while moving).
* Turret/wall workbench buttons address entities by network id; turret cap counts only your turrets.
* Automatic reconnect with backoff (same player id, inventory kept), resend state when the tab returns.
* HUD only writes DOM nodes whose text changed; plain bullets no longer use shadow blur.

## Numbers (benchmark: 2 clients, 240 zombies, 24 turrets)

| Metric | Before | After |
| --- | ---: | ---: |
| Average snapshot (JSON) | 28.9 KB | 9.9 KB |
| Outgoing bandwidth, both clients | 1.15 MB/s | 92 KB/s on the wire |
| Idle snapshot (no enemies) | ~1.5 KB | 0.25 KB |

## Tests

```
npm run check
npm run smoke:economy        # spawns its own server; rewards, turret actions, deltas, reconnect, bad packets
npm run benchmark:performance
npm start & npm run smoke:multiplayer
```
