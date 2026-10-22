# Continuing generations and readable cities — 0.23.0

The follow-up population decline exposed a different problem after the local-fire
and rebellion-home repairs. In the newer sandbox, food was abundant but inherited
founding-family IDs eventually excluded distant descendants from forming couples.
At year 350 one kingdom had 39 adults aged 18–70, no eligible couples and more than
240,000 food. Another kingdom already consisted entirely of elders.

Family identity now remains a cultural/history field. Pairing checks use known
parent and grandparent links instead. Parent/child, grandparent/grandchild, sibling
and known first-cousin relationships remain excluded; distant membership in the
same founding clan no longer imposes a permanent ban. Grandparent checks use the
parent records available in the current world, not an exhaustive genetic tree.
Births still require eligible adults, a reciprocal local partnership, food,
housing and the existing cooldown. Aging, mortality and family history are retained.
No citizens are created, rejuvenated or resurrected during loading.

## Same saved-world replay

The copied sandbox at year 350 began with 276 people and all four autonomous laws
enabled. Both versions used the normal simulation loop at 0.125-second steps.

| Check | 0.22.0 | 0.23.0 |
| --- | --- | --- |
| Long-run population | Extinct at year 531 | 330 people at year 1,000 |
| Births after the snapshot | 145; stopped by year 450 | 2,147; continued in later intervals |
| Deaths | 421 | 2,093 |
| Endpoint children | None | 59 |
| Snapshot integrity | Source unchanged | Source unchanged; valid home ownership and save round trips throughout |

The fixed run accounts exactly: 276 + 2,147 births − 2,093 deaths = 330.
Its deaths were 1,871 aging, 164 combat, 38 starvation, 11 cold, eight fire and one
unwalkable-terrain removal. This verifies the reported failure in this particular
world. The older, smaller food-poor recovery still declines in a separate replay;
this release does not guarantee survival in every economy or revive towns that
have already lost their younger generations. The accelerated challenge's economy
balance remains separate follow-up work.

## Dense-map presentation

The reported city had 273 homes and 39 colonies, but only four colonies were
inhabited. Large sprites, banners over empty outposts and full-tile border coloring
covered the people and roads.

- Homes, facilities, people, vehicles and aircraft use smaller anchored artwork.
  Their saved positions, hit targets, routes and simulation behavior are retained.
- Empty outposts use small neutral markers in the ordinary map. Selecting their
  owner reveals muted housing footprints; abandoned outposts do not get banners.
- Only inhabited settlements of living kingdoms receive map names. Capitals and
  the selected kingdom have priority. At most ten labels fit in the usable view;
  overlapping labels are omitted, including collisions with army/unit labels.
- Borders use thin screen-width strokes and faint fills. Decorative ground detail
  is reduced around settlements; natural terrain and ore state are preserved.
- Routine person labels wait for a closer view, with a six-label maximum.
  The selected person retains a label. Equipment halos and daily-activity decoration
  appear at close zoom or for the selected person.
- Hover summaries show nearby life and the most relevant object. Full kingdom
  stockpiles, buildings and military details remain in the existing inspectors.

The dense-city desktop fixture checks normal and approximately five-times zoom
at 1366×768 and 1024×768. Its view changes preserve the serialized world exactly.
Screenshots in the release documentation use a staged city fixture; private copied
worlds and diagnostic profiles are kept in ignored local artifacts.

The live world was also protected as the separate named save
**Population recovery before 0.23.0**. Installing the update preserves the device
library. Choosing an older recovery remains explicit; installation does not rewind
the world automatically.
