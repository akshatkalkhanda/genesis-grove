# Owned land, local agriculture and mountain mining — 0.32.0

The screenshot report exposed two mismatched models. Construction searched up to
40 tiles from the capital while territory capped its radius at 17; it checked
walkability but not ownership. Windmills boosted every farm in the kingdom, and
farmer assignments could choose distant farms despite sorting by distance.
Mountain ore was already finite and mineable by the industry simulation, but
civilian job selection rejected the mountain tile before considering an adjacent
working position. That left mining largely invisible and detached from workers.

## Construction and agriculture

New structures require a reachable, owned anchor and an owned land footprint.
Shore structures may border water. Farms lie within 12 tiles of a home town and
require cultivable land with adequate initial fertility; hills, mountains, sand,
snow, desert and crystal ground cannot host fields. Field footprints must also
be cultivable. Small wells use a one-tile plot and tighter clearance, retaining per-town priority
and prepaid founding kits so narrow settlements can still obtain drinking water. Other service buildings stay near their receiving town and claimed land.
Planning has a 12-second simulation-time cooldown even when no suitable plot exists.

Farmers choose nearby working fields rather than arbitrary farms throughout the
kingdom. Crop growth needs a healthy adult farmer physically working that field;
soldiers, travellers, patients and people busy with survival/crew/funeral tasks
cannot staff it remotely. The existing finite crop stock and harvest flow remain.
Windmill bonuses apply only to owned, reachable farms within eight tiles. Mill
placement chooses a farm cluster; a distant mill no longer improves every field.

Pre-rule saves receive a deterministic coordinate repair for misplaced unclaimed
farms/mills, or invalid owned fields. Suitable plots are sought inside their own
town territory. Crop stock, growth, harvest counts and other building state are
preserved, and migration consumes no RNG or resources. If no suitable plot exists,
the old asset remains; it does not produce crops on invalid land. Foreign-held
plots are not magically moved out of an enemy's territory. The new save marker
prevents repeated migration; current saves preserve their coordinates on reload.
Hovering an outlying structure distinguishes building owner from territorial owner.

## Mountain resources

Mountains can be claimed as land while their peaks remain impassable. A miner
selects an owned, reachable walking position beside an owned deposit, including a
mountain face. The chosen face and resource coordinates are saved in the routine.
A small entrance marker and pickaxe activity show where work is occurring.

On the existing eight-second industry cycle, only actual adult miners working at
their face for at least two seconds can extract material. The old remote-radius
scan is removed. Mining consumes the exposed deposit and advances its finite
stratum, so multiple workers cannot duplicate the same exposed ore. Iron Age
permits deterministic deeper seams in hills, mountains and crystal, up to the
existing three-stratum limit. Extraction credits the kingdom's shared ore stores;
individual ore hauling and tunnels through mountain ranges remain later work.
Miners do not walk over peaks or extract material across sea barriers. Movement
also rejects diagonal corner-cutting through impassable terrain, matching the
route graph instead of stranding walkers in disconnected mountain pockets.

Inspection shows the assigned deposit and explains mountain access. Successful
extraction creates small stone chips and a throttled local mining sound through
the existing audio controls. Pause, speed and save/load use simulation time.
Rules live in `src/settlement_land.js` and `src/mining.js`.

Run `npm test`, `npm run lint`, and `npm run smoke:land`. Manually inspect a young
town with borders visible: fields should stay on nearby owned soil, a mill should
serve its local fields, and a miner should approach a visible ore-bearing mountain
edge and deplete the deposit while the peak remains non-walkable.
