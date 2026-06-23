import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start game with warrior class, wait for dungeon, dismiss any modal.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active");
  await page.click(".start-btn");
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[0]) cards[0].click();
  });
  await page.waitForFunction(() => window.gameState && window.gameState.screen === "dungeon");

  // Dismiss buff selection / gem enhancement modals
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

/**
 * Helper: quick floor transition via evaluate (bypass player movement).
 * Returns snapshot of state after the transition + banner timeout.
 * @param {boolean} [skipBuff] - if true, clear unlockedBuffs so showBuffSelection returns early
 */
async function transitionFloor(page, skipBuff) {
  await page.evaluate((skip) => {
    if (skip) permanent.unlockedBuffs = [];
    // Regenerate current floor to get a fresh map
    dungeon = generateFloor(dungeon.floor);
    player.x = dungeon.playerStart.x;
    player.y = dungeon.playerStart.y;
    // Teleport player adjacent to stairs, then step onto them
    player.x = dungeon.stairsPos.x;
    player.y = dungeon.stairsPos.y - 1;
    movePlayer(0, 1); // Step onto stairs, triggers floor break
  }, skipBuff);
  await page.waitForTimeout(300);
}

/**
 * Helper: click "continue" (proceed) button in floor break modal.
 */
async function clickProceed(page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll("#modal-overlay .modal-btn");
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.indexOf("继续") !== -1) {
        btns[i].click();
        return;
      }
    }
  });
  // Wait for floor banner timeout (1200ms) + generation
  await page.waitForTimeout(2000);
}

/**
 * Helper: dismiss buff selection modal if it opened.
 */
