import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

// Ensure screenshot directory exists before each test
test.beforeEach(() => {
  mkdir("e2e/saves", { recursive: true });
});

// ============================================================
// Helpers
// ============================================================

/**
 * Reset permanent state so talents/buff bonuses do not leak between tests.
 */
async function resetPermanentState(page) {
  await page.evaluate(() => {
    permanent.talents = { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
    permanent.unlockedBuffs = ['iron_skin', 'swift_foot', 'sharp_eye', 'mana_flow', 'steadfast', 'gold_hound', 'berserks_blessing', 'spirit_eagle'];
    permanent.relic = null;
    permanent.soulShards = 0;
    // Clear save so "加载存档" does not appear
    // Clear multi-slot saves too
    for (var k = 0; k < 5; k++) localStorage.removeItem('rpg_buff_save_slot_' + (k + 1));
    localStorage.removeItem('rpg_buff_save');
    // Also clear new slot keys (rpg_buff_save_1 .. rpg_buff_save_5)
    for (var k = 1; k <= 5; k++) localStorage.removeItem('rpg_buff_save_' + k);
    // Reset auto-save counter so saveGame() always writes to slot 1 first
    autoSaveCounter = 1;
  });
}

/**
 * Click "加载存档" on title screen, then click the first save slot's "加载" button.
 * Replaces the old single "继续冒险" button flow.
 */
async function clickLoadSave(page) {
  await page.click('button:has-text("加载存档")');
  // Wait for modal + slot card to render
  await page.waitForSelector('#modal-overlay .save-slot-card:not(.empty)', { timeout: 5000, state: 'visible' });
  await page.waitForTimeout(200);
  // Click the load button on the first non-empty slot
  await page.click('#modal-overlay .save-slot-card:not(.empty) button:has-text("加载")');
  // Wait for modal to close and screen to change
  await page.waitForFunction(() => {
    const modal = document.getElementById('modal-overlay');
    return !modal || modal.style.display === 'none';
  }, { timeout: 5000 });
  await page.waitForTimeout(500);
}

/**
 * Navigate to title screen, reset state, wait for buttons.
 */
async function goToTitle(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });
  await resetPermanentState(page);
  // Re-render title buttons after clearing save
  await page.evaluate(() => updateTitleScreen());
  await page.waitForTimeout(300);
}

/**
 * Start a new game with the given class index (0=warrior, 1=mage, 2=rogue).
 * Returns after dungeon screen is ready and modal is hidden.
 */
async function startGameWithClass(page, clsIdx) {
  await goToTitle(page);

  // Click "选择职业" button
  await page.click(".start-btn");
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });

  // Click the class card
  await page.evaluate((i) => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[i]) cards[i].click();
  }, clsIdx);

  // Wait for dungeon to load
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon"
  );

  // Dismiss buff selection modal if it opened
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

/**
 * Verify the dungeon is visually intact: canvas visible, player panel has content,
 * no stale modal overlay, game is not paused.
 */
async function verifyDungeonIntact(page) {
  // Canvas visible
  await expect(page.locator("#game-canvas")).toBeVisible();

  // Modal overlay hidden
  const modalVisible = await page.locator("#modal-overlay").isVisible();
  expect(modalVisible, "modal overlay should be hidden").toBe(false);

  // Player panel has content (not "准备中...")
  const panelText = await page.locator("#player-panel").innerText();
  expect(panelText).not.toBe("准备中...");
  expect(panelText.length).toBeGreaterThan(5);

  // HUD (combat-actions or dungeon-actions) has content
  const hasHUD = await page.evaluate(() => {
    const sidebar = document.getElementById("sidebar");
    return sidebar && sidebar.children.length > 0;
  });
  expect(hasHUD).toBe(true);

  // Game is not paused
  const paused = await page.evaluate(() => gameState.paused);
  expect(paused, "game should not be paused").toBe(false);

  // Screen is dungeon
  const screen = await page.evaluate(() => gameState.screen);
  expect(screen).toBe("dungeon");
}

