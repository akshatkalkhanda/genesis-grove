export const MIN_ZOOM = 0.65;
export const MAX_ZOOM = 24;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Camera state is presentation only: coordinates are CSS pixels and world tiles.
export class Camera {
    constructor(world_width, world_height, cell = 6) {
        this.world_width = world_width; this.world_height = world_height; this.cell = cell;
        this.width = 0; this.height = 0; this.base = 1;
        this.zoom = 1; this.pan_x = 0; this.pan_y = 0; this.motion = null;
        this.reduced_motion = false;
    }
    get scale() { return this.base * this.zoom; }
    get zoom_goal() { return this.motion?.zoom || this.zoom; }
    get origin() {
        return { x: (this.width - this.world_width * this.cell * this.scale) / 2 + this.pan_x,
            y: (this.height - this.world_height * this.cell * this.scale) / 2 + this.pan_y };
    }
    world_point(x, y) {
        const origin = this.origin;
        return { x: (x - origin.x) / this.cell / this.scale,
            y: (y - origin.y) / this.cell / this.scale };
    }
    set_viewport(width, height) {
        const center = this.width && this.height ? this.world_point(this.width / 2, this.height / 2) : null;
        this.stop_motion(); this.width = Math.max(1, width); this.height = Math.max(1, height);
        this.base = Math.min(this.width / (this.world_width * this.cell),
            this.height / (this.world_height * this.cell)) * 0.93;
        if (center) this.place(center, { x: this.width / 2, y: this.height / 2 });
        this.clamp_pan();
    }
    place(point, screen) {
        this.pan_x = screen.x - this.width / 2 - (point.x - this.world_width / 2) * this.cell * this.scale;
        this.pan_y = screen.y - this.height / 2 - (point.y - this.world_height / 2) * this.cell * this.scale;
    }
    clamp_pan() {
        const w = this.world_width * this.cell * this.scale;
        const h = this.world_height * this.cell * this.scale;
        // Retain a visible portion of the map even after a very large drag.
        const x = (w + this.width) / 2 - Math.min(w, this.width) * 0.25;
        const y = (h + this.height) / 2 - Math.min(h, this.height) * 0.25;
        this.pan_x = clamp(this.pan_x, -x, x); this.pan_y = clamp(this.pan_y, -y, y);
    }
    stop_motion() { this.motion = null; }
    finish_motion() {
        if (!this.motion) return;
        const { zoom, point, screen } = this.motion;
        this.stop_motion(); this.zoom = zoom; this.place(point, screen); this.clamp_pan();
    }
    zoom_at(multiplier, x = this.width / 2, y = this.height / 2, immediate = false) {
        if (!Number.isFinite(multiplier) || multiplier <= 0) return;
        const zoom = clamp(this.zoom_goal * multiplier, MIN_ZOOM, MAX_ZOOM);
        const point = this.world_point(x, y), screen = { x, y };
        if (immediate || this.reduced_motion) {
            this.stop_motion(); this.zoom = zoom; this.place(point, screen); this.clamp_pan();
        } else this.motion = { zoom, point, screen };
    }
    update_camera(dt) {
        if (!this.motion) return false;
        const { zoom, point, screen } = this.motion;
        const gap = Math.log(zoom / this.zoom);
        this.zoom = Math.abs(gap) < 0.0001 ? zoom
            : this.zoom * Math.exp(gap * (1 - Math.exp(-Math.max(0, dt) / 0.055)));
        if (Math.abs(Math.log(zoom / this.zoom)) < 0.0001) { this.zoom = zoom; this.stop_motion(); }
        this.place(point, screen); this.clamp_pan(); return true;
    }
    transform_gesture(from, to, multiplier) {
        const point = this.world_point(from.x, from.y);
        this.stop_motion(); this.zoom = clamp(this.zoom * multiplier, MIN_ZOOM, MAX_ZOOM);
        this.place(point, to); this.clamp_pan();
    }
    pan_by(x, y) {
        this.stop_motion(); this.pan_x += x; this.pan_y += y; this.clamp_pan();
    }
    fit() { this.stop_motion(); this.zoom = 1; this.pan_x = 0; this.pan_y = 0; }
    focus(x, y, zoom = 2.4) {
        this.stop_motion(); this.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM); this.center_on(x, y);
    }
    center_on(x, y) {
        this.stop_motion(); this.place({ x, y }, { x: this.width / 2, y: this.height / 2 }); this.clamp_pan();
    }
}
