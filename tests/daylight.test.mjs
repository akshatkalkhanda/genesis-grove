import test from 'node:test';
import assert from 'node:assert/strict';
import { advance_daylight, night_opacity } from '../src/daylight.js';

test('fast simulation speed never makes a lighting cycle shorter than three minutes', () => {
    const clock = { phase: 0, cycle_seconds: 600 };
    advance_daylight(clock, 60, 20);
    assert.ok(Math.abs(clock.phase - 1 / 3) < 0.0001);
    const slow = { phase: 0, cycle_seconds: 86400 };
    advance_daylight(slow, 3600, 1);
    assert.equal(slow.phase, 1 / 24);
});
test('night remains readable and dawn and dusk change smoothly', () => {
    assert.equal(night_opacity(0.5), 0);
    assert.equal(night_opacity(0), 0.42);
    assert.ok(Math.abs(night_opacity(0.25) - night_opacity(0.25001)) < 0.001);
});
