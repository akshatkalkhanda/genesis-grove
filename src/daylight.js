export const DAY_LENGTHS = [600, 1440, 86400];

export function advance_daylight(clock, seconds, speed = 1) {
    const cycle = clock.cycle_seconds;
    // Even at maximum simulation speed, a lighting cycle takes at least 3 minutes.
    const rate = Math.min(Math.max(1, speed), cycle / 180);
    clock.phase = (clock.phase + seconds * rate / cycle) % 1;
}

export function night_opacity(phase) {
    const sun = Math.sin((phase - 0.25) * Math.PI * 2);
    const daylight = Math.max(0, Math.min(1, (sun + 0.3) / 0.8));
    const smooth = daylight * daylight * (3 - 2 * daylight);
    return (1 - smooth) * 0.42;
}
