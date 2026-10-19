export function flag_design(kingdom) {
    const id = kingdom.id || 1;
    return { field: kingdom.color || '#8bbd8f', ink: '#f3e6bb',
        pattern: id % 5, emblem: Math.floor(id / 5) % 4 };
}

export function draw_flag(c, x, y, kingdom, width = 18, height = 12) {
    const design = flag_design(kingdom);
    c.save(); c.translate(x, y); c.scale(width / 18, height / 12);
    c.fillStyle = '#172c27'; c.fillRect(-1, -1, 20, 14);
    c.fillStyle = design.field; c.fillRect(0, 0, 18, 12);
    c.fillStyle = '#19372a';
    if (design.pattern === 0) c.fillRect(0, 4, 18, 4);
    else if (design.pattern === 1) { c.fillRect(4, 0, 3, 12); c.fillRect(0, 4, 18, 3); }
    else if (design.pattern === 2) {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(18, 12); c.lineTo(12, 12); c.lineTo(0, 4); c.fill();
    } else if (design.pattern === 3) { c.fillRect(0, 0, 6, 12); c.fillRect(12, 0, 6, 12); }
    else { c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 6); c.lineTo(0, 12); c.fill(); }
    c.fillStyle = design.ink;
    if (design.emblem === 0) { c.fillRect(9, 2, 2, 8); c.fillRect(6, 5, 8, 2); }
    else if (design.emblem === 1) {
        c.beginPath(); c.moveTo(10, 2); c.lineTo(14, 6); c.lineTo(10, 10); c.lineTo(6, 6); c.fill();
    } else if (design.emblem === 2) { c.fillRect(6, 4, 8, 5); c.fillRect(6, 2, 2, 3); c.fillRect(12, 2, 2, 3); }
    else { c.fillRect(7, 3, 6, 6); c.fillStyle = design.field; c.fillRect(9, 4, 4, 4); }
    c.fillStyle = '#ffffff20'; c.fillRect(0, 0, 18, 1);
    c.restore();
}

export function choose_ruler(kingdom, residents) {
    const eligible = residents.filter(person => person.health > 0 && !person.voyage_id && !person.prisoner_of);
    const current = eligible.find(person => person.id === kingdom.king_id);
    if (current) return current;
    return eligible.sort((a, b) => (b.xp || 0) + b.age - (a.xp || 0) - a.age || a.id - b.id)[0] || null;
}
