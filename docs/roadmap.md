# Gameplay priorities

## Current planning path, 22 October 2026

The [sandbox mechanics and UI plan](video-analysis/README.md) updates the order
below for the current workstream: map-first UI, named saves and automatic
recovery, explainable land warfare, naval invasions, long-run observation, then
larger maps. See the [visual roadmap](video-analysis/roadmap.svg) and
[UI requirements](video-analysis/ui-plan.md). The sections below distinguish completed slices from planned work. Further hazards and deeper character systems remain later options.

## Completed first slice, 0.18.0

The first M0 slice now provides Observe default, a compact dock, contextual tools,
concise inspectors and native input checks. A Nature slice adds moving rain and
storms, lightning, drought, blizzards and deep-ocean coastal tsunamis, with optional
automatic events and saved state. Version 0.19.0 adds named saves/recovery, map
layers and presentation view. Version 0.20.0 adds compact army inspection and
focus/follow. Version 0.21.0 persists autonomous orders, explains their reasons and
uses actual health, food, strength and land reachability. Version 0.22.0 fixes local fire bounds, tsunami frequency and rebellion household/home
consistency after investigating a real population collapse. [Evidence and remaining
balance work](survival-and-disasters.md). Version 0.23.0 repairs distant-family birth blocking and reduces dense-city map\nclutter. [Investigation and limits](generations-and-map-readability.md).\nShip inspection remains future work.
The four kingdoms are only the video example; no dedicated setup is planned.
Next: local town conquest and explicit capital-surrender rules, followed by
detailed ship inspection and military transport.
See [nature mechanics](nature.md) for current effects and later hazards.

## Earlier feature priorities

The current release implements the first three priorities: supply-aware kingdom
strategy, obstacle-aware land routes, and individual names, traits, experience,
and parent records. Close inspection, working industries, and stable day/night
lighting support those systems. Version 0.12 adds fourteen ages through Cosmic Dust, visible ranged weapons, roads and local transport, monuments, varied tree artwork, angels and demons, and persistent kingdom flags with ruler succession.

Continue in this order:

4. Naval warfare: extend coastal cannon boats into ship combat, transport armies, and land on enemy coasts. Existing aircraft carry food; troop transport remains future work.
5. Further environmental events: inland floods and volcanic activity. Droughts,
   blizzards and bounded coastal tsunami flooding shipped in 0.18.0.
6. Richer maps: rivers, lakes, coherent mountain ranges, and larger maps with
   performance limits and clearer biome transitions.
7. Save recovery: delivered in 0.19.0; extend as larger maps and longer histories require.

Later character work can add relationships, family trees, and inherited traits.
Current parent records and personality traits are intentionally simpler.

Cosmic follow-up: orbital maps, star-system travel, off-world colonies, and distinct alien civilizations. Current stargates and hover transports support towns on the existing map.
