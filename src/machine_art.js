import { draw_flag } from './heraldry.js';

export function draw_machine(c, machine, kingdom, now, level = 0) {
    const x = machine.x * 6, y = machine.y * 6, color = kingdom?.color || '#91b99b';
    c.save(); c.translate(x, y);
    c.fillStyle = '#142f3055'; c.beginPath(); c.ellipse(4, 5, 11, 4, 0, 0, Math.PI * 2); c.fill();
    if (machine.kind === 'balloon') {
        const sway = Math.sin(now / 1200 + machine.id) * 2;
        c.translate(sway, -12);
        c.strokeStyle = '#d4be8a'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(-7, -7); c.lineTo(-3, 9); c.moveTo(7, -7); c.lineTo(3, 9); c.stroke();
        c.fillStyle = '#8c633e'; c.fillRect(-4, 7, 9, 6);
        c.fillStyle = color; c.beginPath(); c.ellipse(0, -18, 14, 20, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#f1db9b'; c.fillRect(-3, -36, 6, 29);
        c.fillStyle = '#ffffff30'; c.fillRect(-10, -26, 3, 11);
        c.fillStyle = '#f5ba62'; c.fillRect(-1, 2, 3, 4);
        draw_flag(c, 4, 4, kingdom || {}, 10, 6);
        if (machine.crew_aboard) {
            c.fillStyle = '#e9bf8b'; c.fillRect(-2, 2, 4, 4);
            c.fillStyle = color; c.fillRect(-2, 6, 4, 3);
        }
    } else if (machine.kind === 'boat') {
        c.translate(0, Math.sin(now / 600 + machine.id));
        c.fillStyle = '#cbe5dd77'; c.fillRect(-13, 6, 23, 1);
        c.fillStyle = '#604d39'; c.beginPath(); c.moveTo(-15, 0); c.lineTo(17, 0); c.lineTo(10, 7); c.lineTo(-10, 7); c.fill();
        c.fillStyle = '#b99b6a'; c.fillRect(-10, -3, 22, 6);
        c.fillStyle = color; c.fillRect(-11, 2, 23, 2);
        c.fillStyle = '#594835'; c.fillRect(-1, -25, 2, 26);
        c.fillStyle = '#f2e8ca'; c.beginPath(); c.moveTo(1, -23); c.lineTo(13, -7); c.lineTo(1, -7); c.fill();
        draw_flag(c, 1, -27, kingdom || {}, 11, 7);
        if (level >= 6) { c.fillStyle = '#40525c'; c.fillRect(-9, -6, 5, 7); c.fillRect(-12, -7, 9, 2); }
        if (machine.crew_aboard) {
            c.fillStyle = '#e9bf8b'; c.fillRect(4, -8, 4, 4);
            c.fillStyle = color; c.fillRect(3, -4, 6, 4);
        }
    } else if (machine.kind === 'artillery') {
        const face = machine.dx < 0 ? -1 : 1;
        c.scale(face, 1);
        c.fillStyle = '#524a39'; c.fillRect(-9, -1, 18, 5);
        c.fillStyle = '#2e3e39'; c.fillRect(-7, 2, 5, 6); c.fillRect(4, 2, 5, 6);
        c.fillStyle = '#b4b29c'; c.fillRect(-6, 4, 3, 2); c.fillRect(5, 4, 3, 2);
        c.fillStyle = '#76878b'; c.fillRect(-3, -7, 19, 5);
        c.fillStyle = '#354b55'; c.fillRect(13, -9, 5, 8);
        c.fillStyle = color; c.fillRect(-7, -4, 7, 3);
        if (machine.cooldown > 3.7) { c.fillStyle = '#fff1a4'; c.fillRect(19, -8, 5, 5); }
        if (machine.crew_aboard) { c.fillStyle = '#e9bf8b'; c.fillRect(-11, -9, 4, 4); }
    } else {
        c.translate(0, -11);
        c.rotate(Math.atan2(machine.dy, machine.dx));
        if (machine.kind === 'plane') {
            c.fillStyle = '#d1dad4'; c.fillRect(-14, -2, 29, 5);
            c.fillStyle = color; c.beginPath(); c.moveTo(4, 0); c.lineTo(-4, -15); c.lineTo(-9, -15); c.lineTo(-5, 0); c.lineTo(-9, 15); c.lineTo(-4, 15); c.fill();
            c.fillStyle = '#80bdcc'; c.fillRect(5, -2, 6, 4);
            c.fillStyle = '#374c59'; c.fillRect(-15, -7, 4, 14);
        } else {
            c.fillStyle = '#789aaa'; c.beginPath(); c.ellipse(0, 0, 24, 9, 0, 0, Math.PI * 2); c.fill();
            c.fillStyle = color; c.fillRect(-18, -3, 35, 5);
            c.fillStyle = '#d5efdb'; c.fillRect(-5, -7, 13, 3);
            c.fillStyle = '#aaeff1'; c.fillRect(-21, -6, 4, 12);
            c.fillStyle = '#c1b0ee'; c.fillRect(-13, -10, 3, 4); c.fillRect(-13, 6, 3, 4);
        }
        c.rotate(-Math.atan2(machine.dy, machine.dx));
        draw_flag(c, -2, 5, kingdom || {}, 10, 6);
        if (machine.crew_aboard) { c.fillStyle = '#e9bf8b'; c.fillRect(3, -3, 3, 3); }
    }
    c.restore();
}

export function draw_fortification(c, building, kingdom) {
    const x = building.x * 6, y = building.y * 6, color = kingdom?.color || '#a1bd91';
    if (building.type === 'castle') {
        c.fillStyle = '#4c5b5266'; c.fillRect(x - 23, y + 2, 49, 6);
        c.fillStyle = '#a4b3ad'; c.fillRect(x - 17, y - 19, 35, 23);
        c.fillStyle = '#778f91'; c.fillRect(x - 20, y - 31, 10, 35); c.fillRect(x + 11, y - 31, 10, 35);
        c.fillStyle = '#c8d2bb';
        for (const side of [-20, 11]) { c.fillRect(x + side - 1, y - 35, 12, 5); for (let i = 0; i < 3; i++) c.fillRect(x + side + i * 4, y - 38, 2, 5); }
        c.fillStyle = '#37505b'; c.fillRect(x - 17, y - 24, 4, 7); c.fillRect(x + 14, y - 24, 4, 7);
        c.fillStyle = '#414638'; c.fillRect(x - 5, y - 10, 10, 14);
        c.fillStyle = '#c2b489'; for (let i = -4; i <= 4; i += 2) c.fillRect(x + i, y - 10, 1, 13);
        c.fillStyle = '#cbd2bb'; c.fillRect(x - 1, y - 43, 1, 24);
        draw_flag(c, x, y - 43, kingdom || {}, 18, 12);
    } else if (building.type === 'watchtower') {
        c.fillStyle = '#837e65'; c.fillRect(x - 4, y - 25, 9, 29);
        c.fillStyle = '#b4b69a'; c.fillRect(x - 7, y - 29, 15, 6);
        c.fillStyle = '#5b7170'; c.fillRect(x - 5, y - 29, 3, 4); c.fillRect(x + 2, y - 29, 3, 4);
        c.fillStyle = '#3f4c42'; c.fillRect(x - 2, y - 20, 4, 6);
        c.fillStyle = '#d4c391'; c.fillRect(x + 1, y - 39, 1, 10);
        draw_flag(c, x + 2, y - 39, kingdom || {}, 12, 8);
    } else if (building.type === 'prison') {
        c.fillStyle = '#75827b'; c.fillRect(x - 13, y - 13, 27, 17);
        c.fillStyle = '#4a5c5e'; c.fillRect(x - 15, y - 17, 31, 5);
        c.fillStyle = '#263b3c'; c.fillRect(x - 10, y - 10, 21, 8);
        c.fillStyle = '#b0beb0'; for (let bar = -9; bar <= 9; bar += 3) c.fillRect(x + bar, y - 10, 1, 8);
        c.fillStyle = color; c.fillRect(x - 12, y, 25, 2);
    } else if (building.type === 'dock') {
        c.fillStyle = '#766044'; c.fillRect(x - 15, y - 2, 31, 9);
        c.fillStyle = '#bfa576'; for (let board = -14; board <= 14; board += 4) c.fillRect(x + board, y - 2, 2, 9);
        c.fillStyle = '#554b35'; c.fillRect(x - 14, y - 4, 2, 14); c.fillRect(x + 12, y - 4, 2, 14);
        draw_flag(c, x + 13, y - 19, kingdom || {}, 13, 9);
    } else {
        c.fillStyle = '#546a68'; c.fillRect(x - 19, y - 1, 39, 14);
        c.fillStyle = '#c4c8a0'; c.fillRect(x - 15, y + 5, 8, 1); c.fillRect(x + 3, y + 5, 8, 1);
        c.fillStyle = '#9cafa7'; c.fillRect(x - 13, y - 14, 27, 14);
        c.fillStyle = '#5c7381'; c.beginPath(); c.arc(x, y - 13, 14, Math.PI, 0); c.fill();
        c.fillStyle = '#344c52'; c.fillRect(x - 8, y - 11, 17, 11);
        draw_flag(c, x + 9, y - 24, kingdom || {}, 12, 8);
    }
}
