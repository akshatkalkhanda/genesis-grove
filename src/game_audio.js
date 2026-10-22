export const AUDIO_KEY = 'genesis-grove-audio-v1';
export const AUDIO_DEFAULTS = Object.freeze({ enabled: false, effects: 0.65, ambience: 0.18,
    voice: 0.75, narration: true, voice_uri: '' });
export const SOUND_PROFILES = Object.freeze({
    ui: [640, 480, .045, 'sine', 0], select: [420, 680, .09, 'sine', 0],
    inspect: [540, 810, .12, 'sine', 0], paint: [180, 130, .07, 'triangle', .35],
    water: [500, 260, .16, 'sine', .6], plant: [300, 540, .12, 'triangle', .2],
    life: [520, 780, .18, 'sine', 0], animal: [700, 420, .14, 'triangle', .15],
    erase: [260, 90, .12, 'triangle', .5], fire: [120, 70, .35, 'triangle', .8],
    lightning: [150, 35, .65, 'triangle', .9], meteor: [230, 35, .7, 'triangle', .65],
    explosion: [85, 25, .85, 'triangle', .85], wind: [220, 120, .5, 'sine', .85],
    rain: [600, 350, .6, 'sine', .9], tsunami: [100, 40, 1.1, 'sine', .85],
    bless: [500, 1000, .4, 'sine', 0], research: [440, 880, .4, 'sine', 0],
    build: [160, 260, .14, 'triangle', .25], war: [180, 120, .4, 'triangle', .15],
    peace: [390, 580, .3, 'sine', 0], coronation: [330, 660, .55, 'triangle', 0],
    save: [520, 840, .18, 'sine', 0], load: [840, 520, .18, 'sine', 0],
    pause: [360, 240, .09, 'sine', 0], resume: [240, 360, .09, 'sine', 0],
    zoom: [350, 430, .055, 'sine', 0], pan: [150, 130, .04, 'sine', .2],
    alert: [400, 280, .22, 'triangle', .1]
});
export function audio_settings(value = {}) {
    const number = key => Number.isFinite(value?.[key])
        ? Math.max(0, Math.min(1, value[key])) : AUDIO_DEFAULTS[key];
    return { enabled: value?.enabled === true, effects: number('effects'), ambience: number('ambience'),
        voice: number('voice'), narration: value?.narration !== false,
        voice_uri: typeof value?.voice_uri === 'string' ? value.voice_uri.slice(0, 300) : '' };
}
export function tool_sound(tool) {
    if (tool === 'nuke') return 'explosion';
    if (['lightning', 'meteor', 'tsunami', 'fire', 'erase'].includes(tool)) return tool;
    if (['rain', 'raincloud', 'storm'].includes(tool)) return tool === 'storm' ? 'lightning' : 'rain';
    if (['blizzard', 'drought'].includes(tool)) return 'wind';
    if (tool === 'bless') return 'bless';
    if (['ocean', 'shallow'].includes(tool)) return 'water';
    if (['forest', 'jungle', 'maple', 'mushroom', 'celestial'].includes(tool)) return 'plant';
    if (['human', 'elf', 'dwarf', 'orc', 'foxfolk', 'harefolk', 'catfolk', 'frogfolk', 'wolfkin', 'hyenafolk', 'beetlefolk'].includes(tool)) return 'life';
    if (['sheep', 'wolf', 'deer', 'bear', 'rabbit', 'chicken', 'fox', 'cat', 'frog', 'beetle', 'hyena', 'owl', 'boar', 'turtle', 'buffalo', 'butterfly', 'moth', 'lizard', 'angel', 'demon'].includes(tool)) return 'animal';
    return 'paint';
}
export function event_sound(event) {
    const text = event.text.toLowerCase();
    if (/\bcrowned\b|\bbecomes ruler\b/.test(text)) return 'coronation';
    if (/\bpeace\b|\balliance\b|\bsurrender(?:s|ed)?\b/.test(text)) return 'peace';
    if (/\bwar\b|\bconquers?\b|\bcaptures?\b|\bsiege\b/.test(text)) return 'war';
    if (/\blightning\b|\bthunder(?:storm)?\b/.test(text)) return 'lightning';
    if (/\btsunami\b/.test(text)) return 'tsunami';
    if (/\bmeteor\b|\ba star falls\b/.test(text)) return 'meteor';
    if (/\ba terrible flash\b/.test(text)) return 'explosion';
    if (/\bfire\b|\bburn(?:s|ing|ed)?\b/.test(text)) return 'fire';
    if (/\brain(?:cloud)?\b/.test(text)) return 'rain';
    if (/\bblizzard\b|\bdrought\b/.test(text)) return 'wind';
    if (/\benters the .+ age\b|\bresearch\b|\bdiscover(?:s|ed|y)?\b/.test(text)) return 'research';
    return event.kind === 'disaster' ? 'alert' : 'build';
}
const noise_cache = new WeakMap();
export function synthesize_effect(context, destination, kind, pan = 0) {
    const [from, to, length, wave, noise] = SOUND_PROFILES[kind] || SOUND_PROFILES.ui;
    const time = context.currentTime, gain = context.createGain();
    const panner = context.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner); panner.connect(destination);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.linearRampToValueAtTime(.09, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + length);
    const oscillator = context.createOscillator(), tone = context.createGain();
    oscillator.type = wave; oscillator.frequency.setValueAtTime(from, time);
    oscillator.frequency.exponentialRampToValueAtTime(to, time + length);
    tone.gain.value = 1 - noise; oscillator.connect(tone); tone.connect(gain);
    let source, filter, noise_gain;
    if (noise) {
        let buffer = noise_cache.get(context);
        if (!buffer) {
            buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.2), context.sampleRate);
            const samples = buffer.getChannelData(0); let seed = 173;
            for (let i = 0; i < samples.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                samples[i] = seed / 2147483648 - 1;
            }
            noise_cache.set(context, buffer);
        }
        source = context.createBufferSource(); source.buffer = buffer;
        filter = context.createBiquadFilter(); filter.type = 'lowpass';
        filter.frequency.value = kind === 'rain' ? 4200 : kind === 'lightning' ? 2600 : 900;
        noise_gain = context.createGain(); noise_gain.gain.value = noise;
        source.connect(filter); filter.connect(noise_gain); noise_gain.connect(gain);
        source.start(time); source.stop(time + length);
    }
    oscillator.onended = () => {
        for (const node of [oscillator, tone, source, filter, noise_gain, gain, panner]) node?.disconnect();
    };
    oscillator.start(time); oscillator.stop(time + length);
    return length;
}

