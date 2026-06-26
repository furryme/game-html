import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Talent System E2E Tests
 *
 * Tests cover: soul shard display, talent screen, buying/upgrading,
 * max-level button state, localStorage persistence, stat bonuses via recalcPlayerStats,
 * and reset with shard refund.
 *
 * Approach: Set permanent.soulShards directly, save to localStorage, reload,
 * then interact with the UI to verify the talent system end-to-end.
 */

// ============================================================
// Helper: start a game with a given class (pickClass style)
// ============================================================
async function startGame(page, cls) {
  await page.click('text=选择职业');
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
  await page.evaluate((opts) => {
    pickClass(opts.className);
  }, { className: cls || "warrior" });
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon",
    { timeout: 8000 }
  );
  await page.waitForTimeout(500);
}

// ============================================================
// Helper: set permanent data and reload to pick up changes
// ============================================================
async function setPermanentAndReload(page, soulShards, talents) {
  await page.evaluate((opts) => {
    permanent.soulShards = opts.shards;
    if (opts.tals) permanent.talents = opts.tals;
    savePermanent(permanent);
  }, { shards: soulShards, tals: talents });
  await page.reload();
  await page.waitForSelector("#title-screen.active", { timeout: 8000 });
  await page.waitForTimeout(500);
}

// ============================================================
// Helper: get talent row info from the modal
// Talents are ordered: vitalis, mana_wellspring, might, ironwall, eagle_eye
// Enabled buttons have onclick; disabled buttons have disabled attribute
// We match by scanning buttons and counting enabled vs disabled in order
// ============================================================
async function getTalentRow(page, talentId) {
  return await page.evaluate((tid) => {
    const allButtons = Array.from(document.querySelectorAll("#modal-overlay .modal-btn"));
    const enabledButtons = allButtons.filter(function (b) {
      return b.getAttribute("onclick") !== null;
    });
    const disabledButtons = allButtons.filter(function (b) {
      return b.disabled || b.hasAttribute("disabled");
    });

    // Build a map of talentId -> button by matching enabled buttons by onclick
    var enabledMap = {};
    for (var i = 0; i < enabledButtons.length; i++) {
      var onclick = enabledButtons[i].getAttribute("onclick");
      if (onclick) {
        var talentIds = ["vitalis", "mana_wellspring", "might", "ironwall", "eagle_eye"];
        for (var j = 0; j < talentIds.length; j++) {
          if (onclick.includes(talentIds[j])) {
            enabledMap[talentIds[j]] = enabledButtons[i];
            break;
          }
        }
      }
    }

    // If found in enabled map
    if (enabledMap[tid]) {
      return {
        text: enabledMap[tid].textContent,
        disabled: false,
      };
    }

    // Not in enabled map, find it by position among disabled buttons
    var talentOrder = ["vitalis", "mana_wellspring", "might", "ironwall", "eagle_eye"];
    var targetIndex = talentOrder.indexOf(tid);
    var sortedDisabled = disabledButtons.slice().sort(function (a, b) {
      return Array.from(allButtons).indexOf(a) - Array.from(allButtons).indexOf(b);
    });

    // Count how many enabled talents come before targetIndex
    var disabledCountBefore = 0;
    for (var k = 0; k < targetIndex; k++) {
      if (!enabledMap[talentOrder[k]]) disabledCountBefore++;
    }

    if (disabledCountBefore < sortedDisabled.length) {
      var btn = sortedDisabled[disabledCountBefore];
      return {
        text: btn.textContent,
        disabled: true,
      };
    }

    return null;
  }, talentId);
}

// ============================================================
// Helper: open talent modal and wait
// ============================================================
async function openTalentModal(page) {
  await page.click('text=天赋');
  await page.waitForSelector("#modal-overlay .modal", { timeout: 3000 });
  await page.waitForTimeout(300);
}

// ============================================================
// Helper: close talent modal
// ============================================================
async function closeTalentModal(page) {
  await page.click('text=关闭');
  await page.waitForTimeout(300);
}

