import { MACHINES } from './machines.js';
import { technology_level } from './simulation.js';
import { water_return_plan } from './water_navigation.js';
import { MAX_FOOD_STORES } from './diets.js';

const COLLECTIONS = ['voyages', 'trades', 'machines'];
const selection_for = (collection, id) => ({ kind: 'ship', collection, id });
const is_ship = (collection, vessel) => collection === 'machines'
    ? vessel.kind === 'boat' : vessel.kind === 'ship';
const kingdom_of = (world, id) => world.villages.find(kingdom => kingdom.id === id) || null;

function selected_vessel(world, selection) {
    if (selection?.kind !== 'ship' || !COLLECTIONS.includes(selection.collection)) return null;
    return (world[selection.collection] || []).find(vessel => vessel.id === selection.id
        && is_ship(selection.collection, vessel)) || null;
}

// The same map anchors used by renderer.js; no simulation/cache refresh is needed.
export function ship_position(world, selection) {
    const vessel = selected_vessel(world, selection);
    if (!vessel) return null;
    if (selection.collection === 'machines') return { x: vessel.x, y: vessel.y };
    const from = selection.collection === 'trades' ? kingdom_of(world, vessel.from_id) : vessel;
    const to = selection.collection === 'trades' ? kingdom_of(world, vessel.to_id)
        : { x: vessel.target_x, y: vessel.target_y };
    if (!from || !to) return null; // The renderer also skips trades with missing endpoints.
    return { x: from.x + (to.x - from.x) * vessel.progress,
        y: from.y + (to.y - from.y) * vessel.progress };
}

// Inputs are continuous map coordinates. At equal distance, the last drawn ship wins.
export function ship_near(world, x, y, radius) {
    if (![x, y, radius].every(Number.isFinite) || radius < 0) return null;
    let nearest = null, distance = radius * radius;
    for (const collection of COLLECTIONS) for (const vessel of world[collection] || []) {
        if (!is_ship(collection, vessel)) continue;
        const selection = selection_for(collection, vessel.id);
        const point = ship_position(world, selection);
        if (!point) continue;
        const squared = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (squared <= distance) { nearest = selection; distance = squared; }
    }
    return nearest;
}

const endpoint = (point, label, kingdom_id = undefined) => point
    ? { x: point.x, y: point.y, label, ...(kingdom_id === undefined ? {} : { kingdom_id }) } : null;
const at_war = (world, first, second) => world.relations.some(relation => relation.status === 'war'
    && (relation.a === first && relation.b === second || relation.a === second && relation.b === first));

function boat_activity(world, boat, owner, crew) {
    if (boat.health <= 0 || !owner?.alive) return { activity: 'Awaiting removal',
        reason: 'The boat or its kingdom is no longer active.' };
    if (!crew.members.length) return { activity: 'Awaiting crew',
        reason: 'An actual living citizen must crew this boat before it can operate.' };
    if (!crew.aboard) return { activity: 'Boarding crew',
        reason: 'The assigned citizen has not boarded yet.' };
    const foe = technology_level(owner) >= 6 && world.people.find(person => person.health > 0
        && !person.voyage_id && !person.prisoner_of && at_war(world, person.village_id, owner.id)
        && Math.hypot(person.x - boat.x, person.y - boat.y) < 12);
    if (foe) return { activity: boat.cooldown > 0 ? 'Reloading coastal cannon'
        : owner.food > 2 ? 'Engaging nearby enemies' : 'Holding fire',
    reason: owner.food > 2 ? 'An enemy citizen is within the existing coastal cannon range.'
        : 'The coastal cannon requires more shared kingdom food to fire.' };
    if (boat.cargo > 0) {
        const plan = water_return_plan(world, boat, owner.buildings?.filter(building => building.type === 'dock') || []);
        const full = plan.harbor && Math.hypot(boat.x - plan.harbor.x, boat.y - plan.harbor.y) <= 0.2
            && owner.food + boat.cargo > MAX_FOOD_STORES;
        return { activity: full ? 'Waiting to unload' : plan.harbor ? 'Returning catch' : 'Carrying catch',
            reason: full ? 'Shared food stores are full; the catch remains aboard.'
                : plan.harbor ? 'Following a water route to a reachable kingdom dock.'
                    : plan.status === 'unreachable' ? 'No dock harbor is connected to this boat by water; the catch remains aboard.'
                        : 'No usable dock harbor is available; the catch remains aboard.',
            destination: endpoint(plan.harbor, `${owner.name} dock`, owner.id) };
    }
    return { activity: 'Fishing', reason: 'A crewed boat collects food on a bounded fishing timer.' };
}

