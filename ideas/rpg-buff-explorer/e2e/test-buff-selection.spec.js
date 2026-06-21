import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("Buff Selection", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to title screen
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");

    // Click "开始冒险" to start a new game
    await page.click(".start-btn");
    await page.waitForTimeout(500);

    // Verify game initialized: gameState should be on window, screen should be "dungeon"
    await page.waitForFunction(() => {
      return gameState && gameState.screen === "dungeon" && player && dungeon;
    });
  });

  test("modal overlay display is flex after showBuffSelection", async ({ page }) => {
    // Setup permanent.unlockedBuffs from first 5 BUFF_DEFS entries
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 5).map(function (b) { return b.id; });
    });

    // Call the UI version of showBuffSelection (from ui.js, loaded after buff.js)
    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Check #modal-overlay has display:flex
    const display = await page.evaluate(() => {
      const el = document.getElementById("modal-overlay");
      return el ? el.style.display : "";
    });
    expect(display).toBe("flex");
  });

  test("buff cards have .icon .name .desc children", async ({ page }) => {
    // Setup: at least 3 unlocked buffs so showBuffSelection has a pool
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 5).map(function (b) { return b.id; });
    });

    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Check .buff-card elements exist and each has .icon .name .desc
    const cardData = await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .buff-card");
      const results = [];
      for (let i = 0; i < cards.length; i++) {
        results.push({
          icon: !!cards[i].querySelector(".icon"),
          name: !!cards[i].querySelector(".name"),
          desc: !!cards[i].querySelector(".desc"),
        });
      }
      return results;
    });

    expect(cardData.length).toBeGreaterThanOrEqual(3);
    for (const card of cardData) {
      expect(card.icon).toBe(true);
      expect(card.name).toBe(true);
      expect(card.desc).toBe(true);
    }
  });

  test("clicking first buff card increases activeBuffs length", async ({ page }) => {
    // Clear player's active buffs so the shown buffs are not already owned
    // Then set up unlocked buffs (uses buffs 8-12 which are NOT in DEFAULT_UNLOCKED)
    await page.evaluate(() => {
      player.activeBuffs = [];
      permanent.unlockedBuffs = BUFF_DEFS.slice(8, 13).map(function (b) { return b.id; });
    });

    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Record current activeBuffs length (should be 0 since we cleared it)
    const buffsBefore = await page.evaluate(() => {
      return player.activeBuffs.length;
    });

    // Click the first .buff-card (its onclick="pickBuff('id')" fires pickBuff)
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    // activeBuffs length should have increased by 1
    const buffsAfter = await page.evaluate(() => {
      return player.activeBuffs.length;
    });
    expect(buffsAfter).toBeGreaterThan(buffsBefore);
  });

  test("modal overlay closes (display:none) after selecting a buff", async ({ page }) => {
    // Setup
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 5).map(function (b) { return b.id; });
    });

    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Verify modal is open
    const displayBefore = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayBefore).toBe("flex");

    // Click first card to pick the buff (calls pickBuff which calls closeModal)
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    // After pickBuff, closeModal() sets display to 'none'
    const displayAfter = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayAfter).toBe("none");
  });

  test("player-panel shows .buff-chips after buff selection", async ({ page }) => {
    // Setup
    await page.evaluate(() => {
      permanent.unlockedBuffs = BUFF_DEFS.slice(0, 5).map(function (b) { return b.id; });
    });

    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Click first buff card
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(300);

    // pickBuff calls renderPlayerPanel() which includes buffChipHTML()
    // buffChipHTML outputs <div class="buff-chips"> when activeBuffs is non-empty
    const hasBuffChips = await page.evaluate(() => {
      const panel = document.getElementById("player-panel");
      return panel && !!panel.querySelector(".buff-chips");
    });
    expect(hasBuffChips).toBe(true);
  });
});
