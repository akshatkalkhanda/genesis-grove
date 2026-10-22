# 0.23.0: Continuing generations and a clearer map

Long-running worlds no longer block every distant descendant of the same founding
family from having children. Known close-family links still prevent pairing, and
age, health, food, housing and local partnerships still govern births. Existing
saves retain their population and identities.

The reported year-350 world now reaches year 1,000 with 330 people and continuing
births. Version 0.22.0 reaches extinction at year 531 on the same starting save.
See the [investigation and limits](generations-and-map-readability.md).

Dense cities now have smaller sprites, quiet empty outposts, thin borders, subdued
ground detail, bounded names that avoid collisions, and concise hover summaries.
Selecting life or a kingdom opens its existing detailed inspector.

[Staged city before](images/dense-city-before-0.23.0.png) ·\n[Same staged city after](images/dense-city-after-0.23.0.png)\n\n## Verification

- 145 simulation/save tests and JavaScript syntax checks passed.\n- Source general Mac smoke: 57 checks passed. Packaged Mac: 57 general, seven\n  army and three dense-map groups passed, with no renderer errors.\n- Both Mac arm64 and Windows x64 ZIPs passed archive integrity checks. All 39\n  application source files match the verified workspace in both bundles.\n- Native platform CI and uploaded-asset checks are linked in the public release.

Original worlds and a separate named live recovery are preserved. Installation
does not restore or rewind a world automatically. Packages remain unsigned;
Windows interactive gameplay is untested.
