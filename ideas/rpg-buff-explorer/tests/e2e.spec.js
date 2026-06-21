import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Dismiss the buff-selection modal that appears after entering a floor,
 * so the game is left in a clean dungeon state for testing.
 */
async function dismissModal(page) {
  // Close the buff selection modal if open
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
      closeModal();
    }
  });
  // Wait for overlay to actually close
  try {
    await page.waitForFunction(
      () => { const o = document.getElementById('modal-overlay'); return !o || o.style.display !== 'flex'; },
      {}, { timeout: 2000 }
    );
  } catch { /* overlay may not have been open */ }
}

/**
 * Start a new game and wait until the dungeon is fully initialised.
 */
async function startDungeon(page) {
  await page.click('button.start-btn:has-text("开始冒险")');
  await page.waitForFunction(
    "() => gameState && gameState.screen === 'dungeon' && dungeon && player",
    {},
    { timeout: 8000 }
  );
  await dismissModal(page);
  // Ensure dungeon has living enemies (regenerate if not)
  await page.evaluate(() => {
    var hasLiving = dungeon && dungeon.enemies && dungeon.enemies.some(function (e) { return e && e.hp > 0; });
    if (!hasLiving) {
      dungeon = generateFloor(1);
      if (dungeon) {
        player.x = dungeon.playerStart.x;
        player.y = dungeon.playerStart.y;
      }
    }
  });
}

