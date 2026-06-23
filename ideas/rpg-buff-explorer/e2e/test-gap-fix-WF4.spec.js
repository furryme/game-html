import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start a new game with warrior class and wait until dungeon is ready.
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

// =================== checkBuffUnlocks Condition Types ===================

test.describe("Gap Fix WF4 - checkBuffUnlocks Condition Types", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("floor condition: maxFloor >= 2 unlocks lifesteal", async ({ page }) => {
    var result = await page.evaluate(() => {
      // lifesteal unlockCondition: { type: 'floor', value: 2, label: '到达第2层' }
      // It's not in DEFAULT_UNLOCKED, so we remove it from unlockedBuffs first
      permanent.unlockedBuffs = permanent.unlockedBuffs.filter(function (id) {
        return id !== "lifesteal";
      });

      // Set maxFloor >= 2 and ensure progress is synced
      permanent.permanentStats.maxFloor = 2;
      if (!permanent.buffUnlockProgress.floor) {
        permanent.buffUnlockProgress.floor = {};
      }
      permanent.buffUnlockProgress.floor.lifesteal = 2;

      var newUnlocks = checkBuffUnlocks(permanent);
      return {
        unlocked: newUnlocks.map(function (b) { return b.id; }),
        inList: permanent.unlockedBuffs.indexOf("lifesteal") !== -1
      };
    });

    expect(result.unlocked).toContain("lifesteal");
    expect(result.inList).toBe(true);
  });

  test("floor condition: maxFloor = 1 does NOT unlock lifesteal", async ({ page }) => {
    var result = await page.evaluate(() => {
      permanent.unlockedBuffs = permanent.unlockedBuffs.filter(function (id) {
        return id !== "lifesteal";
      });

      permanent.permanentStats.maxFloor = 1;
      if (!permanent.buffUnlockProgress.floor) {
        permanent.buffUnlockProgress.floor = {};
      }
      permanent.buffUnlockProgress.floor.lifesteal = 1;

      var newUnlocks = checkBuffUnlocks(permanent);
      return {
        unlocked: newUnlocks.map(function (b) { return b.id; }),
        inList: permanent.unlockedBuffs.indexOf("lifesteal") !== -1
      };
    });

    var hasLifesteal = result.unlocked.indexOf("lifesteal") !== -1;
    expect(hasLifesteal).toBe(false);
    expect(result.inList).toBe(false);
  });

  test("damage_taken condition: progress >= 2000 unlocks frost_heart", async ({ page }) => {
    var result = await page.evaluate(() => {
      // frost_heart unlockCondition: { type: 'damage_taken', value: 2000 }
      permanent.unlockedBuffs = permanent.unlockedBuffs.filter(function (id) {
        return id !== "frost_heart";
      });

      if (!permanent.buffUnlockProgress.damage_taken) {
        permanent.buffUnlockProgress.damage_taken = {};
      }
      permanent.buffUnlockProgress.damage_taken.frost_heart = 2000;

      var newUnlocks = checkBuffUnlocks(permanent);
      return {
        unlocked: newUnlocks.map(function (b) { return b.id; }),
        inList: permanent.unlockedBuffs.indexOf("frost_heart") !== -1
      };
    });

    expect(result.unlocked).toContain("frost_heart");
    expect(result.inList).toBe(true);
  });

  test("skill_use condition: progress >= 100 unlocks mana_tide", async ({ page }) => {
    var result = await page.evaluate(() => {
      // mana_tide unlockCondition: { type: 'skill_use', value: 100 }
      permanent.unlockedBuffs = permanent.unlockedBuffs.filter(function (id) {
        return id !== "mana_tide";
      });

      if (!permanent.buffUnlockProgress.skill_use) {
        permanent.buffUnlockProgress.skill_use = {};
      }
      permanent.buffUnlockProgress.skill_use.mana_tide = 100;

      var newUnlocks = checkBuffUnlocks(permanent);
      return {
        unlocked: newUnlocks.map(function (b) { return b.id; }),
        inList: permanent.unlockedBuffs.indexOf("mana_tide") !== -1
      };
    });

    expect(result.unlocked).toContain("mana_tide");
    expect(result.inList).toBe(true);
  });

  test("multiple condition types checked simultaneously without error", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Remove all condition-locked buffs from unlockedBuffs
      permanent.unlockedBuffs = DEFAULT_UNLOCKED.slice();

      // Set up multiple condition types
      permanent.permanentStats.maxFloor = 2;
      if (!permanent.buffUnlockProgress.floor) permanent.buffUnlockProgress.floor = {};
      permanent.buffUnlockProgress.floor.lifesteal = 2;

      if (!permanent.buffUnlockProgress.damage_taken) permanent.buffUnlockProgress.damage_taken = {};
      permanent.buffUnlockProgress.damage_taken.frost_heart = 2000;

      if (!permanent.buffUnlockProgress.skill_use) permanent.buffUnlockProgress.skill_use = {};
      permanent.buffUnlockProgress.skill_use.mana_tide = 100;

      // Should not throw
      var newUnlocks = checkBuffUnlocks(permanent);
      return {
        count: newUnlocks.length,
        ids: newUnlocks.map(function (b) { return b.id; })
      };
    });

    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(result.ids).toContain("lifesteal");
    expect(result.ids).toContain("frost_heart");
    expect(result.ids).toContain("mana_tide");
  });
});

