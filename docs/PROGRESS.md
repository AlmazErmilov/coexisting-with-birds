# Progress

## 2026-03-03: kommune bird conflict modal

Click a municipality polygon to see a bird-turbine conflict assessment with customizable turbine parameters.

**What changed:**
- `scoreKommune()` in scoring.js: per-species scoring (not per-observation) to avoid area bias, only red list and rotor-overlap species contribute
- Constants in data.js: `DEFAULT_HUB_HEIGHT=90`, `DEFAULT_ROTOR_DIAMETER=115`, `KOMMUNE_SCORE_NORMALIZATION=60`
- `getFilteredData()` in ui.js to share current filtered observations with the modal
- Kommune modal HTML/CSS (reuses existing modal pattern): risk label, species at risk list with red list badges and rotor overlap indicators, confidence warning for low-data kommuner, turbine parameter inputs with debounced recalculation
- Kommune click handler in app.js with input validation (prevents NaN bug in `getAltRisk`)
- Escape key now works from inside input fields (moved before INPUT guard)
- Fixed existing e2e test (`modal-close` selector became ambiguous with two modals)
- 7 unit tests for `scoreKommune`, 4 Playwright e2e tests for the modal
- NORM=60 empirically calibrated: median non-empty kommune scores Moderate, top coastal kommuner score Very High

**Test totals:** 52 unit (vitest) + 13 e2e (Playwright)

## 2026-03-02: refactor to modular structure

Split the single file app (`index.html`) into a modular structure for long term maintainability.

**What changed:**
- Extracted CSS to `css/style.css` with CSS custom properties for theme colors
- Split JS into 4 ES modules: `data.js` (constants), `scoring.js` (pure functions), `ui.js` (DOM), `app.js` (entry point)
- Consolidated duplicate red list metadata (`RED_LIST_COLORS` + `RED_LIST_LABELS` + `RL_WEIGHT`) into single `RED_LIST_CATEGORIES`
- Replaced inline event handlers with `addEventListener` and event delegation
- Added `escapeHtml()` for data sourced strings in template literals
- Removed dead code (`CSS.escape` guard in `filterSpecies`)
- Added 45 unit tests (vitest) covering scoring, geo, risk calculation and filter predicates
- Added 9 E2E tests (Playwright) covering all UI features
- Updated documentation (README, header comment)

**No functional changes.** The app works identically to before.
