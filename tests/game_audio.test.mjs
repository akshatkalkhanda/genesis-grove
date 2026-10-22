import test from 'node:test';
import assert from 'node:assert/strict';
import { GameAudio, audio_settings, AUDIO_DEFAULTS, tool_sound, event_sound } from '../src/game_audio.js';

function fixture(saved = null) {
    let now = 0;
    const messages = [], effects = [], writes = [];
    const node = () => ({ connect() {}, start() {}, frequency: {}, gain: { setTargetAtTime() {} } });
    const context = { state: 'running', get currentTime() { return now / 1000; },
        destination: {}, createGain: node, createOscillator: node, async resume() {} };
    const speech = { cancelled: 0, getVoices: () => [
        { voiceURI: 'remote', localService: false, lang: 'en-US' },
        { voiceURI: 'local-india', localService: true, lang: 'en-IN' }],
        cancel() { this.cancelled++; }, speak(message) { messages.push(message); } };
    const audio = new GameAudio({ context: () => context, speech, utterance: text => ({ text }),
        now: () => now, storage: { getItem: () => saved, setItem: (...v) => writes.push(v) },
        render: (_c, _d, kind, pan) => { effects.push({ kind, pan }); return .5; } });
    return { audio, speech, messages, effects, writes, advance: ms => { now += ms; } };
}

test('audio defaults are quiet, malformed preferences are bounded and storage failure is harmless', async () => {
    assert.deepEqual(audio_settings(), AUDIO_DEFAULTS);
    const bad = audio_settings({ enabled: 'yes', effects: 9, ambience: -3, voice: NaN, voice_uri: 'x'.repeat(500) });
    assert.equal(bad.enabled, false); assert.equal(bad.effects, 1); assert.equal(bad.ambience, 0);
    assert.equal(bad.voice, .75); assert.equal(bad.voice_uri.length, 300);
    const f = fixture('{invalid');
    assert.equal(f.audio.play('ui'), false); assert.equal(f.audio.speak('Hello'), false);
    f.audio.storage.setItem = () => { throw Error('Full'); };
    await f.audio.configure({ enabled: true }); assert.ok(f.audio.context);
});

test('rapid effects are throttled and simultaneous voices have a hard bound', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    for (let i = 0; i < 100; i++) f.audio.play('paint');
    assert.equal(f.effects.length, 1);
    for (let i = 0; i < 20; i++) f.audio.play('ui', { key: 'button-' + i });
    assert.equal(f.effects.length, 6);
    f.advance(600); assert.equal(f.audio.play('meteor'), true);
    await f.audio.configure({ effects: 0 }); assert.equal(f.audio.play('ui'), false);
});

test('spoken feedback uses local voices and retains only the latest pending action', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    f.audio.speak('First');
    for (let i = 0; i < 100; i++) f.audio.speak('Action ' + i);
    assert.equal(f.messages.length, 1); assert.equal(f.audio.pending, 'Action 99');
    assert.equal(f.messages[0].voice.voiceURI, 'local-india');
    f.messages[0].onend(); assert.equal(f.messages.length, 2); assert.equal(f.messages[1].text, 'Action 99');
    f.messages[1].onend(); assert.equal(f.audio.pending, null); assert.equal(f.audio.speaking, false);
});

test('mute, narration-off and backgrounding cancel speech without replaying it later', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    f.audio.speak('First'); f.audio.speak('Pending');
    await f.audio.configure({ narration: false });
    assert.equal(f.audio.pending, null); assert.equal(f.audio.speaking, false);
    f.messages[0].onend(); assert.equal(f.messages.length, 1);
    await f.audio.configure({ narration: true }); f.advance(2000); f.audio.speak('New');
    f.audio.suspend(true); assert.equal(f.audio.speak('Hidden'), false); assert.equal(f.audio.play('ui'), false);
    f.audio.suspend(false); assert.equal(f.audio.pending, null);
    await f.audio.configure({ enabled: false }); assert.equal(f.audio.play('ui'), false);
    assert.ok(f.speech.cancelled >= 3);
});

