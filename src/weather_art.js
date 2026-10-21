import { wave_reaches } from './weather.js';

export function draw_weather(c, world, cell) {
    for (const event of world.weather || []) {
        c.save();
        const x = event.x * cell, y = event.y * cell, r = event.radius * cell;
        if (event.kind === 'tsunami') {
            const radius = event.travel * cell;
            c.strokeStyle = '#c2f7f4'; c.lineWidth = 3;
            for (let i = 0; i < 128; i++) {
                const a = i / 128 * Math.PI * 2, next = (i + 1) / 128 * Math.PI * 2;
                const wx = Math.floor(event.x + Math.cos(a) * event.travel), wy = Math.floor(event.y + Math.sin(a) * event.travel);
                if (!wave_reaches(world, event, wx, wy)) continue;
                c.beginPath(); c.arc(x, y, radius, a, next); c.stroke();
                c.strokeStyle = '#80cddc'; c.lineWidth = 1;
                c.beginPath(); c.arc(x, y, Math.max(0, radius - 5), a, next); c.stroke();
                c.strokeStyle = '#c2f7f4'; c.lineWidth = 3;
            }
            c.fillStyle = '#d7f8ed'; c.font = '12px sans-serif'; c.fillText('Tsunami', x + 6, y - 8);
        } else if (event.kind === 'drought') {
            c.fillStyle = '#dcb95b33'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#e2c26b'; c.lineWidth = 2;
            c.beginPath(); c.arc(x, y - r / 2, 9, 0, Math.PI * 2); c.stroke();
            for (let i = 0; i < 8; i++) {
                const a = i / 8 * Math.PI * 2;
                c.beginPath(); c.moveTo(x + Math.cos(a) * 12, y - r / 2 + Math.sin(a) * 12);
                c.lineTo(x + Math.cos(a) * 18, y - r / 2 + Math.sin(a) * 18); c.stroke();
            }
        } else {
            const storm = event.kind === 'storm', snow = event.kind === 'blizzard';
            c.fillStyle = storm ? '#162b3c66' : '#e2edf03b';
            c.fillRect(x - r, y - r * 0.65, r * 2, r * 0.6);
            c.fillRect(x - r * 0.65, y - r, r * 1.3, r * 0.5);
            c.fillStyle = '#041b3022'; c.beginPath(); c.ellipse(x + 5, y + 8, r, r * 0.55, 0, 0, Math.PI * 2); c.fill();
            for (let i = 0; i < 42; i++) {
                const dx = Math.sin(i * 17) * r, dy = ((i * 13 + event.age * 35) % (r * 2)) - r;
                if (snow) { c.fillStyle = '#eff9f7bb'; c.fillRect(x + dx, y + dy, 2, 2); }
                else { c.strokeStyle = '#a3d5e4aa'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + dx, y + dy); c.lineTo(x + dx - (storm ? 5 : 2), y + dy + 6); c.stroke(); }
            }
        }
        c.restore();
    }
}
