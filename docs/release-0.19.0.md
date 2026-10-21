# 0.19.0: Keep your worlds and observe clearly

This update continues the general sandbox. The four kingdoms in the reference
video are only an example; there is no dedicated four-kingdom setup.

Save now opens a named destination with explicit create/update choices. Worlds
lists up to twelve manual saves and six recovery copies, with at most three
recoveries per world. Automatic recovery defaults to one visible real minute and
includes paused editing; choose Off, 30 seconds or five minutes as needed.

New, Load and Import protect the outgoing world before replacement. Storage
updates and pruning are atomic: failed writes keep earlier copies and stop a
replacement. Loading an older recovery protects that destination from rotation.
The old device save migrates once and remains in its original storage. JSON
export/import remains available for independent backups.

Layers adds Terrain, Kingdoms, Armies, Routes and Resources. View/F8 hides the
regular HUD while retaining Pause and Exit. Entering it cancels a brush and keeps
the current speed and paused/running state. Escape returns to the regular view.
The existing rain, storms, lightning, droughts, blizzards and coastal tsunamis
remain available from Nature.

- [Named worlds and recovery](world-saves.md)
- [Updated implementation chart](video-analysis/roadmap.svg)
- [Actual populated Worlds screen](images/world-library-0.19.0.png)
- [Actual Resources layer](images/resources-0.19.0.png)
- [Actual presentation view](images/presentation-0.19.0.png)

## Verification

- 115 deterministic simulation and save tests passed, including recovery capacity
  and selected-destination retention at both per-world and global limits.
- JavaScript and smoke-script syntax checks passed.
- Source Mac Electron smoke: 56 checks, zero renderer errors.
- Packaged Mac Electron smoke: 56 checks, zero renderer errors.
- Native input covers named save creation and loading, Continue, selected recovery
  loading, one-time legacy migration, real 30-second autosave during paused edits,
  injected storage failures, pre-replacement protection, layers and presentation
  state preservation. Existing nature, inspection and compact-layout checks pass.
- Mac arm64 and Windows x64 ZIP builds completed.
Both packages contain version 0.19.0 and the expected desktop entry point. All 35
packaged source files match the validated workspace in both applications. ZIP
integrity and the application payload inside each ZIP are checked separately.

Mac packages are unsigned. The Windows x64 ZIP is cross-built; Windows gameplay
has not been tested. The tag workflow separately tests and builds on native Mac
and Windows runners.

Next on the documented path: explainable land warfare and dedicated army/ship
inspection, followed by army transport across water. Larger maps remain later
work after the simulation loop and performance measurements.
