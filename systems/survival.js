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
            cloudRelayInput.value = new URLSearchParams(location.search).get('ws') || '';
            this.populateSkinList();
            this.updateSkinPreview();
            this.updateLobbyMeta();
            this.updatePartyList();
        },

        applyLobbySelections: function () {
            const name = playerNameInput.value.trim() || 'The Shopper';
            this.metaProgression.playerName = name;
            this.metaProgression.selectedSkinId = this.selectedSkinId;
            this.player.name = name;
            this.player.skinId = this.selectedSkinId;
            this.saveMetaProgression();
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
                    this.remotePlayers = peers;
                    this.team.playerCount = 1 + peers.length;
                    this.updatePartyList();
                },
                onStatus: (text, mode) => this.setMultiplayerStatus(text, mode),
                onWorld: (world) => this.applyWorldSnapshot(world),
                onAction: (packet) => this.handleMultiplayerAction(packet),
                onHostChange: (isHost) => {
                    this.isRoomHost = isHost;
                    this.updatePartyList();
                }
            });
        },

        hostRoom: function () {
            const code = (roomCodeInput.value || Math.random().toString(36).slice(2, 7)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
            roomCodeInput.value = code;
            this.isRoomHost = true;
            this.connectRoom(code);
        },

        joinRoom: function () {
            const code = (roomCodeInput.value || 'STORE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
            roomCodeInput.value = code;
            this.isRoomHost = false;
            this.connectRoom(code);
        },

        connectRoom: function (code) {
            this.applyLobbySelections();
            this.roomCode = code || 'STORE';
            const relay = cloudRelayInput.value.trim();
            if (this.multiplayer) this.multiplayer.connect(this.roomCode, relay, { host: this.isRoomHost });
            this.updatePartyList();
        },

        syncMultiplayer: function () {
            if (!this.multiplayer || !this.gameStarted) return;
            this.multiplayer.sendState();
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
                wave: this.wave,
                level: this.player.level,
                isHost: this.isWorldHost()
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
                drops: this.drops,
                acidPools: this.acidPools
            };
        },

        applyWorldSnapshot: function (world) {
            if (!world || this.isWorldHost()) return;
            this.wave = world.wave || 0;
            this.zombiesKilled = world.zombiesKilled || 0;
            this.totalZombiesInWave = world.totalZombiesInWave || 0;
            this.waveActive = Boolean(world.waveActive);
            this.bossesToSpawn = world.bossesToSpawn || 0;
            this.miniBossesToSpawn = world.miniBossesToSpawn || 0;
            this.escortsToSpawn = world.escortsToSpawn || 0;
            this.currentWavePlan = world.currentWavePlan || this.currentWavePlan;
            this.techTier = world.techTier || this.techTier;
            this.preparationActive = Boolean(world.preparationActive);
            this.preparationEvent = world.preparationEvent || null;
            this.preparationEndsAt = this.preparationActive ? performance.now() + (world.preparationEndsIn || 0) : 0;
            this.supplyDrop = world.supplyDrop || null;
            this.trader = world.trader || null;
            this.zombies = world.zombies || [];
            this.sentries = world.sentries || [];
            this.walls = world.walls || [];
            this.traps = world.traps || [];
            this.buildings = world.buildings || [];
            this.drops = world.drops || [];
            this.acidPools = world.acidPools || [];
            if (world.players) {
                const localServerPlayer = world.players.find((player) => player.id === this.localPlayerId);
                if (localServerPlayer) {
                    this.player.health = localServerPlayer.health ?? this.player.health;
                    this.player.maxHealth = localServerPlayer.maxHealth ?? this.player.maxHealth;
                }
                this.remotePlayers = world.players
                    .filter((player) => player.id !== this.localPlayerId)
                    .map((player) => ({ ...player, lastSeen: performance.now() }));
                this.team.playerCount = Math.max(1, world.players.length);
                this.updatePartyList();
            }
        },

        broadcastBuildAction: function (kind, entity) {
            if (!this.multiplayer || !this.multiplayer.roomCode) return;
            this.multiplayer.sendAction({ kind: 'build', buildKind: kind, entity });
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
                    damage: this.getPlayerBulletDamage(weapon.damage),
                    speed: weapon.speed,
                    pellets: weapon.pellets || 0,
                    explosive: weapon.explosive,
                    bulletSize: weapon.bulletSize || 4
                }
            });
        },

        handleMultiplayerAction: function (packet) {
            if (!this.isWorldHost() || !packet || !packet.action) return;
            const action = packet.action;
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
                target.push(action.entity);
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
            const localSlot = `<div class="party-slot active"><b>P1</b><span>${localName}</span><em>${this.isWorldHost() ? 'Host' : 'Client'}</em></div>`;
            const remoteSlots = this.remotePlayers.map((player, index) => `
                <div class="party-slot"><b>P${index + 2}</b><span>${player.name || 'Shopper'}</span><em>${player.isHost ? 'Host' : `Wave ${player.wave || 0}`}</em></div>
            `).join('');
            partyList.innerHTML = localSlot + remoteSlots;
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
        },

        drawDetailedZombies: function () {
            for (const z of this.zombies) {
                if (this.isOnScreen && !this.isOnScreen(z.x, z.y, z.size + 140)) continue;
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

        resolveZombieStructureCollision: function (zombie, previousX, previousY) {
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
            const items = [
                { id: 'wood', name: 'Salvaged Lumber', description: '+12 wood', cost: 55 },
                { id: 'metal', name: 'Scrap Bundle', description: '+9 metal', cost: 80 },
                { id: 'ammo', name: 'Ammo Crate', description: '+75 reserve ammo', cost: 45 },
                { id: 'repairs', name: 'Crew Repairs', description: 'Restore all defenses and the bench', cost: 135 },
                { id: 'parts', name: 'Rare Turret Parts', description: '+1 part for high-tier machinery', cost: 280 }
            ];
            traderContent.innerHTML = `<p class="window-copy">Boss-wave discount stock. Cash is personal; placed defenses carry owner tags.</p>
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
                buildings: 6
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
            if (x < radius + 20 || y < radius + 20 || x > this.MAP_WIDTH - radius - 20 || y > this.MAP_HEIGHT - radius - 20) {
                return { ok: false, message: 'Move placement inside the parking lot.' };
            }
            if (this.rectBlocked(x, y, radius, this.shop)) return { ok: false, message: 'Cannot build inside the shop.' };
            if (this.rectBlocked(x, y, radius, this.workbench)) return { ok: false, message: 'Keep the workbench clear.' };
            if (kind !== 'building' && this.buildings.some((building) => this.rectBlocked(x, y, radius, building))) {
                return { ok: false, message: 'Too close to a built station.' };
            }
            if (kind === 'turret') {
                if (this.sentries.length >= limits.turrets) return { ok: false, message: `Turret cap reached: ${limits.turrets}. Upgrade tech or build a turret bench.` };
                if (this.nearbyAny(x, y, radius, this.sentries, 78)) return { ok: false, message: 'Turrets need more spacing.' };
                if (this.nearbyAny(x, y, radius, this.walls, 26)) return { ok: false, message: 'Too close to a wall.' };
            }
            if (kind === 'wall') {
                const wallCount = this.walls.filter((wall) => !wall.isWorkbench).length;
                if (wallCount >= limits.walls) return { ok: false, message: `Wall cap reached: ${limits.walls}. Upgrade the bench for more.` };
                if (this.nearbyAny(x, y, radius, this.walls, 5)) return { ok: false, message: 'Walls cannot overlap.' };
                if (this.nearbyAny(x, y, radius, this.sentries, 20)) return { ok: false, message: 'Leave space around turrets.' };
            }
            if (kind === 'trap') {
                if (this.traps.length >= limits.traps) return { ok: false, message: `Trap cap reached: ${limits.traps}. Build a Trap Bench for more.` };
                if (this.nearbyAny(x, y, radius, this.traps, 34)) return { ok: false, message: 'Traps need more spacing.' };
                if (this.nearbyAny(x, y, radius, this.sentries, 20) || this.nearbyAny(x, y, radius, this.walls, 12)) {
                    return { ok: false, message: 'Traps need open floor space.' };
                }
            }
            if (kind === 'building') {
                if (this.buildings.length >= limits.buildings) return { ok: false, message: `Building cap reached: ${limits.buildings}.` };
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

            const nextLevelButton = nextLevel ? (() => {
                const techReady = this.techTier >= nextLevel.level;
                const canAfford = techReady && hasCost(this.player, nextLevel.cost);
                return `
                    <button class="btn ${canAfford ? 'btn-primary' : 'btn-secondary opacity-50'}" ${canAfford ? '' : 'disabled'} onclick="game.upgradeWorkbench()">
                        Upgrade Bench<br><small>${techReady ? costLabel(nextLevel.cost) : `Requires Tech ${roman(nextLevel.level)}`}</small>
                    </button>`;
            })() : '<span class="bench-maxed">MAX BENCH</span>';

            const tabButtons = [
                ['turrets', 'Turrets'],
                ['walls', 'Walls'],
                ['traps', 'Traps'],
                ['repairs', 'Repairs'],
                ['tech', 'Tech'],
                ['skills', 'Skills'],
                ['buildings', 'Buildings']
            ].map(([id, label]) => `
                <button class="workbench-tab ${this.workbenchTab === id ? 'active' : ''}" onclick="game.setWorkbenchTab('${id}')">${label}</button>
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
                const cap = bench.workbenchLevel * 2 + (this.buildings.some((building) => building.id === 'advancedTurretBench') ? 2 : 0);
                return `
                    <article class="workbench-item workbench-upgrade">
                        <span class="window-kicker">PLACED TURRET / OWNER ${sentry.ownerName || 'P1'}</span>
                        <div class="workbench-item-title">${sentry.name} #${index + 1}</div>
                        <p class="workbench-item-desc">${Math.ceil(sentry.health)} / ${Math.ceil(sentry.maxHealth)} HP. Upgrade cap ${cap}. Repair is available from this bench.</p>
                        <div class="workbench-upgrade-grid">
                            ${this.turretUpgradeButton(index, 'damage', levels.damage, cap)}
                            ${this.turretUpgradeButton(index, 'fireRate', levels.fireRate, cap)}
                            ${this.turretUpgradeButton(index, 'range', levels.range, cap)}
                            ${this.turretUpgradeButton(index, 'ammo', levels.ammo, cap)}
                            <button class="btn btn-secondary text-xs" onclick="game.repairTurret(${index})">Repair</button>
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

            const nextTechCost = this.techTier < 3 ? { money: 1800 * this.techTier, wood: 25 * this.techTier, metal: 30 * this.techTier, parts: this.techTier } : null;
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
                repairs: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Repair Counter</h2><div class="workbench-grid">${repairHtml}</div></section>`,
                tech: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Tech and Bench Upgrades</h2>${techHtml}</section>`,
                skills: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Skill Counter</h2><div class="workbench-grid">${skillHtml}</div></section>`,
                buildings: `<section class="workbench-panel wide"><h2 class="workbench-section-header">Store Station Construction</h2><div class="workbench-grid">${buildingHtml}</div></section>`
            };

            workbenchContent.innerHTML = `
                <div class="workbench-console">
                    <div>
                        <span class="window-kicker">CURRENT BENCH</span>
                        <h3>${levelDefinition.name}</h3>
                        <p>Tech ${roman(this.techTier)} unlocked / Bench Level ${bench.workbenchLevel} / ${Math.ceil(bench.health)} HP</p>
                    </div>
                    ${nextLevelButton}
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

        turretUpgradeButton: function (index, stat, level, cap) {
            const labels = { damage: 'DAMAGE', fireRate: 'FIRE RATE', range: 'RANGE', ammo: 'AMMO' };
            const maxed = level >= cap;
            const cost = { money: 80 + level * 80, wood: 2 + level, metal: 3 + level * 2 };
            return `<button class="btn ${maxed ? 'btn-secondary opacity-50' : 'btn-primary'} text-xs"
                ${maxed ? 'disabled' : ''} onclick="game.upgradeTurret(${index}, '${stat}')">
                ${labels[stat]} ${level}/${cap}<br><small>${costLabel(cost)}</small>
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
            if (level >= bench.workbenchLevel * 2) return;
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
            const missing = 1 - sentry.health / sentry.maxHealth;
            const cost = { wood: Math.max(1, Math.ceil(missing * 4)), metal: Math.max(1, Math.ceil(missing * 5)) };
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
            this.sentries.push(sentry);
            this.recordBuild();
            if (this.broadcastBuildAction) this.broadcastBuildAction('turret', sentry);
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
            this.walls.push(wall);
            this.recordBuild();
            if (this.broadcastBuildAction) this.broadcastBuildAction('wall', wall);
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
            this.traps.push(trap);
            this.recordBuild();
            if (this.broadcastBuildAction) this.broadcastBuildAction('trap', trap);
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
            this.buildings.push(building);
            this.recordBuild();
            if (this.broadcastBuildAction) this.broadcastBuildAction('building', building);
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
            const gate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
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
                x: gate.x + Math.random() * 80 - 40,
                y: gate.y + Math.random() * 80 - 40,
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
