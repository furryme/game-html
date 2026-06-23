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

test.describe("Boss Rules", () => {
  // ---- Test 1: Floor 1 has a boss (moss_giant) in dungeon.enemies ----
  test("floor 1 dungeon has a boss enemy with boss=true", async ({ page }) => {
    await startGame(page);

    const bossInfo = await page.evaluate(() => {
      if (!dungeon || !dungeon.enemies) return null;
      for (let i = 0; i < dungeon.enemies.length; i++) {
        const e = dungeon.enemies[i];
        if (e && e.boss) return { name: e.name, boss: e.boss, hp: e.hp, rules: e.rules };
      }
      return null;
    });

    expect(bossInfo).not.toBeNull();
    expect(bossInfo.boss).toBe(true);
    expect(bossInfo.name).toBe("青苔巨蟒");
    expect(bossInfo.rules.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Test 2: Find boss by index, startCombat(index), verify boss combat state ----
  test("startCombat with boss index enters boss combat with bossRules", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      if (bossIdx < 0) return null;
      startCombat(bossIdx);
      return {
        screen: gameState.screen,
        isBoss: !!combatState.bossRules,
        bossPhase: combatState.bossPhase,
        bossName: combatState.enemy.name,
        bossHp: combatState.enemy.hp,
        bossMaxHp: combatState.enemy.maxHp,
        rulesLen: combatState.bossRules.length,
      };
    });

    expect(result).not.toBeNull();
    expect(result.screen).toBe("combat");
    expect(result.isBoss).toBe(true);
    expect(result.bossPhase).toBeGreaterThanOrEqual(1);
    expect(result.bossName).toBe("青苔巨蟒");
    expect(result.rulesLen).toBeGreaterThanOrEqual(1);
    expect(result.bossHp).toBeGreaterThan(0);
    expect(result.bossMaxHp).toBeGreaterThan(0);
  });

  // ---- Test 3: Attack boss until HP drops below threshold, check rule label appears ----
  test("attacking boss below HP threshold triggers boss rule", async ({ page }) => {
    await startGame(page);

    // Find boss, start combat, then set HP below threshold and tick rules
    const result = await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      startCombat(bossIdx);
      var enemy = combatState.enemy;
      var maxHp = enemy.maxHp || enemy.hp;

      // Moss_giant has one rule at 0.5 threshold (berserk)
      // Set HP to 49% to trigger it
      enemy.hp = Math.floor(maxHp * 0.49);

      // Reset tracking so tickBossRules re-evaluates
      combatState.bossTriggeredRules = [];
      combatState.bossActiveEffects = [];
      combatState.bossPhase = 1;
      enemy._berserkApplied = false;

      // Call tickBossRules to check thresholds
      tickBossRules();

      return {
        phase: combatState.bossPhase,
        activeEffects: combatState.bossActiveEffects,
        triggeredRules: combatState.bossTriggeredRules,
        atkAfter: enemy.atk,
        initialAtk: 18, // moss_giant base atk
      };
    });

    expect(result.phase).toBe(2);
    expect(result.activeEffects).toContain("berserk");
    expect(result.triggeredRules.length).toBeGreaterThanOrEqual(1);
    // Berserk: ATK * 1.5 = 18 * 1.5 = 27
    expect(result.atkAfter).toBeGreaterThan(result.initialAtk);
  });

  // ---- Test 4: Boss phase changes via UI - boss rule label visible in log ----
  test("boss rule log entry appears in #log after phase transition", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      startCombat(bossIdx);
      var enemy = combatState.enemy;
      var maxHp = enemy.maxHp || enemy.hp;
      enemy.hp = Math.floor(maxHp * 0.49);
      combatState.bossTriggeredRules = [];
      combatState.bossActiveEffects = [];
      combatState.bossPhase = 1;
      enemy._berserkApplied = false;
      tickBossRules();
    });

    await page.waitForTimeout(300);

    // Check the log for boss phase text
    const logText = await page.locator("#log").innerText();
    expect(logText).toContain("阶段 2");
    expect(logText).toContain("狂暴");
  });

  // ---- Test 5: Berserk rule doubles ATK but not on second tick ----
  test("tickBossRules does not re-apply berserk on second call", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      startCombat(bossIdx);
      var enemy = combatState.enemy;
      var maxHp = enemy.maxHp || enemy.hp;

      enemy.hp = Math.floor(maxHp * 0.49);
      combatState.bossTriggeredRules = [];
      combatState.bossActiveEffects = [];
      combatState.bossPhase = 1;
      enemy._berserkApplied = false;

      tickBossRules();
      var atkAfterFirst = enemy.atk;
      var phaseAfterFirst = combatState.bossPhase;

      // Second tick - should NOT re-apply
      tickBossRules();
      var atkAfterSecond = enemy.atk;
      var phaseAfterSecond = combatState.bossPhase;

      return {
        atkFirst: atkAfterFirst,
        atkSecond: atkAfterSecond,
        phaseFirst: phaseAfterFirst,
        phaseSecond: phaseAfterSecond,
      };
    });

    expect(result.atkFirst).toBeGreaterThan(0);
    expect(result.atkSecond).toBe(result.atkFirst);
    expect(result.phaseSecond).toBe(result.phaseFirst);
  });

  // ---- Test 6: Click attack button during boss fight, HP decreases ----
  test("clicking .btn-atk during boss combat reduces boss HP", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      startCombat(bossIdx);
    });

    await page.waitForSelector(".btn-atk", { state: "visible" });

    const hpBefore = await page.evaluate(() => combatState.enemy.hp);
    expect(hpBefore).toBeGreaterThan(0);

    await page.click(".btn-atk");
    await page.waitForTimeout(600);

    const hpAfter = await page.evaluate(() => combatState ? combatState.enemy.hp : -1);
    expect(hpAfter).toBeLessThan(hpBefore);
  });

  // ---- Test 7: Boss has combat actions visible with correct display ----
  test("boss combat shows #combat-actions with display:block", async ({ page }) => {
    await startGame(page);

    const display = await page.evaluate(() => {
      var bossIdx = -1;
      for (var i = 0; i < dungeon.enemies.length; i++) {
        if (dungeon.enemies[i] && dungeon.enemies[i].boss) {
          bossIdx = i;
          break;
        }
      }
      startCombat(bossIdx);
      var el = document.getElementById("combat-actions");
      return el ? el.style.display : "none";
    });

    expect(display).toBe("block");
  });
});
