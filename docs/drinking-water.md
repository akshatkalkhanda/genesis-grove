# Drinking water — 0.31.0

People have saved hydration (0–100) and a two-ration water bottle. Hydration starts
at 85 and falls by 0.8 per simulation second. At 55 or below, a person seeks a safe
reachable well or freshwater shoreline; one actual ration restores 40 hydration.
At zero, dehydration causes two health damage per simulation second and appears
as its own health-history cause. Immediate danger takes priority. Critical thirst
can interrupt work and ordinary hunger; imminent food shortage still receives
attention. Decisions reuse the saved 0.75-second needs cooldown.

Walking to water interrupts the daily routine temporarily. Drinking from a source
debits one ration, then may fill up to two carried rations from the remaining
stock, leaving a ration for the next visitor when possible. Drinking carried water
does not debit the source again. Consuming water produces a small map effect and
a throttled nearby sip sound using the existing audio controls. Wildlife retains
its existing needs in this milestone.

## Sources and limits

Wells hold at most 60 rations, begin with 30 finite groundwater rations, and
replenish one per simulation second. Fire or unsafe terrain prevents use. A first
well can be constructed in a one-person settlement for four timber without waiting
for two homes or a reserve margin. The settlement can build up to one well per
40 residents at each populated settlement (maximum 20 per kingdom); each candidate must have a bounded route from town.
Settler expeditions allocate four of their existing six timber supplies to a saved
well kit. On arrival, that prepaid kit can fund a local well even if the capital
has spent its remaining timber; it is consumed once and never credited as new
shared wood. Settlers depart only while hydrated. Older colonies receive this
finite founding kit when migrating a pre-water save.
Unserved towns take priority over extra capital wells. Construction checks a route
from the receiving town, not just the capital. Spare capital wells cannot exhaust
a new town's construction quota. Existing irrigation and firefighting
effects continue.

Connected water touching a map edge is sea and is not drinkable. Enclosed inland
ponds of at least four water tiles are assumed fresh for this first milestone.
Each pond has a finite saved reserve of four rations per tile, capped at 120;
the largest 128 ponds are supported. Seeded-world and older-save migration initialize
those reserves once. New or split basins fill through natural recharge. Merges
combine saved reserves up to capacity; topology rebuilds and queries do not
duplicate water. Terrain edits can drain or discard an old reserve. Groundwater
replenishes ponds at a bounded rate; local rain/storms increase refill and drought
reduces well/pond recharge. Contamination, river chemistry and salinity mixing are
later ecosystem work.

Path searches consider at most eight nearby candidates with a fixed node budget.
Source topology is cached; creatures are not matched against every other creature
to find water. A drained reachable source can be waited at, and an unavailable
source produces an honest action reason. Water service is not a guarantee of an
adequate reserve or freedom from queues.

Prisoners may receive finite water from a connected nearby well. Crews can be
resupplied at their own nearby dock/aerodrome/workshop; travelling passengers and
crews at sea rely on carried water. These institutional deliveries use existing
sources and do not add a separate animated porter role. Funeral assignments yield
to thirst. No free water is added to a new citizen's bottle.

## Inspection and compatibility

Creature inspection shows thirst (100 minus hydration), bottle contents, the
current action/reason, and dehydration health risks. Hover wells and ponds for
their reserves. Kingdoms shows thirsty/severely-dehydrated residents, carried
rations, own-well stock, reachable pond reserves and home locations without a
reachable source. Coverage is a home-service estimate, not a promise that an
army or traveller has supplies at their current location.

The happiness estimate now uses food 30%, water 15%, housing 25%, health 20%,
recent safety 10%. Low hydration changes the actual displayed estimate and, if
untreated, health and autonomous decisions.

Older saves receive hydration 85, an empty bottle, and finite initial water in
existing wells/ponds. New state is validated and saved, including source reserves
and existing needs cooldowns. Pause stops depletion, refill, drinking and effects;
speed controls advance them using the existing fixed simulation step. Inspection
and coverage calculations do not alter saved state or RNG.

## Try it

Open a populated world, enable effects, inspect a thirsty person and follow them
to a well. Watch hydration rise and source/bottle quantities change. Open Kingdoms
→ Living conditions & public services for shortages and service access. Compare an
enclosed pond with the sea, temporarily remove access, and observe the action
reason and eventual dehydration. Save while a person is fetching water and reload.
Run `npm test`, `npm run lint`, and `npm run smoke:water` for automated checks.
