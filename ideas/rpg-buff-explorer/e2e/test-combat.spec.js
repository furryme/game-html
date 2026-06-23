import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start a new game and wait until dungeon is ready.
 * Returns { gameState, player, dungeon } snapshot for convenience.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active");
  await page.click(".start-btn");
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
  // Select warrior (first card)
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[0]) cards[0].click();
  });
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon"
  );
  // Dismiss buff selection modal if open
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

/**
 * Helper: find first living enemy index in dungeon.enemies.
 */
async function findEnemyIndex(page) {
  let idx = await page.evaluate(() => {
    if (!dungeon || !dungeon.enemies) return -1;
    for (let i = 0; i < dungeon.enemies.length; i++) {
      if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) return i;
    }
    return -1;
  });
  // If no living enemies, regenerate the floor (may happen due to saved state)
  if (idx < 0) {
    await page.evaluate(() => {
      dungeon = generateFloor(1);
      if (dungeon) {
        player.x = dungeon.playerStart.x;
        player.y = dungeon.playerStart.y;
      }
    });
    idx = await page.evaluate(() => {
      if (!dungeon || !dungeon.enemies) return -1;
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) return i;
      }
      return -1;
    });
  }
  return idx;
}

/**
 * Helper: enter combat with the first living enemy via startCombat(idx).
 */
async function enterCombat(page) {
  const idx = await findEnemyIndex(page);
  expect(idx, "no living enemy found").toBeGreaterThanOrEqual(0);
  await page.evaluate((i) => startCombat(i), idx);
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "combat"
  );
  await page.waitForTimeout(300);
}

test.describe("Combat", () => {
  // ---- Test 1: start game, move player next to enemy, screen becomes "combat" ----
  test("moving onto an enemy triggers combat", async ({ page }) => {
    await startGame(page);

    // Find an enemy (regenerate dungeon if no living enemies)
    const result = await page.evaluate(() => {
      if (!dungeon || !dungeon.enemies || !dungeon.enemies.some(function (e) { return e && e.hp > 0; })) {
        dungeon = generateFloor(1);
        if (dungeon) {
          player.x = dungeon.playerStart.x;
          player.y = dungeon.playerStart.y;
        }
      }
      if (!dungeon || !dungeon.enemies) return null;
      for (let i = 0; i < dungeon.enemies.length; i++) {
        const e = dungeon.enemies[i];
        if (!e || e.hp <= 0) continue;
        return { enemyIdx: i, enemyX: e.x, enemyY: e.y, px: player.x, py: player.y };
      }
      return null;
    });

    expect(result, "no enemy found on map").toBeTruthy();

    // Directly move player onto the enemy tile via page.evaluate to trigger combat
    await page.evaluate((pos) => {
      // Place player adjacent to the enemy first
      player.x = pos.enemyX - (pos.enemyX > pos.px ? 1 : -1);
      player.y = pos.enemyY;
      // Now move into the enemy tile -- this calls movePlayer which checks for enemies
      const dx = pos.enemyX > player.x ? 1 : -1;
      movePlayer(dx, 0);
    }, result);

    // gameState.screen should be "combat" after stepping on enemy
    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("combat");
  });

  // ---- Test 2: #combat-actions has buttons (.btn-atk etc.) ----
  test("combat-actions panel shows attack and defend buttons", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    // Wait for renderCombatActions to populate buttons
    await page.waitForSelector(".btn-atk", { state: "visible" });

    const hasAtk = await page.locator(".btn-atk").count();
    const hasDef = await page.locator(".btn-def").count();
    expect(hasAtk).toBeGreaterThanOrEqual(1);
    expect(hasDef).toBeGreaterThanOrEqual(1);
  });

  // ---- Test 3: record enemy hp, click .btn-atk, wait 500ms, check hp decreased ----
  test("attack button deals damage to enemy", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    const hpBefore = await page.evaluate(() => {
      return combatState ? combatState.enemy.hp : -1;
    });
    expect(hpBefore).toBeGreaterThan(0);

    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    const hpAfter = await page.evaluate(() => {
      return combatState ? combatState.enemy.hp : -1;
    });
    expect(hpAfter).toBeLessThan(hpBefore);
  });

  // ---- Test 4: click .btn-def, check combatState.playerDefending is true ----
  test("defend button sets playerDefending flag", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    // Reset playerDefending to false first to ensure a clean state
    await page.evaluate(() => {
      if (combatState) combatState.playerDefending = false;
    });

    await page.click(".btn-def");

    const defending = await page.evaluate(() => {
      return combatState ? combatState.playerDefending : false;
    });
    expect(defending).toBe(true);
  });

  // ---- Test 5: set enemy hp=1, attack, check back to dungeon, combatState null ----
  test("killing enemy returns to dungeon screen", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    // Set enemy HP to 1 so one attack kills it
    await page.evaluate(() => {
      if (combatState && combatState.enemy) {
        combatState.enemy.hp = 1;
      }
    });

    await page.click(".btn-atk");
    // enemyDefeated runs synchronously inside doAttack, but UI updates may take a tick
    await page.waitForTimeout(500);

    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("dungeon");

    const cs = await page.evaluate(() => combatState);
    expect(cs).toBeNull();
  });

  // ---- Test 6: record player.exp, kill enemy, check exp increased ----
  test("defeating enemy increases player exp", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    const expBefore = await page.evaluate(() => player.exp);

    // Kill the enemy by setting hp=1 and attacking
    await page.evaluate(() => {
      if (combatState && combatState.enemy) {
        combatState.enemy.hp = 1;
      }
    });
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    const expAfter = await page.evaluate(() => player.exp);
    expect(expAfter).toBeGreaterThan(expBefore);
  });

  // ---- Test 7: set player.exp close to expNext, kill enemy, level up, full hp ----
  test("gaining enough exp triggers level up and full heal", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    // Set player exp so that the enemy's exp reward pushes past expNext
    await page.evaluate(() => {
      const enemyExp = combatState.enemy.exp || 10;
      // Put player 1 EXP short of next level
      player.exp = player.expNext - 1;
      // Make sure enemy exp > 1 so it crosses the threshold
      combatState.enemy.exp = Math.max(enemyExp, 2);
      // Set enemy hp=1 for one-shot kill
      combatState.enemy.hp = 1;
    });

    const lvlBefore = await page.evaluate(() => player.lvl);

    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    const lvlAfter = await page.evaluate(() => player.lvl);
    const hpEqualsMax = await page.evaluate(() => player.hp === player.maxHp);

    expect(lvlAfter).toBeGreaterThan(lvlBefore);
    expect(hpEqualsMax).toBe(true);
  });
});
