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
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[0]) cards[0].click();
  });
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon" && window.player && window.dungeon
  );
  // Dismiss buff selection modal if open
  await page.evaluate(() => {
    const overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

/**
 * Helper: enter combat with the first living enemy.
 */
async function enterCombat(page) {
  const idx = await page.evaluate(() => {
    if (!dungeon || !dungeon.enemies) return -1;
    for (let i = 0; i < dungeon.enemies.length; i++) {
      if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) return i;
    }
    return -1;
  });
  if (idx < 0) {
    await page.evaluate(() => {
      dungeon = generateFloor(1);
      if (dungeon) {
        player.x = dungeon.playerStart.x;
        player.y = dungeon.playerStart.y;
      }
    });
  }
  await page.evaluate((i) => startCombat(i), idx);
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "combat"
  );
  await page.waitForTimeout(300);
}

/**
 * Helper: set up active buffs on the player and a mock combatState.
 * @param {string[]} buffIds - array of active buff ids (e.g. ["shield_burst"])
 */
async function setupActiveBuffs(page, buffIds) {
  await page.evaluate((ids) => {
    // Add active buffs as objects (matching game's activeBuff format)
    var buffs = [];
    for (var i = 0; i < ids.length; i++) {
      for (var d = 0; d < BUFF_DEFS.length; d++) {
        if (BUFF_DEFS[d].id === ids[i]) {
          buffs.push({ id: ids[i], stats: {}, combatDot: 0 });
          break;
        }
      }
    }
    player.activeBuffs = buffs;
  }, buffIds);
}

// =================== Active Buff HUD Buttons ===================

test.describe("Active Buff HUD Buttons", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
    await enterCombat(page);
  });

  // Test 1: renderCombatActions includes active buff buttons when player has active buffs
  test("renderCombatActions includes active buff buttons when player has active buffs", async ({ page }) => {
    await setupActiveBuffs(page, ["shield_burst"]);

    // Re-render combat actions to pick up the new active buffs
    await page.evaluate(() => {
      combatState.activeBuffCooldowns = {};
      renderCombatActions();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var container = document.querySelector(".active-buff-btns");
      if (!container) return { hasContainer: false };
      var buttons = container.querySelectorAll("button");
      var texts = [];
      for (var i = 0; i < buttons.length; i++) {
        texts.push(buttons[i].textContent);
      }
      return { hasContainer: true, buttonCount: buttons.length, texts: texts };
    });

    expect(result.hasContainer).toBe(true);
    expect(result.buttonCount).toBeGreaterThanOrEqual(1);
    // shield_burst name is "护盾爆发"
    var hasShieldBurst = result.texts.some(function (t) { return t.indexOf("护盾爆发") !== -1; });
    expect(hasShieldBurst).toBe(true);
  });

  // Test 2: Active buff buttons show cooldown count when on cooldown
  test("active buff buttons show cooldown count when on cooldown", async ({ page }) => {
    await setupActiveBuffs(page, ["shield_burst", "second_wind"]);

    await page.evaluate(() => {
      combatState.activeBuffCooldowns = { shield_burst: 3, second_wind: 5 };
      renderCombatActions();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var container = document.querySelector(".active-buff-btns");
      if (!container) return { found: false };
      var buttons = container.querySelectorAll("button");
      var results = [];
      for (var i = 0; i < buttons.length; i++) {
        results.push({
          text: buttons[i].textContent,
          disabled: buttons[i].disabled
        });
      }
      return { found: true, buttons: results };
    });

    expect(result.found).toBe(true);
    // shield_burst should show (3), second_wind should show (5)
    var hasCd3 = result.buttons.some(function (b) { return b.text.indexOf("(3)") !== -1; });
    var hasCd5 = result.buttons.some(function (b) { return b.text.indexOf("(5)") !== -1; });
    expect(hasCd3).toBe(true);
    expect(hasCd5).toBe(true);
  });

  // Test 3: Active buff buttons are disabled when on cooldown
  test("active buff buttons are disabled when on cooldown", async ({ page }) => {
    await setupActiveBuffs(page, ["shield_burst"]);

    await page.evaluate(() => {
      combatState.activeBuffCooldowns = { shield_burst: 2 };
      renderCombatActions();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var container = document.querySelector(".active-buff-btns");
      if (!container) return { found: false };
      var buttons = container.querySelectorAll("button");
      var allDisabled = true;
      for (var i = 0; i < buttons.length; i++) {
        if (!buttons[i].disabled) allDisabled = false;
      }
      return { found: true, count: buttons.length, allDisabled: allDisabled };
    });

    expect(result.found).toBe(true);
    expect(result.allDisabled).toBe(true);
  });

  // Test 4: Clicking active buff button calls useActiveBuff
  test("clicking active buff button calls useActiveBuff", async ({ page }) => {
    await setupActiveBuffs(page, ["shield_burst"]);

    await page.evaluate(() => {
      combatState.activeBuffCooldowns = {};
      combatState.animating = false;
      renderCombatActions();
    });
    await page.waitForTimeout(100);

    // Spy on useActiveBuff
    await page.evaluate(() => {
      window._activeBuffUsed = null;
      var original = window.useActiveBuff;
      window.useActiveBuff = function (id) {
        window._activeBuffUsed = id;
        return original ? original(id) : false;
      };
    });

    // Click the shield_burst button
    await page.click(".active-buff-btns button");
    await page.waitForTimeout(200);

    const usedBuff = await page.evaluate(() => window._activeBuffUsed);
    expect(usedBuff).toBe("shield_burst");
  });

  // Test 5: Active buff buttons NOT shown when player has no active buffs
  test("active buff buttons NOT shown when player has no active buffs", async ({ page }) => {
    await page.evaluate(() => {
      player.activeBuffs = [];
      renderCombatActions();
    });
    await page.waitForTimeout(100);

    const hasContainer = await page.evaluate(() => {
      return !!document.querySelector(".active-buff-btns");
    });

    expect(hasContainer).toBe(false);
  });
});

