# 0.20.0: Army Inspector

Click a numbered army banner in Observe to open a compact profile. Layers →
Armies reveals idle home garrisons as well as marching forces. The selected badge
has a gold outline; selection keeps the camera and time unchanged.

The card shows kingdom identity, home settlement, active soldiers and their tasks,
current enemy-town target and shared kingdom food. Equipment details show weapons,
armor, summed member strength and target settlement siege pressure. Focus zooms to
the group; Follow tracks its center until manual navigation or closing cancels it.
Escape clears selection, and View/F8 hides the inspector for observation.

These summaries expose the existing per-home garrison planner. Strength is not a
battle prediction; food is shared kingdom stock; siege pressure belongs to the
target town and may involve multiple groups. Persistent player orders, carried
army supplies, local-conquest changes and naval transport remain future work.

Paused loads rebuild transient army markers with the existing planner. The save
schema, soldier identities and simulation time remain unchanged. Changed targets
and dispersed groups clear safely. See [army inspection](army-inspector.md).

- [Actual compact inspector at 1366×768](images/army-1366x768-0.20.0.png)
- [Actual inspector at 1024×768](images/army-1024x768-compact-0.20.0.png)
- [Actual equipment details](images/army-equipment-1366x768-0.20.0.png)
- [Updated roadmap](video-analysis/roadmap.svg)

## Verification

- 120 deterministic simulation/save tests passed, including five army inspection
  tests for membership, summaries, stale targets, hit areas and paused-load rebuild.
- JavaScript syntax checks passed.
- Source Electron checks: 56 general and six Army Inspector groups passed with
  zero renderer errors. Native checks cover selection, focus/follow, manual-pan
  cancellation, no paint-through, compact layouts, presentation, peace/target
  changes, save roundtrip and group dispersal.
- Legacy smoke fixtures now await asynchronous imports and pause idempotently
  before crew selection, retaining the sailor/pilot and identity assertions.

- Packaged Mac Electron checks: 56 general and six Army Inspector groups passed,
  with zero renderer errors. The focused harness runs hidden to isolate scripted
  pointer/keyboard events from external mouse input, retaining strict camera and
  no-paint assertions.
- Mac arm64 and Windows x64 ZIP builds completed. Both applications report 0.20.0
  and the expected desktop entry; all 36 packaged source files match the verified
  workspace. ZIP integrity and the bundled application payload match separately.

Mac packages are unsigned. The Windows x64 ZIP is cross-built; Windows gameplay has not been
tested. Native Mac and Windows CI builds are verified separately.
