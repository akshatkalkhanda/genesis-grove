# Simulation roadmap

## Repository audit

Genesis Grove uses plain ES modules, Canvas2D and Electron. `World` in
`src/simulation.js` owns seeded randomness and fixed-step simulation updates.
`src/app.js` accumulates real frame time multiplied by the chosen speed, advances
0.125-second steps, and stops advancing when paused or in a modal. Renderer and
inspectors project state without advancing the simulation. Named saves, recovery
copies and imports use `World.serialize()`/`deserialize()` through IndexedDB-backed
`save_store.js` and `save_ui.js`. Validation and migration belong in World.

Already present: five primary traits, inherited aptitudes, named people and animals,
experience, combat stats, ageing, health and damage histories; shared food and
starvation; civilian work/rest/social routines and bounded carried goods;
relationships and parent records; farming, storage, industry, homes, villages,
kingdoms, technology, rulers, diplomacy, armies, sieges, disasters and god tools.

Missing before Phase1: extensible additional trait definitions with conflicts and
inheritance metadata; compatible typed foods and diets; a consistent visible
nutrition/energy model across creatures; survival-led decisions with reasons and
short personal event history. Existing routines are reused rather than replaced.
The larger trait and specialist-diet catalogue discussed earlier is later work;
this phase implements the focused initial set below with real effects.

## Phase1 — traits, diets, needs and decisions

Status: implemented and verified in 0.27.0; 0.28.0 addresses native play-review
findings in [the follow-up report](play-review-fixes.md).

- Stable configurable trait IDs, categories, descriptions, effects, inheritance
  probabilities and incompatibilities. Keep existing primary traits and ancestry.
- Initial traits: Lucky/Unlucky, Strong/Weak, Fast/Slow, Genius/Stupid, Long-lived,
  Regeneration, Thief/Honest and Peaceful/Aggressive. Probability modifiers use the
  world's seeded RNG at actual opportunities, remain bounded and never roll while
  merely inspecting a creature. Stat and behavior descriptions match our own rules.
- Herbivores eat plant foods, carnivores eat animal foods, omnivores eat both.
  Food availability and consumption are actual quantities. The ledger accommodates
  later fish-, fruit- and insect-specialist diets without inventing those resources.
- Nutrition, energy, life stages, natural lifespan and health evolve in simulation
  time. Hungry creatures seek compatible food; eating consumes it; starvation
  damages health; tired creatures rest. Safe legacy defaults preserve old saves.
- Immediate danger and survival take priority over normal work, social activity,
  exploration and trait opportunities. Decisions have cooldowns. Spatial lookups
  bound new neighbor searches instead of adding creature-pair scans every frame.
- Existing creature inspection shows traits and their effects, diet, needs, age,
  health, action, reason and a bounded recent-events history. Explicit trait/diet
  editing remains a sandbox action; opening a card or catalogue changes no state.

Acceptance: incompatibilities, diet restrictions, finite consumption, hunger and
starvation, trait effects, conserved theft, pause/speed consistency, deterministic
save/resume, old-save loading and compact native UI must be verified before release.

## Phase2 — reproduction and social identity

Existing: adult pair selection, close-kin exclusion, births with parent identities,
primary inherited aptitudes and bounded friendship records. Extend these into
additional-trait inheritance and mutations, subspecies, navigable families,
richer friendships/relationships and emotions. Add the remaining personality,
body, immunity, special/acquired and specialist feeding traits only with honest
implemented effects and compatibility rules.

## Phase3 — economy and settlement life

Existing: gathering, farming, shared stores, carried goods, construction, equipment,
experience, villages and population growth. Improve production/consumption balance,
distribution to outposts, deeper food distribution and storage, equipment ownership and
larger-settlement performance. Preserve finite goods and explain shortages.

## Phase4 — societies and politics

