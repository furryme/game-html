import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start a new game with warrior class and wait until dungeon is ready.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active", { timeout: 8000 });

  // Click "选择职业" button
  await page.click(".start-btn");
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });

  // Select warrior (first card)
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[0]) cards[0].click();
  });

  // Wait for dungeon to load
  await page.waitForFunction(() => {
    return gameState && gameState.screen === "dungeon" && player && dungeon;
  }, { timeout: 8000 });

  // Dismiss any open modal
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Helper: read ATK value from the player panel stat row text.
 * Returns parsed ATK number.
 */
async function getPlayerPanelAtk(page) {
  const atk = await page.evaluate(() => {
    const statRows = document.querySelectorAll("#player-panel .stat-row");
    if (!statRows || statRows.length < 1) return -1;
    // First stat-row: ATK DEF SPD
    const text = statRows[0].textContent;
    // Extract the first number from the text (e.g. "30" from "30 20 10")
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : -1;
  });
  return atk;
}

/**
 * Helper: dismiss the combat-end "victory" log or any lingering modal after enemyDefeated.
 */
async function dismissPostCombatModals(page) {
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(400);
}

/**
 * Helper: wait for the equipment modal to be visible.
 */
async function waitForEquipModal(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById("modal-overlay");
    return overlay && overlay.style.display === "flex" &&
           overlay.textContent.indexOf("装备管理") !== -1;
  }, { timeout: 5000 });
}

// ============================================================
// Test 1: Boss Battle Complete Flow
// ============================================================
test.describe("Equipment E2E - Boss Battle Flow", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("1) Attack boss until defeated, verify drops and equipment modal", async ({ page }) => {
    // --- Setup: enter boss combat ---
    // Find the boss enemy index and start combat
    const bossInfo = await page.evaluate(() => {
      // Find the boss in dungeon.enemies
      for (let i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          // Reduce boss HP to a manageable level for fast testing
          dungeon.enemies[i].hp = 3;
          return { idx: i, name: dungeon.enemies[i].name, hp: dungeon.enemies[i].hp };
        }
      }
      return null;
    });

    expect(bossInfo, "boss should exist on floor 1").not.toBeNull();
    expect(bossInfo.hp).toBe(3);

    // Start combat via evaluate (only allowed JS call to skip movement)
    await page.evaluate((i) => startCombat(i), bossInfo.idx);

    // Wait for combat UI to appear
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "combat",
      { timeout: 5000 }
    );
    await expect(page.locator("#combat-overlay")).toBeVisible();

    // Verify attack button exists
    await expect(page.locator(".btn-atk")).toBeVisible();

    // --- Fight: click attack until boss defeated ---
    // Boss has 3 HP, each attack should deal damage
    let defeated = false;
    for (let round = 0; round < 10; round++) {
      // Check if still in combat
      const inCombat = await page.evaluate(() => !!combatState);
      if (!inCombat) {
        defeated = true;
        break;
      }
      // Click attack button
      await page.click(".btn-atk");
      await page.waitForTimeout(800);
    }

    expect(defeated, "boss should be defeated within 10 attacks").toBe(true);

    // Verify back to dungeon
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    expect(await page.evaluate(() => combatState)).toBeNull();

    // --- Verify equipment modal auto-appears (boss drops trigger it) ---
    // The modal opens via setTimeout(300ms), wait for it
    await page.waitForTimeout(800);
    const modalText = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      return overlay ? overlay.textContent : "";
    });
    const hasEquipModal = modalText.indexOf("装备管理") !== -1;

    if (hasEquipModal) {
      // Modal is open - verify equipment inventory items are listed
      const invCount = await page.evaluate(() => {
        return player.inventory.equipment ? player.inventory.equipment.length : 0;
      });
      expect(invCount, "should have equipment from boss drops").toBeGreaterThanOrEqual(1);

      // Close the modal
      await page.click('.modal-btn:has-text("关闭")');
      await page.waitForTimeout(300);
    } else {
      // If modal didn't auto-open, manually open to verify equipment
      await page.click('.equip-modal-btn:has-text("装备")');
      await waitForEquipModal(page);

      const invCount = await page.evaluate(() => {
        return player.inventory.equipment ? player.inventory.equipment.length : 0;
      });
      expect(invCount, "should have equipment from boss drops").toBeGreaterThanOrEqual(1);

      // Close the modal
      await page.click('.modal-btn:has-text("关闭")');
      await page.waitForTimeout(300);
    }

    // --- Verify boss defeat flag ---
    const bossDefeated = await page.evaluate(() => gameState.bossDefeated);
    expect(bossDefeated).toBe(true);

    // --- Verify inventory has equipment ---
    const finalInvCount = await page.evaluate(() => {
      return player.inventory.equipment ? player.inventory.equipment.length : 0;
    });
    expect(finalInvCount).toBeGreaterThanOrEqual(1);

    // Verify each item has required fields
    const itemValid = await page.evaluate(() => {
      const inv = player.inventory.equipment;
      for (let i = 0; i < inv.length; i++) {
        const item = inv[i];
        if (!item.id || !item.name || !item.slot || !item.rarity || !item.stats) return false;
      }
      return true;
    });
    expect(itemValid).toBe(true);

    // Verify game is playable after boss fight
    expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");
    expect(await page.evaluate(() => player.hp > 0)).toBe(true);
  });
});

