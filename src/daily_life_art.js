// Readable original pixel actions at close zoom; no effects allocated in the simulation.
export function draw_daily_activity(c, person, now) {
    const state = person.daily_life;
    if (!state || person.role === 'soldier' || person.prisoner_of || person.medical_role || person.recovering) return;
    const x = Math.round(person.x * 6), y = Math.round(person.y * 6);
    const swing = Math.sin(now / 180 + person.id) > 0 ? 2 : -1;
    if (state.cargo.food + state.cargo.wood > 0) {
        c.fillStyle = state.cargo.wood > 0 ? '#81562f' : '#bb9756';
        c.fillRect(x - 7, y - 4, 5, 6);
        c.fillStyle = state.cargo.wood > 0 ? '#d2b58a' : '#e0ce72';
        c.fillRect(x - 7, y - 3, 5, 1); c.fillRect(x - 7, y, 5, 1);
        c.fillStyle = '#5e4935'; c.fillRect(x - 5, y - 5, 1, 8);
    }
    if (state.phase === 'work' && state.site?.kind !== 'home') {
        c.fillStyle = '#936a44'; c.fillRect(x + 4, y - 5 + swing, 1, 7);
        c.fillStyle = person.job === 'farmer' ? '#d5c779' : '#b9c8c7';
        c.fillRect(x + 3, y - 6 + swing, person.job === 'miner' ? 6 : 4, 2);
        c.fillStyle = '#edcaa1'; c.fillRect(x + 3, y - 2 + swing, 2, 2);
        if (person.job === 'smith' && swing > 0) {
            c.fillStyle = '#ffd27c'; c.fillRect(x + 8, y - 5, 1, 1); c.fillRect(x + 6, y - 8, 1, 2);
        }
        if (person.job === 'farmer') {
            c.fillStyle = '#92b958'; c.fillRect(x + 6, y + 1, 1, 3); c.fillRect(x + 5, y + 1, 3, 1);
        }
    }
    if (state.phase === 'rest') {
        c.fillStyle = '#879eac'; c.fillRect(x - 4, y + 2, 9, 3);
        c.fillStyle = '#d2e7e9';
        c.fillRect(x + 5, y - 15, 4, 1); c.fillRect(x + 7, y - 14, 1, 1);
        c.fillRect(x + 6, y - 13, 1, 1); c.fillRect(x + 5, y - 12, 4, 1);
    }
    if (state.phase === 'social') {
        c.fillStyle = '#ecedd8'; c.fillRect(x + 3, y - 17, 9, 6); c.fillRect(x + 4, y - 11, 2, 2);
        c.fillStyle = '#647d68';
        for (let i = 0; i < 3; i++) c.fillRect(x + 5 + i * 2, y - 14, 1, 1);
    }
}
