# Stability and readability pass, 0.25.1

22 October 2026. The earlier extinction pattern did not recur in either tested
snapshot. Both runs ended above their starting population with continuing births.
This is evidence for these snapshots, not a guarantee that every kingdom survives.

## Long-run results

Two snapshots of the same played world, The Emerald Isles, were each advanced
1,000 additional years. Natural events, diplomacy, rebellions and expansion stayed
enabled. Fixed simulation steps were 0.125 seconds, matching desktop play.
No save profile was opened by the replay and both input file hashes remained unchanged.
Every 50-year checkpoint serialized and restored successfully.

| Years | People, start → finish | Births | Deaths | Children at finish |
| --- | --- | ---: | ---: | ---: |
| 350 → 1350 | 276 → 325 | 3,316 | 3,267 | 59 |
| 732 → 1732 | 316 → 364 | 3,652 | 3,604 | 65 |

Most deaths were from aging. The older snapshot recorded 6 lightning deaths and
5 fire deaths over the full run; the later snapshot recorded 11 and 38 respectively.
The older run also contained one population removal with an unclassified cause;
the diagnostic does not invent a cause for that removal. Neither run became empty.
Local starvation still occurred (88 and 120 deaths); aggregate kingdom food stocks
grew, so this pass does not establish that every outpost or rebelling town had adequate supply.

| Automatic weather over 1,000 years | Year 350 snapshot | Year 732 snapshot |
| --- | ---: | ---: |
| Rain cloud | 127 | 131 |
| Thunderstorm | 47 | 43 |
| Drought | 19 | 21 |
| Blizzard | 20 | 20 |
| Tsunami | 9 | 7 |

The sampled maximum was one simultaneous tsunami in each run. Fire sampling every
10 simulation seconds found at most 40 and 49 burning tiles respectively, out of 24,576 map tiles.
Those are sampled peaks, not exact every-frame maxima. No map-wide fire or sudden
population wipeout appeared. The balance settings therefore stay as they are.

## Real city and audio checks

The packaged Mac app imported a copy of the later snapshot and focused an actually
crowded city. Views at 1366×768 and 1024×768 fit without horizontal overflow.
World overview showed markers with no citizen name/activity labels; town zoom showed
buildings and people without name cards; citizen zoom bounded the scene to six
name cards and 24 activity decorations. Camera changes preserved the complete
paused save. Close views still contain overlapping residents when they physically
occupy the same location; this pass does not claim that all crowd occlusion is solved.
Screenshots and full save copies remain in local ignored artifacts.

Two 30-second runs with audio enabled advanced 30 simulation seconds at 1× and
about 600 at 20×. The median animation-frame interval was about 8.3 ms and the 95th
percentile about 9.3 ms in both runs on this Mac. These are isolated local measurements,
not performance promises for other machines or larger populations. Native speech
started and finished without provider errors in a visible test window; the 20× run did not leave pending
speech at its final measurement. The audio tests also cover 100-event bursts,
latest-pending speech, mute and priority cancellation. Hardware speaker output
and interactive Windows speech were not audited.

## Correction shipped

Complete-word event matching fixes false war cues for Dwarf names and research
cues for village text. Rain, blizzard, drought, falling stars and the nuclear flash
now select suitable effect families. No simulation rules or save format changed.

Validation: 169 unit tests and syntax lint; packaged Mac standard desktop checks
(57), native audio checks (4), and copied-world stability/readability checks (4).
Mac and Windows archives passed CRC checks, contained the expected 0.25.1 metadata,
and matched all 43 app source files. Windows packaging is separate from interactive
gameplay verification.

## Repeat this pass

Export a world copy, then run:

```sh
node scripts/stability.mjs /path/to/exported-world.json 1000 artifacts/stability/replay.json
GENESIS_STABILITY_WORLD=/path/to/exported-world.json GENESIS_STABILITY_FOCUS=145,35 npm run smoke:stability -- --packaged
```

Choose focus coordinates for the populated city in that export. The replay writes
only its report. The desktop check uses a separate temporary profile. Run native
GUI suites sequentially to avoid input/focus interference. The original import
helper also needed a settled paused state before comparing snapshots; after that
wait, the exact-state comparison passed. An initial concurrent native-audio run
missed its narration toggle; the isolated rerun passed all four checks.

## Next implementation

Proceed with local town conquest and explicit capital-surrender rules: show the
siege target and progress in Army Inspector, transfer town ownership coherently,
and explain when the capital's fall ends a war. Resource distribution and citizen
crowd occlusion remain later tuning topics; this pass does not add new war mechanics.
