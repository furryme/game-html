import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start a new game and wait until dungeon is ready.
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

test.describe("Equipment Identification & Floor Break", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("floor break modal shows with 4 options", async ({ page }) => {
    // Give player enough gems so the enhance buttons are enabled
    await page.evaluate(() => {
      player.gems = 6;
      player.equip.weapon = {
        id: "w1",
        slot: "weapon",
        rarity: "blue",
        name: "锋利的长剑",
        icon: "⚔",
        stats: { atk: 5 },
        identified: true,
      };
      player.equip.armor = {
        id: "a1",
        slot: "armor",
        rarity: "white",
        name: "普通的皮甲",
        icon: "\u{1F6E1}",
        stats: { def: 3 },
        identified: true,
      };
    });

    await page.evaluate(() => {
      showFloorBreak();
    });
    await page.waitForTimeout(300);

    // Modal should be visible
    const display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("flex");

    // Should have 4 .modal-btn elements inside
    const btnCount = await page.evaluate(() => {
      return document.querySelectorAll("#modal-overlay .modal-btn").length;
    });
    expect(btnCount).toBe(4);
  });

  test("enhancing weapon costs 3 gems and adds +2 ATK", async ({ page }) => {
    await page.evaluate(() => {
      player.gems = 5;
      player.equip.weapon = {
        id: "w1",
        slot: "weapon",
        rarity: "blue",
        name: "锋利的长剑",
        icon: "⚔",
        stats: { atk: 6 },
        identified: true,
      };
    });

    const gemsBefore = await page.evaluate(() => player.gems);
    const atkBefore = await page.evaluate(() => player.equip.weapon.stats.atk);

    // Open floor break modal
    await page.evaluate(() => {
      showFloorBreak();
    });
    await page.waitForTimeout(300);

    // Click the first modal-btn (enhance weapon)
    const firstBtnText = await page.evaluate(() => {
      const btns = document.querySelectorAll("#modal-overlay .modal-btn");
      return btns[0] ? btns[0].textContent : "";
    });
    expect(firstBtnText).toContain("强化武器");

    // Click via evaluate to trigger floorBreakChoice('weapon')
    await page.evaluate(() => {
      floorBreakChoice("weapon");
    });
    await page.waitForTimeout(500);

    const gemsAfter = await page.evaluate(() => player.gems);
    const atkAfter = await page.evaluate(() => player.equip.weapon.stats.atk);

    expect(gemsAfter).toBe(gemsBefore - 3);
    expect(atkAfter).toBe(atkBefore + 2);
  });

  test("enhancing armor costs 3 gems and adds +2 DEF", async ({ page }) => {
    await page.evaluate(() => {
      player.gems = 5;
      player.equip.armor = {
        id: "a1",
        slot: "armor",
        rarity: "white",
        name: "普通的皮甲",
        icon: "\u{1F6E1}",
        stats: { def: 4 },
        identified: true,
      };
    });

    const gemsBefore = await page.evaluate(() => player.gems);
    const defBefore = await page.evaluate(() => player.equip.armor.stats.def);

    await page.evaluate(() => {
      showFloorBreak();
    });
    await page.waitForTimeout(300);

    // Click enhance armor (second button)
    await page.evaluate(() => {
      floorBreakChoice("armor");
    });
    await page.waitForTimeout(500);

    const gemsAfter = await page.evaluate(() => player.gems);
    const defAfter = await page.evaluate(() => player.equip.armor.stats.def);

    expect(gemsAfter).toBe(gemsBefore - 3);
    expect(defAfter).toBe(defBefore + 2);
  });

  test("free identify sets identified to true on unidentified equipment", async ({ page }) => {
    // Place an unidentified purple weapon in the equipped slot
    await page.evaluate(() => {
      player.equip.weapon = {
        id: "w2",
        slot: "weapon",
        rarity: "purple",
        name: "远古的战斧",
        icon: "⚔",
        stats: { atk: 10, crit: 3 },
        identified: false,
      };
    });

    // Verify it is unidentified
    const identifiedBefore = await page.evaluate(() => player.equip.weapon.identified);
    expect(identifiedBefore).toBe(false);

    await page.evaluate(() => {
      showFloorBreak();
    });
    await page.waitForTimeout(300);

    // Click free identify
    await page.evaluate(() => {
      floorBreakChoice("identify");
    });
    await page.waitForTimeout(500);

    // Verify now identified
    const identifiedAfter = await page.evaluate(() => player.equip.weapon.identified);
    expect(identifiedAfter).toBe(true);
  });

  test("proceed closes the floor break modal", async ({ page }) => {
    await page.evaluate(() => {
      player.gems = 0;
      player.equip.weapon = null;
      player.equip.armor = null;
    });

    await page.evaluate(() => {
      showFloorBreak();
    });
    await page.waitForTimeout(300);

    // Verify modal is open
    const displayBefore = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayBefore).toBe("flex");

    // Click proceed
    await page.evaluate(() => {
      floorBreakChoice("proceed");
    });
    await page.waitForTimeout(500);

    // Modal should be closed
    const displayAfter = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayAfter).toBe("none");
  });

  test("shop can generate identify_scroll item", async ({ page }) => {
    // Force generate shop items and check the consumable pool contains identify_scroll
    // We call generateShopItems multiple times to find one with identify_scroll
    // (it has weight 10 out of total ~90, so ~11% per slot, likely in 3-5 items)
    const result = await page.evaluate(() => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const items = generateShopItems(1);
        for (let i = 0; i < items.length; i++) {
          if (items[i].itemId === "identify_scroll") {
            return { found: true, itemCount: items.length, item: items[i] };
          }
        }
      }
      return { found: false };
    });

    expect(result.found).toBe(true);
    expect(result.item.itemId).toBe("identify_scroll");
    expect(result.item.type).toBe("consumable");
  });
});
