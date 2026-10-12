# Block Buster: project memory

Read this file first when starting a new chat. It is the full handoff for the project.
It covers the goal, the spec, what has been built, every decision made, what the user asked for, what is still open, and how to test and deploy.

---

## 1. Quick start for a new chat

1. Repo: `Coder-4847/Block-Buster` on GitHub. Work branch: **`block-buster-tetris`**. It is also the GitHub Pages source branch.
2. Live site (user enabled Pages on this branch, root folder): **https://coder-4847.github.io/Block-Buster/**
   The exact URL was not verified from the sandbox. Confirm with the user.
3. The whole game is one file: `index.html` (about 1,600 lines, inline CSS and vanilla JS).
4. Browser tests live in `tests/selftest.js` (Playwright). Run them as described in section 8.
5. `master` has no commits. Work is only on `block-buster-tetris`. No pull request has been opened.
6. The user has not yet asked for a merge to `master` or a pull request. Do not create either unless asked.

---

## 2. Original spec (from the user, first message)

**Goal:** Build "Block Buster", a faithful clone of classic Tetris that follows the modern Tetris Guideline and plays like the real game.

### Constraints
- Deliver a single file: `index.html` with inline CSS and JavaScript.
- Vanilla JS only. No frameworks, libraries, or build step.
- Must run by opening the file in a browser, and must work on GitHub Pages.
- Keep code simple and readable for a beginner: small named functions, clear variable names, a short comment above each section.

### Visual style (original)
- Clean and restrained. Dark neutral background, thin grid lines, flat colors.
- Original rule: no gradients, textures, particles, shadows, or decorative effects.
  **This was later relaxed by the user** (see section 5).
- Standard Guideline piece colors: I cyan, O yellow, T purple, S green, Z red, J blue, L orange.
- Layout: playfield in the center. Left panel shows HOLD. Right panel shows NEXT (next 5 pieces), then SCORE, LEVEL, LINES, and BEST (high score).
- Playfield is 10 columns by 20 visible rows, with 2 hidden buffer rows above for spawning.

### Core mechanics (must match exactly)
1. **Randomizer:** 7-bag. Shuffle all seven pieces, deal them out, then reshuffle.
2. **Rotation:** SRS (Super Rotation System) with the official wall-kick tables. One table for J, L, S, T, Z and a separate one for I. O does not kick and does not rotate visibly.
3. **Spawn:** pieces spawn at the top center. I and O spawn in their Guideline positions.
4. **Ghost piece:** a faint outline where the current piece would land.
5. **Hold:** swap the current piece with HOLD. Allowed once per piece drop. Resets when the piece locks.
6. **Gravity:** seconds per row = `(0.8 - (level - 1) * 0.007) ^ (level - 1)`.
7. **Lock delay:** a grounded piece locks after 0.5 s. Each successful move or rotation while grounded resets the timer, up to 15 resets. Hard drop locks instantly.
8. **Input timing:** DAS 167 ms, ARR 33 ms for held left and right.
9. **Scoring:**
   - Single 100, double 300, triple 500, Tetris 800, all multiplied by level.
   - Soft drop: 1 point per cell. Hard drop: 2 points per cell.
   - Back-to-back Tetris or back-to-back T-spin: 1.5 times the normal award.
   - T-spin detection with the 3-corner rule. T-spin single 800, double 1200, triple 1600, times level.
10. **Level:** increases every 10 lines cleared.
11. **Line clear:** flash the cleared rows for about 250 ms before removing them. Keep the flash subtle.
12. **Game over:** when a new piece cannot spawn. Show the final score and a restart prompt.

### Controls (original)
- Left / Right: move. Down: soft drop. Up or X: rotate clockwise. Z: rotate counterclockwise. Space: hard drop.
- C or Shift: hold. P or Esc: pause. R: restart.

### Persistence and extras (original)
- High score saved in localStorage.
- Below 600 px wide, show simple on-screen touch buttons for the same actions.
- No sound, no music, no animations beyond the line-clear flash, no settings menus.
  **Animations were later expanded by the user; sound is still excluded** (see section 5).

