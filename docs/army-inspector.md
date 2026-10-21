# Army inspection and autonomous orders

Use Observe and click a small numbered army banner. Campaigning forces appear on
the map; select Armies under Layers to reveal idle home garrisons too. A gold outline
marks the selected banner. Withdrawing groups remain visible without opening a layer. Selection does not move the camera or change time.
Creature clicks and kingdom-territory inspection continue to work outside badges.

The compact card shows the kingdom's actual flag, named home settlement, active
members, live member tasks, saved autonomous order and short reason, enemy-town
target and shared kingdom food. Equipment & how this works expands equipped weapon
and armor counts, combined strength and the target settlement's siege pressure.
These orders are autonomous; routine player military commands are not required.

## What orders actually do

| Order | Movement and decision |
| --- | --- |
| Assemble | Dispersed members gather within eight tiles of home before departing. |
| Defend | Return to guard home, prioritize reachable enemy soldiers within twelve tiles of home, or hold current ground if home is unreachable. During peace, a healthy, fed garrison can train at a camp. |
| March | Follow bounded land routes toward the chosen enemy settlement. A closer rival alone does not replace a campaign target. |
| Attack | At least one member is within the existing six-tile siege radius; members continue pressing that settlement using existing combat and siege rules. This order does not claim that every member is fighting. |
| Retreat | Return home when wounded, short of shared food or unable to continue the campaign. Stop pursuing enemies while withdrawing. |

- A garrison has a stable identity derived from its owning kingdom and home
  settlement. It groups living soldiers assigned there; it is not a fixed roster.
  Recovering soldiers, prisoners, voyage passengers and assigned machine crew are
  excluded. A completely dispersed group loses its order; a later garrison at
  the same kingdom/home begins a fresh decision under that home identity.
- Member tasks are current individual activity, distinct from the saved group
  order. Existing medical care, crew assignments and individual injury retreat
  take priority. A wounded group may therefore disperse into medical recovery.
- New campaigns consider at most eight nearest enemy towns, reject other
  landmasses or separated members, and use the existing 4,096-node land search.
  Failed military routes stop movement instead of trying a direct fallback.
  A bounded-search failure is not proof that no theoretical route exists.
- The planner compares health-adjusted strength and actual equipped weapon/armor
  tiers against nearby enemy soldiers. New attacks need 110% of that estimate;
  an existing campaign is retained down to 80%. This is a rough decision factor,
  not a battle prediction or a new castle/conquest system.
- Average health below 45% triggers recovery; 65% is required to resume. Low shared
  food means less than max(10, 3.4 × active members); recovery needs
  max(14, 5 × members). These reserves influence where soldiers move; food still
  belongs to shared kingdom stores. There are no carried army rations or dedicated
  supply routes. Nearby home attackers take priority over a healthy, fed campaign.
- Peace, target loss/ownership change, blocked terrain, dispersal and a change of
  owning kingdom invalidate or replace orders. A changed target is visibly pending
  review while paused; time must run to issue the next order. An invalidated target
  or route produces a homeward hold before another target can be chosen.
- Strength in the card remains the sum of current members' strength attributes.
  Siege pressure belongs to the target settlement and may involve several groups;
  it is not credited to the selected force. Existing thresholds remain eight for a
  colony and fourteen for a capital. Capital capture still transfers its kingdom's
  towns and people; local conquest and military sea transport are later work.

Focus zooms to the group's center. Follow keeps that center in view; manual map
panning, minimap navigation, Fit or closing the card stops following. Escape clears
inspection. View/F8 hides the inspector; Escape exits presentation first. If the
group disperses or changes kingdom, inspection and follow stop safely.

## Save compatibility and verification

Saved-world format version 1 adds an optional `army_orders` array, bounded to 360
home groups. Each record contains a stable identity, owning kingdom/home IDs,
state, reason code, optional target ID and issue tick. Imports validate the exact
bounded record shape, state/reason combinations, actual settlement references,
owning home/kingdom and issue time; malformed orders reject the entire import.
Semantic changes such as peace or a captured target may remain saved until the
next simulation step reviews them. Inspector selection, markers and route caches
are transient.

Old saves without orders load with a home-guard preview and an explicit awaiting
planning reason. Loading, repeated paused reconstruction and inspection neither
advance time, consume randomness nor issue/replace orders. Saved campaigns retain
their target through a mid-march save/load. Terrain and road construction invalidate
route caches through `navigation_revision`.

Run `npm test`, `npm run lint`, `npm run smoke` and `npm run smoke:army`. The army
Electron checks cover order/reason display, actual homeward food withdrawal,
selection, focus/follow, input isolation, paused reload and layouts at 1366×768 and
1024×768. Screenshots/results are written to `artifacts/army-inspector/` in an
isolated test profile. `-- --packaged` targets the Mac app's bundled page;
`GENESIS_SMOKE_INDEX` can select another packaged page explicitly.

A local comparison against the 0.20.0 baseline used seed
`army-orders-benchmark-20261021`, the generated 100-kingdom fractured terrain,
300 initial citizens with two per kingdom converted to soldiers (200 total), and
186 distinct war pairs from each kingdom's three nearest rivals. Both versions
loaded the same baseline snapshot. Across seven runs of a cold planner plus 64
steps at 0.125 seconds, the median of run step medians was 4.008 ms (baseline
2.580 ms); the p95 of run step p95s was 7.197 ms (baseline 5.120 ms). Cold planning
median/p95 was 5.029/9.218 ms (baseline 0.541/3.725 ms). This measures the added
routing/decision cost on this machine and fixture; it is not a rendered-frame,
long-session, maximum-population or Windows performance guarantee.
