export const MAP_LAYERS = Object.freeze({
    terrain: 'Terrain', political: 'Kingdoms', armies: 'Armies', routes: 'Routes', resources: 'Resources'
});
export function layer_summary(world, layer) {
    if (layer === 'armies') return `${world.armies.filter(a => a.count > 0).length} armies · ${world.armies.filter(a => a.target_id).length} marching`;
    if (layer === 'routes') return `${world.trades.length} trade shipments · ${world.voyages.length} settler journeys`;
    if (layer === 'resources') return `${world.ores.reduce((n, ore) => n + (ore > 0 ? 1 : 0), 0)} remaining deposit tiles · copper / tin / iron / coal / stardust`;
    return layer === 'terrain' ? 'Terrain and biomes · political tint hidden' : 'Kingdom borders and banners';
}
export function draw_map_layer(c, world, layer, cell) {
    if (layer === 'resources') {
        const colors = ['', '#efa476', '#ebd6a9', '#e2eef2', '#8f9397', '#f2b8ff'];
        for (let i = 0; i < world.ores.length; i++) {
            const ore = world.ores[i]; if (!ore) continue;
            const x = (i % world.width + 0.5) * cell, y = (Math.floor(i / world.width) + 0.5) * cell;
            c.fillStyle = '#10242cd9'; c.fillRect(x - 3, y - 3, 6, 6);
            c.strokeStyle = colors[ore]; c.lineWidth = 1.3; c.strokeRect(x - 3, y - 3, 6, 6);
            c.fillStyle = colors[ore]; c.fillRect(x - 1, y - 1, 2, 2);
        }
    }
    if (layer === 'routes') {
        const kingdoms = new Map(world.villages.filter(v => v.alive).map(v => [v.id, v]));
        const routes = world.voyages.map(v => ({ x: v.x, y: v.y, tx: v.target_x, ty: v.target_y, color: '#e8ce8a' }));
        for (const trade of world.trades) {
            const from = kingdoms.get(trade.from_id), to = kingdoms.get(trade.to_id);
            if (from && to) routes.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, color: '#9ad6e5' });
        }
        for (const route of routes) {
            c.strokeStyle = route.color; c.lineWidth = 1.5; c.setLineDash([5, 4]);
            c.beginPath(); c.moveTo(route.x * cell, route.y * cell); c.lineTo(route.tx * cell, route.ty * cell); c.stroke();
            c.setLineDash([]); c.fillStyle = route.color;
            c.fillRect(route.tx * cell - 2, route.ty * cell - 2, 4, 4);
        }
    }
}
