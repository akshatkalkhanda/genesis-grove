# 0.22.0: Local disasters and surviving generations

A lightning strike now affects a small fixed area. Its fire can spread six adjacent
tiles beyond the ignition patch, then burns out; rain quenches it and water/snow
break the front. Remaining spread survives saves. The cursor and click instruction
match the fixed strike area. Other deliberate ignitions remain possible.

Automatic weather favors rain. Tsunamis wait at least 100 game years, with a minimum
600 simulation seconds, and save their cooldown. Manual waves remain available once
the current wave recedes. Deep-ocean placement, nearby low-coast checks, high-ground
protection and three-tile inland reach remain in effect.

Rebellions choose eligible adult civilian households, retain reciprocal partners and
assign homes in the new kingdom. Old known foreign-home references repair on the
loaded copy; unknown references still reject. Work routines return to the new home.
Cross-home or cross-kingdom partnerships no longer block later local pairing.
Citizens retain their age, health, identity and family history.

The affected year-101 recovery now loads with 63 people and reaches year 201 with
76 people in a normal simulation replay. A same-seed continuous-forest test affected
67 tiles instead of 23,823; a 3,600-second scheduler run produced one tsunami instead
of ten. See the [investigation and limits](survival-and-disasters.md) and
[nature rules](nature.md). Original device saves were preserved.

[Actual packaged coastal weather view](images/nature-coast-0.22.0.png)

## Verification

- 141 simulation/save tests and JavaScript syntax checks passed.
- Source and packaged Mac Electron: 57 general and seven army check groups passed,
  with no renderer errors. Checks include legacy rebel-home import, fixed lightning
  controls, stacked-wave rejection, saved weather, map-first layout and army orders.
- Mac arm64 and Windows x64 ZIP builds completed. All 38 packaged source files in
  both applications match the verified workspace; metadata reports 0.22.0. ZIP
  integrity and embedded application payload matching passed.
- Native platform CI results are linked in the published release.

Packages are unsigned. Windows interactive gameplay remains untested.
The accelerated 100-kingdom scenario still needs its own food and replacement-birth
balance pass. Local conquest follows that stability work; naval inspection and
military transport remain later steps.