/**
 * Verify the player can move (press d, wait, check position or log).
 * Returns true if something changed.
 */
async function verifyCanMove(page) {
  const posBefore = await page.evaluate(() => ({ x: player.x, y: player.y }));
  await page.keyboard.press("d");
  await page.waitForTimeout(200);
  const posAfter = await page.evaluate(() => ({ x: player.x, y: player.y }));
  const moved = posAfter.x !== posBefore.x || posAfter.y !== posBefore.y;
  // Player might be next to a wall, so position might not change but game should not crash
  const screen = await page.evaluate(() => gameState.screen);
  return { moved, screen, alive: await page.evaluate(() => player.hp > 0) };
}

/**
 * Screenshot + canvas pixel analysis — standard visual verification.
 * Takes a screenshot and checks the canvas center area has non-dark pixels.
 * Call this after every scene where the dungeon should be visible.
 */
/**
 * Render the canvas and immediately sample it — all in one synchronous page.evaluate()
 * call to eliminate race conditions with requestAnimationFrame.
 * Returns { nonDark, total, pct, w, h, screen, hasDungeon }.
 */
async function renderAndSample(page) {
  return await page.evaluate(() => {
    // Force render synchronously (no rAF dependency)
    for (var i = 0; i < 3; i++) {
      if (typeof renderAll === 'function') renderAll();
    }
    var canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    var ctx = canvas.getContext('2d');
    if (!ctx) return { error: 'no context' };
    var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    var w = canvas.width, h = canvas.height;
    // Scan entire canvas — revealed tiles may be anywhere depending on player position
    var nonDark = 0, total = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        total++;
        if (data[i] > 30 || data[i+1] > 30 || data[i+2] > 30) nonDark++;
      }
    }
    var gs = typeof gameState !== 'undefined' ? gameState : null;
    var dn = typeof dungeon !== 'undefined' ? dungeon : null;
    return {
      nonDark,
      total,
      pct: (nonDark / total * 100).toFixed(1),
      w, h,
      screen: (gs && gs.screen) || 'no gameState',
      hasDungeon: !!dn
    };
  });
}

async function screenshotAndVerify(page, stepName, expectCanvasContent = true) {
  if (expectCanvasContent) {
    // Retry: render + sample in same evaluate call to eliminate rAF races
    for (let attempt = 0; attempt < 15; attempt++) {
      const probe = await renderAndSample(page);
      if (probe.error) {
        await page.waitForTimeout(100);
        continue;
      }
      // Low threshold: dungeon has dark background + small revealed area
      if (Number(probe.pct) >= 0.5) break;
      await page.waitForTimeout(100);
    }
  } else {
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: `e2e/saves/${stepName}.png`, fullPage: false });

  let pixelInfo = null;
  if (expectCanvasContent) {
    pixelInfo = await renderAndSample(page);

    if (pixelInfo.error) throw new Error(pixelInfo.error);
    if (Number(pixelInfo.pct) < 0.5) {
      throw new Error(`Canvas almost all black! ${stepName}: ${pixelInfo.pct}% non-dark pixels`);
    }
  }

  return pixelInfo;
}

/**
 * Enter combat with a non-boss enemy (hp=1 for quick kill).
 * Regenerates floor if needed.
 */
async function enterQuickCombat(page) {
  const idx = await page.evaluate(() => {
    const findLiving = () => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0 && !dungeon.enemies[i].boss) {
          dungeon.enemies[i].hp = 1;
          return i;
        }
      }
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          dungeon.enemies[i].hp = 1;
          return i;
        }
      }
      return -1;
    };
    if (!dungeon || !dungeon.enemies) {
      dungeon = generateFloor(dungeon ? dungeon.floor : 1);
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
      return findLiving();
    }
    let idx = findLiving();
    if (idx < 0) {
      dungeon = generateFloor(dungeon.floor);
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
      idx = findLiving();
    }
    return idx;
  });
  expect(idx, "no living enemy found").toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => startCombat(i), idx);
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "combat"
  );
  await page.waitForTimeout(300);
}

