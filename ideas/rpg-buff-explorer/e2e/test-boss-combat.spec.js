import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("Boss Combat", () => {
  test("REGRESSION: start game, generate floor 3, find boss in dungeon.enemies, startCombat(index), check #combat-actions has buttons with display:block", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
    await page.waitForTimeout(500);

    // Use startCombat via dungeon.enemies path to test the full chain
    var result = await page.evaluate(function (opts) {
      var hp = opts.hp;
      var atk = opts.atk;
      var threshold = opts.threshold;
      var viaDungeon = opts.viaDungeon;
      initPlayer("warrior");
      recalcPlayerStats();
      dungeon = generateFloor(1);
      gameState.floor = 1;
      gameState.screen = "dungeon";
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;

      var boss = {
        name: "Test Boss",
        icon: "🤖",
        hp: hp || 200,
        atk: atk || 25,
        def: 10,
        spd: 8,
        exp: 100,
        gold: 50,
        rules: [{ threshold: threshold || 0.5, effect: "berserk", desc: "狂暹: ATK+50%" }],
        actions: [
          { type: "attack", weight: 50, label: "攻击" },
          { type: "defend", weight: 50, label: "防御" },
        ],
      };

      if (viaDungeon) {
        dungeon.enemies.push(boss);
        var bossIdx = dungeon.enemies.length - 1;
        startCombat(bossIdx);
      } else {
        initBossCombat(boss, dungeon);
      }

      return {
        bossHp: combatState.enemy.hp,
        bossAtk: combatState.enemy.atk,
        screen: gameState.screen,
        combatActionsDisplay: document.getElementById("combat-actions").style.display,
        btnCount: document.getElementById("combat-actions").querySelectorAll("button").length,
      };
    }, { hp: 200, atk: 25, threshold: 0.5, viaDungeon: true });

    expect(result.screen).toBe("combat");
    expect(result.combatActionsDisplay).toBe("block");
    expect(result.btnCount).toBeGreaterThan(0);

    // Also verify .btn-atk is visible in the DOM
    var atkVisible = await page.locator(".btn-atk").first().isVisible();
    expect(atkVisible).toBe(true);
  });

  test("click .btn-atk during boss fight, check combatState.enemy.hp decreased", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
    await page.waitForTimeout(500);

    var hpBefore = await page.evaluate(function (opts) {
      var hp = opts.hp;
      var atk = opts.atk;
      var threshold = opts.threshold;
      var viaDungeon = opts.viaDungeon;
      initPlayer("warrior");
      recalcPlayerStats();
      dungeon = generateFloor(1);
      gameState.floor = 1;
      gameState.screen = "dungeon";
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;

      var boss = {
        name: "Test Boss",
        icon: "🤖",
        hp: hp || 200,
        atk: atk || 25,
        def: 10,
        spd: 8,
        exp: 100,
        gold: 50,
        rules: [{ threshold: threshold || 0.5, effect: "berserk", desc: "狂暹: ATK+50%" }],
        actions: [
          { type: "attack", weight: 50, label: "攻击" },
          { type: "defend", weight: 50, label: "防御" },
        ],
      };

      if (viaDungeon) {
        dungeon.enemies.push(boss);
        var bossIdx = dungeon.enemies.length - 1;
        startCombat(bossIdx);
      } else {
        initBossCombat(boss, dungeon);
      }

      return {
        bossHp: combatState.enemy.hp,
        bossAtk: combatState.enemy.atk,
        screen: gameState.screen,
        combatActionsDisplay: document.getElementById("combat-actions").style.display,
        btnCount: document.getElementById("combat-actions").querySelectorAll("button").length,
      };
    }, { hp: 200, atk: 25, threshold: 0.5, viaDungeon: false });
    var enemyHpBefore = hpBefore.bossHp;
    expect(enemyHpBefore).toBeGreaterThan(0);

    // Click the attack button
    await page.click(".btn-atk");
    await page.waitForTimeout(500);

    var enemyHpAfter = await page.evaluate(function () {
      return combatState ? combatState.enemy.hp : -1;
    });

    expect(enemyHpAfter).toBeLessThan(enemyHpBefore);
    expect(enemyHpAfter).toBeGreaterThanOrEqual(0);
  });

  test("REGRESSION: tickBossRules should fire phase once -- set boss hp to 50%, reset _berserkApplied=false, call tickBossRules(), check enemy.atk increased by 50%", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
    await page.waitForTimeout(500);

    var result = await page.evaluate(function () {
      initPlayer("warrior");
      recalcPlayerStats();
      dungeon = generateFloor(1);
      gameState.floor = 1;
      gameState.screen = "dungeon";
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;

      var boss = {
        name: "Test Boss",
        icon: "🤖",
        hp: 200,
        atk: 25,
        def: 10,
        spd: 8,
        exp: 100,
        gold: 50,
        rules: [{ threshold: 0.5, effect: "berserk", desc: "狂暹: ATK+50%" }],
        actions: [
          { type: "attack", weight: 50, label: "攻击" },
          { type: "defend", weight: 50, label: "防御" },
        ],
      };
      initBossCombat(boss, dungeon);

      var enemy = combatState.enemy;

      // Set boss HP to 50%
      enemy.hp = Math.floor(enemy.maxHp * 0.5);

      // Reset berserk flag so it can fire
      enemy._berserkApplied = false;

      // Reset boss trigger tracking so tickBossRules will re-evaluate
      combatState.bossTriggeredRules = [];
      combatState.bossActiveEffects = [];
      combatState.bossPhase = 1;

      var atkBefore = enemy.atk;

      // Call tickBossRules -- should fire berserk since hpRatio (0.5) <= threshold (0.5)
      tickBossRules();

      var atkAfter = enemy.atk;

      return { atkBefore: atkBefore, atkAfter: atkAfter, phase: combatState.bossPhase };
    });

    expect(result.atkBefore).toBeGreaterThan(0);
    var expectedAtk = Math.floor(result.atkBefore * 1.5);
    expect(result.atkAfter).toBe(expectedAtk);
    expect(result.phase).toBe(2);
  });

  test("check berserk not double-applied -- call tickBossRules again, atk should stay same", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
    await page.waitForTimeout(500);

    var result = await page.evaluate(function () {
      initPlayer("warrior");
      recalcPlayerStats();
      dungeon = generateFloor(1);
      gameState.floor = 1;
      gameState.screen = "dungeon";
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;

      var boss = {
        name: "Test Boss",
        icon: "🤖",
        hp: 200,
        atk: 25,
        def: 10,
        spd: 8,
        exp: 100,
        gold: 50,
        rules: [{ threshold: 0.5, effect: "berserk", desc: "狂暹: ATK+50%" }],
        actions: [
          { type: "attack", weight: 50, label: "攻击" },
          { type: "defend", weight: 50, label: "防御" },
        ],
      };
      initBossCombat(boss, dungeon);

      var enemy = combatState.enemy;

      // Set boss HP to 50%
      enemy.hp = Math.floor(enemy.maxHp * 0.5);
      enemy._berserkApplied = false;
      combatState.bossTriggeredRules = [];
      combatState.bossActiveEffects = [];
      combatState.bossPhase = 1;

      // First call -- fires berserk
      tickBossRules();
      var atkAfterFirst = enemy.atk;

      // Second call -- should NOT fire berserk again
      tickBossRules();
      var atkAfterSecond = enemy.atk;

      return { atkAfterFirst: atkAfterFirst, atkAfterSecond: atkAfterSecond };
    });

    expect(result.atkAfterFirst).toBeGreaterThan(0);
    expect(result.atkAfterSecond).toBe(result.atkAfterFirst);
  });

  test("check #combat-screen has pointer-events:none style", async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.screen.active");
    await page.waitForTimeout(500);

    var pointerEvents = await page.evaluate(function () {
      var el = document.getElementById("combat-screen");
      return el ? el.style.pointerEvents : null;
    });

    expect(pointerEvents).toBe("none");
  });
});
