# Survival and local disasters — 22 October 2026

The reported extinction was not a universal 100-year lifespan cutoff. Founders age
and die normally; descendants must replace them. The supplied sandbox recovery had
63 descendants at year 101, then no people in its year-161 and year-221 snapshots.
Natural events, rebellions, diplomacy and expansion were enabled.

Three problems combined: unrestricted wildfire spread, repeated destructive weather,
and rebellions moving the oldest four citizens without changing their homes. Eleven
of the 63 survivors retained a foreign colony as their home. All eleven were past
parenting age, and the inconsistent references also prevented loading that recovery.
Some kingdoms had food shortages. Aging remains intentional.

| Problem | 0.22.0 behavior | Regression evidence |
| --- | --- | --- |
| Lightning damage followed the brush radius | Fixed two-tile strike area | A citizen ten tiles away stays unharmed with the largest brush |
| Fire could cross an entire continuous forest | Six inherited spread steps per ignition; water/snow break the front; rain quenches it | Same full-forest fixture: 23,823 affected tiles before, 67 after, out of 24,576; after-fix fire ends by 60 simulation seconds |
| Automatic tsunami lottery ran every 90 seconds without a wave cooldown | Rain-weighted weather; waves wait 100 game years, at least 600 simulation seconds; saved cooldown; one new active wave | Same seed and 3,600-second scheduler run: ten waves before, one after |
| Elderly rebel cohorts retained foreign homes | Healthy adult civilian households move together and receive homes in the new kingdom | New rebels save/load successfully; identities, age and health are preserved |
| Foreign partnerships could block local family formation | Invalid cross-home/kingdom partnerships clear before new pairing | Former partners can form valid local households; family memories remain |
| Existing recovery rejected foreign homes | Known foreign homes normalize to the person's current capital on the loaded copy | Actual year-101 recovery loads with 63 people; unknown home IDs still reject |

The copied recovery was replayed with the normal `World.step(0.125)` loop and all
its laws enabled. The fixed build reached year 161 with **51 people**, then year 201
with **76 people** and nine living kingdoms. From year 101 through 201 it recorded
79 births and 66 deaths: 61 aging, five starvation. Home ownership stayed valid and
the resulting save loaded successfully. The copied starting file's hash did not
change. Original device saves were not edited or restored.

An old-code replay with only the invalid homes normalized in memory ended year 161
with three people, including 22 fire deaths during the replay. Disabling future
weather or rebellions changed that result, but their random-number sequences
diverge, so those variants are diagnostic comparisons rather than isolated effect
estimates. A separate ordinary seed with all laws disabled survived past year 150.
These checks demonstrate the repaired failure modes, not guaranteed survival for
every world, food supply, war or user action.

The separate accelerated 100-kingdom challenge also showed replacement births
stalling under food and demographic pressure without automatic weather. Its broader
economy balance remains follow-up work; this release does not claim to fix that
scenario's long-run extinction. Local conquest remains the next feature after that
balance check, followed by naval inspection and military transport.

To continue the affected world, use **Worlds → Recovery** and choose its **year-101**
copy. Continue currently targets an already-empty later snapshot; loading it cannot
recreate dead citizens. Export the live recovery before a long new run because the
automatic recovery ring rotates. This investigation used an isolated profile copy.
