(function () {
    class ProgressionSystem {
        constructor(content) {
            this.content = content;
        }

        xpToNext(level) {
            return Math.floor(80 + Math.pow(level, 1.32) * 45);
        }

        wavePlan(wave) {
            const bossWave = wave % 10 === 0;
            const miniBossWave = wave > 5 && wave % 5 === 0 && !bossWave;
            const baseCount = Math.floor(4 + wave * 1.25 + Math.pow(wave, 0.72));
            const completed = wave - 1;
            const healthScale = 1 + completed * 0.045 + completed * completed * 0.0009;
            const damageScale = 1 + completed * 0.018;
            const rewardScale = 1 + completed * 0.055;

            return {
                bossWave,
                miniBossWave,
                bossCount: bossWave ? Math.max(1, Math.floor(wave / 30) + 1) : 0,
                miniBossCount: miniBossWave ? Math.max(1, Math.floor(wave / 20) + 1) : 0,
                enemyCount: bossWave ? 8 + Math.floor(wave * 0.85) : baseCount,
                healthScale,
                damageScale,
                rewardScale,
                waveReward: {
                    money: Math.floor(48 * Math.pow(wave, 1.15)),
                    wood: Math.max(2, Math.floor(1 + wave * 0.55)),
                    metal: Math.max(1, Math.floor(wave * 0.36))
                }
            };
        }

        unlockedTechForWave(wave) {
            return Math.min(3, 1 + Math.floor(wave / 10));
        }

        pickUpgradeCards(count, ownedCounts) {
            const pool = this.content.runUpgrades.filter((upgrade) => {
                return upgrade.stackable || !ownedCounts[upgrade.id];
            });
            const shuffled = [...pool].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(count, shuffled.length));
        }

        enemyPool(wave) {
            const pool = ['normal', 'normal', 'normal', 'normal'];
            if (wave >= 2) pool.push('fast');
            if (wave >= 3) pool.push('runner');
            if (wave >= 4) pool.push('tank');
            if (wave >= 5) pool.push('spitter');
            if (wave >= 7) pool.push('bomber', 'healerZombie');
            if (wave >= 8) pool.push('shield');
            if (wave >= 9) pool.push('armored', 'acidRanger');
            if (wave >= 11) pool.push('engineer', 'splitter');
            if (wave >= 12) pool.push('charger', 'leech');
            if (wave >= 14) pool.push('thrower');
            if (wave >= 16) pool.push('disruptor');
            if (wave >= 20) pool.push('eliteRunner', 'eliteTank', 'bomber', 'acidRanger');
            return pool;
        }

        bossPool(wave) {
            const pool = ['boss'];
            if (wave >= 20) pool.push('bossButcher');
            if (wave >= 30) pool.push('bossSpitter');
            return pool;
        }
    }

    window.ProgressionSystem = ProgressionSystem;
}());
