(function () {
    class LastShopperMultiplayer {
        constructor(options) {
            this.localId = options.localId;
            this.getState = options.getState;
            this.onPeers = options.onPeers;
            this.onStatus = options.onStatus;
            this.onWorld = options.onWorld || (() => {});
            this.onAction = options.onAction || (() => {});
            this.onHostChange = options.onHostChange || (() => {});
            this.roomCode = null;
            this.peers = new Map();
            this.channel = null;
            this.socket = null;
            this.syncTimer = null;
            this.cleanupTimer = null;
            this.pingTimer = null;
            this.isHost = true;
            this.roomHostId = null;
            this.desiredHost = false;
            this.serverAuthoritative = false;
            this.pingMs = 0;
            this.snapshotTimes = [];
            this.incomingByteSamples = [];
        }

        connect(roomCode, relayUrl, options = {}) {
            this.disconnect();
            this.roomCode = (roomCode || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'STORE';
            this.desiredHost = Boolean(options.host);
            if (relayUrl) {
                this.connectWebSocket(this.roomCode, relayUrl);
            } else {
                this.connectLocal(this.roomCode);
            }
            this.syncTimer = setInterval(() => this.sendState(), relayUrl ? 50 : 110);
            this.cleanupTimer = setInterval(() => this.cleanupPeers(), 1000);
            if (relayUrl) this.pingTimer = setInterval(() => {
                this.sendPacket({ type: 'ping', id: this.localId, sentAt: performance.now() });
            }, 2000);
            this.sendState();
        }

        connectLocal(roomCode) {
            if (!('BroadcastChannel' in window)) {
                this.onStatus('LOCAL FALLBACK', 'offline');
                return;
            }
            this.isHost = this.desiredHost;
            this.serverAuthoritative = false;
            this.onHostChange(this.isHost);
            this.channel = new BroadcastChannel(`last-shopper-${roomCode}`);
            this.channel.onmessage = (event) => this.receive(event.data);
            this.onStatus(`${this.isHost ? 'LOCAL HOST' : 'LOCAL CLIENT'} ${roomCode}`, 'online');
            this.sendPacket({ type: 'hello', id: this.localId, room: this.roomCode, wantsHost: this.desiredHost });
        }

        connectWebSocket(roomCode, relayUrl) {
            const base = relayUrl.replace(/\/$/, '');
            const url = `${base}/${encodeURIComponent(roomCode)}`;
            this.serverAuthoritative = true;
            this.isHost = false;
            this.onHostChange(false, 'server');
            this.socket = new WebSocket(url);
            this.socket.onopen = () => {
                this.onStatus(`CLOUD ROOM ${roomCode}`, 'online');
                this.sendPacket({ type: 'hello', id: this.localId, room: this.roomCode, wantsHost: this.desiredHost });
            };
            this.socket.onclose = () => this.onStatus('CLOUD DISCONNECTED', 'offline');
            this.socket.onerror = () => this.onStatus('CLOUD ERROR', 'offline');
            this.socket.onmessage = (event) => {
                try {
                    const receivedAt = performance.now();
                    this.incomingByteSamples.push({ at: receivedAt, bytes: typeof event.data === 'string' ? event.data.length : 0 });
                    this.receive(JSON.parse(event.data));
                } catch {
                    this.onStatus('BAD CLOUD PACKET', 'offline');
                }
            };
            this.onStatus('CONNECTING CLOUD', 'offline');
        }

        receive(packet) {
            if (!packet) return;
            if (packet.type === 'pong') {
                this.pingMs = Math.max(0, performance.now() - Number(packet.sentAt || performance.now()));
                return;
            }
            if (packet.type === 'server' || packet.type === 'host') {
                this.serverAuthoritative = Boolean(packet.authoritative);
                this.roomHostId = packet.hostId || this.roomHostId;
                const controlsRoom = this.roomHostId === this.localId;
                this.isHost = this.serverAuthoritative ? false : controlsRoom;
                this.onHostChange(controlsRoom, this.serverAuthoritative ? 'server' : this.roomHostId);
                if (packet.clientCount) {
                    this.onStatus(`${this.serverAuthoritative ? 'SERVER' : this.isHost ? 'HOSTING' : 'SYNCED'} ${this.roomCode} (${packet.clientCount})`, 'online');
                }
                if (packet.latestWorld && (this.serverAuthoritative || !this.isHost)) this.onWorld(packet.latestWorld);
                return;
            }
            if (packet.type === 'startGame') {
                this.onAction({ type: 'action', id: packet.id || 'server', room: this.roomCode, action: { kind: 'startGame' } });
                return;
            }
            if (packet.id === this.localId) return;
            if (packet.type === 'state') {
                this.peers.set(packet.id, { ...packet.state, id: packet.id, lastSeen: performance.now() });
                this.onPeers([...this.peers.values()]);
                return;
            }
            if (packet.type === 'world') {
                this.snapshotTimes.push(performance.now());
                if (this.serverAuthoritative || !this.isHost) this.onWorld(packet.world);
                return;
            }
            if (packet.type === 'action') {
                this.onAction(packet);
            }
        }

        sendState() {
            const fullState = this.getState();
            const now = performance.now();
            const loadoutSignature = JSON.stringify(fullState.weapons || []);
            const includeLoadout = loadoutSignature !== this.lastLoadoutSignature || now - (this.lastLoadoutSentAt || 0) > 1000;
            if (includeLoadout) {
                this.lastLoadoutSignature = loadoutSignature;
                this.lastLoadoutSentAt = now;
            }
            const state = { ...fullState };
            if (!includeLoadout) delete state.weapons;
            const packet = { type: 'state', id: this.localId, room: this.roomCode, state };
            this.sendPacket(packet);
        }

        sendWorld(world) {
            if (this.serverAuthoritative || !this.isHost) return;
            this.sendPacket({ type: 'world', id: this.localId, room: this.roomCode, world });
        }

        sendAction(action) {
            this.sendPacket({ type: 'action', id: this.localId, room: this.roomCode, action });
        }

        sendPacket(packet) {
            if (this.channel) this.channel.postMessage(packet);
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify(packet));
            }
        }

        getMetrics() {
            const cutoff = performance.now() - 1000;
            while (this.snapshotTimes.length && this.snapshotTimes[0] < cutoff) this.snapshotTimes.shift();
            while (this.incomingByteSamples.length && this.incomingByteSamples[0].at < cutoff) this.incomingByteSamples.shift();
            return {
                pingMs: this.pingMs,
                snapshotRate: this.snapshotTimes.length,
                incomingBytesPerSecond: this.incomingByteSamples.reduce((sum, sample) => sum + sample.bytes, 0)
            };
        }

        cleanupPeers() {
            const now = performance.now();
            let changed = false;
            for (const [id, peer] of this.peers) {
                if (now - peer.lastSeen > 3500) {
                    this.peers.delete(id);
                    changed = true;
                }
            }
            if (changed) this.onPeers([...this.peers.values()]);
        }

        disconnect() {
            if (this.syncTimer) clearInterval(this.syncTimer);
            if (this.cleanupTimer) clearInterval(this.cleanupTimer);
            if (this.pingTimer) clearInterval(this.pingTimer);
            if (this.channel) this.channel.close();
            if (this.socket) this.socket.close();
            this.syncTimer = null;
            this.cleanupTimer = null;
            this.pingTimer = null;
            this.channel = null;
            this.socket = null;
            this.isHost = true;
            this.serverAuthoritative = false;
            this.pingMs = 0;
            this.snapshotTimes.length = 0;
            this.incomingByteSamples.length = 0;
            this.lastLoadoutSignature = null;
            this.lastLoadoutSentAt = 0;
            this.peers.clear();
            this.onPeers([]);
        }
    }

    window.LastShopperMultiplayer = LastShopperMultiplayer;
}());
