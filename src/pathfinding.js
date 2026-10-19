// Bounded A* over walkable tiles. Routes are transient and never enter save files.
export function find_path(world, start, target, budget = 4096) {
    const width = world.width;
    const sx = Math.floor(start.x), sy = Math.floor(start.y);
    const tx = Math.floor(target.x), ty = Math.floor(target.y);
    if (!world.walkable(sx, sy) || !world.walkable(tx, ty)) return [];
    const origin = sy * width + sx, goal = ty * width + tx;
    const cost = new Map([[origin, 0]]), previous = new Map();
    const open = [{ index: origin, score: Math.abs(tx - sx) + Math.abs(ty - sy) }];
    const push = entry => {
        let index = open.length;
        open.push(entry);
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (open[parent].score <= entry.score) break;
            open[index] = open[parent]; index = parent;
        }
        open[index] = entry;
    };
    const pop = () => {
        const first = open[0], last = open.pop();
        if (open.length) {
            let index = 0;
            while (index * 2 + 1 < open.length) {
                let child = index * 2 + 1;
                if (child + 1 < open.length && open[child + 1].score < open[child].score) child++;
                if (last.score <= open[child].score) break;
                open[index] = open[child]; index = child;
            }
            open[index] = last;
        }
        return first;
    };
    const visited = new Set();
    while (open.length && budget-- > 0) {
        const current = pop().index;
        if (visited.has(current)) continue;
        if (current === goal) {
            const path = [];
            for (let at = goal; at !== origin; at = previous.get(at)) {
                path.push({ x: at % width + 0.5, y: Math.floor(at / width) + 0.5 });
            }
            return path.reverse();
        }
        visited.add(current);
        const x = current % width, y = Math.floor(current / width);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy, next = ny * width + nx;
            if (!world.walkable(nx, ny) || visited.has(next)) continue;
            const candidate = cost.get(current) + 1;
            if (candidate >= (cost.get(next) ?? Infinity)) continue;
            cost.set(next, candidate); previous.set(next, current);
            push({ index: next, score: candidate + Math.abs(tx - nx) + Math.abs(ty - ny) });
        }
    }
    return [];
}