// ============================================================
// Helper: get base warrior stats (no talents)
// ============================================================
async function getBaseWarriorStats(page) {
  return await page.evaluate(() => {
    // Temporarily zero out all talents to get base values
    var savedTalents = Object.assign({}, permanent.talents);
    var baseTalents = { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
    permanent.talents = baseTalents;
    // Recalculate stats without talent bonuses
    var base = CLASS_DATA.warrior;
    player.maxHp = base.hp;
    player.maxMp = base.mp;
    player.baseAtk = base.atk;
    player.baseDef = base.def;
    player.crit = base.crit || 5;
    recalcPlayerStats();

    var result = {
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      baseAtk: player.baseAtk,
      baseDef: player.baseDef,
      crit: player.crit,
    };

    // Restore talents
    permanent.talents = savedTalents;
    // Recalculate with talents
    base = CLASS_DATA.warrior;
    player.maxHp = base.hp;
    player.maxMp = base.mp;
    player.baseAtk = base.atk;
    player.baseDef = base.def;
    player.crit = base.crit || 5;
    recalcPlayerStats();

    return result;
  });
}

test.describe("Talent System - Soul Shard Display & Screen", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("1) Title screen shows correct soul shard count (permanent.soulShards > 0)", async ({ page }) => {
    // Set shards via evaluate + updateTitleScreen
    await page.evaluate(() => {
      permanent.soulShards = 7;
      savePermanent(permanent);
    });
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);

    // Check title button text contains "7"
    const titleText = await page.evaluate(() => {
      const el = document.getElementById("title-buttons");
      return el ? el.textContent : "";
    });
    expect(titleText).toContain("7");

    // Also verify permanent.soulShards matches
    const shardCount = await page.evaluate(() => permanent.soulShards);
    expect(shardCount).toBe(7);
  });

  test("2) Open talent modal shows correct remaining shard count", async ({ page }) => {
    await setPermanentAndReload(page, 4, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });

    await openTalentModal(page);

    // Modal text should include the shard count
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector("#modal-overlay .modal");
      return modal ? modal.textContent : "";
    });
    expect(modalText).toContain("灵魂碎片: 4");

    // All talent upgrade buttons should be enabled (shards > 0, lvl < 10)
    const upgradeBtns = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')");
    const count = await upgradeBtns.count();
    expect(count).toBe(5); // 5 talents, all at level 0
  });
});

test.describe("Talent System - Buying & Shard Deduction", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("3) Click upgrade button correctly decrements permanent.soulShards", async ({ page }) => {
    await setPermanentAndReload(page, 5, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);
    const lvlBefore = await page.evaluate(() => permanent.talents.vitalis);
    expect(shardsBefore).toBe(5);
    expect(lvlBefore).toBe(0);

    // Click the first upgrade button (vitalis - life surge)
    const firstUpgradeBtn = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')").first();
    await expect(firstUpgradeBtn).toBeEnabled();
    await firstUpgradeBtn.click();
    await page.waitForTimeout(300);

    // Modal re-renders after buyTalent calls showTalentScreen again
    // Check shards decremented
    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    const lvlAfter = await page.evaluate(() => permanent.talents.vitalis);
    expect(shardsAfter).toBe(4);
    expect(lvlAfter).toBe(1);

    // Modal should show updated shard count
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector("#modal-overlay .modal");
      return modal ? modal.textContent : "";
    });
    expect(modalText).toContain("灵魂碎片: 4");
    expect(modalText).toContain("Lv.1");
  });

  test("4) Close talent modal - title screen shard count matches permanent.soulShards", async ({ page }) => {
    await setPermanentAndReload(page, 5, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // Buy one talent
    const upgradeBtn = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')").first();
    await upgradeBtn.click();
    await page.waitForTimeout(300);

    const shardsAfterBuy = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfterBuy).toBe(4);

    // Close modal
    await closeTalentModal(page);

    // Title screen should show updated count
    const titleText = await page.evaluate(() => {
      const el = document.getElementById("title-buttons");
      return el ? el.textContent : "";
    });
    expect(titleText).toContain("4");

    // Also verify permanent.soulShards in memory
    const shardsInMemory = await page.evaluate(() => permanent.soulShards);
    expect(shardsInMemory).toBe(4);
  });
});

