# 0.24.0: Kings and succession

Kingdoms now expose a compact royal household with King and Heir inspection.
The King's citizen profile shows the crown, title, recorded reign, heir and actual
personality policy. Focus and Follow use the existing inspector.

Eligible adult direct children inherit, eldest first. Otherwise experience and
age select an adult resident. No eligible adult leaves the crown vacant. A living
King keeps the crown while travelling. Newborns cannot receive a vacant crown.
History records subsequent coronations and their basis. Existing worlds retain
their citizens and Kings; an unknown historical reign date stays unknown.

[Rules, limits and screenshots](kings-and-succession.md)

## Verification

- 150 simulation/save tests and JavaScript syntax checks passed.
- Source king desktop checks: four groups passed with no renderer errors.
- Final packaged Mac: 57 general checks, seven army groups, three readability
  groups and four king groups passed, with no renderer errors.
- Both Mac arm64 and Windows x64 ZIPs pass archive integrity and embedded ASAR
  verification; all 39 application files match the tested source in both bundles.
- Native platform CI and uploaded-asset verification are linked in the public release.

The population and map readability fixes from 0.23.0 remain included. Installation
preserves the original library and does not restore a world automatically.
Downloads remain unsigned. Windows interactive gameplay is untested.