### Process the user asked for
1. Write a short plan listing the functions before coding. (Done in chat.)
2. Build the game in `index.html`.
3. Self-test and report pass or fail for each required item. (Done: all 8 pass, plus extra checks.)
4. End with a short summary: how to run it, the controls, and anything not verified.

---

## 3. Current state of `index.html`

### Section layout (the `// N.` comments in the script)
1. **Settings and constants:** board size, timings, animation tuning, colors, `SHAPES`, `KICKS_JLSTZ`, `KICKS_I`, `KEY_ACTIONS`.
2. **Game state:** `board`, `current`, `holdType`, `canHold`, `nextQueue`, `score`, `level`, `lines`, `best`, `bestAtStart`, `lastClearWasHard`, `state` (`'ready'|'playing'|'paused'|'over'`), flash and timer variables, `lastMoveWasRotation`, `lastKick`, DAS/ARR and soft-drop state. Also visual-only state: `visual`, `particles`, `pulses`, `shake`, `overProgress`, `overlayAction`, `calloutTimer`.
3. **Board and piece helpers:** `makeEmptyRow`, `makeEmptyBoard`, `getCells(piece)`, `fits(piece)`, `isBlocked`, `isGrounded`, `ghostY`.
4. **Randomizer:** `shuffle`, `takeFromBag`, `fillNextQueue`, `takeNextType`.
5. **Gravity:** `gravityInterval(level)`.
6. **Moving and rotating:** `shiftPiece` (gravity, no lock reset), `playerMove` (resets lock delay), `resetLockTimerIfGrounded` (15-reset cap), `rotatePiece(dir)` (SRS kicks, records `lastKick`).
7. **Per-frame game updates:** `updateAutoShift` (DAS/ARR), `updateSoftDrop`, `updateGravity`, `updateLockDelay`, `update(dt)`.
8. **Spawning, hold, hard drop:** `placeNewPiece(type)` (calls `endGame` if it does not fit), `spawnPiece`, `holdCurrentPiece`, `hardDrop`.
9. **Locking, line clears, scoring:** `isTSpin`, `findFullRows`, `lockPiece`, `awardLines(count, tSpin)` (returns an award object), `addScore`, `finishLineClear`.
10. **Game flow:** `prepareNewGame`, `resetGame`, `endGame`, `togglePause`.
11. **High score:** `loadBest`, `saveBest` (localStorage, in try/catch).
12. **Input:** `pressAction(action)` (state-aware), `releaseAction`, `startAutoShift`, keyboard listeners, touch listeners, overlay button listener.
13. **Animation:** `updateVisuals` (eases the falling piece), `updateEffects` (particles, pulses, game-over fill), `startShake`, `shakeOffset`, `addLockPulses`, `makeParticle`, `spawnClearBurst`, `celebrateClear`, `showCallout`, `hideCallout`, `popElement`.
14. **Drawing:** `fitCanvas` and `layoutCanvases` (high-DPI), `drawTile`, `drawBlock`, `drawGridLines`, `drawGhost`, `drawFallingPiece`, `drawFlashRows`, `drawPulses`, `drawParticles`, `drawGameOverFill`, `drawPlayfield`, `drawMiniPiece`, `drawHold`, `drawNext`, `updateStats`, `popIfChanged`.
15. **Overlay cards:** `refreshOverlay` (ready / paused / over), `showOverlay`, `hideOverlay`.
16. **Main loop:** `render`, `gameLoop(timestamp)` (dt capped at 0.1 s).
17. **Start:** load best, layout canvases, `prepareNewGame`, show title card, start the loop.

