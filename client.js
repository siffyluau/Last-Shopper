// --- DOM Elements ---
        const loadingScreen = document.getElementById('loading-screen');
        const lobbyScreen = document.getElementById('lobby-screen');
        const startGameButton = document.getElementById('start-game-button');
        const gameContainer = document.getElementById('game-container');
        const canvas = document.getElementById('game-canvas');
        const ctx = canvas.getContext('2d');
        
        // HUD Elements
        const hud = {
            waveText: document.getElementById('hud-wave-text'),
            waveProgressText: document.getElementById('hud-wave-progress-text'),
            waveProgressBar: document.getElementById('hud-wave-progress-bar'),
            waveInfoContainer: document.getElementById('wave-info-container'), // --- NEW ---
            healthBar: document.getElementById('hud-health-bar'),
            healthText: document.getElementById('hud-health-text'),
            staminaBar: document.getElementById('hud-stamina-bar'),
            staminaText: document.getElementById('hud-stamina-text'),
            money: document.getElementById('hud-money'),
            wood: document.getElementById('hud-wood'),
            metal: document.getElementById('hud-metal'),
            reserveAmmo: document.getElementById('hud-reserve-ammo'),
            rareParts: document.getElementById('hud-rare-parts'),
            weaponName: document.getElementById('hud-weapon-name'),
            weaponLevel: document.getElementById('hud-weapon-level'),
            ammoCurrent: document.getElementById('hud-ammo-current'),
            ammoMax: document.getElementById('hud-ammo-max'),
            weaponList: document.getElementById('hud-weapon-list'),
            level: document.getElementById('hud-level'),
            skillPoints: document.getElementById('hud-skill-points'),
            xpBar: document.getElementById('hud-xp-bar'),
            xpText: document.getElementById('hud-xp-text'),
            techTier: document.getElementById('hud-tech-tier')
        };
        
        // Modals
        const gameOverModal = document.getElementById('game-over-modal');
        const restartButton = document.getElementById('restart-button');
        const shopModal = document.getElementById('shop-modal');
        const shopContent = document.getElementById('shop-content');
        const craftingModal = document.getElementById('crafting-modal');
        const craftingContent = document.getElementById('crafting-content');
        const workbenchModal = document.getElementById('workbench-modal');
        const workbenchContent = document.getElementById('workbench-content');
        const placingItemHint = document.getElementById('placing-item-hint');
        const placingItemText = document.getElementById('placing-item-text');
        const intermissionTimer = document.getElementById('intermission-timer'); 
        const prepEventLabel = document.getElementById('prep-event-label');
        const prepCountdown = document.getElementById('prep-countdown');
        const prepEventDetail = document.getElementById('prep-event-detail');
        const waveStatusToast = document.getElementById('wave-status-toast');
        const traderModal = document.getElementById('trader-modal');
        const traderContent = document.getElementById('trader-content');
        const buildingModal = document.getElementById('building-modal');
        const buildingKicker = document.getElementById('building-kicker');
        const buildingTitle = document.getElementById('building-title');
        const buildingContent = document.getElementById('building-content');
        const waveRewardModal = document.getElementById('wave-reward-modal');
        const waveRewardTitle = document.getElementById('wave-reward-title');
        const waveRewardSummary = document.getElementById('wave-reward-summary');
        const waveContinueButton = document.getElementById('wave-continue-button');
        const upgradeCardContainer = document.getElementById('upgrade-card-container');
        const skillModal = document.getElementById('skill-modal');
        const skillContent = document.getElementById('skill-content');
        const skillMenuButton = document.getElementById('skill-menu-button');
        const workbenchTitle = document.getElementById('workbench-title');
        const playerNameInput = document.getElementById('player-name-input');
        const skinList = document.getElementById('skin-list');
        const skinPreview = document.getElementById('skin-preview');
        const skinPreviewInitial = document.getElementById('skin-preview-initial');
        const selectedSkinName = document.getElementById('selected-skin-name');
        const selectedSkinDesc = document.getElementById('selected-skin-desc');
        const lobbyRank = document.getElementById('lobby-rank');
        const roomCodeInput = document.getElementById('room-code-input');
        const cloudRelayInput = document.getElementById('cloud-relay-input');
        const hostRoomButton = document.getElementById('host-room-button');
        const joinRoomButton = document.getElementById('join-room-button');
        const copyInviteButton = document.getElementById('copy-invite-button');
        const partyList = document.getElementById('party-list');
        const multiplayerStatus = document.getElementById('multiplayer-status');
        const metaHighestWave = document.getElementById('meta-highest-wave');
        const metaTotalKills = document.getElementById('meta-total-kills');
        const metaBosses = document.getElementById('meta-bosses');
        const metaBuilds = document.getElementById('meta-builds');
        const nextUnlockLabel = document.getElementById('next-unlock-label');
        const zombieIndexLobbyButton = document.getElementById('zombie-index-lobby-button');
        const zombieIndexHudButton = document.getElementById('zombie-index-hud-button');
        const zombieIndexModal = document.getElementById('zombie-index-modal');
        const zombieIndexSearch = document.getElementById('zombie-index-search');
        const zombieIndexTabs = document.getElementById('zombie-index-tabs');
        const zombieIndexContent = document.getElementById('zombie-index-content');
        const leaveRunButton = document.getElementById('leave-run-button');
        const downedOverlay = document.getElementById('downed-overlay');
        const downedStatus = document.getElementById('downed-status');
        const downedRespawnText = document.getElementById('downed-respawn-text');
        const reviveProgress = document.getElementById('revive-progress');
        const respawnButton = document.getElementById('respawn-button');
        const downedLeaveButton = document.getElementById('downed-leave-button');
        const worldClock = document.getElementById('world-clock');
        const progression = new ProgressionSystem(LastShopperContent);

        // --- Game State Object ---
        let game = {
            // Core game state
            zombies: [],
            bullets: [],
            explosions: [],
            particles: [],
            sentries: [],
            walls: [],
            drops: [],
            acidPools: [],
            mapSeed: `local-${Math.random().toString(36).slice(2)}`,
            mapStructures: [],
            generatedWorldChunks: new Set(),
            citySceneCache: new Map(),
            lootEvents: [],
            appliedLootEvents: new Set(),
            lootBeacon: null,
            nextLocalWorldDropAt: performance.now() + 45000,
            traps: [], 
            buildings: [],
            empPulses: [], 
            healParticles: [], 
            wave: 0,
            zombiesKilled: 0,
            totalZombiesInWave: 0,
            waveActive: false,
            gameStarted: false,
            gameOver: false,
            dayTime: 0.34,
            dayNumber: 1,
            
            bossesToSpawn: 0,
            miniBossesToSpawn: 0,
            escortsToSpawn: 0,
            currentWavePlan: null,
            techTier: 1,
            waitingForReward: false,
            selectedReward: false,
            runUpgradeCounts: {},
            preparationActive: false,
            preparationEndsAt: 0,
            preparationEvent: null,
            supplyDrop: null,
            trader: null,
            traderOpen: false,
            buildingOpen: false,
            activeBuilding: null,
            localPlayerId: `p${Math.random().toString(36).slice(2, 9)}`,
            roomCode: 'STORE',
            remotePlayers: [],
            selectedSkinId: 'shopper',
            metaProgression: {
                highestWave: 0,
                totalKills: 0,
                bossesDefeated: 0,
                defensesBuilt: 0,
                selectedSkinId: 'shopper',
                playerName: 'The Shopper'
            },
            multiplayer: null,
            team: {
                playerCount: 1
            },
            isRoomHost: true,
            roomStarted: false,
            
            // Map
            MAP_WIDTH: 2000,
            MAP_HEIGHT: 1400,
            PLAYER_RADIUS: 12, 
            
            // Player
            player: {
                x: 1000,
                y: 850,
                angle: 0,
                money: 0,
                health: 100,
                maxHealth: 100,
                baseMaxHealth: 100, 
                speed: 4,
                stamina: 100,
                maxStamina: 100,
                staminaRegen: 0.45,
                sprintDrain: 0.9,
                sprintMultiplier: 1.55,
                isSprinting: false,
                wood: 12,
                metal: 8,
                reserveAmmo: 60,
                rareTurretParts: 0,
                name: 'The Shopper',
                skinId: 'shopper',
                level: 1,
                xp: 0,
                xpToNext: progression.xpToNext(1),
                skillPoints: 0,
                downed: false,
                downedAt: 0,
                respawnAt: 0,
                giveUpAt: 0,
                reviveProgress: 0,
                skillLevels: {
                    maxHealth: 0,
                    moveSpeed: 0,
                    reloadSpeed: 0,
                    bulletDamage: 0,
                    pickupRange: 0,
                    resourceMultiplier: 0
                }
            },
            
            camera: { 
                x: 0, 
                y: 0, 
                shake: 0, 
                shakeIntensity: 0,
                targetX: 0,
                targetY: 0
            },
            
            // Weapons
            weapons: LastShopperContent.weaponTypes.map((weapon) => ({
                ...weapon,
                currentAmmo: weapon.maxAmmo,
                isReloading: false,
                upgradeLevel: 0
            })),
            selectedWeapon: 0,
            lastShot: 0,
            
            // Crafting Tiers
            sentryTypes: LastShopperContent.turretTypes,
            basicWallTypes: [ // Basic Crafting
                { ...LastShopperContent.wallStages[0], maxHealth: LastShopperContent.wallStages[0].health, wallStage: 0, radius: 25 }
            ],
            advancedWallTypes: LastShopperContent.wallStages.slice(1).map((wall, index) => ({
                ...wall,
                maxHealth: wall.health,
                wallStage: index + 1,
                radius: 25
            })),
            trapTypes: LastShopperContent.trapTypes,
            buildingTypes: LastShopperContent.buildingTypes,
            
            // Zombies
            zombieTypes: {
                // Standard
                normal: { color: [45, 80, 22], speed: 1, health: 100, reward: 10, size: 15 },
                fast: { color: [200, 50, 50], speed: 2.0, health: 60, reward: 15, size: 12 },
                tank: { color: [77, 112, 22], speed: 0.7, health: 300, reward: 25, size: 25 },
                spitter: { color: [150, 200, 50], speed: 0.8, health: 80, reward: 20, size: 14, shootRange: 300, shootRate: 1800 },
                thrower: { color: [100, 150, 200], speed: 1.2, health: 120, reward: 22, size: 16, throwRange: 250, throwRate: 2500 },
                boss: { color: [139, 0, 0], speed: 0.5, health: 2000, reward: 500, xp: 500, size: 40, shootRange: 400, shootRate: 1000, slamRange: 100, slamRate: 5000 },
                // New
                sapper: { color: [255, 100, 0], speed: 2.2, health: 50, reward: 50, size: 10, explosionDamage: 500, isSapper: true },
                disruptor: { color: [0, 200, 255], speed: 1.0, health: 150, reward: 30, size: 16, isDisruptor: true, empRadius: 200, empRate: 10000, lastEmp: 0 },
                healer: { color: [220, 220, 220], speed: 1.5, health: 100, reward: 25, xp: 25, size: 13, isHealer: true, healRadius: 100, healRate: 1000, healAmount: 5, lastHeal: 0 },
                ...LastShopperContent.enemyTypes
            },
            spawnGates: [
                { x: 100, y: 100 }, { x: 1900, y: 100 }, { x: 100, y: 1300 },
                { x: 1900, y: 1300 }, { x: 1000, y: 100 }, { x: 1000, y: 1300 }
            ],
            
            // Shop
            shop: {
                x: 980, y: 615, width: 390, height: 260,
                interactionX: 980, interactionY: 780, interactionRadius: 110
            },
            workbench: {
                x: 1285, y: 820, width: 118, height: 62,
                interactionRadius: 90, workbenchLevel: 1,
                health: 600, maxHealth: 600
            },
            shopOpen: false,
            
            // UI State
            craftingOpen: false,
            workbenchOpen: false,
            workbenchTab: 'turrets',
            skillsOpen: false,
            zombieIndexOpen: false,
            zombieIndexCategory: 'Common',
            zombieIndexFilter: '',
            placingSentry: null,
            placingWall: null,
            placingTrap: null, 
            placingBuilding: null,
            
            // Input
            keys: {},
            mouse: { x: 0, y: 0, worldX: 0, worldY: 0, isDown: false },
            
            // Timing
            spawnInterval: null,
            lastFrameTime: 0,
            intermissionTimerInterval: null, 
            waveEndTimeout: null, 
            
            // Upgrades
            upgrades: {
                autoLoot: false,
                autoRefill: false,
                turretSpeed: false
            },
            
            workbenchUpgrades: [
                { id: 'autoLoot', name: 'Sentry Auto-Loot', description: 'Automatically collect drops from all sources in a large radius.', cost: { money: 15000, wood: 100, metal: 100 } },
                { id: 'autoRefill', name: 'Sentry Auto-Refill', description: 'Your turrets will automatically refill their ammo for free when empty.', cost: { money: 20000, wood: 150, metal: 150 } },
                { id: 'turretSpeed', name: 'Sentry Speed Boost', description: 'Increases the firing speed of all your turrets by 50%.', cost: { money: 10000, wood: 50, metal: 50 } }
            ],
            
            activePotions: {
                loot: 0,
                fireRate: 0,
                health: 0,
                sprint: 0,
                lifesteal: 0,
                armor: 0,
                crit: 0,
                resource: 0,
                infiniteAmmo: 0
            },
            potions: [
                { id: 'loot_30s', name: 'Loot Potion (30s)', cost: { money: 2000, wood: 5, metal: 5 }, duration: 30000, type: 'loot', multiplier: 2 },
                { id: 'loot_60s', name: 'Loot Potion (1m)', cost: { money: 3500, wood: 10, metal: 10 }, duration: 60000, type: 'loot', multiplier: 2 },
                { id: 'loot_300s', name: 'Loot Potion (5m)', cost: { money: 15000, wood: 25, metal: 25 }, duration: 300000, type: 'loot', multiplier: 2 },
                { id: 'rate_30s', name: 'Fire Rate Potion (30s)', cost: { money: 3000, wood: 5, metal: 10 }, duration: 30000, type: 'fireRate', multiplier: 2 },
                { id: 'rate_60s', name: 'Fire Rate Potion (1m)', cost: { money: 5500, wood: 10, metal: 20 }, duration: 60000, type: 'fireRate', multiplier: 2 },
                { id: 'rate_300s', name: 'Fire Rate Potion (5m)', cost: { money: 25000, wood: 30, metal: 50 }, duration: 300000, type: 'fireRate', multiplier: 2 },
                { id: 'health_30s', name: 'Health Potion (30s)', cost: { money: 2500, wood: 10, metal: 5 }, duration: 30000, type: 'health', multiplier: 2 },
                { id: 'health_60s', name: 'Health Potion (1m)', cost: { money: 4500, wood: 20, metal: 10 }, duration: 60000, type: 'health', multiplier: 2 },
                { id: 'health_300s', name: 'Health Potion (5m)', cost: { money: 20000, wood: 50, metal: 30 }, duration: 300000, type: 'health', multiplier: 2 },
            ],

            // --- Game Functions ---
            
            init: function() {
                this.audio = window.LastShopperAudio ? new LastShopperAudio() : null;
                const unlockAudio = () => this.audio?.unlock();
                window.addEventListener('pointerdown', unlockAudio, { once: true });
                window.addEventListener('keydown', unlockAudio, { once: true });
                this.loadMetaProgression();
                this.setupLobby();
                this.setupMultiplayer();
                // Set canvas size
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                window.addEventListener('resize', () => {
                    canvas.width = window.innerWidth;
                    canvas.height = window.innerHeight;
                });
                
                // Input Listeners
                window.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && this.zombieIndexOpen) {
                        this.toggleZombieIndex(false);
                        return;
                    }
                    if (!this.gameStarted || this.gameOver || this.waitingForReward) return;
                    if (e.key === 'Escape') {
                        if (this.placingSentry || this.placingWall || this.placingTrap || this.placingBuilding) { 
                            this.cancelPlacing();
                        } else if (this.craftingOpen) {
                            this.toggleCrafting(false);
                        } else if (this.shopOpen) {
                            this.toggleShop(false);
                        } else if (this.workbenchOpen) {
                            this.toggleWorkbench(false);
                        } else if (this.skillsOpen) {
                            this.toggleSkills(false);
                        } else if (this.traderOpen) {
                            this.toggleTrader(false);
                        } else if (this.buildingOpen) {
                            this.toggleBuilding(false);
                        }
                    } else if (e.key.toLowerCase() === 'i') {
                        this.toggleZombieIndex(!this.zombieIndexOpen);
                    } else if (e.key.toLowerCase() === 'c') {
                        if (!this.shopOpen && !(this.placingSentry || this.placingWall || this.placingTrap || this.placingBuilding) && !this.workbenchOpen && !this.skillsOpen && !this.waitingForReward && !this.buildingOpen) { 
                            this.toggleCrafting(!this.craftingOpen);
                        }
                    } else if (e.key.toLowerCase() === 'k') {
                        if (!this.waitingForReward && !this.craftingOpen && !this.shopOpen && !this.workbenchOpen && !this.buildingOpen) {
                            this.toggleSkills(!this.skillsOpen);
                        }
                    } else if (e.key.toLowerCase() === 'r') {
                        this.reloadWeapon();
                    } else if (e.key.toLowerCase() === 'e') {
                        if (!this.craftingOpen && !this.skillsOpen) {
                            const teammate = this.getNearbyDownedTeammate ? this.getNearbyDownedTeammate() : null;
                            const station = this.getNearbyStation ? this.getNearbyStation() : null;
                            if (teammate) {
                                this.requestReviveTick(teammate.id);
                            } else if (station === 'workbench' && !this.shopOpen) {
                                this.toggleWorkbench(!this.workbenchOpen);
                            } else if (station === 'shop' && !this.workbenchOpen) {
                                this.toggleShop(!this.shopOpen);
                            } else if (station === 'supply') {
                                this.collectSupplyDrop();
                            } else if (station === 'trader' && !this.workbenchOpen && !this.shopOpen) {
                                this.toggleTrader(!this.traderOpen);
                            } else if (station && station.startsWith('door:')) {
                                this.toggleWorldDoor(station.slice('door:'.length));
                            } else if (station && station.startsWith('loot:')) {
                                this.openWorldLoot(station.slice('loot:'.length));
                            } else if (station && station.startsWith('building:') && !this.workbenchOpen && !this.shopOpen) {
                                this.toggleBuilding(!this.buildingOpen, station.slice('building:'.length));
                            }
                        }
                    } else if (e.key.toLowerCase() === 'g') {
                        this.refillNearbyTurret();
                    }
                    
                    if (e.key >= '1' && e.key <= '8') {
                        this.selectWeapon(parseInt(e.key) - 1);
                    }
                    
                    this.keys[e.key.toLowerCase()] = true;
                });
                
                window.addEventListener('keyup', (e) => {
                    this.keys[e.key.toLowerCase()] = false;
                });
                
                // --- MODIFIED: Mousedown handler ---
                canvas.addEventListener('mousedown', (e) => {
                    if (this.updateMouseFromEvent) this.updateMouseFromEvent(e);
                    if (e.button !== 0) return;
                    // Check for placing *first*
                    if (this.placingSentry) {
                        this.placeSentry();
                        return; // Consume the click
                    }
                    if (this.placingWall) {
                        this.placeWall();
                        return; // Consume the click
                    }
                    if (this.placingTrap) { 
                        this.placeTrap();
                        return; // Consume the click
                    }
                    if (this.placingBuilding) {
                        this.placeBuilding();
                        return;
                    }
                    
                    // If not placing, *then* set isDown for shooting
                    this.mouse.isDown = true;
                });
                
                canvas.addEventListener('mouseup', (e) => {
                    this.mouse.isDown = false;
                });
                
                canvas.addEventListener('mousemove', (e) => {
                    if (this.updateMouseFromEvent) {
                        this.updateMouseFromEvent(e);
                    } else {
                        this.mouse.x = e.clientX;
                        this.mouse.y = e.clientY;
                    }
                });
                
                // Button Listeners
                startGameButton.onclick = () => this.requestStartGame();
                hostRoomButton.onclick = () => this.hostRoom();
                joinRoomButton.onclick = () => this.joinRoom();
                copyInviteButton.onclick = () => this.copyRoomInvite();
                zombieIndexLobbyButton.onclick = () => this.toggleZombieIndex(true);
                zombieIndexHudButton.onclick = () => this.toggleZombieIndex(true);
                zombieIndexSearch.oninput = () => {
                    this.zombieIndexFilter = zombieIndexSearch.value.trim().toLowerCase();
                    this.populateZombieIndex();
                };
                playerNameInput.oninput = () => {
                    this.metaProgression.playerName = playerNameInput.value.trim() || 'The Shopper';
                    this.updateSkinPreview();
                    this.updatePartyList();
                    this.saveMetaProgression();
                };
                
                restartButton.onclick = () => {
                    gameOverModal.classList.add('hidden');
                    this.resetGame();
                    this.start();
                };

                skillMenuButton.onclick = () => this.toggleSkills(true);
                waveContinueButton.onclick = () => this.continueAfterReward();
                leaveRunButton.onclick = () => this.leaveToLobby();
                downedLeaveButton.onclick = () => this.leaveToLobby();
                respawnButton.onclick = () => this.requestRespawn();
                
                // Finish loading
                setTimeout(() => {
                    loadingScreen.style.opacity = '0';
                    lobbyScreen.classList.remove('hidden');
                    setTimeout(() => loadingScreen.classList.add('hidden'), 1000);
                }, 1500); // Fake loading time
                
                this.updateWeaponUI();
            },
            
            start: function() {
                if (this.gameStarted) return;
                this.gameStarted = true;
                this.gameOver = false;
                this.startWave();
                this.lastFrameTime = performance.now();
                this.gameLoop();
            },
            
            startWave: function() {
                if (this.isWorldHost && !this.isWorldHost()) return;
                this.wave++;
                this.waveActive = true;
                this.waitingForReward = false;
                this.selectedReward = false;
                this.zombiesKilled = 0;
                this.bossesToSpawn = 0; 
                this.miniBossesToSpawn = 0;
                this.escortsToSpawn = 0;

                const basePlan = progression.wavePlan(this.wave);
                const playerScale = 1 + Math.max(0, (this.team.playerCount || 1) - 1) * 0.35;
                this.currentWavePlan = {
                    ...basePlan,
                    enemyCount: Math.ceil(basePlan.enemyCount * playerScale),
                    healthScale: basePlan.healthScale * (1 + Math.max(0, (this.team.playerCount || 1) - 1) * 0.12),
                    rewardScale: basePlan.rewardScale * (1 + Math.max(0, (this.team.playerCount || 1) - 1) * 0.18)
                };
                this.techTier = Math.max(this.techTier, progression.unlockedTechForWave(this.wave - 1));
                this.bossesToSpawn = this.currentWavePlan.bossCount;
                this.miniBossesToSpawn = this.currentWavePlan.miniBossCount;
                this.escortsToSpawn = this.currentWavePlan.enemyCount;
                this.totalZombiesInWave = this.escortsToSpawn + this.bossesToSpawn + this.miniBossesToSpawn;
                
                if (this.spawnInterval) clearInterval(this.spawnInterval);
                const spawnRate = Math.max(520, 1300 - this.wave * 10);
                this.spawnInterval = setInterval(() => {
                    if (this.waveActive && this.zombies.length + this.zombiesKilled < this.totalZombiesInWave) {
                        this.spawnZombie();
                    } else if (!this.waveActive) {
                        clearInterval(this.spawnInterval);
                    }
                }, spawnRate);
            },

            resetGame: function() {
                this.zombies = [];
                this.bullets = [];
                this.explosions = [];
                this.particles = [];
                this.sentries = [];
                this.walls = [];
                this.drops = [];
                this.acidPools = [];
                this.traps = []; 
                this.buildings = [];
                this.mapStructures = [];
                this.generatedWorldChunks = new Set();
                this.citySceneCache = new Map();
                this.lootEvents = [];
                this.appliedLootEvents = new Set();
                this.lootBeacon = null;
                this.nextLocalWorldDropAt = performance.now() + 45000;
                this.empPulses = []; 
                this.healParticles = []; 
                this.wave = 0;
                this.zombiesKilled = 0;
                this.totalZombiesInWave = 0;
                this.waveActive = false;
                this.waitingForReward = false;
                this.selectedReward = false;
                
                this.bossesToSpawn = 0;
                this.miniBossesToSpawn = 0;
                this.escortsToSpawn = 0;
                this.currentWavePlan = null;
                this.techTier = 1;
                this.runUpgradeCounts = {};
                this.preparationActive = false;
                this.preparationEndsAt = 0;
                this.preparationEvent = null;
                this.supplyDrop = null;
                this.trader = null;
                this.traderOpen = false;
                this.buildingOpen = false;
                this.activeBuilding = null;

                if (this.waveEndTimeout) clearTimeout(this.waveEndTimeout);
                if (this.intermissionTimerInterval) clearInterval(this.intermissionTimerInterval);
                this.hideIntermissionTimer();
                this.waveEndTimeout = null;
                this.intermissionTimerInterval = null;
                
                this.player = {
                    x: 1000, y: 850, angle: 0, money: 0,
                    health: 100, maxHealth: 100, baseMaxHealth: 100,
                    speed: 4, stamina: 100, maxStamina: 100, staminaRegen: 0.45,
                    sprintDrain: 0.9, sprintMultiplier: 1.55, isSprinting: false,
                    wood: 12, metal: 8, reserveAmmo: 60,
                    rareTurretParts: 0,
                    name: this.metaProgression.playerName || 'The Shopper',
                    skinId: this.selectedSkinId || 'shopper',
                    level: 1, xp: 0, xpToNext: progression.xpToNext(1), skillPoints: 0,
                    downed: false, downedAt: 0, respawnAt: 0, giveUpAt: 0, reviveProgress: 0, reviverId: null,
                    skillLevels: {
                        maxHealth: 0, moveSpeed: 0, reloadSpeed: 0,
                        bulletDamage: 0, pickupRange: 0, resourceMultiplier: 0
                    }
                };
                
                this.weapons.forEach((w, i) => {
                    w.owned = (i === 0);
                    w.currentAmmo = w.maxAmmo;
                    w.isReloading = false;
                    w.upgradeLevel = 0;
                });
                this.selectedWeapon = 0;
                
                this.camera = { x: 0, y: 0, shake: 0, shakeIntensity: 0, targetX: 0, targetY: 0 };
                
                this.upgrades = { autoLoot: false, autoRefill: false, turretSpeed: false };
                this.activePotions = { loot: 0, fireRate: 0, health: 0, sprint: 0, lifesteal: 0, armor: 0, crit: 0, resource: 0, infiniteAmmo: 0 };
                this.workbench.workbenchLevel = 1;
                this.workbench.health = this.workbench.maxHealth;
                this.skillsOpen = false;
                traderModal.classList.add('hidden');
                buildingModal.classList.add('hidden');
                waveStatusToast.classList.add('hidden');
                skillModal.classList.add('hidden');
                waveRewardModal.classList.add('hidden');

                if (this.spawnInterval) clearInterval(this.spawnInterval);
            },
            
            gameLoop: function(timestamp) {
                if (this.gameOver || !this.gameStarted) return;
                
                this.update();
                this.draw();
                
                this.lastFrameTime = timestamp;
                requestAnimationFrame(this.gameLoop.bind(this));
            },
            
            // --- UPDATE FUNCTIONS ---
            
            update: function() {
                this.updatePotions();
                this.updatePreparationEvent();
                if (this.updateLocalDayNight) this.updateLocalDayNight();
                if (this.updateRevival) this.updateRevival();
                if (this.updateMouseWorld) this.updateMouseWorld();
                const inputBlocked = this.isInputBlocked ? this.isInputBlocked() : false;
                if (inputBlocked) {
                    this.mouse.isDown = false;
                    this.keys = {};
                }
                if (!inputBlocked && !this.player.downed) this.updatePlayer();
                if (this.syncMultiplayer) this.syncMultiplayer();
                if (!this.isWorldHost || this.isWorldHost()) {
                    if (this.ensureLocalWorldChunks) this.ensureLocalWorldChunks();
                    if (this.updateLocalWorldEvents) this.updateLocalWorldEvents();
                    if (!this.waitingForReward) {
                        this.updateZombies(); 
                        this.updateBullets();
                        this.updateSentries();
                        this.updateDrops();
                        this.updateAcidPools();
                        this.updateWalls(); 
                        this.updateEmpPulses(); 
                        this.updateHealParticles(); 
                    }
                }
                if (this.advanceNetworkInterpolation) this.advanceNetworkInterpolation();
                this.updateExplosions();
                this.updateParticles();
                this.updateCamera();
                if (this.updateMouseWorld) this.updateMouseWorld();
                const now = performance.now();
                if (!this.lastHudUpdate || now - this.lastHudUpdate >= 80) {
                    this.lastHudUpdate = now;
                    this.updateHUD();
                }
                
                if (this.player.health <= 0 && !this.gameOver) {
                    if (this.multiplayer?.serverAuthoritative) {
                        this.player.downed = true;
                    } else if (this.enterLocalDownedState) {
                        this.enterLocalDownedState();
                    }
                }
            },
            
            updatePotions: function() {
                const now = performance.now();
                for (const key of ['loot', 'fireRate', 'sprint', 'lifesteal', 'armor', 'crit', 'resource', 'infiniteAmmo']) {
                    if (this.activePotions[key] > 0 && now > this.activePotions[key]) {
                        this.activePotions[key] = 0;
                    }
                }
                
                if (this.activePotions.health > 0 && now > this.activePotions.health) {
                    this.activePotions.health = 0;
                    this.player.maxHealth = this.player.baseMaxHealth;
                    if (this.player.health > this.player.maxHealth) {
                        this.player.health = this.player.maxHealth;
                    }
                }
            },
            
            updatePlayer: function() {
                // Don't move if a menu is open
                if (this.craftingOpen || this.shopOpen || this.workbenchOpen || this.skillsOpen || this.waitingForReward || this.buildingOpen || this.traderOpen || this.zombieIndexOpen) {
                    this.keys = {};
                }
                
                const sprintActive = this.keys['shift'] && (this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d']) && this.player.stamina > 1;
                const sprintPotion = this.activePotions.sprint > performance.now();
                const speed = this.player.speed * (sprintActive ? this.player.sprintMultiplier * (sprintPotion ? 1.18 : 1) : 1);
                const previousX = this.player.x;
                const previousY = this.player.y;
                let moveX = 0;
                let moveY = 0;

                if (this.keys['w']) moveY -= 1;
                if (this.keys['s']) moveY += 1;
                if (this.keys['a']) moveX -= 1;
                if (this.keys['d']) moveX += 1;

                if (moveX !== 0 && moveY !== 0) {
                    const mag = Math.sqrt(2);
                    moveX = (moveX / mag);
                    moveY = (moveY / mag);
                }

                this.player.isSprinting = Boolean(sprintActive && (moveX || moveY));
                if (this.player.isSprinting) {
                    this.player.stamina = Math.max(0, this.player.stamina - this.player.sprintDrain * (sprintPotion ? 0.72 : 1));
                } else {
                    this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + this.player.staminaRegen * (sprintPotion ? 1.8 : 1));
                }

                this.player.x += moveX * speed;
                this.player.y += moveY * speed;
                if (this.resolvePlayerEnvironmentCollision) {
                    this.resolvePlayerEnvironmentCollision(previousX, previousY);
                }
                
                if (this.updateMouseWorld) this.updateMouseWorld();
                this.player.angle = Math.atan2(this.mouse.worldY - this.player.y, this.mouse.worldX - this.player.x);
                
                // Shooting
                if (this.mouse.isDown && !this.shopOpen && !this.craftingOpen && !this.placingSentry && !this.placingWall && !this.placingTrap && !this.placingBuilding && !this.workbenchOpen && !this.skillsOpen && !this.waitingForReward && !this.buildingOpen) { 
                    this.shoot();
                }
            },
            
            updateZombies: function() {
                const now = performance.now();

                // --- 1. SPECIAL ACTIONS (HEALER, DISRUPTOR) ---
                for (const z of this.zombies) {
                    if (z.isHealer && now - z.lastHeal > z.healRate) {
                        z.lastHeal = now;
                        let didHeal = false;
                        for (const otherZombie of this.zombies) {
                            if (otherZombie === z || otherZombie.health >= otherZombie.maxHealth) continue;
                            
                            if (this.dist(z.x, z.y, otherZombie.x, otherZombie.y) < z.healRadius) {
                                otherZombie.health = Math.min(otherZombie.maxHealth, otherZombie.health + z.healAmount);
                                this.createHealParticle(otherZombie.x, otherZombie.y);
                                didHeal = true;
                            }
                        }
                    }
                    else if (z.isDisruptor && now - z.lastEmp > z.empRate) {
                        z.lastEmp = now;
                        this.createEmpPulse(z.x, z.y, z.empRadius);
                        for (const s of this.sentries) {
                            if (this.dist(z.x, z.y, s.x, s.y) < z.empRadius) {
                                s.isDisabled = now + 5000; // Disable for 5 seconds
                            }
                        }
                    }
                    else if (z.isEngineer && now - (z.lastWeld || 0) > z.weldRate) {
                        z.lastWeld = now;
                        for (const otherZombie of this.zombies) {
                            if (otherZombie === z) continue;
                            if (this.dist(z.x, z.y, otherZombie.x, otherZombie.y) < z.weldRadius) {
                                otherZombie.maxShieldHealth = Math.max(otherZombie.maxShieldHealth || 0, 90);
                                otherZombie.shieldHealth = Math.min(otherZombie.maxShieldHealth, (otherZombie.shieldHealth || 0) + 30);
                                this.createSpark(otherZombie.x, otherZombie.y, [180, 120, 55], 5);
                                break;
                            }
                        }
                    }
                }

                // --- 2. MOVEMENT, ATTACKING, AND TRAP COLLISION ---
                for (let i = this.zombies.length - 1; i >= 0; i--) {
                    const z = this.zombies[i];
                    const previousZombieX = z.x;
                    const previousZombieY = z.y;
                    let didAction = false; 

                    const nearestTarget = this.getNearestEnemyTarget(z, true);
                    const playerDist = this.dist(z.x, z.y, this.player.x, this.player.y);
                    const targetDist = nearestTarget.distance;
                    const breachPlan = this.getShelterBreachPlan
                        ? this.getShelterBreachPlan(z, nearestTarget)
                        : null;
                    if (this.updateBossMechanics && this.updateBossMechanics(z, nearestTarget, now)) {
                        didAction = true;
                    }
                    if (z.hidden) continue;
                    if (z.isCharger && now - (z.lastCharge || 0) > z.chargeRate && targetDist < 330) {
                        z.lastCharge = now;
                        z.chargeUntil = now + z.chargeDuration;
                    }
                    const moveSpeed = z.isCharger && now < (z.chargeUntil || 0) ? z.chargeSpeed : z.speed;

                    // --- RANGED ATTACK AI ---
                    if (!breachPlan && (z.type === 'spitter' || z.type === 'boss' || z.type === 'miniBoss' || z.isAcidRanger || z.isBoss || z.isMiniBoss) && targetDist < z.shootRange) {
                        didAction = true; 
                        if (now - z.lastShot > z.shootRate) {
                            z.lastShot = now;
                            this.shootAcid(z.x, z.y, nearestTarget.x, nearestTarget.y, false);
                        }
                    } else if (!breachPlan && z.type === 'thrower' && targetDist < z.throwRange) {
                        didAction = true; 
                        if (now - z.lastShot > z.throwRate) {
                            z.lastShot = now;
                            this.shootAcid(z.x, z.y, nearestTarget.x, nearestTarget.y, true);
                        }
                    }
                    
                    if ((z.type === 'boss' || z.isBoss) && playerDist < z.slamRange) {
                        if (now - z.lastSlam > z.slamRate) {
                            z.lastSlam = now;
                            this.createExplosion(z.x, z.y, 100);
                            this.addCameraShake(15);
                        }
                    }

                    // --- MELEE / MOVEMENT AI ---
                    if (!didAction && this.damageShelterEntry && this.damageShelterEntry(z, breachPlan, now)) {
                        didAction = true;
                    }
                    if (!didAction) {
                        if (breachPlan) {
                            if (breachPlan.distance > 2) {
                                const dx = breachPlan.entry.x - z.x;
                                const dy = breachPlan.entry.y - z.y;
                                const distance = Math.max(1, breachPlan.distance);
                                z.x += (dx / distance) * moveSpeed;
                                z.y += (dy / distance) * moveSpeed;
                            }
                        }
                        // --- SAPPER AI (NEW) ---
                        else if (z.isSapper || z.isBomber) {
                            if (nearestTarget) {
                                if (targetDist <= z.size + nearestTarget.radius) { 
                                    // EXPLODE
                                    this.createExplosion(z.x, z.y, z.explosionDamage);
                                    if (nearestTarget.kind === 'player') {
                                        this.applyPlayerDamage(z.explosionDamage * 0.35);
                                    } else {
                                        nearestTarget.entity.health -= z.explosionDamage;
                                    }
                                    z.health = 0; // Kills itself
                                } else {
                                    // Move towards target
                                    const dx = nearestTarget.x - z.x;
                                    const dy = nearestTarget.y - z.y;
                                    z.x += (dx / targetDist) * moveSpeed;
                                    z.y += (dy / targetDist) * moveSpeed;
                                }
                            }
                        }
                        // --- REGULAR/HEALER/DISRUPTOR AI ---
                        else {
                            if (targetDist <= z.size + nearestTarget.radius) {
                                if (now - (z.lastMelee || 0) >= (z.attackRate || 700)) {
                                    z.lastMelee = now;
                                    if (nearestTarget.kind === 'player') {
                                        this.applyPlayerDamage((z.contactDamage || 8) * (z.damageScale || 1));
                                        if (z.isLeech) z.health = Math.min(z.maxHealth, z.health + (z.leechAmount || 6));
                                    } else {
                                        nearestTarget.entity.health -= (z.contactDamage || 8) * (z.damageScale || 1);
                                        if (z.isLeech) z.health = Math.min(z.maxHealth, z.health + (z.leechAmount || 6));
                                        if (nearestTarget.entity.isElectric) {
                                            this.damageZombie(z, nearestTarget.entity.shockDamage);
                                            this.createSpark(z.x, z.y, nearestTarget.entity.color);
                                        }
                                    }
                                }
                            } else {
                                if (targetDist > 0) { 
                                    const dx = nearestTarget.x - z.x;
                                    const dy = nearestTarget.y - z.y;
                                    z.x += (dx / targetDist) * moveSpeed;
                                    z.y += (dy / targetDist) * moveSpeed;
                                }
                            }
                        }
                    }

                    if (z.health > 0 && this.resolveZombieStructureCollision) {
                        this.resolveZombieStructureCollision(z, previousZombieX, previousZombieY);
                    }

                    // --- 3. TRAP COLLISION (NEW) ---
                    if (z.health > 0) {
                        for (let t_idx = this.traps.length - 1; t_idx >= 0; t_idx--) {
                            const trap = this.traps[t_idx];
                            if (this.dist(z.x, z.y, trap.x, trap.y) < trap.radius) {
                                this.damageZombie(z, trap.damage);
                                this.createSpark(z.x, z.y, trap.color, 15);
                                if (trap.oneTimeUse) {
                                    this.traps.splice(t_idx, 1);
                                }
                            }
                        }
                    }
                    
                    // --- 4. HEALTH CHECK ---
                    if (z.health <= 0) {
                        this.zombiesKilled++;
                        if (this.recordKill) this.recordKill(z);
                        this.player.money += Math.floor(z.reward * this.getResourceMultiplier());
                        this.gainXp(z.xp || Math.max(8, Math.floor(z.reward * 0.8)));
                        this.createDeath(z);
                        if (z.isBomber && !z.exploded) {
                            z.exploded = true;
                            this.createExplosion(z.x, z.y, z.explosionDamage * 0.65);
                        }
                        if (z.isBoss || z.type === 'boss') {
                            for (let j = 0; j < 4; j++) {
                                this.dropLoot(z.x + Math.random() * 60 - 30, z.y + Math.random() * 60 - 30);
                            }
                        } else if (z.isMiniBoss || z.type === 'miniBoss') {
                            for (let j = 0; j < 2; j++) {
                                this.dropLoot(z.x + Math.random() * 45 - 22, z.y + Math.random() * 45 - 22);
                            }
                        } else if (Math.random() < 0.3) {
                            this.dropLoot(z.x, z.y);
                        }
                        if (z.isSplitter && this.spawnSplitChildren) {
                            this.spawnSplitChildren(z);
                        }
                        this.zombies.splice(i, 1);
                    }
                }
                
                // --- 5. WAVE END CHECK ---
                if (this.waveActive && this.zombiesKilled >= this.totalZombiesInWave && this.zombies.length === 0) {
                    this.waveActive = false;
                    if (this.spawnInterval) clearInterval(this.spawnInterval);
                    this.showWaveReward();
                }
            },
            
            updateBullets: function() {
                for (let i = this.bullets.length - 1; i >= 0; i--) {
                    const b = this.bullets[i];
                    const previousBulletX = b.x;
                    const previousBulletY = b.y;
                    b.x += b.vx;
                    b.y += b.vy;
                    b.life = (b.life || 240) - 1;
                    
                    if (b.arcing) {
                        b.arcVelocity += 0.015;
                        b.vy += b.arcVelocity;
                        
                        const distToTarget = this.dist(b.x, b.y, b.targetX, b.targetY);
                        if (distToTarget < 20 && b.vy > 0) { 
                            if (b.acid) this.createAcidPool(b.x, b.y);
                            this.bullets.splice(i, 1);
                            continue;
                        }
                    }
                    
                    if (b.life <= 0) {
                        if (b.explosive) this.createExplosion(b.x, b.y, b.damage);
                        if (b.acid) this.createAcidPool(b.x, b.y);
                        this.bullets.splice(i, 1);
                        continue;
                    }
                    if (window.LastShopperWorld && (this.mapStructures || []).some((structure) =>
                        window.LastShopperWorld.segmentHitsStructure(
                            structure,
                            previousBulletX,
                            previousBulletY,
                            b.x,
                            b.y,
                            b.size || 4
                        ))) {
                        if (b.explosive) this.createExplosion(b.x, b.y, b.damage);
                        if (b.acid) this.createAcidPool(b.x, b.y);
                        this.bullets.splice(i, 1);
                        continue;
                    }
                    
                    for (let w of this.walls) {
                        if (!b.fromZombie) {
                            continue; 
                        }

                        if (Math.abs(b.x - w.x) < w.radius && Math.abs(b.y - w.y) < w.radius) { 
                            w.health -= b.damage;
                            if (b.explosive) this.createExplosion(b.x, b.y, b.damage);
                            if (b.acid) this.createAcidPool(b.x, b.y);
                            this.bullets.splice(i, 1);
                            continue;
                        }
                    }
                    if (i >= this.bullets.length) continue;
                    
                    if (b.fromZombie) {
                        for (let s of this.sentries) {
                             if (Math.abs(b.x - s.x) < s.radius && Math.abs(b.y - s.y) < s.radius) { 
                                s.health -= b.damage;
                                if (b.acid) this.createAcidPool(b.x, b.y);
                                this.bullets.splice(i, 1);
                                continue;
                            }
                        }
                        if (i >= this.bullets.length) continue;
                        for (let building of this.buildings) {
                            if (Math.abs(b.x - building.x) < building.width / 2 && Math.abs(b.y - building.y) < building.height / 2) {
                                building.health -= b.damage;
                                if (b.acid) this.createAcidPool(b.x, b.y);
                                this.bullets.splice(i, 1);
                                continue;
                            }
                        }
                    }
                    if (i >= this.bullets.length) continue;

                    if (b.fromZombie) {
                        const d = this.dist(b.x, b.y, this.player.x, this.player.y);
                        if (d < this.PLAYER_RADIUS) { 
                            const sheltered = window.LastShopperWorld && (this.mapStructures || []).some((structure) =>
                                window.LastShopperWorld.pointInside(structure, this.player.x, this.player.y, 2));
                            if (!sheltered) this.applyPlayerDamage(b.damage);
                            if (b.acid) this.createAcidPool(b.x, b.y);
                            this.bullets.splice(i, 1);
                            if (!sheltered) this.addCameraShake(4);
                        }
                    } else {
                        for (let j = 0; j < this.zombies.length; j++) {
                            const z = this.zombies[j];
                            if (b.hitIds?.includes(z.id || j)) continue;
                            if (this.tryBossDodge && this.tryBossDodge(z, b)) continue;
                            if (this.dist(b.x, b.y, z.x, z.y) < z.size) { 
                                if (b.explosive) {
                                    this.createExplosion(b.x, b.y, b.damage);
                                    this.addCameraShake(8);
                                } else {
                                    this.damageZombie(z, b.damage);
                                    if (!b.fromTurret && this.activePotions.lifesteal > performance.now()) {
                                        this.player.health = Math.min(this.player.maxHealth, this.player.health + b.damage * 0.08);
                                    }
                                }
                                if (b.pierce > 0 && !b.explosive) {
                                    b.pierce--;
                                    (b.hitIds ||= []).push(z.id || j);
                                } else {
                                    this.bullets.splice(i, 1);
                                }
                                break;
                            }
                        }
                    }
                }
            },
            
            createAcidPool: function(x, y) {
                this.acidPools.push({ x: x, y: y, radius: 30, life: 180, damage: 0.3 });
            },

            updateAcidPools: function() {
                for (let i = this.acidPools.length - 1; i >= 0; i--) {
                    const pool = this.acidPools[i];
                    pool.life--;
                    
                    const d = this.dist(pool.x, pool.y, this.player.x, this.player.y);
                    if (d < pool.radius + this.PLAYER_RADIUS) { 
                        this.applyPlayerDamage(pool.damage);
                    }
                    
                    if (pool.life <= 0) {
                        this.acidPools.splice(i, 1);
                    }
                }
            },
            
            updateSentries: function() {
                const now = performance.now();
                const powerRelayOnline = this.buildings.some((building) => building.id === 'powerRelay' && building.health > 0);
                const canRefill = powerRelayOnline && now - (this.lastPowerRelayTick || 0) >= 3000;
                if (canRefill) this.lastPowerRelayTick = now;
                for (let i = this.sentries.length - 1; i >= 0; i--) {
                    const s = this.sentries[i];
                    if (s.health <= 0) {
                        this.createExplosion(s.x, s.y, 50);
                        this.sentries.splice(i, 1);
                        continue; 
                    }

                    if (s.isDisabled > now) {
                        continue; 
                    }

                    let closestZombie = null;
                    let closestDist = s.range * (powerRelayOnline ? 1.15 : 1);
                    if (canRefill && s.ammo < s.maxAmmo) s.ammo++;
                    
                    for (const z of this.zombies) {
                        const d = this.dist(s.x, s.y, z.x, z.y);
                        if (d < closestDist) {
                            closestDist = d;
                            closestZombie = z;
                        }
                    }
                    
                    if (closestZombie) {
                        s.angle = Math.atan2(closestZombie.y - s.y, closestZombie.x - s.x);
                        
                        const fireRate = s.fireRate / (this.upgrades.turretSpeed ? 1.5 : 1);
                        if (now - s.lastShot > fireRate) {
                            
                            if (s.ammo <= 0) {
                                if (this.upgrades.autoRefill) {
                                    s.ammo = s.maxAmmo;
                                } else {
                                    continue; 
                                }
                            }
                            
                            s.lastShot = now;
                            s.ammo--;
                            
                            if (s.pellets) {
                                for (let p = 0; p < s.pellets; p++) {
                                    const spread = (Math.random() - 0.5) * 0.4;
                                    this.bullets.push({
                                        x: s.x, y: s.y,
                                        vx: Math.cos(s.angle + spread) * s.speed,
                                        vy: Math.sin(s.angle + spread) * s.speed,
                                        damage: s.damage, explosive: s.explosive,
                                        size: s.bulletSize,
                                        ownerId: s.ownerId || this.localPlayerId,
                                        fromTurret: true
                                    });
                                }
                            } else {
                                this.bullets.push({
                                    x: s.x, y: s.y,
                                    vx: Math.cos(s.angle) * s.speed,
                                    vy: Math.sin(s.angle) * s.speed,
                                    damage: s.damage, explosive: s.explosive,
                                    size: s.bulletSize,
                                    ownerId: s.ownerId || this.localPlayerId,
                                    fromTurret: true
                                });
                            }
                        }
                    }
                }
            },
            
            updateWalls: function() {
                for (let i = this.buildings.length - 1; i >= 0; i--) {
                    if (this.buildings[i].health <= 0) {
                        this.createExplosion(this.buildings[i].x, this.buildings[i].y, 60);
                        this.buildings.splice(i, 1);
                    }
                }
                for (let i = this.walls.length - 1; i >= 0; i--) {
                    if (this.walls[i].health <= 0) {
                        for (let p = 0; p < 15; p++) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = Math.random() * 1 + 1;
                            this.particles.push({
                                x: this.walls[i].x + Math.random()*40-20,
                                y: this.walls[i].y + Math.random()*40-20,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                life: 30,
                                color: this.walls[i].color
                            });
                        }
                        this.walls.splice(i, 1);
                    }
                }
            },
            
            updateExplosions: function() {
                for (let i = this.explosions.length - 1; i >= 0; i--) {
                    this.explosions[i].radius += 5;
                    for (const z of this.zombies) {
                        if (this.dist(this.explosions[i].x, this.explosions[i].y, z.x, z.y) < this.explosions[i].radius) {
                            this.damageZombie(z, this.explosions[i].damage * 0.1);
                        }
                    }
                    if (this.explosions[i].radius >= this.explosions[i].maxRadius) {
                        this.explosions.splice(i, 1);
                    }
                }
            },
            
            updateParticles: function() {
                for (let i = this.particles.length - 1; i >= 0; i--) {
                    const p = this.particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.vx *= 0.98;
                    p.vy *= 0.98;
                    p.life--;
                    if (p.life <= 0) {
                        this.particles.splice(i, 1);
                    }
                }
            },
            
            updateEmpPulses: function() { 
                for (let i = this.empPulses.length - 1; i >= 0; i--) {
                    const p = this.empPulses[i];
                    p.currentRadius += p.speed;
                    p.life--;
                    if (p.life <= 0) {
                        this.empPulses.splice(i, 1);
                    }
                }
            },

            updateHealParticles: function() { 
                for (let i = this.healParticles.length - 1; i >= 0; i--) {
                    const p = this.healParticles[i];
                    p.y += p.vy;
                    p.life--;
                    if (p.life <= 0) {
                        this.healParticles.splice(i, 1);
                    }
                }
            },
            
            updateDrops: function() {
                for (let i = this.drops.length - 1; i >= 0; i--) {
                    const drop = this.drops[i];
                    drop.life--;
                    
                    const pickupRadius = (this.upgrades.autoLoot ? 300 : 30) + this.player.skillLevels.pickupRange * 25;
                    const d = this.dist(drop.x, drop.y, this.player.x, this.player.y);
                    
                    if (d < pickupRadius + this.PLAYER_RADIUS) {
                        const multiplier = this.getResourceMultiplier();
                        if (drop.type === 'ammo') {
                            this.player.reserveAmmo += 20;
                            hud.reserveAmmo.textContent = this.player.reserveAmmo;
                        }
                        else if (drop.type === 'wood') this.player.wood += Math.max(1, Math.round(multiplier));
                        else if (drop.type === 'metal') this.player.metal += Math.max(1, Math.round(multiplier));
                        else if (drop.type === 'money') this.player.money += Math.floor(15 * multiplier);
                        else if (drop.type === 'medkit') this.player.health = Math.min(this.player.maxHealth, this.player.health + 30);

                        this.drops.splice(i, 1);
                    } else if (drop.life <= 0) {
                        this.drops.splice(i, 1);
                    }
                }
            },
            
            updateCamera: function() {
                this.camera.targetX = this.player.x - canvas.width / 2;
                this.camera.targetY = this.player.y - canvas.height / 2;
                
                this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
                this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;
                
                if (this.camera.shakeIntensity > 0) {
                    this.camera.shake = (Math.random() - 0.5) * this.camera.shakeIntensity * 2;
                    this.camera.shakeIntensity *= 0.9;
                    if (this.camera.shakeIntensity < 0.1) this.camera.shakeIntensity = 0;
                } else {
                    this.camera.shake = 0;
                }
            },
            
            updateHUD: function() {
                // Wave
                const progress = this.totalZombiesInWave > 0 ? this.zombiesKilled / this.totalZombiesInWave : 0;
                const percentage = Math.floor(progress * 100);
                const waveText = this.wave % 10 === 0
                    ? `BOSS WAVE ${this.wave}`
                    : this.wave % 5 === 0 ? `MINI-BOSS WAVE ${this.wave}` : `WAVE ${this.wave}`;
                
                hud.waveText.textContent = waveText;
                hud.waveProgressText.textContent = `${this.zombiesKilled} / ${this.totalZombiesInWave}`;
                hud.waveProgressBar.style.width = `${percentage}%`;
                
                // Player
                const healthPercent = Math.max(0, this.player.health) / this.player.maxHealth;
                hud.healthBar.style.width = `${healthPercent * 100}%`;
                hud.healthText.textContent = `${Math.max(0, Math.floor(this.player.health))}/${this.player.maxHealth}`;
                const staminaPercent = Math.max(0, this.player.stamina) / this.player.maxStamina;
                hud.staminaBar.style.width = `${staminaPercent * 100}%`;
                hud.staminaText.textContent = `${Math.floor(this.player.stamina)} / ${this.player.maxStamina}`;
                
                hud.money.textContent = this.player.money;
                hud.wood.textContent = this.player.wood;
                hud.metal.textContent = this.player.metal;
                hud.reserveAmmo.textContent = this.player.reserveAmmo;
                hud.rareParts.textContent = this.player.rareTurretParts;
                hud.level.textContent = `LV ${this.player.level}`;
                hud.skillPoints.textContent = this.player.skillPoints;
                hud.xpText.textContent = `${this.player.xp} / ${this.player.xpToNext}`;
                hud.xpBar.style.width = `${Math.min(100, (this.player.xp / this.player.xpToNext) * 100)}%`;
                hud.techTier.textContent = `TECH ${['I', 'II', 'III'][this.techTier - 1]}`;
                
                // Weapon
                const weapon = this.weapons[this.selectedWeapon];
                hud.weaponName.textContent = weapon.name;
                hud.weaponLevel.textContent = `CORE LV ${weapon.upgradeLevel || 0}`;
                
                if (weapon.isReloading) {
                    hud.ammoCurrent.textContent = 'R';
                    hud.ammoMax.textContent = '...';
                } else {
                    if (weapon.currentAmmo === 0 && this.player.reserveAmmo === 0) {
                        hud.ammoCurrent.textContent = 0;
                        hud.ammoMax.textContent = '/ 0';
                    } else {
                        hud.ammoCurrent.textContent = weapon.currentAmmo;
                        if (weapon.maxAmmo > 0) {
                            hud.ammoMax.textContent = `/ ${this.player.reserveAmmo}`;
                        } else {
                            hud.ammoMax.textContent = '/ INF';
                        }
                    }
                }
                
                this.updatePotionIcons();
            },
            
            updatePotionIcons: function() {
                const now = performance.now();
                const potionStatus = document.getElementById('potion-status');
                potionStatus.innerHTML = '';
                const icons = [
                    ['loot', '$', 'Double loot', 'border-yellow-400 text-yellow-400'],
                    ['fireRate', 'FR', 'Fire rate', 'border-orange-400 text-orange-300'],
                    ['health', 'HP', 'Health boost', 'border-red-500 text-red-500'],
                    ['sprint', 'SP', 'Sprint', 'border-green-400 text-green-300'],
                    ['lifesteal', 'LS', 'Lifesteal', 'border-pink-400 text-pink-300'],
                    ['armor', 'AR', 'Armor', 'border-slate-300 text-slate-200'],
                    ['crit', 'CR', 'Critical chance', 'border-purple-400 text-purple-300'],
                    ['resource', 'RM', 'Resource multiplier', 'border-amber-300 text-amber-200'],
                    ['infiniteAmmo', 'AM', 'Infinite ammo', 'border-blue-300 text-blue-200']
                ];
                for (const [key, label, title, className] of icons) {
                    if (this.activePotions[key] > now) {
                        const timeLeft = Math.ceil((this.activePotions[key] - now) / 1000);
                        potionStatus.innerHTML += `
                            <div class="potion-icon ${className}" title="${title}">
                                ${label} <span class="text-sm ml-1">${timeLeft}s</span>
                            </div>
                        `;
                    }
                }
                return;
                
                if (this.activePotions.loot > 0) {
                    const timeLeft = Math.ceil((this.activePotions.loot - now) / 1000);
                    potionStatus.innerHTML += `
                        <div class="potion-icon border-yellow-400 text-yellow-400" title="2x Loot">
                            $ <span class="text-sm ml-1">${timeLeft}s</span>
                        </div>
                    `;
                }
                if (this.activePotions.fireRate > 0) {
                    const timeLeft = Math.ceil((this.activePotions.fireRate - now) / 1000);
                    potionStatus.innerHTML += `
                        <div class="potion-icon border-orange-400 text-orange-300" title="2x Fire Rate">
                            FR <span class="text-sm ml-1">${timeLeft}s</span>
                        </div>
                    `;
                }
                if (this.activePotions.health > 0) {
                    const timeLeft = Math.ceil((this.activePotions.health - now) / 1000);
                    potionStatus.innerHTML += `
                        <div class="potion-icon border-red-500 text-red-500" title="2x Health">
                            + <span class="text-sm ml-1">${timeLeft}s</span>
                        </div>
                    `;
                }
            },
            
            updateWeaponUI: function() {
                hud.weaponList.innerHTML = '';
                this.weapons.forEach((w, i) => {
                    const el = document.createElement('div');
                    el.className = `w-10 h-10 rounded border-2 flex items-center justify-center font-bold
                                ${i === this.selectedWeapon ? 'bg-orange-600 border-orange-400' : 'bg-gray-700 border-gray-500'}
                                ${w.owned ? 'text-white' : 'text-gray-500'}`;
                    el.textContent = `${i + 1}`;
                    hud.weaponList.appendChild(el);
                });
            },
            
            // --- DRAW FUNCTIONS ---
            
            draw: function() {
                ctx.save();
                ctx.translate(-this.camera.x + this.camera.shake, -this.camera.y + this.camera.shake);
                
                this.drawMap();
                if (this.drawWorldStructures) this.drawWorldStructures();
                this.drawTraps(); 
                if (this.drawBuildings) this.drawBuildings();
                this.drawWalls();
                this.drawAcidPools();
                this.drawDrops();
                this.drawZombies();
                this.drawSentries();
                this.drawBullets();
                this.drawExplosions();
                this.drawParticles();
                this.drawEmpPulses(); 
                this.drawHealParticles(); 
                if (this.drawRemotePlayers) this.drawRemotePlayers();
                this.drawPlayer();
                if (this.drawWorldStructureRoofs) this.drawWorldStructureRoofs();
                
                if (this.placingSentry) this.drawSentryPreview();
                if (this.placingWall) this.drawWallPreview();
                if (this.placingTrap) this.drawTrapPreview(); 
                if (this.placingBuilding && this.drawBuildingPreview) this.drawBuildingPreview();
                
                ctx.restore();
                if (this.drawDayNight) this.drawDayNight();
                if (this.drawNavigationHud) this.drawNavigationHud();
            },

            drawMap: function() {
                ctx.fillStyle = '#1A1A1A';
                ctx.fillRect(this.camera.x - 120, this.camera.y - 120, canvas.width + 240, canvas.height + 240);
                
                ctx.strokeStyle = '#2A2A2A';
                ctx.lineWidth = 1;
                ctx.beginPath();
                const left = Math.floor((this.camera.x - 120) / 100) * 100;
                const top = Math.floor((this.camera.y - 120) / 100) * 100;
                const right = this.camera.x + canvas.width + 120;
                const bottom = this.camera.y + canvas.height + 120;
                for (let x = left; x <= right; x += 100) {
                    ctx.moveTo(x, top);
                    ctx.lineTo(x, bottom);
                }
                for (let y = top; y <= bottom; y += 100) {
                    ctx.moveTo(left, y);
                    ctx.lineTo(right, y);
                }
                ctx.stroke();

                if (this.drawCityTerrain) this.drawCityTerrain();
                
                this.drawShopBuilding();
                this.drawWorkbenchStation();
                this.drawPreparationEvent();
            },
            
            drawPlayer: function() {
                ctx.save(); 
                ctx.translate(this.player.x, this.player.y);

                ctx.fillStyle = '#3182CE';
                ctx.beginPath();
                ctx.arc(0, 0, 10, 0, Math.PI * 2); 
                ctx.fill();
                
                ctx.rotate(this.player.angle);
                ctx.fillStyle = '#4169E1';
                ctx.fillRect(-10, -12, 20, 24); 
                
                ctx.fillStyle = '#666';
                ctx.fillRect(10, -3, 15, 6); 
                
                ctx.restore(); 
            },
            
            drawZombies: function() {
                if (this.drawDetailedZombies) {
                    this.drawDetailedZombies();
                    return;
                }
                for (const z of this.zombies) {
                    const color = `rgb(${z.color[0]}, ${z.color[1]}, ${z.color[2]})`;
                    const darkColor = `rgb(${z.color[0]*0.7}, ${z.color[1]*0.7}, ${z.color[2]*0.7})`;
                    
                    ctx.save();
                    ctx.translate(z.x, z.y);
                    
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(0, 0, z.size, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.fillStyle = darkColor;
                    ctx.beginPath();
                    ctx.arc(0, 0, z.size * 0.7, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'white';
                    ctx.font = `${z.size}px "Chakra Petch"`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    let icon = '';
                    if (z.type === 'fast') icon = '>';
                    else if (z.type === 'tank') icon = '■';
                    else if (z.type === 'spitter') icon = '⸺';
                    else if (z.type === 'thrower') icon = '⊛';
                    else if (z.type === 'boss') icon = '☠';
                    else if (z.isSapper) icon = '💥'; 
                    else if (z.isDisruptor) icon = '↯'; 
                    else if (z.isHealer) icon = '+'; 
                    if (icon) ctx.fillText(icon, 0, 0);

                    if (['runner', 'armored', 'bomber', 'shield', 'acidRanger', 'miniBoss', 'boss'].includes(z.type)) {
                        const labels = { runner: 'R', armored: 'A', bomber: 'B', shield: 'S', acidRanger: 'X', miniBoss: 'M', boss: '!' };
                        ctx.fillText(labels[z.type], 0, 0);
                    }
                    
                    const barWidth = z.size * 2;
                    const y = -z.size - 10;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(-barWidth / 2, y, barWidth, 5);
                    
                    const hpPercent = z.health / z.maxHealth;
                    ctx.fillStyle = hpPercent > 0.5 ? '#22C55E' : hpPercent > 0.25 ? '#F97316' : '#EF4444';
                    ctx.fillRect(-barWidth / 2, y, barWidth * hpPercent, 5);

                    if (z.maxShieldHealth) {
                        const shieldPercent = Math.max(0, z.shieldHealth) / z.maxShieldHealth;
                        ctx.fillStyle = '#172554';
                        ctx.fillRect(-barWidth / 2, y - 5, barWidth, 3);
                        ctx.fillStyle = '#38bdf8';
                        ctx.fillRect(-barWidth / 2, y - 5, barWidth * shieldPercent, 3);
                    }
                    
                    ctx.restore();
                }
            },
            
            drawSentries: function() {
                const now = performance.now();
                for (const s of this.sentries) {
                    if (this.isOnScreen && !this.isOnScreen(s.x, s.y, s.range + 40)) continue;
                    const color = `rgb(${s.color[0]}, ${s.color[1]}, ${s.color[2]})`;
                    const darkColor = `rgb(${s.color[0]*0.7}, ${s.color[1]*0.7}, ${s.color[2]*0.7})`;
                    
                    ctx.save();
                    ctx.translate(s.x, s.y);
                    
                    if (s.isDisabled > now) {
                        ctx.fillStyle = '#555'; 
                    } else {
                        ctx.fillStyle = darkColor;
                    }
                    ctx.beginPath();
                    ctx.arc(0, 0, s.radius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.rotate(s.angle);
                    ctx.fillStyle = (s.isDisabled > now) ? '#888' : color;
                    ctx.fillRect(0, -5, 20, 10);
                    
                    ctx.restore();
                    
                    const hpPercent = s.health / s.maxHealth;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(s.x - s.radius, s.y - 30, s.radius * 2, 4);
                    ctx.fillStyle = hpPercent > 0.5 ? '#22C55E' : hpPercent > 0.25 ? '#F97316' : '#EF4444';
                    ctx.fillRect(s.x - s.radius, s.y - 30, s.radius * 2 * hpPercent, 4);

                    const ammoPercent = s.ammo / s.maxAmmo;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(s.x - s.radius, s.y - 25, s.radius * 2, 4);
                    ctx.fillStyle = '#3B82F6';
                    ctx.fillRect(s.x - s.radius, s.y - 25, s.radius * 2 * ammoPercent, 4);
                    
                    ctx.fillStyle = 'white';
                    ctx.font = '10px "Chakra Petch"';
                    ctx.textAlign = 'center';
                    ctx.fillText(s.ammo, s.x, s.y - 35); 
                    ctx.fillStyle = '#fb923c';
                    ctx.fillText(s.ownerName || 'P1', s.x, s.y + s.radius + 13);

                    if (s.ammo < s.maxAmmo && this.dist(this.player.x, this.player.y, s.x, s.y) < 50) {
                        const canRefill = this.player.wood >= 1 && this.player.metal >= 1;
                        ctx.fillStyle = canRefill ? 'white' : '#777'; 
                        ctx.font = '16px "Chakra Petch"';
                        ctx.fillText("[G] Refill (1W, 1M)", s.x, s.y - 45);
                    }

                    if (this.dist(this.mouse.worldX, this.mouse.worldY, s.x, s.y) < 80) {
                        ctx.strokeStyle = `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, 0.3)`;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(s.x, s.y, s.range, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            },
            
            drawWalls: function() {
                for (const w of this.walls) {
                    if (this.isOnScreen && !this.isOnScreen(w.x, w.y, w.radius + 80)) continue;
                    const color = `rgb(${w.color[0]}, ${w.color[1]}, ${w.color[2]})`;
                    const darkColor = `rgb(${w.color[0]*0.8}, ${w.color[1]*0.8}, ${w.color[2]*0.8})`;
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(w.x - w.radius, w.y - w.radius, w.radius * 2, w.radius * 2);
                    ctx.strokeStyle = darkColor;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(w.x - w.radius, w.y - w.radius, w.radius * 2, w.radius * 2);

                    if (w.isElectric && Math.random() < 0.1) {
                        ctx.fillStyle = "white";
                        ctx.beginPath();
                        ctx.moveTo(w.x - w.radius, w.y - w.radius + (Math.random() * w.radius * 2));
                        ctx.lineTo(w.x + w.radius, w.y - w.radius + (Math.random() * w.radius * 2));
                        ctx.stroke();
                    }

                    if (w.isWorkbench) {
                        ctx.fillStyle = '#FFF';
                        ctx.font = '12px "Chakra Petch"';
                        ctx.textAlign = 'center';
                        ctx.fillText('W', w.x, w.y - 5);
                        ctx.fillText('B', w.x, w.y + 10);
                        
                        if (this.isNearWorkbench()) {
                            ctx.fillStyle = 'white';
                            ctx.font = '16px "Chakra Petch"';
                            ctx.fillText("[E]", w.x, w.y - 45);
                        }
                    }
                    
                    const hpPercent = w.health / w.maxHealth;
                    ctx.fillStyle = '#333';
                    ctx.fillRect(w.x - w.radius, w.y - 35, w.radius * 2, 5);
                    ctx.fillStyle = hpPercent > 0.5 ? '#22C55E' : hpPercent > 0.25 ? '#F97316' : '#EF4444';
                    ctx.fillRect(w.x - w.radius, w.y - 35, w.radius * 2 * hpPercent, 5);
                    ctx.fillStyle = '#fb923c';
                    ctx.font = '10px "Chakra Petch"';
                    ctx.textAlign = 'center';
                    ctx.fillText(w.ownerName || 'P1', w.x, w.y + w.radius + 13);
                }
            },

            drawTraps: function() { 
                for (const t of this.traps) {
                    if (this.isOnScreen && !this.isOnScreen(t.x, t.y, t.radius + 80)) continue;
                    ctx.fillStyle = `rgba(${t.color[0]}, ${t.color[1]}, ${t.color[2]}, 0.5)`;
                    ctx.strokeStyle = `rgb(${t.color[0]}, ${t.color[1]}, ${t.color[2]})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = `rgb(${t.color[0]}, ${t.color[1]}, ${t.color[2]})`;
                    for(let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                        ctx.beginPath();
                        ctx.moveTo(t.x, t.y);
                        ctx.lineTo(t.x + Math.cos(a) * t.radius * 0.7, t.y + Math.sin(a) * t.radius * 0.7);
                        ctx.stroke();
                    }
                }
            },

            drawBullets: function() {
                for (const b of this.bullets) {
                    if (this.isOnScreen && !this.isOnScreen(b.x, b.y, 80)) continue;
                    if (b.acid) { 
                        ctx.fillStyle = '#96F93C';
                        ctx.shadowColor = 'white';
                        ctx.shadowBlur = 15;
                    } else if (b.spitter) { 
                        ctx.fillStyle = '#96F93C'; 
                        ctx.shadowColor = '#96F93C'; 
                        ctx.shadowBlur = 8;
                    } else if (b.explosive) {
                        ctx.fillStyle = '#F97316';
                        ctx.shadowColor = '#F97316';
                        ctx.shadowBlur = 8;
                    } else {
                        ctx.fillStyle = '#FDE047';
                        ctx.shadowColor = '#FDE047';
                        ctx.shadowBlur = 8;
                    }
                    const size = b.size || 4;
                    
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, size, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.shadowBlur = 0;
                }
            },

            drawExplosions: function() {
                for (const e of this.explosions) {
                    const alpha = 1 - e.radius / e.maxRadius;
                    ctx.strokeStyle = `rgba(255, 102, 0, ${alpha})`;
                    ctx.fillStyle = `rgba(255, 165, 0, ${alpha * 0.5})`;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            },
            
            drawParticles: function() {
                for (const p of this.particles) {
                    const alpha = p.life / 30;
                    ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${alpha})`;
                    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
                }
            },

            drawEmpPulses: function() { 
                for(const p of this.empPulses) {
                    const alpha = p.life / 30;
                    ctx.strokeStyle = `rgba(0, 200, 255, ${alpha})`;
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.currentRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            },

            drawHealParticles: function() { 
                for(const p of this.healParticles) {
                    const alpha = p.life / 30;
                    ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
                    ctx.font = '12px "Chakra Petch"';
                    ctx.fillText('+', p.x, p.y);
                }
            },
            
            drawAcidPools: function() {
                for (const pool of this.acidPools) {
                    const alpha = (pool.life / 180) * 0.5;
                    ctx.fillStyle = `rgba(150, 255, 50, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(pool.x, pool.y, pool.radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            },

            drawDrops: function() {
                for (const drop of this.drops) {
                    if (this.isOnScreen && !this.isOnScreen(drop.x, drop.y, 90)) continue;
                    const pulse = Math.sin(performance.now() * 0.005) * 3;
                    let color = 'white';
                    
                    if (drop.type === 'ammo') color = '#FDE047';
                    else if (drop.type === 'wood') color = '#A16207';
                    else if (drop.type === 'metal') color = '#94A3B8';
                    else if (drop.type === 'money') color = '#22C55E';
                    else if (drop.type === 'medkit') color = '#EF4444';
                    
                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10;
                    ctx.fillRect(drop.x - 6 - pulse/2, drop.y - 6 - pulse/2, 12 + pulse, 12 + pulse);
                    ctx.shadowBlur = 0;
                    
                    ctx.fillStyle = 'white';
                    ctx.font = '10px "Chakra Petch"';
                    ctx.textAlign = 'center';
                    ctx.fillText(drop.type.toUpperCase(), drop.x, drop.y + 15);
                }
            },
            
            drawSentryPreview: function() {
                const s = this.placingSentry;
                const valid = this.getPlacementValidation ? this.getPlacementValidation('turret', s, this.mouse.worldX, this.mouse.worldY).ok : true;
                ctx.fillStyle = valid ? `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, 0.5)` : 'rgba(239, 68, 68, 0.5)';
                ctx.beginPath();
                ctx.arc(this.mouse.worldX, this.mouse.worldY, s.radius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = valid ? `rgba(${s.color[0]}, ${s.color[1]}, ${s.color[2]}, 0.3)` : 'rgba(239, 68, 68, 0.75)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.mouse.worldX, this.mouse.worldY, s.range, 0, Math.PI * 2);
                ctx.stroke();
            },

            drawWallPreview: function() {
                const w = this.placingWall;
                const valid = this.getPlacementValidation ? this.getPlacementValidation('wall', w, this.mouse.worldX, this.mouse.worldY).ok : true;
                ctx.fillStyle = valid ? `rgba(${w.color[0]}, ${w.color[1]}, ${w.color[2]}, 0.5)` : 'rgba(239, 68, 68, 0.5)';
                ctx.strokeStyle = valid ? `rgb(${w.color[0]}, ${w.color[1]}, ${w.color[2]})` : '#ef4444';
                ctx.lineWidth = 2;
                ctx.fillRect(this.mouse.worldX - w.radius, this.mouse.worldY - w.radius, w.radius * 2, w.radius * 2);
                ctx.strokeRect(this.mouse.worldX - w.radius, this.mouse.worldY - w.radius, w.radius * 2, w.radius * 2);
            },

            drawTrapPreview: function() { 
                const t = this.placingTrap;
                const valid = this.getPlacementValidation ? this.getPlacementValidation('trap', t, this.mouse.worldX, this.mouse.worldY).ok : true;
                ctx.fillStyle = valid ? `rgba(${t.color[0]}, ${t.color[1]}, ${t.color[2]}, 0.5)` : 'rgba(239, 68, 68, 0.5)';
                ctx.strokeStyle = valid ? `rgb(${t.color[0]}, ${t.color[1]}, ${t.color[2]})` : '#ef4444';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.mouse.worldX, this.mouse.worldY, t.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            },
            
            // --- ACTION FUNCTIONS ---
            
            shoot: function() {
                const weapon = this.weapons[this.selectedWeapon];
                if (!weapon.owned || weapon.isReloading) return;
                
                if (weapon.currentAmmo <= 0) {
                    this.reloadWeapon();
                    return;
                }
                
                const now = performance.now();
                
                let fireRate = weapon.fireRate;
                if (this.activePotions.fireRate > 0) {
                    fireRate /= 2;
                }
                fireRate *= Math.pow(0.9, this.runUpgradeCounts.rapidFire || 0);
                
                if (now - this.lastShot < fireRate) return;
                
                this.lastShot = now;
                this.playSfx?.('shoot');
                if (!(this.activePotions.infiniteAmmo > performance.now())) {
                    weapon.currentAmmo--;
                }
                
                const angle = this.player.angle;
                this.addCameraShake(weapon.pellets ? 3 : 2);
                if (this.broadcastShotAction) this.broadcastShotAction(weapon, angle);
                if (this.multiplayer?.serverAuthoritative) return;
                
                if (weapon.pellets) {
                    for (let i = 0; i < weapon.pellets; i++) {
                        const spread = (Math.random() - 0.5) * 0.4;
                        this.bullets.push({
                            x: this.player.x + Math.cos(angle) * 15,
                            y: this.player.y + Math.sin(angle) * 15,
                            vx: Math.cos(angle + spread) * weapon.speed,
                            vy: Math.sin(angle + spread) * weapon.speed,
                            damage: this.getPlayerBulletDamage(weapon.damage),
                            explosive: weapon.explosive,
                            pierce: weapon.pierce || 0,
                            size: weapon.bulletSize,
                            ownerId: this.localPlayerId
                        });
                    }
                } else {
                    this.bullets.push({
                        x: this.player.x + Math.cos(angle) * 15,
                        y: this.player.y + Math.sin(angle) * 15,
                        vx: Math.cos(angle) * weapon.speed,
                        vy: Math.sin(angle) * weapon.speed,
                        damage: this.getPlayerBulletDamage(weapon.damage),
                        explosive: weapon.explosive,
                        pierce: weapon.pierce || 0,
                        size: weapon.bulletSize,
                        ownerId: this.localPlayerId
                    });
                }
            },
            
            refillNearbyTurret: function() {
                if (this.player.wood < 1 || this.player.metal < 1) return;

                for (const s of this.sentries) {
                    if (this.dist(this.player.x, this.player.y, s.x, s.y) < 50) {
                        if (s.ammo < s.maxAmmo) {
                            s.ammo = s.maxAmmo;
                            this.player.wood -= 1;
                            this.player.metal -= 1;
                            return;
                        }
                    }
                }
            },

            reloadWeapon: function() {
                const weapon = this.weapons[this.selectedWeapon];
                if (!weapon || weapon.isReloading || weapon.currentAmmo === weapon.maxAmmo) return;
                const reloadDuration = weapon.reloadTime * Math.pow(0.92, this.player.skillLevels.reloadSpeed);
                this.playSfx?.('reload');
                
                if (weapon.ammoCost) {
                    if (this.player.reserveAmmo < weapon.ammoCost) return;
                    
                    weapon.isReloading = true;
                    setTimeout(() => {
                        weapon.currentAmmo = weapon.maxAmmo;
                        this.player.reserveAmmo -= weapon.ammoCost;
                        weapon.isReloading = false;
                        this.updateHUD();
                    }, reloadDuration);
                    return;
                }
                
                const ammoNeeded = weapon.maxAmmo - weapon.currentAmmo;
                if (ammoNeeded <= 0 || this.player.reserveAmmo <= 0) return;

                const ammoToReload = Math.min(ammoNeeded, this.player.reserveAmmo);
                
                weapon.isReloading = true;
                setTimeout(() => {
                    weapon.currentAmmo += ammoToReload;
                    this.player.reserveAmmo -= ammoToReload;
                    weapon.isReloading = false;
                }, reloadDuration);
            },
            
            selectWeapon: function(index) {
                if (index < 0 || index >= this.weapons.length) return;
                
                if (this.shopOpen) {
                    this.buyWeapon(index);
                } else if (this.weapons[index].owned) {
                    this.selectedWeapon = index;
                    this.updateWeaponUI();
                }
            },
            
            // --- UI Functions ---
            
            populateShop: function() {
                shopContent.innerHTML = this.getAmmoStoreHtml ? this.getAmmoStoreHtml('shop') : '';
                const weaponHeader = document.createElement('h2');
                weaponHeader.className = 'shop-section';
                weaponHeader.textContent = 'WEAPON COUNTER';
                shopContent.appendChild(weaponHeader);
                
                this.weapons.forEach((w, i) => {
                    const canAfford = this.player.money >= w.cost;
                    const item = document.createElement('div');
                    item.className = `shop-weapon-card ${w.owned ? 'owned' : ''}`;
                    item.innerHTML = `
                        <div class="weapon-silhouette"><span>${i + 1}</span><i></i></div>
                        <div class="shop-weapon-copy">
                            <span class="window-kicker">${w.explosive ? 'HEAVY ORDNANCE' : i < 2 ? 'AISLE SECURITY' : 'SURVIVOR ARMORY'}</span>
                            <h3>${w.name}</h3>
                            <div class="weapon-stat-strip">
                                <span>DMG <b>${w.damage}${w.pellets ? ' x' + w.pellets : ''}</b></span>
                                <span>CYCLING <b>${w.fireRate}ms</b></span>
                                <span>MAG <b>${w.maxAmmo}</b></span>
                                <span>RELOAD <b>${w.reloadTime/1000}s</b></span>
                            </div>
                        </div>
                        ${w.owned ? 
                            '<span class="stock-stamp">IN LOCKER</span>' :
                            `<button class="btn ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.buyWeapon(${i})">
                                CLAIM<br><small>$${w.cost}</small>
                            </button>`
                        }
                    `;
                    shopContent.appendChild(item);
                });
            },
            
            closeShop: function() {
                this.toggleShop(false);
            },

            buyWeapon: function(index) {
                let weapon = this.weapons[index];
                if (!weapon) return;

                if (weapon.owned || this.player.money < weapon.cost) return;
                
                this.player.money -= weapon.cost;
                this.playSfx?.('buy');
                weapon.owned = true;
                weapon.currentAmmo = weapon.maxAmmo;
                
                if (weapon.ammoCost) {
                    this.player.reserveAmmo += weapon.ammoCost;
                } else {
                    this.player.reserveAmmo += weapon.maxAmmo * 2; 
                }
                
                this.populateShop();
                this.updateWeaponUI();
            },
            
            toggleShop: function(isOpen) {
                if (isOpen && this.preparationActive && this.trader) {
                    this.toggleTrader(true);
                    return;
                }
                this.shopOpen = isOpen;
                this.playSfx?.('menu');
                if (isOpen) {
                    this.populateShop();
                    shopModal.classList.remove('hidden');
                    shopModal.classList.add('flex');
                } else {
                    shopModal.classList.add('hidden');
                    shopModal.classList.remove('flex');
                }
            },
            
            toggleCrafting: function(isOpen) {
                this.craftingOpen = isOpen;
                if (isOpen) {
                    this.populateCraftingMenu();
                    craftingModal.classList.remove('hidden');
                    craftingModal.classList.add('flex');
                } else {
                    craftingModal.classList.add('hidden');
                    craftingModal.classList.remove('flex');
                }
            },
            
            populateCraftingMenu: function() {
                craftingContent.innerHTML = '';
                
                let turretHeader = document.createElement('h2');
                turretHeader.className = 'text-2xl font-bold text-orange-400 border-b border-gray-700 pb-2 mb-4';
                turretHeader.textContent = 'BASIC DEFENSES';
                craftingContent.appendChild(turretHeader);
                
                this.sentryTypes.forEach((s, i) => {
                    const canAfford = this.player.wood >= s.cost.wood && this.player.metal >= s.cost.metal;
                    const item = document.createElement('div');
                    item.className = 'p-4 rounded-lg flex items-center justify-between bg-gray-800 border border-gray-700';
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold" style="color:rgb(${s.color[0]},${s.color[1]},${s.color[2]})">${s.name}</h3>
                            <p class="text-sm text-gray-400">
                                Damage: ${s.damage}${s.pellets ? 'x' + s.pellets : ''} | 
                                Range: ${s.range} | 
                                Rate: ${s.fireRate}ms |
                                Health: ${s.health} |
                                Ammo: ${s.maxAmmo}
                            </p>
                        </div>
                        <div class="text-right">
                            <div class="font-semibold ${this.player.wood >= s.cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${s.cost.wood}</div>
                            <div class="font-semibold ${this.player.metal >= s.cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${s.cost.metal}</div>
                            <button class="btn text-sm py-2 mt-2 ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.startPlacingSentry(${i})">
                                CRAFT
                            </button>
                        </div>
                    `;
                    craftingContent.appendChild(item);
                });
                
                let wallHeader = document.createElement('h2');
                wallHeader.className = 'text-2xl font-bold text-orange-400 border-b border-gray-700 pb-2 mb-4 mt-6';
                wallHeader.textContent = 'BASIC STRUCTURES';
                craftingContent.appendChild(wallHeader);
                
                this.basicWallTypes.forEach((w, i) => { 
                    const cost = w.cost;
                    const hasWood = cost.wood ? this.player.wood >= cost.wood : true;
                    const hasMetal = cost.metal ? this.player.metal >= cost.metal : true;
                    const canAfford = hasWood && hasMetal;
                    
                    let costText = '';
                    if (cost.wood) costText += `<div class="font-semibold ${this.player.wood >= cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${cost.wood}</div>`;
                    if (cost.metal) costText += `<div class="font-semibold ${this.player.metal >= cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${cost.metal}</div>`;

                    const item = document.createElement('div');
                    item.className = 'p-4 rounded-lg flex items-center justify-between bg-gray-800 border border-gray-700';
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold" style="color:rgb(${w.color[0]},${w.color[1]},${w.color[2]})">${w.name}</h3>
                            <p class="text-sm text-gray-400">
                                Health: ${w.health}
                                ${w.isWorkbench ? '| <span class="font-bold text-yellow-400">Unlocks T2 Crafting</span>' : ''}
                            </p>
                        </div>
                        <div class="text-right">
                            ${costText}
                            <button class="btn text-sm py-2 mt-2 ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.startPlacingWall(${i})">
                                CRAFT
                            </button>
                        </div>
                    `;
                    craftingContent.appendChild(item);
                });
            },
            
            toggleWorkbench: function(isOpen) {
                this.workbenchOpen = isOpen;
                if (isOpen) {
                    this.populateWorkbench();
                    workbenchModal.classList.remove('hidden');
                    workbenchModal.classList.add('flex');
                } else {
                    workbenchModal.classList.add('hidden');
                    workbenchModal.classList.remove('flex');
                }
            },

            closeWorkbench: function() {
                this.toggleWorkbench(false);
            },

            populateWorkbench: function() {
                workbenchContent.innerHTML = '';
                
                // --- 1. ADVANCED DEFENSES ---
                let advancedHeader = document.createElement('h2');
                advancedHeader.className = 'text-2xl font-bold text-yellow-400 border-b border-gray-700 pb-2 mb-4';
                advancedHeader.textContent = 'ADVANCED DEFENSES';
                workbenchContent.appendChild(advancedHeader);

                this.advancedWallTypes.forEach((w, i) => {
                    const cost = w.cost;
                    const hasWood = cost.wood ? this.player.wood >= cost.wood : true;
                    const hasMetal = cost.metal ? this.player.metal >= cost.metal : true;
                    const canAfford = hasWood && hasMetal;
                    
                    let costText = '';
                    if (cost.wood) costText += `<div class="font-semibold ${this.player.wood >= cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${cost.wood}</div>`;
                    if (cost.metal) costText += `<div class="font-semibold ${this.player.metal >= cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${cost.metal}</div>`;

                    const item = document.createElement('div');
                    item.className = 'p-4 rounded-lg flex items-center justify-between bg-gray-800 border border-gray-700';
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold" style="color:rgb(${w.color[0]},${w.color[1]},${w.color[2]})">${w.name}</h3>
                            <p class="text-sm text-gray-400">
                                Health: ${w.health}
                                ${w.isElectric ? '| <span class="font-bold text-orange-400">Shocks Attackers</span>' : ''}
                            </p>
                        </div>
                        <div class="text-right">
                            ${costText}
                            <button class="btn text-sm py-2 mt-2 ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.startPlacingAdvancedWall(${i})">
                                CRAFT
                            </button>
                        </div>
                    `;
                    workbenchContent.appendChild(item);
                });

                this.trapTypes.forEach((t, i) => {
                    const canAfford = this.player.wood >= t.cost.wood && this.player.metal >= t.cost.metal;
                    const item = document.createElement('div');
                    item.className = 'p-4 rounded-lg flex items-center justify-between bg-gray-800 border border-gray-700';
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold" style="color:rgb(${t.color[0]},${t.color[1]},${t.color[2]})">${t.name}</h3>
                            <p class="text-sm text-gray-400">
                                Damage: ${t.damage} | <span class="font-bold text-red-500">One Time Use</span>
                            </p>
                        </div>
                        <div class="text-right">
                            <div class="font-semibold ${this.player.wood >= t.cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${t.cost.wood}</div>
                            <div class="font-semibold ${this.player.metal >= t.cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${t.cost.metal}</div>
                            <button class="btn text-sm py-2 mt-2 ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.startPlacingTrap(${i})">
                                CRAFT
                            </button>
                        </div>
                    `;
                    workbenchContent.appendChild(item);
                });


                // --- 2. PERMANENT UPGRADES ---
                let upgradeHeader = document.createElement('h2');
                upgradeHeader.className = 'text-2xl font-bold text-yellow-400 border-b border-gray-700 pb-2 mb-4 mt-8';
                upgradeHeader.textContent = 'PERMANENT UPGRADES';
                workbenchContent.appendChild(upgradeHeader);

                this.workbenchUpgrades.forEach(upg => {
                    const isOwned = this.upgrades[upg.id];
                    const canAfford = this.player.money >= upg.cost.money && this.player.wood >= upg.cost.wood && this.player.metal >= upg.cost.metal;
                    
                    const item = document.createElement('div');
                    item.className = `p-4 rounded-lg flex items-center justify-between ${isOwned ? 'bg-gray-700' : 'bg-gray-800 border border-gray-700'}`;
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold ${isOwned ? 'text-green-400' : 'text-yellow-400'}">${upg.name}</h3>
                            <p class="text-sm text-gray-400">${upg.description}</p>
                        </div>
                        <div class="text-right flex-shrink-0 w-1/3">
                            ${isOwned ? 
                                '<span class="text-2xl font-bold text-green-500">OWNED</span>' :
                                `
                                <div class="font-semibold ${this.player.money >= upg.cost.money ? 'text-green-400' : 'text-red-400'}">$: ${upg.cost.money}</div>
                                <div class="font-semibold ${this.player.wood >= upg.cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${upg.cost.wood}</div>
                                <div class="font-semibold ${this.player.metal >= upg.cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${upg.cost.metal}</div>
                                <button class="btn text-sm py-2 mt-2 ${canAfford ? 'btn-success' : 'btn-danger opacity-50'}" ${!canAfford ? 'disabled' : ''} onclick="game.buyUpgrade('${upg.id}')">
                                    BUY
                                </button>
                                `
                            }
                        </div>
                    `;
                    workbenchContent.appendChild(item);
                });
                
                // --- 3. CONSUMABLE POTIONS ---
                let potionHeader = document.createElement('h2');
                potionHeader.className = 'text-2xl font-bold text-purple-400 border-b border-gray-700 pb-2 mb-4 mt-6';
                potionHeader.textContent = 'CONSUMABLE POTIONS';
                workbenchContent.appendChild(potionHeader);

                this.potions.forEach(pot => {
                    const canAfford = this.player.money >= pot.cost.money && this.player.wood >= pot.cost.wood && this.player.metal >= pot.cost.metal;
                    const isHealthPotion = pot.type === 'health';
                    const isHealthActive = this.activePotions.health > 0;
                    
                    const cantBuy = !canAfford || (isHealthPotion && isHealthActive);
                    let buttonText = 'BUY';
                    if (isHealthPotion && isHealthActive) {
                        buttonText = 'ACTIVE';
                    }
                    
                    const item = document.createElement('div');
                    item.className = 'p-4 rounded-lg flex items-center justify-between bg-gray-800 border border-gray-700';
                    item.innerHTML = `
                        <div>
                            <h3 class="text-xl font-bold text-purple-300">${pot.name}</h3>
                            <p class="text-sm text-gray-400">Effect: 2x ${pot.type} for ${pot.duration / 1000} seconds.</p>
                        </div>
                        <div class="text-right flex-shrink-0 w-1/3">
                            <div class="font-semibold ${this.player.money >= pot.cost.money ? 'text-green-400' : 'text-red-400'}">$: ${pot.cost.money}</div>
                            <div class="font-semibold ${this.player.wood >= pot.cost.wood ? 'text-green-400' : 'text-red-400'}">Wood: ${pot.cost.wood}</div>
                            <div class="font-semibold ${this.player.metal >= pot.cost.metal ? 'text-green-400' : 'text-red-400'}">Metal: ${pot.cost.metal}</div>
                            <button class="btn text-sm py-2 mt-2 ${!cantBuy ? 'btn-success' : 'btn-danger opacity-50'}" ${cantBuy ? 'disabled' : ''} onclick="game.buyPotion('${pot.id}')">
                                ${buttonText}
                            </button>
                        </div>
                    `;
                    workbenchContent.appendChild(item);
                });
            },

            buyUpgrade: function(id) {
                if (this.upgrades[id]) return;

                const upgrade = this.workbenchUpgrades.find(u => u.id === id);
                if (!upgrade) return;
                
                const cost = upgrade.cost;
                if (this.player.money >= cost.money && this.player.wood >= cost.wood && this.player.metal >= cost.metal) {
                    this.player.money -= cost.money;
                    this.player.wood -= cost.wood;
                    this.player.metal -= cost.metal;
                    this.upgrades[id] = true;
                    this.populateWorkbench();
                }
            },
            
            buyPotion: function(id) {
                const potion = this.potions.find(p => p.id === id);
                if (!potion) return;

                const cost = potion.cost;
                if (this.player.money < cost.money || this.player.wood < cost.wood || this.player.metal < cost.metal) {
                    return;
                }

                if (potion.type === 'health' && this.activePotions.health > 0) {
                    return;
                }

                this.player.money -= cost.money;
                this.player.wood -= cost.wood;
                this.player.metal -= cost.metal;

                const now = performance.now();
                this.activePotions[potion.type] = now + potion.duration;

                if (potion.type === 'health') {
                    if (this.player.maxHealth === this.player.baseMaxHealth) {
                        this.player.maxHealth *= potion.multiplier;
                        this.player.health *= potion.multiplier;
                    } else {
                        this.player.health = this.player.maxHealth;
                    }
                }
                
                this.populateWorkbench();
            },

            startPlacingSentry: function(index) {
                const sentry = this.sentryTypes[index];
                if (this.player.wood >= sentry.cost.wood && this.player.metal >= sentry.cost.metal) {
                    this.player.wood -= sentry.cost.wood;
                    this.player.metal -= sentry.cost.metal;
                    this.placingSentry = { ...sentry, angle: 0, lastShot: 0, isDisabled: 0 }; 
                    this.toggleCrafting(false);
                    placingItemText.textContent = `Placing ${sentry.name}...`;
                    placingItemHint.classList.remove('hidden');
                }
            },
            
            placeSentry: function() {
                this.sentries.push({
                    ...this.placingSentry,
                    x: this.mouse.worldX,
                    y: this.mouse.worldY,
                });
                this.placingSentry = null;
                placingItemHint.classList.add('hidden');
            },
            
            startPlacingWall: function(index) {
                const wall = this.basicWallTypes[index]; 
                const cost = wall.cost;
                if ((cost.wood && this.player.wood >= cost.wood) || (cost.metal && this.player.metal >= cost.metal)) {
                    if (cost.wood) this.player.wood -= cost.wood;
                    if (cost.metal) this.player.metal -= cost.metal;
                    this.placingWall = { ...wall };
                    this.toggleCrafting(false);
                    placingItemText.textContent = `Placing ${wall.name}...`;
                    placingItemHint.classList.remove('hidden');
                }
            },

            startPlacingAdvancedWall: function(index) {
                const wall = this.advancedWallTypes[index]; 
                const cost = wall.cost;
                if ((cost.wood && this.player.wood >= cost.wood) || (cost.metal && this.player.metal >= cost.metal)) {
                    if (cost.wood) this.player.wood -= cost.wood;
                    if (cost.metal) this.player.metal -= cost.metal;
                    this.placingWall = { ...wall }; 
                    this.toggleWorkbench(false);
                    placingItemText.textContent = `Placing ${wall.name}...`;
                    placingItemHint.classList.remove('hidden');
                }
            },
            
            placeWall: function() {
                this.walls.push({
                    ...this.placingWall,
                    x: this.mouse.worldX,
                    y: this.mouse.worldY,
                });
                this.placingWall = null;
                placingItemHint.classList.add('hidden');
            },
            
            startPlacingTrap: function(index) { 
                const trap = this.trapTypes[index];
                const cost = trap.cost;
                if (this.player.wood >= cost.wood && this.player.metal >= cost.metal) {
                    this.player.wood -= cost.wood;
                    this.player.metal -= cost.metal;
                    this.placingTrap = { ...trap };
                    this.toggleWorkbench(false); 
                    placingItemText.textContent = `Placing ${trap.name}...`;
                    placingItemHint.classList.remove('hidden');
                }
            },

            placeTrap: function() { 
                this.traps.push({
                    ...this.placingTrap,
                    x: this.mouse.worldX,
                    y: this.mouse.worldY,
                    ownerId: 'p1',
                    ownerName: 'P1'
                });
                if (this.recordBuild) this.recordBuild();
                this.placingTrap = null;
                placingItemHint.classList.add('hidden');
            },

            isNearShop: function() {
                return this.dist(this.player.x, this.player.y, this.shop.x, this.shop.y) < 120;
            },

            isNearWorkbench: function() {
                for (const w of this.walls) {
                    if (w.isWorkbench && this.dist(this.player.x, this.player.y, w.x, w.y) < 60) {
                        return true;
                    }
                }
                return false;
            },
            
            cancelPlacing: function() {
                if (this.placingSentry) {
                    this.player.wood += this.placingSentry.cost.wood;
                    this.player.metal += this.placingSentry.cost.metal;
                    this.placingSentry = null;
                }
                if (this.placingWall) {
                    if (this.placingWall.cost.wood) this.player.wood += this.placingWall.cost.wood;
                    if (this.placingWall.cost.metal) this.player.metal += this.placingWall.cost.metal;
                    this.placingWall = null;
                }
                if (this.placingTrap) { 
                    this.player.wood += this.placingTrap.cost.wood;
                    this.player.metal += this.placingTrap.cost.metal;
                    this.placingTrap = null;
                }
                placingItemHint.classList.add('hidden');
            },

            hideIntermissionTimer: function() {
                intermissionTimer.classList.add('hidden');
                hud.waveInfoContainer.classList.remove('hidden'); // --- SHOW WAVE INFO ---
                if (this.intermissionTimerInterval) {
                    clearInterval(this.intermissionTimerInterval);
                    this.intermissionTimerInterval = null;
                }
            },

            // --- Spawning Functions ---
            spawnZombie: function() {
                const gate = this.spawnGates[Math.floor(Math.random() * this.spawnGates.length)];
                let typeKey = 'normal';
                const rand = Math.random();
                
                if (this.wave % 10 === 0) {
                    // BOSS WAVE SPAWNING
                    if (this.bossesToSpawn > 0) {
                        typeKey = 'boss';
                        this.bossesToSpawn--; 
                    } else {
                        typeKey = rand < 0.5 ? 'fast' : 'normal'; 
                    }
                } else {
                    // NORMAL WAVE SPAWNING
                    if (this.wave < 5) {
                        if (rand < 0.2) typeKey = 'fast';
                        else typeKey = 'normal';
                    } else if (this.wave < 8) {
                        if (rand < 0.3) typeKey = 'fast';
                        else if (rand < 0.5) typeKey = 'spitter'; 
                        else if (rand < 0.7) typeKey = 'thrower'; 
                        else typeKey = 'normal';
                    } else { // Wave 8+ introduces new threats
                        if (rand < 0.1) typeKey = 'sapper'; 
                        else if (rand < 0.2) typeKey = 'disruptor'; 
                        else if (rand < 0.3) typeKey = 'healer'; 
                        else if (rand < 0.4) typeKey = 'tank';
                        else if (rand < 0.55) typeKey = 'fast';
                        else if (rand < 0.7) typeKey = 'spitter'; 
                        else if (rand < 0.85) typeKey = 'thrower'; 
                        else typeKey = 'normal';
                    }
                }
                
                const type = this.zombieTypes[typeKey];
                const health = type.health + (type.health * this.wave * 0.15);
                const reward = type.reward * (1 + Math.floor(this.wave / 10) * 0.25);
                
                this.zombies.push({
                    ...type,
                    x: gate.x + Math.random() * 80 - 40,
                    y: gate.y + Math.random() * 80 - 40,
                    health: health,
                    maxHealth: health,
                    reward: reward, 
                    lastShot: 0,
                    lastSlam: 0,
                    lastEmp: 0, 
                    lastHeal: 0 
                });
            },
            
            shootAcid: function(x, y, targetX, targetY, isArcing) {
                const angle = Math.atan2(targetY - y, targetX - x);
                const speed = isArcing ? 4 : 6;
                
                const bullet = {
                    x: x, y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    damage: isArcing ? 30 : 20, 
                    acid: isArcing,      
                    spitter: !isArcing, 
                    arcing: isArcing,
                    arcVelocity: isArcing ? -1.5 : 0,
                    fromZombie: true,
                    size: isArcing ? 12 : 8,
                    targetX: isArcing ? targetX : 0, 
                    targetY: isArcing ? targetY : 0
                };
                
                this.bullets.push(bullet);
            },

            createDeath: function(z) {
                for (let p = 0; p < 20; p++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 3 + 1;
                    this.particles.push({
                        x: z.x, y: z.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 40,
                        color: [180, 0, 0]
                    });
                }
            },
            
            createSpark: function(x, y, color, count = 5) { 
                for (let p = 0; p < count; p++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 2 + 1;
                    this.particles.push({
                        x: x, y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 20,
                        color: color
                    });
                }
            },

            createEmpPulse: function(x, y, radius) { 
                this.empPulses.push({
                    x: x, y: y,
                    maxRadius: radius,
                    currentRadius: 0,
                    speed: radius / 30, // Takes 30 frames
                    life: 30
                });
            },

            createHealParticle: function(x, y) { 
                this.healParticles.push({
                    x: x + Math.random() * 20 - 10,
                    y: y,
                    vy: -1,
                    life: 30
                });
            },
            
            dropLoot: function(x, y) {
                const lootCount = this.activePotions.loot > 0 ? 2 : 1;
                
                for (let i = 0; i < lootCount; i++) {
                    const rand = Math.random();
                    let type = 'money';
                    
                    if (rand < 0.1) type = 'medkit';
                    else if (rand < 0.3) type = 'ammo';
                    else if (rand < 0.6) type = 'wood';
                    else if (rand < 0.8) type = 'metal';
                    
                    this.drops.push({
                        x: x + (Math.random() * 20 - 10) + (i * 10),
                        y: y + (Math.random() * 20 - 10),
                        type: type,
                        life: 600
                    });
                }
            },
            
            createExplosion: function(x, y, damage) {
                this.explosions.push({ x: x, y: y, radius: 10, maxRadius: 100, damage: damage });
            },
            
            addCameraShake: function(intensity) {
                this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, intensity);
            },
            
            triggerGameOver: function() {
                this.gameOver = true;
                this.gameStarted = false;
                if (this.spawnInterval) clearInterval(this.spawnInterval);
                this.toggleCrafting(false);
                this.toggleShop(false);
                this.toggleWorkbench(false);
                this.toggleSkills(false);
                this.toggleTrader(false);
                this.preparationActive = false;
                this.preparationEvent = null;
                if (this.recordRunEnd) this.recordRunEnd();
                waveRewardModal.classList.add('hidden');

                if (this.waveEndTimeout) clearTimeout(this.waveEndTimeout);
                if (this.intermissionTimerInterval) clearInterval(this.intermissionTimerInterval);
                this.hideIntermissionTimer();
                this.waveEndTimeout = null;
                this.intermissionTimerInterval = null;
                
                document.getElementById('game-over-wave').textContent = `You survived ${this.wave - 1} waves!`;
                document.getElementById('game-over-money').textContent = `Money earned: ${this.player.money}`;
                
                gameOverModal.classList.remove('hidden');
                gameOverModal.classList.add('flex');
            },
            
            dist: function(x1, y1, x2, y2) {
                return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
            }
        };

        window.game = game;

        // --- Start the game ---
        window.onload = () => {
            game.init();
        };
