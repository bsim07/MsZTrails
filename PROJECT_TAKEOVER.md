# Fraction Trails: coding takeover notes

Studied 19 September 2026 at commit `2dcc305`. This is a code and targeted runtime review, not a complete gameplay or cross-browser certification. No application source was changed during the review.

## Project and active files

Fraction Trails is a Primary 3 fraction-practice game: explore a pixel-art map, answer questions to weaken Fractlings, select a strategy and confidence rating, then catch them. It is a static HTML/CSS/JavaScript application with no bundler, framework, backend, or configured npm scripts.

The active entry point is `index.html`. `fraction trails (Zandra).html` is an older standalone version; it is not loaded by the active app. The untracked art-kit and landing-fix directories and ZIPs are handoff/reference material, not runtime dependencies.

| File | Responsibility |
| --- | --- |
| `index.html` | Title screen, game shell, script/style ordering, modal root |
| `main.js` | DOM-ready initialization and service-worker registration |
| `data.js` | Question banks, guides, trainers, categories, map generation |
| `game.js` | IIFE containing session state, rendering, input, battles, progression, journal, results, teacher dashboard |
| `utils.js` | Fraction formatting, sprite elements, shuffling, text helpers |
| `styles.css` | Shell, controls, dialogs, typography, dashboard |
| `assets/sprites.css` | Pixel terrain, characters, avatar cards, animation overrides |
| `assets/fractlings.css` | Species/rarity sprite matrix and creature presentation |
| `assets/pixel-scale.js` | Sole writer of integer `--px` scale |
| `assets/rarity.js` | Device-local difficulty history and session rarity assignment |
| `assets/qrcode.js` | Local QR encoder |
| `sw.js`, `manifest.json` | Offline caching and installable-web-app metadata |
| `tools/` | Python sprite generators and two Playwright verification scripts |

Script order matters: pixel scale, QR encoder, data, rarity, utilities, game, main. CSS order is base styles, sprites, Fractlings. Most game functions are private to the IIFE; only `initFractionTrails` is exported. Data uses shared script lexical bindings rather than ES modules.

## Gameplay and state

- 25 wild questions, with contiguous IDs 0–24. IDs also index the array and sprite-sheet columns: preserve that contract.
- Three focus groups: naming/comparing (9 questions), adding/subtracting (8), word problems/sets (8). Multiple groups can be selected. Level 1 selects up to 10 strictly matching questions; no focus selects 10 of all 25.
- Map: 18 rows × 26 columns, viewed through a 7 × 10 viewport. Terrain layout is largely fixed; 32 encounter patches, guide positions, and trainer positions vary. Unassigned patches are decoys. Trees, thickets, water, and hills block movement.
- Keyboard arrows/WASD, pointer D-pad, and map swipes call `tryMove`. Camera translation and player positioning are calculated separately using the same viewport origin.
- A wrong wild answer reveals the hint and permits retries. Correct answers proceed to four question-specific strategy choices and three confidence choices. Both selections are required for catching.
- `caught` is the session collection; `levelResolved` is current-round progress. Do not conflate them: rematches and trainer rewards make them differ.
- `records` is keyed by wild ID and retains the latest record rather than an attempt history. Four strategy positions have consistent meanings across all wild questions.
- Two guides provide randomized, non-immediately-repeating tips. Three rivals draw three questions from a separate 10-question pool. All three must be correct to earn a badge and reward creature; a winning rival disappears from the current map.
- Level 2 offers new questions, up to six difficult rematches, or mixed. Difficulty for rematches uses attempts plus hint usage. A new map is generated.
- Level 3 draws six questions from a separate 10-question boss pool; four correct earns Fraction Master. Level 1 also offers a direct boss shortcut.
- Audio is synthesized with Web Audio, including background music. It does not depend on audio downloads.

## Rarity and art contracts

`fractionTrails.difficulty.v1` in localStorage accumulates device-wide answer evidence, independently of student results. Wrong answers add one difficulty unit; correct answers with hints add half. A six-attempt confidence weighting pulls sparse evidence toward 0.5. Session IDs are ranked, with seeded random tie-breaking and exactly one Legendary for a nonempty assignment.

Terrain source tiles are 16×16, character frames 16×24. Fractling frames are 56×56: 25 species columns and ten rows (five rarity tiers × two animation frames). `assets/fractlings.png` is 1400×560. Keep integer scales and sprite coordinates synchronized; avoid reintroducing 3D transforms or fractional pixel scaling.

Edit Python art sources, not generated PNGs. After roster/color changes:

```text
python tools/sync_fractling_data.py
python tools/build_assets.py
```

The sync script checks contiguous IDs and regenerates `tools/fractling_data.json`. Changing the roster size also requires updating the sheet width in `assets/fractlings.css`. The build writes atlas and PNG assets; font fetching is separate.

## Saving, sharing, and offline behavior

- Student results use `ft_response:<slug>_<random suffix>` in localStorage. New starts generate a new key.
- Saved payloads contain results, not enough state to restore a session. There is no resume loader.
- An optional host-provided `window.storage` API is supported, but the repository does not implement it. On a normal static host the dashboard is device-local; sharing a link does not synchronize students.
- Teacher entry: `index.html?teacher=dashboard`. Class Codes are UTF-8 JSON encoded as base64. Imports use `ft_response:import_<name slug>`, so identical/sluggishly normalized names can overwrite one another.
- Results offer copy, text download, Class Code, and a QR containing a teacher URL with the entire encoded payload. No server stores a short QR token. QR encoding failures silently hide the QR section.
- Dashboard totals reflect latest wild records and trainer reward records, not a complete trainer/boss answer history. Eventual correctness is not first-attempt accuracy.
- `sw.js` uses network-first HTML/CSS/JS and stale-while-revalidate other same-origin assets. Current cache version is `v5`; its comment requests a version bump on deploy. Use HTTP localhost for service-worker checks and HTTPS when deployed.

