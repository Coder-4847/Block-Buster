// Self-test harness for /home/user/Block-Buster/index.html (lives outside the repo on purpose).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const URL = 'file:///home/user/Block-Buster/index.html';
const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -- ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox'],
  });

  // Deterministic page: rAF is stubbed, so the game only moves when a test calls update().
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()); });
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(URL);
  const ev = (fn, arg) => page.evaluate(fn, arg);

  // ---- Required item 1: T rotates against the left wall using a kick ----
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      current = { type: 'T', rot: 1, x: -1, y: 10 }; // R state, pressed against the left wall
      const ok = rotatePiece(1);                     // R -> 2 (clockwise)
      return { ok, rot: current.rot, x: current.x, y: current.y, kick: lastKick };
    });
    record('T rotates against left wall using a kick',
      r.ok && r.rot === 2 && r.kick === 1 && r.x === 0 && r.y === 10,
      `kick test #${r.kick + 1} (+1,0) moved it to x=${r.x}`);
  }

  // ---- Required item 2: I kicks correctly on the floor ----
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      current = { type: 'I', rot: 0, x: 3, y: 20 }; // flat I lying on the floor (row 21)
      const ok = rotatePiece(1);                    // 0 -> R (clockwise)
      return { ok, rot: current.rot, x: current.x, y: current.y, kick: lastKick };
    });
    record('I piece kicks correctly on the floor',
      r.ok && r.rot === 1 && r.kick === 4 && r.x === 4 && r.y === 18,
      `unkicked and tests 1-4 blocked by floor; test #5 (+1,+2 up) used -> x=${r.x}, y=${r.y}`);
  }

  // ---- Required item 3: hold works once per piece, resets after lock ----
  {
    const r = await ev(() => {
      resetGame();
      const first = current.type;
      const h1 = holdCurrentPiece();
      const afterFirst = { holdType, canHold };
      const h2 = holdCurrentPiece();                // should be refused
      const afterSecond = { holdType, canHold };
      hardDrop();                                   // locks the piece, which resets canHold
      const canHoldAfterLock = canHold;
      const second = current.type;
      const h3 = holdCurrentPiece();                // swap back to the first piece
      return { first, h1, h2, h3, afterFirst, afterSecond, canHoldAfterLock,
               playedType: current.type, second, holdAfterSwap: holdType };
    });
    const ok = r.h1 && !r.h2 && r.afterFirst.holdType === r.first && r.afterFirst.canHold === false
      && r.afterSecond.holdType === r.first && r.canHoldAfterLock === true
      && r.h3 && r.playedType === r.first && r.holdAfterSwap === r.second;
    record('Hold works once per piece and resets after lock', ok, JSON.stringify(r));
  }

  // ---- Required item 4: ghost piece updates as the piece moves ----
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      board[15][7] = 'J';                            // a block the ghost must land on
      current = { type: 'T', rot: 0, x: 3, y: 1 };
      const seen = [ghostY()];
      for (let i = 0; i < 3; i++) {
        playerMove(1, 0);
        seen.push(ghostY());
      }
      return { seen, x: current.x };
    });
    const ok = r.seen[0] === 20 && r.seen[3] === 13 && r.seen[3] !== r.seen[0];
    record('Ghost piece updates as the piece moves', ok, `ghost rows at x=3,4,5,6: ${r.seen.join(', ')}`);
  }

  // ---- Required item 5: clearing 4 lines at once scores 800 x level ----
  // Helper: fill rows 18-21 except column 9, then drop a vertical I into column 9.
  const tetrisSetup = () => {
    board = makeEmptyBoard();
    for (let row = 18; row <= 21; row++) {
      for (let col = 0; col < 9; col++) board[row][col] = 'J';
    }
    current = { type: 'I', rot: 1, x: 7, y: 18 };  // vertical I in column 9, resting at the bottom
  };
  {
    const r = await ev(() => {
      resetGame();
      lines = 20; level = 3;                       // so this clear happens at level 3
      score = 0;
      board = makeEmptyBoard();
      for (let row = 18; row <= 21; row++) for (let col = 0; col < 9; col++) board[row][col] = 'J';
      current = { type: 'I', rot: 1, x: 7, y: 18 };
      hardDrop();                                   // 0 rows of drop, so no drop points
      const flashing = flashRows.length;
      const scoreAfterLock = score;
      update(0.3);                                  // let the flash finish
      return { flashing, scoreAfterLock, lines, level, emptyCells: board.flat().filter(Boolean).length };
    });
    record('Clearing 4 lines at once scores 800 x level',
      r.flashing === 4 && r.scoreAfterLock === 2400 && r.lines === 24 && r.emptyCells === 0,
      `score=${r.scoreAfterLock} (expected 2400 at level 3), 4 rows flashed, board cleared after flash`);
  }

  // ---- Required item 6: back-to-back Tetris gets the 1.5x multiplier ----
  {
    const r = await ev(() => {
      resetGame();
      score = 0;
      const setup = () => {
        board = makeEmptyBoard();
        for (let row = 18; row <= 21; row++) for (let col = 0; col < 9; col++) board[row][col] = 'J';
        current = { type: 'I', rot: 1, x: 7, y: 18 };
      };
      setup();
      hardDrop();
      const first = score;                          // plain Tetris at level 1: 800
      update(0.3);
      setup();
      hardDrop();
      const second = score - first;                 // back-to-back Tetris: 800 x 1.5 = 1200
      update(0.3);
      return { first, second };
    });
    record('Back-to-back Tetris gets the 1.5x multiplier',
      r.first === 800 && r.second === 1200,
      `first Tetris=${r.first} (expected 800), back-to-back=${r.second} (expected 1200)`);
  }

  // ---- Required item 7: lock delay resets while sliding and stops after 15 resets ----
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      current = { type: 'O', rot: 0, x: 3, y: 20 };   // O resting on the floor
      lockTimer = 0; lockResets = 0; gravityTimer = 0;
      const log = [];
      for (let i = 1; i <= 15; i++) {
        playerMove(i % 2 ? 1 : -1, 0);               // slide left/right on the floor
        log.push({ resets: lockResets, timer: lockTimer });
        update(0.4);                                 // still under 0.5 s, so no lock yet
      }
      // 16th slide: the reset cap is hit, so the timer must NOT reset.
      playerMove(-1, 0);
      const after16 = { resets: lockResets, timer: lockTimer };
      const stillFalling = current !== null && current.type === 'O';
      update(0.2);                                   // total 0.6 s since the last reset -> locks
      const lockedO = board.flat().filter((c) => c === 'O').length;
      return { log, after16, stillFalling, lockedO };
    });
    const resetsOk = r.log.every((step, i) => step.resets === i + 1 && step.timer === 0);
    const ok = resetsOk && r.after16.resets === 15 && r.after16.timer === 0.4
      && r.stillFalling && r.lockedO === 4;
    record('Lock delay resets while sliding and stops after 15 resets', ok,
      `resets counted 1..15 with timer reset each time; 16th slide kept timer at ${r.after16.timer}; locked after 0.6 s total (${r.lockedO} O blocks placed)`);
  }

  // ---- Required item 8: game over triggers and restart works ----
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      for (let col = 0; col < COLS; col++) { board[1][col] = 'Z'; board[2][col] = 'Z'; }
      placeNewPiece('T');                            // cannot spawn: the top rows are full
      updateEffects(2);                              // let the grey fill finish, which reveals the card
      return {
        state, overlayVisible: !document.getElementById('overlay').classList.contains('hidden'),
        title: document.getElementById('overlayTitle').textContent,
        text: document.getElementById('overlayText').textContent,
      };
    });
    record('Game over triggers when a new piece cannot spawn',
      r.state === 'over' && r.overlayVisible && r.title === 'GAME OVER' && r.text.startsWith('Final score'),
      `state=${r.state}, overlay="${r.title}" / "${r.text}"`);

    // Restart with the R key (real key press, goes through the keyboard listener).
    await page.keyboard.press('r');
    const after = await ev(() => ({
      state, score, filled: board.flat().filter(Boolean).length,
      overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
    }));
    record('Restart works after game over (R key)',
      after.state === 'playing' && after.score === 0 && after.filled === 0 && after.overlayHidden,
      JSON.stringify(after));
  }

  // ---- Extra checks ----

  // DAS 167 ms, then ARR 33 ms
  {
    const times = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      current = { type: 'O', rot: 0, x: 6, y: 5 };
      pressAction('left');                          // first move happens right away
      const moves = [];
      let t = 0;
      let lastX = current.x;
      for (let i = 0; i < 400; i++) {               // 400 steps of 1 ms
        update(0.001);
        t += 1;
        if (current.x !== lastX) { moves.push(Math.round(t)); lastX = current.x; }
      }
      releaseAction('left');
      return moves;
    });
    const first = times[0];
    const gaps = times.slice(1, 5).map((v, i) => v - times[i]);
    const ok = first >= 198 && first <= 202 && gaps.every((g) => g >= 32 && g <= 34);
    record('DAS 167 ms then ARR 33 ms', ok,
      `first auto-shift at ~${first} ms (expected ~200 = 167 DAS + 33 ARR), gaps ${gaps.join(', ')} ms`);
  }

  // Soft drop = 1 point per row, hard drop = 2 points per row
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      current = { type: 'T', rot: 0, x: 3, y: 1 };
      score = 0;
      pressAction('down');
      update(0.001);                                // soft drop: first row
      releaseAction('down');
      const afterSoft = { score, y: current.y };
      const dist = ghostY() - current.y;            // 18 rows to the floor
      hardDrop();
      return { afterSoft, dist, scoreAfterHard: score };
    });
    record('Soft drop scores 1 per row, hard drop scores 2 per row',
      r.afterSoft.score === 1 && r.afterSoft.y === 2 && r.dist === 18 && r.scoreAfterHard === 1 + 36,
      `soft: score=${r.afterSoft.score}; hard drop of ${r.dist} rows: total=${r.scoreAfterHard} (expected 37)`);
  }

  // T-spin single = 800 x level (and a plain single would only be 100)
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      for (const col of [0, 1, 2, 3, 5, 6, 7, 8, 9]) board[21][col] = 'J'; // bottom row with a hole at col 4
      board[19][5] = 'J';                                                    // block that blocks the corner
      score = 0; lines = 0; level = 1;
      current = { type: 'T', rot: 3, x: 3, y: 19 };
      const rotated = rotatePiece(-1);              // 3 -> 2 slides the T into the hole
      hardDrop();
      return { rotated, score, lines, flashing: flashRows.length };
    });
    record('T-spin single scores 800 x level', r.rotated && r.score === 800 && r.flashing === 1,
      `rotated=${r.rotated}, score=${r.score} (expected 800), rows cleared=${r.flashing}`);
  }

  // Bust feel: a Tetris shows the BUST callout and spawns particles
  {
    const r = await ev(() => {
      resetGame();
      board = makeEmptyBoard();
      for (let row = 18; row <= 21; row++) for (let col = 0; col < 9; col++) board[row][col] = 'J';
      current = { type: 'I', rot: 1, x: 7, y: 18 };
      hardDrop();
      const main = document.getElementById('calloutMain').textContent;
      const sub = document.getElementById('calloutSub').textContent;
      const particlesAfterClear = particles.length;
      updateEffects(1.5);
      return { main, sub, particlesAfterClear, particlesLater: particles.length };
    });
    record('Tetris shows "TETRIS BUST!" callout and bursts particles',
      r.main === 'TETRIS BUST!' && r.sub.includes('+800') && r.particlesAfterClear > 0 && r.particlesLater === 0,
      JSON.stringify(r));
  }

  // Spawn positions match the Guideline: I at columns 4-7, O at 5-6, others at 4-6 (1-indexed)
  {
    const r = await ev(() => {
      const out = {};
      for (const type of PIECE_NAMES) {
        board = makeEmptyBoard();
        placeNewPiece(type);
        const cells = getCells(current);
        out[type] = {
          minX: Math.min(...cells.map((c) => c.x)), maxX: Math.max(...cells.map((c) => c.x)),
          minY: Math.min(...cells.map((c) => c.y)), maxY: Math.max(...cells.map((c) => c.y)),
        };
      }
      return out;
    });
    const want = { I: [3, 6], O: [4, 5] };
    const ok = PIECE_NAMES_CHECK(r, want);
    record('Spawn positions: I and O in Guideline columns, all pieces at the top visible row',
      ok, `I x=${r.I.minX}-${r.I.maxX}, O x=${r.O.minX}-${r.O.maxX}, T x=${r.T.minX}-${r.T.maxX}`);
  }

  // Gravity: level 1 = 1.0 s per row
  {
    const g = await ev(() => [1, 2, 10, 15].map((l) => gravityInterval(l)));
    record('Gravity follows the formula (level 1 = 1.0 s per row)',
      Math.abs(g[0] - 1) < 1e-9 && Math.abs(g[1] - 0.793) < 1e-9,
      `seconds per row: L1=${g[0].toFixed(3)}, L2=${g[1].toFixed(3)}, L10=${g[2].toFixed(4)}, L15=${g[3].toFixed(4)}`);
  }

  // ---- Real keyboard page (no rAF stub): input mapping, pause, hard drop, layout ----
  {
    const live = await browser.newPage();
    const liveErrors = [];
    live.on('pageerror', (e) => liveErrors.push(e.message));
    await live.goto(URL);
    await live.waitForTimeout(300);
    await live.keyboard.press('Enter');       // start from the title card
    await live.waitForTimeout(50);
    const before = await live.evaluate(() => ({ x: current.x, state, holdType }));
    await live.keyboard.down('ArrowLeft');
    await live.waitForTimeout(40);
    await live.keyboard.up('ArrowLeft');
    const afterLeft = await live.evaluate(() => current.x);
    await live.keyboard.press('KeyC');
    const afterHold = await live.evaluate(() => holdType);
    await live.keyboard.press('KeyP');
    const paused = await live.evaluate(() => ({ state, overlay: !document.getElementById('overlay').classList.contains('hidden') }));
    await live.keyboard.press('Escape');
    const resumed = await live.evaluate(() => state);
    await live.keyboard.press('Space');
    await live.waitForTimeout(100);
    const afterDrop = await live.evaluate(() => ({ filled: board.flat().filter(Boolean).length, state }));
    const keysOk = afterLeft < before.x && afterHold !== null && paused.state === 'paused' && paused.overlay
      && resumed === 'playing' && afterDrop.filled === 4 && afterDrop.state === 'playing';
    record('Keyboard controls work (arrows, C, P/Esc, Space)', keysOk,
      `x ${before.x}->${afterLeft}, hold=${afterHold}, pause=${paused.state}, resume=${resumed}, hard drop placed ${afterDrop.filled} blocks`);

    // Layout: wide screen shows the keyboard help and hides touch buttons.
    await live.setViewportSize({ width: 1280, height: 860 });
    await live.waitForTimeout(100);
    await live.screenshot({ path: require('path').join(process.env.SCR, 'desktop.png') });
    const wide = await live.evaluate(() => ({
      touchDisplay: getComputedStyle(document.getElementById('touchControls')).display,
      helpDisplay: getComputedStyle(document.querySelector('.help')).display,
      hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    record('Wide layout: no touch buttons, keyboard help shown, no horizontal scroll',
      wide.touchDisplay === 'none' && wide.helpDisplay === 'block' && !wide.hScroll, JSON.stringify(wide));

    // Narrow screen (phone): touch buttons shown, no horizontal scroll, all 9 buttons tappable.
    await live.setViewportSize({ width: 390, height: 844 });
    await live.waitForTimeout(100);
    await live.screenshot({ path: require('path').join(process.env.SCR, 'phone.png'), fullPage: true });
    const narrow = await live.evaluate(() => {
      const buttons = [...document.querySelectorAll('#touchControls button')];
      return {
        touchDisplay: getComputedStyle(document.getElementById('touchControls')).display,
        buttonCount: buttons.length,
        allVisible: buttons.every((b) => b.getBoundingClientRect().width > 0),
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        width: document.documentElement.clientWidth,
      };
    });
    record('Narrow layout (390 px): touch buttons shown, no horizontal scroll',
      narrow.touchDisplay === 'grid' && narrow.buttonCount === 9 && narrow.allVisible && !narrow.hScroll,
      JSON.stringify(narrow));

    // Touch button press moves the piece (pointer events).
    const touchMove = await live.evaluate(() => current.x);
    const leftBtn = live.locator('#touchControls button[data-action="left"]');
    await leftBtn.dispatchEvent('pointerdown');
    await leftBtn.dispatchEvent('pointerup');
    const touchMoved = await live.evaluate(() => current.x);
    record('Touch button moves the piece', touchMoved < touchMove, `x ${touchMove}->${touchMoved}`);

    record('No JavaScript errors on the page', liveErrors.length === 0 && pageErrors.length === 0,
      [...liveErrors, ...pageErrors].join(' | ') || 'none');
    await live.close();
  }

  // Visual QA snapshots (title card, mid-bust, game over)
  {
    const shots = process.env.SCR;
    const shotPage = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 1 });
    await shotPage.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await shotPage.goto(URL);
    await shotPage.screenshot({ path: require('path').join(shots, 'title.png') });
    await shotPage.evaluate(() => {
      resetGame();
      board = makeEmptyBoard();
      for (let row = 18; row <= 21; row++) for (let col = 0; col < 9; col++) board[row][col] = 'JLSTZ'[col % 5] ;
      for (let row = 14; row <= 17; row++) for (let col = 0; col < 9; col++) board[row][col] = ['T','S','Z','L'][col % 4];
      current = { type: 'I', rot: 1, x: 7, y: 14 };
      hardDrop();
      updateEffects(0.08);
      render();
    });
    await shotPage.waitForTimeout(150);
    await shotPage.screenshot({ path: require('path').join(shots, 'bust.png') });
    await shotPage.evaluate(() => { placeNewPiece('T'); for (let r=1;r<3;r++) for(let c=0;c<COLS;c++) board[r][c]='Z'; });
    await shotPage.evaluate(() => { board = makeEmptyBoard(); for (let r=2;r<ROWS;r++) for(let c=0;c<COLS;c++) if ((r+c)%3) board[r][c]=['I','O','T','S'][c%4]; endGame(); updateEffects(2); });
    await shotPage.waitForTimeout(400);
    await shotPage.screenshot({ path: require('path').join(shots, 'gameover.png') });
    await shotPage.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(2); });

// Helper used by the spawn check.
function PIECE_NAMES_CHECK(r, want) {
  const names = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  return names.every((n) => {
    const p = r[n];
    if (n === 'I') return p.minX === 3 && p.maxX === 6 && p.minY === 2 && p.maxY === 2;
    if (n === 'O') return p.minX === 4 && p.maxX === 5 && p.minY === 1 && p.maxY === 2;
    return p.minX === 3 && p.maxX === 5 && p.minY === 1 && p.maxY === 2;
  });
}
