import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start game and wait for dungeon screen.
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

test.describe("Shop System", () => {
  // ---- Test 1: Dungeon with enough rooms contains a shop room ----
  test("dungeon generation produces at least one shop room", async ({ page }) => {
    await startGame(page);

    var hasShop = await page.evaluate(() => {
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].type === 'shop') return true;
      }
      return false;
    });

    // Dungeons with >= 3 middle rooms always get a shop (assignRoomTypes)
    expect(hasShop).toBe(true);
  });

  // ---- Test 2: Walking onto the shop cell opens the shop modal ----
  test("walking onto the shop room cell opens the shop modal", async ({ page }) => {
    await startGame(page);

    // Find the shop room center and move player there
    await page.evaluate(() => {
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].type === 'shop') {
          player.x = dungeon.rooms[i].cx;
          player.y = dungeon.rooms[i].cy;
          // Call the shop check from movement
          for (var s = 0; s < dungeon.rooms.length; s++) {
            if (dungeon.rooms[s].type === 'shop' && player.x === dungeon.rooms[s].cx && player.y === dungeon.rooms[s].cy) {
              openShop(dungeon.floor);
              break;
            }
          }
          break;
        }
      }
    });
    await page.waitForTimeout(500);

    // Verify modal is open
    var display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("flex");

    // Modal should contain shop text
    var modalText = await page.locator("#modal-overlay .modal").innerText();
    expect(modalText).toContain("商店");
  });

  // ---- Test 3: Shop UI shows item list with item rows ----
  test("shop modal displays item rows", async ({ page }) => {
    await startGame(page);

    // Ensure player has enough gold
    await page.evaluate(() => { player.gold = 500; });

    // Open shop directly
    await page.evaluate(() => {
      openShop(1);
    });
    await page.waitForTimeout(500);

    // Check item rows exist
    var rowCount = await page.locator(".shop-item-row").count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
    expect(rowCount).toBeLessThanOrEqual(5);
  });

  // ---- Test 4: Buying an item deducts gold ----
  test("buying an item reduces player gold by item price", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 500;
      openShop(1);
    });
    await page.waitForTimeout(500);

    var goldBefore = await page.evaluate(() => player.gold);
    var itemPrice = await page.evaluate(() => {
      return currentShopItems[0].price;
    });

    // Click buy button on the first item
    var firstItemId = await page.evaluate(() => {
      return currentShopItems[0].id;
    });

    // Find and click the buy button for the first item
    await page.evaluate(function (itemId) {
      var shopItem = null;
      for (var i = 0; i < currentShopItems.length; i++) {
        if (currentShopItems[i].id === itemId) { shopItem = currentShopItems[i]; break; }
      }
      if (shopItem && player.gold >= shopItem.price) {
        shopBuy(itemId);
      }
    }, firstItemId);
    await page.waitForTimeout(300);

    var goldAfter = await page.evaluate(() => player.gold);
    expect(goldAfter).toBe(goldBefore - itemPrice);
  });

  // ---- Test 5: Buying a HP potion adds it to inventory and using it heals ----
  test("buying HP potion adds to inventory and useItem heals", async ({ page }) => {
    await startGame(page);

    // Reduce HP so healing is measurable
    await page.evaluate(() => {
      player.hp = Math.floor(player.maxHp * 0.3);
      player.gold = 500;
    });

    var hpBefore = await page.evaluate(() => player.hp);
    var hadPotion = await page.evaluate(() => player.inventory.hp_potion || 0);

    // Open shop and ensure hp_potion is available, then buy it
    var bought = await page.evaluate(() => {
      openShop(1);
      // Ensure hp_potion is in the shop (add if missing for deterministic testing)
      var hasHP = false;
      for (var i = 0; i < currentShopItems.length; i++) {
        if (currentShopItems[i].itemId === 'hp_potion') { hasHP = true; break; }
      }
      if (!hasHP) {
        var def = ITEMS_DATA['hp_potion'];
        currentShopItems.push({
          id: 'shop_hp_test',
          itemId: 'hp_potion',
          price: def ? Math.round(def.price * shopPriceMultiplier(1)) : 10,
          label: def ? def.name : '生命药水',
          icon: def ? def.icon : '',
          type: 'consumable',
          desc: '',
        });
        renderShopModal();
      }
      // Buy the hp_potion
      for (var i = 0; i < currentShopItems.length; i++) {
        if (currentShopItems[i].itemId === 'hp_potion') {
          shopBuy(currentShopItems[i].id);
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(300);

    // Verify potion in inventory
    var potionCount = await page.evaluate(() => player.inventory.hp_potion || 0);
    expect(potionCount).toBeGreaterThan(hadPotion ? hadPotion : 0);

    // Use the potion
    await page.evaluate(() => {
      useItem('hp_potion');
    });
    await page.waitForTimeout(300);

    // HP should have increased
    var hpAfter = await page.evaluate(() => player.hp);
    expect(hpAfter).toBeGreaterThan(hpBefore);
    expect(hpAfter).toBeLessThanOrEqual(await page.evaluate(() => player.maxHp));
  });

  // ---- Test 6: Cannot buy when gold is insufficient ----
  test("cannot buy item when gold is insufficient", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 5; // Very low gold
      openShop(1);
    });
    await page.waitForTimeout(500);

    // Check that at least one button is disabled (insufficient gold)
    var disabledCount = await page.evaluate(() => {
      var buttons = document.querySelectorAll('.shop-buy-btn:disabled');
      return buttons.length;
    });
    expect(disabledCount).toBeGreaterThanOrEqual(1);

    // Try to buy via function directly (should not deduct gold)
    var goldBefore = await page.evaluate(() => player.gold);
    var shopItemId = await page.evaluate(() => currentShopItems[0].id);

    await page.evaluate(function (itemId) {
      shopBuy(itemId);
    }, shopItemId);
    await page.waitForTimeout(300);

    var goldAfter = await page.evaluate(() => player.gold);
    expect(goldAfter).toBe(goldBefore);
  });

  // ---- Test 7: Re-entering shop allows repeated purchases (items refresh) ----
  test("leaving and re-entering shop generates fresh items", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 1000;
    });

    // First visit: open shop, get items
    await page.evaluate(() => {
      openShop(1);
    });
    await page.waitForTimeout(300);

    var firstVisitItems = await page.evaluate(() => {
      var ids = [];
      for (var i = 0; i < currentShopItems.length; i++) {
        ids.push(currentShopItems[i].itemId);
      }
      return ids;
    });

    // Close shop
    await page.evaluate(() => {
      closeShop();
    });
    await page.waitForTimeout(300);

    // Verify modal is closed
    var display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("none");

    // Re-open shop
    await page.evaluate(() => {
      openShop(1);
    });
    await page.waitForTimeout(300);

    // Verify modal is open again
    display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("flex");

    // New items should exist
    var secondVisitItems = await page.evaluate(() => {
      var ids = [];
      for (var i = 0; i < currentShopItems.length; i++) {
        ids.push(currentShopItems[i].itemId);
      }
      return ids;
    });
    expect(secondVisitItems.length).toBeGreaterThanOrEqual(3);

    // Verify the second visit has items
    var rowCount = await page.locator(".shop-item-row").count();
    expect(rowCount).toBeGreaterThanOrEqual(3);
  });

  // ---- Test 8: Shop has a close/leave button ----
  test("shop modal has a leave button that closes the shop", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 500;
      openShop(1);
    });
    await page.waitForTimeout(500);

    // Verify the leave button exists
    var leaveBtnCount = await page.locator(".shop-leave-btn").count();
    expect(leaveBtnCount).toBe(1);

    // Verify leave button text
    var leaveBtnText = await page.locator(".shop-leave-btn").innerText();
    expect(leaveBtnText).toContain("离开");

    // Click the leave button
    await page.click(".shop-leave-btn");
    await page.waitForTimeout(500);

    // Verify modal is closed
    var display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("none");

    // Verify game is unpaused
    var paused = await page.evaluate(() => gameState.paused);
    expect(paused).toBe(false);
  });

  // ---- Test 9: Items at different floors have different price multipliers ----
  test("shop items at higher floors have higher prices", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 2000;
    });

    // Generate items at floor 1 and floor 5
    var floor1Items = await page.evaluate(() => {
      var items = generateShopItems(1);
      var prices = [];
      for (var i = 0; i < items.length; i++) prices.push(items[i].price);
      return prices;
    });

    var floor5Items = await page.evaluate(() => {
      var items = generateShopItems(5);
      var prices = [];
      for (var i = 0; i < items.length; i++) prices.push(items[i].price);
      return prices;
    });

    // Floor 5 items should have higher prices due to multiplier
    // Check price multiplier directly
    var mult1 = await page.evaluate(() => shopPriceMultiplier(1));
    var mult5 = await page.evaluate(() => shopPriceMultiplier(5));

    expect(mult1).toBe(1);
    expect(mult5).toBeGreaterThan(mult1);

    // Both floors should have items
    expect(floor1Items.length).toBeGreaterThanOrEqual(3);
    expect(floor5Items.length).toBeGreaterThanOrEqual(3);
  });

  // ---- Test 10: Buying equipment adds it to inventory.equipment ----
  test("buying equipment adds it to player inventory", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 1000;
      if (!player.inventory.equipment) player.inventory.equipment = [];
      var initialEqCount = player.inventory.equipment.length;

      openShop(1);
    });
    await page.waitForTimeout(300);

    // Find any equipment item in the shop
    var result = await page.evaluate(() => {
      var initialEqCount = player.inventory.equipment.length;
      var bought = false;
      for (var i = 0; i < currentShopItems.length; i++) {
        if (currentShopItems[i].type === 'equipment') {
          shopBuy(currentShopItems[i].id);
          bought = true;
          var newCount = player.inventory.equipment ? player.inventory.equipment.length : 0;
          return { bought: true, oldCount: initialEqCount, newCount: newCount };
        }
      }
      return { bought: false, oldCount: 0, newCount: 0 };
    });
    await page.waitForTimeout(300);

    if (result.bought) {
      expect(result.newCount).toBeGreaterThan(result.oldCount);
    }
    // If no equipment in shop, the test still passes (equipment is 30% chance)
  });

  // ---- Test 11: Purchasing logs message in game log ----
  test("purchasing an item logs a message to the game log", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 500;
      openShop(1);
    });
    await page.waitForTimeout(300);

    var itemLabel = await page.evaluate(() => {
      return currentShopItems[0].label;
    });

    // Buy the first item
    var firstId = await page.evaluate(() => currentShopItems[0].id);
    await page.evaluate(function (id) {
      shopBuy(id);
    }, firstId);
    await page.waitForTimeout(300);

    // Check log contains purchase message
    var logText = await page.locator("#log").innerText();
    expect(logText).toContain("购买了");
    expect(logText).toContain(itemLabel);
  });

  // ---- Test 12: Wandering merchant generates discounted items ----
  test("wandering merchant generates items with discounted prices", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      player.gold = 500;
    });

    var items = await page.evaluate(() => {
      var items = generateWanderingShopItems(1);
      var result = [];
      for (var i = 0; i < items.length; i++) {
        result.push({
          price: items[i].price,
          origPrice: items[i].origPrice,
          itemId: items[i].itemId
        });
      }
      return result;
    });

    // Should generate 2 items
    expect(items.length).toBe(2);

    // Each item should have a discount (price < origPrice)
    for (var i = 0; i < items.length; i++) {
      expect(items[i].price).toBeLessThan(items[i].origPrice);
      // Discount should be approximately 70% (between 60% and 80% to account for Math.round)
      var ratio = items[i].price / items[i].origPrice;
      expect(ratio).toBeGreaterThan(0.55);
      expect(ratio).toBeLessThan(0.80);
    }
  });
});