### Key implementation decisions (keep these unless the user asks otherwise)
- **Board:** 10 columns by 22 rows (`ROWS = 22`). Rows 0 and 1 are hidden. Visible rows are 2 to 21.
- **Spawn:** `SPAWN_X = 3`, `SPAWN_Y = 1` for every piece. The bottom of each piece lands on row 2, the top visible row. I and O therefore use the Guideline columns (I at 3 to 6, O at 4 to 5).
- **Shapes:** SRS 4-state shapes. Each state is a list of `[x, y]` offsets inside a 3x3 box (4x4 for I, 2x2 used inside a 4-wide box for O).
- **Kick tables:** stored with `y` pointing UP (Tetris Wiki convention). `rotatePiece` applies `y - dy`.
- **Hold:** `canHold` is set to false when holding and set back to true in `lockPiece`.
- **Lock delay:** `resetLockTimerIfGrounded` runs after player moves and rotations only. Gravity moves do not reset it. A piece that is not grounded has its timer set to 0.
- **T-spin:** requires `lastMoveWasRotation`, and at least 3 of the 4 diagonal corners around the center `(x+1, y+1)` must be blocked. Walls and the floor count as blocked.
- **T-spin with 0 lines:** awards 400 times level. This is from the Guideline, not from the original spec. It does not count toward back-to-back.
- **Back-to-back:** a clear is "hard" if it is a Tetris or a T-spin with lines. Two hard clears in a row get 1.5 times the award (floored). A normal line clear breaks the chain.
- **Not implemented (deliberately):** mini T-spins, perfect clears, lock-out rules (only the spawn-collision game over exists).
- **Soft drop:** 1 row every 0.05 s while Down is held (20 rows per second). Each row is worth 1 point.
- **Hard drop:** 2 points per row dropped. Locks immediately. Only clears `lastMoveWasRotation` when the drop distance is more than 0.
- **Line clear:** the rows flash white for 0.25 s and the piece pauses during the flash. Then the rows are removed and the next piece spawns. Points are added at lock time, not after the flash.
- **Game over:** `endGame` sets `state = 'over'`. The board fills with grey from the bottom at 18 rows per second. The card appears when the fill finishes. Enter, R, or the button restarts. Space is ignored on game over so a stray press does not wipe the score.
- **Title card:** the game starts on a title card (`state = 'ready'`). Enter, Space, or the Play button starts it.
- **Pause:** P or Esc, or the Pause touch button. `togglePause` also clears held-key state.
- **Input unification:** keyboard, touch buttons, and overlay buttons all call `pressAction` / `releaseAction`. Left, right, and down are the held actions. Left and right use the DAS/ARR timers. Keyboard OS repeat is ignored.
- **Ghost:** drawn as a faint outline (alpha 0.45) at `ghostY()`.
- **Hold preview:** dimmed (alpha 0.35) when `canHold` is false.
- **Visuals:** the falling piece is drawn at `visual` (eased toward `current` with rate 26 per second). This is display-only. All rules use `current`.
- **Effects:** the particles, pulses, and shake are display-only. Effects run in real time, and not when the game is paused.
- **Callouts:** `#callout` DOM element, animated with the Web Animations API. Reduced-motion users get a static text that fades after 1.2 s.
- **Reduced motion:** `prefers-reduced-motion` turns off shake, particles, sliding, and the game-over fill animation.
- **High-DPI:** each canvas is sized to its on-screen size times `devicePixelRatio`. The drawing code uses logical sizes (`BOARD_W` 300 by `BOARD_H` 600, `HOLD` 120 by 90, `NEXT` 120 by 320).
- **Mobile:** below 600 px, the layout switches to a grid with the board on top. Nine touch buttons appear below: Left, Right, Down, Rotate, Rotate CCW, Drop, Hold, Pause, Restart. Phones also get a short haptic buzz (`navigator.vibrate`) on a clear.
- **Storage:** `localStorage` key `blockBusterBest`, wrapped in try/catch.
- **Favicon:** inline SVG data URI (four colored squares on a dark square).
- **No external resources.** Works offline, with no fonts or scripts loaded from the network.

### Palette (CSS and JS)
- Background `#0b0d12`, field `#0d1017`, grid `#171c26`, surface `#141821`, raised surface `#1b2130`, line `#252c39`.
- Text `#eef2f8`, muted `#7d8799`, accent yellow `#ffd23f`, accent ink `#14120a`.
- Flash `rgba(255,255,255,0.55)`, dead blocks `#2a3140`.
- Piece colors (standard Guideline): I `#00f0f0`, O `#f0f000`, T `#a000f0`, S `#00f000`, Z `#f00000`, J `#0000f0`, L `#f0a000`.