export class GameAudio {
    constructor({ storage = globalThis.localStorage, speech = globalThis.speechSynthesis,
        utterance = text => new SpeechSynthesisUtterance(text),
        context = () => new AudioContext(), now = () => performance.now(), render = synthesize_effect } = {}) {
        this.storage = storage; this.speech = speech; this.utterance = utterance;
        this.context_factory = context; this.now = now; this.context = null; this.render = render;
        let saved; try { saved = JSON.parse(storage?.getItem(AUDIO_KEY) || 'null'); } catch { /* Safe defaults. */ }
        this.settings = audio_settings(saved); this.last = new Map(); this.active = [];
        this.pending = null; this.speaking = false; this.generation = 0;
        this.metrics = { effects: 0, spoken: 0, started: 0, finished: 0, dropped: 0 }; this.previous_event = null;
        this.suspended = false; this.speech_error = '';
    }
    voices() { return (this.speech?.getVoices() || []).filter(v => v.localService); }
    store() { try { this.storage?.setItem(AUDIO_KEY, JSON.stringify(this.settings)); } catch { /* Audio still works without storage. */ } }
    async start() {
        if (!this.settings.enabled) return;
        if (!this.context) {
            this.context = this.context_factory();
            this.master = this.context.createGain(); this.master.connect(this.context.destination);
            this.effects = this.context.createGain(); this.effects.connect(this.master);
            this.ambience = this.context.createGain(); this.ambience.connect(this.master);
            for (const frequency of [130.81, 196]) {
                const oscillator = this.context.createOscillator(), gain = this.context.createGain();
                gain.gain.value = .018; oscillator.frequency.value = frequency;
                oscillator.connect(gain); gain.connect(this.ambience); oscillator.start();
            }
        }
        this.apply_volumes(); await this.context.resume();
    }
    apply_volumes() {
        if (!this.context) return;
        const t = this.context.currentTime;
        this.master.gain.setTargetAtTime(this.settings.enabled && !this.suspended ? 1 : 0, t, .025);
        this.effects.gain.setTargetAtTime(this.settings.effects, t, .025);
        this.ambience.gain.setTargetAtTime(this.settings.ambience, t, .2);
    }
    async configure(patch) {
        const was_enabled = this.settings.enabled, old_voice = this.settings.voice_uri;
        this.settings = audio_settings({ ...this.settings, ...patch }); this.store();
        if (!this.settings.enabled || !this.settings.narration || this.settings.voice === 0
            || (patch.voice_uri !== undefined && old_voice !== this.settings.voice_uri)) this.stop_speech();
        if (this.settings.enabled && !was_enabled) await this.start();
        this.apply_volumes();
    }
    stop_speech() {
        this.generation++; this.pending = null; this.speaking = false; this.current_message = null; this.speech?.cancel();
    }
    suspend(value) {
        this.suspended = value;
        if (value) this.stop_speech();
        this.apply_volumes();
    }
    allow(key, interval) {
        const time = this.now();
        if (this.last.has(key) && time - this.last.get(key) < interval) return false;
        this.last.set(key, time);
        if (this.last.size > 100) this.last.delete(this.last.keys().next().value);
        return true;
    }
    play(kind, { interval = 90, key = kind, pan = 0 } = {}) {
        if (!this.settings.enabled || this.suspended || !this.context
            || this.context.state !== 'running' || this.settings.effects === 0) return false;
        const t = this.context.currentTime; this.active = this.active.filter(end => end > t);
        if (!this.allow(`effect:${key}`, interval) || this.active.length >= 6) { this.metrics.dropped++; return false; }
        const length = this.render(this.context, this.effects, kind, pan);
        this.active.push(t + length); this.metrics.effects++; return true;
    }
    speak(text, { priority = false, key = text, interval = 1400 } = {}) {
        text = String(text).replace(/[^\p{L}\p{N}\s.,!?%:;+'’−-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
        if (!text || !this.settings.enabled || !this.settings.narration || this.suspended
            || this.settings.voice === 0 || !this.context || !this.voices().length) return false;
        if (!this.allow(`voice:${key}`, interval)) return false;
        if (priority) this.stop_speech();
        if (this.speaking) { this.pending = text; return true; }
        const voices = this.voices();
        const voice = voices.find(v => v.voiceURI === this.settings.voice_uri)
            || voices.find(v => v.lang === 'en-IN') || voices.find(v => /^en[-_]/i.test(v.lang)) || voices[0];
        const message = this.utterance(text), generation = this.generation;
        message.voice = voice; message.lang = voice.lang; message.rate = 1; message.volume = this.settings.voice;
        this.speaking = true; this.current_message = message; this.metrics.spoken++;
        const finish = error => {
            if (generation !== this.generation) return;
            this.speaking = false; this.current_message = null;
            if (error) { this.speech_error = error; this.pending = null; this.on_speech_error?.(error); return; }
            this.metrics.finished++;
            const pending = this.pending; this.pending = null;
            if (pending) this.speak(pending, { key: `pending:${pending}`, interval: 0 });
        };
        message.onstart = () => { if (generation === this.generation) this.metrics.started++; };
        message.onend = () => finish(); message.onerror = event => finish(event.error || 'Voice unavailable');
        try { this.speech.speak(message); }
        catch { finish('Voice unavailable'); return false; }
        return true;
    }
    feedback(kind, text, options = {}) { this.play(kind, options); if (text) this.speak(text, options); }
    reset_events(events) { this.previous_event = events[0] || null; this.stop_speech(); }
    observe_events(events) {
        if (events[0] === this.previous_event) return;
        const index = events.indexOf(this.previous_event);
        const fresh = index >= 0 ? events.slice(0, index) : events.slice(0, 1);
        this.previous_event = events[0] || null;
        const event = fresh.find(e => e.kind === 'disaster') || fresh.find(e => e.kind === 'village' || e.kind === 'creation');
        if (event && this.allow('world-event', 5000)) this.feedback(event_sound(event), event.text,
            { key: 'world-event', interval: 5000 });
    }
}
