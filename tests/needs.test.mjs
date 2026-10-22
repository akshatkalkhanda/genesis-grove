import test from 'node:test';
import assert from 'node:assert/strict';
import { World, T } from '../src/simulation.js';
import { needs_intent, decision_context, life_stage } from '../src/needs.js';
import { apply_trait } from '../src/character_traits.js';
import { creature_stats } from '../src/creatures.js';
import { add_food } from '../src/diets.js';

function fixture() {
    const world = new World({ preset: 'empty', inhabited: false, seed: 'phase-one-needs' });
    world.tiles.fill(T.GRASS);
    world.add_person(40,40);
    const person=world.people[0],kingdom=world.villages[0];person.trait_ids=[];
    for(const key of Object.keys(world.laws))world.laws[key]=false;
    return {world,person,kingdom};
}
const decide=(world,person,kingdom,dt=.125)=>needs_intent(world,person,dt,decision_context(world),kingdom);

test('hungry herbivores consume quantified plant stores and carnivores reject those stores',()=>{
    const {world,person,kingdom}=fixture();person.diet_id='herbivore';person.needs.nutrition=20;
    const before=kingdom.food;
    assert.equal(decide(world,person,kingdom).action,'Eating');
    assert.ok(person.needs.nutrition>40);assert.equal(kingdom.food,before-.9);
    person.diet_id='carnivore';person.needs.nutrition=20;person.needs.decision_timer=0;
    const stock=kingdom.food;
    assert.equal(decide(world,person,kingdom).action,'Seeking food');assert.equal(kingdom.food,stock);
    add_food(kingdom,'meat',2);person.needs.decision_timer=0;
    assert.equal(decide(world,person,kingdom).action,'Eating');assert.ok(kingdom.food_stores.meat<2);
});

test('no compatible food causes seeking then recorded starvation over simulation time',()=>{
    const {world,person,kingdom}=fixture();person.diet_id='carnivore';person.needs.nutrition=10;
    const before=person.health;
    for(let i=0;i<80;i++){world.time+=.125;decide(world,person,kingdom);}
    assert.equal(person.current_action,'Seeking food');assert.equal(person.needs.nutrition,0);
    assert.ok(person.health<before);assert.ok(person.health_history.some(event=>event.cause==='starvation'));
    assert.ok(person.action_reason.includes('compatible'));assert.ok(person.recent_events.length<=8);
});

test('grazing consumes finite vegetation and rest replenishes low energy',()=>{
    const {world,person,kingdom}=fixture();kingdom.food=0;person.diet_id='herbivore';person.needs.nutrition=20;
    const i=world.index(person.x,person.y),before=world.fertility[i];
    assert.equal(decide(world,person,kingdom).action,'Eating');assert.ok(world.fertility[i]<before);
    person.needs.nutrition=100;person.needs.energy=5;person.needs.decision_timer=0;
    assert.equal(decide(world,person,kingdom).action,'Resting');
    for(let i=0;i<120;i++){world.time+=.125;decide(world,person,kingdom);}
    assert.ok(person.needs.energy>80);
});

test('carnivores actually hunt wildlife and consume finite resulting meat',()=>{
    const {world,person,kingdom}=fixture();person.diet_id='carnivore';person.needs.nutrition=20;
    world.add_animal(40.5,40,'sheep');world.animals[0].health=10;
    apply_trait(person,'lucky');
    assert.equal(decide(world,person,kingdom).action,'Hunting');
    assert.ok(world.animals[0].health<=0);assert.equal(world.food_piles.length,1);
    const before=world.food_piles[0].amount;person.needs.decision_timer=0;
    assert.equal(decide(world,person,kingdom).action,'Eating');assert.ok(world.food_piles[0].amount<before);
});

test('danger takes precedence over hunger and fatigue',()=>{
    const {world,person,kingdom}=fixture();const enemy=world.found_village(43,40);
    world.add_person(42,40,enemy.id);world.people.at(-1).role='soldier';
    world.set_relation(kingdom.id,enemy.id,'war');person.needs.nutrition=10;person.needs.energy=5;
    assert.equal(decide(world,person,kingdom).action,'Escaping danger');
});

test('movement, strength, learning, regeneration and lifespan have actual effects',()=>{
    const {world,person,kingdom}=fixture();const x=person.x;person.dx=1;person.dy=0;
    apply_trait(person,'fast');world.move(person,.5,1);const fast=person.x-x;
    person.x=x;apply_trait(person,'slow');world.move(person,.5,1);assert.ok(fast>person.x-x);
    apply_trait(person,'strong');const strong=creature_stats(person).strength;
    apply_trait(person,'weak');assert.ok(creature_stats(person).strength<strong);
    person.age=100*world.year_length;assert.equal(life_stage(person,world.year_length),'Elder');
    apply_trait(person,'long_lived');assert.equal(life_stage(person,world.year_length),'Adult');
    person.health=50;person.needs.nutrition=100;apply_trait(person,'regeneration');
    decide(world,person,kingdom,1);assert.equal(person.health,50.5);
});

test('peaceful citizens avoid initiating combat while aggressive citizens attack',()=>{
    const {world,person,kingdom}=fixture();const enemy=world.found_village(80,40);
    world.add_person(80,40,enemy.id);world.set_relation(kingdom.id,enemy.id,'war');
    person.x=79;person.needs.nutrition=100;
    apply_trait(person,'peaceful');const peaceful=World.deserialize(world.serialize());
    world.set_character_trait('person',person.id,'aggressive',true);
    world.step(.125);peaceful.step(.125);
    assert.ok(world.people[1].health<peaceful.people[1].health);
});

test('needs and decisions survive exact save/resume; equivalent simulation steps match',()=>{
    const {world}=fixture();for(let i=0;i<80;i++)world.step(.125);
    const saved=world.serialize(),restored=World.deserialize(saved);
    assert.deepEqual(restored.serialize(),saved);
    for(let i=0;i<80;i++){world.step(.125);restored.step(.125);}
    assert.deepEqual(restored.serialize(),world.serialize());
    const paused=restored.serialize();assert.deepEqual(restored.serialize(),paused);
});

test('legacy saves gain safe defaults and malformed new state is rejected',()=>{
    const {world}=fixture(),legacy=world.serialize();
    delete legacy.food_piles;delete legacy.villages[0].food_stores;
    for(const unit of legacy.people)for(const key of ['trait_ids','diet_id','needs','current_action','action_reason','recent_events'])delete unit[key];
    const restored=World.deserialize(legacy);assert.equal(restored.people[0].diet_id,'omnivore');
    assert.equal(restored.people[0].id,legacy.people[0].id);assert.deepEqual(restored.people[0].trait_ids,[]);
    const bad=restored.serialize();bad.people[0].needs.nutrition=-1;
    assert.throws(()=>World.deserialize(bad),/valid Genesis/);
});