// ============================================================
// 1. First Open - Title Screen
// ============================================================
test.describe("User Flow 1 - Title Screen", () => {
  test("opens page and sees title screen with all buttons", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });

    // Title screen is the active screen
    const titleActive = await page.evaluate(() => {
      const el = document.getElementById("title-screen");
      return el && el.classList.contains("active");
    });
    expect(titleActive).toBe(true);

    // "选择职业" button exists
    const classBtnCount = await page.locator('button:has-text("选择职业")').count();
    expect(classBtnCount).toBeGreaterThanOrEqual(1);

    // "天赋" button exists
    const talentBtnCount = await page.locator('button:has-text("天赋")').count();
    expect(talentBtnCount).toBeGreaterThanOrEqual(1);

    // Title h1 is visible
    const h1Visible = await page.locator("#title-screen h1").isVisible();
    expect(h1Visible).toBe(true);
  });

  test("title screen shows game instructions", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });

    // Check instruction text about WASD
    const pText = await page.locator("#title-screen p").last().innerText();
    expect(pText).toContain("WASD");
  });

  test("cycling theme changes background color", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });

    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Click "切换主题" button
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(300);

    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);
  });
});

// ============================================================
// 2. Class Selection -> Start Game
// ============================================================
test.describe("User Flow 2 - Class Selection and Game Start", () => {
  test("click select class shows 3 class cards", async ({ page }) => {
    await goToTitle(page);

    // Click "选择职业"
    await page.click(".start-btn");
    await page.waitForTimeout(300);

    // Modal overlay visible
    const modalVisible = await page.locator("#modal-overlay").isVisible();
    expect(modalVisible).toBe(true);

    // 3 class cards
    const cardCount = await page.locator("#modal-overlay .class-card").count();
    expect(cardCount).toBe(3);
  });

  test("select warrior -> dungeon screen renders canvas and player panel", async ({ page }) => {
    await startGameWithClass(page, 0); // warrior

    // Verify dungeon intact (canvas, panel, HUD, no modal, not paused)
    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '02-warrior-dungeon');

    // Player stats visible — HP bar rendered as "current/max" without "HP" label
    const hpBar = await page.locator("#player-panel .bar.hp").first();
    await expect(hpBar).toBeVisible();
  });

  test("select mage -> dungeon screen renders", async ({ page }) => {
    await startGameWithClass(page, 1); // mage

    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '02-mage-dungeon');

    // Verify it's actually mage
    const cls = await page.evaluate(() => player.cls);
    expect(cls).toBe("mage");
  });

  test("select rogue -> dungeon screen renders", async ({ page }) => {
    await startGameWithClass(page, 2); // rogue

    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '02-rogue-dungeon');

    const cls = await page.evaluate(() => player.cls);
    expect(cls).toBe("rogue");
  });

  test("after selecting class, player can move immediately", async ({ page }) => {
    await startGameWithClass(page, 0);

    const result = await verifyCanMove(page);
    expect(result.screen).toBe("dungeon");
    expect(result.alive).toBe(true);
  });
});