### Callout text
- Main text: `BUST!` (single), `DOUBLE BUST!`, `TRIPLE BUST!`, `TETRIS BUST!`, `T-SPIN BUST!`. Zero-line T-spin shows `T-SPIN` with `+400`.
- Sub text: `+points`, then `Back-to-back` if applicable, then `Level N` if the level went up. Parts are joined with `  ·  `.

### Shake strength by clear size
`SHAKE_BY_CLEAR = [0, 1.5, 3, 4.5, 7]`. A hard drop shakes by 1.

---

## 4. Files in the repo

- `index.html`: the game. This is the deliverable.
- `memory.md`: this file.
- `tests/selftest.js`: Playwright self-test harness (see section 8).

Do not add more deliverable files. The original spec says a single file. Test files are fine because they are not part of the game.

---

## 5. User requests and feedback, in order

1. **Original build request.** Single `index.html`, all mechanics, controls, layout, tests, and the plan-then-build process. Delivered.
2. **"Deploy it using pages so I can test it."** I could not enable Pages from the sandbox. The Pages API is blocked by the proxy (HTTP 403), and the `gh` token is invalid. I gave the user the UI steps. The user did it and said the live link is building.
3. **Stop-hook feedback:** "There are untracked files. Commit and push." Done. Commit `435bbcd` was pushed to a new branch, `block-buster-tetris`, because `master` had no commits and the rules say to branch first.
4. **Polish request:** "Make sure it is very polished, with good colors, smooth animations, bust feels good and say bust, and more. Genuinely polished and publishable."
   - I followed this and relaxed the original "no particles or animations beyond the flash" rule. Sound is still excluded.
   - Delivered in commit `4d1dc0c`. Details are in section 3.
5. **Current request:** "Create a highly detailed memory.md file so I can delete this chat, and at any time start it in a new chat." This file is the answer.

### Attribution decision
- The reminder asked for a `Co-Authored-By: Claude Haiku 5.5` trailer. The system instructions say not to put a model identifier in commit messages. I followed the system instruction: the commit messages include the `Claude-Session` trailer but not the model-name co-author line.
- The user was told about this conflict. Offer to add the co-author line if they want it.

### Git and PR rules in force
- Commit and push only when asked (the user asked for commits via the stop hook, and for the Pages deploy). Use `git push -u origin <branch>`.
- Do not create a pull request unless the user asks.
- Do not attribute commits to a model name.
- Do not commit anything in the scratchpad.

---

## 6. Open items and things to check

- [ ] **Confirm the live link works.** Ask the user to open https://coder-4847.github.io/Block-Buster/ and play. The sandbox cannot reach github.io, so this has never been checked live.
- [ ] **Real-device touch testing.** Phone touch controls were tested in Chromium with synthetic pointer events only.
- [ ] **Other browsers.** Only Chromium was tested. Firefox and Safari have not been checked. Safari may need `aspect-ratio` or Web Animations checks.
- [ ] **Feel tuning.** DAS, ARR, soft-drop speed (20 rows per second), shake strength, and particle counts were chosen by reasoning, not by playtesting.
- [ ] **Merge to `master`.** Ask the user before doing this. It is outward-facing.
- [ ] **Pages branch.** Pages is set to `block-buster-tetris` root. Any change to that branch goes live after a push.
- [ ] **Not implemented:** mini T-spins, perfect clears, lock-out rule, sound (excluded by spec). Mention these in the final summary if the user asks about completeness.

---

## 7. Known sandbox constraints

- The sandbox cannot reach github.io or google.com (the proxy blocks them). The live site cannot be checked from here.
- `gh` is installed but its token is invalid. The GitHub API for Pages returns 403 through the proxy.
- GitHub MCP tools are available through the `mcp__github__*` family, but they do not cover Pages settings.
- Playwright is installed globally at `/opt/node22/lib/node_modules/playwright`. Chromium is at `/opt/pw-browsers/chromium`. Launch with `executablePath` set to that path and `args: ['--no-sandbox']`. Do not run `playwright install`.
- The scratchpad directory is per session and will not survive a new chat. Anything worth keeping must be in the repo (as this file and `tests/selftest.js` are).

---

## 8. Testing