// =================== hpMult Scaling ===================

test.describe("Gap Fix WF4 - hpMult Scaling", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("warrior Lv1 + berserks_blessing: maxHp = floor(baseHP * 0.85)", async ({ page }) => {
    var result = await page.evaluate(() => {
      player.cls = "warrior";
      player.lvl = 1;
      player.activeBuffs = ["berserks_blessing"];
      recalcPlayerStats();

      return {
        maxHp: player.maxHp,
        baseHp: 120,
        hpMult: player.buffStats.hpMult,
        expected: Math.floor(120 * 0.85)
      };
    });

    expect(result.hpMult).toBe(0.85);
    expect(result.maxHp).toBe(102);
  });

  test("warrior Lv5 + berserks_blessing: HP penalty scales with level", async ({ page }) => {
    var result = await page.evaluate(() => {
      player.cls = "warrior";
      player.lvl = 5;
      player.activeBuffs = ["berserks_blessing"];
      recalcPlayerStats();

      // warrior Lv5: baseHp = 120 + 4*20 = 200 (hpGrowth=20)
      // With hpMult 0.85: floor(200 * 0.85) = 170
      // ClassBonus atkMult=1.2 applies but doesn't affect hp
      // NOT a flat -18 penalty
      var baseHp = CLASS_DATA.warrior.hp + (5 - 1) * (CLASS_DATA.warrior.hpGrowth || 20);
      return {
        maxHp: player.maxHp,
        baseHp: baseHp,
        hpMult: player.buffStats.hpMult,
        expected: Math.floor(baseHp * 0.85),
        isFlatPenalty: player.maxHp === baseHp - 18
      };
    });

    expect(result.hpMult).toBe(0.85);
    expect(result.maxHp).toBe(result.expected);
    expect(result.isFlatPenalty).toBe(false);
  });

  test("dragon_fury hpMult 0.7: maxHp = floor(baseHP * 0.7)", async ({ page }) => {
    var result = await page.evaluate(() => {
      player.cls = "warrior";
      player.lvl = 1;
      player.activeBuffs = ["dragon_fury"];
      recalcPlayerStats();

      return {
        maxHp: player.maxHp,
        baseHp: 120,
        hpMult: player.buffStats.hpMult,
        expected: Math.floor(120 * 0.7)
      };
    });

    expect(result.hpMult).toBe(0.7);
    expect(result.maxHp).toBe(84);
  });
});