// ============================================================
// Test 2: Equipment Modal UI Interaction
// ============================================================
test.describe("Equipment E2E - Equipment Modal UI", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("2) Open equipment modal via UI, verify items, equip one, verify slot", async ({ page }) => {
    // --- Setup: add 2 pieces of equipment ---
    await page.evaluate(() => {
      rollLoot(gameState.floor, true);
      rollLoot(gameState.floor, true);
    });
    await page.waitForTimeout(200);

    // Verify inventory has items
    const invBefore = await page.evaluate(() => player.inventory.equipment.length);
    expect(invBefore).toBeGreaterThanOrEqual(2);

    // --- Open equipment modal via button click ---
    await page.click('.equip-modal-btn:has-text("装备")');
    await waitForEquipModal(page);

    // Verify modal is visible
    const modalVisible = await page.locator("#modal-overlay").isVisible();
    expect(modalVisible).toBe(true);

    // Verify inventory section shows item count
    const invSectionText = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      // Find the inventory section header
      const allDivs = overlay ? overlay.querySelectorAll("div") : [];
      for (let i = 0; i < allDivs.length; i++) {
        if (allDivs[i].textContent.indexOf("背包装备") !== -1) {
          return allDivs[i].textContent;
        }
      }
      return "";
    });
    expect(invSectionText.indexOf("背包装备")).toBeGreaterThanOrEqual(0);

    // Verify equipment items appear in the modal inventory section
    const itemInfo = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      const text = overlay ? overlay.textContent : "";
      // Check that the inventory section is not empty (does not contain "没有装备")
      const hasNoEquipMsg = text.indexOf("没有装备") !== -1;
      // Check that equipment-related text appears
      const hasEquipBtn = text.indexOf("装备") !== -1;
      const hasSellBtn = text.indexOf("出售") !== -1;
      // Check for equipment slot labels
      const hasSlotLabel = text.indexOf("武器") !== -1 || text.indexOf("护甲") !== -1;
      return { hasNoEquipMsg, hasEquipBtn, hasSellBtn, hasSlotLabel, textLength: text.length };
    });
    expect(itemInfo.hasNoEquipMsg, "should NOT show empty inventory message").toBe(false);
    expect(itemInfo.hasEquipBtn, "should have equip button").toBe(true);
    expect(itemInfo.hasSellBtn, "should have sell button").toBe(true);
    expect(itemInfo.textLength).toBeGreaterThan(20);

    // --- Click "装备" button on first item ---
    // The equip buttons have text "装备" - find one that's NOT the sidebar button
    await page.click("#modal-overlay .equip-modal-btn:has-text(\"装备\")");
    await page.waitForTimeout(500);

    // --- Verify the equipped slot shows the item ---
    // After equipping, modal re-renders - check equipped slot is no longer empty
    const slotFilled = await page.evaluate(() => {
      // Check if any slot has actual equipment (purple equipment may be unidentified)
      for (const slot of ["weapon", "armor", "accessory"]) {
        if (player.equip[slot]) {
          return true;
        }
      }
      return false;
    });
    expect(slotFilled, "at least one slot should be filled").toBe(true);

    // Verify the equipped item name appears in the modal's equipped section
    // Check that the overlay no longer shows all slots as empty
    const hasEquippedInModal = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return false;
      const text = overlay.textContent;
      // Should have the equipment icon + name, not just empty text
      // Equipment icons: weapon=⚔, armor=🛡, accessory=📋
      const equipIcons = ["⚔", "📋"]; // shield unicode may vary in textContent
      for (const icon of equipIcons) {
        if (text.indexOf(icon) !== -1 && text.indexOf("— 空 —") === -1) return true;
      }
      // Alternative: just check we have fewer "空" entries than 3 (some slot filled)
      let emptyCount = 0;
      let pos = 0;
      while ((pos = text.indexOf("空", pos)) !== -1) {
        emptyCount++;
        pos++;
      }
      return emptyCount < 3;
    });
    expect(hasEquippedInModal, "modal should show equipped item").toBe(true);

    // Close modal
    await page.click('.modal-btn:has-text("关闭")');
    await page.waitForTimeout(300);

    // --- Verify player panel shows equipped item ---
    const panelHasEquip = await page.evaluate(() => {
      const slots = document.querySelectorAll(".equip-slot");
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].textContent.indexOf("空") === -1 && slots[i].textContent.trim().length > 2) {
          return true;
        }
      }
      return false;
    });
    expect(panelHasEquip, "player panel should show equipped item").toBe(true);
  });
});

