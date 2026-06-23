import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Navigate to the title screen and wait for .start-btn.
 * Resets permanent to a clean object so talent bonuses don't affect stats.
 */
async function goToTitle(page) {
  await page.goto(HTML);
  await page.waitForSelector(".start-btn", { timeout: 10000 });
  // Reset permanent state to avoid talent/buff bonuses from other tests affecting stats
  await page.evaluate(() => {
    permanent.talents = { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
    permanent.unlockedBuffs = [];
    permanent.relic = null;
    permanent.soulShards = 0;
  });
}

/**
 * Click "选择职业" and then click the class card for the given class.
 * Waits until gameState.screen === "dungeon".
 * @param {'warrior'|'mage'|'rogue'} cls
 */
async function startGameWithClass(page, cls) {
  await goToTitle(page);

  // Click the "选择职业" button (first .start-btn)
  await page.click(".start-btn");
  await page.waitForTimeout(300);

  // Wait for class cards to appear inside the modal
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });

  // Click the class card that corresponds to the given class id
  // Cards are rendered in order: warrior (index 0), mage (index 1), rogue (index 2)
  const classOrder = { warrior: 0, mage: 1, rogue: 2 };
  const idx = classOrder[cls];
  await page.evaluate((i) => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[i]) cards[i].click();
  }, idx);

  // Wait for dungeon to load
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon"
  );
  await page.waitForTimeout(500);
}

