export function draw_constabulary(c, building, color, cell = 8) {
    const x = building.x * cell, y = building.y * cell;
    c.fillStyle = '#1c2a2866'; c.fillRect(x - 9, y + 4, 21, 4);
    c.fillStyle = '#b8c1ac'; c.fillRect(x - 9, y - 10, 18, 16);
    c.fillStyle = '#3b5669'; c.fillRect(x - 11, y - 14, 22, 5);
    c.fillStyle = color; c.fillRect(x - 9, y - 10, 18, 2);
    c.fillStyle = '#263931'; c.fillRect(x - 6, y - 3, 4, 9);
    c.fillRect(x + 1, y - 5, 6, 6);
    c.fillStyle = '#b6c7ca';
    for (let i = 1; i <= 5; i += 2) c.fillRect(x + i, y - 5, 1, 6);
    c.fillStyle = '#e4c464'; c.fillRect(x - 5, y - 8, 3, 3);
    c.fillRect(x - 6, y - 7, 5, 1);
}

export function draw_justice_person(c, person, world, x, y) {
    if (world?._police_ids?.has(person.id)) {
        c.fillStyle = '#334f68'; c.fillRect(x - 3, y - 10, 6, 2);
        c.fillRect(x - 4, y - 8, 8, 1);
        c.fillStyle = '#efd175'; c.fillRect(x - 2, y - 3, 2, 2);
    }
    if (world?._justice_custody?.has(person.id)) {
        c.fillStyle = '#c4cdcc'; c.fillRect(x - 4, y - 1, 2, 2);
        c.fillRect(x + 2, y - 1, 2, 2);
    }
}
