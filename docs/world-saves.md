# Named worlds and recovery

Version 0.19.0 continues the general sandbox. The four kingdoms in the reference
video are an example, not a required scenario or target kingdom count.

## Save a world

**Save** or **Cmd/Ctrl+S** opens a named-save form. Choose a name and either update
the currently loaded named slot or create a new one. Twelve manual slots are
available. Saving one world does not replace another slot unless that destination
is explicitly selected. A loaded recovery copy can be kept as a new named save.

**Worlds** lists named saves and dated recovery copies. Each copy has its own Load
and Remove actions. Removal has a second explicit action and affects only that
stored copy, not the world on screen. Export copies you want to keep separately.

The old single device save is imported once when valid and retained in its
original storage. It does not reappear after its migrated copy is deliberately
removed. Invalid old data is left in place; it cannot replace the current world.

## Automatic recovery

Automatic recovery defaults to one minute of visible real time, independent of
simulation speed. Worlds offers Off, 30 seconds, one minute and five minutes.
Paused editing is included. Hidden windows, the main menu and modal dialogs do
not accumulate catch-up autosaves. Unchanged worlds do not create duplicate copies.

Recovery keeps up to three copies per world and six across all worlds. The oldest
copies rotate first, with a selected load destination protected during the switch.
These limits rotate recovery copies only; manual slots stay until explicitly
updated or removed. The map's save-status label reports save/recovery outcomes.

Continue opens the most recently loaded or saved copy. A pre-replacement snapshot
does not take that position away from the chosen destination.

## Before New, Load or Import

The current world gets a recovery snapshot before it is replaced. The destination
is validated before replacement; an invalid import leaves the world unchanged.
If recovery protection cannot be written, the transition stops and the current
world stays open. Export is still available from Worlds.

Storage updates and recovery pruning share a single IndexedDB transaction. A
failed write cannot leave an overwritten manual copy or a partly pruned recovery
list. Active weather, crews and the rest of the simulation use the existing world
serialization/validation, so a loaded copy continues from its saved state.

## Views for the general sandbox

Layers offers Terrain, Kingdoms, Armies, Routes and Resources. Armies shows formed
garrisons and current targets. Routes marks actual trade shipments and settler
journeys using the current simulation's direct routes; it is not a new naval path
planner. Resources highlights remaining ore tiles, including stardust. Labels
explain what each overlay represents.

View or F8 hides the regular HUD for observation. Pause and Exit stay available;
F8 or Escape returns to the regular view. Entering it cancels any brush. It changes
the view without changing world laws, simulation speed or the paused/running state.
