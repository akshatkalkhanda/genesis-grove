// Artwork stays anchored to the saved world; only its footprint changes.
export function draw_compact(c, x, y, factor, paint) {
    c.save(); c.translate(x, y); c.scale(factor, factor); c.translate(-x, -y);
    paint(); c.restore();
}

export function home_populations(world) {
    const counts = new Map();
    for (const person of world.people) if (person.health > 0 && !person.voyage_id) {
        const home = person.home_id || person.village_id;
        counts.set(home, (counts.get(home) || 0) + 1);
    }
    return counts;
}

export function settlement_labels(world, view, populations, measure) {
    const living = new Set(world.villages.filter(v => v.alive).map(v => v.id));
    const candidates = [
        ...world.villages.filter(v => v.alive).map(v => ({ site: v, capital: true, owner: v.id })),
        ...(view.zoom >= 3.5 ? world.colonies.filter(c => living.has(c.kingdom_id))
            .map(site => ({ site, capital: false, owner: site.kingdom_id })) : [])
    ].filter(item => populations.get(item.site.id) > 0)
        .sort((a, b) => Number(b.owner === view.selected) - Number(a.owner === view.selected)
            || Number(b.capital) - Number(a.capital)
            || populations.get(b.site.id) - populations.get(a.site.id) || a.site.id - b.site.id);
    const labels = [], limit = view.zoom < 1.7 ? 6 : 10;
    for (const item of candidates) {
        const { site, capital } = item;
        const width = measure(site.name, capital) + (capital ? 34 : 16);
        const height = capital ? 23 : 20;
        const x = view.origin.x + site.x * 6 * view.scale - width / 2;
        const y = view.origin.y + site.y * 6 * view.scale - Math.min(80, 26 * view.scale);
        const box = { ...item, x, y, width, height };
        if (x < 6 || x + width > view.width - 6 || y < 76 || y + height > view.height - 60) continue;
        if ([...(view.reserved || []), ...labels].some(other => x < other.x + other.width + 8 && x + width + 8 > other.x
            && y < other.y + other.height + 8 && y + height + 8 > other.y)) continue;
        labels.push(box);
        if (labels.length >= limit) break;
    }
    return labels;
}