test.describe("RPG Buff Explorer — Combat Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
  });

  /* 1 — walking into enemy triggers combat */
  test("walking into enemy triggers combat", async ({ page }) => {
    await startDungeon(page);

    const info = await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        const e = dungeon.enemies[i];
        if (e && e.hp > 0) {
          player.x = e.x - 1;
          player.y = e.y;
          dungeon.grid[player.y][player.x] = 0; // TILE.FLOOR
          return { found: true, name: e.name };
        }
      }
      return { found: false };
    });

    expect(info.found).toBe(true);

    // Un-pause (startCombat sets paused=true but the player was placed
    // *before* combat, so we need the flag off for the move to fire).
    await page.evaluate(() => {
      gameState.paused = false;
      movePlayer(1, 0);
    });

    await page.waitForFunction(
      "() => combatState && combatState.enemy && gameState.screen === 'combat'",
      {},
      { timeout: 3000 }
    );

    const name = await page.evaluate(() => combatState.enemy.name);
    expect(name).toBe(info.name);
  });

  /* 2 — combat buttons appear in #combat-actions */
  test("combat buttons appear in #combat-actions", async ({ page }) => {
    await startDungeon(page);

    await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          startCombat(i);
          break;
        }
      }
    });

    await page.waitForFunction(
      "() => document.getElementById('combat-actions').style.display !== 'none'",
      {},
      { timeout: 3000 }
    );

    const box = page.locator("#combat-actions");
    await expect(box).toBeVisible();
    await expect(box.locator(".btn-atk")).toBeVisible();
    await expect(box.locator(".btn-def")).toBeVisible();
    await expect(box.locator(".btn-item")).toBeVisible();
    await expect(box.locator(".btn-flee")).toBeVisible();
  });

  /* 3 — attack button .btn-atk deals damage */
  test("attack button .btn-atk deals damage", async ({ page }) => {
    await startDungeon(page);

    const hpBefore = await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          startCombat(i);
          return dungeon.enemies[i].hp;
        }
      }
      return 0;
    });

    await page.waitForFunction(
      "() => combatState && combatState.enemy",
      {},
      { timeout: 3000 }
    );

    await page.click("#combat-actions .btn-atk");
    await page.waitForTimeout(500);

    // Enemy may die from the attack — if so, combatState is null and screen is "dungeon"
    const result = await page.evaluate(() => {
      if (combatState && combatState.enemy) {
        return { hp: combatState.enemy.hp, alive: true };
      }
      return { hp: 0, alive: false, screen: gameState.screen };
    });

    if (result.alive) {
      expect(result.hp).toBeLessThan(hpBefore);
    } else {
      // Enemy died — verify it was the attack that killed it
      expect(result.screen).toBe("dungeon");
    }
  });

  /* 4 — defend .btn-def sets playerDefending */
  test("defend .btn-def sets playerDefending", async ({ page }) => {
    await startDungeon(page);

    await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          startCombat(i);
          break;
        }
      }
    });

    await page.waitForFunction(
      "() => combatState && combatState.enemy",
      {},
      { timeout: 3000 }
    );

    expect(await page.evaluate(() => combatState.playerDefending)).toBe(false);

    await page.click("#combat-actions .btn-def");
    await page.waitForTimeout(200);

    expect(await page.evaluate(() => combatState && combatState.playerDefending)).toBe(true);
  });

  /* 5 — enemy defeat returns to dungeon */
  test("enemy defeat returns to dungeon", async ({ page }) => {
    await startDungeon(page);

    const idx = await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) {
          dungeon.enemies[i].hp = 1;
          startCombat(i);
          return i;
        }
      }
      return -1;
    });

    expect(idx).toBeGreaterThanOrEqual(0);

    await page.waitForFunction(
      "() => combatState && combatState.enemy",
      {},
      { timeout: 3000 }
    );

    await page.click("#combat-actions .btn-atk");

    await page.waitForFunction(
      "() => combatState === null && gameState.screen === 'dungeon'",
      {},
      { timeout: 5000 }
    );

    const [combatHidden, dungeonVisible, enemyGone] = await page.evaluate((idx) => {
      const ca = document.getElementById("combat-actions");
      const da = document.getElementById("dungeon-actions");
      return [
        ca.style.display === "none",
        da.style.display !== "none",
        !dungeon.enemies[idx],
      ];
    }, idx);

    expect(combatHidden).toBe(true);
    expect(dungeonVisible).toBe(true);
    expect(enemyGone).toBe(true);
  });

  /* 6 — exp gained on victory */
  test("exp gained on victory", async ({ page }) => {
    await startDungeon(page);

    const before = await page.evaluate(() => {
      for (let i = 0; i < dungeon.enemies.length; i++) {
        const e = dungeon.enemies[i];
        if (e && e.hp > 0) {
          e.hp = 1;
          startCombat(i);
          return { exp: player.exp, lvl: player.lvl, enemyExp: e.exp || 10 };
        }
      }
      return null;
    });

    expect(before).not.toBeNull();

    await page.waitForFunction(
      "() => combatState && combatState.enemy",
      {},
      { timeout: 3000 }
    );

    await page.click("#combat-actions .btn-atk");

    await page.waitForFunction(
      "() => combatState === null",
      {},
      { timeout: 5000 }
    );
    await page.waitForTimeout(300);

    const after = await page.evaluate(() => ({ exp: player.exp, lvl: player.lvl }));

    // If same level, raw exp should have increased by at least enemyExp.
    // If level changed, the rollover still means exp was earned.
    if (after.lvl === before.lvl) {
      expect(after.exp - before.exp).toBeGreaterThanOrEqual(before.enemyExp);
    } else {
      expect(after.lvl).toBeGreaterThan(before.lvl);
    }
  });

  /* 7 — level up restores hp */
  test("level up restores hp", async ({ page }) => {
    await startDungeon(page);

    const setup = await page.evaluate(() => {
      player.hp = Math.floor(player.maxHp * 0.3);
      const needed = player.expNext - player.exp;

      for (let i = 0; i < dungeon.enemies.length; i++) {
        const e = dungeon.enemies[i];
        if (e && e.hp > 0) {
          e.exp = needed + 5; // guarantee level-up
          e.hp = 1;
          startCombat(i);
          break;
        }
      }

      return { hpBefore: player.hp, maxHp: player.maxHp, lvlBefore: player.lvl };
    });

    expect(setup.hpBefore).toBeLessThan(setup.maxHp);

    await page.waitForFunction(
      "() => combatState && combatState.enemy",
      {},
      { timeout: 3000 }
    );

    await page.click("#combat-actions .btn-atk");

    await page.waitForFunction(
      "() => combatState === null",
      {},
      { timeout: 5000 }
    );
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => ({
      hp: player.hp,
      maxHp: player.maxHp,
      lvl: player.lvl,
    }));

    expect(result.lvl).toBeGreaterThan(setup.lvlBefore);
    expect(result.hp).toBe(result.maxHp);
  });
});
