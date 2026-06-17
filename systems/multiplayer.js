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
            this.isHost = true;
            this.roomHostId = null;
            this.desiredHost = false;
            this.serverAuthoritative = false;
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
            this.syncTimer = setInterval(() => this.sendState(), 110);
            this.cleanupTimer = setInterval(() => this.cleanupPeers(), 1000);
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
                    this.receive(JSON.parse(event.data));
                } catch {
                    this.onStatus('BAD CLOUD PACKET', 'offline');
                }
            };
            this.onStatus('CONNECTING CLOUD', 'offline');
        }

        receive(packet) {
            if (!packet) return;
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
                if (this.serverAuthoritative || !this.isHost) this.onWorld(packet.world);
                return;
            }
            if (packet.type === 'action') {
                this.onAction(packet);
            }
        }

        sendState() {
            const packet = { type: 'state', id: this.localId, room: this.roomCode, state: this.getState() };
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
            if (this.channel) this.channel.close();
            if (this.socket) this.socket.close();
            this.syncTimer = null;
            this.cleanupTimer = null;
            this.channel = null;
            this.socket = null;
            this.isHost = true;
            this.serverAuthoritative = false;
            this.peers.clear();
            this.onPeers([]);
        }
    }

    window.LastShopperMultiplayer = LastShopperMultiplayer;
}());