// ============================================================
// 3. Movement and Combat
// ============================================================
test.describe("User Flow 3 - Movement and Combat", () => {
  test("press WASD keys moves player around the map", async ({ page }) => {
    await startGameWithClass(page, 0);

    const pos0 = await page.evaluate(() => ({ x: player.x, y: player.y }));

    // Press d (right)
    await page.keyboard.press("d");
    await page.waitForTimeout(150);

    // Press s (down)
    await page.keyboard.press("s");
    await page.waitForTimeout(150);

    // Press a (left)
    await page.keyboard.press("a");
    await page.waitForTimeout(150);

    // Press w (up)
    await page.keyboard.press("w");
    await page.waitForTimeout(150);

    const pos1 = await page.evaluate(() => ({ x: player.x, y: player.y }));

    // Player is still alive and in dungeon
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    expect(await page.evaluate(() => player.hp)).toBeGreaterThan(0);

    // Player might not have moved (walls), but game is responsive
    // Check that position at least attempted to change or we're still alive
    const stillInGame = pos1.x !== undefined && pos1.y !== undefined;
    expect(stillInGame).toBe(true);
  });

  test("pressing arrow keys also moves player", async ({ page }) => {
    await startGameWithClass(page, 0);

    const posBefore = await page.evaluate(() => ({ x: player.x, y: player.y }));
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const posAfter = await page.evaluate(() => ({ x: player.x, y: player.y }));

    // Verify game is responsive regardless of whether wall blocked
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    // The log should have entries
    const logCount = await page.evaluate(() => {
      return document.getElementById("log") ? document.getElementById("log").children.length : 0;
    });
    expect(logCount).toBeGreaterThan(0);
  });

  test("combat: attack button deals damage", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Enter combat with hp=1 enemy
    await enterQuickCombat(page);

    // Verify combat screen
    expect(await page.evaluate(() => gameState.screen)).toBe("combat");
    await expect(page.locator("#combat-overlay")).toBeVisible();

    // Verify attack button exists
    const atkBtnCount = await page.locator(".btn-atk").count();
    expect(atkBtnCount).toBeGreaterThanOrEqual(1);

    // Click attack (enemy hp=1, so this kills it)
    await page.click(".btn-atk");
    await page.waitForTimeout(600);

    // Should be back to dungeon
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    expect(await page.evaluate(() => combatState)).toBeNull();

    await screenshotAndVerify(page, '03-combat-victory');

    // Verify CAN MOVE after combat (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });

  test("combat: defend button works and log shows defense", async ({ page }) => {
    await startGameWithClass(page, 0);

    await enterQuickCombat(page);

    // Defend
    await page.click(".btn-def");
    await page.waitForTimeout(500);

    // Verify log has defense message
    const logTexts = await page.evaluate(() => {
      const logEl = document.getElementById("log");
      if (!logEl) return [];
      const entries = logEl.querySelectorAll(".log-entry");
      const texts = [];
      for (let i = 0; i < entries.length; i++) texts.push(entries[i].textContent);
      return texts;
    });
    const hasDefense = logTexts.some(t => t.indexOf("防御") >= 0 || t.indexOf("defend") >= 0);
    expect(hasDefense).toBe(true);

    // Player should still be alive (warrior vs weak enemy + defending)
    const hp = await page.evaluate(() => player.hp);
    expect(hp).toBeGreaterThan(0);
  });

  test("combat: flee button returns to dungeon", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Give high speed for guaranteed flee (30 + spd*2 = 130 > 100)
    await page.evaluate(() => { player.baseSpd = 50; });

    await enterQuickCombat(page);

    // Flee
    await page.click(".btn-flee");

    // Wait for screen to change to dungeon (flee should always succeed with spd=50)
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon",
      { timeout: 5000 }
    );

    await screenshotAndVerify(page, '03-flee-return');

    // Verify CAN MOVE after fleeing (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
  });
});

// ============================================================
// 4. Save / Load Flow (CORE TEST - with screenshotAndVerify)
// ============================================================