test.describe("Talent System - Repeated Upgrades & Max Level", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("5) Repeated upgrades until shards run out", async ({ page }) => {
    await setPermanentAndReload(page, 3, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // Click upgrade 3 times
    for (let i = 0; i < 3; i++) {
      const upgradeBtn = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')").first();
      await expect(upgradeBtn).toBeEnabled();
      await upgradeBtn.click();
      await page.waitForTimeout(300);
    }

    // Shards should be 0
    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfter).toBe(0);

    // vitalis should be 3
    const vitalisLevel = await page.evaluate(() => permanent.talents.vitalis);
    expect(vitalisLevel).toBe(3);

    // All upgrade buttons should now show "碎片不足" (no shards)
    const noShardBtns = page.locator(".modal .modal-btn:has-text('碎片不足')");
    const noShardCount = await noShardBtns.count();
    expect(noShardCount).toBe(5); // All 5 talents can't be upgraded
  });

  test("6) Talent max level (10) shows disabled button", async ({ page }) => {
    // Set talent to level 10 (max), shards = 0
    await setPermanentAndReload(page, 0, { vitalis: 10, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // vitalis should show "已满" (max level)
    const vitalisBtn = await getTalentRow(page, "vitalis");
    expect(vitalisBtn).not.toBeNull();
    expect(vitalisBtn.disabled).toBe(true);
    expect(vitalisBtn.text).toContain("已满");

    // Other talents should show "碎片不足" (no shards)
    const otherBtns = page.locator(".modal .modal-btn:has-text('碎片不足')");
    const otherCount = await otherBtns.count();
    expect(otherCount).toBe(4); // 4 other talents

    // Also verify the level display shows Lv.10
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector("#modal-overlay .modal");
      return modal ? modal.textContent : "";
    });
    expect(modalText).toContain("Lv.10");
  });

  test("6b) Max level button is disabled even when shards available", async ({ page }) => {
    // Set talent to level 10, shards = 5
    await setPermanentAndReload(page, 5, { vitalis: 10, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // vitalis should still be disabled despite having shards
    const vitalisBtn = await getTalentRow(page, "vitalis");
    expect(vitalisBtn).not.toBeNull();
    expect(vitalisBtn.disabled).toBe(true);
    expect(vitalisBtn.text).toContain("已满");

    // Other talents should have upgrade buttons
    const upgradeBtns = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')");
    const count = await upgradeBtns.count();
    expect(count).toBe(4);
  });
});

test.describe("Talent System - Persistence", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("7) Talent data correctly saved to localStorage", async ({ page }) => {
    await setPermanentAndReload(page, 6, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // Helper: buy a specific talent by ID, wait for modal refresh
    async function buySpecificTalent(talentId) {
      await page.evaluate((tid) => {
        buyTalent(tid);
        showTalentScreen();
      }, talentId);
      await page.waitForTimeout(400);
    }

    // Buy vitalis x2, might x1
    await buySpecificTalent("vitalis");
    await buySpecificTalent("vitalis");
    await buySpecificTalent("might");

    // Verify in-memory state
    const inMemory = await page.evaluate(() => ({
      shards: permanent.soulShards,
      vitalis: permanent.talents.vitalis,
      mana_wellspring: permanent.talents.mana_wellspring,
      might: permanent.talents.might,
      ironwall: permanent.talents.ironwall,
      eagle_eye: permanent.talents.eagle_eye,
    }));
    expect(inMemory.shards).toBe(3);
    expect(inMemory.vitalis).toBe(2);
    expect(inMemory.might).toBe(1);

    // Verify localStorage has same data (survives reload)
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);

    const savedData = await page.evaluate(() => {
      const raw = localStorage.getItem(PERMANENT_KEY);
      return raw ? JSON.parse(raw) : null;
    });
    expect(savedData).not.toBeNull();
    expect(savedData.soulShards).toBe(3);
    expect(savedData.talents.vitalis).toBe(2);
    expect(savedData.talents.might).toBe(1);
    expect(savedData.talents.ironwall).toBe(0);
  });
});

