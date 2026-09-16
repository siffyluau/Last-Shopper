(function () {
    'use strict';

    class LastShopperAudio {
        constructor() {
            this.context = null;
            this.master = null;
            this.noiseBuffer = null;
            this.shotBuffer = null;
            this.lastPlayed = new Map();
            this.enabled = true;
        }

        unlock() {
            if (!this.enabled) return;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            if (!this.context) {
                this.context = new AudioContextClass();
                this.master = this.context.createGain();
                this.master.gain.value = 0.24;
                this.master.connect(this.context.destination);
                this.noiseBuffer = this.createNoiseBuffer();
                this.shotBuffer = this.createShotBuffer();
            }
            if (this.context.state === 'suspended') this.context.resume();
        }

        createNoiseBuffer() {
            const length = Math.floor(this.context.sampleRate * 0.35);
            const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
            return buffer;
        }

        createShotBuffer() {
            const duration = 0.065;
            const length = Math.floor(this.context.sampleRate * duration);
            const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            let filteredNoise = 0;
            for (let i = 0; i < length; i += 1) {
                const progress = i / length;
                const envelope = Math.pow(1 - progress, 2.8);
                filteredNoise = filteredNoise * 0.42 + (Math.random() * 2 - 1) * 0.58;
                const frequency = 145 - 65 * progress;
                const tone = Math.sin(2 * Math.PI * frequency * (i / this.context.sampleRate));
                data[i] = (filteredNoise * 0.42 + tone * 0.28) * envelope;
            }
            return buffer;
        }

        playShot() {
            if (!this.context || !this.master || !this.shotBuffer) return;
            const source = this.context.createBufferSource();
            source.buffer = this.shotBuffer;
            source.connect(this.master);
            source.start();
        }

        tone(frequency, duration, options = {}) {
            if (!this.context || !this.master) return;
            const now = this.context.currentTime;
            const oscillator = this.context.createOscillator();
            const gain = this.context.createGain();
            oscillator.type = options.type || 'square';
            oscillator.frequency.setValueAtTime(frequency, now);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, options.endFrequency || frequency), now + duration);
            gain.gain.setValueAtTime(options.volume || 0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            oscillator.connect(gain);
            gain.connect(this.master);
            oscillator.start(now);
            oscillator.stop(now + duration);
        }

        noise(duration = 0.08, volume = 0.08, cutoff = 1200) {
            if (!this.context || !this.master || !this.noiseBuffer) return;
            const now = this.context.currentTime;
            const source = this.context.createBufferSource();
            const filter = this.context.createBiquadFilter();
            const gain = this.context.createGain();
            source.buffer = this.noiseBuffer;
            filter.type = 'lowpass';
            filter.frequency.value = cutoff;
            gain.gain.setValueAtTime(volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);
            source.start(now);
            source.stop(now + duration);
        }

        play(name) {
            this.unlock();
            if (!this.context) return;
            const now = performance.now();
            const cooldown = name === 'shoot' ? 42 : 70;
            if (now - (this.lastPlayed.get(name) || 0) < cooldown) return;
            this.lastPlayed.set(name, now);
            if (name === 'shoot') this.playShot();
            else if (name === 'buy') { this.tone(520, 0.08, { type: 'sine', volume: 0.09 }); setTimeout(() => this.tone(760, 0.12, { type: 'sine', volume: 0.08 }), 55); }
            else if (name === 'menu') this.tone(240, 0.07, { type: 'triangle', endFrequency: 320, volume: 0.05 });
            else if (name === 'build') { this.noise(0.11, 0.07, 650); this.tone(105, 0.12, { endFrequency: 75, volume: 0.06 }); }
            else if (name === 'hit') this.noise(0.055, 0.045, 900);
            else if (name === 'downed') { this.tone(180, 0.5, { type: 'sawtooth', endFrequency: 55, volume: 0.1 }); }
            else if (name === 'revive') { this.tone(330, 0.15, { type: 'sine', endFrequency: 520, volume: 0.08 }); setTimeout(() => this.tone(660, 0.2, { type: 'sine', volume: 0.07 }), 110); }
            else if (name === 'wave') { this.tone(110, 0.22, { type: 'sawtooth', endFrequency: 180, volume: 0.07 }); }
            else if (name === 'reload') { this.noise(0.035, 0.04, 2200); setTimeout(() => this.tone(430, 0.04, { volume: 0.035 }), 80); }
        }
    }

    window.LastShopperAudio = LastShopperAudio;
}());
