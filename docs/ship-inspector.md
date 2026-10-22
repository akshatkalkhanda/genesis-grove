# Ship Inspector

First naval observation milestone for the 0.27.0 update. Implementation and focused
native verification are complete.

## Existing models and scope

The latest code models three water-vessel sources:

| Source | Vessel | Data that actually exists |
| --- | --- | --- |
| `voyages`, kind `ship` | Settler voyage | Kingdom, start/target, progress, duration, named `crew_ids` |
| `trades`, kind `ship` | Trade shipment | Sender/recipient, resource and amount, progress, duration, optional typed food cargo |
| `machines`, kind `boat` | Coastal/fishing boat | Kingdom, position, health, optional crew/boarding state, fish cargo and timer |

Voyage/trade icons are interpolated between their modeled endpoints. Coastal
boats have actual positions. Caravans, aircraft and land supply vehicles are
excluded. A land vehicle named Stardust carrier is not a water vessel.

No health is invented for abstract voyages or shipments. Trade crews are not
modeled. Settler voyage identities are stored in a shared crew list; the game does
not model a separate passenger manifest or crew/passenger roles for them. Coastal
boats have one modeled crew assignment and no passenger system. Provision costs
for launching settlers are spent rather than saved as aboard cargo, so they must
not be presented as a current cargo manifest.

## Interaction

In Observe mode, select a visible vessel to open the existing compact contextual
card. Its summary shows ownership, vessel type, destination and current activity.
Relevant modeled health, crew and cargo are displayed, with unavailable fields
marked honestly. Focus moves the camera to the current vessel position; Follow
tracks its position while time runs. Camera gestures stop following, as with army
and creature inspection. Closing the card clears selection; a completed, removed
or destroyed vessel clears stale inspection safely.

The inspector projects current saved state and does not advance routes, assign
crew, refresh fish timers, consume resources, draw random numbers or mutate saved
worlds. Save format and migration behavior are unchanged. There are no new ship
commands or combat mechanics in this milestone.

## Manual walkthrough

1. Load a world with a trade ship, settler voyage or coastal boat and pause.
2. Choose Observe and click its visible icon. Read the owner, type, destination,
   activity and available cargo/crew/health. Compare the three vessel types.
3. Use Focus and Follow while paused; the camera can change but vessel progress,
   resources and simulation time stay unchanged. Open a coastal sailor's existing creature inspector from its named link;
   settlers are shown as read-only names because their saved coordinates remain
   at departure until arrival.
4. Resume to follow movement, then pan manually to stop following. Save and load
   while a vessel is underway, and inspect it again.
5. Let a voyage finish or remove its vessel: stale selection/follow clears without
   opening a different object. Try the card at 1024×768 and 1366×768.

The military transport follow-up is scoped in [the gameplay roadmap](roadmap.md#naval-milestones):
assemble → embark → sail → land → attack/return. A dedicated occupant and transport
order model is needed before soldiers can board; ship combat is separate work.

## Verification

Eight new projection tests passed. The focused batch passed 21/21 including
existing army-inspection and Phase 1 integration regressions. Syntax lint and
`git diff --check` passed. The final packaged Mac batch passed 77/77: ships 5,
general 57, army 7, traits 4 and sieges 4, with zero renderer errors. Each suite
ran once against the final combined package. New ship checks prove native
selection for all categories, exact paused-world preservation, Focus/Follow,
close-zoom citizen non-interception, portable save/load, actual shipment arrival
clearing stale follow, new-world replacement and 1024/1366 compact layouts.
Screenshots were visually reviewed.

Both final Mac and Windows ZIPs passed CRC checks and contain identical app ASAR
hashes. All 51 packaged code/art files match final source. Windows ZIP packaging
is verified; interactive Windows gameplay was not tested. Existing supernatural
creatures retain their special AI and ordinary-hunger exemption.