/**
 * Enter combat with the first living enemy.
 * Regenerates the floor if no living enemies exist.
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
    // Regenerate floor
    await page.evaluate(() => {
      dungeon = generateFloor(1);
      if (dungeon) {
        player.x = dungeon.playerStart.x;
        player.y = dungeon.playerStart.y;
      }
    });
  }

  const idx2 = await page.evaluate(() => {
    for (let i = 0; i < dungeon.enemies.length; i++) {
      if (dungeon.enemies[i] && dungeon.enemies[i].hp > 0) return i;
    }
    return -1;
  });

  expect(idx2, "no living enemy found").toBeGreaterThanOrEqual(0);

  await page.evaluate((i) => startCombat(i), idx2);
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "combat"
  );
  await page.waitForTimeout(300);
}

// ============================================================
// Test 1: Title screen shows "选择职业" button instead of "开始冒险"
// ============================================================

test.describe("class selection - title screen", () => {
  test.beforeEach(async ({ page }) => {
    await goToTitle(page);
  });

  test("title screen shows '选择职业' button", async ({ page }) => {
    const btnText = await page.locator(".start-btn").first().innerText();
    expect(btnText).toBe("选择职业");
  });

  test("title screen does NOT show '开始冒险'", async ({ page }) => {
    const btnText = await page.locator(".start-btn").first().innerText();
    expect(btnText).not.toBe("开始冒险");
  });
});

// ============================================================
// Test 2: Click "选择职业" shows 3 class cards
// ============================================================

test.describe("class selection - class cards", () => {
  test.beforeEach(async ({ page }) => {
    await goToTitle(page);
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
  });

  test("clicking '选择职业' shows 3 class cards", async ({ page }) => {
    const count = await page.locator("#modal-overlay .class-card").count();
    expect(count).toBe(3);
  });

  test("class cards contain warrior, mage, rogue labels", async ({ page }) => {
    const texts = await page.locator("#modal-overlay .class-card").allTextContents();
    const allText = texts.join(" ");
    expect(allText).toContain("战士");
    expect(allText).toContain("法师");
    expect(allText).toContain("游侠");
  });
});

// ============================================================
// Test 3: Select warrior -> player.cls === "warrior"
// ============================================================

test.describe("class selection - pick warrior", () => {
  test("selecting warrior sets player.cls to 'warrior' and enters dungeon", async ({ page }) => {
    await startGameWithClass(page, "warrior");

    const cls = await page.evaluate(() => player.cls);
    expect(cls).toBe("warrior");

    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("dungeon");
  });
});

// ============================================================
// Test 4: Select mage -> stats match mage baseline (HP 80, MP 45, ATK 15)
// ============================================================

test.describe("class selection - pick mage", () => {
  test("selecting mage sets class and stats to mage baseline", async ({ page }) => {
    await startGameWithClass(page, "mage");

    const stats = await page.evaluate(() => {
      const cd = CLASS_DATA.mage;
      const calc = calcClassStats(player.lvl, "mage");
      return {
        cls: player.cls,
        hp: player.hp,
        maxHp: player.maxHp,
        mp: player.mp,
        maxMp: player.maxMp,
        baseAtk: player.baseAtk,
        // CLASS_DATA base values for reference
        cdHp: cd.hp,
        cdMp: cd.mp,
        cdAtk: cd.atk,
        // calcClassStats expected values (includes level growth)
        calcMaxHp: calc.maxHp,
        calcMaxMp: calc.maxMp,
        calcAtk: calc.baseAtk,
      };
    });

    expect(stats.cls).toBe("mage");
    // max stats match calcClassStats (level growth included)
    expect(stats.maxHp).toBe(stats.calcMaxHp);
    expect(stats.maxMp).toBe(stats.calcMaxMp);
    expect(stats.baseAtk).toBe(stats.calcAtk);
    // current hp/mp are at CLASS_DATA base values (80/45)
    expect(stats.hp).toBe(stats.cdHp);
    expect(stats.mp).toBe(stats.cdMp);
    // Verify CLASS_DATA base values
    expect(stats.cdHp).toBe(80);
    expect(stats.cdMp).toBe(45);
    expect(stats.cdAtk).toBe(15);
  });
});

// ============================================================
// Test 5: Select rogue -> SPD 16, CRIT 20
// ============================================================

test.describe("class selection - pick rogue", () => {
  test("selecting rogue sets class and rogue baseline stats", async ({ page }) => {
    await startGameWithClass(page, "rogue");

    const stats = await page.evaluate(() => {
      const cd = CLASS_DATA.rogue;
      const calc = calcClassStats(player.lvl, "rogue");
      return {
        cls: player.cls,
        baseSpd: player.baseSpd,
        crit: player.crit,
        // CLASS_DATA base values for reference
        cdSpd: cd.spd,
        cdCrit: cd.crit,
        // calcClassStats expected values
        calcSpd: calc.baseSpd,
      };
    });

    expect(stats.cls).toBe("rogue");
    // Player SPD matches calcClassStats which includes level growth
    expect(stats.baseSpd).toBe(stats.calcSpd);
    // Crit uses CLASS_DATA base (no level growth for rogue crit at lvl 1)
    expect(stats.crit).toBe(stats.cdCrit);
    // Verify CLASS_DATA base values used
    expect(stats.cdSpd).toBe(16);
    expect(stats.cdCrit).toBe(20);
  });
});

// ============================================================
// Test 6: Different classes have different skills in combat
// ============================================================

test.describe("class selection - class-specific skills", () => {
  test("mage has 火球术 and 奥术穿透 skills in combat", async ({ page }) => {
    await startGameWithClass(page, "mage");
    await enterCombat(page);

    // Wait for skill buttons to render
    await page.waitForSelector(".btn-skill", { state: "visible", timeout: 5000 });

    // Get text content of all skill buttons
    const skillTexts = await page.locator(".skill-btns .btn-skill").allTextContents();
    const allSkills = skillTexts.join(" ");
    expect(allSkills).toContain("火球术");
    expect(allSkills).toContain("奥术穿透");

    // Should NOT have warrior skills
    expect(allSkills).not.toContain("重击");
    expect(allSkills).not.toContain("连斩");
  });

  test("rogue has 背刺 and 毒药匕首 skills in combat", async ({ page }) => {
    await startGameWithClass(page, "rogue");
    await enterCombat(page);

    await page.waitForSelector(".btn-skill", { state: "visible", timeout: 5000 });

    const skillTexts = await page.locator(".skill-btns .btn-skill").allTextContents();
    const allSkills = skillTexts.join(" ");
    expect(allSkills).toContain("背刺");
    expect(allSkills).toContain("毒药匕首");

    // Should NOT have mage skills
    expect(allSkills).not.toContain("火球术");
    expect(allSkills).not.toContain("奥术穿透");
  });
});

// ============================================================
// Test 7: Mage passive burn - attack has chance to apply burn DOT
// ============================================================

test.describe("class selection - mage passive burn", () => {
  test("mage attack can apply burn DOT to enemy", async ({ page }) => {
    await startGameWithClass(page, "mage");
    await enterCombat(page);

    // Mage passive: 20% chance on attack to set enemy.burning > 0
    // We call applyClassPassiveOnAttack directly multiple times to observe burn
    // (avoiding randomness issue with doAttack + UI)
    const result = await page.evaluate(() => {
      // Ensure enemy is alive for passive to apply
      if (!combatState || !combatState.enemy || combatState.enemy.hp <= 0) return null;
      combatState.enemy.hp = 999; // Ensure enemy stays alive

      let burnTriggered = false;
      for (let i = 0; i < 50; i++) {
        combatState.enemy.burning = 0;
        combatState.enemy.burnDamage = 0;
        applyClassPassiveOnAttack();
        if (combatState.enemy.burning > 0) {
          burnTriggered = true;
          break;
        }
      }
      return {
        burnTriggered,
        burningTurns: combatState.enemy.burning,
        burnDamage: combatState.enemy.burnDamage,
      };
    });

    expect(result, "combat state not available").toBeTruthy();
    expect(result.burnTriggered).toBe(true);
    expect(result.burningTurns).toBeGreaterThan(0);
    expect(result.burnDamage).toBeGreaterThan(0);
  });
});

// ============================================================
// Test 8: Rogue first-strike guaranteed crit (crit = 100%)
// ============================================================

test.describe("class selection - rogue first-strike crit", () => {
  test("rogue getClassAdjustedCrit returns 100 when first strike", async ({ page }) => {
    await startGameWithClass(page, "rogue");
    await enterCombat(page);

    // Make rogue faster than the enemy to ensure first strike
    const result = await page.evaluate(() => {
      // Ensure enemy has lower spd so rogue is first strike
      combatState.enemy.spd = 1; // rogue spd >= 16, so isFirstStrike = true

      var crit = getClassAdjustedCrit();
      var isFst = isFirstStrike();
      return { crit, isFst };
    });

    expect(result.isFst).toBe(true);
    expect(result.crit).toBe(100);
  });

  test("rogue getClassAdjustedCrit returns normal crit when NOT first strike", async ({ page }) => {
    await startGameWithClass(page, "rogue");
    await enterCombat(page);

    // Make enemy faster so rogue does NOT get first strike
    const result = await page.evaluate(() => {
      combatState.enemy.spd = 999; // rogue spd < 999, isFirstStrike = false
      var crit = getClassAdjustedCrit();
      var isFst = isFirstStrike();
      var baseCrit = getPlayerCrit();
      return { crit, isFst, baseCrit };
    });

    expect(result.isFst).toBe(false);
    expect(result.crit).toBe(result.baseCrit);
    expect(result.crit).not.toBe(100);
  });
});
