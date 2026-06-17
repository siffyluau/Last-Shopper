# Last Shopper

Browser survival game with room-based multiplayer.

## Local Single Player

You can still run the game as static files:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/index.html
```

## Local Multiplayer Server

Install dependencies:

```powershell
npm install
```

Start the server:

```powershell
npm start
```

Open the game:

```text
http://localhost:3000
```

For cloud multiplayer, enter this relay URL in the lobby:

```text
ws://localhost:3000/room
```

Use the same room code on each computer. WebSocket rooms are server-authoritative: `server.js` owns waves, zombie AI, enemy spawning, turrets, bullets, structures, traders, supply drops, and boss events. Clients render snapshots and send player state/build/shot actions.

Same-browser local rooms without a relay use `BroadcastChannel`. That mode is only for quick local testing. Because it has no server process, browser timer throttling can still affect whoever is locally simulating the room.

## Hosting Online

Option A: Deploy this whole folder as a Node web service.

1. Push the folder to GitHub.
2. Create a Node service on Render, Railway, Fly.io, or another Node host.
3. Use this build command:

```text
npm install
```

4. Set the start command to:

```text
npm start
```

5. Keep the server port controlled by the host. `server.js` listens on `process.env.PORT || 3000`, so Render can inject its own `PORT` automatically.
6. Open the service URL to play.
7. Use this relay URL in the lobby:

```text
wss://YOUR-SERVICE-DOMAIN/room
```

This repository includes `render.yaml` for Render Blueprint deployment with a single Node Web Service named `last-shopper`.

Option B: Static site plus separate relay.

1. Host `index.html`, `style.css`, `client.js`, and the `systems/` folder on a static host.
2. Deploy this same project as a Node relay somewhere else.
3. Put the relay URL in the lobby, for example:

```text
wss://YOUR-RELAY-DOMAIN/room
```

Static hosting alone will load the game, but friends on different computers need the WebSocket relay for online sync. Use the Node server for real multiplayer so the world keeps running even if a browser tab loses focus.

## Validation

Run:

```powershell
npm run check
```

Then browser-test a hosted URL and confirm:

- Lobby loads.
- Host and Join use the same room code.
- Players see each other.
- Host wave, zombies, structures, boss prep, trader, supply drops, walls, traps, and turrets sync.
