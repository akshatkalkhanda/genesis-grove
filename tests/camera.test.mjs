import test from 'node:test';
import assert from 'node:assert/strict';
import { Camera, MIN_ZOOM, MAX_ZOOM } from '../src/camera.js';
import { TouchCamera } from '../src/touch_camera.js';
import { map_detail } from '../src/map_readability.js';

function camera() { const c = new Camera(192, 128); c.set_viewport(1366, 720); return c; }
function settle(c) { for (let i = 0; i < 120; i++) c.update_camera(1 / 60); }
function near(a, b, message) { assert.ok(Math.abs(a - b) < 0.000001, `${message}: ${a} != ${b}`); }

test('animated zoom retains the off-center landmark throughout every frame', () => {
    const c = camera(), screen = { x: 430, y: 330 }, anchor = c.world_point(screen.x, screen.y);
    c.zoom_at(3, screen.x, screen.y); assert.equal(c.zoom, 1);
    let previous = c.zoom;
    for (let i = 0; i < 120; i++) {
        c.update_camera(1 / 60);
        assert.ok(c.zoom >= previous && c.zoom <= 3); previous = c.zoom;
        near(c.world_point(screen.x, screen.y).x, anchor.x, 'horizontal anchor');
        near(c.world_point(screen.x, screen.y).y, anchor.y, 'vertical anchor');
    }
    assert.equal(c.zoom, 3); assert.equal(c.motion, null);
});

test('rapid zoom accumulates toward target, retargeting does not jump and Fit cancels motion', () => {
    const c = camera();
    c.zoom_at(1.15); c.zoom_at(1.15); c.zoom_at(1.15);
    near(c.zoom_goal, 1.15 ** 3, 'accumulated input');
    c.update_camera(.02); const before = [c.zoom, c.pan_x, c.pan_y];
    c.zoom_at(1.2, 600, 300); assert.deepEqual([c.zoom, c.pan_x, c.pan_y], before);
    c.fit(); settle(c); assert.deepEqual([c.zoom, c.pan_x, c.pan_y], [1, 0, 0]);
    c.zoom_at(2); c.update_camera(.02); c.pan_by(30, -15);
    const panned = [c.zoom, c.pan_x, c.pan_y]; settle(c);
    assert.deepEqual([c.zoom, c.pan_x, c.pan_y], panned);
});

test('zoom bounds, reduced motion and resize preserve a usable finite camera', () => {
    const c = camera(); c.reduced_motion = true;
    c.zoom_at(1e10); assert.equal(c.zoom, MAX_ZOOM); assert.equal(c.motion, null);
    c.zoom_at(1e-10); assert.equal(c.zoom, MIN_ZOOM);
    c.focus(80, 55, 4);
    c.set_viewport(1024, 720);
    near(c.world_point(512, 360).x, 80, 'resize center x');
    near(c.world_point(512, 360).y, 55, 'resize center y');
    c.pan_by(1e10, -1e10);
    const o = c.origin, w = c.world_width * c.cell * c.scale, h = c.world_height * c.cell * c.scale;
    assert.ok(o.x < c.width && o.x + w > 0 && o.y < c.height && o.y + h > 0);
    const before = [c.zoom, c.pan_x, c.pan_y];
    for (const invalid of [NaN, Infinity, 0, -1]) c.zoom_at(invalid);
    assert.deepEqual([c.zoom, c.pan_x, c.pan_y], before);
});

test('pinch scales and translates about its moving midpoint with subpixel accuracy', () => {
    const c = camera(), from = { x: 500, y: 350 }, to = { x: 570, y: 390 };
    const anchor = c.world_point(from.x, from.y);
    c.transform_gesture(from, to, 2.5);
    assert.equal(c.zoom, 2.5);
    near(c.world_point(to.x, to.y).x, anchor.x, 'pinch anchor x');
    near(c.world_point(to.x, to.y).y, anchor.y, 'pinch anchor y');
});

function gestures() {
    const c = camera(), inspected = [], painted = [];
    return { c, inspected, painted, t: new TouchCamera(c, {
        inspect: point => inspected.push(point), paint: stroke => painted.push(stroke)
    }) };
}

test('late second touch cancels the whole buffered brush and lifting fingers never paints', () => {
    const { c, t, inspected, painted } = gestures();
    t.down(1, { x: 400, y: 330 }, true);
    t.move(1, { x: 420, y: 350 }); t.move(1, { x: 440, y: 350 });
    assert.equal(painted.length, 0); assert.ok(t.stroke.length > 1);
    t.down(2, { x: 600, y: 350 }, true);
    t.move(2, { x: 680, y: 350 });
    assert.ok(c.zoom > 1); assert.equal(t.stroke.length, 0);
    t.up(2, { x: 680, y: 350 });
    t.move(1, { x: 460, y: 350 }); t.up(1, { x: 460, y: 350 });
    assert.deepEqual(painted, []); assert.deepEqual(inspected, []);
    t.down(3, { x: 450, y: 300 }, false); t.up(3, { x: 450, y: 300 });
    assert.equal(inspected.length, 1, 'a fresh single tap still inspects');
});

test('touch brush commits only on lift, while cancellation and navigation never commit', () => {
    const { c, t, inspected, painted } = gestures();
    t.down(1, { x: 400, y: 330 }, true); t.move(1, { x: 430, y: 350 });
    assert.equal(painted.length, 0); t.up(1, { x: 450, y: 350 });
    assert.equal(painted.length, 1); assert.equal(painted[0].length, 3);
    t.down(1, { x: 400, y: 330 }, true); t.cancel(); t.up(1, { x: 430, y: 350 });
    assert.equal(painted.length, 1);
    const before = c.pan_x;
    t.down(1, { x: 400, y: 330 }, false); t.move(1, { x: 460, y: 350 }); t.up(1, { x: 460, y: 350 });
    assert.ok(c.pan_x > before); assert.deepEqual(inspected, []); assert.equal(painted.length, 1);
});

test('third finger and either lift order cannot turn a pinch into a brush', () => {
    for (const order of [[1, 2, 3], [3, 2, 1]]) {
        const { t, painted, inspected } = gestures();
        for (let id = 1; id <= 3; id++) t.down(id, { x: 300 + id * 100, y: 350 }, true);
        t.move(2, { x: 650, y: 360 });
        for (const id of order) t.up(id, { x: 300 + id * 100, y: 350 });
        assert.deepEqual(painted, []); assert.deepEqual(inspected, []);
    }
});

test('visibility depends on actual tile pixels, with no activity/name clutter at overview', () => {
    assert.deepEqual(map_detail(1), { level: 'world', buildings: false, people: false, activities: false, names: false });
    assert.equal(map_detail(2).level, 'town'); assert.equal(map_detail(2).activities, false);
    assert.equal(map_detail(5).level, 'citizen'); assert.equal(map_detail(5).names, false);
    assert.equal(map_detail(8).activities, true); assert.equal(map_detail(8).names, true);
});

test('finishing motion for reduced preference retains the original pointer anchor', () => {
    const c = camera(), p = { x: 430, y: 330 }, anchor = c.world_point(p.x, p.y);
    c.zoom_at(3, p.x, p.y); c.update_camera(.02); c.finish_motion();
    assert.equal(c.zoom, 3); assert.equal(c.motion, null);
    near(c.world_point(p.x, p.y).x, anchor.x, 'reduced-motion anchor x');
    near(c.world_point(p.x, p.y).y, anchor.y, 'reduced-motion anchor y');
});
