export function draw_civic_building(c, building, color) {
    const x = Math.round(building.x * 6), y = Math.round(building.y * 6);
    const type = building.type;
    c.fillStyle = '#14291f55'; c.fillRect(x - 14, y, 29, 5);
    if (type === 'well') {
        c.fillStyle = '#788d82'; c.fillRect(x - 6, y - 3, 13, 8);
        c.fillStyle = '#4b95a0'; c.fillRect(x - 4, y - 3, 9, 3);
        c.fillStyle = '#725b40'; c.fillRect(x - 8, y - 17, 2, 20); c.fillRect(x + 7, y - 17, 2, 20);
        c.fillStyle = '#ba8a58'; c.fillRect(x - 10, y - 19, 21, 4);
        c.fillStyle = '#d7c592'; c.fillRect(x, y - 16, 1, 11);
        return;
    }
    c.fillStyle = type === 'temple' ? '#d9d6be' : '#d9bd87';
    c.fillRect(x - 12, y - 18, 25, 21);
    c.fillStyle = color; c.fillRect(x - 13, y - 22, 27, 5);
    c.fillStyle = '#384c40'; c.fillRect(x - 3, y - 7, 6, 10);
    c.fillStyle = '#8dc5b9'; c.fillRect(x - 9, y - 12, 4, 5); c.fillRect(x + 6, y - 12, 4, 5);
    if (type === 'school') {
        c.fillStyle = '#f3dfa0'; c.fillRect(x - 6, y - 19, 12, 7);
        c.fillStyle = '#765a40'; c.fillRect(x - 1, y - 19, 1, 7);
        c.fillStyle = '#dabb63'; c.fillRect(x - 3, y - 28, 6, 5);
    } else if (type === 'church') {
        c.fillStyle = '#d8c69d'; c.fillRect(x - 4, y - 34, 9, 16);
        c.fillStyle = '#9a7155'; c.fillRect(x - 6, y - 37, 13, 4);
        c.fillStyle = '#e4d391'; c.fillRect(x, y - 44, 2, 8); c.fillRect(x - 2, y - 42, 6, 2);
    } else if (type === 'temple') {
        c.fillStyle = '#f0e4bd';
        for (const dx of [-10, -5, 5, 10]) c.fillRect(x + dx, y - 18, 2, 21);
        c.fillRect(x - 15, y + 2, 31, 3);
        c.fillStyle = '#c1a465'; c.fillRect(x - 9, y - 26, 19, 4); c.fillRect(x - 4, y - 30, 9, 4);
    } else if (type === 'market') {
        for (let dx = -12; dx < 13; dx += 5) {
            c.fillStyle = dx % 2 ? '#e8d598' : color; c.fillRect(x + dx, y - 19, 5, 10);
        }
        c.fillStyle = '#8f693e'; c.fillRect(x - 14, y - 3, 29, 4);
        c.fillStyle = '#91b864'; c.fillRect(x - 11, y - 6, 7, 3);
        c.fillStyle = '#d9a05c'; c.fillRect(x + 5, y - 6, 7, 3);
    } else if (type === 'granary') {
        c.fillStyle = '#9f784b'; c.fillRect(x - 9, y - 14, 19, 17);
        c.fillStyle = '#e5c874';
        for (const dx of [-6, 0, 6]) { c.fillRect(x + dx, y - 11, 2, 10); c.fillRect(x + dx - 1, y - 10, 4, 4); }
    }
}
