export function draw_mine_face(c, site) {
    const x = site.x * 6, y = site.y * 6;
    c.fillStyle = '#3f4035'; c.fillRect(x - 5, y - 7, 11, 8);
    c.fillStyle = '#927553'; c.fillRect(x - 6, y - 9, 13, 3);
    c.fillStyle = '#c0a677'; c.fillRect(x - 5, y - 6, 2, 7); c.fillRect(x + 4, y - 6, 2, 7);
    c.fillStyle = '#e0c779'; c.fillRect(x - 1, y - 4, 2, 2);
    c.fillStyle = '#9ba295'; c.fillRect(x - 5, y + 2, 4, 2); c.fillRect(x + 2, y + 1, 5, 2);
}