// ============================================================
// Test 3: Stats Change After Equip
// ============================================================
test.describe("Equipment E2E - Stats Change Verification", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("3) Equipping ATK weapon increases player panel ATK display", async ({ page }) => {
    // --- Record initial ATK ---
    const atkBefore = await getPlayerPanelAtk(page);
    expect(atkBefore).toBeGreaterThan(0);

    // --- Add a weapon with known high ATK ---
    const weaponInfo = await page.evaluate(() => {
      // Generate a blue weapon and force atk stat
      const weapon = generateEquipment(gameState.floor, "blue");
      // Ensure it has atk
      weapon.stats.atk = 15;
      weapon.slot = "weapon";
      weapon.identified = true;
      player.inventory.equipment.push(weapon);
      return { id: weapon.id, atk: weapon.stats.atk };
    });

    // --- Open equipment modal ---
    await page.click('.equip-modal-btn:has-text("装备")');
    await waitForEquipModal(page);

    // --- Click equip on the weapon ---
    // Find the equip button for this specific item by its onclick handler
    const equipped = await page.evaluate((id) => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return false;
      const btns = overlay.querySelectorAll('.equip-modal-btn');
      for (let i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === "装备") {
          // Check if this button's onclick matches our item id
          const onclick = btns[i].getAttribute("onclick") || "";
          if (onclick.indexOf(id) !== -1) {
            btns[i].click();
            return true;
          }
        }
      }
      return false;
    }, weaponInfo.id);
    expect(equipped, "should find and click equip button for weapon").toBe(true);
    await page.waitForTimeout(500);

    // --- Close modal ---
    await page.click('.modal-btn:has-text("关闭")');
    await page.waitForTimeout(300);

    // --- Verify ATK increased ---
    const atkAfter = await getPlayerPanelAtk(page);
    expect(atkAfter, "ATK should increase after equipping weapon").toBeGreaterThan(atkBefore);
    expect(atkAfter - atkBefore).toBeGreaterThanOrEqual(1);

    // Also verify via JS that the equipment is in the weapon slot
    const weaponEquipped = await page.evaluate(() => {
      return player.equip.weapon !== null && player.equip.weapon.identified !== false;
    });
    expect(weaponEquipped).toBe(true);
  });
});

// ============================================================
// Test 4: Unequip Equipment
// ============================================================
test.describe("Equipment E2E - Unequip Flow", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("4) Equip weapon, open modal, unequip, verify slot empty and item in inventory", async ({ page }) => {
    // --- Setup: equip a weapon ---
    await page.evaluate(() => {
      const weapon = generateEquipment(gameState.floor, "blue");
      weapon.stats.atk = 10;
      weapon.slot = "weapon";
      weapon.identified = true;
      player.inventory.equipment.push(weapon);
      equipItem(weapon.id);
      renderPlayerPanel();
    });
    await page.waitForTimeout(300);

    // Verify weapon is equipped
    const isEquipped = await page.evaluate(() => player.equip.weapon !== null);
    expect(isEquipped).toBe(true);
    const invBeforeUnequip = await page.evaluate(() => player.inventory.equipment.length);

    // --- Open equipment modal ---
    await page.click('.equip-modal-btn:has-text("装备")');
    await waitForEquipModal(page);

    // --- Click "卸下" on the weapon slot ---
    // The unequip button has text "卸下"
    const unequipClicked = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return false;
      const btns = overlay.querySelectorAll('.equip-modal-btn');
      for (let i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === "卸下") {
          btns[i].click();
          return true;
        }
      }
      return false;
    });
    expect(unequipClicked, "should find and click unequip button").toBe(true);
    await page.waitForTimeout(500);

    // --- Verify slot is now empty ---
    const slotEmpty = await page.evaluate(() => player.equip.weapon === null);
    expect(slotEmpty, "weapon slot should be empty after unequip").toBe(true);

    // --- Verify item is back in inventory ---
    const invAfterUnequip = await page.evaluate(() => player.inventory.equipment.length);
    expect(invAfterUnequip).toBeGreaterThan(invBeforeUnequip);

    // Verify "卸下" button no longer appears (slot is empty, no unequip button)
    const unequipBtnGone = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return true;
      // Re-rendered modal: check if "卸下" text exists in overlay
      return overlay.textContent.indexOf("卸下") === -1;
    });
    expect(unequipBtnGone, "unequip button should be gone after slot empty").toBe(true);

    // Close modal
    await page.click('.modal-btn:has-text("关闭")');
    await page.waitForTimeout(300);

    // --- Verify player panel shows empty weapon slot ---
    const panelHasEmptyWeapon = await page.evaluate(() => {
      const slots = document.querySelectorAll(".equip-slot");
      // First slot is weapon
      return slots.length > 0 && slots[0].textContent.indexOf("空") !== -1;
    });
    expect(panelHasEmptyWeapon, "weapon slot should show empty in player panel").toBe(true);
  });
});

