(function () {
    const content = LastShopperContent;

    function hasCost(player, cost) {
        return (!cost.money || player.money >= cost.money)
            && (!cost.wood || player.wood >= cost.wood)
            && (!cost.metal || player.metal >= cost.metal)
            && (!cost.parts || player.rareTurretParts >= cost.parts);
    }

    function payCost(player, cost) {
        player.money -= cost.money || 0;
        player.wood -= cost.wood || 0;
        player.metal -= cost.metal || 0;
        player.rareTurretParts -= cost.parts || 0;
    }

    function refundCost(player, cost) {
        if (!cost) return;
        player.money += cost.money || 0;
        player.wood += cost.wood || 0;
        player.metal += cost.metal || 0;
        player.rareTurretParts += cost.parts || 0;
    }

    function costLabel(cost) {
        cost = cost || {};
        const parts = [];
        if (cost.money) parts.push(`$${cost.money}`);
        if (cost.wood) parts.push(`${cost.wood} wood`);
        if (cost.metal) parts.push(`${cost.metal} metal`);
        if (cost.parts) parts.push(`${cost.parts} rare part${cost.parts === 1 ? '' : 's'}`);
        return parts.join(' / ') || 'Free';
    }

    function costChips(player, cost) {
        cost = cost || {};
        const entries = [
            ['money', '$', ''],
            ['wood', '', ' wood'],
            ['metal', '', ' metal'],
            ['parts', '', ' parts']
        ];
        return entries
            .filter(([key]) => cost[key])
            .map(([key, prefix, suffix]) => {
                const value = key === 'parts' ? player.rareTurretParts : player[key];
                const affordable = value >= cost[key];
                return `<span class="workbench-cost-item ${affordable ? 'affordable' : 'unaffordable'}">${prefix}${cost[key]}${suffix}</span>`;
            }).join('') || '<span class="workbench-cost-item affordable">Free</span>';
    }

    function roman(level) {
        return ['I', 'II', 'III'][level - 1] || level;
    }

    Object.assign(game, {
        playSfx: function (name) {
            this.audio?.play(name);
        },
        loadMetaProgression: function () {
            try {
                const stored = JSON.parse(localStorage.getItem('lastShopperMeta') || '{}');
                this.metaProgression = {
                    ...this.metaProgression,
                    ...stored
                };
            } catch {
                this.metaProgression = { ...this.metaProgression };
            }
            this.selectedSkinId = this.metaProgression.selectedSkinId || 'shopper';
        },

        saveMetaProgression: function () {
            localStorage.setItem('lastShopperMeta', JSON.stringify(this.metaProgression));
        },

        setupLobby: function () {
            playerNameInput.value = this.metaProgression.playerName || 'The Shopper';
            roomCodeInput.value = new URLSearchParams(location.search).get('room') || this.roomCode;
            cloudRelayInput.value = new URLSearchParams(location.search).get('ws') || localStorage.getItem('lastShopperRelay') || '';
            this.populateSkinList();
            this.updateSkinPreview();
            this.updateLobbyMeta();
            this.updatePartyList();
            this.discoverSameOriginRelay();
        },

        discoverSameOriginRelay: async function () {
            if (cloudRelayInput.value || !location.host) return;
            try {
                const response = await fetch('/healthz', { cache: 'no-store' });
                const health = response.ok ? await response.json() : null;
                if (health?.service !== 'last-shopper') return;
                cloudRelayInput.value = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/room`;
            } catch {
                // Static Sites deployments use a separately configured relay URL.
            }
        },

        applyLobbySelections: function () {
            const name = playerNameInput.value.trim() || 'The Shopper';
            this.metaProgression.playerName = name;
            this.metaProgression.selectedSkinId = this.selectedSkinId;
            this.player.name = name;
            this.player.skinId = this.selectedSkinId;
            this.saveMetaProgression();
        },

        requestStartGame: function () {
            this.applyLobbySelections();
            if (this.multiplayer?.roomCode) {
                if (!this.isRoomHost) {
                    this.setMultiplayerStatus('Waiting for host to start...', 'offline');
                    return;
                }
                this.setMultiplayerStatus('Host starting game...', 'online');
                this.multiplayer.sendAction({ kind: 'startGame' });
                this.enterGameFromLobby();
                return;
            }
            this.enterGameFromLobby();
        },

        enterGameFromLobby: function () {
            this.applyLobbySelections();
            this.roomStarted = true;
            lobbyScreen.classList.add('hidden');
            gameContainer.classList.remove('hidden');
            this.start();
        },

        isInputBlocked: function () {
            return Boolean(
                this.player.downed ||
                this.waitingForReward ||
                this.craftingOpen ||
                this.shopOpen ||
                this.workbenchOpen ||
                this.skillsOpen ||
                this.zombieIndexOpen ||
                this.traderOpen ||
                this.buildingOpen
            );
        },

        updateMouseFromEvent: function (event) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width ? canvas.width / rect.width : 1;
            const scaleY = rect.height ? canvas.height / rect.height : 1;
            this.mouse.x = (event.clientX - rect.left) * scaleX;
            this.mouse.y = (event.clientY - rect.top) * scaleY;
            this.updateMouseWorld();
        },

        updateMouseWorld: function () {
            this.mouse.worldX = this.mouse.x + this.camera.x;
            this.mouse.worldY = this.mouse.y + this.camera.y;
        },

        getSurvivorRank: function () {
            return 1
                + Math.floor((this.metaProgression.totalKills || 0) / 50)
                + Math.floor((this.metaProgression.highestWave || 0) / 5)
                + (this.metaProgression.bossesDefeated || 0) * 2;
        },

        getSkin: function (id) {
            return content.skins.find((skin) => skin.id === id) || content.skins[0];
        },

        isSkinUnlocked: function (skin) {
            const unlock = skin.unlock;
            if (!unlock || unlock.type === 'free') return true;
            if (unlock.type === 'kills') return (this.metaProgression.totalKills || 0) >= unlock.value;
            if (unlock.type === 'wave') return (this.metaProgression.highestWave || 0) >= unlock.value;
            if (unlock.type === 'builds') return (this.metaProgression.defensesBuilt || 0) >= unlock.value;
            if (unlock.type === 'bosses') return (this.metaProgression.bossesDefeated || 0) >= unlock.value;
            return false;
        },

        selectSkin: function (id) {
            const skin = this.getSkin(id);
            if (!this.isSkinUnlocked(skin)) return;
            this.selectedSkinId = id;
            this.metaProgression.selectedSkinId = id;
            this.player.skinId = id;
            this.saveMetaProgression();
            this.populateSkinList();
            this.updateSkinPreview();
            this.updatePartyList();
        },

        populateSkinList: function () {
            skinList.innerHTML = '';
            content.skins.forEach((skin) => {
                const unlocked = this.isSkinUnlocked(skin);
                const card = document.createElement('button');
                card.className = `skin-card ${skin.id === this.selectedSkinId ? 'selected' : ''} ${unlocked ? '' : 'locked'}`;
                card.disabled = !unlocked;
                card.innerHTML = `
                    <div class="skin-swatch" style="background:linear-gradient(90deg, ${skin.colors.body} 0 50%, ${skin.colors.shirt} 50% 100%); border-color:${skin.colors.accent}"></div>
                    <h3>${skin.name}</h3>
                    <p>${unlocked ? skin.description : skin.unlock.label}</p>
                `;
                card.onclick = () => this.selectSkin(skin.id);
                skinList.appendChild(card);
            });
        },

        updateSkinPreview: function () {
            const skin = this.getSkin(this.selectedSkinId);
            skinPreview.style.background = `linear-gradient(180deg, ${skin.colors.body}, ${skin.colors.shirt})`;
            skinPreview.style.borderColor = skin.colors.accent;
            skinPreviewInitial.textContent = (playerNameInput.value.trim() || 'P1').slice(0, 2).toUpperCase();
            selectedSkinName.textContent = skin.name;
            selectedSkinDesc.textContent = skin.description;
        },

        updateLobbyMeta: function () {
            metaHighestWave.textContent = this.metaProgression.highestWave || 0;
            metaTotalKills.textContent = this.metaProgression.totalKills || 0;
            metaBosses.textContent = this.metaProgression.bossesDefeated || 0;
            metaBuilds.textContent = this.metaProgression.defensesBuilt || 0;
            lobbyRank.textContent = `RANK ${this.getSurvivorRank()}`;
            const next = content.skins.find((skin) => !this.isSkinUnlocked(skin));
            nextUnlockLabel.textContent = next ? next.unlock.label : 'All skins unlocked';
        },

        setupMultiplayer: function () {
            if (!window.LastShopperMultiplayer) return;
            this.multiplayer = new LastShopperMultiplayer({
                localId: this.localPlayerId,
                getState: () => this.getMultiplayerState(),
                onPeers: (peers) => {
                    if (this.gameStarted && this.multiplayer?.serverAuthoritative) return;
                    this.remotePlayers = peers;
                    this.team.playerCount = 1 + peers.length;
                    this.updatePartyList();
                },
                onStatus: (text, mode) => this.setMultiplayerStatus(text, mode),
                onWorld: (world) => this.applyWorldSnapshot(world),
                onAction: (packet) => this.handleMultiplayerAction(packet),
                onHostChange: (isHost, source) => {
                    this.isRoomHost = Boolean(isHost);
                    if (source === 'server' && !this.isRoomHost && !this.gameStarted) {
                        this.setMultiplayerStatus('Waiting for host to start...', 'online');
                    }
                    this.updatePartyList();
                }
            });
        },

        hostRoom: function () {
            const code = (roomCodeInput.value || Math.random().toString(36).slice(2, 7)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
            roomCodeInput.value = code;
            this.isRoomHost = true;
            this.connectRoom(code);
            this.setMultiplayerStatus('Host room ready. Start when the party is in.', 'online');
        },

        joinRoom: function () {
            const code = (roomCodeInput.value || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
            roomCodeInput.value = code;
            this.isRoomHost = false;
            this.connectRoom(code);
            this.setMultiplayerStatus('Waiting for host to start...', 'online');
        },

        connectRoom: function (code) {
            this.applyLobbySelections();
            this.roomCode = code || 'STORE';
            const relay = cloudRelayInput.value.trim();
            if (relay) localStorage.setItem('lastShopperRelay', relay);
            if (this.multiplayer) this.multiplayer.connect(this.roomCode, relay, { host: this.isRoomHost });
            this.updatePartyList();
        },

        copyRoomInvite: async function () {
            const code = (roomCodeInput.value || this.roomCode || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
            const relay = cloudRelayInput.value.trim();
            const params = new URLSearchParams({ room: code });
            if (relay) params.set('ws', relay);
            const invite = `${location.origin}${location.pathname}?${params.toString()}`;
            try {
                await navigator.clipboard.writeText(invite);
                this.setMultiplayerStatus('Invite copied. Send it to your squad.', 'online');
            } catch {
                this.setMultiplayerStatus(`Invite: ${invite}`, 'online');
            }
        },

        syncMultiplayer: function () {
            if (!this.multiplayer || !this.gameStarted) return;
            if (this.isWorldHost()) {
                const now = performance.now();
                if (!this.lastWorldSync || now - this.lastWorldSync > 120) {
                    this.lastWorldSync = now;
                    this.multiplayer.sendWorld(this.getWorldSnapshot());
                }
            }
        },

        isWorldHost: function () {
            if (this.multiplayer?.serverAuthoritative) return false;
            return !this.multiplayer || !this.multiplayer.roomCode || this.multiplayer.isHost;
        },

        getMultiplayerState: function () {
            return {
                name: this.player.name || this.metaProgression.playerName || 'The Shopper',
                skinId: this.player.skinId || this.selectedSkinId,
                x: this.player.x,
                y: this.player.y,
                angle: this.player.angle,
                health: this.player.health,
                maxHealth: this.player.maxHealth,
                downed: Boolean(this.player.downed),
                wave: this.wave,
                level: this.player.level,
                weapons: this.weapons.map((weapon) => ({
                    id: weapon.id,
                    owned: Boolean(weapon.owned),
                    upgradeLevel: weapon.upgradeLevel || 0
                })),
                isHost: this.isRoomHost,
                gameStarted: this.gameStarted
            };
        },

        getWorldSnapshot: function () {
            return {
                wave: this.wave,
                zombiesKilled: this.zombiesKilled,
                totalZombiesInWave: this.totalZombiesInWave,
                waveActive: this.waveActive,
                bossesToSpawn: this.bossesToSpawn,
                miniBossesToSpawn: this.miniBossesToSpawn,
                escortsToSpawn: this.escortsToSpawn,
                currentWavePlan: this.currentWavePlan,
                techTier: this.techTier,
                preparationActive: this.preparationActive,
                preparationEndsIn: this.preparationActive ? Math.max(0, this.preparationEndsAt - performance.now()) : 0,
                preparationEvent: this.preparationEvent,
                supplyDrop: this.supplyDrop,
                trader: this.trader,
                zombies: this.zombies,
                sentries: this.sentries,
                walls: this.walls,
                traps: this.traps,
                buildings: this.buildings,
                mapSeed: this.mapSeed,
                mapStructures: this.mapStructures,
                lootEvents: this.lootEvents,
                lootBeacon: this.lootBeacon,
                drops: this.drops,
                acidPools: this.acidPools,
                gameStarted: this.gameStarted
            };
        },

        mergeNetworkEntities: function (current, incoming) {
            const previousById = new Map((current || []).filter((entry) => entry.id).map((entry) => [entry.id, entry]));
            return (incoming || []).map((entry) => {
                const previous = entry.id ? previousById.get(entry.id) : null;
                if (!previous) return { ...entry, networkX: entry.x, networkY: entry.y };
                const teleported = Math.hypot(entry.x - previous.x, entry.y - previous.y) > 240;
                return {
                    ...previous,
                    ...entry,
                    x: teleported ? entry.x : previous.x,
                    y: teleported ? entry.y : previous.y,
                    networkX: entry.x,
                    networkY: entry.y
                };
            });
        },

        applyMapStructureStates: function (states) {
            if (!states?.length || !this.mapStructures?.length) return;
            const structuresById = new Map(this.mapStructures.map((structure) => [structure.id, structure]));
            for (const state of states) {
                const structure = structuresById.get(state.id);
                if (!structure) continue;
                Object.assign(structure.door, state.door || {});
                const windowsById = new Map((structure.windows || []).map((entry) => [entry.id, entry]));
                for (const windowState of state.windows || []) {
                    const entry = windowsById.get(windowState.id);
                    if (entry) Object.assign(entry, windowState);
                }
                if (structure.loot) structure.loot.claimed = Boolean(state.lootClaimed);
            }
        },

        advanceNetworkInterpolation: function () {
            if (!this.multiplayer?.serverAuthoritative) return;
            const smooth = (entities, alpha) => {
                for (const entity of entities || []) {
                    if (!Number.isFinite(entity.networkX) || !Number.isFinite(entity.networkY)) continue;
                    entity.x += (entity.networkX - entity.x) * alpha;
                    entity.y += (entity.networkY - entity.y) * alpha;
                }
            };
            smooth(this.zombies, 0.34);
            smooth(this.bullets, 0.58);
            smooth(this.remotePlayers, 0.42);
        },

        applyWorldSnapshot: function (world) {
            if (!world || this.isWorldHost()) return;
            const wasDowned = Boolean(this.player.downed);
            this.serverTime = world.serverTime || this.serverTime;
            this.dayTime = Number.isFinite(world.dayTime) ? world.dayTime : this.dayTime;
            this.dayNumber = world.dayNumber || this.dayNumber;
            if (world.gameStarted && !this.gameStarted) {
                this.setMultiplayerStatus(world.wave > 0 ? 'Joining active game...' : 'Host starting game...', 'online');
                this.enterGameFromLobby();
            }
            this.wave = world.wave || 0;
            this.zombiesKilled = world.zombiesKilled || 0;
            this.totalZombiesInWave = world.totalZombiesInWave || 0;
            this.waveActive = Boolean(world.waveActive);
            this.bossesToSpawn = world.bossesToSpawn || 0;
            this.miniBossesToSpawn = world.miniBossesToSpawn || 0;
            this.escortsToSpawn = world.escortsToSpawn || 0;
            this.currentWavePlan = world.currentWavePlan || this.currentWavePlan;
            this.techTier = world.techTier || this.techTier;
            this.bossDefeats = world.bossDefeats || 0;
            this.killRewards = world.killRewards || [];
            this.preparationActive = Boolean(world.preparationActive);
            this.preparationEvent = world.preparationEvent || null;
            this.preparationEndsAt = this.preparationActive ? performance.now() + (world.preparationEndsIn || 0) : 0;
            this.supplyDrop = world.supplyDrop || null;
            this.trader = world.trader || null;
            if (this.multiplayer?.serverAuthoritative) {
                this.zombies = this.mergeNetworkEntities(this.zombies, world.zombies || []);
                this.bullets = this.mergeNetworkEntities(this.bullets, world.bullets || []);
            } else {
                this.zombies = world.zombies || [];
                this.bullets = world.bullets || [];
            }
            this.sentries = world.sentries || [];
            this.walls = world.walls || [];
            this.traps = world.traps || [];
            this.buildings = world.buildings || [];
            this.mapSeed = world.mapSeed || this.mapSeed;
            if (world.mapStructures) this.mapStructures = world.mapStructures;
            this.applyMapStructureStates(world.mapStructureStates);
            this.lootEvents = world.lootEvents || [];
            this.lootBeacon = world.lootBeacon || null;
            this.applyLootEvents(this.lootEvents);
            this.drops = world.drops || [];
            this.acidPools = world.acidPools || [];
            if (world.players) {
                const localServerPlayer = world.players.find((player) => player.id === this.localPlayerId);
                if (localServerPlayer) {
                    this.player.health = localServerPlayer.health ?? this.player.health;
                    this.player.maxHealth = localServerPlayer.maxHealth ?? this.player.maxHealth;
                    this.player.downed = Boolean(localServerPlayer.downed);
                    this.player.downedAt = localServerPlayer.downedAt || 0;
                    this.player.respawnAt = localServerPlayer.respawnAt || 0;
                    this.player.giveUpAt = localServerPlayer.giveUpAt || 0;
                    this.player.reviveProgress = localServerPlayer.reviveProgress || 0;
                    this.player.reviverId = localServerPlayer.reviverId || null;
                }
                this.remotePlayers = this.mergeNetworkEntities(
                    this.remotePlayers,
                    world.players.filter((player) => player.id !== this.localPlayerId)
                ).map((player) => ({ ...player, lastSeen: performance.now() }));
                this.team.playerCount = Math.max(1, world.players.length);
                const partySignature = world.players.map((player) => `${player.id}:${player.name}:${player.health}:${player.downed}`).join('|');
                if (partySignature !== this.lastPartySignature) {
                    this.lastPartySignature = partySignature;
                    this.updatePartyList();
                }
            }
            this.updateDownedUi();
            if (!wasDowned && this.player.downed) this.playSfx?.('downed');
            if (wasDowned && !this.player.downed) this.playSfx?.('revive');
        },

        getNearbyDownedTeammate: function () {
            let nearest = null;
            for (const teammate of this.remotePlayers || []) {
                if (!teammate.downed) continue;
                const distance = this.dist(this.player.x, this.player.y, teammate.x, teammate.y);
                if (distance <= 78 && (!nearest || distance < nearest.distance)) nearest = { ...teammate, distance };
            }
            return nearest;
        },

        requestReviveTick: function (targetId) {
            if (!targetId || this.player.downed || !this.multiplayer?.roomCode) return;
            const now = performance.now();
            if (now - (this.lastReviveRequest || 0) < 110) return;
            this.lastReviveRequest = now;
            this.multiplayer.sendAction({ kind: 'revive', targetId });
        },

        updateRevival: function () {
            if (this.player.downed) {
                this.keys = {};
                this.mouse.isDown = false;
                this.updateDownedUi();
                if (!this.multiplayer?.serverAuthoritative && this.player.respawnAt && Date.now() >= this.player.respawnAt) {
                    this.reviveLocalPlayer();
                }
                return;
            }
            const teammate = this.getNearbyDownedTeammate();
            if (teammate && this.keys.e) this.requestReviveTick(teammate.id);
        },

        updateDownedUi: function () {
            if (!this.player.downed) {
                downedOverlay.classList.add('hidden');
                downedOverlay.classList.remove('flex');
                return;
            }
            const seconds = Math.max(0, Math.ceil(((this.player.giveUpAt || this.player.respawnAt || Date.now()) - Date.now()) / 1000));
            const progress = Math.min(100, ((this.player.reviveProgress || 0) / 2500) * 100);
            downedStatus.textContent = this.player.reviverId
                ? 'A teammate is pulling you back up. Stay with them.'
                : 'A teammate can hold [E] beside you to revive.';
            reviveProgress.style.width = `${progress}%`;
            downedRespawnText.textContent = seconds > 0
                ? `Emergency shop recovery available in ${seconds}s.`
                : 'Emergency recovery is ready.';
            respawnButton.disabled = seconds > 0;
            downedOverlay.classList.remove('hidden');
            downedOverlay.classList.add('flex');
        },

        enterLocalDownedState: function () {
            if (this.player.downed) return;
            this.player.health = 0;
            this.player.downed = true;
            this.player.downedAt = Date.now();
            this.player.respawnAt = Date.now() + 6000;
            this.player.reviveProgress = 0;
            this.updateDownedUi();
            if (this.playSfx) this.playSfx('downed');
        },

        reviveLocalPlayer: function () {
            this.player.health = Math.max(45, Math.ceil(this.player.maxHealth * 0.45));
            this.player.downed = false;
            this.player.downedAt = 0;
            this.player.respawnAt = 0;
            this.player.reviveProgress = 0;
            this.player.x = this.shop.interactionX;
            this.player.y = this.shop.interactionY + 70;
            this.updateDownedUi();
            if (this.playSfx) this.playSfx('revive');
        },

        requestRespawn: function () {
            if (!this.player.downed) return;
            if (this.multiplayer?.serverAuthoritative) {
                this.multiplayer.sendAction({ kind: 'requestRespawn' });
            } else {
                this.reviveLocalPlayer();
            }
        },

        leaveToLobby: function () {
            this.gameStarted = false;
            this.gameOver = false;
            this.roomStarted = false;
            this.keys = {};
            this.mouse.isDown = false;
            this.cancelPlacing?.();
            this.toggleCrafting(false);
            this.toggleShop(false);
            this.toggleWorkbench(false);
            this.toggleSkills(false);
            this.toggleTrader(false);
            this.toggleBuilding(false);
            this.multiplayer?.disconnect();
            this.resetGame();
            downedOverlay.classList.add('hidden');
            downedOverlay.classList.remove('flex');
            gameOverModal.classList.add('hidden');
            gameOverModal.classList.remove('flex');
            gameContainer.classList.add('hidden');
            lobbyScreen.classList.remove('hidden');
            this.setMultiplayerStatus('LOCAL READY', 'offline');
            this.updatePartyList();
        },

        drawDayNight: function () {
            const time = Number.isFinite(this.dayTime) ? this.dayTime : 0.34;
            const daylight = Math.max(0, Math.sin((time - 0.25) * Math.PI * 2));
            const darkness = Math.min(0.68, (1 - daylight) * 0.68);
            if (darkness > 0.03) {
                const dusk = Math.abs(time - 0.25) < 0.08 || Math.abs(time - 0.75) < 0.08;
                ctx.save();
                ctx.fillStyle = dusk
                    ? `rgba(48,24,30,${darkness * 0.72})`
                    : `rgba(4,10,24,${darkness})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const addLight = (x, y, radius, color) => {
                    const screenX = x - this.camera.x;
                    const screenY = y - this.camera.y;
                    const glow = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
                    glow.addColorStop(0, color);
                    glow.addColorStop(0.35, color.replace(/[^,]+\)$/, '0.12)'));
                    glow.addColorStop(1, 'rgba(0,0,0,0)');
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.fillStyle = glow;
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
                    ctx.fill();
                };
                addLight(this.player.x, this.player.y, 150, 'rgba(255,232,170,0.30)');
                addLight(this.shop.x, this.shop.y + 30, 260, 'rgba(255,154,55,0.22)');
                for (const sentry of this.sentries || []) addLight(sentry.x, sentry.y, 80, 'rgba(255,120,45,0.12)');
                ctx.restore();
            }
            if (worldClock) {
                const totalMinutes = Math.floor(time * 24 * 60);
                const hour = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
                const minute = String(totalMinutes % 60).padStart(2, '0');
                worldClock.textContent = `DAY ${this.dayNumber || 1} / ${hour}:${minute}`;
            }
        },

        drawNavigationHud: function () {
            const enemies = this.zombies || [];
            if (!this.gameStarted || !enemies.length || this.player.downed) return;

            const radarX = 18;
            const radarY = 18;
            const radarSize = 126;
            const radarRange = 820;
            const center = radarSize / 2;
            ctx.save();
            ctx.fillStyle = 'rgba(12,10,9,.88)';
            ctx.strokeStyle = 'rgba(249,115,22,.72)';
            ctx.lineWidth = 2;
            ctx.fillRect(radarX, radarY, radarSize, radarSize);
            ctx.strokeRect(radarX, radarY, radarSize, radarSize);
            ctx.beginPath();
            ctx.rect(radarX + 4, radarY + 4, radarSize - 8, radarSize - 8);
            ctx.clip();
            ctx.strokeStyle = 'rgba(120,113,108,.28)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(radarX + center, radarY + 7);
            ctx.lineTo(radarX + center, radarY + radarSize - 7);
            ctx.moveTo(radarX + 7, radarY + center);
            ctx.lineTo(radarX + radarSize - 7, radarY + center);
            ctx.stroke();

            for (const enemy of enemies) {
                const dx = enemy.x - this.player.x;
                const dy = enemy.y - this.player.y;
                const distance = Math.hypot(dx, dy);
                const scale = Math.min(1, distance / radarRange);
                const angle = Math.atan2(dy, dx);
                const px = radarX + center + Math.cos(angle) * scale * (center - 10);
                const py = radarY + center + Math.sin(angle) * scale * (center - 10);
                ctx.fillStyle = enemies.length === 1 ? '#fb923c' : enemy.isBoss ? '#fbbf24' : '#ef4444';
                ctx.beginPath();
                ctx.arc(px, py, enemies.length === 1 ? 4.5 : enemy.isBoss ? 4 : 2.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#fafaf9';
            ctx.beginPath();
            ctx.moveTo(radarX + center, radarY + center - 6);
            ctx.lineTo(radarX + center - 5, radarY + center + 5);
            ctx.lineTo(radarX + center + 5, radarY + center + 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.fillStyle = '#a8a29e';
            ctx.font = '700 10px "Chakra Petch"';
            ctx.textAlign = 'left';
            ctx.fillText(`THREAT RADAR  ${enemies.length}`, radarX + 7, radarY + radarSize + 15);
            ctx.restore();

            if (enemies.length !== 1) return;
            const target = enemies[0];
            const targetX = target.x - this.camera.x;
            const targetY = target.y - this.camera.y;
            const margin = 72;
            if (targetX >= margin && targetX <= canvas.width - margin && targetY >= margin && targetY <= canvas.height - margin) return;

            const playerX = this.player.x - this.camera.x;
            const playerY = this.player.y - this.camera.y;
            const dx = targetX - playerX;
            const dy = targetY - playerY;
            const angle = Math.atan2(dy, dx);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const tx = cos > 0 ? (canvas.width - margin - playerX) / cos : cos < 0 ? (margin - playerX) / cos : Infinity;
            const ty = sin > 0 ? (canvas.height - margin - playerY) / sin : sin < 0 ? (margin - playerY) / sin : Infinity;
            const travel = Math.max(0, Math.min(tx, ty));
            const arrowX = playerX + cos * travel;
            const arrowY = playerY + sin * travel;
            const pulse = 1 + Math.sin(performance.now() / 150) * 0.12;
            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(angle);
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#f97316';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(18, 0);
            ctx.lineTo(-10, -12);
            ctx.lineTo(-4, 0);
            ctx.lineTo(-10, 12);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.rotate(-angle);
            ctx.fillStyle = '#fff7ed';
            ctx.font = '800 11px "Chakra Petch"';
            ctx.textAlign = 'center';
            ctx.fillText(`LAST INFECTED  ${Math.round(Math.hypot(dx, dy) / 10)}m`, 0, -22);
            ctx.restore();
        },

        updateLocalDayNight: function () {
            if (this.multiplayer?.serverAuthoritative) return;
            const now = performance.now();
            if (!this.lastDayNightTick) this.lastDayNightTick = now;
            const elapsed = Math.min(100, now - this.lastDayNightTick);
            this.lastDayNightTick = now;
            this.dayTime = (this.dayTime + elapsed / 480000) % 1;
            if (this.dayTime < (this.previousDayTime || this.dayTime)) this.dayNumber = (this.dayNumber || 1) + 1;
            this.previousDayTime = this.dayTime;
        },

        applyLootEvents: function (events) {
            if (!this.appliedLootEvents) this.appliedLootEvents = new Set();
            for (const event of events || []) {
                if (!event || event.playerId !== this.localPlayerId || this.appliedLootEvents.has(event.id)) continue;
                this.appliedLootEvents.add(event.id);
                if (event.type === 'money') this.player.money += event.amount || 0;
                else if (event.type === 'wood') this.player.wood += event.amount || 1;
                else if (event.type === 'metal') this.player.metal += event.amount || 1;
                else if (event.type === 'ammo') this.player.reserveAmmo += event.amount || 20;
                else if (event.type === 'medkit') this.player.health = Math.min(this.player.maxHealth, this.player.health + (event.amount || 30));
            }
        },

        broadcastBuildAction: function (kind, entity) {
            if (!this.multiplayer || !this.multiplayer.roomCode) return;
            this.multiplayer.sendAction({
                kind: 'build',
                buildKind: kind,
                entity,
                x: entity.x,
                y: entity.y,
                requestedBy: this.localPlayerId
            });
        },

        broadcastShotAction: function (weapon, angle) {
            if (!this.multiplayer || !this.multiplayer.roomCode || this.isWorldHost()) return;
            this.multiplayer.sendAction({
                kind: 'shot',
                player: {
                    id: this.localPlayerId,
                    name: this.player.name,
                    x: this.player.x,
                    y: this.player.y,
                    angle
                },
                weapon: {
                    id: weapon.id,
                    upgradeLevel: weapon.upgradeLevel || 0,
                    damage: this.getPlayerBulletDamage(weapon.damage),
                    speed: weapon.speed,
                    pellets: weapon.pellets || 0,
                    explosive: weapon.explosive,
                    bulletSize: weapon.bulletSize || 4
                }
            });
        },

        handleMultiplayerAction: function (packet) {
            if (!packet || !packet.action) return;
            const action = packet.action;
            if (action.kind === 'startGame') {
                this.setMultiplayerStatus('Host starting game...', 'online');
                this.enterGameFromLobby();
                return;
            }
            if (!this.isWorldHost()) return;
            if (action.kind === 'build' && action.entity) {
                const target = action.buildKind === 'turret'
                    ? this.sentries
                    : action.buildKind === 'wall'
                        ? this.walls
                        : action.buildKind === 'trap'
                            ? this.traps
                            : action.buildKind === 'building'
                                ? this.buildings
                                : null;
                if (!target) return;
                if (target.some((entry) => entry.networkId && entry.networkId === action.entity.networkId)) return;
                if (this.getPlacementValidation) {
                    const validation = this.getPlacementValidation(action.buildKind, action.entity, action.entity.x, action.entity.y);
                    if (!validation.ok) return;
                }
                target.push(action.entity);
                return;
            }
            if (action.kind === 'toggleDoor') {
                const structure = (this.mapStructures || []).find((entry) => entry.id === action.structureId);
                if (structure && !structure.door.destroyed) structure.door.open = !structure.door.open;
                return;
            }
            if (action.kind === 'openStructureLoot') {
                const structure = (this.mapStructures || []).find((entry) => entry.id === action.structureId);
                if (!structure || structure.loot.claimed) return;
                structure.loot.claimed = true;
                ['money', 'ammo', 'wood', 'metal'].forEach((type) => {
                    this.drops.push({
                        x: structure.loot.x + Math.random() * 34 - 17,
                        y: structure.loot.y + Math.random() * 34 - 17,
                        type,
                        life: 1800
                    });
                });
                return;
            }
            if (action.kind === 'shot' && action.player && action.weapon) {
                this.spawnRemoteShot(action.player, action.weapon);
            }
        },

        spawnRemoteShot: function (player, weapon) {
            const angle = player.angle || 0;
            const originX = player.x + Math.cos(angle) * 15;
            const originY = player.y + Math.sin(angle) * 15;
            const pellets = weapon.pellets || 0;
            const fireOne = (spread) => {
                this.bullets.push({
                    x: originX,
                    y: originY,
                    vx: Math.cos(angle + spread) * weapon.speed,
                    vy: Math.sin(angle + spread) * weapon.speed,
                    damage: weapon.damage,
                    explosive: weapon.explosive,
                    pierce: weapon.pierce || 0,
                    size: weapon.bulletSize,
                    ownerId: player.id
                });
            };
            if (pellets) {
                for (let i = 0; i < pellets; i++) fireOne((Math.random() - 0.5) * 0.4);
            } else {
                fireOne(0);
            }
        },

        setMultiplayerStatus: function (text, mode) {
            multiplayerStatus.textContent = text;
            multiplayerStatus.classList.toggle('online', mode === 'online');
            multiplayerStatus.classList.toggle('offline', mode !== 'online');
        },

        updatePartyList: function () {
            const localName = playerNameInput.value.trim() || this.player.name || 'The Shopper';
            const localSlot = `<div class="party-slot active"><b>P1</b><span>${localName}</span><em>${this.isRoomHost ? 'Host' : this.gameStarted ? 'In Run' : 'Waiting'}</em></div>`;
            const remoteSlots = this.remotePlayers.map((player, index) => `
                <div class="party-slot"><b>P${index + 2}</b><span>${player.name || 'Shopper'}</span><em>${player.isHost ? 'Host' : `Wave ${player.wave || 0}`}</em></div>
            `).join('');
            partyList.innerHTML = localSlot + remoteSlots;
        },

        toggleZombieIndex: function (isOpen) {
            this.zombieIndexOpen = Boolean(isOpen);
            this.mouse.isDown = false;
            if (this.zombieIndexOpen) {
                this.populateZombieIndex();
                zombieIndexModal.classList.remove('hidden');
                zombieIndexModal.classList.add('flex');
                zombieIndexSearch.focus();
            } else {
                zombieIndexModal.classList.add('hidden');
                zombieIndexModal.classList.remove('flex');
            }
        },

        setZombieIndexCategory: function (category) {
            this.zombieIndexCategory = category;
            this.populateZombieIndex();
        },

        getZombieIndexEntries: function () {
            const metadata = {
                normal: ['Common', 1, 'The baseline parking-lot shambler.', 'No trick: kite and conserve ammo.', 'Cash, XP, common salvage.'],
                fast: ['Common', 2, 'A faster infected that pressures reload windows.', 'Walls and spike traps buy time.', 'More cash and XP than normal.'],
                runner: ['Common', 3, 'A sprinting shopper that closes distance fast.', 'Shotgun bursts or early turret focus.', 'Light cash, XP, and ammo drops.'],
                tank: ['Common', 4, 'Slow heavy infected with a large health pool.', 'Use walls, focus fire, and turret crossfire.', 'Good cash and material drops.'],
                spitter: ['Special', 5, 'Keeps range and fires acid projectiles.', 'Keep moving sideways and break line pressure.', 'Cash, XP, and ammo chance.'],
                thrower: ['Special', 14, 'Throws arcing acid over defenses.', 'Spread structures out and push it quickly.', 'Cash and metal chance.'],
                bomber: ['Special', 7, 'Explodes when it reaches a player or structure.', 'Shoot it before it touches walls or turrets.', 'High cash and explosive salvage.'],
                sapper: ['Special', 6, 'Ignores survivors while defenses are standing and detonates on structures.', 'Intercept it before it reaches the relay, turret, or outer wall.', 'High-risk cash reward.'],
                stalker: ['Special', 6, 'Flanks around the player instead of taking the direct path.', 'Keep moving and avoid fighting alone in open lanes.', 'Cash, XP, and ammo chance.'],
                shield: ['Special', 8, 'Carries a shield that absorbs damage first.', 'Flank with traps or sustained turret fire.', 'Cash, XP, and shield scrap.'],
                armored: ['Special', 9, 'Armored plating reduces incoming damage.', 'Upgrade turret damage and use explosives.', 'Metal-heavy rewards.'],
                acidRanger: ['Special', 9, 'Long-range acid shooter.', 'Close distance or outrange with rifle/turrets.', 'Ammo and cash chance.'],
                healerZombie: ['Special', 7, 'Restores nearby infected.', 'Kill it before tanks and bosses.', 'Cash, XP, and medkit chance.'],
                healer: ['Special', 7, 'Legacy healer variant that supports the horde.', 'Prioritize it immediately.', 'Cash and XP.'],
                engineer: ['Special', 11, 'Adds shields to nearby infected.', 'Break formations with explosives.', 'Metal and rare part chance.'],
                splitter: ['Special', 11, 'Splits into smaller enemies on death.', 'Finish children before they surround you.', 'Extra XP but extra pressure.'],
                charger: ['Special', 12, 'Charges at targets in short bursts.', 'Bait charges into strong walls.', 'Good cash and XP.'],
                leech: ['Special', 12, 'Heals itself when it lands melee hits.', 'Kite it and avoid prolonged contact.', 'Cash and medkit chance.'],
                disruptor: ['Special', 16, 'EMP infected that threatens electronics.', 'Keep turrets spread and kill it early.', 'Cash, XP, rare electronics.'],
                eliteRunner: ['Elite', 20, 'Late-wave runner with elite speed and health.', 'Slow it with traps and avoid tunnel vision.', 'Strong cash and XP.'],
                eliteTank: ['Elite', 20, 'Late-wave tank with armor and huge durability.', 'Explosives and upgraded turrets are the answer.', 'Large cash and metal rewards.'],
                miniBoss: ['Elite', 15, 'A five-wave captain that mixes boss durability with ranged attacks.', 'Repair before it arrives and focus all turrets.', 'Rare parts, cash, and big XP.'],
                boss: ['Bosses', 10, 'Basic Brute: a boss-class brawler with ranged pressure.', 'Keep moving and use reinforced walls.', 'Major cash, XP, rare parts.'],
                burrowKing: ['Bosses', 10, 'Burrows underground, warns with cracked pavement, and emerges near targets.', 'Move away from warning cracks and clear spawned zombies.', 'Major boss rewards and rare parts.'],
                chargerBrute: ['Bosses', 10, 'Telegraphs a dash that can smash weak walls.', 'Bait it into reinforced or metal walls to stun it.', 'Major boss rewards.'],
                teslaHorror: ['Bosses', 20, 'Charges EMP pulses that disable turrets and summons disruptors.', 'Back up during the charge and spread turrets.', 'High tech rewards.'],
                broodMother: ['Bosses', 20, 'Constantly spawns small enemies and opens weak spots while spawning.', 'Burst it during weak-spot windows.', 'Large XP and resource drops.'],
                toxicButcher: ['Bosses', 30, 'Aggressive boss that leaves toxic puddles and slams in melee.', 'Keep repositioning and do not fight in puddles.', 'Elite boss rewards.'],
                bossButcher: ['Bosses', 30, 'Elite brute variant with heavier melee pressure.', 'Strong walls and burst damage.', 'Elite boss rewards.'],
                bossSpitter: ['Bosses', 30, 'Elite toxic manager with long-range acid pressure.', 'Stay mobile and avoid clumped defenses.', 'Elite boss rewards.']
            };
            return Object.entries(this.zombieTypes).map(([id, stats]) => {
                const [category, firstWave, description, tip, reward] = metadata[id] || [
                    stats.isBoss ? 'Bosses' : stats.isEliteVariant || stats.isMiniBoss ? 'Elite' : 'Special',
                    stats.isBoss ? 10 : 1,
                    'Uncatalogued infected variant found in the store perimeter.',
                    'Inspect its movement and build counters around its role.',
                    'Cash, XP, and salvage.'
                ];
                const damage = stats.contactDamage || stats.explosionDamage || (stats.isBoss ? 28 : 8);
                const ability = stats.isBoss ? 'Boss mechanics' : stats.isBomber || stats.isSapper ? 'Explodes on contact' : stats.isAcidRanger || stats.shootRange ? 'Ranged attack' : stats.isHealer ? 'Heals allies' : stats.isEngineer ? 'Shields allies' : stats.isDisruptor ? 'EMP disruption' : stats.isSplitter ? 'Splits on death' : stats.isCharger ? 'Charge attack' : stats.isLeech ? 'Life steal' : stats.armor ? 'Armor' : stats.shieldHealth ? 'Shield' : 'Melee pressure';
                return {
                    id,
                    name: stats.name || id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
                    category,
                    firstWave,
                    description,
                    tip,
                    reward,
                    ability,
                    color: stats.color || [120, 113, 108],
                    health: stats.health || 0,
                    speed: stats.speed || 0,
                    damage
                };
            }).sort((a, b) => a.firstWave - b.firstWave || a.name.localeCompare(b.name));
        },

        populateZombieIndex: function () {
            const categories = ['Common', 'Special', 'Elite', 'Bosses'];
            zombieIndexTabs.innerHTML = '';
            categories.forEach((category) => {
                const button = document.createElement('button');
                button.className = `zombie-index-tab ${this.zombieIndexCategory === category ? 'active' : ''}`;
                button.textContent = category;
                button.onclick = () => this.setZombieIndexCategory(category);
                zombieIndexTabs.appendChild(button);
            });
            const filter = this.zombieIndexFilter || '';
            const entries = this.getZombieIndexEntries().filter((entry) => {
                const haystack = `${entry.name} ${entry.description} ${entry.ability} ${entry.tip} ${entry.reward}`.toLowerCase();
                return entry.category === this.zombieIndexCategory && (!filter || haystack.includes(filter));
            });
            zombieIndexContent.innerHTML = entries.length ? entries.map((entry) => `
                <article class="zombie-index-card">
                    <div class="zombie-index-icon" style="--zombie-color: rgb(${entry.color[0]}, ${entry.color[1]}, ${entry.color[2]})">
                        <span>${entry.name.slice(0, 1)}</span>
                    </div>
                    <div class="zombie-index-main">
                        <div class="zombie-index-card-header">
                            <h3>${entry.name}</h3>
                            <span>First wave ${entry.firstWave}</span>
                        </div>
                        <p>${entry.description}</p>
                        <div class="zombie-index-stats">
                            <b>HP ${entry.health}</b>
                            <b>Speed ${Number(entry.speed).toFixed(2)}</b>
                            <b>Damage ${entry.damage}</b>
                        </div>
                        <div class="zombie-index-detail"><strong>Special:</strong> ${entry.ability}</div>
                        <div class="zombie-index-detail"><strong>Counter:</strong> ${entry.tip}</div>
                        <div class="zombie-index-detail"><strong>Reward:</strong> ${entry.reward}</div>
                    </div>
                </article>
            `).join('') : '<p class="workbench-empty">No zombies match this filter.</p>';
        },

        recordKill: function (zombie) {
            this.metaProgression.totalKills = (this.metaProgression.totalKills || 0) + 1;
            if (zombie.type === 'boss' || zombie.isBoss) {
                this.metaProgression.bossesDefeated = (this.metaProgression.bossesDefeated || 0) + 1;
            }
            this.updateLobbyMeta();
            this.saveMetaProgression();
        },

        recordBuild: function () {
            this.metaProgression.defensesBuilt = (this.metaProgression.defensesBuilt || 0) + 1;
            this.updateLobbyMeta();
            this.saveMetaProgression();
        },

        recordRunEnd: function () {
            this.metaProgression.highestWave = Math.max(this.metaProgression.highestWave || 0, Math.max(0, this.wave - 1));
            this.updateLobbyMeta();
            this.populateSkinList();
            this.saveMetaProgression();
        },

        drawSurvivor: function (x, y, angle, skinId, label, alpha) {
            const skin = this.getSkin(skinId);
            ctx.save();
            ctx.globalAlpha = alpha ?? 1;
            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.beginPath();
            ctx.ellipse(0, 13, 13, 6, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = skin.colors.body;
            ctx.beginPath();
            ctx.arc(0, -5, 9, 0, Math.PI * 2);
            ctx.fill();

            ctx.rotate(angle);
            ctx.fillStyle = skin.colors.shirt;
            ctx.fillRect(-10, -12, 20, 24);
            ctx.fillStyle = skin.colors.accent;
            ctx.fillRect(-2, -12, 4, 24);
            ctx.fillStyle = '#d6d3d1';
            ctx.fillRect(10, -3, 15, 6);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = alpha ?? 1;
            ctx.fillStyle = '#fff7ed';
            ctx.font = '10px "Chakra Petch"';
            ctx.textAlign = 'center';
            ctx.fillText(label || 'P1', x, y - 24);
            ctx.restore();
        },

        drawPlayer: function () {
            this.drawSurvivor(
                this.player.x,
                this.player.y,
                this.player.angle,
                this.player.skinId || this.selectedSkinId,
                this.player.name || 'P1',
                1
            );
        },

        drawRemotePlayers: function () {
            this.remotePlayers.forEach((player) => {
                this.drawSurvivor(player.x, player.y, player.angle || 0, player.skinId || 'shopper', player.name || 'Shopper', 0.82);
                const healthPercent = Math.max(0, Math.min(1, (player.health || 0) / (player.maxHealth || 100)));
                ctx.fillStyle = '#111827';
                ctx.fillRect(player.x - 16, player.y - 35, 32, 4);
                ctx.fillStyle = '#fb923c';
                ctx.fillRect(player.x - 16, player.y - 35, 32 * healthPercent, 4);
            });
        },

        isOnScreen: function (x, y, padding = 120) {
            return x >= this.camera.x - padding
                && x <= this.camera.x + canvas.width + padding
                && y >= this.camera.y - padding
                && y <= this.camera.y + canvas.height + padding;
        },

        resolvePlayerEnvironmentCollision: function (previousX, previousY) {
            const resolveRect = (rect) => {
                const halfW = rect.width / 2 + this.PLAYER_RADIUS;
                const halfH = rect.height / 2 + this.PLAYER_RADIUS;
                const left = rect.x - halfW;
                const right = rect.x + halfW;
                const top = rect.y - halfH;
                const bottom = rect.y + halfH;
                if (this.player.x <= left || this.player.x >= right || this.player.y <= top || this.player.y >= bottom) return;

                if (previousX <= left) this.player.x = left;
                else if (previousX >= right) this.player.x = right;
                else if (previousY <= top) this.player.y = top;
                else if (previousY >= bottom) this.player.y = bottom;
                else {
                    const distances = [
                        { side: 'left', value: Math.abs(this.player.x - left) },
                        { side: 'right', value: Math.abs(right - this.player.x) },
                        { side: 'top', value: Math.abs(this.player.y - top) },
                        { side: 'bottom', value: Math.abs(bottom - this.player.y) }
                    ].sort((a, b) => a.value - b.value);
                    if (distances[0].side === 'left') this.player.x = left;
                    if (distances[0].side === 'right') this.player.x = right;
                    if (distances[0].side === 'top') this.player.y = top;
                    if (distances[0].side === 'bottom') this.player.y = bottom;
                }
            };

            resolveRect(this.shop);
            resolveRect(this.workbench);
            this.buildings.forEach(resolveRect);
            if (window.LastShopperWorld) {
                for (const structure of this.mapStructures || []) {
                    if (this.dist(this.player.x, this.player.y, structure.x, structure.y) > Math.max(structure.width, structure.height)) continue;
                    window.LastShopperWorld.wallSegments(structure).forEach(resolveRect);
                }
            }
        },

        ensureLocalWorldChunks: function () {
            if (!window.LastShopperWorld || this.multiplayer?.serverAuthoritative) return;
            const size = window.LastShopperWorld.CHUNK_SIZE;
            const cx = Math.floor(this.player.x / size);
            const cy = Math.floor(this.player.y / size);
            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const key = window.LastShopperWorld.chunkKey(cx + ox, cy + oy);
                    if (this.generatedWorldChunks.has(key)) continue;
                    this.generatedWorldChunks.add(key);
                    this.mapStructures.push(...window.LastShopperWorld.generateChunk(this.mapSeed, cx + ox, cy + oy));
                }
            }
        },

        updateLocalWorldEvents: function () {
            const now = performance.now();
            if (now < this.nextLocalWorldDropAt) return;
            const angle = Math.random() * Math.PI * 2;
            const range = 160 + Math.random() * 100;
            const x = this.player.x + Math.cos(angle) * range;
            const y = this.player.y + Math.sin(angle) * range;
            this.lootBeacon = { x, y, expiresAt: now + 90000 };
            const types = ['ammo', 'wood', 'metal'];
            for (let i = 0; i < 3; i++) {
                this.drops.push({ x: x + Math.random() * 50 - 25, y: y + Math.random() * 50 - 25, type: types[i], life: 1800 });
            }
            this.nextLocalWorldDropAt = now + 90000 + Math.random() * 50000;
        },

        toggleWorldDoor: function (structureId) {
            if (this.multiplayer?.serverAuthoritative) {
                this.multiplayer.sendAction({ kind: 'toggleDoor', structureId });
                return;
            }
            const structure = (this.mapStructures || []).find((entry) => entry.id === structureId);
            if (structure && !structure.door.destroyed) structure.door.open = !structure.door.open;
        },

        openWorldLoot: function (structureId) {
            if (this.multiplayer?.serverAuthoritative) {
                this.multiplayer.sendAction({ kind: 'openStructureLoot', structureId });
                return;
            }
            const structure = (this.mapStructures || []).find((entry) => entry.id === structureId);
            if (!structure || structure.loot.claimed) return;
            structure.loot.claimed = true;
            const types = ['money', 'ammo', 'wood', 'metal'];
            for (let i = 0; i < types.length; i++) {
                this.drops.push({ x: structure.loot.x + Math.random() * 34 - 17, y: structure.loot.y + Math.random() * 34 - 17, type: types[i], life: 1800 });
            }
        },

        drawCityTerrain: function () {
            if (!window.LastShopperWorld) return;
            if (!this.citySceneCache) this.citySceneCache = new Map();
            const chunkSize = window.LastShopperWorld.CHUNK_SIZE;
            const minChunkX = Math.floor((this.camera.x - 160) / chunkSize);
            const maxChunkX = Math.floor((this.camera.x + canvas.width + 160) / chunkSize);
            const minChunkY = Math.floor((this.camera.y - 160) / chunkSize);
            const maxChunkY = Math.floor((this.camera.y + canvas.height + 160) / chunkSize);
            const districtColors = {
                residential: '#252825',
                commercial: '#292725',
                industrial: '#25282a',
                civic: '#28282b',
                park: '#222a23'
            };
            for (let cx = minChunkX; cx <= maxChunkX; cx++) {
                for (let cy = minChunkY; cy <= maxChunkY; cy++) {
                    const cacheKey = `${this.mapSeed}:${cx}:${cy}`;
                    let scene = this.citySceneCache.get(cacheKey);
                    if (!scene) {
                        scene = window.LastShopperWorld.generateChunkScene(this.mapSeed, cx, cy);
                        this.citySceneCache.set(cacheKey, scene);
                    }
                    const baseX = cx * chunkSize;
                    const baseY = cy * chunkSize;
                    ctx.fillStyle = districtColors[scene.district] || '#252525';
                    ctx.fillRect(baseX, baseY, chunkSize, chunkSize);

                    for (const road of scene.roads) {
                        ctx.fillStyle = '#4a4742';
                        ctx.fillRect(road.x - road.width / 2 - 14, road.y - road.height / 2 - 14, road.width + 28, road.height + 28);
                        ctx.fillStyle = '#20242a';
                        ctx.fillRect(road.x - road.width / 2, road.y - road.height / 2, road.width, road.height);
                        ctx.strokeStyle = '#b78c3f';
                        ctx.lineWidth = 3;
                        ctx.setLineDash([24, 22]);
                        ctx.beginPath();
                        if (road.orientation === 'horizontal') {
                            ctx.moveTo(road.x - road.width / 2, road.y);
                            ctx.lineTo(road.x + road.width / 2, road.y);
                        } else {
                            ctx.moveTo(road.x, road.y - road.height / 2);
                            ctx.lineTo(road.x, road.y + road.height / 2);
                        }
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }

                    const centerX = baseX + chunkSize / 2;
                    const centerY = baseY + chunkSize / 2;
                    ctx.fillStyle = 'rgba(226,232,240,.55)';
                    for (let stripe = -54; stripe <= 54; stripe += 18) {
                        ctx.fillRect(centerX - 76, centerY + stripe - 3, 22, 6);
                        ctx.fillRect(centerX + stripe - 3, centerY - 76, 6, 22);
                    }

                    for (const decoration of scene.decorations) {
                        ctx.save();
                        ctx.translate(decoration.x, decoration.y);
                        if (decoration.type === 'park') {
                            ctx.fillStyle = '#263b29';
                            ctx.fillRect(-decoration.width / 2, -decoration.height / 2, decoration.width, decoration.height);
                            ctx.strokeStyle = '#52634e';
                            ctx.lineWidth = 5;
                            ctx.strokeRect(-decoration.width / 2, -decoration.height / 2, decoration.width, decoration.height);
                            ctx.fillStyle = '#7c6f59';
                            ctx.fillRect(-decoration.width / 2, -9, decoration.width, 18);
                            ctx.fillRect(-9, -decoration.height / 2, 18, decoration.height);
                        } else if (decoration.type === 'tree') {
                            ctx.fillStyle = '#3f2d20';
                            ctx.fillRect(-3, -2, 6, 14);
                            ctx.fillStyle = '#355b34';
                            ctx.beginPath();
                            ctx.arc(0, -7, decoration.size, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = '#4d7443';
                            ctx.beginPath();
                            ctx.arc(-4, -11, decoration.size * .55, 0, Math.PI * 2);
                            ctx.fill();
                        } else if (decoration.type === 'bench') {
                            ctx.rotate(decoration.rotation || 0);
                            ctx.fillStyle = '#6b4b2f';
                            ctx.fillRect(-18, -5, 36, 10);
                            ctx.fillStyle = '#27211c';
                            ctx.fillRect(-14, 5, 4, 6);
                            ctx.fillRect(10, 5, 4, 6);
                        } else if (decoration.type === 'manhole') {
                            ctx.fillStyle = '#111827';
                            ctx.beginPath(); ctx.arc(0, 0, decoration.size, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = '#64748b';
                            ctx.lineWidth = 3;
                            ctx.beginPath(); ctx.arc(0, 0, decoration.size - 3, 0, Math.PI * 2); ctx.stroke();
                            ctx.beginPath(); ctx.moveTo(-8, -4); ctx.lineTo(8, -4); ctx.moveTo(-8, 4); ctx.lineTo(8, 4); ctx.stroke();
                        } else if (decoration.type === 'sewer') {
                            ctx.fillStyle = '#0f1715';
                            ctx.beginPath(); ctx.arc(0, 0, decoration.size, 0, Math.PI * 2); ctx.fill();
                            ctx.strokeStyle = '#6b7280';
                            ctx.lineWidth = 4;
                            ctx.beginPath(); ctx.arc(0, 0, decoration.size, 0, Math.PI * 2); ctx.stroke();
                            ctx.strokeStyle = '#65a30d';
                            ctx.lineWidth = 2;
                            for (let grate = -12; grate <= 12; grate += 6) {
                                ctx.beginPath(); ctx.moveTo(grate, -16); ctx.lineTo(grate, 16); ctx.stroke();
                            }
                        } else if (decoration.type === 'streetlight') {
                            ctx.fillStyle = '#111827';
                            ctx.fillRect(-3, -3, 6, 25);
                            ctx.fillStyle = '#fde68a';
                            ctx.shadowColor = '#f59e0b';
                            ctx.shadowBlur = 12;
                            ctx.fillRect(-7, -8, 14, 8);
                            ctx.shadowBlur = 0;
                        } else if (decoration.type === 'car') {
                            ctx.rotate(decoration.rotation || 0);
                            ctx.fillStyle = 'rgba(0,0,0,.35)';
                            ctx.fillRect(-23, -11, 52, 28);
                            ctx.fillStyle = decoration.color || '#7c2d12';
                            ctx.fillRect(-26, -14, 52, 28);
                            ctx.fillStyle = '#172033';
                            ctx.fillRect(-11, -11, 22, 22);
                            ctx.fillStyle = '#09090b';
                            ctx.fillRect(-20, -18, 10, 5);
                            ctx.fillRect(10, -18, 10, 5);
                            ctx.fillRect(-20, 13, 10, 5);
                            ctx.fillRect(10, 13, 10, 5);
                        } else if (decoration.type === 'crates') {
                            ctx.fillStyle = '#6b4423';
                            ctx.fillRect(-18, -18, 25, 25);
                            ctx.fillRect(3, -8, 24, 24);
                            ctx.strokeStyle = '#b7793d';
                            ctx.strokeRect(-18, -18, 25, 25);
                            ctx.strokeRect(3, -8, 24, 24);
                        }
                        ctx.restore();
                    }

                    ctx.fillStyle = 'rgba(168,162,158,.55)';
                    ctx.font = 'bold 10px "Chakra Petch"';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${scene.district.toUpperCase()} DISTRICT`, baseX + 22, baseY + 30);
                }
            }
        },

        drawWorldStructures: function () {
            if (!window.LastShopperWorld) return;
            for (const structure of this.mapStructures || []) {
                if (!this.isOnScreen(structure.x, structure.y, Math.max(structure.width, structure.height))) continue;
                const left = structure.x - structure.width / 2;
                const top = structure.y - structure.height / 2;
                ctx.save();
                ctx.fillStyle = '#292524';
                ctx.fillRect(left, top, structure.width, structure.height);
                ctx.strokeStyle = 'rgba(120,113,108,.32)';
                ctx.lineWidth = 1;
                for (let x = left + 24; x < left + structure.width; x += 24) {
                    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + structure.height); ctx.stroke();
                }
                for (let y = top + 24; y < top + structure.height; y += 24) {
                    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + structure.width, y); ctx.stroke();
                }
                ctx.fillStyle = '#44403c';
                if (['house', 'townhouse', 'apartment'].includes(structure.type)) {
                    ctx.fillRect(left + 28, top + 30, 72, 34);
                    ctx.fillStyle = '#57534e';
                    ctx.fillRect(left + structure.width - 105, top + structure.height - 62, 76, 30);
                    ctx.fillStyle = '#78716c';
                    ctx.fillRect(structure.x - 5, top + 18, 10, structure.height - 36);
                } else if (['warehouse', 'hardware', 'garage'].includes(structure.type)) {
                    for (let shelf = left + 35; shelf < left + structure.width - 30; shelf += 62) {
                        ctx.fillRect(shelf, top + 34, 18, structure.height - 68);
                    }
                } else {
                    ctx.fillRect(left + 28, top + 35, structure.width * .34, 18);
                    ctx.fillRect(left + structure.width * .58, top + structure.height - 60, structure.width * .28, 20);
                    ctx.fillStyle = '#78716c';
                    ctx.fillRect(left + 34, structure.y - 5, structure.width - 68, 10);
                }
                ctx.fillStyle = '#78716c';
                for (const wall of window.LastShopperWorld.wallSegments(structure)) {
                    ctx.fillRect(wall.x - wall.width / 2, wall.y - wall.height / 2, wall.width, wall.height);
                }
                const door = window.LastShopperWorld.doorPoint(structure);
                const doorHorizontal = ['top', 'bottom'].includes(structure.door.side);
                if (structure.door.destroyed) {
                    ctx.fillStyle = '#3f2b1f';
                    for (let debris = -42; debris <= 42; debris += 21) {
                        ctx.fillRect(door.x + (doorHorizontal ? debris : -4), door.y + (doorHorizontal ? -4 : debris), 9, 9);
                    }
                } else if (structure.door.open) {
                    ctx.strokeStyle = '#b45309';
                    ctx.lineWidth = 7;
                    ctx.beginPath();
                    ctx.moveTo(door.x, door.y);
                    ctx.lineTo(door.x + (doorHorizontal ? 44 : 0), door.y + (doorHorizontal ? 0 : 44));
                    ctx.stroke();
                } else {
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(
                        door.x - (doorHorizontal ? structure.door.width * .38 : 7),
                        door.y - (doorHorizontal ? 7 : structure.door.width * .38),
                        doorHorizontal ? structure.door.width * .76 : 14,
                        doorHorizontal ? 14 : structure.door.width * .76
                    );
                }
                if (!structure.door.destroyed && structure.door.health < structure.door.maxHealth) {
                    const health = Math.max(0, structure.door.health / structure.door.maxHealth);
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(door.x - 28, door.y - 24, 56, 5);
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(door.x - 28, door.y - 24, 56 * health, 5);
                }
                for (const windowEntry of window.LastShopperWorld.windowPoints(structure)) {
                    const horizontal = ['top', 'bottom'].includes(windowEntry.side);
                    if (windowEntry.breached) {
                        ctx.strokeStyle = '#94a3b8';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(windowEntry.x - 10, windowEntry.y - 10);
                        ctx.lineTo(windowEntry.x + 10, windowEntry.y + 10);
                        ctx.moveTo(windowEntry.x + 10, windowEntry.y - 10);
                        ctx.lineTo(windowEntry.x - 10, windowEntry.y + 10);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = '#7dd3fc';
                        ctx.fillRect(
                            windowEntry.x - (horizontal ? windowEntry.width * .35 : 5),
                            windowEntry.y - (horizontal ? 5 : windowEntry.width * .35),
                            horizontal ? windowEntry.width * .7 : 10,
                            horizontal ? 10 : windowEntry.width * .7
                        );
                        ctx.strokeStyle = '#dbeafe';
                        ctx.lineWidth = 2;
                        ctx.strokeRect(
                            windowEntry.x - (horizontal ? windowEntry.width * .35 : 5),
                            windowEntry.y - (horizontal ? 5 : windowEntry.width * .35),
                            horizontal ? windowEntry.width * .7 : 10,
                            horizontal ? 10 : windowEntry.width * .7
                        );
                    }
                    if (!windowEntry.breached && windowEntry.health < windowEntry.maxHealth) {
                        const health = Math.max(0, windowEntry.health / windowEntry.maxHealth);
                        ctx.fillStyle = '#111827';
                        ctx.fillRect(windowEntry.x - 22, windowEntry.y - 20, 44, 4);
                        ctx.fillStyle = '#38bdf8';
                        ctx.fillRect(windowEntry.x - 22, windowEntry.y - 20, 44 * health, 4);
                    }
                }
                if (!structure.loot.claimed) {
                    ctx.fillStyle = '#92400e';
                    ctx.fillRect(structure.loot.x - 13, structure.loot.y - 10, 26, 20);
                    ctx.strokeStyle = '#f59e0b';
                    ctx.strokeRect(structure.loot.x - 13, structure.loot.y - 10, 26, 20);
                }
                ctx.restore();
            }
            if (this.lootBeacon) {
                const pulse = 18 + Math.sin(performance.now() / 180) * 5;
                ctx.save();
                ctx.strokeStyle = '#fb923c';
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(this.lootBeacon.x, this.lootBeacon.y, pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = '#fff7ed';
                ctx.font = 'bold 12px "Chakra Petch"';
                ctx.textAlign = 'center';
                ctx.fillText('SUPPLY CACHE', this.lootBeacon.x, this.lootBeacon.y - 28);
                ctx.restore();
            }
        },

        drawWorldStructureRoofs: function () {
            if (!window.LastShopperWorld) return;
            const station = this.getNearbyStation();
            for (const structure of this.mapStructures || []) {
                if (!this.isOnScreen(structure.x, structure.y, Math.max(structure.width, structure.height))) continue;
                const inside = window.LastShopperWorld.pointInside(structure, this.player.x, this.player.y, 8);
                ctx.save();
                ctx.globalAlpha = inside ? 0.1 : 0.88;
                ctx.fillStyle = structure.color;
                ctx.fillRect(
                    structure.x - structure.width / 2 + 10,
                    structure.y - structure.height / 2 + 10,
                    structure.width - 20,
                    structure.height - 20
                );
                ctx.strokeStyle = '#1c1917';
                ctx.lineWidth = 7;
                ctx.strokeRect(structure.x - structure.width / 2, structure.y - structure.height / 2, structure.width, structure.height);
                ctx.globalAlpha = inside ? 0.35 : 1;
                ctx.fillStyle = '#fff7ed';
                ctx.font = 'bold 13px "Chakra Petch"';
                ctx.textAlign = 'center';
                ctx.fillText(structure.name.toUpperCase(), structure.x, structure.y - structure.height / 2 - 10);
                ctx.restore();
                if (station === `door:${structure.id}` || station === `loot:${structure.id}`) {
                    const target = station.startsWith('door:') ? window.LastShopperWorld.doorPoint(structure) : structure.loot;
                    ctx.fillStyle = '#fff7ed';
                    ctx.font = 'bold 14px "Chakra Petch"';
                    ctx.textAlign = 'center';
                    ctx.fillText(station.startsWith('door:') ? `[E] ${structure.door.open ? 'CLOSE' : 'OPEN'} DOOR` : '[E] SEARCH LOOT', target.x, target.y - 22);
                }
            }
        },

        drawDetailedZombies: function () {
            for (const z of this.zombies) {
                if (this.isOnScreen && !this.isOnScreen(z.x, z.y, z.size + 140)) continue;
                const timelineNow = this.serverTime || performance.now();
                if (z.burrowWarning && (!z.burrowWarning.until || z.burrowWarning.until > timelineNow)) {
                    ctx.save();
                    ctx.translate(z.burrowWarning.x, z.burrowWarning.y);
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([9, 5]);
                    ctx.beginPath();
                    ctx.arc(0, 0, z.size * 1.35, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.strokeStyle = '#78350f';
                    for (let c = 0; c < 7; c++) {
                        const a = (Math.PI * 2 / 7) * c;
                        ctx.beginPath();
                        ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
                        ctx.lineTo(Math.cos(a) * (z.size * 1.25), Math.sin(a) * (z.size * 1.25));
                        ctx.stroke();
                    }
                    ctx.restore();
                }
                if (z.warningLine && (!z.warningLine.until || z.warningLine.until > timelineNow)) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(248,113,113,.85)';
                    ctx.lineWidth = 5;
                    ctx.setLineDash([18, 10]);
                    ctx.beginPath();
                    ctx.moveTo(z.warningLine.x1, z.warningLine.y1);
                    ctx.lineTo(z.warningLine.x2, z.warningLine.y2);
                    ctx.stroke();
                    ctx.restore();
                }
                if (z.empChargeUntil && z.empChargeUntil > timelineNow) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(34,211,238,.78)';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([10, 8]);
                    ctx.beginPath();
                    ctx.arc(z.x, z.y, z.empRadius || 240, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
                if (z.hidden) continue;
                const color = `rgb(${z.color[0]}, ${z.color[1]}, ${z.color[2]})`;
                const darkColor = `rgb(${z.color[0] * 0.58}, ${z.color[1] * 0.58}, ${z.color[2] * 0.58})`;
                const type = z.type || 'normal';
                const isFast = type === 'fast' || type === 'runner';
                const isTank = type === 'tank';
                const isRanged = type === 'spitter' || type === 'thrower' || type === 'acidRanger';
                const isBomber = type === 'bomber' || type === 'sapper' || z.isBomber || z.isSapper;
                const isArmored = type === 'armored';
                const isShield = type === 'shield';
                const isElite = type === 'miniBoss' || type === 'boss' || z.isMiniBoss || z.isBoss;
                const isEngineer = z.isEngineer;
                const isSplitter = z.isSplitter;
                const isCharger = z.isCharger;
                const isLeech = z.isLeech;
                const isEliteVariant = z.isEliteVariant;
                const facing = Math.atan2(this.player.y - z.y, this.player.x - z.x);

                ctx.save();
                ctx.translate(z.x, z.y);
                ctx.rotate(facing);

                ctx.fillStyle = 'rgba(0,0,0,.32)';
                ctx.beginPath();
                ctx.ellipse(-2, z.size * 0.72, z.size * 1.05, z.size * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();

                const stride = isFast ? z.size * 0.85 : z.size * 0.58;
                ctx.strokeStyle = darkColor;
                ctx.lineWidth = Math.max(3, z.size * 0.24);
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(-z.size * 0.22, z.size * 0.2);
                ctx.lineTo(-stride, z.size * 0.82);
                ctx.moveTo(z.size * 0.2, z.size * 0.2);
                ctx.lineTo(stride * 0.75, z.size * 0.82);
                ctx.stroke();

                const torsoWidth = isTank || isElite ? z.size * 1.65 : isFast ? z.size * 0.85 : z.size * 1.18;
                ctx.fillStyle = darkColor;
                ctx.fillRect(-torsoWidth / 2, -z.size * 0.28, torsoWidth, isElite ? z.size * 1.42 : z.size * 1.12);

                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(3, z.size * 0.26);
                ctx.beginPath();
                ctx.moveTo(-torsoWidth * 0.42, -z.size * 0.02);
                ctx.lineTo(-z.size * (isFast ? 1.05 : 0.78), z.size * 0.32);
                ctx.moveTo(torsoWidth * 0.42, -z.size * 0.02);
                ctx.lineTo(z.size * (isFast ? 1.2 : 0.82), z.size * 0.24);
                ctx.stroke();

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(z.size * 0.05, -z.size * 0.72, z.size * (isElite ? 0.64 : 0.5), 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fef3c7';
                ctx.fillRect(z.size * 0.24, -z.size * 0.84, Math.max(2, z.size * 0.12), Math.max(2, z.size * 0.1));

                if (isFast) {
                    ctx.strokeStyle = '#facc15';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-z.size * 0.7, -z.size * 0.3);
                    ctx.lineTo(-z.size * 1.25, -z.size * 0.3);
                    ctx.moveTo(-z.size * 0.65, 0);
                    ctx.lineTo(-z.size * 1.1, 0);
                    ctx.stroke();
                }

                if (isTank) {
                    ctx.fillStyle = '#4d7c0f';
                    ctx.fillRect(-z.size * 0.98, -z.size * 0.38, z.size * 0.45, z.size * 0.72);
                    ctx.fillRect(z.size * 0.53, -z.size * 0.38, z.size * 0.45, z.size * 0.72);
                }

                if (isRanged) {
                    ctx.fillStyle = '#84cc16';
                    ctx.beginPath();
                    ctx.arc(-z.size * 0.48, -z.size * 0.05, z.size * 0.42, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = '#d9f99d';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(z.size * 0.42, -z.size * 0.6);
                    ctx.lineTo(z.size * 0.94, -z.size * 0.82);
                    ctx.stroke();
                }

                if (isBomber) {
                    ctx.fillStyle = '#111827';
                    ctx.fillRect(-z.size * 0.56, -z.size * 0.16, z.size * 1.12, z.size * 0.7);
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(-z.size * 0.4, -z.size * 0.06, z.size * 0.24, z.size * 0.48);
                    ctx.fillRect(z.size * 0.16, -z.size * 0.06, z.size * 0.24, z.size * 0.48);
                    ctx.fillStyle = Math.floor(performance.now() / 250) % 2 ? '#ef4444' : '#fef08a';
                    ctx.beginPath();
                    ctx.arc(0, -z.size * 0.18, Math.max(2, z.size * 0.13), 0, Math.PI * 2);
                    ctx.fill();
                }

                if (z.isSapper) {
                    ctx.strokeStyle = '#fed7aa';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(-z.size * 0.52, -z.size * 0.48);
                    ctx.lineTo(z.size * 0.16, z.size * 0.2);
                    ctx.moveTo(-z.size * 0.55, z.size * 0.18);
                    ctx.lineTo(z.size * 0.18, -z.size * 0.55);
                    ctx.stroke();
                }

                if (z.isFlanker) {
                    ctx.strokeStyle = '#d8b4fe';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(0, -z.size * 0.55, z.size * 0.72, 0.25, Math.PI * 1.72);
                    ctx.stroke();
                }

                if (isArmored) {
                    ctx.fillStyle = '#9ca3af';
                    ctx.fillRect(-z.size * 0.72, -z.size * 0.36, z.size * 1.44, z.size * 0.42);
                    ctx.fillRect(-z.size * 0.55, z.size * 0.14, z.size * 1.1, z.size * 0.38);
                    ctx.fillStyle = '#374151';
                    ctx.fillRect(-z.size * 0.58, -z.size * 1.03, z.size * 1.18, z.size * 0.26);
                }

                if (isShield) {
                    ctx.fillStyle = '#1e3a5f';
                    ctx.fillRect(z.size * 0.36, -z.size * 0.55, z.size * 0.78, z.size * 1.35);
                    ctx.strokeStyle = '#7dd3fc';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(z.size * 0.36, -z.size * 0.55, z.size * 0.78, z.size * 1.35);
                }

                if (isEngineer) {
                    ctx.strokeStyle = '#f59e0b';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(-z.size * 0.72, -z.size * 0.9);
                    ctx.lineTo(-z.size * 0.22, -z.size * 0.38);
                    ctx.moveTo(-z.size * 0.22, -z.size * 0.9);
                    ctx.lineTo(-z.size * 0.72, -z.size * 0.38);
                    ctx.stroke();
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(z.size * 0.35, -z.size * 0.32, z.size * 0.36, z.size * 0.18);
                }

                if (isSplitter) {
                    ctx.strokeStyle = '#bbf7d0';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, -z.size * 1.08);
                    ctx.lineTo(0, z.size * 0.62);
                    ctx.moveTo(-z.size * 0.38, -z.size * 0.18);
                    ctx.lineTo(z.size * 0.38, z.size * 0.3);
                    ctx.stroke();
                }

                if (isCharger) {
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(z.size * 0.34, -z.size * 1.18);
                    ctx.lineTo(z.size * 0.78, -z.size * 0.52);
                    ctx.lineTo(z.size * 0.08, -z.size * 0.74);
                    ctx.closePath();
                    ctx.fill();
                }

                if (isLeech) {
                    ctx.strokeStyle = '#fecdd3';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(z.size * 0.32, -z.size * 0.74, z.size * 0.22, 0, Math.PI * 2);
                    ctx.moveTo(z.size * 0.5, -z.size * 0.66);
                    ctx.lineTo(z.size * 0.96, -z.size * 0.28);
                    ctx.stroke();
                }

                if (isEliteVariant) {
                    ctx.strokeStyle = '#fde68a';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([4, 3]);
                    ctx.strokeRect(-torsoWidth / 2 - 3, -z.size * 0.33, torsoWidth + 6, z.size * 1.22);
                    ctx.setLineDash([]);
                }

                if (z.isHealer) {
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillRect(-z.size * 0.12, -z.size * 0.2, z.size * 0.24, z.size * 0.68);
                    ctx.fillRect(-z.size * 0.34, z.size * 0.02, z.size * 0.68, z.size * 0.24);
                }

                if (z.isDisruptor) {
                    ctx.strokeStyle = '#22d3ee';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, z.size * 0.86, -0.8, 0.8);
                    ctx.stroke();
                }

                if (isElite) {
                    ctx.fillStyle = type === 'boss' ? '#111827' : '#3f0a2c';
                    ctx.fillRect(-z.size * 0.66, -z.size * 0.4, z.size * 1.32, z.size * 1.08);
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(-z.size * 0.12, -z.size * 0.35);
                    ctx.lineTo(z.size * 0.12, -z.size * 0.35);
                    ctx.lineTo(0, z.size * 0.45);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#fbbf24';
                    ctx.lineWidth = 3;
                    ctx.strokeRect(-z.size * 0.72, -z.size * 0.44, z.size * 1.44, z.size * 1.15);
                }

                if (z.dodgeUntil && z.dodgeUntil > timelineNow) {
                    ctx.strokeStyle = '#fef3c7';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([3, 5]);
                    ctx.beginPath();
                    ctx.arc(0, 0, z.size * 1.25, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                ctx.restore();

                const barWidth = z.size * 2.2;
                const barY = z.y - z.size - 13;
                const hpPercent = Math.max(0, z.health / z.maxHealth);
                ctx.fillStyle = '#111827';
                ctx.fillRect(z.x - barWidth / 2, barY, barWidth, 5);
                ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#f97316' : '#ef4444';
                ctx.fillRect(z.x - barWidth / 2, barY, barWidth * hpPercent, 5);

                if (z.maxShieldHealth) {
                    const shieldPercent = Math.max(0, z.shieldHealth) / z.maxShieldHealth;
                    ctx.fillStyle = '#172554';
                    ctx.fillRect(z.x - barWidth / 2, barY - 5, barWidth, 3);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillRect(z.x - barWidth / 2, barY - 5, barWidth * shieldPercent, 3);
                }
                if (z.isBoss) {
                    const bossBarWidth = Math.max(120, z.size * 3.1);
                    const bossBarY = z.y - z.size - 30;
                    ctx.fillStyle = '#0c0a09';
                    ctx.fillRect(z.x - bossBarWidth / 2, bossBarY, bossBarWidth, 8);
                    ctx.fillStyle = '#dc2626';
                    ctx.fillRect(z.x - bossBarWidth / 2, bossBarY, bossBarWidth * hpPercent, 8);
                    if (z.weakSpotUntil && z.weakSpotUntil > timelineNow) {
                        ctx.fillStyle = '#fbbf24';
                        ctx.fillRect(z.x - bossBarWidth / 2, bossBarY + 9, bossBarWidth * hpPercent, 3);
                    }
                    ctx.fillStyle = '#fff7ed';
                    ctx.font = 'bold 12px "Chakra Petch"';
                    ctx.textAlign = 'center';
                    ctx.fillText((z.name || 'Boss').toUpperCase(), z.x, bossBarY - 5);
                }
            }
        },

        drawShopBuilding: function () {
            const shop = this.shop;
            const left = shop.x - shop.width / 2;
            const top = shop.y - shop.height / 2;
            const right = left + shop.width;
            const bottom = top + shop.height;

            ctx.save();

            ctx.fillStyle = '#111111';
            ctx.fillRect(left - 110, bottom - 8, shop.width + 220, 150);
            ctx.strokeStyle = 'rgba(249,115,22,.22)';
            ctx.lineWidth = 2;
            for (let stripeX = left - 70; stripeX < right + 90; stripeX += 58) {
                ctx.beginPath();
                ctx.moveTo(stripeX, bottom + 18);
                ctx.lineTo(stripeX - 28, bottom + 112);
                ctx.stroke();
            }
            ctx.fillStyle = '#292524';
            ctx.fillRect(left - 76, bottom + 52, 44, 25);
            ctx.fillStyle = '#78716c';
            ctx.fillRect(left - 70, bottom + 45, 30, 10);
            ctx.strokeStyle = '#fb923c';
            ctx.strokeRect(left - 76, bottom + 52, 44, 25);

            ctx.fillStyle = this.isNearShop() ? 'rgba(249,115,22,0.14)' : 'rgba(249,115,22,0.06)';
            ctx.beginPath();
            ctx.arc(shop.interactionX, shop.interactionY, shop.interactionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.isNearShop() ? 'rgba(251,146,60,0.85)' : 'rgba(120,113,108,0.3)';
            ctx.setLineDash([8, 7]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(0,0,0,0.38)';
            ctx.fillRect(left + 10, top + 12, shop.width, shop.height);

            ctx.fillStyle = '#292524';
            ctx.fillRect(left, top, shop.width, shop.height);
            ctx.strokeStyle = '#78716c';
            ctx.lineWidth = 8;
            ctx.strokeRect(left, top, shop.width, shop.height);

            const tile = 30;
            for (let y = top + 8; y < bottom - 8; y += tile) {
                for (let x = left + 8; x < right - 8; x += tile) {
                    const damaged = ((x + y) / tile) % 7 === 0;
                    ctx.fillStyle = damaged ? '#1c1917' : (((x + y) / tile) % 2 ? '#3f3a37' : '#35312f');
                    ctx.fillRect(x, y, tile - 2, tile - 2);
                    if (damaged) {
                        ctx.strokeStyle = '#0c0a09';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(x + 4, y + 4);
                        ctx.lineTo(x + 14, y + 13);
                        ctx.lineTo(x + 8, y + 25);
                        ctx.stroke();
                    }
                }
            }

            const drawShelf = (x, y, w, h) => {
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(x + 4, y + 5, w, h);
                ctx.fillStyle = '#57534e';
                ctx.fillRect(x, y, w, h);
                ctx.fillStyle = '#a8a29e';
                ctx.fillRect(x + 5, y + 5, w - 10, 3);
                ctx.fillRect(x + 5, y + h / 2, w - 10, 3);
                ctx.fillStyle = '#c2410c';
                for (let itemX = x + 9; itemX < x + w - 8; itemX += 17) {
                    ctx.fillRect(itemX, y + 10, 8, 9);
                    ctx.fillStyle = '#92400e';
                    ctx.fillRect(itemX, y + h / 2 + 5, 8, 9);
                    ctx.fillStyle = '#c2410c';
                }
            };

            drawShelf(left + 28, top + 55, 92, 38);
            drawShelf(right - 120, top + 55, 92, 38);
            drawShelf(left + 28, top + 112, 92, 38);
            drawShelf(right - 120, top + 112, 92, 38);
            drawShelf(shop.x - 52, top + 55, 104, 38);
            drawShelf(shop.x - 52, top + 125, 104, 38);

            ctx.fillStyle = '#1c1917';
            ctx.fillRect(left + 18, top + 180, 92, 36);
            ctx.fillStyle = '#93c5fd';
            ctx.fillRect(left + 25, top + 186, 78, 22);
            ctx.strokeStyle = '#dbeafe';
            ctx.strokeRect(left + 25, top + 186, 78, 22);
            ctx.fillStyle = '#d6d3d1';
            ctx.font = 'bold 9px "Chakra Petch"';
            ctx.textAlign = 'center';
            ctx.fillText('FREEZER', left + 64, top + 200);

            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(right - 112, top + 182, 84, 34);
            ctx.fillStyle = '#fb923c';
            ctx.fillRect(right - 104, top + 188, 26, 10);
            ctx.fillRect(right - 68, top + 188, 26, 10);
            ctx.fillStyle = '#a8a29e';
            ctx.fillRect(right - 104, top + 203, 62, 5);

            ctx.fillStyle = '#1c1917';
            ctx.fillRect(shop.x - 95, bottom - 53, 190, 41);
            ctx.fillStyle = '#57534e';
            ctx.fillRect(shop.x - 95, bottom - 58, 190, 31);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(shop.x - 82, bottom - 49, 34, 12);
            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(shop.x + 38, bottom - 51, 44, 16);

            ctx.fillStyle = '#78350f';
            ctx.fillRect(left - 34, bottom - 54, 32, 32);
            ctx.fillRect(right + 5, bottom - 42, 38, 38);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.strokeRect(left - 34, bottom - 54, 32, 32);
            ctx.strokeRect(right + 5, bottom - 42, 38, 38);

            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(shop.x - 82, top - 31, 164, 38);
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 3;
            ctx.strokeRect(shop.x - 82, top - 31, 164, 38);
            ctx.fillStyle = '#fb923c';
            ctx.font = 'bold 28px "Chakra Petch"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SHOP', shop.x, top - 12);

            ctx.fillStyle = '#fef3c7';
            ctx.shadowColor = '#f97316';
            ctx.shadowBlur = 12;
            ctx.fillRect(left + 45, top + 18, 75, 7);
            ctx.fillRect(right - 120, top + 18, 75, 7);
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#111827';
            ctx.fillRect(shop.x - 48, bottom - 8, 96, 12);
            ctx.strokeStyle = '#f97316';
            ctx.strokeRect(shop.x - 48, bottom - 8, 96, 12);

            if (this.isNearShop()) {
                ctx.fillStyle = '#fff7ed';
                ctx.font = 'bold 16px "Chakra Petch"';
                ctx.fillText('[E] OPEN SHOP', shop.interactionX, shop.interactionY + 7);
            }

            ctx.restore();
        },

        drawWorkbenchStation: function () {
            const bench = this.workbench;
            const left = bench.x - bench.width / 2;
            const top = bench.y - bench.height / 2;

            ctx.save();
            ctx.fillStyle = this.isNearWorkbench() ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.05)';
            ctx.beginPath();
            ctx.arc(bench.x, bench.y, bench.interactionRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.isNearWorkbench() ? '#fb923c' : 'rgba(120,113,108,.35)';
            ctx.setLineDash([7, 6]);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = 'rgba(0,0,0,.4)';
            ctx.fillRect(left + 6, top + 8, bench.width, bench.height);
            ctx.fillStyle = '#78350f';
            ctx.fillRect(left, top, bench.width, 18);
            ctx.strokeStyle = '#fb923c';
            ctx.lineWidth = 2;
            ctx.strokeRect(left, top, bench.width, 18);
            ctx.fillStyle = '#44403c';
            ctx.fillRect(left + 8, top + 18, 12, 38);
            ctx.fillRect(left + bench.width - 20, top + 18, 12, 38);
            ctx.fillRect(left + 29, top + 24, 45, 27);
            ctx.strokeStyle = '#78716c';
            ctx.strokeRect(left + 29, top + 24, 45, 27);

            ctx.fillStyle = '#a8a29e';
            ctx.fillRect(left + 10, top - 8, 30, 7);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(left + 72, top - 7, 18, 10);
            ctx.fillStyle = '#f59e0b';
            ctx.beginPath();
            ctx.arc(left + 52, top - 4, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#d6d3d1';
            ctx.beginPath();
            ctx.moveTo(left + 16, top - 11);
            ctx.lineTo(left + 29, top + 3);
            ctx.stroke();

            ctx.fillStyle = '#0c0a09';
            ctx.fillRect(bench.x - 54, top - 34, 108, 22);
            ctx.fillStyle = '#fb923c';
            ctx.font = 'bold 13px "Chakra Petch"';
            ctx.textAlign = 'center';
            ctx.fillText(`WORKBENCH L${bench.workbenchLevel}`, bench.x, top - 19);

            if (this.isNearWorkbench()) {
                ctx.fillStyle = '#fff7ed';
                ctx.font = 'bold 15px "Chakra Petch"';
                ctx.fillText('[E] USE BENCH', bench.x, bench.y + bench.interactionRadius - 8);
            }
            ctx.restore();
        },

        drawBuildings: function () {
            for (const building of this.buildings) {
                if (this.isOnScreen && !this.isOnScreen(building.x, building.y, 180)) continue;
                const left = building.x - building.width / 2;
                const top = building.y - building.height / 2;
                const color = `rgb(${building.color[0]}, ${building.color[1]}, ${building.color[2]})`;
                const nearby = this.getNearbyStation() === `building:${building.id}`;
                ctx.save();
                ctx.fillStyle = nearby ? 'rgba(249,115,22,.14)' : 'rgba(249,115,22,.05)';
                ctx.beginPath();
                ctx.arc(building.x, building.y, building.interactionRadius || 76, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = nearby ? '#fb923c' : 'rgba(120,113,108,.35)';
                ctx.setLineDash([7, 6]);
                ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = 'rgba(0,0,0,.42)';
                ctx.fillRect(left + 7, top + 8, building.width, building.height);
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(left, top, building.width, building.height);
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.strokeRect(left, top, building.width, building.height);
                ctx.fillStyle = color;
                ctx.fillRect(left, top, building.width, 12);
                ctx.fillStyle = '#d6d3d1';
                ctx.fillRect(left + 12, top + 24, building.width - 24, 8);
                ctx.fillRect(left + 18, top + 42, building.width - 36, 6);
                ctx.fillStyle = '#0c0a09';
                ctx.font = 'bold 11px "Chakra Petch"';
                ctx.textAlign = 'center';
                ctx.fillText(building.name.toUpperCase(), building.x, top - 9);
                ctx.fillStyle = '#fb923c';
                ctx.fillText(building.ownerName || 'P1', building.x, top + building.height + 15);

                const hpPercent = Math.max(0, building.health / building.maxHealth);
                ctx.fillStyle = '#111827';
                ctx.fillRect(left, top - 24, building.width, 5);
                ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#f97316' : '#ef4444';
                ctx.fillRect(left, top - 24, building.width * hpPercent, 5);

                if (nearby) {
                    ctx.fillStyle = '#fff7ed';
                    ctx.font = 'bold 15px "Chakra Petch"';
                    ctx.fillText('[E] USE STATION', building.x, building.y + (building.interactionRadius || 76) - 7);
                }
                ctx.restore();
            }
        },

        drawBuildingPreview: function () {
            const building = this.placingBuilding;
            const valid = this.getPlacementValidation ? this.getPlacementValidation('building', building, this.mouse.worldX, this.mouse.worldY).ok : true;
            const left = this.mouse.worldX - building.width / 2;
            const top = this.mouse.worldY - building.height / 2;
            ctx.save();
            ctx.fillStyle = valid ? `rgba(${building.color[0]}, ${building.color[1]}, ${building.color[2]}, 0.35)` : 'rgba(239,68,68,.42)';
            ctx.strokeStyle = valid ? `rgb(${building.color[0]}, ${building.color[1]}, ${building.color[2]})` : '#ef4444';
            ctx.lineWidth = 2;
            ctx.fillRect(left, top, building.width, building.height);
            ctx.strokeRect(left, top, building.width, building.height);
            ctx.restore();
        },

        getResourceMultiplier: function () {
            return 1
                + this.player.skillLevels.resourceMultiplier * 0.1
                + (this.runUpgradeCounts.salvage || 0) * 0.15
                + (this.activePotions.resource > performance.now() ? 0.75 : 0);
        },

        getPlayerDamageMultiplier: function () {
            return 1
                + this.player.skillLevels.bulletDamage * 0.1
                + (this.runUpgradeCounts.caliber || 0) * 0.12;
        },

        getPlayerBulletDamage: function (baseDamage) {
            let damage = baseDamage * this.getPlayerDamageMultiplier();
            if (this.activePotions.crit > performance.now() && Math.random() < 0.18) {
                damage *= 2;
            }
            return damage;
        },

        applyPlayerDamage: function (amount) {
            const reduction = this.activePotions.armor > performance.now() ? 0.35 : 0;
            this.player.health -= amount * (1 - reduction);
        },

        damageZombie: function (zombie, amount) {
            if (zombie.weakSpotUntil && performance.now() < zombie.weakSpotUntil) amount *= 1.35;
            let remaining = amount;
            if (zombie.shieldHealth > 0) {
                const absorbed = Math.min(zombie.shieldHealth, remaining);
                zombie.shieldHealth -= absorbed;
                remaining -= absorbed;
                if (absorbed > 0) this.createSpark(zombie.x, zombie.y, [55, 190, 255], 3);
            }
            if (remaining <= 0) return;
            zombie.health -= remaining * (1 - (zombie.armor || 0));
        },

        spawnBossMinion: function (typeKey, x, y, scale = 0.75) {
            const type = this.zombieTypes[typeKey] || this.zombieTypes.normal;
            const health = Math.max(35, Math.floor(type.health * scale));
            this.zombies.push({
                ...type,
                type: typeKey,
                x: x + Math.random() * 70 - 35,
                y: y + Math.random() * 70 - 35,
                health,
                maxHealth: health,
                reward: Math.max(4, Math.floor((type.reward || 8) * 0.35)),
                xp: Math.max(4, Math.floor((type.xp || type.reward || 8) * 0.35)),
                damageScale: this.currentWavePlan?.damageScale || 1,
                lastShot: 0,
                lastSlam: 0,
                lastMelee: 0,
                lastHeal: 0,
                lastWeld: 0
            });
        },

        updateBossMechanics: function (z, target, now) {
            if (!z.isBoss || !target) return false;
            if (z.stunnedUntil && now < z.stunnedUntil) return true;

            if (z.bossKind === 'burrow') {
                if (z.hidden) {
                    if (now >= z.emergeAt) {
                        z.x = z.emergeX;
                        z.y = z.emergeY;
                        z.hidden = false;
                        z.burrowWarning = null;
                        z.lastBurrow = now;
                        for (let i = 0; i < 3; i++) this.spawnBossMinion(i === 0 ? 'runner' : 'normal', z.x, z.y, 0.65);
                    }
                    return true;
                }
                if (now - (z.lastBurrow || 0) > (z.burrowRate || 5600) && target.distance > 140) {
                    const angle = Math.random() * Math.PI * 2;
                    z.emergeX = target.x + Math.cos(angle) * (70 + Math.random() * 55);
                    z.emergeY = target.y + Math.sin(angle) * (70 + Math.random() * 55);
                    z.emergeAt = now + 1150;
                    z.hidden = true;
                    z.burrowWarning = { x: z.emergeX, y: z.emergeY, until: z.emergeAt };
                    return true;
                }
                if (now - (z.lastSpawn || 0) > (z.spawnRate || 4200)) {
                    z.lastSpawn = now;
                    this.spawnBossMinion(Math.random() < 0.5 ? 'runner' : 'normal', z.x, z.y, 0.7);
                }
            }

            if (z.bossKind === 'chargerBrute') {
                if (z.chargeWindupUntil && now < z.chargeWindupUntil) return true;
                if (z.chargeWindupUntil && now >= z.chargeWindupUntil) {
                    z.chargeWindupUntil = 0;
                    z.chargeUntil = now + (z.chargeDuration || 800);
                    z.warningLine = null;
                }
                if (z.chargeUntil && now < z.chargeUntil) {
                    z.x += Math.cos(z.chargeAngle || 0) * (z.chargeSpeed || 5);
                    z.y += Math.sin(z.chargeAngle || 0) * (z.chargeSpeed || 5);
                    for (const wall of this.walls) {
                        if (this.dist(z.x, z.y, wall.x, wall.y) < z.size + (wall.radius || 25)) {
                            if ((wall.wallStage || 0) < 2) wall.health = 0;
                            else {
                                z.stunnedUntil = now + 1500;
                                z.chargeUntil = 0;
                            }
                            break;
                        }
                    }
                    return true;
                }
                if (z.chargeUntil && now >= z.chargeUntil) z.chargeUntil = 0;
                if (target.distance < 520 && now - (z.lastCharge || 0) > (z.chargeRate || 4600)) {
                    z.lastCharge = now;
                    z.chargeAngle = Math.atan2(target.y - z.y, target.x - z.x);
                    z.chargeWindupUntil = now + (z.warningDuration || 720);
                    z.warningLine = { x1: z.x, y1: z.y, x2: target.x, y2: target.y, until: z.chargeWindupUntil };
                    return true;
                }
            }

            if (z.bossKind === 'tesla') {
                if (z.empChargeUntil) {
                    if (now >= z.empChargeUntil) {
                        z.empChargeUntil = 0;
                        z.empPulseUntil = now + 650;
                        if (this.createEmpPulse) this.createEmpPulse(z.x, z.y, z.empRadius || 240);
                        for (const sentry of this.sentries) {
                            if (this.dist(z.x, z.y, sentry.x, sentry.y) < (z.empRadius || 240)) sentry.isDisabled = now + 5200;
                        }
                        for (let i = 0; i < 2; i++) this.spawnBossMinion('disruptor', z.x, z.y, 0.68);
                    }
                    return true;
                }
                if (z.empPulseUntil && now >= z.empPulseUntil) z.empPulseUntil = 0;
                if (now - (z.lastEmp || 0) > (z.empRate || 6400)) {
                    z.lastEmp = now;
                    z.empChargeUntil = now + (z.empWindup || 1100);
                    return true;
                }
                if (now - (z.lastSpawn || 0) > (z.spawnRate || 7600)) {
                    z.lastSpawn = now;
                    this.spawnBossMinion('disruptor', z.x, z.y, 0.65);
                }
            }

            if (z.bossKind === 'brood' && now - (z.lastSpawn || 0) > (z.spawnRate || 2900)) {
                z.lastSpawn = now;
                z.weakSpotUntil = now + (z.weakSpotDuration || 950);
                for (let i = 0; i < 2; i++) this.spawnBossMinion(Math.random() < 0.5 ? 'runner' : 'splitter', z.x, z.y, 0.55);
            }

            if (z.bossKind === 'toxic' && now - (z.lastPuddle || 0) > (z.puddleRate || 1200)) {
                z.lastPuddle = now;
                this.acidPools.push({ x: z.x, y: z.y, radius: 42, life: 260, damage: 0.55, toxicBoss: true });
            }

            return false;
        },

        tryBossDodge: function (z, bullet) {
            if (!z.isBoss || !bullet.explosive || bullet.fromZombie) return false;
            const now = performance.now();
            const projectileSpeed = Math.sqrt((bullet.vx || 0) ** 2 + (bullet.vy || 0) ** 2);
            const distance = this.dist(bullet.x, bullet.y, z.x, z.y);
            if (projectileSpeed > 7 || distance < z.size + 26 || distance > 165 || now - (z.lastDodge || 0) < 4200) return false;
            z.lastDodge = now;
            z.dodgeUntil = now + 360;
            const sign = Math.random() < 0.5 ? -1 : 1;
            const angle = Math.atan2(bullet.vy || 0, bullet.vx || 1) + Math.PI / 2 * sign;
            z.x += Math.cos(angle) * 76;
            z.y += Math.sin(angle) * 76;
            return true;
        },

        getNearestEnemyTarget: function (zombie, includeStructures) {
            const candidates = [{
                entity: this.player,
                x: this.player.x,
                y: this.player.y,
                radius: this.PLAYER_RADIUS,
                kind: 'player'
            }];
            this.remotePlayers.forEach((player) => candidates.push({
                entity: player,
                x: player.x,
                y: player.y,
                radius: this.PLAYER_RADIUS,
                kind: 'remotePlayer'
            }));
            if (includeStructures) {
                this.walls.forEach((wall) => candidates.push({
                    entity: wall,
                    x: wall.x,
                    y: wall.y,
                    radius: wall.radius,
                    kind: 'structure'
                }));
                this.sentries.forEach((sentry) => candidates.push({
                    entity: sentry,
                    x: sentry.x,
                    y: sentry.y,
                    radius: sentry.radius,
                    kind: 'structure'
                }));
                this.buildings.forEach((building) => candidates.push({
                    entity: building,
                    x: building.x,
                    y: building.y,
                    radius: Math.max(building.width, building.height) / 2,
                    kind: 'structure'
                }));
            }
            return candidates.reduce((nearest, candidate) => {
                const distance = this.dist(zombie.x, zombie.y, candidate.x, candidate.y);
                return !nearest || distance < nearest.distance ? { ...candidate, distance } : nearest;
            }, null);
        },

        getShelterBreachPlan: function (zombie, target) {
            if (!window.LastShopperWorld || !target || !['player', 'remotePlayer'].includes(target.kind)) return null;
            const structure = (this.mapStructures || []).find((entry) =>
                window.LastShopperWorld.pointInside(entry, target.x, target.y, 2));
            if (!structure || window.LastShopperWorld.pointInside(structure, zombie.x, zombie.y, -zombie.size)) return null;
            const entries = [{
                id: `${structure.id}:door`,
                kind: 'door',
                entity: structure.door,
                width: structure.door.width,
                ...window.LastShopperWorld.doorPoint(structure)
            }, ...window.LastShopperWorld.windowPoints(structure).map((entry) => ({
                id: entry.id,
                kind: 'window',
                entity: structure.windows.find((candidate) => candidate.id === entry.id),
                width: entry.width,
                x: entry.x,
                y: entry.y
            }))];
            const isPassable = (entry) => entry.kind === 'door'
                ? entry.entity.open || entry.entity.destroyed
                : entry.entity.breached;
            const usableEntries = entries.filter((entry) => (entry.width || 0) >= zombie.size * 2 + 12);
            const choicesBySize = usableEntries.length ? usableEntries : entries;
            const passable = choicesBySize.filter(isPassable);
            const sealed = choicesBySize.filter((entry) => !isPassable(entry));
            let selected = choicesBySize.find((entry) => entry.id === zombie.breachTargetId);
            if (!selected) {
                const preferWindow = zombie.isFlanker || zombie.type === 'runner' || zombie.type === 'fast'
                    || String(zombie.id || '').charCodeAt(String(zombie.id || '').length - 1) % 3 === 0;
                const preferred = preferWindow ? sealed.filter((entry) => entry.kind === 'window') : [];
                const choices = preferred.length ? preferred : (passable.length ? passable : sealed);
                selected = choices.reduce((nearest, entry) => {
                    const distance = this.dist(zombie.x, zombie.y, entry.x, entry.y);
                    return !nearest || distance < nearest.distance ? { ...entry, distance } : nearest;
                }, null);
                if (selected) zombie.breachTargetId = selected.id;
            }
            if (!selected) return null;
            return {
                structure,
                entry: selected,
                distance: this.dist(zombie.x, zombie.y, selected.x, selected.y),
                passable: isPassable(selected)
            };
        },

        damageShelterEntry: function (zombie, breachPlan, now) {
            if (!breachPlan || breachPlan.passable || breachPlan.distance > zombie.size + 24) return false;
            const entry = breachPlan.entry.entity;
            if (zombie.isBomber) {
                entry.health -= zombie.explosionDamage || 180;
                zombie.health = 0;
                zombie.exploded = true;
                this.createExplosion(breachPlan.entry.x, breachPlan.entry.y, zombie.explosionDamage || 180);
            } else if (now - (zombie.lastBreachHit || 0) >= (zombie.attackRate || 650)) {
                zombie.lastBreachHit = now;
                const bossScale = zombie.isBoss || zombie.isMiniBoss ? 2.4 : 1;
                entry.health -= Math.max(12, (zombie.contactDamage || 8) * 1.45) * (zombie.damageScale || 1) * bossScale;
                this.createSpark(breachPlan.entry.x, breachPlan.entry.y, breachPlan.entry.kind === 'door' ? [120, 70, 30] : [125, 190, 215], 5);
            }
            if (entry.health <= 0) {
                entry.health = 0;
                if (breachPlan.entry.kind === 'door') {
                    entry.destroyed = true;
                    entry.open = true;
                } else {
                    entry.breached = true;
                }
                zombie.breachTargetId = null;
            }
            return true;
        },

        resolveZombieStructureCollision: function (zombie, previousX, previousY) {
            if (window.LastShopperWorld) {
                const blocked = (this.mapStructures || []).some((structure) =>
                    window.LastShopperWorld.wallSegments(structure).some((wall) =>
                        this.rectBlocked(zombie.x, zombie.y, zombie.size, wall)));
                if (blocked) {
                    const moveX = zombie.x - previousX;
                    const moveY = zombie.y - previousY;
                    zombie.x = previousX;
                    zombie.y = previousY;
                    const turn = zombie.wallTurn || (zombie.wallTurn = Math.random() < 0.5 ? -1 : 1);
                    zombie.x += -moveY * turn;
                    zombie.y += moveX * turn;
                    const stillBlocked = (this.mapStructures || []).some((structure) =>
                        window.LastShopperWorld.wallSegments(structure).some((wall) =>
                            this.rectBlocked(zombie.x, zombie.y, zombie.size, wall)));
                    if (stillBlocked) {
                        zombie.x = previousX;
                        zombie.y = previousY;
                        zombie.wallTurn *= -1;
                    }
                    return;
                }
                zombie.wallTurn = 0;
            }
            const blockers = [
                ...this.walls.filter((wall) => !wall.isWorkbench),
                { ...this.workbench, softBlocker: true },
                ...this.buildings
            ];
            for (const blocker of blockers) {
                const radius = zombie.size + (blocker.radius || Math.max(blocker.width || 0, blocker.height || 0) / 2 || 0);
                if (this.dist(zombie.x, zombie.y, blocker.x, blocker.y) >= radius) continue;
                if (blocker.softBlocker) {
                    const dx = zombie.x - blocker.x || 1;
                    const dy = zombie.y - blocker.y || 1;
                    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
                    zombie.x = blocker.x + (dx / distance) * radius;
                    zombie.y = blocker.y + (dy / distance) * radius;
                    return;
                }
                zombie.x = previousX;
                zombie.y = previousY;
                if (performance.now() - (zombie.lastStructureBump || 0) > 650) {
                    zombie.lastStructureBump = performance.now();
                    blocker.health -= (zombie.contactDamage || 7) * (zombie.damageScale || 1);
                    if (blocker.isElectric) {
                        this.damageZombie(zombie, blocker.shockDamage || 20);
                        this.createSpark(zombie.x, zombie.y, blocker.color || [30, 165, 245]);
                    }
                }
                return;
            }
        },

        gainXp: function (amount) {
            this.player.xp += Math.max(1, Math.floor(amount));
            while (this.player.xp >= this.player.xpToNext) {
                this.player.xp -= this.player.xpToNext;
                this.player.level++;
                this.player.skillPoints++;
                this.player.xpToNext = progression.xpToNext(this.player.level);
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 15);
            }
        },

        toggleSkills: function (isOpen) {
            this.skillsOpen = isOpen;
            this.mouse.isDown = false;
            if (isOpen) {
                this.populateSkills();
                skillModal.classList.remove('hidden');
                skillModal.classList.add('flex');
            } else {
                skillModal.classList.add('hidden');
                skillModal.classList.remove('flex');
            }
        },

        populateSkills: function () {
            skillContent.innerHTML = '';
            content.skills.forEach((skill) => {
                const level = this.player.skillLevels[skill.id];
                const canBuy = this.player.skillPoints > 0 && level < skill.max;
                const card = document.createElement('div');
                card.className = 'skill-card';
                card.innerHTML = `
                    <span class="window-kicker">LEVEL ${level} / ${skill.max}</span>
                    <h3>${skill.name}</h3>
                    <p>${skill.description} per level</p>
                    <button class="btn ${canBuy ? 'btn-success' : 'btn-secondary opacity-50'}"
                        ${canBuy ? '' : 'disabled'} onclick="game.buySkill('${skill.id}')">
                        ${level >= skill.max ? 'MAXED' : 'SPEND 1 POINT'}
                    </button>
                `;
                skillContent.appendChild(card);
            });
        },

        buySkill: function (id) {
            const definition = content.skills.find((skill) => skill.id === id);
            if (!definition || this.player.skillPoints <= 0) return;
            if (this.player.skillLevels[id] >= definition.max) return;

            this.player.skillPoints--;
            this.player.skillLevels[id]++;
            if (id === 'maxHealth') {
                this.player.baseMaxHealth += 20;
                this.player.maxHealth += 20;
                this.player.health += 20;
            } else if (id === 'moveSpeed') {
                this.player.speed *= 1.05;
            }
            this.populateSkills();
            this.updateHUD();
        },

        showWaveReward: function () {
            if (this.placingSentry || this.placingWall || this.placingTrap) this.cancelPlacing();
            this.toggleCrafting(false);
            this.toggleShop(false);
            this.toggleWorkbench(false);
            this.toggleSkills(false);
            this.toggleTrader(false);
            const reward = this.currentWavePlan.waveReward;
            const multiplier = this.getResourceMultiplier();
            const teamScale = 1 + Math.max(0, this.team.playerCount - 1) * 0.65;
            const money = Math.floor(reward.money * multiplier * teamScale);
            const wood = Math.max(1, Math.round(reward.wood * multiplier * teamScale));
            const metal = Math.max(1, Math.round(reward.metal * multiplier * teamScale));
            this.player.money += money;
            this.player.wood += wood;
            this.player.metal += metal;
            this.metaProgression.highestWave = Math.max(this.metaProgression.highestWave || 0, this.wave);
            this.updateLobbyMeta();
            this.populateSkinList();
            this.saveMetaProgression();
            this.waitingForReward = false;
            this.mouse.isDown = false;

            const previousTier = this.techTier;
            this.techTier = Math.max(this.techTier, progression.unlockedTechForWave(this.wave));
            const unlockedTier = this.techTier > previousTier;
            const rewardText = `Wave ${this.wave} cleared: +$${money}, +${wood} wood, +${metal} metal`;
            const tierText = unlockedTier ? `Tech Tier ${roman(this.techTier)} unlocked` : '';
            const statusText = tierText ? `${rewardText} | ${tierText}` : rewardText;
            this.updateHUD();

            if (this.wave % 5 === 0) {
                this.showMilestoneUpgrade(statusText);
            } else {
                this.showWaveStatus(statusText, 4200);
                this.finishWaveBreak();
            }
        },

        applyRunUpgrade: function (id) {
            const upgrade = content.runUpgrades.find((entry) => entry.id === id);
            if (!upgrade) return null;
            this.runUpgradeCounts[id] = (this.runUpgradeCounts[id] || 0) + 1;

            if (id === 'vitality') {
                this.player.baseMaxHealth += 25;
                this.player.maxHealth += 25;
                this.player.health = Math.min(this.player.maxHealth, this.player.health + 25);
            } else if (id === 'turretCore') {
                this.sentries.forEach((sentry) => {
                    sentry.damage *= 1.15;
                    sentry.fireRate *= 0.87;
                });
            } else if (id === 'fortify') {
                [...this.sentries, ...this.walls].forEach((defense) => {
                    defense.maxHealth *= 1.2;
                    defense.health *= 1.2;
                });
            } else if (id === 'longShot') {
                this.sentries.forEach((sentry) => { sentry.range *= 1.15; });
            } else if (id === 'fieldRepair') {
                [...this.sentries, ...this.walls].forEach((defense) => {
                    defense.health = Math.min(defense.maxHealth, defense.health + defense.maxHealth * 0.4);
                });
            } else if (id === 'deepPockets') {
                this.player.reserveAmmo += 80;
                this.weapons.forEach((weapon) => {
                    const added = Math.max(1, Math.floor(weapon.maxAmmo * 0.2));
                    weapon.maxAmmo += added;
                    weapon.currentAmmo += added;
                });
            }
            return upgrade;
        },

        showMilestoneUpgrade: function (statusText) {
            this.waitingForReward = true;
            this.selectedReward = false;
            this.pendingWaveStatus = statusText;
            waveRewardTitle.textContent = 'Choose a Scavenged Upgrade';
            waveRewardSummary.textContent = `${statusText}. Pick one improvement before the next wave.`;
            upgradeCardContainer.innerHTML = '';
            upgradeCardContainer.classList.remove('hidden');
            waveContinueButton.classList.add('hidden');

            progression.pickUpgradeCards(3, this.runUpgradeCounts).forEach((upgrade) => {
                const card = document.createElement('button');
                card.className = 'upgrade-card';
                card.innerHTML = `
                    <span class="window-kicker">MILESTONE UPGRADE</span>
                    <h3>${upgrade.name}</h3>
                    <p>${upgrade.description}</p>
                `;
                card.onclick = () => this.selectRunUpgrade(upgrade.id);
                upgradeCardContainer.appendChild(card);
            });

            waveRewardModal.classList.remove('hidden');
            waveRewardModal.classList.add('flex');
        },

        selectRunUpgrade: function (id) {
            if (this.selectedReward) return;
            const upgrade = this.applyRunUpgrade(id);
            if (!upgrade) return;
            this.selectedReward = true;

            Array.from(upgradeCardContainer.children).forEach((card) => {
                card.disabled = true;
                card.classList.add('opacity-50');
            });
            this.showWaveStatus(`${this.pendingWaveStatus} | Upgrade: ${upgrade.name}`, 4400);
            this.waitingForReward = false;
            clearTimeout(this.milestoneCloseTimeout);
            this.milestoneCloseTimeout = setTimeout(() => {
                waveRewardModal.classList.add('hidden');
                waveRewardModal.classList.remove('flex');
                this.finishWaveBreak();
            }, 350);
            this.updateHUD();
        },

        continueAfterReward: function () {
            return;
        },

        finishWaveBreak: function () {
            if ((this.wave + 1) % 10 === 0) {
                this.startBossPreparation(35);
                return;
            }
            if (this.waveEndTimeout) clearTimeout(this.waveEndTimeout);
            this.waveEndTimeout = setTimeout(() => this.startWave(), 4000);
        },

        showWaveStatus: function (text, duration) {
            waveStatusToast.textContent = text;
            waveStatusToast.classList.remove('hidden');
            clearTimeout(this.waveStatusTimeout);
            this.waveStatusTimeout = setTimeout(() => waveStatusToast.classList.add('hidden'), duration || 3200);
        },

        startBossPreparation: function (seconds, forcedEvent) {
            if (this.waveEndTimeout) clearTimeout(this.waveEndTimeout);
            const eventType = forcedEvent || (Math.random() < 0.5 ? 'supply' : 'trader');
            this.preparationActive = true;
            this.preparationEvent = eventType;
            this.preparationEndsAt = performance.now() + seconds * 1000;
            this.waveActive = false;
            this.zombies.length = 0;
            this.bullets.length = 0;

            if (eventType === 'supply') {
                const waveScale = 1 + this.wave * 0.08;
                this.supplyDrop = {
                    x: 760,
                    y: 930,
                    interactionRadius: 72,
                    collected: false,
                    rewards: {
                        money: Math.floor(120 * waveScale),
                        wood: Math.ceil(12 * waveScale),
                        metal: Math.ceil(9 * waveScale),
                        ammo: Math.ceil(70 * waveScale)
                    }
                };
                this.trader = null;
                prepEventLabel.textContent = 'SUPPLY DROP INBOUND';
                prepEventDetail.textContent = 'A relief crate landed in the parking lot. Reach it and press [E].';
            } else {
                this.supplyDrop = null;
                this.trader = { x: 760, y: 790, interactionRadius: 78 };
                prepEventLabel.textContent = 'TRAVELING TRADER';
                prepEventDetail.textContent = 'Discount stock is parked beside the shop. Press [E] to trade.';
            }

            intermissionTimer.classList.remove('hidden');
            hud.waveInfoContainer.classList.add('hidden');
            this.updatePreparationEvent();
        },

        updatePreparationEvent: function () {
            if (!this.preparationActive) return;
            const seconds = Math.max(0, Math.ceil((this.preparationEndsAt - performance.now()) / 1000));
            prepCountdown.textContent = `Boss incoming in ${seconds}s`;
            if (seconds > 0) return;

            this.preparationActive = false;
            this.preparationEvent = null;
            this.supplyDrop = null;
            this.trader = null;
            this.toggleTrader(false);
            this.hideIntermissionTimer();
            if (this.isWorldHost()) this.startWave();
        },

        drawPreparationEvent: function () {
            if (!this.preparationActive) return;
            if (this.supplyDrop && !this.supplyDrop.collected) {
                const drop = this.supplyDrop;
                const nearby = this.dist(this.player.x, this.player.y, drop.x, drop.y) <= drop.interactionRadius;
                ctx.save();
                ctx.translate(drop.x, drop.y);
                ctx.fillStyle = nearby ? 'rgba(249,115,22,.18)' : 'rgba(249,115,22,.07)';
                ctx.beginPath();
                ctx.arc(0, 0, drop.interactionRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = nearby ? '#fb923c' : '#78716c';
                ctx.setLineDash([7, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(249,115,22,.12)';
                ctx.fillRect(-5, -260, 10, 225);
                ctx.fillStyle = '#57534e';
                ctx.fillRect(-30, -24, 60, 48);
                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 3;
                ctx.strokeRect(-30, -24, 60, 48);
                ctx.fillStyle = '#fb923c';
                ctx.fillRect(-30, -5, 60, 8);
                ctx.fillStyle = '#0c0a09';
                ctx.font = 'bold 11px "Chakra Petch"';
                ctx.textAlign = 'center';
                ctx.fillText('RELIEF', 0, -9);
                if (nearby) {
                    ctx.fillStyle = '#fff7ed';
                    ctx.font = 'bold 15px "Chakra Petch"';
                    ctx.fillText('[E] COLLECT SUPPLIES', 0, 48);
                }
                ctx.restore();
            }

            if (this.trader) {
                const trader = this.trader;
                const nearby = this.dist(this.player.x, this.player.y, trader.x, trader.y) <= trader.interactionRadius;
                ctx.save();
                ctx.translate(trader.x, trader.y);
                ctx.fillStyle = nearby ? 'rgba(249,115,22,.16)' : 'rgba(249,115,22,.06)';
                ctx.beginPath();
                ctx.arc(0, 0, trader.interactionRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = nearby ? '#fb923c' : '#78716c';
                ctx.setLineDash([7, 6]);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = '#292524';
                ctx.fillRect(-44, -22, 88, 44);
                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 3;
                ctx.strokeRect(-44, -22, 88, 44);
                ctx.fillStyle = '#78350f';
                ctx.fillRect(-38, -15, 24, 22);
                ctx.fillStyle = '#78716c';
                ctx.fillRect(-8, -15, 18, 22);
                ctx.fillStyle = '#f97316';
                ctx.fillRect(16, -15, 20, 22);
                ctx.fillStyle = '#0c0a09';
                ctx.beginPath();
                ctx.arc(-25, 27, 9, 0, Math.PI * 2);
                ctx.arc(25, 27, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#fb923c';
                ctx.font = 'bold 13px "Chakra Petch"';
                ctx.textAlign = 'center';
                ctx.fillText('TRADER', 0, -33);
                if (nearby) {
                    ctx.fillStyle = '#fff7ed';
                    ctx.font = 'bold 15px "Chakra Petch"';
                    ctx.fillText('[E] TRADE', 0, 55);
                }
                ctx.restore();
            }
        },

        collectSupplyDrop: function () {
            const drop = this.supplyDrop;
            if (!drop || drop.collected) return;
            if (this.dist(this.player.x, this.player.y, drop.x, drop.y) > drop.interactionRadius) return;
            const rewards = drop.rewards;
            this.player.money += rewards.money;
            this.player.wood += rewards.wood;
            this.player.metal += rewards.metal;
            this.player.reserveAmmo += rewards.ammo;
            drop.collected = true;
            this.showWaveStatus(`Supplies secured: +$${rewards.money}, +${rewards.wood} wood, +${rewards.metal} metal, +${rewards.ammo} ammo`);
            this.updateHUD();
        },

        getAmmoPackCost: function (pack, discount = 1) {
            const cost = { ...(pack.cost || {}) };
            if (cost.money) cost.money = Math.max(1, Math.floor(cost.money * discount));
            return cost;
        },

        getAmmoStoreHtml: function (source = 'shop', discount = 1, packIds = null) {
            const packs = content.ammoPacks.filter((pack) => !packIds || packIds.includes(pack.id));
            const sourceLabel = source === 'trader' ? 'DISCOUNT AMMO' : source === 'workbench' ? 'BENCH AMMO' : 'SHOP AMMO';
            return `
                <section class="ammo-store-panel">
                    <div class="ammo-store-header">
                        <div>
                            <span class="window-kicker">${sourceLabel}</span>
                            <h3>Reserve Ammo: ${this.player.reserveAmmo}</h3>
                        </div>
                        <p>Ammo purchases go to reserve ammo. Full refill also tops off owned magazines.</p>
                    </div>
                    <div class="ammo-pack-grid">
                        ${packs.map((pack) => {
                            const cost = this.getAmmoPackCost(pack, discount);
                            const canAfford = hasCost(this.player, cost);
                            return `<article class="ammo-pack-card">
                                <span class="window-kicker">${pack.id === 'full' ? 'FULL REFILL' : `+${pack.ammo} AMMO`}</span>
                                <div class="workbench-item-title">${pack.name}</div>
                                <p class="workbench-item-desc">${pack.description}</p>
                                <div class="workbench-cost-row">${costChips(this.player, cost)}</div>
                                <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.buyAmmoPack('${pack.id}', '${source}', ${discount})">
                                    ${canAfford ? 'Buy Ammo' : 'Need Cash'}
                                </button>
                            </article>`;
                        }).join('')}
                    </div>
                </section>`;
        },

        buyAmmoPack: function (id, source = 'shop', discount = 1) {
            const pack = content.ammoPacks.find((entry) => entry.id === id);
            if (!pack) return;
            const cost = this.getAmmoPackCost(pack, discount);
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            this.player.reserveAmmo += pack.ammo || 0;
            if (pack.refillWeapons) {
                this.weapons.filter((weapon) => weapon.owned).forEach((weapon) => {
                    weapon.currentAmmo = weapon.maxAmmo;
                });
            }
            if (source === 'trader') this.populateTrader();
            else if (source === 'workbench') this.populateWorkbench();
            else this.populateShop();
            this.updateWeaponUI();
            this.updateHUD();
        },

        toggleTrader: function (isOpen) {
            this.traderOpen = Boolean(isOpen && this.trader && this.preparationActive);
            this.mouse.isDown = false;
            if (this.traderOpen) {
                this.populateTrader();
                traderModal.classList.remove('hidden');
                traderModal.classList.add('flex');
            } else {
                traderModal.classList.add('hidden');
                traderModal.classList.remove('flex');
            }
        },

        populateTrader: function () {
            if (this.trader && !this.trader.ammoDeals) {
                const shuffled = content.ammoPacks.map((pack) => pack.id).sort(() => Math.random() - 0.5);
                this.trader.ammoDeals = shuffled.slice(0, Math.random() < 0.55 ? 2 : 3);
            }
            const items = [
                { id: 'wood', name: 'Salvaged Lumber', description: '+12 wood', cost: 55 },
                { id: 'metal', name: 'Scrap Bundle', description: '+9 metal', cost: 80 },
                { id: 'ammo', name: 'Ammo Crate', description: '+75 reserve ammo', cost: 45 },
                { id: 'repairs', name: 'Crew Repairs', description: 'Restore all defenses and the bench', cost: 135 },
                { id: 'parts', name: 'Rare Turret Parts', description: '+1 part for high-tier machinery', cost: 280 }
            ];
            traderContent.innerHTML = `<p class="window-copy">Boss-wave discount stock. Cash is personal; placed defenses carry owner tags.</p>
                ${this.getAmmoStoreHtml('trader', 0.72, this.trader?.ammoDeals || ['small', 'medium'])}
                <div class="trader-stock">${items.map((item) => `
                    <div class="defense-card flex items-center justify-between">
                        <div><h3>${item.name}</h3><p>${item.description}</p></div>
                        <button class="btn ${this.player.money >= item.cost ? 'btn-primary' : 'btn-secondary opacity-50'}"
                            ${this.player.money >= item.cost ? '' : 'disabled'} onclick="game.buyTraderItem('${item.id}')">$${item.cost}</button>
                    </div>`).join('')}</div>`;
        },

        buyTraderItem: function (id) {
            const costs = { wood: 55, metal: 80, ammo: 45, repairs: 135, parts: 280 };
            const cost = costs[id];
            if (!cost || this.player.money < cost) return;
            this.player.money -= cost;
            if (id === 'wood') this.player.wood += 12;
            if (id === 'metal') this.player.metal += 9;
            if (id === 'ammo') this.player.reserveAmmo += 75;
            if (id === 'parts') this.player.rareTurretParts++;
            if (id === 'repairs') {
                [...this.sentries, ...this.walls].forEach((defense) => { defense.health = defense.maxHealth; });
                this.workbench.health = this.workbench.maxHealth;
            }
            this.populateTrader();
            this.updateHUD();
        },

        toggleBuilding: function (isOpen, id) {
            const building = id
                ? this.buildings.find((entry) => entry.id === id)
                : this.activeBuilding;
            this.buildingOpen = Boolean(isOpen && building);
            this.activeBuilding = this.buildingOpen ? building : null;
            this.mouse.isDown = false;
            if (this.buildingOpen) {
                this.populateBuilding();
                buildingModal.classList.remove('hidden');
                buildingModal.classList.add('flex');
            } else {
                buildingModal.classList.add('hidden');
                buildingModal.classList.remove('flex');
            }
        },

        populateBuilding: function () {
            const building = this.activeBuilding;
            if (!building) return;
            buildingKicker.textContent = 'BUILT STORE STATION';
            buildingTitle.textContent = building.name.toUpperCase();

            if (building.id === 'potionHut') {
                buildingContent.innerHTML = `<p class="window-copy">Temporary boosts crafted from salvage. Potion effects are timed and visible on the HUD.</p>
                    <div class="workbench-grid">${content.potionRecipes.map((recipe) => {
                        const canAfford = hasCost(this.player, recipe.cost);
                        return `<article class="workbench-item workbench-consumable">
                            <span class="window-kicker">POTION</span>
                            <div class="workbench-item-title">${recipe.name}</div>
                            <p class="workbench-item-desc">${recipe.description}</p>
                            <div class="workbench-cost-row">${costChips(this.player, recipe.cost)}</div>
                            <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.buyPotionRecipe('${recipe.id}')">Craft</button>
                        </article>`;
                    }).join('')}</div>`;
                return;
            }

            if (building.id === 'ammoForge') {
                buildingContent.innerHTML = `<p class="window-copy">Convert cash and scrap into reserve ammo. Useful before boss waves.</p>
                    <div class="workbench-grid">
                        ${[
                            ['small', 'Ammo Box', '+80 reserve ammo', { money: 90, metal: 2 }, 80],
                            ['large', 'Ammo Crate', '+240 reserve ammo', { money: 240, metal: 6 }, 240],
                            ['parts', 'Rare Parts Casting', '+1 rare turret part', { money: 450, metal: 14 }, 0]
                        ].map(([id, name, desc, cost]) => `<article class="workbench-item workbench-consumable">
                            <span class="window-kicker">FORGE</span>
                            <div class="workbench-item-title">${name}</div>
                            <p class="workbench-item-desc">${desc}</p>
                            <div class="workbench-cost-row">${costChips(this.player, cost)}</div>
                            <button class="btn ${hasCost(this.player, cost) ? 'btn-primary' : 'btn-secondary opacity-50'}" ${hasCost(this.player, cost) ? '' : 'disabled'} onclick="game.buyAmmoForge('${id}')">Forge</button>
                        </article>`).join('')}
                    </div>`;
                return;
            }

            if (building.id === 'weaponCore') {
                buildingContent.innerHTML = `<p class="window-copy">Original late-game weapon overclocking. Each level improves damage, reload, fire rate, magazine, and bullet visuals.</p>
                    <div class="workbench-grid">${this.weapons.filter((weapon) => weapon.owned).map((weapon) => {
                        const index = this.weapons.indexOf(weapon);
                        const level = weapon.upgradeLevel || 0;
                        const cost = this.getWeaponUpgradeCost(weapon);
                        const canAfford = level < 5 && hasCost(this.player, cost);
                        return `<article class="workbench-item workbench-upgrade">
                            <span class="window-kicker">WEAPON CORE LV ${level} / 5</span>
                            <div class="workbench-item-title">${weapon.name}</div>
                            <p class="workbench-item-desc">Next level: +damage, faster reload/fire rate, bigger magazine, stronger bullet trail.</p>
                            <div class="workbench-cost-row">${level >= 5 ? '<span class="workbench-cost-item affordable">Maxed</span>' : costChips(this.player, cost)}</div>
                            <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.upgradeWeapon(${index})">${level >= 5 ? 'Maxed' : 'Overclock'}</button>
                        </article>`;
                    }).join('')}</div>`;
                return;
            }

            if (building.id === 'repairStation') {
                const cost = this.getRepairAllCost();
                buildingContent.innerHTML = `<p class="window-copy">A dedicated repair counter for base maintenance.</p>
                    <article class="workbench-item workbench-consumable">
                        <span class="window-kicker">REPAIR STATION</span>
                        <div class="workbench-item-title">Repair All Defenses</div>
                        <p class="workbench-item-desc">Repairs turrets, walls, buildings, and the workbench.</p>
                        <div class="workbench-cost-row">${costChips(this.player, cost)}</div>
                        <button class="btn ${hasCost(this.player, cost) ? 'btn-primary' : 'btn-secondary opacity-50'}" ${hasCost(this.player, cost) ? '' : 'disabled'} onclick="game.repairAllDefenses(); game.populateBuilding();">Repair All</button>
                    </article>`;
                return;
            }

            if (building.id === 'advancedTurretBench') {
                buildingContent.innerHTML = `<p class="window-copy">Installed effect: +2 turret cap and +2 turret upgrade cap while the station stands.</p>
                    <article class="workbench-item workbench-upgrade">
                        <span class="window-kicker">SUPPORT BENCH</span>
                        <div class="workbench-item-title">Advanced Turret Tuning</div>
                        <p class="workbench-item-desc">Return to the main workbench Turrets tab to fabricate and tune placed turrets.</p>
                    </article>`;
                return;
            }

            if (building.id === 'trapBench') {
                buildingContent.innerHTML = `<p class="window-copy">Installed effect: +4 trap cap while the station stands.</p>
                    <article class="workbench-item workbench-trap">
                        <span class="window-kicker">SUPPORT BENCH</span>
                        <div class="workbench-item-title">Trap Capacity Online</div>
                        <p class="workbench-item-desc">Return to the main workbench Traps tab to craft unlocked traps.</p>
                    </article>`;
                return;
            }

            if (building.id === 'powerRelay') {
                buildingContent.innerHTML = `<p class="window-copy">Installed effect: all turrets gain 15% range and recover one round every three seconds while this relay has power.</p>
                    <article class="workbench-item workbench-upgrade">
                        <span class="window-kicker">GRID ONLINE</span>
                        <div class="workbench-item-title">Defensive Power Network</div>
                        <p class="workbench-item-desc">Keep the relay standing. It is a priority target for Demolition Sappers.</p>
                    </article>`;
            }
        },

        buyPotionRecipe: function (id) {
            const recipe = content.potionRecipes.find((entry) => entry.id === id);
            if (!recipe || !hasCost(this.player, recipe.cost)) return;
            payCost(this.player, recipe.cost);
            const now = performance.now();
            if (recipe.type === 'instantHeal') {
                this.player.health = Math.min(this.player.maxHealth, this.player.health + recipe.multiplier);
            } else {
                this.activePotions[recipe.type] = now + recipe.duration;
                if (recipe.type === 'sprint') this.player.stamina = this.player.maxStamina;
            }
            this.populateBuilding();
            this.updateHUD();
        },

        buyAmmoForge: function (id) {
            const options = {
                small: { cost: { money: 90, metal: 2 }, ammo: 80 },
                large: { cost: { money: 240, metal: 6 }, ammo: 240 },
                parts: { cost: { money: 450, metal: 14 }, parts: 1 }
            };
            const option = options[id];
            if (!option || !hasCost(this.player, option.cost)) return;
            payCost(this.player, option.cost);
            this.player.reserveAmmo += option.ammo || 0;
            this.player.rareTurretParts += option.parts || 0;
            this.populateBuilding();
            this.updateHUD();
        },

        getWeaponUpgradeCost: function (weapon) {
            const level = weapon.upgradeLevel || 0;
            return { money: 650 + level * 650, metal: 10 + level * 7, parts: level >= 2 ? 1 : 0 };
        },

        upgradeWeapon: function (index) {
            const weapon = this.weapons[index];
            if (!weapon || !weapon.owned || (weapon.upgradeLevel || 0) >= 5) return;
            const cost = this.getWeaponUpgradeCost(weapon);
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            weapon.upgradeLevel = (weapon.upgradeLevel || 0) + 1;
            weapon.damage *= 1.18;
            weapon.fireRate *= 0.92;
            weapon.reloadTime *= 0.92;
            const addedMag = Math.max(1, Math.ceil(weapon.maxAmmo * 0.12));
            weapon.maxAmmo += addedMag;
            weapon.currentAmmo += addedMag;
            weapon.bulletSize = (weapon.bulletSize || 4) + 0.4;
            this.populateBuilding();
            this.updateWeaponUI();
            this.updateHUD();
        },

        getActiveWorkbench: function () {
            return this.isNearWorkbench() ? this.workbench : null;
        },

        getPlacementLimits: function () {
            const benchLevel = this.workbench?.workbenchLevel || 1;
            const hasAdvancedBench = this.buildings.some((building) => building.id === 'advancedTurretBench');
            const hasTrapBench = this.buildings.some((building) => building.id === 'trapBench');
            return {
                turrets: 4 + benchLevel * 2 + (hasAdvancedBench ? 2 : 0),
                walls: 18 + benchLevel * 10,
                traps: 6 + benchLevel * 4 + (hasTrapBench ? 4 : 0),
                buildings: 7
            };
        },

        showPlacementError: function (message) {
            this.placementError = message;
            placingItemText.textContent = message;
            if (this.showWaveStatus) this.showWaveStatus(message, 1700);
        },

        rectBlocked: function (x, y, radius, rect) {
            const halfW = rect.width / 2 + radius;
            const halfH = rect.height / 2 + radius;
            return x > rect.x - halfW && x < rect.x + halfW && y > rect.y - halfH && y < rect.y + halfH;
        },

        nearbyAny: function (x, y, radius, list, minDistance, skip) {
            return list.some((item) => item !== skip && this.dist(x, y, item.x, item.y) < minDistance + radius + (item.radius || Math.max(item.width || 0, item.height || 0) / 2 || 0));
        },

        getPlacementValidation: function (kind, item, x, y) {
            const limits = this.getPlacementLimits();
            const radius = item.radius || Math.max(item.width || 0, item.height || 0) / 2 || 20;
            const owned = (entries) => entries.filter((entry) => !entry.ownerId || entry.ownerId === this.localPlayerId);
            if (this.rectBlocked(x, y, radius, this.shop)) return { ok: false, message: 'Cannot build inside the shop.' };
            if (this.rectBlocked(x, y, radius, this.workbench)) return { ok: false, message: 'Keep the workbench clear.' };
            if (window.LastShopperWorld && (this.mapStructures || []).some((structure) =>
                window.LastShopperWorld.wallSegments(structure).some((wall) => this.rectBlocked(x, y, radius, wall)))) {
                return { ok: false, message: 'Cannot build through a building wall.' };
            }
            if (kind !== 'building' && this.buildings.some((building) => this.rectBlocked(x, y, radius, building))) {
                return { ok: false, message: 'Too close to a built station.' };
            }
            if (kind === 'turret') {
                if (owned(this.sentries).length >= limits.turrets) return { ok: false, message: `Turret cap reached: ${limits.turrets}. Upgrade tech or build a turret bench.` };
                if (this.nearbyAny(x, y, radius, this.sentries, 78)) return { ok: false, message: 'Turrets need more spacing.' };
                if (this.nearbyAny(x, y, radius, this.walls, 26)) return { ok: false, message: 'Too close to a wall.' };
            }
            if (kind === 'wall') {
                const wallCount = owned(this.walls).filter((wall) => !wall.isWorkbench).length;
                if (wallCount >= limits.walls) return { ok: false, message: `Wall cap reached: ${limits.walls}. Upgrade the bench for more.` };
                if (this.nearbyAny(x, y, radius, this.walls, 5)) return { ok: false, message: 'Walls cannot overlap.' };
                if (this.nearbyAny(x, y, radius, this.sentries, 20)) return { ok: false, message: 'Leave space around turrets.' };
            }
            if (kind === 'trap') {
                if (owned(this.traps).length >= limits.traps) return { ok: false, message: `Trap cap reached: ${limits.traps}. Build a Trap Bench for more.` };
                if (this.nearbyAny(x, y, radius, this.traps, 34)) return { ok: false, message: 'Traps need more spacing.' };
                if (this.nearbyAny(x, y, radius, this.sentries, 20) || this.nearbyAny(x, y, radius, this.walls, 12)) {
                    return { ok: false, message: 'Traps need open floor space.' };
                }
            }
            if (kind === 'building') {
                if (owned(this.buildings).length >= limits.buildings) return { ok: false, message: `Building cap reached: ${limits.buildings}.` };
                if (this.buildings.some((building) => building.id === item.id)) return { ok: false, message: `${item.name} is already built.` };
                if (this.nearbyAny(x, y, radius, this.buildings, 82)) return { ok: false, message: 'Stations need more spacing.' };
                if (this.nearbyAny(x, y, radius, this.sentries, 44) || this.nearbyAny(x, y, radius, this.walls, 24)) {
                    return { ok: false, message: 'Clear defenses before placing a station.' };
                }
            }
            return { ok: true, message: 'Placement ready.' };
        },

        getNearbyStation: function () {
            if (this.preparationActive && this.supplyDrop && !this.supplyDrop.collected
                && this.dist(this.player.x, this.player.y, this.supplyDrop.x, this.supplyDrop.y) <= this.supplyDrop.interactionRadius) {
                return 'supply';
            }
            if (this.preparationActive && this.trader
                && this.dist(this.player.x, this.player.y, this.trader.x, this.trader.y) <= this.trader.interactionRadius) {
                return 'trader';
            }
            if (window.LastShopperWorld) {
                for (const structure of this.mapStructures || []) {
                    if (!structure.loot.claimed && this.dist(this.player.x, this.player.y, structure.loot.x, structure.loot.y) <= 58) return `loot:${structure.id}`;
                    const door = window.LastShopperWorld.doorPoint(structure);
                    if (!structure.door.destroyed && this.dist(this.player.x, this.player.y, door.x, door.y) <= 66) return `door:${structure.id}`;
                }
            }
            const shopDistance = this.dist(
                this.player.x,
                this.player.y,
                this.shop.interactionX,
                this.shop.interactionY
            );
            const benchDistance = this.dist(
                this.player.x,
                this.player.y,
                this.workbench.x,
                this.workbench.y
            );
            const nearShop = shopDistance <= this.shop.interactionRadius;
            const nearWorkbench = benchDistance <= this.workbench.interactionRadius;
            if (nearShop && nearWorkbench) return shopDistance <= benchDistance ? 'shop' : 'workbench';
            if (nearShop) return 'shop';
            if (nearWorkbench) return 'workbench';
            for (const building of this.buildings) {
                const radius = building.interactionRadius || Math.max(building.width, building.height) * 0.85;
                if (this.dist(this.player.x, this.player.y, building.x, building.y) <= radius) {
                    return `building:${building.id}`;
                }
            }
            return null;
        },

        isNearShop: function () {
            return this.getNearbyStation() === 'shop';
        },

        isNearWorkbench: function () {
            return this.getNearbyStation() === 'workbench';
        },

        toggleWorkbench: function (isOpen) {
            this.workbenchOpen = isOpen;
            this.mouse.isDown = false;
            this.playSfx?.('menu');
            if (isOpen) {
                this.activeWorkbench = this.getActiveWorkbench();
                if (!this.activeWorkbench) {
                    this.workbenchOpen = false;
                    return;
                }
                this.populateWorkbench();
                workbenchModal.classList.remove('hidden');
                workbenchModal.classList.add('flex');
            } else {
                workbenchModal.classList.add('hidden');
                workbenchModal.classList.remove('flex');
            }
        },

        populateCraftingMenu: function () {
            craftingContent.innerHTML = '<h2 class="shop-section">FIELD CRAFTING</h2>';
            this.sentryTypes.forEach((sentry, index) => {
                if (sentry.techLevel !== 1) return;
                const canAfford = hasCost(this.player, sentry.cost);
                const card = document.createElement('div');
                card.className = 'defense-card flex items-center justify-between';
                card.innerHTML = `
                    <div><h3 class="font-bold text-lg">${sentry.name}</h3>
                    <p class="text-sm text-gray-400">${sentry.damage} damage / ${sentry.range} range / ${sentry.maxAmmo} ammo</p></div>
                    <button class="btn ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}"
                        ${canAfford ? '' : 'disabled'} onclick="game.startPlacingSentry(${index})">
                        ${costLabel(sentry.cost)}
                    </button>`;
                craftingContent.appendChild(card);
            });

            craftingContent.insertAdjacentHTML('beforeend', '<h2 class="shop-section">STRUCTURES</h2>');
            this.basicWallTypes.forEach((wall, index) => {
                const canAfford = hasCost(this.player, wall.cost);
                const card = document.createElement('div');
                card.className = 'defense-card flex items-center justify-between';
                card.innerHTML = `
                    <div><h3 class="font-bold text-lg">${wall.name}</h3>
                    <p class="text-sm text-gray-400">${wall.health} health${wall.isWorkbench ? ' / unlocks defense engineering' : ''}</p></div>
                    <button class="btn ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}"
                        ${canAfford ? '' : 'disabled'} onclick="game.startPlacingWall(${index})">
                        ${costLabel(wall.cost)}
                    </button>`;
                craftingContent.appendChild(card);
            });
        },

        populateWorkbench: function () {
            const bench = this.getActiveWorkbench();
            if (!bench) return this.toggleWorkbench(false);
            const levelDefinition = content.workbenchLevels[bench.workbenchLevel - 1];
            const nextLevel = content.workbenchLevels[bench.workbenchLevel];
            workbenchTitle.textContent = `WORKBENCH LEVEL ${bench.workbenchLevel}`;
            this.workbenchTab ||= 'turrets';
            const nextTechCost = this.techTier < 3 ? { money: 1800 * this.techTier, wood: 25 * this.techTier, metal: 30 * this.techTier, parts: this.techTier } : null;

            const nextLevelButton = nextLevel ? (() => {
                const techReady = this.techTier >= nextLevel.level;
                const canAfford = techReady && hasCost(this.player, nextLevel.cost);
                if (!techReady) return `
                    <button class="bench-action locked" onclick="game.setWorkbenchTab('tech')">
                        <span>Unlock Tech ${roman(nextLevel.level)} First</span><small>Open Tech Counter</small>
                    </button>`;
                return `
                    <button class="bench-action ${canAfford ? 'ready' : ''}" ${canAfford ? '' : 'disabled'} onclick="game.upgradeWorkbench()">
                        <span>Upgrade to Bench ${nextLevel.level}</span><small>${costLabel(nextLevel.cost)}</small>
                    </button>`;
            })() : '<span class="bench-maxed">MAX BENCH</span>';

            const tabButtons = [
                ['turrets', '01', 'Turrets', 'Build and tune'],
                ['walls', '02', 'Walls', 'Defense tiers'],
                ['traps', '03', 'Traps', 'Area control'],
                ['buildings', '04', 'Buildings', 'Store stations'],
                ['ammo', '05', 'Ammo', 'Restock'],
                ['repairs', '06', 'Repairs', 'Restore defenses'],
                ['tech', '07', 'Tech', 'Unlock tiers'],
                ['skills', '08', 'Skills', 'Spend points']
            ].map(([id, number, label, detail]) => `
                <button class="workbench-tab ${this.workbenchTab === id ? 'active' : ''}" onclick="game.setWorkbenchTab('${id}')"><b>${number}</b><span>${label}<small>${detail}</small></span></button>
            `).join('');

            const turretCraftHtml = this.sentryTypes
                .map((item, index) => ({ ...item, index }))
                .filter((item) => item.techLevel <= bench.workbenchLevel)
                .map((item) => {
                    const canAfford = hasCost(this.player, item.cost);
                    const limit = this.getPlacementLimits().turrets;
                    return `
                    <article class="workbench-item workbench-turret">
                        <span class="window-kicker">TURRET / TECH ${roman(item.techLevel)}</span>
                        <div class="workbench-item-title">${item.name}</div>
                        <p class="workbench-item-desc">Automated defense. ${item.damage}${item.pellets ? ' x' + item.pellets : ''} damage, ${item.range} range, ${item.maxAmmo} ammo. Current cap: ${this.sentries.length}/${limit}.</p>
                        <div class="workbench-cost-row">${costChips(this.player, item.cost)}</div>
                        <button class="btn ${canAfford ? 'btn-success' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.startPlacingSentry(${item.index})">Fabricate Turret</button>
                    </article>`;
                }).join('');

            const trapCraftHtml = this.trapTypes
                .map((item, index) => ({ ...item, index }))
                .filter((item) => item.techLevel <= bench.workbenchLevel)
                .map((item) => {
                    const canAfford = hasCost(this.player, item.cost);
                    return `
                    <article class="workbench-item workbench-trap">
                        <span class="window-kicker">TRAP / TECH ${roman(item.techLevel)}</span>
                        <div class="workbench-item-title">${item.name}</div>
                        <p class="workbench-item-desc">${item.damage} burst damage. One-use floor control. Current cap: ${this.traps.length}/${this.getPlacementLimits().traps}.</p>
                        <div class="workbench-cost-row">${costChips(this.player, item.cost)}</div>
                        <button class="btn ${canAfford ? 'btn-success' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.startPlacingTrap(${item.index})">Craft Trap</button>
                    </article>`;
                }).join('');

            const turretUpgradeHtml = this.sentries.length ? this.sentries.map((sentry, index) => {
                const levels = sentry.upgradeLevels || { damage: 0, fireRate: 0, range: 0, ammo: 0 };
                const cap = this.getTurretUpgradeCap(bench);
                const hp = `${Math.ceil(sentry.health)} / ${Math.ceil(sentry.maxHealth)}`;
                const ammo = `${Math.ceil(sentry.ammo || 0)} / ${Math.ceil(sentry.maxAmmo || 0)}`;
                return `
                    <article class="turret-upgrade-card">
                        <header class="turret-upgrade-header">
                            <div>
                                <span class="window-kicker">PLACED TURRET / OWNER ${sentry.ownerName || 'P1'}</span>
                                <h3>${sentry.name} #${index + 1}</h3>
                            </div>
                            <b>CAP ${cap}</b>
                        </header>
                        <div class="turret-stat-row">
                            <span>HP <strong>${hp}</strong></span>
                            <span>Ammo <strong>${ammo}</strong></span>
                            <span>Damage Lv <strong>${levels.damage}</strong></span>
                            <span>Fire Rate Lv <strong>${levels.fireRate}</strong></span>
                            <span>Range Lv <strong>${levels.range}</strong></span>
                        </div>
                        <div class="turret-upgrade-grid">
                            ${this.turretUpgradeButton(index, 'damage', levels.damage, cap)}
                            ${this.turretUpgradeButton(index, 'fireRate', levels.fireRate, cap)}
                            ${this.turretUpgradeButton(index, 'range', levels.range, cap)}
                            ${this.turretUpgradeButton(index, 'ammo', levels.ammo, cap)}
                            ${this.turretRepairButton(index)}
                        </div>
                    </article>`;
            }).join('') : '<p class="workbench-empty">No turrets placed. Fabricate one, then return here to tune it.</p>';

            const wallTierHtml = content.wallStages.map((wall, index) => {
                const unlocked = wall.techLevel <= bench.workbenchLevel;
                const cost = wall.cost || wall.upgradeCost;
                const canAfford = unlocked && hasCost(this.player, cost);
                return `
                    <article class="wall-tier ${unlocked ? 'unlocked' : 'locked'}">
                        <span class="wall-tier-step">${index + 1}</span>
                        <div>
                            <h3>${wall.name}</h3>
                            <p>Tech ${roman(wall.techLevel)} / ${wall.health} HP${wall.isElectric ? ' / shocks attackers' : ''}${wall.armor ? ' / armored plating' : ''}</p>
                            <div class="workbench-cost-row">${costChips(this.player, cost)}</div>
                        </div>
                        <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.startPlacingWallStage(${index})">
                            ${unlocked ? 'Build' : `Bench L${wall.techLevel}`}
                        </button>
                    </article>`;
            }).join('');

            const placedWallHtml = this.walls.filter((wall) => !wall.isWorkbench).length ? this.walls.filter((wall) => !wall.isWorkbench).map((wall) => {
                const index = this.walls.indexOf(wall);
                const next = content.wallStages[(wall.wallStage || 0) + 1];
                const canUpgrade = next && next.techLevel <= bench.workbenchLevel && hasCost(this.player, next.upgradeCost);
                return `
                    <article class="workbench-item workbench-wall">
                        <span class="window-kicker">PLACED WALL / OWNER ${wall.ownerName || 'P1'}</span>
                        <div class="workbench-item-title">${wall.name} #${index + 1}</div>
                        <p class="workbench-item-desc">${Math.ceil(wall.health)} / ${Math.ceil(wall.maxHealth)} HP. Upgrade ladder continues through Titanium.</p>
                        <div class="workbench-cost-row">${next ? costChips(this.player, next.upgradeCost) : '<span class="workbench-cost-item affordable">Max tier</span>'}</div>
                        <div class="workbench-actions">
                            <button class="btn btn-secondary" onclick="game.repairWall(${index})">Repair</button>
                            ${next ? `<button class="btn ${canUpgrade ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canUpgrade ? '' : 'disabled'} onclick="game.upgradeWall(${index})">Upgrade to ${next.name}</button>` : '<span class="bench-maxed">MAXED</span>'}
                        </div>
                    </article>`;
            }).join('') : '<p class="workbench-empty">No walls placed yet. Build any unlocked tier from the wall ladder.</p>';

            const utilityHtml = this.workbenchUpgrades.map((upgrade) => {
                const owned = this.upgrades[upgrade.id];
                const canAfford = !owned && hasCost(this.player, upgrade.cost);
                return `
                    <article class="workbench-item workbench-consumable">
                        <div class="workbench-item-title">${upgrade.name}</div>
                        <p class="workbench-item-desc">${upgrade.description}</p>
                        <div class="workbench-cost-row">${owned ? '<span class="workbench-cost-item affordable">Owned</span>' : costChips(this.player, upgrade.cost)}</div>
                        <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.buyUpgrade('${upgrade.id}')">${owned ? 'Installed' : 'Install'}</button>
                    </article>`;
            }).join('');

            const techHtml = `
                <article class="workbench-item workbench-upgrade">
                    <span class="window-kicker">TECH TIER</span>
                    <div class="workbench-item-title">Store Tech Tier ${roman(this.techTier)}</div>
                    <p class="workbench-item-desc">Boss waves unlock tech naturally. This emergency upgrade lets a strong run push tech early.</p>
                    <div class="workbench-cost-row">${nextTechCost ? costChips(this.player, nextTechCost) : '<span class="workbench-cost-item affordable">Max tech reached</span>'}</div>
                    <button class="btn ${nextTechCost && hasCost(this.player, nextTechCost) ? 'btn-primary' : 'btn-secondary opacity-50'}" ${nextTechCost && hasCost(this.player, nextTechCost) ? '' : 'disabled'} onclick="game.upgradeTechTier()">Upgrade Tech Tier</button>
                </article>
                <article class="workbench-item workbench-upgrade">
                    <span class="window-kicker">WORKBENCH FRAME</span>
                    <div class="workbench-item-title">Workbench Level ${bench.workbenchLevel}</div>
                    <p class="workbench-item-desc">Higher bench levels unlock stronger turrets, walls, traps, buildings, and higher upgrade caps.</p>
                    <div class="workbench-cost-row">${nextLevel ? costChips(this.player, nextLevel.cost) : '<span class="workbench-cost-item affordable">Max bench reached</span>'}</div>
                    ${nextLevelButton}
                </article>
                <div class="workbench-grid">${utilityHtml}</div>`;

            const buildingHtml = content.buildingTypes.map((building) => {
                const unlocked = building.techLevel <= bench.workbenchLevel;
                const built = this.buildings.some((entry) => entry.id === building.id);
                const canAfford = unlocked && !built && hasCost(this.player, building.cost);
                return `
                    <article class="workbench-item workbench-building">
                        <span class="window-kicker">BUILDING / TECH ${roman(building.techLevel)}</span>
                        <div class="workbench-item-title">${building.name}</div>
                        <p class="workbench-item-desc">${building.description} ${built ? 'Already built in the parking lot.' : 'Builds as a physical station with [E] interaction.'}</p>
                        <div class="workbench-cost-row">${built ? '<span class="workbench-cost-item affordable">Built</span>' : costChips(this.player, building.cost)}</div>
                        <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.startPlacingBuilding('${building.id}')">${built ? 'Built' : unlocked ? 'Place Building' : `Bench L${building.techLevel}`}</button>
                    </article>`;
            }).join('');

            const repairHtml = `
                <article class="workbench-item workbench-consumable">
                    <span class="window-kicker">GLOBAL REPAIR</span>
                    <div class="workbench-item-title">Crew Repair Run</div>
                    <p class="workbench-item-desc">Repairs every turret, wall, station, and the workbench. Cost scales with missing health.</p>
                    <div class="workbench-cost-row">${costChips(this.player, this.getRepairAllCost())}</div>
                    <button class="btn ${hasCost(this.player, this.getRepairAllCost()) ? 'btn-primary' : 'btn-secondary opacity-50'}" ${hasCost(this.player, this.getRepairAllCost()) ? '' : 'disabled'} onclick="game.repairAllDefenses()">Repair All</button>
                </article>
                <article class="workbench-item workbench-consumable">
                    <span class="window-kicker">WORKBENCH</span>
                    <div class="workbench-item-title">Bench Frame Repair</div>
                    <p class="workbench-item-desc">${Math.ceil(bench.health)} / ${Math.ceil(bench.maxHealth)} HP.</p>
                    <button class="btn btn-secondary" onclick="game.repairWorkbench()">Repair Workbench</button>
                </article>`;

            const skillHtml = content.skills.map((skill) => {
                const level = this.player.skillLevels[skill.id];
                const canBuy = this.player.skillPoints > 0 && level < skill.max;
                return `
                    <article class="workbench-item workbench-skill">
                        <span class="window-kicker">SKILL LEVEL ${level} / ${skill.max}</span>
                        <div class="workbench-item-title">${skill.name}</div>
                        <p class="workbench-item-desc">${skill.description}. Skill points available: ${this.player.skillPoints}.</p>
                        <button class="btn ${canBuy ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canBuy ? '' : 'disabled'} onclick="game.buySkill('${skill.id}')">${level >= skill.max ? 'Maxed' : 'Spend Point'}</button>
                    </article>`;
            }).join('');

            const tabContent = {
                turrets: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Turret Fabrication</h2><div class="workbench-grid">${turretCraftHtml}</div><h2 class="workbench-section-header">Turret Upgrades</h2>${turretUpgradeHtml}</section>`,
                walls: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Wall Ladder</h2><div class="wall-tier-list">${wallTierHtml}</div><h2 class="workbench-section-header">Placed Wall Upgrades</h2>${placedWallHtml}</section>`,
                traps: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Trap Crafting</h2><div class="workbench-grid">${trapCraftHtml}</div></section>`,
                ammo: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Ammo Counter</h2>${this.getAmmoStoreHtml('workbench')}</section>`,
                repairs: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Repair Counter</h2><div class="workbench-grid">${repairHtml}</div></section>`,
                tech: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Tech and Bench Upgrades</h2>${techHtml}</section>`,
                skills: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Skill Counter</h2><div class="workbench-grid">${skillHtml}</div></section>`,
                buildings: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Store Station Construction</h2><div class="workbench-grid">${buildingHtml}</div></section>`
            };

            workbenchContent.innerHTML = `
                <div class="bench-progression">
                    <div class="bench-stage current">
                        <span class="bench-stage-number">01</span>
                        <div><span class="window-kicker">CURRENT BENCH</span><h3>${levelDefinition.name}</h3><p>Level ${bench.workbenchLevel} / ${Math.ceil(bench.health)} HP</p></div>
                    </div>
                    <div class="bench-progress-arrow">THEN</div>
                    <div class="bench-stage ${nextLevel && this.techTier < nextLevel.level ? 'required' : 'complete'}">
                        <span class="bench-stage-number">02</span>
                        <div><span class="window-kicker">TECH GATE</span><h3>Store Tech ${roman(this.techTier)}</h3><p>${nextLevel ? `Bench ${nextLevel.level} requires Tech ${roman(nextLevel.level)}` : 'All bench tiers unlocked'}</p></div>
                    </div>
                    <div class="bench-progress-arrow">THEN</div>
                    <div class="bench-stage action-stage">
                        <span class="bench-stage-number">03</span>
                        <div class="bench-stage-action"><span class="window-kicker">NEXT ACTION</span>${nextLevelButton}</div>
                    </div>
                </div>
                <div class="workbench-tabs">${tabButtons}</div>
                <div class="workbench-layout single">
                    ${tabContent[this.workbenchTab] || tabContent.turrets}
                </div>`;
        },

        setWorkbenchTab: function (tab) {
            this.workbenchTab = tab;
            this.populateWorkbench();
        },

        getTurretUpgradeCap: function (bench = this.getActiveWorkbench()) {
            return (bench?.workbenchLevel || 1) * 2 + (this.buildings.some((building) => building.id === 'advancedTurretBench') ? 2 : 0);
        },

        turretUpgradeButton: function (index, stat, level, cap) {
            const labels = { damage: 'Damage', fireRate: 'Fire Rate', range: 'Range', ammo: 'Ammo Capacity' };
            const effects = { damage: '+20% damage', fireRate: '-12% fire delay', range: '+35 range', ammo: '+25% max ammo and refill' };
            const maxed = level >= cap;
            const cost = { money: 80 + level * 80, wood: 2 + level, metal: 3 + level * 2 };
            const canAfford = !maxed && hasCost(this.player, cost);
            return `<button class="turret-upgrade-button ${canAfford ? '' : 'disabled'}"
                ${canAfford ? '' : 'disabled'} onclick="game.upgradeTurret(${index}, '${stat}')">
                <span>${labels[stat]}</span>
                <b>Lv ${level}/${cap}</b>
                <small>${effects[stat]}</small>
                <em>${maxed ? 'Maxed' : costLabel(cost)}</em>
            </button>`;
        },

        getTurretRepairCost: function (sentry) {
            if (!sentry || sentry.health >= sentry.maxHealth) return null;
            const missing = 1 - sentry.health / sentry.maxHealth;
            return { wood: Math.max(1, Math.ceil(missing * 4)), metal: Math.max(1, Math.ceil(missing * 5)) };
        },

        turretRepairButton: function (index) {
            const sentry = this.sentries[index];
            const cost = this.getTurretRepairCost(sentry);
            const canAfford = cost && hasCost(this.player, cost);
            return `<button class="turret-upgrade-button repair ${canAfford ? '' : 'disabled'}"
                ${canAfford ? '' : 'disabled'} onclick="game.repairTurret(${index})">
                <span>Repair</span>
                <b>${sentry && sentry.maxHealth ? Math.ceil((sentry.health / sentry.maxHealth) * 100) : 100}% HP</b>
                <small>Restore this turret to full health</small>
                <em>${cost ? costLabel(cost) : 'Full HP'}</em>
            </button>`;
        },

        upgradeWorkbench: function () {
            const bench = this.getActiveWorkbench();
            if (!bench || bench.workbenchLevel >= 3) return;
            const next = content.workbenchLevels[bench.workbenchLevel];
            if (this.techTier < next.level || !hasCost(this.player, next.cost)) return;
            payCost(this.player, next.cost);
            bench.workbenchLevel++;
            bench.maxHealth += 180;
            bench.health = bench.maxHealth;
            this.populateWorkbench();
        },

        upgradeTechTier: function () {
            if (this.techTier >= 3) return;
            const cost = { money: 1800 * this.techTier, wood: 25 * this.techTier, metal: 30 * this.techTier, parts: this.techTier };
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            this.techTier++;
            this.populateWorkbench();
            this.updateHUD();
        },

        getRepairAllCost: function () {
            const defenses = [...this.sentries, ...this.walls.filter((wall) => !wall.isWorkbench), ...this.buildings, this.workbench];
            const missing = defenses.reduce((total, defense) => total + Math.max(0, (defense.maxHealth || 0) - (defense.health || 0)), 0);
            return {
                money: Math.ceil(missing / 28),
                wood: Math.ceil(missing / 95),
                metal: Math.ceil(missing / 125)
            };
        },

        repairAllDefenses: function () {
            const cost = this.getRepairAllCost();
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            [...this.sentries, ...this.walls, ...this.buildings, this.workbench].forEach((defense) => {
                defense.health = defense.maxHealth;
            });
            this.populateWorkbench();
            this.updateHUD();
        },

        repairWorkbench: function () {
            if (this.workbench.health >= this.workbench.maxHealth) return;
            const missing = 1 - this.workbench.health / this.workbench.maxHealth;
            const cost = { wood: Math.max(1, Math.ceil(missing * 6)), metal: Math.max(1, Math.ceil(missing * 6)) };
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            this.workbench.health = this.workbench.maxHealth;
            this.populateWorkbench();
            this.updateHUD();
        },

        upgradeTurret: function (index, stat) {
            const bench = this.getActiveWorkbench();
            const sentry = this.sentries[index];
            if (!bench || !sentry) return;
            sentry.upgradeLevels ||= { damage: 0, fireRate: 0, range: 0, ammo: 0 };
            const level = sentry.upgradeLevels[stat];
            if (level >= this.getTurretUpgradeCap(bench)) return;
            const cost = { money: 80 + level * 80, wood: 2 + level, metal: 3 + level * 2 };
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            sentry.upgradeLevels[stat]++;
            if (stat === 'damage') sentry.damage *= 1.2;
            if (stat === 'fireRate') sentry.fireRate *= 0.88;
            if (stat === 'range') sentry.range += 35;
            if (stat === 'ammo') {
                sentry.maxAmmo = Math.ceil(sentry.maxAmmo * 1.25);
                sentry.ammo = sentry.maxAmmo;
            }
            this.populateWorkbench();
        },

        repairTurret: function (index) {
            const sentry = this.sentries[index];
            if (!sentry || sentry.health >= sentry.maxHealth) return;
            const cost = this.getTurretRepairCost(sentry);
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            sentry.health = sentry.maxHealth;
            this.populateWorkbench();
        },

        repairWall: function (index) {
            const wall = this.walls[index];
            if (!wall || wall.isWorkbench || wall.health >= wall.maxHealth) return;
            const missing = 1 - wall.health / wall.maxHealth;
            const cost = { wood: Math.max(1, Math.ceil(missing * 5)), metal: wall.wallStage >= 2 ? Math.max(1, Math.ceil(missing * 4)) : 0 };
            if (!hasCost(this.player, cost)) return;
            payCost(this.player, cost);
            wall.health = wall.maxHealth;
            this.populateWorkbench();
        },

        upgradeWall: function (index) {
            const bench = this.getActiveWorkbench();
            const wall = this.walls[index];
            if (!bench || !wall || wall.isWorkbench) return;
            const nextStage = (wall.wallStage || 0) + 1;
            const next = content.wallStages[nextStage];
            if (!next || next.techLevel > bench.workbenchLevel || !hasCost(this.player, next.upgradeCost)) return;
            payCost(this.player, next.upgradeCost);
            const healthRatio = wall.health / wall.maxHealth;
            Object.assign(wall, next, {
                wallStage: nextStage,
                maxHealth: next.health,
                health: Math.max(next.health * healthRatio, next.health * 0.55),
                radius: 25
            });
            this.populateWorkbench();
        },

        startPlacingSentry: function (index) {
            const sentry = this.sentryTypes[index];
            const allowedLevel = sentry.techLevel === 1 ? 1 : (this.getActiveWorkbench()?.workbenchLevel || 0);
            if (!sentry || sentry.techLevel > allowedLevel || !hasCost(this.player, sentry.cost)) return;
            if (this.sentries.length >= this.getPlacementLimits().turrets) {
                this.showPlacementError(`Turret cap reached: ${this.getPlacementLimits().turrets}. Upgrade tech or build a turret bench.`);
                return;
            }
            payCost(this.player, sentry.cost);
            this.placingSentry = { ...sentry, angle: 0, lastShot: 0, isDisabled: 0, paidCost: sentry.cost };
            this.toggleCrafting(false);
            this.toggleWorkbench(false);
            placingItemText.textContent = `Placing ${sentry.name}...`;
            placingItemHint.classList.remove('hidden');
        },

        startPlacingWall: function (index) {
            const wall = this.basicWallTypes[index];
            if (!wall || !hasCost(this.player, wall.cost)) return;
            if (this.walls.filter((entry) => !entry.isWorkbench).length >= this.getPlacementLimits().walls) {
                this.showPlacementError(`Wall cap reached: ${this.getPlacementLimits().walls}. Upgrade the bench for more.`);
                return;
            }
            payCost(this.player, wall.cost);
            this.placingWall = { ...wall, paidCost: wall.cost };
            this.toggleCrafting(false);
            placingItemText.textContent = `Placing ${wall.name}...`;
            placingItemHint.classList.remove('hidden');
        },

        startPlacingWallStage: function (stageIndex) {
            const bench = this.getActiveWorkbench();
            const wall = content.wallStages[stageIndex];
            if (!bench || !wall || wall.techLevel > bench.workbenchLevel) return;
            const cost = wall.cost || wall.upgradeCost;
            if (!hasCost(this.player, cost)) return;
            if (this.walls.filter((entry) => !entry.isWorkbench).length >= this.getPlacementLimits().walls) {
                this.showPlacementError(`Wall cap reached: ${this.getPlacementLimits().walls}. Upgrade the bench for more.`);
                return;
            }
            payCost(this.player, cost);
            this.placingWall = {
                ...wall,
                cost,
                paidCost: cost,
                wallStage: stageIndex,
                maxHealth: wall.health,
                radius: 25
            };
            this.toggleWorkbench(false);
            placingItemText.textContent = `Placing ${wall.name}...`;
            placingItemHint.classList.remove('hidden');
        },

        commitPlacedEntity: function (kind, collection, entity) {
            if (this.isWorldHost()) {
                collection.push(entity);
            }
            this.recordBuild();
            this.playSfx?.('build');
            if (this.broadcastBuildAction) this.broadcastBuildAction(kind, entity);
        },

        placeSentry: function () {
            const validation = this.getPlacementValidation('turret', this.placingSentry, this.mouse.worldX, this.mouse.worldY);
            if (!validation.ok) {
                this.showPlacementError(validation.message);
                return;
            }
            const turretCore = Math.pow(1.15, this.runUpgradeCounts.turretCore || 0);
            const longShot = Math.pow(1.15, this.runUpgradeCounts.longShot || 0);
            const fortify = Math.pow(1.2, this.runUpgradeCounts.fortify || 0);
            const sentry = {
                ...this.placingSentry,
                x: this.mouse.worldX,
                y: this.mouse.worldY,
                networkId: `turret-${this.localPlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ownerId: this.localPlayerId,
                ownerName: this.player.name || 'P1',
                damage: this.placingSentry.damage * turretCore,
                fireRate: this.placingSentry.fireRate / turretCore,
                range: this.placingSentry.range * longShot,
                maxHealth: this.placingSentry.maxHealth * fortify,
                health: this.placingSentry.maxHealth * fortify,
                upgradeLevels: { damage: 0, fireRate: 0, range: 0, ammo: 0 }
            };
            this.commitPlacedEntity('turret', this.sentries, sentry);
            this.placingSentry = null;
            placingItemHint.classList.add('hidden');
        },

        placeWall: function () {
            const validation = this.getPlacementValidation('wall', this.placingWall, this.mouse.worldX, this.mouse.worldY);
            if (!validation.ok) {
                this.showPlacementError(validation.message);
                return;
            }
            const fortify = Math.pow(1.2, this.runUpgradeCounts.fortify || 0);
            const wall = {
                ...this.placingWall,
                x: this.mouse.worldX,
                y: this.mouse.worldY,
                networkId: `wall-${this.localPlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ownerId: this.localPlayerId,
                ownerName: this.player.name || 'P1'
            };
            wall.maxHealth = (wall.maxHealth || wall.health) * fortify;
            wall.health = wall.maxHealth;
            if (!wall.isWorkbench && wall.wallStage === undefined) wall.wallStage = 0;
            this.commitPlacedEntity('wall', this.walls, wall);
            this.placingWall = null;
            placingItemHint.classList.add('hidden');
        },

        startPlacingTrap: function (index) {
            const trap = this.trapTypes[index];
            const bench = this.getActiveWorkbench();
            if (!trap || !bench || trap.techLevel > bench.workbenchLevel || !hasCost(this.player, trap.cost)) return;
            if (this.traps.length >= this.getPlacementLimits().traps) {
                this.showPlacementError(`Trap cap reached: ${this.getPlacementLimits().traps}. Build a Trap Bench for more.`);
                return;
            }
            payCost(this.player, trap.cost);
            this.placingTrap = { ...trap, paidCost: trap.cost };
            this.toggleWorkbench(false);
            placingItemText.textContent = `Placing ${trap.name}...`;
            placingItemHint.classList.remove('hidden');
        },

        placeTrap: function () {
            const validation = this.getPlacementValidation('trap', this.placingTrap, this.mouse.worldX, this.mouse.worldY);
            if (!validation.ok) {
                this.showPlacementError(validation.message);
                return;
            }
            const trap = {
                ...this.placingTrap,
                x: this.mouse.worldX,
                y: this.mouse.worldY,
                networkId: `trap-${this.localPlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ownerId: this.localPlayerId,
                ownerName: this.player.name || 'P1'
            };
            this.commitPlacedEntity('trap', this.traps, trap);
            this.placingTrap = null;
            placingItemHint.classList.add('hidden');
        },

        startPlacingBuilding: function (id) {
            const building = content.buildingTypes.find((entry) => entry.id === id);
            const bench = this.getActiveWorkbench();
            if (!building || !bench || building.techLevel > bench.workbenchLevel || !hasCost(this.player, building.cost)) return;
            const validation = this.getPlacementValidation('building', building, this.player.x + 110, this.player.y);
            if (this.buildings.some((entry) => entry.id === id)) {
                this.showPlacementError(`${building.name} is already built.`);
                return;
            }
            if (this.buildings.length >= this.getPlacementLimits().buildings) {
                this.showPlacementError(`Building cap reached: ${this.getPlacementLimits().buildings}.`);
                return;
            }
            payCost(this.player, building.cost);
            this.placingBuilding = { ...building, paidCost: building.cost };
            this.toggleWorkbench(false);
            placingItemText.textContent = validation.ok ? `Placing ${building.name}...` : validation.message;
            placingItemHint.classList.remove('hidden');
        },

        placeBuilding: function () {
            const validation = this.getPlacementValidation('building', this.placingBuilding, this.mouse.worldX, this.mouse.worldY);
            if (!validation.ok) {
                this.showPlacementError(validation.message);
                return;
            }
            const building = {
                ...this.placingBuilding,
                x: this.mouse.worldX,
                y: this.mouse.worldY,
                networkId: `building-${this.localPlayerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                health: 900 + this.placingBuilding.techLevel * 200,
                maxHealth: 900 + this.placingBuilding.techLevel * 200,
                interactionRadius: Math.max(this.placingBuilding.width, this.placingBuilding.height) * 0.92,
                ownerId: this.localPlayerId,
                ownerName: this.player.name || 'P1'
            };
            this.commitPlacedEntity('building', this.buildings, building);
            this.placingBuilding = null;
            placingItemHint.classList.add('hidden');
        },

        cancelPlacing: function () {
            if (this.placingSentry) {
                refundCost(this.player, this.placingSentry.paidCost || this.placingSentry.cost);
                this.placingSentry = null;
            }
            if (this.placingWall) {
                refundCost(this.player, this.placingWall.paidCost || this.placingWall.cost);
                this.placingWall = null;
            }
            if (this.placingTrap) {
                refundCost(this.player, this.placingTrap.paidCost || this.placingTrap.cost);
                this.placingTrap = null;
            }
            if (this.placingBuilding) {
                refundCost(this.player, this.placingBuilding.paidCost || this.placingBuilding.cost);
                this.placingBuilding = null;
            }
            this.placementError = '';
            placingItemHint.classList.add('hidden');
            this.updateHUD();
        },

        spawnSplitChildren: function (zombie) {
            const childTypeKey = zombie.splitInto || 'runner';
            const type = this.zombieTypes[childTypeKey] || this.zombieTypes.runner || this.zombieTypes.normal;
            const count = zombie.splitCount || 2;
            for (let i = 0; i < count; i++) {
                const health = Math.max(35, Math.floor(type.health * 0.65));
                this.zombies.push({
                    ...type,
                    type: childTypeKey,
                    x: zombie.x + Math.cos((Math.PI * 2 / count) * i) * 18,
                    y: zombie.y + Math.sin((Math.PI * 2 / count) * i) * 18,
                    health,
                    maxHealth: health,
                    reward: Math.max(4, Math.floor((type.reward || 8) * 0.35)),
                    xp: Math.max(4, Math.floor((type.xp || type.reward || 8) * 0.35)),
                    damageScale: zombie.damageScale || 1,
                    lastShot: 0,
                    lastSlam: 0,
                    lastMelee: 0,
                    lastEmp: 0,
                    lastHeal: 0
                });
            }
        },

        spawnZombie: function () {
            const spawnAngle = Math.random() * Math.PI * 2;
            const spawnRange = 620 + Math.random() * 220;
            let typeKey;
            if (this.bossesToSpawn > 0) {
                const bossPool = progression.bossPool ? progression.bossPool(this.wave) : ['boss'];
                typeKey = bossPool[Math.floor(Math.random() * bossPool.length)];
                this.bossesToSpawn--;
            } else if (this.miniBossesToSpawn > 0) {
                typeKey = 'miniBoss';
                this.miniBossesToSpawn--;
            } else {
                const pool = progression.enemyPool(this.wave);
                typeKey = pool[Math.floor(Math.random() * pool.length)];
            }

            const type = this.zombieTypes[typeKey] || this.zombieTypes.normal;
            const plan = this.currentWavePlan || progression.wavePlan(this.wave);
            const eliteScale = (type.isBoss || type.isMiniBoss) ? 1 + this.wave * 0.015 : 1;
            const health = Math.floor(type.health * plan.healthScale * eliteScale);
            const reward = Math.floor(type.reward * plan.rewardScale);
            const shieldHealth = type.shieldHealth ? Math.floor(type.shieldHealth * plan.healthScale) : 0;

            this.zombies.push({
                ...type,
                type: typeKey,
                x: this.player.x + Math.cos(spawnAngle) * spawnRange,
                y: this.player.y + Math.sin(spawnAngle) * spawnRange,
                speed: type.speed * Math.min(1.25, 1 + this.wave * 0.004),
                health,
                maxHealth: health,
                shieldHealth,
                maxShieldHealth: shieldHealth,
                reward,
                xp: Math.floor((type.xp || type.reward) * Math.sqrt(plan.rewardScale)),
                damageScale: plan.damageScale,
                lastShot: 0,
                lastSlam: 0,
                lastMelee: 0,
                lastEmp: 0,
                lastHeal: 0
            });
        },

        shootAcid: function (x, y, targetX, targetY, isArcing) {
            const angle = Math.atan2(targetY - y, targetX - x);
            const speed = isArcing ? 4 : 6;
            const damageScale = this.currentWavePlan?.damageScale || 1;
            this.bullets.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                damage: (isArcing ? 30 : 20) * damageScale,
                acid: isArcing,
                spitter: !isArcing,
                arcing: isArcing,
                arcVelocity: isArcing ? -1.5 : 0,
                fromZombie: true,
                size: isArcing ? 12 : 8,
                targetX: isArcing ? targetX : 0,
                targetY: isArcing ? targetY : 0
            });
        }
    });

}());