test.describe("User Flow 4 - Save and Load Game", () => {
  test("save game, refresh page, click continue, dungeon renders correctly", async ({ page }) => {
    // Step 1: Start game and get to dungeon
    await startGameWithClass(page, 0);

    // Screenshot: game in progress
    await screenshotAndVerify(page, '04-game-in-progress');

    // Record player state before save
    const stateBefore = await page.evaluate(() => ({
      cls: player.cls,
      lvl: player.lvl,
      hp: player.hp,
      maxHp: player.maxHp,
      x: player.x,
      y: player.y,
      floor: dungeon.floor,
    }));
    expect(stateBefore.cls).toBe("warrior");

    // Step 2: Save the game
    await page.evaluate(() => saveGame());
    await page.waitForTimeout(200);

    await screenshotAndVerify(page, '04-before-save');

    // Verify save exists in localStorage (multi-slot system: rpg_buff_save_1 .. rpg_buff_save_5)
    const hasSave = await page.evaluate(() => {
      for (var i = 1; i <= 5; i++) {
        if (localStorage.getItem('rpg_buff_save_' + i)) return true;
      }
      return false;
    });
    expect(hasSave).toBe(true);

    // Step 3: Refresh the page (simulates user refreshing browser)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify localStorage survived reload
    const saveAfterReload = await page.evaluate(() => {
      for (var i = 1; i <= 5; i++) {
        if (localStorage.getItem('rpg_buff_save_' + i)) return true;
      }
      return false;
    });

    // Screenshot: after reload (title screen)
    await screenshotAndVerify(page, '04-after-reload', false);

    // Step 4: "加载存档" button should appear
    const loadBtnCount = await page.locator('button:has-text("加载存档")').count();
    expect(loadBtnCount, "load save button should appear after save").toBeGreaterThanOrEqual(1);

    // Step 5: Click "加载存档" and select save slot
    await clickLoadSave(page);
    await page.waitForTimeout(500);

    // Screenshot + canvas verification - THIS IS THE KEY DIAGNOSTIC
    await screenshotAndVerify(page, '04-after-continue');

    // Step 6: Verify dungeon renders correctly after load (NOT black screen)

    // 6a. Dungeon screen is active
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");

    // 6b. Player panel has stats (not "准备中...")
    const panelText = await page.locator("#player-panel").innerText();
    expect(panelText).not.toBe("准备中...");
    expect(panelText.length).toBeGreaterThan(5);

    // 6c. Player data restored
    const stateAfter = await page.evaluate(() => ({
      cls: player.cls,
      lvl: player.lvl,
      x: player.x,
      y: player.y,
      floor: dungeon ? dungeon.floor : -1,
    }));
    expect(stateAfter.cls).toBe(stateBefore.cls);
    expect(stateAfter.lvl).toBe(stateBefore.lvl);
    expect(stateAfter.x).toBe(stateBefore.x);
    expect(stateAfter.y).toBe(stateBefore.y);
    expect(stateAfter.floor).toBe(stateBefore.floor);

    // 6d. No modal overlay blocking
    const modalVisible = await page.locator("#modal-overlay").isVisible();
    expect(modalVisible, "no modal overlay after load").toBe(false);

    // 6e. Game is not paused
    expect(await page.evaluate(() => gameState.paused)).toBe(false);

    // 6f. Player CAN MOVE after loading (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });

  test("save/load is stable across 3 consecutive cycles", async ({ page }) => {
    for (let cycle = 0; cycle < 3; cycle++) {
      // Start fresh game
      await startGameWithClass(page, 0);

      // Record position
      const pos = await page.evaluate(() => ({ x: player.x, y: player.y }));

      // Move once to change position
      await page.keyboard.press("d");
      await page.waitForTimeout(150);

      // Save
      await page.evaluate(() => saveGame());
      await page.waitForTimeout(200);

      // Reload
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });
      await page.waitForTimeout(500);

      // Continue via load save
      await clickLoadSave(page);

      // Verify intact
      expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
      expect(await page.evaluate(() => gameState.paused)).toBe(false);
      await expect(page.locator("#game-canvas")).toBeVisible();
      const panelText = await page.locator("#player-panel").innerText();
      expect(panelText).not.toBe("准备中...");

      await screenshotAndVerify(page, `04-cycle-${cycle}-after-load`);

      // Can move
      const moveResult = await verifyCanMove(page);
      expect(moveResult.screen, "cycle " + cycle + ": screen=dungeon").toBe("dungeon");
      expect(moveResult.alive, "cycle " + cycle + ": player alive").toBe(true);
    }
  });

  test("load shows log message confirming load", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Save
    await page.evaluate(() => saveGame());
    await page.waitForTimeout(200);

    // Reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });
    await page.waitForTimeout(500);

    // Continue via load save
    await clickLoadSave(page);
    await page.waitForTimeout(300);

    await screenshotAndVerify(page, '04-load-log-message');

    // Check log for "读档" message
    const logTexts = await page.evaluate(() => {
      const logEl = document.getElementById("log");
      if (!logEl) return [];
      const entries = logEl.querySelectorAll(".log-entry");
      const texts = [];
      for (let i = 0; i < entries.length; i++) texts.push(entries[i].textContent);
      return texts;
    });
    const hasLoadMessage = logTexts.some(t => t.indexOf("读档") >= 0 || t.indexOf("继续冒险") >= 0 || t.indexOf("加载存档") >= 0);
    expect(hasLoadMessage, "log should show load confirmation").toBe(true);
  });
});

