# Civilian theft and police — 0.35.0

## Playable rules

- A constabulary with civilian holding cells is buildable at 16 residents, Copper
  Age, 22 existing timber (+10 construction reserve), two homes, adequate farms
  and food, and a legal owned construction plot. This is separate from the
  military prison used for prisoners of war.
- A staffed station selects healthy adult civilians (up to one per 50 residents,
  rounded up, maximum three). Kings, soldiers, Thieves, detainees, active suspects,
  medical staff, vehicle crews and funeral carriers cannot be police officers.
  Officers retain their original job and return to ordinary routines when off
  duty. Hunger, thirst, fatigue and danger interrupt patrol work. Staffing needs
  at least 12 living residents; an officer must come from a home with at least
  five adult civilians so a pioneer household is not stripped of its workers.
  Police wages/taxes are not modeled.
- Patrols choose reachable owned destinations within eight tiles of the station,
  on an eight-second simulation cooldown. Witnessed cases are dispatched once
  per simulation second. Response is limited to suspects within 18 tiles of a
  reachable station; remote island towns need their own service coverage.
- An actual completed social theft transfers up to one existing carried food or
  timber. Honest remains incompatible with Thief. A small deterministic minority
  of new characters can have Thief naturally (period 31 in TRAIT_BALANCE, excluding
  Honest); existing traits are preserved. No frame-by-frame random theft loop is
  introduced.
- Nearby adult witnesses within five tiles must have clear walkable sight to the
  act. The victim also has a seeded 60% chance to notice it. Witnessed cases are
  automatically reported; there is no messenger simulation yet. Unnoticed acts
  appear as unreported in the player's record and cannot trigger police action.
  These records describe actual completed thefts; accusations and false evidence
  are not modeled.
- An officer physically approaches a known suspect, apprehends at close reach,
  and walks them to the station. Arrest causes no damage and does not teleport
  either person. Civilian holding has four places per kingdom; it does not set
  prisoner_of or alter diplomatic relations.
- Restitution debits only goods still carried by the suspect, capped by the
  recorded theft less previous recovery. Goods return to the victim's carrying
  capacity, with overflow or an unavailable victim's goods returned to the same
  kingdom's existing stores. Spent goods are not recreated; recovery can be zero
  or partial. A later legitimate carried good of the same kind can satisfy the
  debt; individual item provenance is not modeled.
- A booked sentence lasts 12 simulation seconds. Shared food and nearby finite
  well service support detainees, with carried water used during escort. Critical
  needs/health, fire, displacement, a lost escort, destroyed/flooded station,
  death or changed jurisdiction release/close the case safely. There are no
  new combat deaths or teleport-to-home release effects.

## Inspect and save

Police wear blue caps and gold badges; constabularies have a badge and barred
holding-room window. Current action/reason, police role, suspect/victim case
history and restitution appear in person inspection. Kingdom public services
show staffed officers, reachable home coverage, civilian holding occupancy and
six recent cases. Coverage describes homes in station range, not a guarantee of
response. Recent victims lose the existing safety component of the derived
wellbeing estimate for 30 simulation seconds.

The world saves a bounded justice ledger (128 cases), patrol assignments, routes,
cooldowns, witness IDs/names, recovered amounts and remaining sentences. Derived
indexes rebuild without advancing time or RNG on load. Missing justice state in
older saves becomes an empty ledger. Closed/unreported records can be pruned when
full; active custody is retained. Dispatch and paths are bounded, without a new
creature-against-creature scan each frame.

Configuration lives in src/justice.js and src/character_traits.js; the construction
recipe is in src/settlements.js. Advocates, hearings, contested accusations,
convictions after trial, appeals and murder investigations remain in the roadmap.
This milestone uses short summary sentences for directly witnessed theft.

## Reproducible demonstration

Run `npm run smoke:justice` from the project directory. It uses an isolated profile,
imports a deterministic real-theft scenario with a staffed station, selects the
police officer through native map input, checks kingdom case details and compact
layouts, preserves the exact paused snapshot, and resumes a saved sentence through
release. Images go to artifacts/justice. Unit scenarios cover finite restitution,
unreported theft, movement without teleportation, survival, old saves and seeded
save/resume during pursuit, escort and jail. `npm start` launches the game normally.
