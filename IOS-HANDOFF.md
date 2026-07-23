# iOS Wrapper Handoff — App Store Guideline 4 Rejection (RESOLVED on web side)

**For:** the agent/developer working on the iOS wrapper app
**From:** the web-game session that fixed the rejection (2026-07-22)
**Status:** all game-content fixes are **merged and live**. What remains is wrapper-side: verify on device, rebuild if needed, resubmit.

---

## 1. What happened

Apple rejected the build under **Guideline 4 – Design**:

> "Parts of the app's user interface were crowded, laid out, or displayed in a way that made it difficult to use the app when reviewed on **iPad Air 11-inch (M3) running iPadOS 26.5**. Specifically, there's an issue with **text overlapping on the game screens**."

Their screenshot (iPad portrait) showed the **❤️ health bar painted over the "Sandyten" logo** at the top-left of the HUD, plus NPC name labels stacked on each other in the world.

## 2. Root cause & fix (already done — context only)

The game's HUD used hardcoded pixel offsets tuned for phones (`@media (max-width: 520px)`) and desktop. **iPads fall in the gap**: wider than 520px (so phone offsets never fire) but they match the touch rules (`hover:none`/`pointer:coarse`, `body.touch`) that make the top bar taller and wrap its buttons — so absolutely-positioned elements landed on each other.

Fixed in **PR #66** (`3806bdf`) in `sandyten/index.html` + `sandyten/src/main.js`:

- Logo + health/hunger bars now share one **flowing layout column** — the reported overlap is impossible by construction.
- Toasts and all five side panels (Quests/Prizes/Trade/Dressing/Shop) **position themselves below the measured top bar** at open time and re-place on rotation (`placeSidePanel()`), instead of using fixed `top` offsets.
- 14 more adversarially-verified hazards fixed: shop panel clipping off-screen on short viewports, mini-game compaction, control collisions (throw button / elevator / battle prompt / hint), speech-bubble viewport clamping, and the in-world **name-label pile-ups visible in Apple's screenshot** (labels de-stack when characters cluster, hide during NPC trades, shrink long pet names).
- Verified with a programmatic overlap detector at **820×1180, 1180×820, 844×390, 375×667, 1280×800** across every UI state: zero overlaps. Desktop rendering unchanged.

**Deploy state:** merged to `main`; GitHub Pages rebuilt successfully; the live URL serves the fixed files (verified by marker grep):
`https://markjeromecruz.github.io/craftmania/sandyten/`

## 3. What YOU need to do

### Step A — Determine how the wrapper gets the game content

| Wrapper mode | Action required |
|---|---|
| **Loads the live URL** in WKWebView | Content fix is already reachable. ⚠️ Two caveats: (1) GitHub Pages serves `Cache-Control: max-age=600` and `index.html` imports `src/main.js` **un-versioned** — WKWebView's URLCache can serve the stale pre-fix JS for a while. Call `URLCache.shared.removeAllCachedResponses()` on launch of the new build, or load with `.reloadRevalidatingCacheData`, so the reviewer cannot hit cached old code. (2) You still need a **new build number** to resubmit. |
| **Bundles the web files** | Re-copy the current `sandyten/` directory (at repo `main`, commit `3806bdf` or later) into the app bundle. Nothing else in the game changed structurally — same file layout, no build step, no new files. |

> If the app also ships the 2D root game (`index.html` + `src/` at repo root — "Craftmania"), it was **not** part of the rejection and was not modified. Only `sandyten/` changed.

### Step B — WKWebView environment checks (the fix depends on these)

The game picks its touch layout from, in order: `matchMedia('(hover: none) and (pointer: coarse)')` **or** `'ontouchstart' in window` **or** `navigator.maxTouchPoints > 0` (adds `body.touch`), plus native CSS `@media (hover: none) and (pointer: coarse)` rules. A standard WKWebView on iPadOS satisfies all of these — just don't inject anything that spoofs a desktop pointer profile.

- Keep the viewport meta as served by the page; if the wrapper injects its own, it must include `width=device-width, initial-scale=1`.
- If the app is rendered edge-to-edge under the home indicator, prefer respecting safe-area insets (constrain the WKWebView to the safe area). The game does not use `env(safe-area-inset-*)` internally; its bottom controls have generous insets, but the safe-area constraint keeps the home indicator from sitting on the joystick on future devices.
- Support **both orientations** on iPad (the fix was verified in both; App Review rotates).

### Step C — 5-minute smoke test before submitting (device or Simulator: iPad Air 11-inch)

Do this on the **real rendering stack** — the web-side verification simulated iPadOS in desktop Chromium, which reproduced Apple's screenshot exactly but uses different font metrics than SF Pro/WebKit.

1. Launch, start **New Game**, pick a character, pick the **dog**, name it **`Marshmallow`** (tests long-name shrink-to-fit), skip child.
2. **Top-left check** (the rejected screen): "Sandyten" logo with the ❤️ and 🍗 bars stacked cleanly *below* it — no touching. Confirm in **both orientations**.
3. Tap **🎯 Quests**, then **🎁 Prizes**, then **🤝 Trade** — each panel must open *below* the wrapped top-bar buttons, never on top of them. Rotate with a panel open — it should re-position.
4. Walk to **THE STORE** (shopkeeper, just south of spawn) — the shop panel auto-opens: title and ✕ visible, panel scrolls if needed, the 🎾 button disappears while it's open.
5. Walk to the **hospital elevator pad** (east) with the Quests panel open — the floor picker must *not* appear until the panel is closed.
6. Wait for **night** (~3 min, or hang around) — a toast appears: it must sit below the top bar, not behind the buttons.
7. Watch the courtyard NPCs for ~30s — when two characters bunch up or trade (🎁), their name pills must not sit on top of each other.
8. Tap any character — the speech bubble must stay fully on screen, and the speaker's name pill hides while the bubble is up.

If **anything** overlaps: screenshot + device + orientation + which step, and report back to the web-game session — the relevant code is `sandyten/index.html` (all CSS) and `sandyten/src/main.js` (`placeSidePanel`, `questToast`, the label de-stacker near `nextLabelDeclutterAt`). Fixes land same-day.

### Step D — Resubmit

1. Bump version/build, archive, upload to App Store Connect.
2. In the resolution notes / reply to App Review:

> We resolved the text overlap issue. The game's HUD was restructured so the health bars, logo, panels, and notifications position themselves in layout flow rather than at fixed offsets, and we verified the interface on iPad Air 11-inch in both portrait and landscape across all game screens, including the screens shown in the review screenshots.

## 4. Reference — verified geometry matrix (web side)

| Viewport | Orientation/device | Result |
|---|---|---|
| 820×1180 | iPad Air 11" portrait | ✅ zero overlaps, all states |
| 1180×820 | iPad Air 11" landscape | ✅ |
| 844×390 | iPhone landscape | ✅ (shop scroll, mini-game compaction, hint reposition) |
| 375×667 | iPhone portrait | ✅ (brand row layout, panels below measured bar) |
| 1280×800 | Desktop | ✅ pixel-unchanged from before the fix |

States covered per viewport: fresh HUD, quest toast, battle prompt, elevator picker, each side panel, mini-game modals, and busy combinations. 304 unit tests pass; 0 console errors; 60fps.
