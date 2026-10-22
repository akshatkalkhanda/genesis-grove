export function bind_audio_ui(audio) {
    const $ = id => document.getElementById(id), dialog = $('audio-dialog');
    const refresh_voices = () => {
        const voices = audio.voices(); $('audio-voice').replaceChildren();
        const automatic = document.createElement('option'); automatic.value = ''; automatic.textContent = 'Automatic local voice';
        $('audio-voice').append(automatic);
        for (const voice of voices) {
            const option = document.createElement('option'); option.value = voice.voiceURI;
            option.textContent = `${voice.name} · ${voice.lang}`; $('audio-voice').append(option);
        }
        $('audio-voice').value = voices.some(v => v.voiceURI === audio.settings.voice_uri) ? audio.settings.voice_uri : '';
        $('audio-voice').disabled = !voices.length;
        $('audio-status').textContent = audio.speech_error ? 'Spoken feedback is unavailable. Sound effects still work.' : voices.length
            ? 'Uses installed device voices. No cloud narration or recording.'
            : 'No installed voice is available in this browser. Sound effects still work.';
    };
    const refresh = () => {
        for (const key of ['enabled', 'narration']) $(`audio-${key}`).checked = audio.settings[key];
        for (const key of ['effects', 'ambience', 'voice']) {
            $(`audio-${key}-volume`).value = String(Math.round(audio.settings[key] * 100));
            $(`audio-${key}-value`).textContent = `${Math.round(audio.settings[key] * 100)}%`;
        }
        $('sound').textContent = audio.settings.enabled ? '♫ Audio on' : '♫ Audio off';
        refresh_voices();
    };
    const open = () => { refresh(); dialog.showModal(); };
    $('sound').onclick = $('menu-audio').onclick = open;
    for (const key of ['enabled', 'narration']) $(`audio-${key}`).onchange = async event => {
        try {
            await audio.configure({ [key]: event.target.checked }); refresh();
            if (audio.settings.enabled) audio.feedback('select', key === 'enabled'
                ? 'Sound and voice enabled' : audio.settings.narration ? 'Spoken feedback enabled' : null,
                { priority: true });
        } catch { $('audio-status').textContent = 'Audio could not start. Try enabling it again.'; }
    };
    for (const key of ['effects', 'ambience', 'voice']) $(`audio-${key}-volume`).oninput = event => {
        audio.configure({ [key]: Number(event.target.value) / 100 });
        $(`audio-${key}-value`).textContent = `${event.target.value}%`;
        if (key === 'effects') audio.play('ui', { key: 'volume', interval: 120 });
    };
    $('audio-voice').onchange = async event => {
        await audio.configure({ voice_uri: event.target.value });
        audio.speak('This is your selected voice.', { priority: true });
    };
    $('audio-preview').onclick = async () => {
        if (!audio.settings.enabled) await audio.configure({ enabled: true });
        else await audio.start();
        refresh(); audio.feedback('coronation', 'Welcome, world maker. Your world is ready.', { priority: true });
    };
    audio.on_speech_error = () => { $('audio-status').textContent = 'Spoken feedback is unavailable. Sound effects still work.'; };
    audio.speech?.addEventListener('voiceschanged', refresh_voices);
    document.addEventListener('pointerdown', () => {
        if (audio.settings.enabled) audio.start().catch(() => {});
    }, { capture: true });
    document.addEventListener('keydown', () => {
        if (audio.settings.enabled) audio.start().catch(() => {});
    }, { capture: true });
    document.addEventListener('visibilitychange', () => audio.suspend(document.hidden));
    document.addEventListener('click', event => {
        const button = event.target.closest('button, summary');
        if (!button || button.disabled || dialog.contains(button) || ['sound', 'menu-audio', 'pause', 'zoom-in', 'zoom-out', 'zoom-reset'].includes(button.id)
            || button.dataset.speed) return;
        const label = button.getAttribute('aria-label') || button.querySelector('b')?.textContent || button.title || button.textContent;
        const text = label.replace(/\s+/g, ' ').trim().slice(0, 160);
        audio.feedback(button.dataset.tool ? 'select' : button.dataset.action?.startsWith('inspect') ? 'inspect' : 'ui', text);
    });
    document.addEventListener('change', event => {
        const input = event.target;
        if (dialog.contains(input) || !input.matches('select, input[type=checkbox], input[type=radio]')) return;
        const label = input.getAttribute('aria-label') || input.closest('label')?.textContent.trim();
        if (label) audio.feedback('select', input.tagName === 'SELECT'
            ? input.selectedOptions[0]?.textContent : `${label} ${input.checked ? 'enabled' : 'disabled'}`);
    });
    refresh(); return { refresh };
}