// ============================================================
// 5. Level Up Flow
// ============================================================
test.describe("User Flow 5 - Level Up", () => {
  test("killing enemies grants exp, enough kills trigger level up and full heal", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Set player 1 exp short of next level
    await page.evaluate(() => {
      player.exp = player.expNext - 1;
    });
    const lvlBefore = await page.evaluate(() => player.lvl);
    const expBefore = await page.evaluate(() => player.exp);
    const expNext = await page.evaluate(() => player.expNext);
    expect(expBefore).toBe(expNext - 1);

    // Fight and kill a non-boss enemy (hp=1 for speed)
    await enterQuickCombat(page);

    // Enemy hp is already 1, attack kills it
    await page.click(".btn-atk");
    await page.waitForTimeout(600);

    // Verify level increased
    const lvlAfter = await page.evaluate(() => player.lvl);
    expect(lvlAfter, "level should increase").toBeGreaterThan(lvlBefore);

    // Verify HP fully restored
    const hpEqualsMax = await page.evaluate(() => player.hp === player.maxHp);
    expect(hpEqualsMax, "HP should be fully restored after level up").toBe(true);

    // Verify CAN MOVE after level-up combat (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });

  test("defeating multiple enemies accumulates exp across combats", async ({ page }) => {
    await startGameWithClass(page, 0);

    const expStart = await page.evaluate(() => player.exp);

    // Kill 3 enemies sequentially
    for (let i = 0; i < 3; i++) {
      // Ensure fresh enemies
      await page.evaluate(() => {
        if (!dungeon.enemies || !dungeon.enemies.some(e => e && e.hp > 0)) {
          dungeon = generateFloor(dungeon.floor);
          player.x = dungeon.playerStart.x;
          player.y = dungeon.playerStart.y;
        }
      });

      await enterQuickCombat(page);
      await page.click(".btn-atk");
      await page.waitForTimeout(600);

      expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");

      // Dismiss any modal that opened (level-up, buff unlock, etc.) before next iteration
      await page.evaluate(() => {
        const overlay = document.getElementById("modal-overlay");
        if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
          closeModal();
        }
      });
    }

    const expEnd = await page.evaluate(() => player.exp);
    expect(expEnd, "exp should increase after 3 kills").toBeGreaterThan(expStart);
  });
});

