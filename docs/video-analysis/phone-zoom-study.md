# WorldBox phone zoom study

22 October 2026. Live visual study of the owner's Android WorldBox 0.51.4.
This is a behavior comparison and implementation plan; no WorldBox code or art
was extracted. Audio was excluded. Phone captures remain local and untracked.

## Confirmed observations

Real two-finger gestures were sent to the running game. A spread from a 200-pixel
touch separation to 700 pixels increased the map scale. Reversing that gesture
reduced the scale; consecutive reverse gestures reached a broad world view.
Local capture sequence 11 through 15 records these successful comparisons.

| View | What changes | What stays readable |
| --- | --- | --- |
| Broad world | Islands and coastlines fit into a much smaller area; individual citizens become tiny | Town cards retain their screen size; bottom tools stay fixed |
| Town scale | Houses, trees and groups become distinguishable | Town name and population remain a compact card |
| Close terrain | Ground tiles, working structures and individual activity are easier to see | The dock and labels do not grow with terrain |

The same town card is approximately the same pixel size before and after the
successful spread gesture while the terrain expands substantially. Terrain keeps
its pixel-art edges. The dock remains at the bottom at the same size and location.
These are directly observed visual results, not inferred internal rendering rules.

Exact minimum/maximum scale, focal-point drift, easing duration and release
inertia are not established. The phone locked during later tests, making those
captures invalid for camera analysis. Do not use them as evidence of zoom limits.
The available frames also do not prove whether visibility changes use explicit
level-of-detail logic or simple sprite scaling.

## Comparison with Genesis Grove 0.24.0

The current source already supports cursor-anchored mouse-wheel zoom, centered
15% button steps, a logarithmic slider, Fit, and a bounded 0.65 to 24 zoom factor.
The factor is relative to the current window's fitted map; it is not a WorldBox
scale measurement. Version 0.23.0 already bounds map labels and reduces sprite
clutter. The current pointer handler tracks one pointer and applies zoom directly;
it has no coordinated two-touch pinch recognizer or animated target scale.

## Implemented first camera slice

Version 0.25.0 implements coordinated pinch/pan, anchored eased wheel/button zoom,
protected touch strokes and progressive map detail. See [controls and verification](../zoom-and-visibility.md).
The reference timing and exact limits remain unmeasured. The list below records
the implementation goals that informed this slice.

## Camera implementation goals

1. Add a coherent two-pointer camera gesture: pinch about the finger midpoint and
   pan with its movement. Cancel pending paint or inspection when it becomes a
   two-finger gesture. A pinch must leave terrain and simulation state unchanged.
2. Keep world coordinates under the cursor/finger midpoint stable while zooming.
   Use the same camera operation for wheel, trackpad, pinch, buttons and slider.
3. Add short, interruptible easing after measuring the reference transition. New
   input must respond immediately and Fit must stop any pending camera movement.
4. Preserve screen-sized controls and bounded text. Use progressively more detail
   at world, town and citizen views; avoid enlarging name cards with the world.
5. Check usable limits against actual window size and inspector coverage. Keep
   Fit available and prevent panning so far that the world cannot be recovered.

## Acceptance checks

- A chosen landmark drifts no more than one CSS pixel from the intended anchor
  after a settled zoom, except when an explicitly documented boundary clamp acts.
- Pinch, pan, cancelled gestures and UI taps never paint a tile or select a unit
  accidentally. A serialized paused world is identical before and after them.
- Mouse, trackpad and touch inputs converge on the same zoom state and percentage.
- Repeated in/out input remains responsive; interrupting motion produces no jump.
- Fit restores a usable world view at 1024×768 and 1366×768, with or without an inspector.
- Controls and name cards stay legible without overlap at world, town and citizen scales.

The owner subsequently requested implementation of the camera slice. Kings and
succession shipped separately in 0.24.0; the camera slice ships in 0.25.0.