Existing: kingdoms, adult kings and succession, simple cultures, diplomacy,
alliances, wars, rebellion and local/capital conquest. Add clans, languages,
religions, loyalty, deeper succession/culture and explainable political decisions.
The read-only Ship Inspector follows the land-campaign foundation; military
transport remains planned as assemble → embark → sail → land → attack/return.
See the scoped [naval milestones](roadmap.md#naval-milestones).

## Phase5 — world and player systems

Existing: biomes, wildlife, infection/medicine, technology ages, localized weather,
bounded fire/tsunamis, configurable laws, god powers, history and population stats.
Develop ecosystem carrying capacity, disease depth, richer world ages and hazards,
more laws, unit possession, richer historical records and population analysis.

## Next milestone — lively towns and outward growth

The settlement voyage system already sends people to found towns, but expansion
was unchecked in new sandbox setup, so ordinary worlds stayed clustered around
their starting kingdoms. New worlds now enable expansion by default; players can
still turn it off in the world laws. Older saves retain their saved law setting.
The world overview reports both kingdoms and towns so settlement growth is visible.

Build the next civic-life milestone in small, behavior-backed steps:

1. Add town exploration as a visible, bounded outing, with discoveries and new
   settlement sites recorded in the chronicle. Reuse existing settler voyages,
   travel routes, and town ownership.
2. Extend the working Thief trait into a crime record and add civilian police
   patrols, evidence-based arrests, and a distinct criminal jail system. Keep
   current war-captive prisons separate and preserve resource/person accounting.
3. Add safe social events: nonlethal boxing/sparring and foot races first, then
   bicycles with actual routes, movement, and equipment. Events should consume
   simulation time, use local spatial buckets, and show their current action and
   outcome in the chronicle and person inspector.
4. Add murder only with clear causes, witnesses/evidence, investigation, and
   consequences. It should be rare, configurable, and never a random population
   wipe; ordinary sparring must not be lethal.

Progression note: the displayed year is elapsed simulation time, while the age
is governed by research points, required ore, and age-gated institutions. The
Kingdom Inspector's “Next” research line identifies each missing material and
building. Expand into mineral-rich land and maintain miners to support later
ages; keep this blocker visible as part of future kingdom guidance.

## Verification and release

Run focused Node tests, then the full suite and syntax lint. Check actual movement
and survival in reproducible seeded worlds, mid-action saves and migrated legacy
saves. Use isolated native profiles for inspector, pause and speed checks. Package,
verify and publish Mac and Windows downloads; distinguish packaging success from
interactive Windows gameplay. Keep original user-world copies and private snapshots
out of the public repository.

## Phase 1 implementation details

Definitions and balance values live in `src/character_traits.js`, `src/diets.js`
and `src/needs.js`. These are data-driven ES-module configuration, not a settings
screen. Additional traits have a 12-trait cap. Opposite pairs replace each other
when granted; malformed or conflicting imported sets are rejected. The original
primary trait and inherited aptitude remain intact. Additional-trait inheritance
probabilities are metadata for Phase 2, not active inheritance yet.

Lucky/Unlucky multiply positive gathering and hunting opportunity chances by
1.2/0.8, clamped to [0, 1]. Strong/Weak change strength by +4/-4; Fast/Slow change
movement by 1.25/0.8; Genius/Stupid change intelligence and earned experience.
Long-lived delays age-related decline by 30%; fed regeneration restores 0.5 HP
per simulation second. Honest excludes theft and improves social affinity.
Thief steals at most one existing carried good during an eligible social encounter;
Peaceful limits combat initiation, and Aggressive allows hostile civilian attacks.

Nutrition is 0–100 (the inspector displays hunger as 100 minus nutrition). People
lose 7 nutrition per simulation second; ordinary wildlife loses 1. A meal restores
35 nutrition and consumes 0.9 food, or 1.7 for soldiers. Empty nutrition causes
2 HP of starvation damage per second. Energy at 20 triggers rest until 85,
recovering 6 per second. Decisions use a saved 0.75-second cooldown; new fire can
interrupt immediately. Life stages use simulation age, with ordinary human adult
age at 18 and age-related decline after 85 years (wildlife 5 and 50).

New local neighbor queries use spatial buckets. Food seeking examines local
vegetation and bounded meat piles, checks route reachability and limits path
searches. Hunting consumes health of actual wildlife; a killed ordinary animal
yields one finite meat pile. Grazing consumes tile fertility. Shared kingdom
supplies retain the existing global provisioning abstraction. Fish production,
trade, aircraft delivery, refunds and conquest preserve typed food quantities;
older untyped stocks and cargo migrate as plant food. New fields and recent
history are persisted with the world. Angels and demons retain their existing
supernatural AI and do not gain ordinary hunger; their inspector action states
this exception.

## Launch and manual walkthrough

From `/Users/aks/Documents/fun/genesis-grove`:

```sh
npm start
# Or serve the browser version:
npm run dev
```

For the browser, open http://127.0.0.1:4173.

1. Create an inhabited world, pause, choose Observe and click a citizen. Expand
   the existing creature details to see traits, diet, hunger, energy and history.
2. Choose **Edit traits & diet**. Grant Strong, then Weak: Weak replaces Strong
   and the displayed strength changes. Grant Lucky, then Unlucky to inspect
   another incompatible pair. Closing the editor preserves these explicit edits.
3. Apply Carnivore. Resume near ordinary wildlife: when hungry the citizen seeks
   meat, hunts, then consumes a finite pile. Without animal food it seeks food and
   eventually suffers starvation; plant-only kingdom stores cannot satisfy it.
4. Inspect a tired creature for Resting, or a threatened one for Escaping danger.
   Its current action and reason appear in the existing activity area.
5. Pause and change speed to compare time progression. Save and reload to retain
   traits, diet, needs, the current decision and recent events.

The final verification record is maintained below after the single consolidated
pass. A packaged build is not proof of interactive Windows gameplay.

### Phase 1 and naval verification record

The Phase 1 consolidated unit run passed 225 of 226 tests. The sole failure
exposed fleeing civilians drawing attackers out of siege range; offensive pursuit
now stays within the objective assault area. The affected set passed 67/67, and
29/29 simulation tests passed after the final pursuit refinement. All 226 Phase 1
test cases are accounted for as passing. Ship inspection added eight new unit
cases; the focused ship/army/integration batch passed 21/21. Syntax lint and diff
whitespace checks passed. Unrelated passing suites were not repeatedly rerun.

The final combined packaged Mac batch passed ships 5/5, traits 4/4, general 57/57,
army 7/7 and siege 4/4: 77/77 total, zero renderer errors. Actual 1x/20x progression
was 2.125/43.125 simulation seconds (ratio 20.2941), and pause preserved the exact
state. Compact layouts at 1024 and 1366 pixels were reviewed. Both final platform
ZIPs passed integrity checks; their bundled code/assets match the final source.
Interactive Windows gameplay was not tested. See the [Ship Inspector runbook](ship-inspector.md)
and [military transport scope](roadmap.md#naval-milestones).
