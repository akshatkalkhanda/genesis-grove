# Settlement growth and research recovery — 0.35.0

## Observed failure

A copied year-2144 save had 420 people, zero soldiers and three kingdoms stuck in
Renaissance with 250 knowledge. All had more than 275,000 food, and one had over
1.2 million. Only three of the thirteen towns were inhabited. No university
existed. The actual save and its copies remain private local verification files.

Four interacting gates caused stagnation:

- Nonessential construction and recruitment required one farm per twenty people,
  even with vast actual food reserves. Dense capitals could not fit more farms.
- Institutions tried to build near the capital even when other towns had room.
- One kingdom-wide birth cooldown imposed approximately the same maximum birth
  rate on a single town and a kingdom with many towns. Settler crews were simply
  the first three adults, often old or separated from their partners.
- Optional projects and generic food-first trade prevented saving timber for the
  next institution; abundant food shipments repeatedly outranked timber needs.

## Implemented rules

Food security uses the existing four-food-per-person reserve. The farm count is
satisfied either by the target count or by demonstrated food at twice that
reserve. Actual food is still required; a surplus does not manufacture supplies.
Other inhabited owned towns are bounded fallback locations for construction.
Plot ownership, fertile farm footprints, town work radii and reachability remain
required. Wells keep their own service/kit destination rules.

Each populated settlement advances its own saved birth timer. Births still need
viable local parents, their existing two-year parent cooldown, local shelter
capacity, food reserves and five consumed food. Ageing, mortality, kin rules and
family formation remain active. The normal sandbox now uses the existing
1,200-person validated engine ceiling; the population tooltip shows the limit.
This is a simulation cap, not a promise that resources support that population.

Expansion first attempts to repopulate empty existing owned towns, favoring
remaining local trees and ore. Young partnered adults (18–55) move with their
local dependent children, up to eight settlers and available destination beds.
Unattached young founders remain a fallback; at least two must be unrelated
under the game's known kin rules. Existing partners and dependent children are
not split. Children are settlers, not operating crews. A founding group fits the
initial five-bed home. Per-town essential jobs are rebalanced on the existing
planning cadence: farmer/lumberjack for two workers, miner for three, and all
five existing professions for five or more.

Resettlement reuses the existing finite voyage abstraction. Walking relocation
costs ten food and no timber; sea relocation costs ten food and two timber. A
new founding expedition retains ten food/six timber and its existing four-timber
well kit. Origin/destination IDs are saved. Arrival at an existing town does not
create another town or a free well kit. A lost destination returns the household
to its surviving origin or capital. Voyage manifests now allow two to eight
actual settlers; legacy three-settler saves continue to load.

When knowledge reaches the next institution gate, peaceful kingdoms reserve its
recipe timber plus ten. They prioritize that institution and protect the budget
from optional extra farms, decorative buildings, housing buffers, forging,
roads, transports, machines, barracks/recruitment and outgoing timber trade.
Actual housing shortfalls, well service and a missing basic clinic retain their
priority; wartime military spending can override the reserve. The inspector
shows the missing institution and timber budget. Research still consumes its
actual ore and requires the real building; no knowledge or age is awarded by
elapsed year alone. Ore shipments also retain the donor's next research recipe.
Food shipments skip recipients already holding twice their reserve, allowing
finite timber/material transfers to proceed instead of endless surplus food
balancing.

The overview reports inhabited/total towns. Empty settlements and their claims
are preserved for recovery rather than deleted or counted as healthy new
population. Existing saves migrate without changing the live world's clock,
resources or people merely on inspection/load.

## Verification

Synthetic regression fixtures cover surplus/shortage gates, construction at an
inhabited outpost, separate birth clocks and finite food, cohesive households,
existing-town arrival and failed destination, save/load, local professions,
resource prioritization and research budgets. The final consolidated run and
private copied-world scenario are reported with the release. Court mechanics
remain scoped in [civilian justice](civilian-justice.md).
