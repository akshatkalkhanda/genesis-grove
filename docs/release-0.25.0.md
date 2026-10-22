# 0.25.0: Clearer views, sound and voice

Zoom now keeps the chosen map point anchored, responds smoothly to wheel/button
input, and supports coordinated two-finger pan and pinch. Fit interrupts camera
motion. Reduced-motion preference is respected, including changes during a zoom.

World overview simplifies citizens to markers and hides ordinary building detail.
Town and citizen views progressively reveal sprites, bounded names and activity.
Controls and labels retain their screen size. A touch brush previews until lift;
a second finger or cancelled gesture discards the pending stroke.

[Controls, visibility chart and screenshots](zoom-and-visibility.md)

Original action sounds and local spoken feedback now cover tools, powers,
controls, inspectors, saves and major world events. Audio has separate effects,
ambience and voice volumes, local voice selection and mute controls. Repeated
input and speech queues are bounded. [Audio controls and coverage](audio-feedback.md).

## Verification

166 simulation, camera, touch and audio policy tests pass, along with syntax checks.
Source desktop checks pass: 57 general, six zoom groups and four audio groups.
The audio check renders all 29 effects and verifies a real local voice starts and
completes speech on this Mac. Final packaged Mac checks pass: 57 general, six zoom,
four audio, seven army, four king and three dense-map groups, with no renderer errors.
Both Mac arm64 and Windows x64 ZIPs pass archive and embedded ASAR checks; all 43
application files match the tested source in both packages. Native platform CI and
uploaded-asset verification are linked in the public release. Existing saves and the king, army, population and
natural-event systems remain compatible. Installation preserves the library and
does not restore a world automatically.

Downloads remain unsigned. Windows interactive gameplay is untested.