## Review findings to address deliberately

### Reproduced or directly measured

1. **Battle dismissal can lock movement.** Escape closes a wild-battle modal but leaves `state.battle` set. `tryMove` then rejects movement. Backdrop dismissal uses the same generic close path; trainer state has the same structural risk. Centralize dismissal and state cleanup, and account for pending timers.
2. **Mixed Trail contains no rematches with the current roster.** After ten Level 1 targets, 15 unused questions remain. The mixed branch only adds review picks when fewer than ten unused questions exist. The browser audit measured ten new questions and zero rematches.
3. **Answers are highly position-biased.** Correct option is first for 23/25 wild questions and all 10 trainer and all 10 boss questions. Rendering preserves the stored option order.

### Confirmed by source inspection; not all exercised end to end

- Level-complete actions replace the sole modal with Journal or Results. Closing that replacement offers no explicit route back to the Continue button. The latest commit prevents movement from overwriting an open completion modal, but does not implement modal navigation/history.
- Encounter startup is delayed 420 ms without an immediate battle lock. Other transitions also retain unguarded timers after dismissal; rapid input or closing during feedback can race state and rendering.
- Trainer/boss question objects lack IDs, yet `makePieEl` and `Rarity.record` receive `f.id`. This produces undefined sprite identifiers and pooled evidence under the key `undefined`.
- `resetToFreshGame` leaves trainer badges and best streak intact. Trainers are placed again on subsequent maps even when badge state exists. Clarify whether these should persist across rounds or fresh games.
- Student/imported names and some imported record fields are inserted into dashboard HTML without escaping. Class Code validation checks little beyond a truthy name; malformed record shapes can break rendering. Validate the payload schema and render external text safely.
- Rematches overwrite earlier question records. Trainer rewards synthesize correct records without answering that creature's question. Both affect teacher statistics and need explicit product semantics.
- Bonus copy still mentions six new creatures, and New Territory advertises all unused creatures while selecting at most ten.
- Offline precache omits the QR encoder, font binaries, and manifest. A later online visit may cache requested files, but first-install offline completeness is not guaranteed. Activation also deletes every cache other than its own current name, without filtering by app prefix.
- QR capacity was checked using representative records and the shipped encoder: one and five records encoded, while ten and twenty overflowed its capacity at error-correction level M. The fixture omitted several normal metadata fields, so full payloads will not improve this result. Current export silently hides the QR on overflow; Class Code remains available.

The bonus chooser itself **worked** in the browser check; an early suspicion of a missing close-button binding was incorrect.

## Validation baseline and local workflow

The tracked working tree was clean at the start; handoff ZIPs/directories were already untracked. Installed the existing locked Playwright dependency with `npm.cmd ci --ignore-scripts --no-audit --no-fund`. This added untracked `node_modules/`; no package files changed. There is no `.gitignore` in the tracked inventory, so do not accidentally commit dependencies.

All eight active JS files parse. Question IDs and four-strategy shapes passed structural checks. A 500-map flood-fill sample found no unreachable encounter patches or guides; this is a randomized sample, not a proof.

Existing browser suites passed using installed Chrome through Playwright:

- `tools/verify_art.js`: **29/29**.
- `tools/verify_landing.js`: **57/57**, including ten viewport sizes.

The bundled Playwright Chromium executable is absent on this machine. The suites were run without editing them by overriding `chromium.launch` to include `channel: 'chrome'`, for example:

```powershell
node -e "const p=require('playwright');const launch=p.chromium.launch.bind(p.chromium);p.chromium.launch=o=>launch({...o,channel:'chrome'});require('./tools/verify_art.js');"
```

A temporary localhost server exposed selected private functions only in the served in-memory copy of `game.js`. This enabled targeted checks without changing source: answer/reflection/catch succeeded, Level 1 completion → New Territory entered Level 2, Escape retained battle state, and mixed selection lacked rematches. These were targeted transition checks, not a full map traversal. The server/browser were stopped afterward.

For local development, serve the root directory with a static HTTP server, for example `python -m http.server 8000 --bind 127.0.0.1`, then open `http://127.0.0.1:8000/`. Existing scripts use file URLs and therefore do not validate service workers. Safari/iOS, Firefox, offline installation/update behavior, and a complete end-to-end three-level playthrough remain unverified.

Recommended first coding work: stabilize modal lifecycle and progression, add focused regression coverage for those transitions, then fix mixed-round selection and answer ordering. Keep question IDs, art-generation contracts, and teacher-record semantics explicit when extending the game.

## Google Sheets implementation follow-up (19 September 2026)

Added optional Sheets synchronization for the GitHub-hosted game. `cloud-config.js` controls activation; its endpoint is intentionally blank until the owner deploys `google-apps-script/Code.gs`. `cloud-sync.js` queues acknowledged, revisioned updates per session in localStorage; `cloud-dashboard.js` reads teacher-authorized results and refreshes every 30 seconds. Class codes allow submission; the separate generated teacher key allows reading and is never included in the public configuration. The cloud dashboard displays the latest session per student ID; the Sheet retains session history.

See `GOOGLE_SHEETS_SETUP.md` for deployment, privacy/access settings, data semantics, and real-device acceptance checks. Local tests cover actual Apps Script handler logic with simulated Sheets and independent Playwright student/teacher contexts. A real Google deployment and GitHub Pages publication remain required; no live Sheet or cloud deployment was created during local implementation.
