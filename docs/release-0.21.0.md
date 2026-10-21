# 0.21.0: Armies keep and explain their decisions

Home garrisons now save stable autonomous orders: assemble, defend, march, attack
and retreat. A campaign keeps its reachable enemy-town target instead of switching
merely because another town becomes closer. Dispersed members assemble, nearby
home attackers call soldiers back, and low health or shared food causes real
homeward withdrawal. Equipped-strength margins influence campaign decisions.

The Army Inspector shows the saved order and its reason separately from live
member tasks. Existing medical care and individual injury behavior retain priority.
Retreating groups remain visible; destination lines show valid March/Attack targets.
Kingdom summaries use order states. The compact map-first interface remains.

Orders persist through save/load with bounded validation. Old worlds without orders
load with an explicit home-guard preview until time runs. Paused loading/inspection
neither advances time nor issues or replaces decisions. Peace, capture, lost targets,
blocked terrain and group dispersal have defined invalidation behavior. A failed
bounded military path stops movement rather than falling back to a direct march.

Food remains shared kingdom stock. This update does not introduce carried army
rations, dedicated supply lines, player micromanagement, local capital-conquest
rules or military ocean transport. Capital capture still transfers its kingdom.

- [Actual saved March order](images/army-1366x768-0.21.0.png)
- [Actual compact view](images/army-1024x768-compact-0.21.0.png)
- [Actual food-shortage withdrawal](images/army-withdrawal-1366x768-0.21.0.png)
- [Order rules, compatibility and measured cost](army-inspector.md)
- [Updated implementation path](video-analysis/README.md)

## Verification

- 131 simulation/save tests and JavaScript syntax checks passed.
- Source Mac Electron: 56 general and seven army check groups passed, with no
  renderer errors. Army checks cover saved order/reason, actual withdrawal,
  native selection, follow/cancellation, no paint-through, presentation and
  compact layouts. Unit checks include state transitions, sticky targets, stale
  intents, blocked routes, malformed imports and deterministic save/resume.
- A documented seven-run 100-kingdom fixture comparison measured steady-step
  median/p95 of 4.008/7.197 ms versus 2.580/5.120 ms in 0.20.0. Routing/decision
  cost increased; this is not a frame-rate or maximum-population guarantee.

- Packaged Mac Electron: 56 general and seven army check groups passed, with no
  renderer errors. The withdrawal capture follows verified homeward movement and
  waits for the live retreat activity and clear notices.
- Mac arm64 and Windows x64 ZIP builds completed. All 37 packaged source files in
  both applications match the verified workspace; metadata reports 0.21.0 and the
  expected desktop entry. ZIP integrity and bundled payload matching passed.

Packages are unsigned. The Windows ZIP is cross-built; Windows
gameplay has not been tested. Native platform build results are checked separately.

Next: local town capture and explicit capital-surrender rules, then ship inspection
and military transport across water. Larger maps remain later measured work.
