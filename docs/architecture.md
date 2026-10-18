# Architecture

The game renderer and simulation use web standards, with no runtime library dependencies. Electron provides a desktop window around the same HTML entry point. Its renderer has sandboxing and context isolation enabled, Node.js integration disabled, remote connections blocked by CSP, and external navigation disabled. See Electron's [sandbox documentation](https://www.electronjs.org/docs/latest/tutorial/sandbox).

- `src/simulation.js`: deterministic 192 × 128 tile world, seeded terrain noise, entities, villages, ecology, brush operations and versioned save validation. No DOM dependencies; tests run in Node.
- `src/renderer.js`: cached procedural pixel terrain, animated creatures, settlement buildings, power effects, camera and minimap.
- `src/app.js`: input, fixed 0.125-second simulation steps, UI, modal flows, manual device save/export/import, synthesized audio.
- `src/desktop.cjs`: sandboxed Electron window and native application menu.
- `scripts/serve.mjs`: loopback-only development server with a narrow static file allowlist.
- `scripts/smoke.cjs`: isolated Electron session, native pointer actions, save/load and export checks, screenshot capture. Test files live in ignored `artifacts/`.

World time is advanced by the fixed-step loop, independently of display refresh rate. Twenty simulated seconds make one game year. At 5×, a year lasts four real seconds. Villager lifetimes use simulation seconds rather than realistic calendar ages. Population caps are 600 people, 350 animals and eight villages. Caching terrain avoids redrawing thousands of decorated tiles every frame; dynamic creatures, fire and overlays draw separately. Saves preserve RNG state so restored worlds evolve identically with matching future input and steps. Cosmetic power effects are deliberately transient.

Terrain and imported saves are fixed to this world size. No original game's data is loaded. Territorial circles are approximate settlement influence displays, not tile ownership. Trade and raids are periodic events between nearby settlements. Individuals move locally, avoiding impassable terrain; there is no global pathfinder or seafaring.

Potential next steps: connected territory ownership, pathfinding and boats, deeper resource economy, diplomacy, selection and creature traits, undo history, autosave slots, and larger-world chunking. These need gameplay and performance testing before expanding current caps.
