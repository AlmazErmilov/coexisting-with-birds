# Progress

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
