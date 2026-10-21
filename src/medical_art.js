export function draw_medical_building(c, building, color) {
    const x = Math.round(building.x * 6), y = Math.round(building.y * 6);
    const hospital = building.type === 'hospital';
    const w = hospital ? 25 : 19, h = hospital ? 22 : 15;
    c.fillStyle = '#12261d55'; c.fillRect(x - w / 2 - 2, y + 1, w + 5, 4);
    c.fillStyle = '#e4ddbc'; c.fillRect(x - w / 2, y - h, w, h + 3);
    c.fillStyle = '#a6b29a'; c.fillRect(x + w / 2 - 4, y - h, 4, h + 3);
    c.fillStyle = '#568a72'; c.fillRect(x - w / 2 - 2, y - h - 4, w + 4, 5);
    c.fillStyle = color; c.fillRect(x - w / 2, y - h + 1, w, 2);
    c.fillStyle = '#315448'; c.fillRect(x - 2, y - 5, 5, 8);
    c.fillStyle = '#a7e1dc';
    for (const side of [-1, 1]) c.fillRect(x + side * (hospital ? 8 : 6) - 2, y - 9, 4, 4);
    if (hospital) { c.fillRect(x - 9, y - 17, 4, 4); c.fillRect(x + 6, y - 17, 4, 4); }
    c.fillStyle = '#f3f3d9'; c.fillRect(x - 4, y - h - 3, 9, 9);
    c.fillStyle = '#409575'; c.fillRect(x - 1, y - h - 2, 3, 7); c.fillRect(x - 3, y - h, 7, 3);
    c.fillStyle = '#88b46b'; c.fillRect(x - w / 2 - 3, y, 2, 4); c.fillRect(x - w / 2 - 5, y, 6, 1);
}

export function draw_medical_person(c, person) {
    const x = Math.round(person.x * 6), y = Math.round(person.y * 6);
    if (person.medical_role === 'doctor') {
        c.fillStyle = '#e9eddd'; c.fillRect(x - 3, y - 4, 6, 6);
        c.fillStyle = '#4c9271'; c.fillRect(x - 1, y - 3, 2, 4); c.fillRect(x - 2, y - 2, 4, 2);
        c.fillStyle = '#8a7050'; c.fillRect(x - 6, y - 2, 3, 4);
    }
    if (person.task === 'Receiving treatment') {
        c.fillStyle = '#a7e7ad'; c.fillRect(x + 5, y - 13, 2, 6); c.fillRect(x + 3, y - 11, 6, 2);
    }
}
