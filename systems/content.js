(function () {
    const enemyTypes = {
        runner: {
            name: 'Runner',
            color: [230, 70, 55],
            speed: 2.45,
            health: 65,
            reward: 16,
            xp: 16,
            size: 12,
            contactDamage: 7
        },
        armored: {
            name: 'Armored Zombie',
            color: [90, 105, 115],
            speed: 0.72,
            health: 420,
            reward: 38,
            xp: 35,
            size: 24,
            armor: 0.38,
            contactDamage: 14
        },
        bomber: {
            name: 'Bomber',
            color: [245, 125, 35],
            speed: 1.8,
            health: 90,
            reward: 34,
            xp: 30,
            size: 14,
            explosionDamage: 180,
            isBomber: true
        },
        sapper: {
            name: 'Demolition Sapper',
            color: [239, 125, 45],
            speed: 1.22,
            health: 155,
            reward: 46,
            xp: 42,
            size: 16,
            explosionDamage: 260,
            isBomber: true,
            isSapper: true,
            contactDamage: 10
        },
        stalker: {
            name: 'Aisle Stalker',
            color: [111, 45, 130],
            speed: 1.58,
            health: 135,
            reward: 40,
            xp: 38,
            size: 16,
            isFlanker: true,
            contactDamage: 12
        },
        shield: {
            name: 'Shield Zombie',
            color: [55, 135, 180],
            speed: 0.92,
            health: 220,
            shieldHealth: 240,
            reward: 35,
            xp: 32,
            size: 19,
            contactDamage: 11
        },
        acidRanger: {
            name: 'Acid Ranger',
            color: [130, 215, 55],
            speed: 0.82,
            health: 125,
            reward: 28,
            xp: 26,
            size: 15,
            shootRange: 380,
            shootRate: 1550,
            isAcidRanger: true
        },
        engineer: {
            name: 'Engineer Zombie',
            color: [180, 120, 55],
            speed: 0.86,
            health: 170,
            reward: 34,
            xp: 32,
            size: 16,
            isEngineer: true,
            weldRate: 2800,
            weldRadius: 120,
            contactDamage: 9
        },
        healerZombie: {
            name: 'Healer Zombie',
            color: [225, 230, 215],
            speed: 1.02,
            health: 145,
            reward: 36,
            xp: 34,
            size: 15,
            isHealer: true,
            healRadius: 115,
            healRate: 1150,
            healAmount: 8,
            contactDamage: 7
        },
        splitter: {
            name: 'Splitter Zombie',
            color: [95, 160, 70],
            speed: 1.05,
            health: 175,
            reward: 38,
            xp: 35,
            size: 18,
            isSplitter: true,
            splitInto: 'runner',
            splitCount: 2,
            contactDamage: 9
        },
        charger: {
            name: 'Charger Zombie',
            color: [210, 82, 42],
            speed: 1.08,
            health: 210,
            reward: 44,
            xp: 42,
            size: 19,
            isCharger: true,
            chargeRate: 3600,
            chargeDuration: 620,
            chargeSpeed: 3.35,
            contactDamage: 16
        },
        leech: {
            name: 'Leech Zombie',
            color: [125, 30, 60],
            speed: 1.28,
            health: 150,
            reward: 42,
            xp: 40,
            size: 15,
            isLeech: true,
            leechAmount: 9,
            contactDamage: 10
        },
        eliteRunner: {
            name: 'Elite Runner',
            color: [255, 105, 70],
            speed: 2.75,
            health: 155,
            reward: 58,
            xp: 55,
            size: 14,
            isEliteVariant: true,
            contactDamage: 12
        },
        eliteTank: {
            name: 'Elite Tank',
            color: [95, 125, 45],
            speed: 0.78,
            health: 760,
            reward: 84,
            xp: 80,
            size: 28,
            armor: 0.2,
            isEliteVariant: true,
            contactDamage: 18
        },
        riftWarden: {
            name: 'Rift Warden',
            color: [126, 54, 190],
            speed: 0.82,
            health: 880,
            reward: 115,
            xp: 105,
            size: 27,
            armor: 0.12,
            contactDamage: 15,
            isDomainWarden: true,
            domainRange: 480
        },
        miniBoss: {
            name: 'Store Captain',
            color: [175, 45, 115],
            speed: 0.68,
            health: 1500,
            reward: 300,
            xp: 240,
            size: 32,
            armor: 0.18,
            contactDamage: 20,
            shootRange: 330,
            shootRate: 1750,
            isMiniBoss: true
        },
        boss: {
            name: 'Basic Brute',
            color: [145, 12, 12],
            speed: 0.55,
            health: 4200,
            reward: 900,
            xp: 650,
            size: 46,
            armor: 0.22,
            contactDamage: 28,
            shootRange: 440,
            shootRate: 900,
            slamRange: 120,
            slamRate: 4200,
            isBoss: true
        },
        burrowKing: {
            name: 'Burrow King',
            color: [114, 74, 35],
            speed: 0.72,
            health: 4600,
            reward: 980,
            xp: 720,
            size: 44,
            armor: 0.12,
            contactDamage: 26,
            isBoss: true,
            bossKind: 'burrow',
            burrowRate: 5600,
            spawnRate: 4200
        },
        chargerBrute: {
            name: 'Charger Brute',
            color: [205, 72, 34],
            speed: 0.7,
            health: 4800,
            reward: 1020,
            xp: 740,
            size: 47,
            armor: 0.14,
            contactDamage: 32,
            isBoss: true,
            bossKind: 'chargerBrute',
            chargeRate: 4600,
            chargeDuration: 800,
            chargeSpeed: 5.2,
            warningDuration: 720,
            slamRange: 125,
            slamRate: 3600
        },
        teslaHorror: {
            name: 'Tesla Horror',
            color: [42, 170, 215],
            speed: 0.62,
            health: 5200,
            reward: 1180,
            xp: 840,
            size: 45,
            armor: 0.1,
            contactDamage: 24,
            isBoss: true,
            bossKind: 'tesla',
            empRadius: 250,
            empRate: 6400,
            empWindup: 1100,
            spawnRate: 7600
        },
        broodMother: {
            name: 'Brood Mother',
            color: [115, 155, 65],
            speed: 0.48,
            health: 5600,
            reward: 1220,
            xp: 880,
            size: 52,
            armor: 0.08,
            contactDamage: 22,
            isBoss: true,
            bossKind: 'brood',
            spawnRate: 2900,
            weakSpotDuration: 950
        },
        toxicButcher: {
            name: 'Toxic Butcher',
            color: [95, 190, 55],
            speed: 0.86,
            health: 6100,
            reward: 1400,
            xp: 980,
            size: 50,
            armor: 0.12,
            contactDamage: 36,
            isBoss: true,
            bossKind: 'toxic',
            puddleRate: 1200,
            slamRange: 150,
            slamRate: 3200
        },
        bossButcher: {
            name: 'Meat Aisle Brute',
            color: [170, 35, 35],
            speed: 0.66,
            health: 5100,
            reward: 1050,
            xp: 760,
            size: 48,
            armor: 0.16,
            contactDamage: 34,
            slamRange: 145,
            slamRate: 3800,
            isBoss: true
        },
        bossSpitter: {
            name: 'Toxic Store Manager',
            color: [105, 190, 45],
            speed: 0.58,
            health: 4550,
            reward: 1000,
            xp: 720,
            size: 45,
            armor: 0.12,
            contactDamage: 24,
            shootRange: 520,
            shootRate: 720,
            isBoss: true,
            isAcidRanger: true
        }
    };

    const weaponTypes = [
        { id: 'pistol', name: 'Pistol', cost: 0, damage: 35, fireRate: 300, maxAmmo: 12, owned: true, speed: 8, bulletSize: 4, reloadTime: 1500 },
        { id: 'shotgun', name: 'Shotgun', cost: 170, requiredWave: 2, damage: 12.5, fireRate: 600, maxAmmo: 8, owned: false, speed: 6, pellets: 16, bulletSize: 3, reloadTime: 2500 },
        { id: 'smg', name: 'Checkout SMG', cost: 480, requiredWave: 4, damage: 17, fireRate: 78, maxAmmo: 45, owned: false, speed: 10, bulletSize: 3, reloadTime: 2100 },
        { id: 'rifle', name: 'Assault Rifle', cost: 950, requiredWave: 6, damage: 29, fireRate: 115, maxAmmo: 32, owned: false, speed: 11, bulletSize: 3, reloadTime: 2050 },
        { id: 'marksman', name: 'Marksman Rifle', cost: 1700, requiredWave: 9, damage: 118, fireRate: 560, maxAmmo: 8, owned: false, speed: 16, bulletSize: 5, pierce: 1, reloadTime: 2700 },
        { id: 'minigun', name: 'Mini Gun', cost: 3300, requiredWave: 12, damage: 32, fireRate: 30, maxAmmo: 120, owned: false, speed: 12, bulletSize: 2, reloadTime: 4200 },
        { id: 'grenadeLauncher', name: 'Grenade Launcher', cost: 5600, requiredWave: 15, damage: 300, fireRate: 1250, maxAmmo: 5, owned: false, speed: 6, explosive: true, bulletSize: 7, reloadTime: 3100, ammoCost: 85 },
        { id: 'rpg', name: 'RPG', cost: 9000, requiredWave: 20, damage: 760, fireRate: 2100, maxAmmo: 3, owned: false, speed: 5, explosive: true, bulletSize: 8, reloadTime: 3500, ammoCost: 250 }
    ];

    const turretTypes = [
        {
            name: 'Auto Turret',
            techLevel: 1,
            cost: { wood: 6, metal: 4 },
            damage: 28,
            fireRate: 170,
            range: 260,
            speed: 10,
            color: [85, 135, 255],
            bulletSize: 3,
            health: 180,
            maxHealth: 180,
            ammo: 120,
            maxAmmo: 120,
            radius: 15,
            isDisabled: 0
        },
        {
            name: 'Scatter Turret',
            techLevel: 1,
            cost: { wood: 9, metal: 6 },
            damage: 13,
            fireRate: 650,
            range: 210,
            speed: 7,
            pellets: 12,
            color: [255, 105, 105],
            bulletSize: 3,
            health: 150,
            maxHealth: 150,
            ammo: 72,
            maxAmmo: 72,
            radius: 15,
            isDisabled: 0
        },
        {
            name: 'Cannon Turret',
            techLevel: 2,
            cost: { wood: 14, metal: 16, parts: 1 },
            damage: 380,
            fireRate: 1800,
            range: 350,
            speed: 6,
            explosive: true,
            color: [255, 165, 45],
            bulletSize: 6,
            health: 280,
            maxHealth: 280,
            ammo: 18,
            maxAmmo: 18,
            radius: 17,
            isDisabled: 0
        },
        {
            name: 'Pulse Turret',
            techLevel: 3,
            cost: { wood: 20, metal: 34, parts: 2 },
            damage: 95,
            fireRate: 110,
            range: 430,
            speed: 14,
            color: [80, 235, 255],
            bulletSize: 5,
            health: 420,
            maxHealth: 420,
            ammo: 220,
            maxAmmo: 220,
            radius: 18,
            isDisabled: 0
        }
    ];

    const wallStages = [
        {
            name: 'Wood Wall',
            techLevel: 1,
            cost: { wood: 3 },
            upgradeCost: { wood: 5 },
            health: 240,
            color: [139, 82, 35]
        },
        {
            name: 'Reinforced Wood',
            techLevel: 1,
            cost: { wood: 9, metal: 2 },
            upgradeCost: { wood: 8, metal: 3 },
            health: 430,
            color: [125, 88, 52]
        },
        {
            name: 'Metal Wall',
            techLevel: 2,
            cost: { wood: 6, metal: 14 },
            upgradeCost: { wood: 4, metal: 10 },
            health: 780,
            color: [130, 145, 155]
        },
        {
            name: 'Reinforced Metal',
            techLevel: 3,
            cost: { wood: 7, metal: 22, parts: 1 },
            upgradeCost: { wood: 6, metal: 18 },
            health: 1080,
            color: [105, 120, 132],
            armor: 0.1
        },
        {
            name: 'Electric Wall',
            techLevel: 3,
            cost: { wood: 8, metal: 24, parts: 1 },
            upgradeCost: { wood: 8, metal: 24, parts: 1 },
            health: 1280,
            color: [30, 165, 245],
            isElectric: true,
            shockDamage: 28
        },
        {
            name: 'Titanium Wall',
            techLevel: 3,
            cost: { wood: 12, metal: 42, parts: 2 },
            upgradeCost: { wood: 10, metal: 34, parts: 1 },
            health: 1680,
            color: [185, 195, 205],
            armor: 0.15
        }
    ];

    const trapTypes = [
        {
            name: 'Spike Trap',
            techLevel: 1,
            cost: { wood: 5, metal: 1 },
            damage: 320,
            color: [120, 120, 120],
            radius: 20,
            oneTimeUse: true
        },
        {
            name: 'Fire Trap',
            techLevel: 2,
            cost: { wood: 8, metal: 8 },
            damage: 620,
            color: [245, 100, 35],
            radius: 26,
            oneTimeUse: true
        },
        {
            name: 'EMP Mine',
            techLevel: 3,
            cost: { wood: 10, metal: 16 },
            damage: 1150,
            color: [40, 210, 255],
            radius: 34,
            oneTimeUse: true
        }
    ];

    const workbenchLevels = [
        { level: 1, name: 'Field Bench', cost: null },
        { level: 2, name: 'Machine Bench', cost: { money: 900, wood: 24, metal: 18 } },
        { level: 3, name: 'Powered Bench', cost: { money: 2600, wood: 40, metal: 48 } }
    ];

    const buildingTypes = [
        {
            id: 'potionHut',
            name: 'Potion Hut',
            techLevel: 2,
            cost: { money: 650, wood: 28, metal: 10 },
            description: 'Craft temporary combat and scavenging potions.',
            width: 92,
            height: 68,
            color: [126, 34, 206]
        },
        {
            id: 'ammoForge',
            name: 'Ammo Forge',
            techLevel: 2,
            cost: { money: 850, wood: 18, metal: 28 },
            description: 'Convert scrap into reserve ammo during long runs.',
            width: 96,
            height: 70,
            color: [202, 138, 4]
        },
        {
            id: 'advancedTurretBench',
            name: 'Advanced Turret Bench',
            techLevel: 2,
            cost: { money: 1250, wood: 30, metal: 32, parts: 1 },
            description: 'Improves turret upgrade caps and tuning options.',
            width: 104,
            height: 72,
            color: [37, 99, 235]
        },
        {
            id: 'trapBench',
            name: 'Trap Bench',
            techLevel: 2,
            cost: { money: 900, wood: 26, metal: 24 },
            description: 'Unlocks a safer trap crafting station.',
            width: 92,
            height: 70,
            color: [185, 28, 28]
        },
        {
            id: 'repairStation',
            name: 'Repair Station',
            techLevel: 2,
            cost: { money: 1050, wood: 24, metal: 30 },
            description: 'Repairs nearby defenses between waves.',
            width: 92,
            height: 70,
            color: [22, 163, 74]
        },
        {
            id: 'weaponCore',
            name: 'Weapon Core',
            techLevel: 3,
            cost: { money: 3200, wood: 36, metal: 55, parts: 2 },
            description: 'Late-game weapon overclocking with unique visuals.',
            width: 112,
            height: 78,
            color: [249, 115, 22]
        },
        {
            id: 'powerRelay',
            name: 'Parking Lot Power Relay',
            techLevel: 3,
            cost: { money: 2400, wood: 28, metal: 48, parts: 2 },
            description: 'Extends turret coverage and slowly refills powered defenses.',
            width: 108,
            height: 76,
            color: [45, 212, 191]
        }
    ];

    const potionRecipes = [
        { id: 'sprint_45s', name: 'Sprint Potion', cost: { money: 180, wood: 4, metal: 1 }, duration: 45000, type: 'sprint', multiplier: 1.35, description: 'Boosts sprint speed, stamina, and stamina regen.' },
        { id: 'rate_45s', name: 'Fire Rate Potion', cost: { money: 260, wood: 4, metal: 3 }, duration: 45000, type: 'fireRate', multiplier: 1.8, description: 'Greatly improves weapon fire rate.' },
        { id: 'leech_45s', name: 'Lifesteal Potion', cost: { money: 320, wood: 5, metal: 5 }, duration: 45000, type: 'lifesteal', multiplier: 0.08, description: 'Recover health from bullet damage.' },
        { id: 'armor_45s', name: 'Armor Potion', cost: { money: 290, wood: 5, metal: 4 }, duration: 45000, type: 'armor', multiplier: 0.35, description: 'Reduces incoming damage.' },
        { id: 'loot_45s', name: 'Double Loot Potion', cost: { money: 340, wood: 5, metal: 4 }, duration: 45000, type: 'loot', multiplier: 2, description: 'Doubles dropped resources.' },
        { id: 'heal_now', name: 'Emergency Heal', cost: { money: 220, wood: 3, metal: 2 }, duration: 0, type: 'instantHeal', multiplier: 45, description: 'Instantly restores 45 health.' },
        { id: 'crit_45s', name: 'Critical Chance Potion', cost: { money: 380, wood: 5, metal: 6 }, duration: 45000, type: 'crit', multiplier: 0.18, description: 'Adds a chance for double bullet damage.' },
        { id: 'resource_60s', name: 'Resource Multiplier Potion', cost: { money: 420, wood: 6, metal: 5 }, duration: 60000, type: 'resource', multiplier: 1.75, description: 'Increases cash, wood, and metal income.' },
        { id: 'infinite_20s', name: 'Temporary Infinite Ammo Potion', cost: { money: 600, wood: 8, metal: 9, parts: 1 }, duration: 20000, type: 'infiniteAmmo', multiplier: 1, description: 'Fires without consuming magazine ammo.' }
    ];

    const ammoPacks = [
        { id: 'small', name: 'Small Ammo Pack', ammo: 45, cost: { money: 45 }, description: 'Cheap reserve ammo for one bad reload.' },
        { id: 'medium', name: 'Medium Ammo Pack', ammo: 120, cost: { money: 110 }, description: 'Best early-wave value for pistols, shotgun, and rifle.' },
        { id: 'large', name: 'Large Ammo Pack', ammo: 320, cost: { money: 260 }, description: 'Stock up before five-wave milestones and boss prep.' },
        { id: 'full', name: 'Full Refill', ammo: 520, cost: { money: 420, metal: 4 }, refillWeapons: true, description: 'Adds a large reserve stack and tops off owned weapon magazines.' }
    ];

    const skills = [
        { id: 'maxHealth', name: 'Toughness', description: '+20 max health', max: 8 },
        { id: 'moveSpeed', name: 'Cardio', description: '+5% move speed', max: 8 },
        { id: 'reloadSpeed', name: 'Fast Hands', description: '+8% reload speed', max: 8 },
        { id: 'bulletDamage', name: 'Stopping Power', description: '+10% bullet damage', max: 10 },
        { id: 'pickupRange', name: 'Magnetism', description: '+25 pickup range', max: 8 },
        { id: 'resourceMultiplier', name: 'Scavenger', description: '+10% resources', max: 10 }
    ];

    const runUpgrades = [
        { id: 'vitality', name: 'Emergency Rations', description: '+25 max health and heal 25', stackable: true },
        { id: 'caliber', name: 'Heavy Caliber', description: '+12% player bullet damage', stackable: true },
        { id: 'rapidFire', name: 'Polished Action', description: '+10% player fire rate', stackable: true },
        { id: 'salvage', name: 'Salvage Contract', description: '+15% money and resources', stackable: true },
        { id: 'turretCore', name: 'Turret Overclock', description: '+15% turret damage and fire rate', stackable: true },
        { id: 'fortify', name: 'Fortified Stock', description: '+20% wall and turret max health', stackable: true },
        { id: 'longShot', name: 'Rangefinder', description: '+15% turret range', stackable: true },
        { id: 'fieldRepair', name: 'Field Repair', description: 'Repair every defense by 40%', stackable: true },
        { id: 'deepPockets', name: 'Deep Pockets', description: '+80 reserve ammo and +20% magazine size', stackable: true }
    ];

    const skins = [
        {
            id: 'shopper',
            name: 'The Shopper',
            description: 'Default survivor jacket.',
            unlock: { type: 'free', label: 'Unlocked' },
            colors: { body: '#f97316', shirt: '#1f2937', accent: '#fbbf24' }
        },
        {
            id: 'stocker',
            name: 'Night Stocker',
            description: 'Earned after 25 zombie kills.',
            unlock: { type: 'kills', value: 25, label: '25 kills' },
            colors: { body: '#64748b', shirt: '#111827', accent: '#38bdf8' }
        },
        {
            id: 'cashier',
            name: 'Last Cashier',
            description: 'Earned by reaching wave 5.',
            unlock: { type: 'wave', value: 5, label: 'Reach wave 5' },
            colors: { body: '#dc2626', shirt: '#292524', accent: '#fef3c7' }
        },
        {
            id: 'mechanic',
            name: 'Bench Mechanic',
            description: 'Earned by building 3 defenses.',
            unlock: { type: 'builds', value: 3, label: 'Build 3 defenses' },
            colors: { body: '#ca8a04', shirt: '#44403c', accent: '#f97316' }
        },
        {
            id: 'manager',
            name: 'Ex-Manager',
            description: 'Earned by surviving a boss wave.',
            unlock: { type: 'bosses', value: 1, label: 'Defeat 1 boss' },
            colors: { body: '#7c2d12', shirt: '#0f172a', accent: '#fb923c' }
        },
        {
            id: 'runner',
            name: 'Supply Runner',
            description: 'Earned by clearing early store routes.',
            unlock: { type: 'wave', value: 10, label: 'Reach wave 10' },
            colors: { body: '#16a34a', shirt: '#1c1917', accent: '#facc15' }
        },
        {
            id: 'hazmat',
            name: 'Hazmat Shopper',
            description: 'Earned after serious cleanup work.',
            unlock: { type: 'kills', value: 250, label: '250 kills' },
            colors: { body: '#eab308', shirt: '#111827', accent: '#84cc16' }
        },
        {
            id: 'titanium',
            name: 'Titanium Tech',
            description: 'Earned by committing to base building.',
            unlock: { type: 'builds', value: 20, label: 'Build 20 defenses' },
            colors: { body: '#94a3b8', shirt: '#0f172a', accent: '#38bdf8' }
        },
        {
            id: 'bossHunter',
            name: 'Boss Hunter',
            description: 'Earned by beating multiple managers.',
            unlock: { type: 'bosses', value: 5, label: 'Defeat 5 bosses' },
            colors: { body: '#991b1b', shirt: '#1c1917', accent: '#fef3c7' }
        }
    ];

    window.LastShopperContent = {
        enemyTypes,
        weaponTypes,
        turretTypes,
        wallStages,
        trapTypes,
        workbenchLevels,
        buildingTypes,
        potionRecipes,
        ammoPacks,
        skills,
        runUpgrades,
        skins
    };
}());