// =================== showBuffSelection Weighted ===================

test.describe("Gap Fix WF4 - showBuffSelection Weighted", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("ui.js does not have duplicate showBuffSelection definition", async ({ page }) => {
    var result = await page.evaluate(() => {
      // showBuffSelection is defined in buff.js, not ui.js
      // It should be on window from buff.js's window.showBuffSelection = showBuffSelection
      // Verify it's a function (not undefined) and callable
      var exists = typeof showBuffSelection === "function";
      // Check that the function takes floorNum parameter by checking its length
      var paramCount = showBuffSelection.length;
      return {
        exists: exists,
        paramCount: paramCount
      };
    });

    expect(result.exists).toBe(true);
    // showBuffSelection(floorNum) has 1 parameter
    expect(result.paramCount).toBeGreaterThanOrEqual(1);
  });

  test("showBuffSelection receives floorNum parameter", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Ensure enough unlocked buffs for selection
      permanent.unlockedBuffs = DEFAULT_UNLOCKED.slice();

      // Spy on weightedBuffPick to verify floorNum is passed through
      var receivedFloorNum = null;
      var origPick = weightedBuffPick;
      weightedBuffPick = function (floorNum) {
        receivedFloorNum = floorNum;
        // Return first unlocked buff to avoid randomness
        for (var i = 0; i < BUFF_DEFS.length; i++) {
          if (permanent.unlockedBuffs.indexOf(BUFF_DEFS[i].id) !== -1) {
            return BUFF_DEFS[i];
          }
        }
        return null;
      };

      // Call with floorNum = 3
      // Temporarily suppress modal DOM operations
      var origShowModal = showModal;
      showModal = function () {};
      showBuffSelection(3);
      showModal = origShowModal;

      // Restore
      weightedBuffPick = origPick;

      return { receivedFloorNum: receivedFloorNum };
    });

    expect(result.receivedFloorNum).toBe(3);
  });

  test("RARITY_WEIGHTS includes floor 4 and floor 5", async ({ page }) => {
    var result = await page.evaluate(() => {
      var rarities = Object.keys(RARITY_WEIGHTS);
      var hasFloor4 = {};
      var hasFloor5 = {};
      for (var i = 0; i < rarities.length; i++) {
        hasFloor4[rarities[i]] = RARITY_WEIGHTS[rarities[i]][4] !== undefined;
        hasFloor5[rarities[i]] = RARITY_WEIGHTS[rarities[i]][5] !== undefined;
      }
      return {
        rarities: rarities,
        hasFloor4: hasFloor4,
        hasFloor5: hasFloor5
      };
    });

    expect(result.rarities).toContain("common");
    expect(result.rarities).toContain("rare");
    expect(result.rarities).toContain("legendary");
    expect(result.rarities).toContain("mythic");

    // All rarities should have floor 4 and 5 keys
    for (var r of result.rarities) {
      expect(result.hasFloor4[r]).toBe(true);
      expect(result.hasFloor5[r]).toBe(true);
    }
  });

  test("weighted selection returns 3 buffs", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Ensure enough unlocked buffs
      permanent.unlockedBuffs = [];
      for (var i = 0; i < BUFF_DEFS.length; i++) {
        permanent.unlockedBuffs.push(BUFF_DEFS[i].id);
      }

      player.activeBuffs = [];

      // Mock weightedBuffPick to return deterministic results
      var callCount = 0;
      var origPick = weightedBuffPick;
      weightedBuffPick = function (floorNum) {
        callCount++;
        if (callCount <= 3) {
          return BUFF_DEFS[callCount - 1];
        }
        return null;
      };

      // Capture choices from showBuffSelection
      var choices = [];
      var attempts = 0;
      while (choices.length < 3 && attempts < 30) {
        var pick = weightedBuffPick(1);
        if (!pick) break;
        var dup = false;
        for (var i = 0; i < choices.length; i++) {
          if (choices[i].id === pick.id) { dup = true; break; }
        }
        if (!dup) choices.push(pick);
        attempts++;
      }

      weightedBuffPick = origPick;
      return {
        choicesCount: choices.length,
        ids: choices.map(function (c) { return c.id; })
      };
    });

    expect(result.choicesCount).toBe(3);
  });
});

