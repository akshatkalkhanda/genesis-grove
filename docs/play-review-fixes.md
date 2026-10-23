# Play-review fixes — 0.28.0

The native play review on 23 October observed a peaceful expanding world through
year 99. Population grew from 61 at year 8 to 460 at year 99; the review did not
reproduce the earlier population collapse. It did expose a coastal boat stuck
returning six food, inherited inspector scroll, misleading child jobs, buried
needs, extreme-zoom clutter and unclear blocked-garrison orders.

## Changes

The main menu uses a smaller single-border panel, restrained heading and clear
Create/Continue actions. Worlds/import and audio are quieter secondary choices.
The repeating bottom pattern is removed. Existing save, current-session and
world-ready behavior remains; no fake world statistics are introduced. Both main
menu and ready-to-start layouts are checked at 1024 and 1366 pixels.

Coastal catch returns now use a deterministic four-connected water route rather
than seven greedy local headings. A shared water-component/flow lookup chooses
an actually connected dock harbor, retains catch when none exists, and unloads
exactly once as typed fish. Fishing time accrues only while empty, so a long
return trip cannot create an immediate second catch at the dock. The lookup is transient and invalidates when terrain
changes. Movement stays on water and cannot jump land corners. Ship inspection
uses the same route and distinguishes waiting, unreachable harbors and full stores.
No combat or army transport was added.

New inspector identities reset scroll and disclosure state; refreshing the same
identity retains reading position. The heading and close control remain visible.
Hunger, energy and diet appear beside the primary health information, with no
second set of deep gauges. Children show Child rather than their future job;
future aptitude belongs in the secondary details. Dynamic sprites/equipment and
selection/combat effects stop growing beyond a useful screen footprint while the
camera and map coordinates remain unchanged.

Children below 18 produce no gathered food, timber or production experience.
Previously, the subsistence credit was calculated before the child check. School
attendance starts at six; younger children stay around home. Child travel/return
labels describe learning/home routines instead of adult supply deliveries. Any
already-carried goods in an older save remain finite and can return home; save
format and existing identities are preserved.

A garrison can have one stranded member even when its center looks close to home.
The inspector now names affected members and distinguishes nonwalkable endpoints,
different landmasses, and an unsuccessful bounded search (which may reflect a
route obstruction or search budget). Reachable members can return home while
unreachable members hold safely; one outlier no longer freezes the whole group.

## Economy scope

The audit found real structural surplus: a nourished civilian consumes roughly
0.18 shared food per simulation second, while the existing fertile-tile automatic
subsistence rate can exceed that before staffed farms and job multipliers. Farms
add a distinct harvest; their carried stock is debited correctly, not duplicated.
The child credit is fixed here. Adult/farm production is not broadly reduced
without a measured comparison, because previous releases already addressed
population survival. The headless review scenario records food/person and
population for the same peaceful seed before and after these fixes; it is not a
claim that all seeds, war or famine are balanced.

## Reproduce and inspect

Use `npm start` or the installed 0.28.0 app. Inspect two different citizens after
scrolling one card: the second opens at its heading, with needs visible. Select a
child to see the child role and learning/home actions. At extreme zoom, compare
sprite/effect footprint with the unchanged tile/selection positions. Inspect a
catch-carrying coastal boat and follow its water route to its dock; if disconnected,
its catch remains aboard and the reason explains why. A terrain edit should cause
a fresh route rather than a stale destination.

The profile-free balance scenario runs with:

```sh
node scripts/review-scenario.mjs src artifacts/review-scenario.json 100
```

It uses seed `review-20261023`, populated islands, expansion and natural events,
with diplomacy/rebellions off. It does not replay the exact manually placed storm
or private game saves. Final checks and measured comparison are recorded below.

## Verification

The consolidated unit pass ran 246 cases; it exposed four save-validation
failures. Two causes were fixed: child gathering timers no longer accumulate
outside the save range, and returning boats no longer decrement an unused wander
timer below the schema bound. The affected set passed 47/47 afterward; syntax and
diff checks passed. A final fishing-timer correction passed the 12 coastal/machine
tests and the dedicated native script syntax check. The dedicated final-package coastal check passed 3/3: native selection/Follow,
water-only detour and exactly one six-fish delivery, paused inspection, and a valid
post-delivery save. A fixture issue (its synthetic dock was on water and correctly
removed by ordinary cleanup) was corrected before that native proof; a full World
step regression now covers dock cleanup as well as direct machine movement.

The existing/native inspector coverage passed 89 unique checks: review fixes 3,
ships 5, general 57, traits 4, army 7, sieges 4, zoom 6 and readability 3. Testing
exposed a sticky-heading scroll interception of the Follow control; scroll padding
was fixed and the affected army/review checks passed on the rebuilt package.
The final packaged menu passed both grouped checks at 1024 and 1366 pixels,
including native keyboard Create/Continue/library, disabled empty Continue, sound,
world-ready/current-session flows and exact saved-world restoration. Total native
coverage is 94 unique checks with no renderer errors. Platform CI runs the full
unit suite and packaging for each platform after publication.

The profile-free comparison at year 101 produced:

| Measure | Unchanged 0.27 | Updated |
| --- | ---: | ---: |
| People | 485 | 490 |
| Children | 87 | 87 |
| Kingdoms | 3 | 3 |
| Shared food | 255,449.8 | 160,303.8 |
| Food per person | 526.7 | 327.2 |
| Wildlife | 42 | 50 |
| Sampled living starvation damage | 0 | 0 |

Both final worlds roundtripped through save/load. Food accumulation is reduced,
but reserves remain generous. This single peaceful run is not a death-accounting
or war/famine balance guarantee; no broad adult/farm production reduction ships
in this update.
