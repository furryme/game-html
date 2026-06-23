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

test.describe("WF2 Gap Fix - Boss Shards, Victory, Talents, Equip Relic, EQUIP_BONUS, permanentStats, Unlocks", () => {

  // ---- Test 1: Boss defeated -> permanent.soulShards increases by 1 ----
  test("boss defeated increases soulShards by 1", async ({ page }) => {
    await startGame(page);
    await enterCombat(page);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);

    // Mark the enemy as a boss and set hp=1 so one attack kills it
    await page.evaluate(() => {
      combatState.enemy.boss = true;
      combatState.enemy.hp = 1;
    });

    // Attack to kill the boss
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfter).toBe(shardsBefore + 1);
  });

  // ---- Test 2: Multiple boss defeats -> shards accumulate ----
  test("multiple boss defeats accumulate soulShards", async ({ page }) => {
    await startGame(page);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);

    // Defeat 3 bosses programmatically
    await page.evaluate(() => {
      // Create a mock boss enemy in dungeon
      dungeon.enemies[0] = {
        name: 'Test Boss',
        hp: 1,
        maxHp: 1,
        atk: 5,
        def: 3,
        spd: 2,
        exp: 50,
        gold: 30,
        boss: true,
        actions: [{ type: 'attack', weight: 100, label: '攻击' }]
      };

      // Start combat with this boss
      startCombat(0);
    });
    await page.waitForFunction(() => window.gameState && window.gameState.screen === "combat");
    await page.waitForTimeout(300);

    // Kill boss #1
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    // Dismiss any modal that appeared after killing boss #1
    await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
        closeModal();
      }
    });
    await page.waitForTimeout(200);

    // Start combat with a new boss (recreate enemy slot)
    await page.evaluate(() => {
      dungeon.enemies[0] = {
        name: 'Test Boss 2',
        hp: 1,
        maxHp: 1,
        atk: 5,
        def: 3,
        spd: 2,
        exp: 50,
        gold: 30,
        boss: true,
        actions: [{ type: 'attack', weight: 100, label: '攻击' }]
      };
      startCombat(0);
    });
    await page.waitForFunction(() => window.gameState && window.gameState.screen === "combat");
    await page.waitForTimeout(300);

    // Dismiss any modal from entering combat
    await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
        closeModal();
      }
    });
    await page.waitForTimeout(200);

    // Kill boss #2
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    // Dismiss any modal that appeared after killing boss #2
    await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
        closeModal();
      }
    });
    await page.waitForTimeout(200);

    // Start combat with a third boss
    await page.evaluate(() => {
      dungeon.enemies[0] = {
        name: 'Test Boss 3',
        hp: 1,
        maxHp: 1,
        atk: 5,
        def: 3,
        spd: 2,
        exp: 50,
        gold: 30,
        boss: true,
        actions: [{ type: 'attack', weight: 100, label: '攻击' }]
      };
      startCombat(0);
    });
    await page.waitForFunction(() => window.gameState && window.gameState.screen === "combat");
    await page.waitForTimeout(300);

    // Dismiss any modal from entering combat
    await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
        closeModal();
      }
    });
    await page.waitForTimeout(200);

    // Kill boss #3
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    expect(shardsAfter).toBe(shardsBefore + 3);
  });

  // ---- Test 3: Victory (onVictory) -> shards +3 ----
  test("onVictory adds 3 soul shards and updates permanentStats", async ({ page }) => {
    await startGame(page);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);
    const winsBefore = await page.evaluate(() => permanent.permanentStats.wins);
    const totalRunsBefore = await page.evaluate(() => permanent.permanentStats.totalRuns);

    // Simulate victory
    await page.evaluate(() => {
      gameState.floor = 5;
      gameState.turnCount = 100;
      onVictory(permanent);
    });
    await page.waitForTimeout(300);

    const shardsAfter = await page.evaluate(() => permanent.soulShards);
    const winsAfter = await page.evaluate(() => permanent.permanentStats.wins);
    const totalRunsAfter = await page.evaluate(() => permanent.permanentStats.totalRuns);

    expect(shardsAfter).toBe(shardsBefore + 3);
    expect(winsAfter).toBe(winsBefore + 1);
    expect(totalRunsAfter).toBe(totalRunsBefore + 1);
  });

  // ---- Test 4: Talent reset -> all talent levels become 0, shards refunded ----
  test("resetTalents sets all talents to 0 and refunds soulShards", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    // Set up talents with known values
    await page.evaluate(() => {
      permanent.soulShards = 2;
      permanent.talents = { vitalis: 3, mana_wellspring: 2, might: 1, ironwall: 0, eagle_eye: 0 };
      savePermanent(permanent);
    });

    // Reload to pick up the saved state
    await page.reload();
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);
    const totalSpent = await page.evaluate(() => {
      var total = 0;
      var keys = Object.keys(permanent.talents);
      for (var i = 0; i < keys.length; i++) total += permanent.talents[keys[i]];
      return total;
    });

    // Call resetTalents
    const refunded = await page.evaluate(() => resetTalents(permanent));

    const result = await page.evaluate(() => {
      return {
        talents: Object.assign({}, permanent.talents),
        shards: permanent.soulShards
      };
    });

    expect(refunded).toBe(totalSpent);
    expect(result.shards).toBe(shardsBefore + totalSpent);
    // All talent levels should be 0
    var keys = Object.keys(result.talents);
    for (var i = 0; i < keys.length; i++) {
      expect(result.talents[keys[i]]).toBe(0);
    }
  });

  // ---- Test 5: Talent reset with no talents -> no-op ----
  test("resetTalents with no talents is a no-op", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    // Set up zero talents
    await page.evaluate(() => {
      permanent.soulShards = 5;
      permanent.talents = { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
      savePermanent(permanent);
    });

    await page.reload();
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    const shardsBefore = await page.evaluate(() => permanent.soulShards);

    const refunded = await page.evaluate(() => resetTalents(permanent));

    const result = await page.evaluate(() => {
      return {
        talents: Object.assign({}, permanent.talents),
        shards: permanent.soulShards
      };
    });

    expect(refunded).toBe(0);
    expect(result.shards).toBe(shardsBefore);
  });

  // ---- Test 6: Equipment relic selection -> permanent.equipRelic saved ----
  test("selectEquipRelic saves equipment to permanent.equipRelic", async ({ page }) => {
    await startGame(page);

    // Set up player equipment
    await page.evaluate(() => {
      player.equip = {
        weapon: { id: 'w1', name: '铁剑', icon: '⚔', rarity: 'blue', identified: true, atk: 5 },
        armor: { id: 'a1', name: '皮甲', icon: '🥂', rarity: 'white', identified: true, def: 3 },
        accessory: null
      };
    });

    // Clear relic to verify it gets overwritten
    await page.evaluate(() => {
      permanent.equipRelic = null;
      savePermanent(permanent);
    });

    // Call selectEquipRelic directly
    await page.evaluate(() => {
      selectEquipRelic();
    });
    await page.waitForTimeout(500);

    const equipRelic = await page.evaluate(() => {
      return permanent.equipRelic;
    });

    expect(equipRelic).not.toBeNull();
    expect(equipRelic.weapon).toBeDefined();
    expect(equipRelic.weapon.name).toBe('铁剑');
    expect(equipRelic.armor).toBeDefined();
    expect(equipRelic.armor.name).toBe('皮甲');
  });

  // ---- Test 7: EQUIP_BONUS: purple weapon + flame_aura -> dotDmg increased ----
  test("EQUIP_BONUS purple weapon with flame_aura increases dotDmg", async ({ page }) => {
    await startGame(page);

    // Set up: flame_aura passive dotDmg=8, purple identified weapon
    await page.evaluate(() => {
      player.activeBuffs = ["flame_aura"];
      player.equip = {
        weapon: { id: 'w_purple', name: '烈焰之剑', icon: '⚔', rarity: 'purple', identified: true, atk: 10 },
        armor: null,
        accessory: null
      };
      recalcBuffStats();
    });

    const dotDmg = await page.evaluate(() => player.buffStats.dotDmg);

    // flame_aura base dotDmg=8, EQUIP_BONUS adds +4 = 12, fire_storm synergy doubles = 24
    expect(dotDmg).toBe(24);
  });

  // ---- Test 8: EQUIP_BONUS: non-purple equipment -> no bonus ----
  test("EQUIP_BONUS non-purple equipment does not grant bonus", async ({ page }) => {
    await startGame(page);

    // Set up: flame_aura with a blue weapon (below purple)
    await page.evaluate(() => {
      player.activeBuffs = ["flame_aura"];
      player.equip = {
        weapon: { id: 'w_blue', name: '铁剑', icon: '⚔', rarity: 'blue', identified: true, atk: 5 },
        armor: null,
        accessory: null
      };
      recalcBuffStats();
    });

    const dotDmg = await page.evaluate(() => player.buffStats.dotDmg);

    // flame_aura base dotDmg=8, no EQUIP_BONUS because blue < purple, but fire_storm synergy still doubles = 16
    expect(dotDmg).toBe(16);
  });

  // ---- Test 9: EQUIP_BONUS: purple armor + iron_skin -> dmgReduction increased ----
  test("EQUIP_BONUS purple armor with iron_skin increases dmgReduction", async ({ page }) => {
    await startGame(page);

    // Set up: iron_skin passive dmgReduction=0.2, purple identified armor
    await page.evaluate(() => {
      player.activeBuffs = ["iron_skin"];
      player.equip = {
        weapon: null,
        armor: { id: 'a_purple', name: '龙鳞甲', icon: '🥂', rarity: 'purple', identified: true, def: 15 },
        accessory: null
      };
      recalcBuffStats();
    });

    const dmgReduction = await page.evaluate(() => player.buffStats.dmgReduction);

    // iron_skin dmgReduction=0.2, EQUIP_BONUS adds 0.15 = 0.35
    expect(dmgReduction).toBeCloseTo(0.35, 4);
  });

  // ---- Test 10: permanentStats includes totalFlees, totalSkillUses, totalDamageTaken ----
  test("defaultPermanentStats includes totalFlees, totalSkillUses, totalDamageTaken", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active");
    await page.waitForTimeout(500);

    const stats = await page.evaluate(() => {
      return defaultPermanentStats();
    });

    expect(stats.totalFlees).toBeDefined();
    expect(stats.totalSkillUses).toBeDefined();
    expect(stats.totalDamageTaken).toBeDefined();
    expect(stats.totalFlees).toBe(0);
    expect(stats.totalSkillUses).toBe(0);
    expect(stats.totalDamageTaken).toBe(0);

    // Also verify that the loaded permanent has these fields
    const permStats = await page.evaluate(() => permanent.permanentStats);
    expect(permStats.totalFlees).toBeDefined();
    expect(permStats.totalSkillUses).toBeDefined();
    expect(permStats.totalDamageTaken).toBeDefined();
  });

  // ---- Test 11: checkBuffUnlocks with new stats -> unlocks resolve correctly ----
  test("checkBuffUnlocks resolves unlocks based on permanentStats including totalFlees", async ({ page }) => {
    await startGame(page);

    // Set permanent stats to trigger flee-based unlock (shadow_step: flee >= 5)
    // and skill_use-based unlock (mana_tide: skill_use >= 100)
    await page.evaluate(() => {
      permanent.permanentStats.totalFlees = 5;
      permanent.permanentStats.totalKills = 30; // flame_aura: kill >= 30
      permanent.permanentStats.skillUse = 100; // not directly checked, use progress instead

      // Set progress for skill_use
      if (!permanent.buffUnlockProgress) permanent.buffUnlockProgress = {};
      if (!permanent.buffUnlockProgress.skill_use) permanent.buffUnlockProgress.skill_use = {};
      permanent.buffUnlockProgress.skill_use.mana_tide = 100;
    });

    // shadow_step and flame_aura should not be in unlockedBuffs initially
    const unlockedBefore = await page.evaluate(() => {
      return Object.assign([], permanent.unlockedBuffs);
    });

    // Run checkBuffUnlocks
    const newUnlocks = await page.evaluate(() => {
      return checkBuffUnlocks(permanent);
    });
    await page.waitForTimeout(300);

    const unlockIds = newUnlocks.map(function(u) { return u.id; });

    // shadow_step requires flee >= 5 (checkBuffUnlocks checks flee type against totalFlees)
    // flame_aura requires kill >= 30 (checkBuffUnlocks checks kill type against totalKills)
    // But note: checkBuffUnlocks uses progress for skill_use and permanentStats for flee/kill
    // The condition check: cond.type === 'flee' && permanent.permanentStats.totalFlees >= cond.value
    // The condition check: cond.type === 'kill' && permanent.permanentStats.totalKills >= cond.value
    // shadow_step (flee, 5) and flame_aura (kill, 30) should unlock
    expect(unlockIds).toContain("shadow_step");
    expect(unlockIds).toContain("flame_aura");
  });

  // ---- Test 12: showUnlockModal -> calls showModal ----
  test("showUnlockModal calls showModal with buff info", async ({ page }) => {
    await startGame(page);

    // Call showUnlockModal with a known buff
    await page.evaluate(() => {
      // Find flame_aura definition from BUFF_DEFS
      var def = null;
      for (var i = 0; i < BUFF_DEFS.length; i++) {
        if (BUFF_DEFS[i].id === "flame_aura") { def = BUFF_DEFS[i]; break; }
      }
      showUnlockModal([def]);
    });
    await page.waitForTimeout(300);

    // Verify modal is visible
    const display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("flex");

    // Verify modal content includes buff name and icon
    const modalText = await page.locator("#modal-overlay .modal").innerText();
    expect(modalText).toContain("烈焰光环");
    expect(modalText).toContain("灼烧");

    // Verify modal has the unlock header text
    expect(modalText).toContain("新 祝 福 解 锁");

    // Verify modal has the "太 棒 了" confirm button
    const hasConfirmBtn = await page.evaluate(() => {
      var btns = document.querySelectorAll("#modal-overlay .modal-btn");
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf("棒") !== -1) return true;
      }
      return false;
    });
    expect(hasConfirmBtn).toBe(true);
  });
});
