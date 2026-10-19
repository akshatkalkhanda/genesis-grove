import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { flag_design } from '../src/heraldry.js';

test('kingdom flags remain stable through ruler succession and saved worlds', () => {
    const world = new World({ preset: 'empty', inhabited: false }); world.tiles.fill(T.GRASS);
    world.add_person(50, 50); const kingdom = world.villages[0];
    world.add_person(51, 50, kingdom.id); world.add_person(52, 50, kingdom.id);
    const first = kingdom.king_id, banner = flag_design(kingdom);
    world.people[2].xp = 100;
    world.people.find(person => person.id === first).health = 0;
    world.clean_up();
    assert.equal(kingdom.king_id, world.people[1].id);
    assert.deepEqual(flag_design(kingdom), banner);
    assert.ok(world.events.some(event => event.text.includes('becomes ruler')));
    const restored = World.deserialize(world.serialize());
    assert.equal(restored.villages[0].king_id, kingdom.king_id);
    assert.deepEqual(flag_design(restored.villages[0]), banner);
    assert.notDeepEqual(flag_design(world.found_village(80, 50)), banner);
});
