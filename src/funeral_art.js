// Small, non-graphic memorials in the established canvas palette.
export function draw_cemetery(c, cemetery) {
    const x = cemetery.x * 6, y = cemetery.y * 6;
    c.fillStyle = '#617351'; c.fillRect(x - 14, y - 12, 28, 22);
    c.fillStyle = '#9c9278'; c.fillRect(x - 14, y - 12, 28, 2);
    c.fillRect(x - 14, y - 12, 2, 22); c.fillRect(x + 12, y - 12, 2, 22);
    c.fillStyle = '#b8ae8e'; c.fillRect(x - 14, y + 8, 10, 2); c.fillRect(x + 4, y + 8, 10, 2);
    for (let n = 0; n < Math.min(8, cemetery.buried); n++) {
        const px = x - 9 + n % 4 * 6, py = y - 7 + Math.floor(n / 4) * 8;
        c.fillStyle = '#464f44'; c.fillRect(px - 1, py + 2, 4, 3);
        c.fillStyle = '#b3b5a4'; c.fillRect(px, py - 1, 3, 4);
        c.fillStyle = '#e0dfc7'; c.fillRect(px + 1, py - 2, 1, 2);
    }
    for (let n = 0; n < Math.min(3, cemetery.cremated); n++) {
        const px = x - 7 + n * 7;
        c.fillStyle = '#c5ae82'; c.fillRect(px, y + 3, 3, 4);
        c.fillStyle = '#746c59'; c.fillRect(px - 1, y + 2, 5, 1);
    }
}

export function draw_remains(c, body, world_time) {
    const x = body.x * 6, y = body.y * 6;
    c.fillStyle = '#20362d66'; c.fillRect(x - 3, y + 2, 8, 2);
    c.fillStyle = '#c7c9b8'; c.fillRect(x - 3, y - 1, 7, 3);
    c.fillStyle = '#eee9d1'; c.fillRect(x - 4, y, 2, 2);
    c.fillStyle = '#8e9c88'; c.fillRect(x + 1, y - 1, 1, 3);
    if (body.stage === 'rites' && body.method === 'cremation' && body.paid) {
        c.fillStyle = '#805b3b'; c.fillRect(x - 4, y + 2, 9, 2);
        const flicker = Math.floor(world_time * 5) % 2;
        c.fillStyle = '#c78348'; c.fillRect(x - 2, y - 3 - flicker, 5, 5);
        c.fillStyle = '#e1b46c'; c.fillRect(x, y - 4 + flicker, 2, 5);
    }
}
