import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start game and wait for dungeon screen.
 * The .start-btn shows class selection, so we pick the first class card.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector(".start-btn", { timeout: 5000 });
  // Click "选择职业" button to show class selection modal
  await page.click(".start-btn");
  await page.waitForTimeout(300);
  // Pick first class card (warrior) from the modal
  await page.click(".class-card");
  await page.waitForTimeout(1000);
}

test.describe("Dungeon Expansion to 5 Floors", () => {
  // ---- Test 1: MAX_FLOORS constant ----
  test("MAX_FLOORS equals 5", async ({ page }) => {
    await page.goto(HTML);
    const maxFloors = await page.evaluate(() => MAX_FLOORS);
    expect(maxFloors).toBe(5);
  });

  // ---- Test 2: FLOOR_THEMES has 5 entries ----
  test("FLOOR_THEMES has 5 floor themes", async ({ page }) => {
    await page.goto(HTML);
    const result = await page.evaluate(() => {
      return {
        length: FLOOR_THEMES.length,
        ids: FLOOR_THEMES.map(function (t) { return t.id; }),
        names: FLOOR_THEMES.map(function (t) { return t.name; }),
      };
    });
    expect(result.length).toBe(5);
    expect(result.ids).toContain("moss_halls");
    expect(result.ids).toContain("bone_crypt");
    expect(result.ids).toContain("void_core");
    expect(result.ids).toContain("inferno_abyss");
    expect(result.ids).toContain("throne_endings");
  });

  // ---- Test 3: Floor 4 generates with rooms and enemies ----
  test("Floor 4 generates with rooms and enemies", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      gameState.floor = 4;
      var floorData = generateFloor(4);
      if (!floorData) return null;
      var bossEnemies = floorData.enemies.filter(function (e) { return e && e.boss; });
      var normalEnemies = floorData.enemies.filter(function (e) { return e && !e.boss; });
      return {
        rooms: floorData.rooms.length,
        enemies: floorData.enemies.length,
        normalEnemies: normalEnemies.length,
        bossEnemies: bossEnemies.length,
        floor: floorData.floor,
        themeId: floorData.theme.id,
        themeName: floorData.theme.name,
        envBuffId: floorData.theme.envBuff ? floorData.theme.envBuff.id : null,
      };
    });

    expect(result).not.toBeNull();
    expect(result.rooms).toBeGreaterThanOrEqual(2);
    expect(result.enemies).toBeGreaterThan(0);
    expect(result.bossEnemies).toBe(1);
    expect(result.floor).toBe(4);
    expect(result.themeId).toBe("inferno_abyss");
    expect(result.themeName).toBe("熔火深渊");
    expect(result.envBuffId).toBe("inferno");
  });

  // ---- Test 4: Floor 4 color theme has orange-red palette ----
  test("Floor 4 theme has orange-red color palette", async ({ page }) => {
    await page.goto(HTML);

    const theme = await page.evaluate(() => {
      var t = FLOOR_THEMES[3]; // floor 4 is index 3
      return {
        wall: t.colors.wall,
        wallDark: t.colors.wallDark,
        floor: t.colors.floor,
        decor: t.decor,
        id: t.id,
      };
    });

    expect(theme.wall).toBe("#cc5500");
    expect(theme.wallDark).toBe("#bb4400");
    expect(theme.floor).toBe("#331100");
    expect(theme.decor).toBe("#ff4400");
    expect(theme.id).toBe("inferno_abyss");
  });

  // ---- Test 5: Floor 4 env debuff — inferno burns player HP on movement ----
  test("Floor 4 inferno debuff burns player HP every 4 turns", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      // Switch to floor 4 dungeon
      gameState.floor = 4;
      var floorData = generateFloor(4);
      dungeon = floorData;

      // Position player at floor 4 start
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;

      // Set player to known HP
      player.hp = player.maxHp;
      var hpBefore = player.hp;

      // Set turnCount to 3 so movePlayer increments it to 4 (divisible by 4)
      gameState.turnCount = 3;

      // Move player upward (dx=0, dy=-1) to trigger env debuff check in movePlayer
      var moved = movePlayer(0, -1);

      return {
        moved: moved,
        hpBefore: hpBefore,
        hpAfter: player.hp,
        turnCount: gameState.turnCount,
        envBuffId: dungeon.theme.envBuff.id,
      };
    });

    expect(result.envBuffId).toBe("inferno");
    expect(result.hpAfter).toBeLessThan(result.hpBefore);
    // Burn = 5% of maxHP = Math.floor(120 * 0.05) = 6
    expect(result.hpBefore - result.hpAfter).toBeGreaterThanOrEqual(1);
  });

  // ---- Test 6: Floor 4 Boss — Inferno Beast has berserk + summon_minion ----
  test("Floor 4 Boss Inferno Beast has berserk and summon_minion rules", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      var bossData = BOSS_DATA.inferno_beast;
      return {
        name: bossData.name,
        floor: bossData.floor,
        hp: bossData.hp,
        atk: bossData.atk,
        rules: bossData.rules.map(function (r) {
          return { threshold: r.threshold, effect: r.effect, desc: r.desc };
        }),
      };
    });

    expect(result.name).toBe("熔火巨兽");
    expect(result.floor).toBe(4);
    expect(result.rules.length).toBeGreaterThanOrEqual(2);

    var effects = result.rules.map(function (r) { return r.effect; });
    expect(effects).toContain("berserk");
    expect(effects).toContain("summon_minion");

    // berserk at 0.5 threshold
    var berserkRule = result.rules.find(function (r) { return r.effect === "berserk"; });
    expect(berserkRule.threshold).toBe(0.5);

    // summon_minion at 1.0 threshold
    var summonRule = result.rules.find(function (r) { return r.effect === "summon_minion"; });
    expect(summonRule.threshold).toBe(1.0);
  });

  // ---- Test 7: Floor 4 Boss combat initializes with bossRules ----
  test("Floor 4 Boss initBossCombat sets bossRules correctly", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      // Generate floor 4
      gameState.floor = 4;
      var floorData = generateFloor(4);
      dungeon = floorData;

      // Init boss combat
      initBossCombat(BOSS_DATA.inferno_beast, dungeon);

      return {
        screen: gameState.screen,
        bossName: combatState.enemy.name,
        bossHp: combatState.enemy.hp,
        bossMaxHp: combatState.enemy.maxHp,
        bossPhase: combatState.bossPhase,
        rules: combatState.bossRules.map(function (r) {
          return { threshold: r.threshold, effect: r.effect, desc: r.desc };
        }),
        activeEffects: combatState.bossActiveEffects,
        triggeredRules: combatState.bossTriggeredRules,
      };
    });

    expect(result.screen).toBe("combat");
    expect(result.bossName).toBe("熔火巨兽");
    expect(result.bossHp).toBeGreaterThan(0);
    expect(result.bossMaxHp).toBe(result.bossHp);

    // At threshold 1.0, summon_minion should trigger immediately
    var effects = result.rules.map(function (r) { return r.effect; });
    expect(effects).toContain("summon_minion");
    expect(effects).toContain("berserk");
  });

  // ---- Test 8: Floor 5 generates with rooms and enemies ----
  test("Floor 5 generates with rooms and enemies", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      gameState.floor = 5;
      var floorData = generateFloor(5);
      if (!floorData) return null;
      var bossEnemies = floorData.enemies.filter(function (e) { return e && e.boss; });
      var normalEnemies = floorData.enemies.filter(function (e) { return e && !e.boss; });
      return {
        rooms: floorData.rooms.length,
        enemies: floorData.enemies.length,
        normalEnemies: normalEnemies.length,
        bossEnemies: bossEnemies.length,
        floor: floorData.floor,
        themeId: floorData.theme.id,
        themeName: floorData.theme.name,
        envBuffId: floorData.theme.envBuff ? floorData.theme.envBuff.id : null,
        enemyPool: floorData.theme.enemyPool,
      };
    });

    expect(result).not.toBeNull();
    expect(result.rooms).toBeGreaterThanOrEqual(2);
    expect(result.enemies).toBeGreaterThan(0);
    expect(result.bossEnemies).toBe(1);
    expect(result.floor).toBe(5);
    expect(result.themeId).toBe("throne_endings");
    expect(result.themeName).toBe("终焉王座");
    expect(result.envBuffId).toBe("final");

    // Floor 5 should have exclusive high-tier enemies
    expect(result.enemyPool).toContain("death_knight");
    expect(result.enemyPool).toContain("void_horror");
  });

  // ---- Test 9: Floor 5 final debuff — enemy ATK/DEF up, EXP/gold up ----
  test("Floor 5 final debuff boosts enemy stats and rewards", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      // Generate floor 5 dungeon
      gameState.floor = 5;
      var floorData = generateFloor(5);
      dungeon = floorData;

      // Verify env buff
      var envBuff = dungeon.theme.envBuff;

      // Check combat functions
      var atkBoost = voidEnemyAtk(100); // base 100 => 130
      var defBoost = voidEnemyDef(100); // base 100 => 115
      var expMult = voidExpMult();      // 2.0x
      var goldMult = finalGoldMult();   // 1.5x

      return {
        envBuffId: envBuff ? envBuff.id : null,
        envBuffDesc: envBuff ? envBuff.desc : null,
        atkBoost: atkBoost,
        defBoost: defBoost,
        expMult: expMult,
        goldMult: goldMult,
      };
    });

    expect(result.envBuffId).toBe("final");
    expect(result.atkBoost).toBe(130);        // ATK * 1.3
    expect(result.defBoost).toBeGreaterThanOrEqual(114);  // DEF * 1.15 (floor rounding: 114 or 115)
    expect(result.defBoost).toBeLessThanOrEqual(115);
    expect(result.expMult).toBe(2.0);         // EXP * 2.0
    expect(result.goldMult).toBe(1.5);        // gold * 1.5
  });

  // ---- Test 10: Floor 5 Boss — Lord Endings has skill_seal + equip_corrupt + berserk ----
  test("Floor 5 Boss Lord Endings has 3 rules: skill_seal, equip_corrupt, berserk", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      var bossData = BOSS_DATA.lord_endings;
      return {
        name: bossData.name,
        floor: bossData.floor,
        hp: bossData.hp,
        atk: bossData.atk,
        rules: bossData.rules.map(function (r) {
          return { threshold: r.threshold, effect: r.effect, desc: r.desc };
        }),
      };
    });

    expect(result.name).toBe("终焉领主");
    expect(result.floor).toBe(5);
    expect(result.rules.length).toBe(3);

    var effects = result.rules.map(function (r) { return r.effect; });
    expect(effects).toContain("skill_seal");
    expect(effects).toContain("equip_corrupt");
    expect(effects).toContain("berserk");

    // skill_seal at threshold 1.0
    var sealRule = result.rules.find(function (r) { return r.effect === "skill_seal"; });
    expect(sealRule.threshold).toBe(1.0);

    // equip_corrupt at threshold 1.0
    var corruptRule = result.rules.find(function (r) { return r.effect === "equip_corrupt"; });
    expect(corruptRule.threshold).toBe(1.0);

    // berserk at threshold 0.33
    var berserkRule = result.rules.find(function (r) { return r.effect === "berserk"; });
    expect(berserkRule.threshold).toBe(0.33);
  });

  // ---- Test 11: Floor 5 Boss combat triggers skill_seal and equip_corrupt at start ----
  test("Floor 5 Boss initBossCombat triggers skill_seal and equip_corrupt at threshold 1.0", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      gameState.floor = 5;
      var floorData = generateFloor(5);
      dungeon = floorData;

      initBossCombat(BOSS_DATA.lord_endings, dungeon);

      return {
        screen: gameState.screen,
        bossName: combatState.enemy.name,
        bossPhase: combatState.bossPhase,
        activeEffects: combatState.bossActiveEffects.slice(),
        triggeredRules: combatState.bossTriggeredRules.slice(),
        rulesCount: combatState.bossRules.length,
      };
    });

    expect(result.screen).toBe("combat");
    expect(result.bossName).toBe("终焉领主");
    expect(result.rulesCount).toBe(3);

    // At 1.0 threshold, skill_seal and equip_corrupt should both trigger immediately
    expect(result.activeEffects).toContain("skill_seal");
    expect(result.activeEffects).toContain("equip_corrupt");

    // Phase should advance for each triggered rule
    expect(result.bossPhase).toBeGreaterThanOrEqual(2);
  });

  // ---- Test 12: Floor 4 enemies include fire-themed types ----
  test("Floor 4 enemy pool contains fire-themed enemies", async ({ page }) => {
    await page.goto(HTML);

    const pool = await page.evaluate(() => {
      return FLOOR_THEMES[3].enemyPool;
    });

    expect(pool).toContain("lava_elemental");
    expect(pool).toContain("flame_bat");
    expect(pool).toContain("fire_sprite");
    expect(pool).toContain("crystal_golem");
  });

  // ---- Test 13: Floor 5 enemy pool includes all enemies ----
  test("Floor 5 enemy pool includes both fire and final-tier enemies", async ({ page }) => {
    await page.goto(HTML);

    const pool = await page.evaluate(() => {
      return FLOOR_THEMES[4].enemyPool;
    });

    expect(pool).toContain("lava_elemental");
    expect(pool).toContain("flame_bat");
    expect(pool).toContain("fire_sprite");
    expect(pool).toContain("crystal_golem");
    expect(pool).toContain("death_knight");
    expect(pool).toContain("void_horror");
  });

  // ---- Test 14: Floor 4 boss appears in generated dungeon ----
  test("Floor 4 generated dungeon contains Inferno Beast boss", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      gameState.floor = 4;
      var floorData = generateFloor(4);
      var boss = floorData.enemies.find(function (e) {
        return e && e.boss;
      });
      return boss ? {
        name: boss.name,
        boss: boss.boss,
        hp: boss.hp,
        rules: boss.rules ? boss.rules.length : 0,
      } : null;
    });

    expect(result).not.toBeNull();
    expect(result.name).toBe("熔火巨兽");
    expect(result.boss).toBe(true);
    expect(result.rules).toBeGreaterThanOrEqual(2);
  });

  // ---- Test 15: Floor 5 boss appears in generated dungeon ----
  test("Floor 5 generated dungeon contains Lord Endings boss", async ({ page }) => {
    await startGame(page);

    const result = await page.evaluate(() => {
      gameState.floor = 5;
      var floorData = generateFloor(5);
      var boss = floorData.enemies.find(function (e) {
        return e && e.boss;
      });
      return boss ? {
        name: boss.name,
        boss: boss.boss,
        hp: boss.hp,
        rules: boss.rules ? boss.rules.length : 0,
      } : null;
    });

    expect(result).not.toBeNull();
    expect(result.name).toBe("终焉领主");
    expect(result.boss).toBe(true);
    expect(result.rules).toBe(3);
  });

  // ---- Test 16: Floor 3 Boss (greed_king) still works after expansion ----
  test("Floor 3 Boss greed_king unchanged after expansion", async ({ page }) => {
    await page.goto(HTML);

    const result = await page.evaluate(() => {
      var bossData = BOSS_DATA.greed_king;
      return {
        name: bossData.name,
        floor: bossData.floor,
        rules: bossData.rules.map(function (r) {
          return { threshold: r.threshold, effect: r.effect, desc: r.desc };
        }),
      };
    });

    expect(result.name).toBe("贪婪之王");
    expect(result.floor).toBe(3);
    var effects = result.rules.map(function (r) { return r.effect; });
    expect(effects).toContain("equip_corrupt");
    expect(effects).toContain("gold_tempt");
    expect(effects).toContain("berserk");
  });

  // ---- Test 17: FLOOR_TINTS covers all 5 floors ----
  test("FLOOR_TINTS has entries for all 5 floors", async ({ page }) => {
    await page.goto(HTML);

    const result = await page.evaluate(() => {
      var keys = Object.keys(FLOOR_TINTS).map(Number).sort(function (a, b) { return a - b; });
      return {
        keys: keys,
        floor5: FLOOR_TINTS[5],
      };
    });

    expect(result.keys).toContain(1);
    expect(result.keys).toContain(2);
    expect(result.keys).toContain(3);
    expect(result.keys).toContain(4);
    expect(result.keys).toContain(5);
  });
});