// Missing records return null. Unmodeled hull health, passenger roles and cargo stay null.
export function ship_summary(world, selection) {
    const vessel = selected_vessel(world, selection), point = ship_position(world, selection);
    if (!vessel || !point) return null;
    const collection = selection.collection;
    const owner = kingdom_of(world, collection === 'trades' ? vessel.from_id : vessel.kingdom_id);
    const summary = { key: `${collection}:${vessel.id}`, selection: selection_for(collection, vessel.id),
        vessel, title: '', category: '', owner, point, health: null, crew: null, passengers: null,
        cargo: null, origin: null, destination: null, boarding_point: null, progress: null, route: null,
        activity: '', reason: '' };
    if (collection === 'voyages') {
        summary.title = 'Settler ship'; summary.category = 'Settlement voyage';
        summary.crew = { label: 'Settlers', aboard: true, members: (vessel.crew_ids || [])
            .map(id => world.people.find(person => person.id === id))
            .filter(person => person && person.health > 0) };
        summary.origin = endpoint(vessel, 'Departure point', owner?.id);
        summary.destination = endpoint({ x: vessel.target_x, y: vessel.target_y }, 'Proposed settlement', owner?.id);
        summary.activity = 'Sailing to settle';
        summary.reason = 'The settlers attempt to found a town on arrival; an invalid landing returns them home.';
    } else if (collection === 'trades') {
        const recipient = kingdom_of(world, vessel.to_id);
        summary.title = 'Trade ship'; summary.category = 'Trade shipment';
        summary.origin = endpoint(owner, owner?.name, owner?.id);
        summary.destination = endpoint(recipient, recipient?.name, recipient?.id);
        summary.cargo = { good: vessel.good, label: vessel.good === 'wood' ? 'Timber'
            : vessel.good[0].toUpperCase() + vessel.good.slice(1), amount: vessel.amount,
        sources: vessel.food_cargo?.food_stores ? { ...vessel.food_cargo.food_stores } : null };
        const cancelled = !recipient?.alive || at_war(world, vessel.from_id, vessel.to_id);
        summary.activity = cancelled ? 'Shipment awaiting review' : 'Delivering cargo';
        summary.reason = cancelled ? 'The next simulation step cancels or refunds an invalid shipment.'
            : 'An actual shipment moves between these kingdoms; no separate crew or hull health is modeled.';
    } else {
        const member = world.people.find(person => person.id === vessel.crew_id && person.health > 0);
        summary.title = 'Coastal boat'; summary.category = 'Fishing and coastal operations';
        summary.health = { current: vessel.health, max: MACHINES.boat.health };
        summary.crew = { label: 'Crew', aboard: !!vessel.crew_aboard, members: member ? [member] : [] };
        summary.cargo = { good: 'food', label: 'Food', amount: vessel.cargo, sources: null };
        Object.assign(summary, boat_activity(world, vessel, owner, summary.crew));
        if (!summary.crew.aboard && member && vessel.boarding) {
            summary.boarding_point = endpoint(vessel.boarding, 'Crew boarding point', owner?.id);
        }
    }
    if (collection !== 'machines') {
        summary.progress = vessel.progress;
        summary.route = { from: summary.origin, to: summary.destination, progress: vessel.progress };
    }
    return summary;
}
