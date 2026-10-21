# Army inspection

Use Observe and click a small numbered army banner. Marching forces appear on the
map; select Armies under Layers to reveal idle home garrisons too. A gold outline
marks the selected banner. Selection does not move the camera or change time.
Creature clicks and kingdom-territory inspection continue to work outside badges.

The compact card shows the kingdom's actual flag, home settlement, active member
count, current member tasks, current enemy-town target and shared kingdom food.
Equipment & how this works expands each weapon/armor group's count, combined
strength and the target settlement's siege pressure.

- A garrison groups living soldiers by home settlement. Recovering soldiers,
  prisoners, voyage passengers and assigned machine crew are excluded, matching
  the simulation's army planner. Membership is not a saved regiment or formation.
- Activity counts come from individual soldiers' current tasks. A group can have
  marching, fighting, training and retreating members at the same time.
- Targets are automatically chosen by the existing nearest-enemy-town planner on
  the soldiers' landmass. A destination line is not a guaranteed path. Peace or
  capture invalidates a former target immediately in the inspector; the next
  simulation step replans it. There are no player-issued persistent army orders.
- Strength is the sum of active members' strength attributes, not a battle
  prediction. Weapons and armor report their equipped technology tiers.
- Food belongs to the kingdom's shared stores. The model does not carry a separate
  army supply inventory or simulate a dedicated army supply route.
- Siege pressure belongs to the target settlement and can involve multiple
  garrisons. It is not credited to the selected force. The existing thresholds are
  8 for a colony and 14 for a capital.

Focus zooms to the group's center. Follow keeps that center in view; manual map
panning, minimap navigation, Fit or closing the card stops following. Escape
clears inspection. View/F8 hides the inspector; Escape exits presentation first.
If the group disperses or changes kingdom, its inspector and follow stop safely.

Army plans and inspector selection remain transient. Loading an existing world
rebuilds army banners with the existing planner even while paused, without advancing
time or changing the saved-world schema. Loading clears the previous selection.

Run `npm run smoke:army` for the native Electron interaction checks. Screenshots
and the result record are written to `artifacts/army-inspector/` in an isolated
test profile. Node tests cover membership, derived summaries, stale targets,
badge hit areas and paused save reconstruction.
After packaging, `npm run smoke:army -- --packaged` targets the Mac app's bundled
page. `GENESIS_SMOKE_INDEX` can select another packaged page explicitly.
