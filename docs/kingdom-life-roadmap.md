# Kingdom life and public services

The progression is basic living needs → education and healthcare → public safety
and detention → legal representation and independent adjudication. New services
must consume actual resources, have workers/capacity, affect decisions, persist,
and expose shortages instead of merely adding badges.

## 0.30: funeral care and an honest kingdom overview

Deaths on recoverable land leave bounded, non-graphic remains. One healthy adult
civilian per kingdom can collect and carry them to a reachable cemetery. Immediate
survival, crew duties and medical care take priority. Children and soldiers are not
assigned. Assignment is staggered in simulation time with bounded path searches;
remains never teleport across disconnected terrain.

Burial takes four simulation seconds at the cemetery. Optional cremation takes
eight and consumes two existing timber exactly once. The contained pyre does not
ignite the map. Stages, payment and records survive save/load; older saves default
to empty funeral collections and burial. Missing fuel leaves workers free to
gather supplies rather than reserving them indefinitely.

Unrecovered bodies decay after 180 simulation seconds; unrecovered remains and
water/terrain losses are recorded separately from successful funerals. Divine
erase leaves no remains. Grave/urn artwork shows a compact sample; recent named
records are capped at 12 per cemetery and aggregate counts persist. Animal deaths
retain the existing ecosystem/food behavior. Funeral constants are configurable
in `src/funerals.js`.

The Kingdoms panel shows estimated happiness and housing shortfall, with details
under collapsible sections. Needs-estimate weights are food 40%, housing 25%,
health 25%, and recent safety 10%. Satisfied residents score at least 65/100.
This is a transparent snapshot estimate, not a simulated opinion poll or an
emotion/loyalty system. Housing uses five beds per valid house at each home town;
because individual beds are not assigned, homelessness is a capacity estimate.

Food shortage, actual school attendance, medical staff, infections/injuries,
buildings, military garrisons and occupied war-detention places come from current
state. Wells presently irrigate farms and help firefighting. Prisons presently
hold captured soldiers. Neither implies drinking-water coverage or criminal
justice. Unsupported systems display unavailable status, rather than zero taxes,
perfect clean air, imaginary police or invented school/health coverage.

Opening the overview, reading graves and focusing the cemetery do not advance
paused simulation state. Clicking a funeral-custom button is an explicit saved
policy change for rites that have not begun. Existing rites retain their method.

## 0.31 update: drinking water

[Drinking-water needs](drinking-water.md) now include finite wells/inland ponds,
thirst, fetching and carried supplies, dehydration, saved reserves, and water
service statistics. Happiness weights are now food 30%, water 15%, housing 25%,
health 20%, safety 10%. The 0.30 observations below describe that earlier release;
clothing, clean air, taxation and civilian justice remain planned.

## Phase A: basic living needs

- Food: expose compatible nutrition, reserve days and distribution shortfalls.
- Drinking water: initial finite supplies, fetching, thirst, drought and reachable
  service are implemented in 0.31. Contamination, dedicated porter roles and more
  detailed water infrastructure remain later work.
- Clothing: fibre/leather gathering, tailoring, finite garments, wear, weather
  protection and shortages; armor does not stand in for clothing.
- Homes: named household/bed assignment, overcrowding, relocation and shelter
  recovery. Preserve the current capacity estimate until assignments exist.
- Clean air: local smoke/emission sources, dispersal and exposure, with illness
  and comfort effects. Existing weather and fire provide inputs, not a completed
  pollution model.
- Taxes: define a treasury, household income/wealth, wages and trade payments
  before adding income/property tax controls. Transfer existing wealth to the
  treasury, record rate/collection/arrears and public-service spending; do not
  create money by changing a slider or rename communal food deliveries as taxes.

## Phase B: education and healthcare

Extend existing schools, clinics and hospitals with service catchments, staff,
capacity/waiting lists, progression and supplies. Education affects learning and
skills; treatment consumes medicines and food. Persist individual service history
before reporting graduation, literacy or lifetime access percentages.

## Phase C: public safety and detention

Add civilian patrol roles, witnessed incidents, evidence and arrests distinct
from military combat. Police must not instantly know every crime. Separate
pretrial detention and sentenced inmates from prisoners of war. Model capacity,
conditions, food and release; do not treat accusations as automatic guilt.

## Phase D: advocates and adjudication

Introduce case records, prosecution/defence roles, hearings, evidence strength,
verdicts, proportionate sentences and appeals. Each stage uses simulation time
and has capacity/resource limits. Expose pending cases and outcomes separately
from safety or happiness. Connect public trust and emotions only after their
underlying individual state and behavior exist.