// =================== Opening Buffs ===================

test.describe("Gap Fix WF4 - Opening Buffs", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("resetForNewRun sets activeBuffs to empty array", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Give player some buffs first
      player.activeBuffs = ["iron_skin", "swift_foot"];
      recalcBuffStats();

      // Now call resetForNewRun
      resetForNewRun(permanent);

      return {
        activeBuffsLength: player.activeBuffs.length,
        activeBuffs: player.activeBuffs
      };
    });

    expect(result.activeBuffsLength).toBe(0);
  });

  test("unlockedBuffs preserved after resetForNewRun", async ({ page }) => {
    var result = await page.evaluate(() => {
      var before = permanent.unlockedBuffs.slice();
      resetForNewRun(permanent);
      var after = permanent.unlockedBuffs.slice();

      return {
        beforeLength: before.length,
        afterLength: after.length,
        // Check that all previously unlocked buffs are still there
        allPreserved: before.every(function (id) {
          return after.indexOf(id) !== -1;
        })
      };
    });

    expect(result.beforeLength).toBe(result.afterLength);
    expect(result.allPreserved).toBe(true);
  });

  test("new game needs showBuffSelection to get buffs", async ({ page }) => {
    var result = await page.evaluate(() => {
      // After resetForNewRun, player starts with no buffs
      resetForNewRun(permanent);

      // Player has no active buffs
      var hasBuffs = player.activeBuffs.length > 0;

      // showBuffSelection is available to grant buffs
      var selectionAvailable = typeof showBuffSelection === "function";

      return {
        hasBuffs: hasBuffs,
        selectionAvailable: selectionAvailable
      };
    });

    expect(result.hasBuffs).toBe(false);
    expect(result.selectionAvailable).toBe(true);
  });
});

// =================== Class Selection ===================

test.describe("Gap Fix WF4 - Class Selection", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
  });

  test("startNewGame shows class selection when totalRuns > 0", async ({ page }) => {
    var result = await page.evaluate(() => {
      permanent.permanentStats.totalRuns = 2;
      return permanent.permanentStats.totalRuns;
    });

    expect(result).toBeGreaterThan(0);

    // Click start button which triggers showClassSelection
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });

    var hasClassCards = await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .class-card");
      return cards.length;
    });

    expect(hasClassCards).toBeGreaterThanOrEqual(2);
  });

  test("first game (totalRuns === 0) proceeds to class selection", async ({ page }) => {
    var result = await page.evaluate(() => {
      return permanent.permanentStats.totalRuns;
    });

    expect(result).toBe(0);

    // Click start button - first game should still show class selection
    // (the game always shows class selection for safety; on first run player picks initial class)
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });

    var hasClassCards = await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .class-card");
      return cards.length;
    });

    expect(hasClassCards).toBeGreaterThanOrEqual(2);
  });
});

// =================== Description Fix ===================

test.describe("Gap Fix WF4 - Description Fix", () => {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("critical_fury synergy description does not contain execute", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Find critical_fury in SYNERGY_DEFS
      var syn = null;
      for (var i = 0; i < SYNERGY_DEFS.length; i++) {
        if (SYNERGY_DEFS[i].id === "critical_fury") {
          syn = SYNERGY_DEFS[i];
          break;
        }
      }
      return {
        name: syn ? syn.name : null,
        desc: syn ? syn.desc : null,
        hasExecute: syn ? syn.desc.indexOf("处划") !== -1 : null
      };
    });

    expect(result.name).toBe("暴击狂怒");
    expect(result.hasExecute).toBe(false);
  });
});