// ============================================================
// Test 5: New Drop Highlight
// ============================================================
test.describe("Equipment E2E - New Drop Highlight", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("5) Newly dropped equipment shows NEW tag and gold border in modal", async ({ page }) => {
    // --- Setup: add equipment with justDropped flag ---
    await page.evaluate(() => {
      // rollLoot with guaranteed=true sets justDropped=true
      rollLoot(gameState.floor, true);
      rollLoot(gameState.floor, true);
    });
    await page.waitForTimeout(200);

    // Verify items have justDropped flag
    const newCount = await page.evaluate(() => {
      let count = 0;
      const inv = player.inventory.equipment;
      for (let i = 0; i < inv.length; i++) {
        if (inv[i].justDropped === true) count++;
      }
      return count;
    });
    expect(newCount).toBeGreaterThanOrEqual(2);

    // --- Open equipment modal ---
    await page.click('.equip-modal-btn:has-text("装备")');
    await waitForEquipModal(page);

    // --- Verify NEW tag exists in the modal ---
    const newHighlight = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return { hasNew: false, hasGoldBorder: false, newText: "" };

      // Check for NEW text
      const hasNew = overlay.textContent.indexOf("NEW") !== -1;

      // Check for gold border on item divs (new items have gold border)
      const allDivs = overlay.querySelectorAll("div");
      let hasGoldBorder = false;
      for (let i = 0; i < allDivs.length; i++) {
        const style = allDivs[i].getAttribute("style") || "";
        if (style.indexOf("f0c040") !== -1 || style.indexOf("ffd700") !== -1 ||
            style.indexOf("gold") !== -1 || style.indexOf("box-shadow") !== -1) {
          hasGoldBorder = true;
          break;
        }
      }

      // Check for "获得 N 件新装备" notification
      const hasNewNotification = overlay.textContent.indexOf("新装备") !== -1;

      return {
        hasNew: hasNew,
        hasGoldBorder: hasGoldBorder,
        hasNewNotification: hasNewNotification,
      };
    });

    expect(newHighlight.hasNew, "NEW tag should appear on new items").toBe(true);
    expect(newHighlight.hasGoldBorder, "gold border/shadow should appear on new items").toBe(true);
    expect(newHighlight.hasNewNotification, "new equipment notification should appear").toBe(true);

    // --- Verify justDropped cleared after opening modal ---
    // showEquipmentModal calls clearNewDrops which removes justDropped flag
    const stillNew = await page.evaluate(() => {
      let count = 0;
      const inv = player.inventory.equipment;
      for (let i = 0; i < inv.length; i++) {
        if (inv[i].justDropped === true) count++;
      }
      return count;
    });
    expect(stillNew, "justDropped should be cleared after modal opens").toBe(0);

    // Close modal
    await page.click('.modal-btn:has-text("关闭")');
    await page.waitForTimeout(300);

    // --- Re-open modal: NEW tag should be gone ---
    // Use sidebar button specifically to avoid clicking hidden modal buttons
    await page.evaluate(() => {
      const btns = document.querySelectorAll("#player-panel .equip-modal-btn");
      for (let i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf("装备") !== -1) {
          btns[i].click();
          return;
        }
      }
    });
    await waitForEquipModal(page);

    const newGone = await page.evaluate(() => {
      const overlay = document.getElementById("modal-overlay");
      if (!overlay) return true;
      return overlay.textContent.indexOf("NEW") === -1 &&
             overlay.textContent.indexOf("新装备") === -1;
    });
    expect(newGone, "NEW tag should be gone after clearing justDropped").toBe(true);

    // Close modal
    await page.click('.modal-btn:has-text("关闭")');
    await page.waitForTimeout(300);
  });
});
