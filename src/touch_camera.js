const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pair(points) {
    const [a, b] = [...points.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, distance(a, b)) };
}

// A touch brush is previewed until lift. A second finger discards it completely.
export class TouchCamera {
    constructor(camera, { inspect, paint }) {
        this.camera = camera; this.inspect = inspect; this.paint = paint; this.cancel();
    }
    cancel() { this.points = new Map(); this.stroke = []; this.gesture = false; this.moved = false; }
    down(id, point, editing) {
        if (!this.points.size) {
            this.camera.stop_motion(); this.editing = editing; this.start = point;
            this.stroke = [this.camera.world_point(point.x, point.y)]; this.moved = false;
        }
        this.points.set(id, point);
        if (this.points.size > 1) { this.gesture = true; this.stroke = []; }
    }
    move(id, point) {
        if (!this.points.has(id)) return;
        const previous = this.points.get(id), before = this.points.size > 1 ? pair(this.points) : null;
        this.points.set(id, point);
        if (before) {
            const after = pair(this.points);
            this.camera.transform_gesture(before, after, after.distance / before.distance);
        } else if (!this.gesture) {
            const moved = this.moved || distance(this.start, point) > 4;
            if (!this.editing && moved) this.camera.pan_by(
                point.x - (this.moved ? previous.x : this.start.x),
                point.y - (this.moved ? previous.y : this.start.y));
            if (this.editing && distance(previous, point) > 1 && this.stroke.length < 2048) {
                this.stroke.push(this.camera.world_point(point.x, point.y));
            }
            this.moved = moved;
        }
    }
    up(id, point) {
        if (!this.points.has(id)) return;
        this.move(id, point); this.points.delete(id);
        if (this.points.size) return;
        const stroke = this.stroke, tap = !this.gesture && !this.moved;
        const commit = !this.gesture && this.editing;
        this.cancel();
        if (commit) this.paint(stroke);
        else if (tap) this.inspect(point);
    }
}