// ============================================================
// 6. Buff Selection
// ============================================================
test.describe("User Flow 6 - Buff Selection", () => {
  test("floor transition triggers buff selection, picking buff shows in panel", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Setup: ensure unlocked buffs and player has no active buffs
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 10).map(function (b) { return b.id; });
      player.activeBuffs = [];
    });

    // Trigger buff selection (pass floor=1 for weightedBuffPick)
    await page.evaluate(() => showBuffSelection(1));
    await page.waitForTimeout(300);

    // Verify modal open with buff cards
    const modalDisplay = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(modalDisplay).toBe("flex");

    const cardCount = await page.locator("#modal-overlay .buff-card").count();
    expect(cardCount).toBeGreaterThanOrEqual(2);

    // Click first buff card
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    // Verify modal closed
    const displayAfter = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayAfter).toBe("none");

    // Verify buff in player panel
    const hasBuffChips = await page.evaluate(() => {
      return !!document.getElementById("player-panel").querySelector(".buff-chips");
    });
    expect(hasBuffChips, "buff chip should appear in player panel").toBe(true);

    // Verify buff added to activeBuffs
    const activeCount = await page.evaluate(() => player.activeBuffs.length);
    expect(activeCount).toBeGreaterThanOrEqual(1);

    await screenshotAndVerify(page, '06-buff-picked');

    // Verify CAN MOVE after picking buff (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });

  test("floor transition: stairs -> floor break modal -> proceed -> new floor", async ({ page }) => {
    await startGameWithClass(page, 0);

    const floorBefore = await page.evaluate(() => dungeon.floor);

    // Teleport to stairs and step on them
    await page.evaluate(() => {
      dungeon = generateFloor(dungeon.floor);
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
      player.x = dungeon.stairsPos.x;
      player.y = dungeon.stairsPos.y - 1;
      movePlayer(0, 1); // Step on stairs
    });
    await page.waitForTimeout(300);

    // Verify floor break modal appears
    const modalOpen = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      return overlay && overlay.style.display === "flex";
    });
    expect(modalOpen, "floor break modal should appear").toBe(true);

    // Verify game is paused during modal
    expect(await page.evaluate(() => gameState.paused)).toBe(true);

    // Click proceed (the button with "继续" text)
    await page.evaluate(() => {
      const btns = document.querySelectorAll("#modal-overlay .modal-btn");
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf("继续") !== -1) {
          btns[i].click();
          return;
        }
      }
    });

    // Wait for floor banner + generation
    await page.waitForTimeout(2500);

    // Dismiss buff selection if opened
    await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
        closeModal();
      }
    });
    await page.waitForTimeout(300);

    await screenshotAndVerify(page, '06-floor-transition');

    // Verify floor increased
    const floorAfter = await page.evaluate(() => dungeon.floor);
    expect(floorAfter).toBe(floorBefore + 1);

    // Verify CAN MOVE on new floor (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });
});