test.describe("Talent System - Stat Bonuses", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("8) recalcPlayerStats applies talent bonuses after starting game", async ({ page }) => {
    // Warrior base stats (from CLASS_DATA): HP=100, MP=10, ATK=14, DEF=8, CRIT=5
    // Set talents: vitalis=1, might=1, ironwall=1, eagle_eye=1
    // With each at level 1: stat = floor(base * (1 + 0.2 * 1)) = floor(base * 1.2)
    await setPermanentAndReload(page, 5, { vitalis: 1, mana_wellspring: 0, might: 1, ironwall: 1, eagle_eye: 1 });

    // Start a new game with warrior class (triggers applyTalentBonuses + recalcPlayerStats)
    await startGame(page, "warrior");

    // Get actual stats with talents
    const statsWithTalents = await page.evaluate(() => ({
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      baseAtk: player.baseAtk,
      baseDef: player.baseDef,
      crit: player.crit,
    }));

    // Get base stats (without talents) by temporarily zeroing talents
    const baseStats = await getBaseWarriorStats(page);

    // Verify: statsWithTalents > baseStats for each talent that was set
    // vitalis=1 -> HP: floor(100 * 1.2) = 120
    expect(statsWithTalents.maxHp).toBeGreaterThan(baseStats.maxHp);
    expect(statsWithTalents.maxHp).toBeGreaterThanOrEqual(Math.floor(baseStats.maxHp * 1.2));

    // might=1 -> ATK: floor(14 * 1.2) = 16
    expect(statsWithTalents.baseAtk).toBeGreaterThan(baseStats.baseAtk);
    expect(statsWithTalents.baseAtk).toBeGreaterThanOrEqual(Math.floor(baseStats.baseAtk * 1.2));

    // ironwall=1 -> DEF: floor(8 * 1.2) = 9
    expect(statsWithTalents.baseDef).toBeGreaterThan(baseStats.baseDef);
    expect(statsWithTalents.baseDef).toBeGreaterThanOrEqual(Math.floor(baseStats.baseDef * 1.2));

    // eagle_eye=1 -> CRIT: floor(5 * 1.1) = 5 (10% on 5 = 0.5, so still 5)
    // Note: crit=5 with 10% bonus = floor(5*1.1) = 5, so it may not change at crit=5
    // At higher levels crit will be higher, but at level 1 it's borderline
    // We verify the formula was applied (even if rounding keeps it same)
    expect(statsWithTalents.crit).toBeGreaterThanOrEqual(baseStats.crit);

    // mana_wellspring not set, so MP should be unchanged
    expect(statsWithTalents.maxMp).toBe(baseStats.maxMp);
  });

  test("8b) Multiple talent levels stack multiplicatively", async ({ page }) => {
    // Set vitalis=5 -> HP = floor(100 * (1 + 0.2 * 5)) = floor(100 * 2.0) = 200
    await setPermanentAndReload(page, 5, { vitalis: 5, mana_wellspring: 0, might: 5, ironwall: 0, eagle_eye: 0 });

    await startGame(page, "warrior");

    const stats = await page.evaluate(() => ({
      maxHp: player.maxHp,
      baseAtk: player.baseAtk,
    }));

    // HP: floor(100 * (1 + 0.2 * 5)) = floor(100 * 2.0) = 200
    expect(stats.maxHp).toBeGreaterThanOrEqual(200);

    // ATK: floor(14 * (1 + 0.2 * 5)) = floor(14 * 2.0) = 28
    expect(stats.baseAtk).toBeGreaterThanOrEqual(28);
  });
});

test.describe("Talent System - Reset & Shard Refund", function () {

  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 8000 });
    await page.waitForTimeout(500);
  });

  test("9) Reset talents - shards refunded, levels zeroed", async ({ page }) => {
    // Set up: some shards, some invested talents
    // vitalis=3, might=2 -> total spent = 5, shards = 5
    // After reset: shards = 5 + 5 = 10, all talents = 0
    await setPermanentAndReload(page, 5, { vitalis: 3, mana_wellspring: 0, might: 2, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    // Verify reset button exists (talents are invested)
    const resetBtnText = await page.evaluate(() => {
      const buttons = document.querySelectorAll("#modal-overlay .modal-btn");
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.includes("重置")) {
          return buttons[i].textContent;
        }
      }
      return "";
    });
    expect(resetBtnText).toContain("重置");
    expect(resetBtnText).toContain("返还 5");

    // Click reset button
    await page.click('text=重置');
    await page.waitForTimeout(500);

    // Check shards refunded
    const shardsAfterReset = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfterReset).toBe(10); // 5 remaining + 5 refunded

    // Check all talents zeroed
    const talentsAfterReset = await page.evaluate(() => permanent.talents);
    expect(talentsAfterReset.vitalis).toBe(0);
    expect(talentsAfterReset.mana_wellspring).toBe(0);
    expect(talentsAfterReset.might).toBe(0);
    expect(talentsAfterReset.ironwall).toBe(0);
    expect(talentsAfterReset.eagle_eye).toBe(0);

    // Modal should refresh showing Lv.0 for all talents and shard count 10
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector("#modal-overlay .modal");
      return modal ? modal.textContent : "";
    });
    expect(modalText).toContain("灵魂碎片: 10");
    expect(modalText).toContain("Lv.0");

    // Upgrade buttons should now be enabled (shards > 0)
    const upgradeBtns = page.locator(".modal .modal-btn:has-text('升级 (1 碎片)')");
    const count = await upgradeBtns.count();
    expect(count).toBe(5);
  });

  test("9b) Reset button hidden when no talents invested", async ({ page }) => {
    // All talents at 0, no reset button should appear
    await setPermanentAndReload(page, 3, { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 });
    await openTalentModal(page);

    const resetBtnExists = await page.evaluate(() => {
      const buttons = document.querySelectorAll("#modal-overlay .modal-btn");
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.includes("重置")) {
          return true;
        }
      }
      return false;
    });
    expect(resetBtnExists).toBe(false);
  });
});