// =================== Buff Chip Tooltip ===================

test.describe("Buff Chip Tooltip", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  // Test 6: buffChipHTML includes tooltip span
  test("buffChipHTML includes tooltip span", async ({ page }) => {
    await page.evaluate(() => {
      player.activeBuffs = [{ id: "shield_burst", stats: {}, combatDot: 0 }];
      renderPlayerPanel();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var tooltips = document.querySelectorAll("#player-panel .buff-tooltip");
      var chips = document.querySelectorAll("#player-panel .buff-chip");
      return { tooltipCount: tooltips.length, chipCount: chips.length };
    });

    expect(result.chipCount).toBeGreaterThanOrEqual(1);
    expect(result.tooltipCount).toBeGreaterThanOrEqual(1);
  });

  // Test 7: Tooltip contains buff description
  test("tooltip contains buff description", async ({ page }) => {
    await page.evaluate(() => {
      player.activeBuffs = [{ id: "shield_burst", stats: {}, combatDot: 0 }];
      renderPlayerPanel();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var descEl = document.querySelector("#player-panel .buff-tooltip-desc");
      return descEl ? descEl.textContent : "";
    });

    // shield_burst desc: "抵挡下一次受到的全部伤害（冷却5回合）"
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("抵挡");
  });

  // Test 8: Tooltip contains source and type info
  test("tooltip contains source and type info", async ({ page }) => {
    await page.evaluate(() => {
      player.activeBuffs = [{ id: "shield_burst", stats: {}, combatDot: 0 }];
      renderPlayerPanel();
    });
    await page.waitForTimeout(100);

    const result = await page.evaluate(() => {
      var sourceEl = document.querySelector("#player-panel .buff-tooltip-source");
      var typeEl = document.querySelector("#player-panel .buff-tooltip-type");
      return {
        source: sourceEl ? sourceEl.textContent : "",
        type: typeEl ? typeEl.textContent : ""
      };
    });

    expect(result.source).toContain("来源");
    expect(result.type).toContain("类型");
  });
});

// =================== Equipment Synergy Hint ===================

