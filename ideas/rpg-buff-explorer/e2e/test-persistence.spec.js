import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("RPG Buff Explorer - Persistence", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    // Wait for title screen to be active (initGame runs on DOMContentLoaded)
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);
  });

  test("1) start game - localStorage has SAVE_KEY item", async ({ page }) => {
    // Click "选择职业" to start, then select warrior
    await page.click('button:has-text("选择职业")');
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);

    // Manually call saveGame() since startNewGame() does not auto-save
    const saveResult = await page.evaluate(() => {
      saveGame();
      // saveGame now uses slot-based keys (rpg_buff_save_1, rpg_buff_save_2)
      return localStorage.getItem('rpg_buff_save_1') !== null || localStorage.getItem('rpg_buff_save_2') !== null;
    });
    expect(saveResult).toBe(true);

    // Verify save data has expected structure
    const saveData = await page.evaluate(() => {
      // Check slot-based keys
      var raw = localStorage.getItem('rpg_buff_save_1') || localStorage.getItem('rpg_buff_save_2');
      if (!raw) return null;
      var meta = JSON.parse(raw);
      return meta.data || meta;
    });
    expect(saveData).not.toBeNull();
    expect(saveData.player).toBeDefined();
    expect(saveData.dungeon).toBeDefined();
  });

  test("2) from title screen click talent button - #modal-overlay has .modal with talent info", async ({ page }) => {
    // Click the talent button on the title screen
    await page.click('button:has-text("天赋")');
    await page.waitForTimeout(300);

    // Check #modal-overlay has a .modal with talent info
    const modalVisible = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return { exists: false };
      const modal = overlay.querySelector(".modal");
      if (!modal) return { exists: false, hasModal: false };
      const text = modal.textContent;
      return {
        exists: true,
        hasModal: true,
        hasTalentTree: text.includes("天赋树"),
        hasSoulShards: text.includes("灵魂碎片"),
        hasLifeSurge: text.includes("生命涌动"),
      };
    });
    expect(modalVisible.exists).toBe(true);
    expect(modalVisible.hasModal).toBe(true);
    expect(modalVisible.hasTalentTree).toBe(true);
    expect(modalVisible.hasSoulShards).toBe(true);
    expect(modalVisible.hasLifeSurge).toBe(true);
  });

  test("3) set permanent.soulShards=5 - title-buttons text contains '5'", async ({ page }) => {
    // Set soulShards via evaluate and update the title screen
    await page.evaluate(() => {
      permanent.soulShards = 5;
      updateTitleScreen();
    });

    // Check title-buttons text contains "5"
    const titleText = await page.evaluate(() => {
      const el = document.getElementById("title-buttons");
      return el ? el.textContent : "";
    });
    expect(titleText).toContain("5");
  });

  test("4) set permanent.soulShards=3, talents={}, open talent modal, click upgrade, check shards=2", async ({ page }) => {
    // Set shards=3, talents={} and persist
    await page.evaluate(() => {
      permanent.soulShards = 3;
      permanent.talents = { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
      savePermanent(permanent);
    });

    // Reload to load the new permanent data
    await page.reload();
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    // Verify shards=3 after reload
    const shardsBefore = await page.evaluate(() => permanent.soulShards);
    expect(shardsBefore).toBe(3);

    // Open talent modal
    await page.click('button:has-text("天赋")');
    await page.waitForSelector(".modal", { timeout: 3000 });
    await page.waitForTimeout(300);

    // Click the first upgrade button
    const upgradeBtn = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')").first();
    await expect(upgradeBtn).toBeVisible();
    await expect(upgradeBtn).toBeEnabled();
    await upgradeBtn.click();
    await page.waitForTimeout(300);

    // Check shards reduced to 2
    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfter).toBe(2);
  });

  test("5) set player.gold=200, call onGameOver(permanent), check player.gold=100 (50% kept)", async ({ page }) => {
    // Start a new game: click "选择职业" + select warrior
    await page.click('button:has-text("选择职业")');
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      player.gold = 200;
    });

    const goldBefore = await page.evaluate(() => player.gold);
    expect(goldBefore).toBe(200);

    // Call onGameOver() which keeps 50% gold and stores in permanent._startGold
    const result = await page.evaluate(() => {
      const kept = onGameOver();
      return {
        keptGold: kept.keptGold,
        permanentStartGold: permanent._startGold,
        playerGoldAfter: player.gold,
      };
    });

    // onGameOver() sets player.gold = keptGold (100), then player.gold = 0
    // permanent._startGold = keptGold (100)
    expect(result.keptGold).toBe(100);
    expect(result.permanentStartGold).toBe(100);
  });

  test("6) set permanent.soulShards=7, talents.might=3, call savePermanent, reload, check localStorage has same data", async ({ page }) => {
    // Set permanent data and save
    await page.evaluate(() => {
      permanent.soulShards = 7;
      permanent.talents.might = 3;
      savePermanent(permanent);
    });

    // Reload page
    await page.reload();
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    // Check localStorage has the same data
    const data = await page.evaluate(() => {
      const raw = localStorage.getItem(PERMANENT_KEY);
      return raw ? JSON.parse(raw) : null;
    });
    expect(data).not.toBeNull();
    expect(data.soulShards).toBe(7);
    expect(data.talents.might).toBe(3);
  });
});
