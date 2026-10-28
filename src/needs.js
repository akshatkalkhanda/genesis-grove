import { WATER, initialize_water, water_intent, service_water } from './drinking_water.js';
import { creature_stats } from './creatures.js';
import { trait_modifiers, trait_probability } from './character_traits.js';
import { initialize_diet, consume_food, diet_food_available } from './diets.js';
import { apply_damage } from './health.js';
import { find_path } from './pathfinding.js';

export const NEEDS_BALANCE = Object.freeze({ hunger_rate: 7, wildlife_hunger_rate: 1,
    hungry: 55, meal_nutrition: 35, starvation_per_second: 2,
    tired: 20, rested: 85, rest_per_second: 6, decision_seconds: 0.75, hunt_hit_probability: 0.9,
    vegetation_food_per_fertility: 40, idle_energy_per_second: 0.2, route_budget: 512, route_candidates: 8 });
const PLANTS = new Set([3, 4, 9, 10, 12, 13, 15]);
const CARNIVORES = new Set(['wolf', 'fox', 'cat', 'hyena', 'owl']);
const OMNIVORES = new Set(['bear', 'boar', 'chicken', 'turtle', 'lizard', 'frog', 'beetle']);
const clamp = value => Math.max(0, Math.min(100, value));
export function initialize_needs(unit) {
    if (unit.diet_id === undefined && unit.species) unit.diet_id = CARNIVORES.has(unit.species)
        ? 'carnivore' : OMNIVORES.has(unit.species) ? 'omnivore' : 'herbivore';
    initialize_diet(unit);
    unit.needs ||= { nutrition: 85, energy: unit.daily_life?.energy ?? 90,
        decision_timer: 0, resting: false, intent: null };
    initialize_water(unit);
    unit.current_action ||= unit.task || 'Exploring';
    unit.action_reason ||= 'Looking for useful activity.';
    unit.recent_events ||= [];
    return unit.needs;
}
export function note_event(world, unit, text) {
    unit.recent_events ||= [];
    if (unit.recent_events.at(-1)?.text === text) return;
    unit.recent_events.push({ time: world.time, text: text.slice(0, 160) });
    if (unit.recent_events.length > 8) unit.recent_events.shift();
}
export function set_action(world, unit, action, reason) {
    initialize_needs(unit);
    if (unit.current_action !== action) note_event(world, unit, `${action}: ${reason}`);
    unit.current_action = action; unit.action_reason = reason; unit.task = action;
}
export function life_stage(unit, year_length) {
    const age = unit.age / year_length, adult = unit.species ? 5 : 18;
    const elder = (unit.species ? 50 : 85) * trait_modifiers(unit).lifespan;
    return age < adult ? 'Young' : age < elder ? 'Adult' : 'Elder';
}
export function decision_context(world) {
    const people = new Map(), animals = new Map();
    for (const [units, buckets] of [[world.people, people], [world.animals, animals]]) {
        for (const unit of units) if (unit.health > 0 && !unit.voyage_id && !unit.prisoner_of) {
            const key = `${Math.floor(unit.x / 12)},${Math.floor(unit.y / 12)}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(unit);
        }
    }
    return { people, animals };
}
export function neighbors(buckets, unit, radius = 12) {
    const found = [], bx = Math.floor(unit.x / 12), by = Math.floor(unit.y / 12);
    const span = Math.ceil(radius / 12);
    for (let dx = -span; dx <= span; dx++) for (let dy = -span; dy <= span; dy++) {
        for (const other of buckets.get(`${bx + dx},${by + dy}`) || []) {
            if (other !== unit && other.health > 0 && Math.hypot(other.x - unit.x, other.y - unit.y) <= radius) found.push(other);
        }
    }
    return found;
}
export function food_drop(world, animal) {
    if (animal.health > 0 || animal.food_yielded || ['angel', 'demon'].includes(animal.species)) return;
    animal.food_yielded = true;
    world.food_piles ||= [];
    if (world.food_piles.length >= 256) return;
    world.food_piles.push({ id: world.next_id++, x: animal.x, y: animal.y,
        source: 'meat', amount: 5, age: 0 });
}
function compatible(unit, source) {
    return unit.diet_id === 'omnivore' || unit.diet_id === (source === 'meat' ? 'carnivore' : 'herbivore');
}
function eat(world, unit, kingdom, amount, source = null, pile = null) {
    let consumed = false;
    if (pile && pile.amount >= amount) { pile.amount -= amount; consumed = true; }
    else if (source === 'plant') {
        const index = world.index(unit.x, unit.y);
        if (PLANTS.has(world.tiles[index]) && world.fertility[index] * NEEDS_BALANCE.vegetation_food_per_fertility >= amount) {
            world.fertility[index] = Math.max(0, world.fertility[index] - amount / NEEDS_BALANCE.vegetation_food_per_fertility); consumed = true;
        }
    } else if (kingdom) consumed = consume_food(kingdom, unit, amount);
    if (!consumed) return false;
    unit.needs.nutrition = clamp(unit.needs.nutrition + NEEDS_BALANCE.meal_nutrition);
    unit.health = Math.min(creature_stats(unit, world.year_length).max_health, unit.health + 0.5);
    note_event(world, unit, `Ate ${source || 'compatible stored'} food.`);
    return true;
}
function reachable(world, unit, point) {
    if (!world.walkable(point.x, point.y)) return false;
    const from = world.index(unit.x, unit.y), to = world.index(point.x, point.y);
    if (from === to) return true;
    if (world._army_masses && world._army_masses_revision === world.navigation_revision
        && world._army_masses[from] !== world._army_masses[to]) return false;
    return find_path(world, unit, point, NEEDS_BALANCE.route_budget).length > 0;
}
function nearest_reachable(world, unit, candidates) {
    return candidates.sort((a, b) => Math.hypot(a.x - unit.x, a.y - unit.y)
        - Math.hypot(b.x - unit.x, b.y - unit.y))
        .slice(0, NEEDS_BALANCE.route_candidates).find(point => reachable(world, unit, point));
}
const target = (unit, point, action, reason) => ({ x: point.x, y: point.y, route: true,
    action, reason, holding: Math.hypot(unit.x - point.x, unit.y - point.y) <= 1 });

// Called once per fixed simulation step. Expensive choices are staggered by a saved cooldown.
export function needs_intent(world, unit, dt, context, kingdom = null, home = null) {
    const needs = initialize_needs(unit), balance = NEEDS_BALANCE;
    const modifiers = trait_modifiers(unit);
    if (!unit.species) needs.hydration = clamp(needs.hydration - dt * WATER.thirst_rate);
    needs.nutrition = clamp(needs.nutrition - dt * (unit.species ? balance.wildlife_hunger_rate : balance.hunger_rate));
    if (unit.daily_life) needs.energy = unit.daily_life.energy;
    else needs.energy = clamp(needs.energy - dt * balance.idle_energy_per_second);
    needs.decision_timer = Math.max(0, needs.decision_timer - dt);
    if (needs.nutrition <= 0) apply_damage(world, unit, dt * balance.starvation_per_second, 'starvation');
    if (!unit.species && needs.hydration <= 0) apply_damage(world, unit, dt * WATER.dehydration_per_second, 'dehydration');
    if (modifiers.regen > 0 && needs.nutrition > 0 && (unit.species || needs.hydration > 0)) unit.health = Math.min(
        creature_stats(unit, world.year_length).max_health, unit.health + dt * modifiers.regen);
    if (unit.health <= 0) return null;
    if (unit.voyage_id || unit.prisoner_of || world._justice_custody?.has(unit.id) || world._crew_assignments?.get(unit.id)?.crew_aboard) {
        if (needs.nutrition <= balance.hungry && kingdom) eat(world, unit, kingdom,
            (unit.role === 'soldier' ? 1.7 : .9) * modifiers.meal);
        if (!unit.species && needs.hydration <= WATER.thirsty && needs.decision_timer <= 0) {
            if (service_water(world, unit, kingdom)) note_event(world, unit, 'Drank a finite water ration.');
            needs.decision_timer = balance.decision_seconds;
        }
        return null;
    }
    const fire = world.fire[world.index(unit.x, unit.y)] > 0;
    // Only evaluate nearby danger at a decision boundary; never scan the whole population.
    if (needs.decision_timer <= 0 || fire && needs.intent?.action !== 'Escaping danger') {
        needs.decision_timer = balance.decision_seconds;
        const danger = unit.species ? neighbors(context.animals, unit, 4).find(other => CARNIVORES.has(other.species)
            && !CARNIVORES.has(unit.species)) : neighbors(context.people, unit, 6).find(other => other.role === 'soldier'
            && world.relation_status(unit.village_id, other.village_id) === 'war');
        const should_escape = fire || danger && (unit.role !== 'soldier' && modifiers.aggression !== 'aggressive'
            || unit.health < creature_stats(unit, world.year_length).max_health * 0.35);
        if (should_escape) {
            const dx = danger ? unit.x - danger.x : 1, dy = danger ? unit.y - danger.y : 1;
            const length = Math.hypot(dx, dy) || 1;
            const angle = Math.atan2(dy / length, dx / length);
            const escapes = [0, .5, -.5, 1, -1, 2, -2, Math.PI].map(turn => ({
                x: Math.max(.5, Math.min(world.width - .5, unit.x + Math.cos(angle + turn) * 5)),
                y: Math.max(.5, Math.min(world.tiles.length / world.width - .5,
                    unit.y + Math.sin(angle + turn) * 5))
            }));
            const escape = escapes.find(point => !world.fire[world.index(point.x, point.y)]
                && reachable(world, unit, point));
            const reason = fire ? 'The current tile is burning.' : 'A nearby enemy threatens survival.';
            needs.intent = escape ? target(unit, escape, 'Escaping danger', reason)
                : { action: 'Escaping danger', reason: `${reason} No safe route is available.`, holding: false };
        } else needs.intent = null;
        if (!needs.intent && !unit.species && needs.hydration <= WATER.critical && needs.nutrition > 25) {
            needs.intent = water_intent(world, unit);
        }
        if (!needs.intent && needs.nutrition <= balance.hungry) {
            const meal = (unit.role === 'soldier' ? 1.7 : .9) * modifiers.meal;
            if (kingdom && diet_food_available(kingdom, unit) >= meal && eat(world, unit, kingdom, meal)) {
                needs.intent = { action: 'Eating', reason: 'Compatible shared supplies are available.', holding: true };
            } else {
                const pile = nearest_reachable(world, unit, (world.food_piles || []).filter(p =>
                    p.amount >= meal && compatible(unit, p.source) && Math.hypot(p.x-unit.x,p.y-unit.y) <= 16));
                if (pile) {
                    if (Math.hypot(pile.x-unit.x,pile.y-unit.y) <= 1.25 && eat(world,unit,kingdom,meal,pile.source,pile)) {
                        needs.intent = { action: 'Eating', reason: 'Consuming a finite food pile.', holding: true };
                    } else needs.intent = target(unit,pile,'Seeking food','A compatible food pile is nearby.');
                } else if (compatible(unit,'plant')) {
                    const index = world.index(unit.x,unit.y);
                    if (PLANTS.has(world.tiles[index]) && world.fertility[index]*balance.vegetation_food_per_fertility >= meal && eat(world,unit,kingdom,meal,'plant')) {
                        needs.intent = { action:'Eating',reason:'Grazing consumes local vegetation.',holding:true };
                    } else {
                        const candidates = [];
                        for(let dy=-10;dy<=10;dy++) for(let dx=-10;dx<=10;dx++) {
                            const x=unit.x+dx,y=unit.y+dy,i=world.index(x,y);
                            if(world.walkable(x,y) && PLANTS.has(world.tile(x,y))
                                && world.fertility[i]*balance.vegetation_food_per_fertility>=meal) candidates.push({x,y});
                        }
                        const best = nearest_reachable(world, unit, candidates);
                        needs.intent=best ? target(unit,best,'Seeking food','Looking for edible vegetation.')
                            : {action:'Seeking food',reason:'No compatible food is within reach.',holding:false};
                    }
                } else {
                    const prey = nearest_reachable(world, unit, neighbors(context.animals,unit,14).filter(other=>other.health>0
                        && !['angel','demon'].includes(other.species) && other.species!==unit.species
                        && world.walkable(other.x,other.y)));
                    if(prey) {
                        if(Math.hypot(prey.x-unit.x,prey.y-unit.y)<=1.5 && (world.index(unit.x,unit.y)===world.index(prey.x,prey.y) || find_path(world,unit,prey,128).length)) {
                            const hit = world.random() < trait_probability(unit,balance.hunt_hit_probability);
                            if(hit) apply_damage(world,prey,Math.max(5,creature_stats(unit,world.year_length).strength*1.5),'predation');
                            food_drop(world,prey);
                            needs.intent={action:'Hunting',reason:'Hungry carnivore needs animal food.',holding:true};
                        } else needs.intent=target(unit,prey,'Seeking food','Hunting nearby wildlife for meat.');
                    } else needs.intent={action:'Seeking food',reason:'No compatible animal food is nearby.',holding:false};
                }
            }
        }
        if (!needs.intent && !unit.species && needs.hydration <= WATER.thirsty) needs.intent = water_intent(world, unit);
        if(!needs.intent && (needs.energy<=balance.tired || needs.resting)) {
            needs.resting=needs.energy<balance.rested;
            if(needs.resting) needs.intent={action:'Resting',reason:'Energy is low; recovering before work.',holding:true};
        }
    }
    const intent=needs.intent;
    if(intent?.action==='Resting') {
        needs.energy=clamp(needs.energy+dt*balance.rest_per_second);
        if(unit.daily_life) unit.daily_life.energy=needs.energy;
        if(needs.energy>=balance.rested) {needs.resting=false;needs.intent=null;needs.decision_timer=0;}
    }
    if(intent) set_action(world,unit,intent.action,intent.reason);
    return intent;
}
export function valid_needs(unit, time) {
    const n=unit.needs,number=(value,max)=>Number.isFinite(value)&&value>=0&&value<=max;
    if (unit.water_carried !== undefined && (!Number.isInteger(unit.water_carried) || !number(unit.water_carried, WATER.carry_capacity))) return false;
    if(n!==undefined && (!n || (n.hydration !== undefined && !number(n.hydration,100)) || !number(n.nutrition,100) || !number(n.energy,100)
        || !number(n.decision_timer,2) || typeof n.resting!=='boolean'
        || (n.intent!==null && (!n.intent || typeof n.intent.action!=='string' || n.intent.action.length>60
            || typeof n.intent.reason!=='string' || n.intent.reason.length>160 || typeof n.intent.holding!=='boolean'
            || ((n.intent.x!==undefined || n.intent.y!==undefined)
                && (!number(n.intent.x,191.999)||!number(n.intent.y,127.999))))))) return false;
    return (unit.current_action===undefined || typeof unit.current_action==='string'&&unit.current_action.length<=60)
        && (unit.action_reason===undefined || typeof unit.action_reason==='string'&&unit.action_reason.length<=160)
        && (unit.recent_events===undefined || Array.isArray(unit.recent_events)&&unit.recent_events.length<=8
            &&unit.recent_events.every(e=>e&&number(e.time,time)&&typeof e.text==='string'&&e.text.length<=160))
        &&(unit.food_yielded===undefined||typeof unit.food_yielded==='boolean');
}