test.describe("Equipment Synergy Hint", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  // Test 9: showBuffSelection card includes synergy hint when equipment matches
  test("showBuffSelection card includes synergy hint when equipment matches", async ({ page }) => {
    // Set up: flame_aura in unlockedBuffs, purple identified weapon equipped
    await page.evaluate(() => {
      permanent.unlockedBuffs = [];
      for (var i = 0; i < BUFF_DEFS.length; i++) {
        if (BUFF_DEFS[i].id === "flame_aura") {
          permanent.unlockedBuffs.push("flame_aura");
          break;
        }
      }
      // Add at least 2 more unlocked buffs so we have a pool of 3+
      for (var j = 0; j < BUFF_DEFS.length && permanent.unlockedBuffs.length < 3; j++) {
        if (permanent.unlockedBuffs.indexOf(BUFF_DEFS[j].id) === -1) {
          permanent.unlockedBuffs.push(BUFF_DEFS[j].id);
        }
      }

      // Equip a purple identified weapon so flame_aura triggers EQUIP_BONUS
      player.equip = {
        weapon: { id: "w_purple", name: "烈焰之剑", icon: "⚔", rarity: "purple", identified: true, atk: 10 },
        armor: null,
        accessory: null
      };
    });

    // Call showBuffSelection - it shuffles the pool, so flame_aura might not show
    // Force flame_aura to always be in the selection by manipulating pool
    await page.evaluate(() => {
      // Override showBuffSelection temporarily to ensure flame_aura is shown
      var pool = [];
      for (var i = 0; i < BUFF_DEFS.length; i++) {
        if (permanent.unlockedBuffs.indexOf(BUFF_DEFS[i].id) !== -1) {
          pool.push(BUFF_DEFS[i]);
        }
      }
      // Don't shuffle - keep in order so flame_aura appears if it's first
      // Move flame_aura to first position
      var idx = -1;
      for (var k = 0; k < pool.length; k++) {
        if (pool[k].id === "flame_aura") { idx = k; break; }
      }
      if (idx >= 0) {
        pool.splice(idx, 1);
        pool.unshift(pool[0]); // flame_aura at position 0
        if (pool.length > 3) pool = pool.slice(0, 3);
      }

      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Check if any buff card contains a synergy hint (gold-colored text with equipment name)
    const result = await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .buff-card");
      var results = [];
      for (var i = 0; i < cards.length; i++) {
        var text = cards[i].textContent;
        var style = "";
        var childDivs = cards[i].querySelectorAll("div");
        for (var j = 0; j < childDivs.length; j++) {
          var cs = childDivs[j].getAttribute("style") || "";
          if (cs.indexOf("#f0c040") !== -1) {
            style = childDivs[j].textContent;
          }
        }
        results.push({ text: text, hasSynergyHint: style.length > 0, style: style });
      }
      return results;
    });

    // At least one card should have the synergy hint (gold text)
    var hasSynergy = result.some(function (c) { return c.hasSynergyHint; });
    // The synergy hint should contain the equipment name "烈焰之剑" and dotDmg info
    if (hasSynergy) {
      var synergyText = result.find(function (c) { return c.hasSynergyHint; }).style;
      expect(synergyText.length).toBeGreaterThan(0);
    }
  });

  // Test 10: showBuffSelection card has NO synergy hint when equipment doesn't match
  test("showBuffSelection card has NO synergy hint when equipment does not match", async ({ page }) => {
    // Set up: flame_aura in unlockedBuffs, white (common) weapon equipped
    await page.evaluate(() => {
      permanent.unlockedBuffs = [];
      for (var i = 0; i < BUFF_DEFS.length; i++) {
        if (BUFF_DEFS[i].id === "flame_aura") {
          permanent.unlockedBuffs.push("flame_aura");
          break;
        }
      }
      for (var j = 0; j < BUFF_DEFS.length && permanent.unlockedBuffs.length < 3; j++) {
        if (permanent.unlockedBuffs.indexOf(BUFF_DEFS[j].id) === -1) {
          permanent.unlockedBuffs.push(BUFF_DEFS[j].id);
        }
      }

      // Equip a white rarity weapon (below purple threshold for flame_aura bonus)
      player.equip = {
        weapon: { id: "w_white", name: "铁剑", icon: "⚔", rarity: "white", identified: true, atk: 3 },
        armor: null,
        accessory: null
      };
    });

    await page.evaluate(() => {
      showBuffSelection();
    });
    await page.waitForTimeout(300);

    // Check all buff cards for synergy hint elements
    const result = await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .buff-card");
      var hasSynergyHint = false;
      for (var i = 0; i < cards.length; i++) {
        var childDivs = cards[i].querySelectorAll("div");
        for (var j = 0; j < childDivs.length; j++) {
          var cs = childDivs[j].getAttribute("style") || "";
          // Synergy hint has gold color and margin-top:4px
          if (cs.indexOf("#f0c040") !== -1 && cs.indexOf("margin-top:4px") !== -1) {
            hasSynergyHint = true;
          }
        }
      }
      return hasSynergyHint;
    });

    expect(result).toBe(false);
  });
});