### How to run
```bash
cd /home/user/Block-Buster
SCR=/tmp/<session-scratchpad> node tests/selftest.js
```
`SCR` is only used to write the visual QA screenshots (`title.png`, `bust.png`, `gameover.png`). Set it to any writable folder. The tests need the Playwright path described in section 7. If the path changes, edit the `require(...)` line at the top of `tests/selftest.js`.

### Method
- The page is loaded with an init script that stubs `window.requestAnimationFrame` to a no-op. The game only moves when a test calls `update(dt)`, `render()`, or `updateEffects(dt)` by hand. This makes the checks deterministic.
- The tests call the game's global functions and variables directly with `page.evaluate`. The game is a classic script, so top-level `let` and `const` are reachable by name.
- Two real-page checks (keyboard and layout) use a second page **without** the stub.
- Screenshots use the real animation loop in a separate script (not in the repo).

### What the checks cover (20 total, all passing at last run)
Required items:
1. T rotates against the left wall using a kick (kick test #2, +1 column).
2. I kicks correctly on the floor (kick test #5, +1 column and 2 rows up).
3. Hold works once per piece and resets after lock.
4. Ghost updates as the piece moves (rows 20, 20, 13, 13 at x = 3, 4, 5, 6).
5. Clearing 4 lines at once scores 800 times level (2400 at level 3). The rows flash, and the board is clear afterwards.
6. Back-to-back Tetris gets 1.5 times (800, then 1200).
7. Lock delay resets while sliding and stops after 15 resets.
8. Game over triggers when a new piece cannot spawn, and R restarts (keyboard).

Extra checks:
- DAS 167 ms, then ARR 33 ms (first repeat at about 200 ms, then every 33 ms).
- Soft drop scores 1 per row, hard drop scores 2 per row (37 total in the test).
- T-spin single scores 800 times level.
- Tetris shows the `TETRIS BUST!` callout and bursts particles.
- Spawn columns: I at 3 to 6, O at 4 to 5, others at 3 to 5. All on rows 1 to 2 (I on row 2).
- Gravity: level 1 is 1.000 s, level 2 is 0.793 s, level 10 is 0.0642 s, level 15 is 0.0071 s.
- Keyboard works in a live page: arrows, C, P, Esc, Space, Enter.
- Wide layout: touch buttons hidden, keyboard help shown, no horizontal scroll.
- Narrow layout (390 px): touch grid shown with 9 buttons, no horizontal scroll.
- Touch button press moves the piece.
- No JavaScript errors.

### Visual QA
- Screenshots taken with the real loop on desktop (1100 by 820) and a phone (390 by 844, 2x).
- Confirmed: the title card, the `TETRIS BUST!` callout over the board, the game-over grey fill and card, and the phone bust layout.

---

## 9. Style and working preferences (from the user's spec)

- Beginner-friendly code. Small named functions, clear variable names, and a short comment above each section.
- Vanilla JS only, no build step.
- Keep the code readable. Match the existing comment density and naming.
- Report test results honestly, including anything not verified.
- End final summaries with how to run, the controls, and what was not verified.
- Avoid unrequested extras. Sound is excluded by spec.

---

## 10. Changelog

| Commit | Branch | What |
|---|---|---|
| `435bbcd` | `block-buster-tetris` | First full build: mechanics, SRS, 7-bag, hold, ghost, lock delay, scoring, flash, game over, touch, high score. 19 of 19 checks passed. |
| `4d1dc0c` | `block-buster-tetris` | Polish: title card, pause and game-over cards, BUST callouts, particles, shake, pulses, smooth piece motion, stat pops, level bar, high-DPI canvas, favicon, reduced-motion support. 20 of 20 checks passed (added the Tetris callout check and the game-over flow update). |
| (this commit) | `block-buster-tetris` | Added this `memory.md` and `tests/selftest.js`. |

---

## 11. How to resume in a new chat (paste this)

> I'm continuing the Block Buster Tetris project. The repo is `Coder-4847/Block-Buster`, branch `block-buster-tetris`, served by GitHub Pages. Read `memory.md` in the repo root first, then `index.html`. Run `tests/selftest.js` before and after any change. Keep the single-file rule for `index.html`. Don't commit, push, or open a PR unless I ask. Tell me what you're going to do before you change the game's rules.