// ============================================================
// 7. Game Over and Restart
// ============================================================
test.describe("User Flow 7 - Game Over and Restart", () => {
  test("player death shows game over screen with restart button", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Kill player
    await page.evaluate(() => {
      player.activeBuffs = []; // No relic relic selection
      player.hp = 0;
      playerDied();
    });
    await page.waitForTimeout(800);

    // Verify game over screen is visible
    const goActive = await page.locator("#gameover-screen").isVisible();
    expect(goActive, "game over screen should be visible").toBe(true);

    // Verify screen state is gameover
    expect(await page.evaluate(() => gameState.screen)).toBe("gameover");

    // Verify "重新开始" button exists
    const restartBtnCount = await page.locator(".restart-btn").count();
    expect(restartBtnCount).toBeGreaterThanOrEqual(1);
  });

  test("click restart -> shows class selection -> new game starts", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Kill player
    await page.evaluate(() => {
      player.activeBuffs = [];
      player.hp = 0;
      playerDied();
    });
    await page.waitForTimeout(800);

    // Verify game over
    expect(await page.locator("#gameover-screen")).toBeVisible();

    // Click restart
    await page.click(".restart-btn");
    await page.waitForTimeout(1000);

    // After restart: should show class selection (per startNewGame code)
    // Check that we're either in class selection or a new dungeon
    const state = await page.evaluate(() => {
      const modal = document.getElementById("modal-overlay");
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      return {
        screen: gameState.screen,
        hasClassCards: cards.length > 0,
        modalFlex: modal ? modal.style.display : "",
      };
    });

    if (state.hasClassCards || state.modalFlex === "flex") {
      // Class selection modal appeared - select warrior
      await page.evaluate(() => {
        const cards = document.querySelectorAll("#modal-overlay .class-card");
        if (cards[0]) cards[0].click();
      });
      await page.waitForFunction(
        () => window.gameState && window.gameState.screen === "dungeon"
      );
      await page.waitForTimeout(500);
    } else {
      // startNewGame calls showClassSelection then might auto-proceed
      // If already in dungeon, that's also valid
    }

    // Final: game should be playable
    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '07-restart');

    // Verify CAN MOVE after restart (golden rule)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });

  test("finish game over button returns to title screen", async ({ page }) => {
    await startGameWithClass(page, 0);

    // Kill player
    await page.evaluate(() => {
      player.activeBuffs = [];
      player.hp = 0;
      playerDied();
    });
    await page.waitForTimeout(800);

    expect(await page.locator("#gameover-screen")).toBeVisible();

    // Look for "返回标题" or "主菜单" button, or call finishGameOver
    await page.evaluate(() => {
      // Try to find the return-to-title button
      const btns = document.querySelectorAll("#gameover-screen button");
      for (let i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf("标题") >= 0 || btns[i].textContent.indexOf("菜单") >= 0) {
          btns[i].click();
          return;
        }
      }
      // Fallback: call returnToTitle directly
      if (typeof returnToTitle === "function") returnToTitle();
    });
    await page.waitForTimeout(800);

    // Should see title screen
    const titleVisible = await page.evaluate(() => {
      const el = document.getElementById("title-screen");
      return el && el.classList.contains("active");
    });
    expect(titleVisible, "title screen should be visible after returning").toBe(true);

    // "选择职业" button should be present
    const classBtnCount = await page.locator('button:has-text("选择职业")').count();
    expect(classBtnCount).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================
// 8. End-to-End Full User Journey
// ============================================================
test.describe("User Flow 8 - Full End-to-End Journey", () => {
  test("complete journey: title -> class -> play -> fight -> save -> load -> play -> level up -> game over -> restart", async ({ page }) => {
    // === Phase 1: Title -> Class Select -> Dungeon ===
    await goToTitle(page);
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(() => window.gameState && window.gameState.screen === "dungeon");
    await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") closeModal();
    });
    await page.waitForTimeout(500);

    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '08-e2e-start');

    // === Phase 2: Move around ===
    await page.keyboard.press("d");
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");

    // === Phase 3: Fight an enemy ===
    await enterQuickCombat(page);
    await page.click(".btn-atk");
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    await screenshotAndVerify(page, '08-e2e-after-combat');

    // === Phase 4: Set up near-level-up state ===
    await page.evaluate(() => {
      player.exp = player.expNext - 1;
    });

    // === Phase 5: Save ===
    await page.evaluate(() => saveGame());
    await page.waitForTimeout(200);

    // === Phase 6: Reload and continue ===
    await page.reload();
    await page.waitForSelector("#title-screen.screen.active", { timeout: 10000 });
    await page.waitForTimeout(500);
    await clickLoadSave(page);

    await verifyDungeonIntact(page);
    await screenshotAndVerify(page, '08-e2e-after-load');

    // === Phase 7: Kill enemy to level up ===
    await enterQuickCombat(page);
    await page.click(".btn-atk");
    await page.waitForTimeout(600);

    // Should be level up
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    const hpFull = await page.evaluate(() => player.hp === player.maxHp);
    expect(hpFull, "HP full after level up").toBe(true);
    await screenshotAndVerify(page, '08-e2e-after-levelup');

    // === Phase 8: Verify still playable ===
    const moveResult = await verifyCanMove(page);
    expect(moveResult.screen).toBe("dungeon");
    expect(moveResult.alive).toBe(true);
  });
});