test('missing voices and a provider failure leave sound effects available', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    f.speech.getVoices = () => []; assert.equal(f.audio.speak('Hello'), false);
    assert.equal(f.audio.play('ui'), true);
    f.speech.getVoices = () => [{ localService: true, voiceURI: 'local', lang: 'en-US' }];
    f.speech.speak = () => { throw Error('Unavailable'); };
    assert.equal(f.audio.speak('Hello'), false); assert.equal(f.audio.speaking, false);
    assert.equal(f.audio.speech_error, 'Voice unavailable');
});

test('loading and re-rendering history do not replay old events', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    const old = { text: 'A king was crowned', kind: 'village' };
    f.audio.reset_events([old]); f.audio.observe_events([old]); assert.equal(f.effects.length, 0);
    const coronation = { text: 'Rowan is crowned King', kind: 'village' };
    f.audio.observe_events([coronation, old]); f.audio.observe_events([coronation, old]);
    assert.deepEqual(f.effects.map(e => e.kind), ['coronation']);
    f.advance(6000);
    f.audio.observe_events([{ kind: 'disaster', text: 'A tsunami reaches the coast' },coronation,old]);
    assert.equal(f.effects.at(-1).kind, 'tsunami');
});

test('tools and major events use appropriate distinct sound families', () => {
    assert.equal(tool_sound('nuke'), 'explosion'); assert.equal(tool_sound('lightning'), 'lightning');
    assert.equal(tool_sound('tsunami'), 'tsunami'); assert.equal(tool_sound('forest'), 'plant');
    assert.equal(tool_sound('human'), 'life'); assert.equal(tool_sound('raincloud'), 'rain');
    assert.equal(event_sound({ text: 'Two kingdoms declare war', kind: 'village' }), 'war');
    assert.equal(event_sound({ text: 'Kingdoms agree on peace', kind: 'village' }), 'peace');
});


test('event cues distinguish actual actions from fragments inside kingdom names', () => {
    for (const text of ['Dwarf village is founded.', 'A village establishes a colony.',
        'Sage Hollow builds a barracks.']) {
        assert.equal(event_sound({ text, kind: 'village' }), 'build', text);
    }
    for (const [text, sound] of [
        ['Thunderstorm begins.', 'lightning'], ['Rain cloud begins.', 'rain'],
        ['Blizzard begins.', 'wind'], ['Drought begins.', 'wind'],
        ['A star falls. The earth will remember.', 'meteor'],
        ['A terrible flash reshapes the land.', 'explosion'],
        ['Dwarf Hollow enters the Iron Age. Their forges can now craft swords.', 'research'],
        ['Dwarf Hollow captures Willowmere.', 'war'],
        ['Willowmere surrenders. Its wars end.', 'peace']
    ]) assert.equal(event_sound({ text, kind: 'disaster' }), sound, text);
});

test('fast-play event bursts drop throttled cues without building a speech backlog', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    const old = { text: 'A village is founded', kind: 'village' };
    let events = [old]; f.audio.reset_events(events);
    for (let i = 0; i < 100; i++) {
        events = [{ text: `Thunderstorm ${i} begins`, kind: 'disaster' }, ...events];
        f.audio.observe_events(events); f.advance(25);
    }
    assert.equal(f.effects.length, 1); assert.equal(f.messages.length, 1);
    assert.equal(f.audio.pending, null);
    f.messages[0].onend(); f.advance(6000); f.audio.observe_events(events);
    assert.equal(f.messages.length, 1, 'Suppressed events must never replay later');
    events = [{ text: 'A tsunami begins', kind: 'disaster' }, ...events];
    f.audio.observe_events(events);
    assert.equal(f.messages.length, 2); assert.equal(f.effects.at(-1).kind, 'tsunami');
});

test('priority announcements cancel the current voice and ignore late completion callbacks', async () => {
    const f = fixture(); await f.audio.configure({ enabled: true });
    f.audio.speak('Running'); f.audio.speak('Outdated pending message');
    f.audio.speak('Time paused', { priority: true });
    assert.ok(f.speech.cancelled > 0); assert.equal(f.audio.pending, null);
    assert.equal(f.messages.at(-1).text, 'Time paused');
    f.messages[0].onend(); assert.equal(f.audio.speaking, true);
    f.messages.at(-1).onend(); assert.equal(f.audio.speaking, false);
    assert.equal(f.messages.length, 2);
});
