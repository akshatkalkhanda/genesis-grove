# Forestry and harvesting — 0.29.0

Harvesting is tied to the same tree anchors drawn on the map. Woodcutters avoid
trees hidden by buildings and roads, move to a standing tree, and carry a finite
amount home. Wood is removed from the tree before it is delivered; several
workers cannot duplicate the same remaining resource.

Each successful cut produces wood chips. When the remaining timber is exhausted,
the canopy falls and disappears, leaving a stump on meadow terrain. Workers stop
cutting that location and return their cargo. The stump remains for 90 simulation
seconds, followed by a young sapling for another 90 seconds. The original forest,
jungle, maple, mushroom or starbloom biome then returns. Buildings, roads, terrain
painting and fire can interrupt this process. These are game balance times rather
than real forestry growth rates.

Timber still uses the existing fertility resource (20 wood per full fertility).
The configurable rates and tree-site rules live in `src/forestry.js`. Stump age
and original biome are persisted; saves from earlier versions load with no stump
records. The standing tree's remaining supply continues to use saved fertility.
Pause freezes cutting, fall/chip effects, worker animations and regrowth; speed
controls advance them through the ordinary simulation clock.

With audio enabled, nearby visible cuts play a short wooden chop and depleted
trees play a longer creak/thud. Sounds use the existing effects volume, stereo
positioning and voice limits. Throttling prevents large towns or fast simulation
from becoming a wall of noise. Muted, paused, background and offscreen activity
does not replay later. Routine forestry does not add spoken announcements.

Run `npm test`, `npm run lint`, and `npm run smoke:forestry` for the regression
coverage. To inspect manually, follow an adult woodcutter at a forest away from
roads and buildings, enable effects, and watch the finite harvest, return trip,
stump and later sapling. Hover the tree/stump to see its current resource stage.