async function dismissBuffModal(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Helper: verify player can move by pressing W and checking position change.
 */
async function verifyCanMove(page) {
  const posBefore = await page.evaluate(() => ({ x: player.x, y: player.y }));
  await page.keyboard.press("W");
  await page.waitForTimeout(150);
  const posAfter = await page.evaluate(() => ({ x: player.x, y: player.y }));
  const paused = await page.evaluate(() => gameState.paused);
  return { posBefore, posAfter, moved: posBefore.y !== posAfter.y, paused };
}

/**
 * Helper: get active .screen elements (should be empty during dungeon gameplay).
 */
async function getActiveScreens(page) {
  return await page.evaluate(() => {
    const screens = document.querySelectorAll(".screen.active");
    return Array.from(screens).map(function (s) { return s.id; });
  });
}

test.describe("Floor Transitions and Game Flow", () => {
  // ---- Test 1: Floor 1 to Floor 2 - Full Transition ----
  test("Floor 1 to Floor 2 - Full Transition", async ({ page }) => {
    await startGame(page);

    // Verify starting state
    expect(await page.evaluate(() => dungeon.floor)).toBe(1);
    expect(await page.evaluate(() => gameState.paused)).toBe(false);

    // Navigate to stairs via evaluate
    const stairsPos = await page.evaluate(() => {
      // Regenerate to get fresh floor
      dungeon = generateFloor(1);
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    // Move player toward stairs step by step
    await page.evaluate((sp) => {
      // Walk toward stairs
      var dx = 0, dy = 0;
      if (sp.x > player.x) dx = 1;
      else if (sp.x < player.x) dx = -1;
      else if (sp.y > player.y) dy = 1;
      else if (sp.y < player.y) dy = -1;
      if (dx !== 0 || dy !== 0) movePlayer(dx, dy);
    }, stairsPos);

    // Just directly set player on stairs to trigger floor break
    await page.evaluate(() => {
      player.x = dungeon.stairsPos.x;
      player.y = dungeon.stairsPos.y - 1;
      movePlayer(0, 1); // This steps on stairs
    });
    await page.waitForTimeout(300);

    // Verify floor break modal appears and game is paused
    const floorBreakState = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      return {
        modalVisible: overlay && overlay.style.display === "flex",
        paused: gameState.paused,
      };
    });
    expect(floorBreakState.paused).toBe(true);

    // Click "continue" button to proceed
    await clickProceed(page);

    // Verify floor is now 2
    const floor2 = await page.evaluate(() => ({
      floor: dungeon.floor,
      floorNum: gameState.floor,
    }));
    expect(floor2.floor).toBe(2);

    // Dismiss buff selection modal if open
    await dismissBuffModal(page);

    // Verify paused is FALSE
    expect(await page.evaluate(() => gameState.paused)).toBe(false);

    // Verify CAN MOVE by pressing a key
    const moveResult = await verifyCanMove(page);
    expect(moveResult.moved).toBe(true);
    expect(moveResult.paused).toBe(false);

    // Verify player is on floor 2 via gameState.floor
    expect(await page.evaluate(() => gameState.floor)).toBe(2);
  });

  // ---- Test 2: Floor 2 to Floor 3 ----
  test("Floor 2 to Floor 3", async ({ page }) => {
    await startGame(page);

    // Quick transition 1 -> 2
    await transitionFloor(page, true); // skip buff to simplify
    await clickProceed(page);
    await dismissBuffModal(page);

    // Verify we're on floor 2
    expect(await page.evaluate(() => dungeon.floor)).toBe(2);

    // Quick transition 2 -> 3
    await transitionFloor(page, true);
    await page.waitForTimeout(300);

    // Verify floor break modal is visible
    const fbVisible = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      return overlay && overlay.style.display === "flex";
    });
    expect(fbVisible).toBe(true);

    // Click proceed
    await clickProceed(page);
    await dismissBuffModal(page);

    // Verify floor is 3
    expect(await page.evaluate(() => dungeon.floor)).toBe(3);

    // CRITICAL: verify CAN MOVE on floor 3
    const moveResult = await verifyCanMove(page);
    expect(moveResult.moved).toBe(true);
    expect(moveResult.paused).toBe(false);
  });

  // ---- Test 3: Buff Selection Flow ----
  test("Buff Selection Flow", async ({ page }) => {
    await startGame(page);

    // Setup: ensure at least 3 unlocked buffs and player has no active buffs
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 10).map(function (b) { return b.id; });
      player.activeBuffs = [];
    });

    // Trigger buff selection directly
    await page.evaluate(() => { showBuffSelection(); });
    await page.waitForTimeout(300);

    // Verify 3 buff cards are visible
    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll("#modal-overlay .buff-card").length;
    });
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // Verify modal is open
    expect(await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    })).toBe("flex");

    // Click one card
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    // Verify modal closes
    expect(await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    })).toBe("none");

    // Verify buff appears in HUD (buff-chips rendered)
    const hasBuffChips = await page.evaluate(() => {
      return !!document.getElementById("player-panel").querySelector(".buff-chips");
    });
    expect(hasBuffChips).toBe(true);

    // Verify player.activeBuffs has 1 entry
    expect(await page.evaluate(() => player.activeBuffs.length)).toBe(1);

    // Verify CAN MOVE
    const moveResult = await verifyCanMove(page);
    expect(moveResult.moved).toBe(true);
    expect(moveResult.paused).toBe(false);
  });

  // ---- Test 4: Enemy Combat then Continue ----
  test("Enemy Combat then Continue - 3 consecutive combats", async ({ page }) => {
    await startGame(page);

    for (var round = 0; round < 3; round++) {
      // Find a living enemy, set its hp = 1, start combat
      const idx = await page.evaluate(() => {
        // Regenerate floor if needed
        if (!dungeon.enemies || !dungeon.enemies.some(function (e) { return e && e.hp > 0; })) {
          dungeon = generateFloor(dungeon.floor);
          player.x = dungeon.playerStart.x;
          player.y = dungeon.playerStart.y;
        }
        for (var i = 0; i < dungeon.enemies.length; i++) {
          if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
            dungeon.enemies[i].hp = 1;
            return i;
          }
        }
        return -1;
      });
      expect(idx, "round " + round + ": no enemy").toBeGreaterThanOrEqual(0);

      // Start combat
      await page.evaluate((i) => startCombat(i), idx);
      await page.waitForFunction(() => window.gameState && window.gameState.screen === "combat");
      await page.waitForTimeout(300);

      // Verify paused = true during combat
      expect(await page.evaluate(() => gameState.paused)).toBe(true);

      // Click attack to kill the 1-hp enemy
      await page.click(".btn-atk");
      await page.waitForTimeout(500);

      // Verify returned to dungeon
      expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
      expect(await page.evaluate(() => gameState.paused)).toBe(false);
      expect(await page.evaluate(() => combatState)).toBeNull();

      // Verify CAN MOVE after this combat
      const moveResult = await verifyCanMove(page);
      expect(moveResult.moved, "round " + round + ": can move after combat").toBe(true);
      expect(moveResult.paused, "round " + round + ": not paused after combat").toBe(false);
    }
  });

  // ---- Test 5: Game Over and Restart ----
  test("Game Over and Restart", async ({ page }) => {
    await startGame(page);

    // Clear active buffs so playerDied skips relic selection and goes to game over
    // Use page.evaluate to set HP = 0 and call playerDied()
    await page.evaluate(() => {
      player.activeBuffs = []; // No buffs to skip relic selection
      player.hp = 0;
      playerDied();
    });
    await page.waitForTimeout(500);

    // Verify game over screen appears
    const gameoverState = await page.evaluate(() => {
      var screen = document.getElementById("gameover-screen");
      return {
        screenActive: screen && screen.classList.contains("active"),
        hasGameOver: !!screen && !!screen.querySelector(".game-over"),
        gameStateScreen: gameState.screen,
        paused: gameState.paused,
      };
    });
    expect(gameoverState.gameStateScreen).toBe("gameover");
    expect(gameoverState.screenActive).toBe(true);
    expect(gameoverState.paused).toBe(true);

    // Click "重新开始" (restart) button
    await page.click(".restart-btn");
    await page.waitForTimeout(1000);

    // Verify game has restarted - screen should be dungeon, gameover-screen should be gone
    const restartState = await page.evaluate(() => {
      var goScreen = document.getElementById("gameover-screen");
      return {
        screen: gameState.screen,
        gameoverActive: goScreen && goScreen.classList.contains("active"),
        dungeon: !!dungeon,
        playerAlive: player && player.hp > 0,
      };
    });
    expect(restartState.screen).toBe("dungeon");
    expect(restartState.gameoverActive).toBe(false);
    expect(restartState.dungeon).toBe(true);
    expect(restartState.playerAlive).toBe(true);

    // Verify dungeon is playable (can move)
    const moveResult = await verifyCanMove(page);
    expect(moveResult.moved).toBe(true);
    expect(moveResult.paused).toBe(false);
  });

  // ---- Test 6: Visual - No Modal Overlays After Transitions ----
  test("Visual: No Modal Overlays After Transitions", async ({ page }) => {
    await startGame(page);

    // --- After floor transition ---
    await transitionFloor(page, true);
    await clickProceed(page);
    await dismissBuffModal(page);

    const afterFloor = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var floorOverlay = document.getElementById("floor-overlay");
      var activeScreens = [];
      document.querySelectorAll(".screen.active").forEach(function (s) {
        activeScreens.push(s.id);
      });
      return {
        modalHidden: overlay ? overlay.style.display === "none" : true,
        floorOverlayEmpty: floorOverlay ? floorOverlay.innerHTML.trim() === "" : true,
        activeScreens: activeScreens,
      };
    });
    expect(afterFloor.modalHidden).toBe(true);
    expect(afterFloor.floorOverlayEmpty).toBe(true);
    // During dungeon gameplay, showScreen('dungeon') removes all .active classes
    expect(afterFloor.activeScreens.length).toBe(0);

    // --- After combat end ---
    const enemyIdx = await page.evaluate(() => {
      dungeon = generateFloor(dungeon.floor);
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          dungeon.enemies[i].hp = 1;
          return i;
        }
      }
      return -1;
    });
    if (enemyIdx >= 0) {
      await page.evaluate((i) => startCombat(i), enemyIdx);
      await page.waitForFunction(() => window.gameState && window.gameState.screen === "combat");
      await page.waitForTimeout(300);
      await page.click(".btn-atk");
      await page.waitForTimeout(500);
    }

    const afterCombat = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var activeScreens = [];
      document.querySelectorAll(".screen.active").forEach(function (s) {
        activeScreens.push(s.id);
      });
      return {
        modalHidden: overlay ? overlay.style.display === "none" : true,
        activeScreens: activeScreens,
      };
    });
    expect(afterCombat.modalHidden).toBe(true);
    expect(afterCombat.activeScreens.length).toBe(0);

    // --- After buff pick ---
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 10).map(function (b) { return b.id; });
      player.activeBuffs = [];
    });
    await page.evaluate(() => { showBuffSelection(); });
    await page.waitForTimeout(300);

    // Verify modal is open before pick
    expect(await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    })).toBe("flex");

    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    const afterBuff = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var activeScreens = [];
      document.querySelectorAll(".screen.active").forEach(function (s) {
        activeScreens.push(s.id);
      });
      return {
        modalHidden: overlay ? overlay.style.display === "none" : true,
        activeScreens: activeScreens,
      };
    });
    expect(afterBuff.modalHidden).toBe(true);
    expect(afterBuff.activeScreens.length).toBe(0);
  });
});
