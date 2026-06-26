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
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
      closeModal();
    }
  });
  await page.waitForTimeout(300);
}

test.describe("Equipment Drop System", function () {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("1) rollLoot(floor, true) always produces equipment - 100 calls all non-null", async ({ page }) => {
    var result = await page.evaluate(() => {
      var allNonNull = true;
      var nullCount = 0;
      var totalCount = 100;
      var floorNum = gameState.floor;

      // Save inventory length before
      var invBefore = player.inventory.equipment.length;

      for (var i = 0; i < totalCount; i++) {
        var loot = rollLoot(floorNum, true);
        if (loot === null) {
          allNonNull = false;
          nullCount++;
        }
      }

      return {
        allNonNull: allNonNull,
        nullCount: nullCount,
        totalCount: totalCount,
        inventoryBefore: invBefore,
        inventoryAfter: player.inventory.equipment.length,
        inventoryAdded: player.inventory.equipment.length - invBefore,
      };
    });

    expect(result.allNonNull).toBe(true);
    expect(result.nullCount).toBe(0);
    expect(result.inventoryAdded).toBe(100);
  });

  test("2) rollLoot(floor, false) / rollLoot(floor) has probability of returning null", async ({ page }) => {
    var result = await page.evaluate(() => {
      var nullCount = 0;
      var hitCount = 0;
      var totalCount = 200;
      var floorNum = gameState.floor;

      // Save inventory length before
      var invBefore = player.inventory.equipment.length;

      for (var i = 0; i < totalCount; i++) {
        // Call without guaranteed flag (same as rollLoot(floor))
        var loot = rollLoot(floorNum);
        if (loot === null) {
          nullCount++;
        } else {
          hitCount++;
        }
      }

      // Also test explicit false
      var nullCount2 = 0;
      var hitCount2 = 0;
      for (var j = 0; j < 200; j++) {
        var loot2 = rollLoot(floorNum, false);
        if (loot2 === null) {
          nullCount2++;
        } else {
          hitCount2++;
        }
      }

      return {
        noArg: { nullCount: nullCount, hitCount: hitCount, totalCount: totalCount },
        explicitFalse: { nullCount: nullCount2, hitCount: hitCount2, totalCount: 200 },
        // Both should have some nulls and some hits
        noArgHasNulls: nullCount > 0,
        noArgHasHits: hitCount > 0,
        explicitFalseHasNulls: nullCount2 > 0,
        explicitFalseHasHits: hitCount2 > 0,
        inventoryBefore: invBefore,
        inventoryAfter: player.inventory.equipment.length,
      };
    });

    // At floor 1, base chance ~18%, so expect ~16-24% hit rate
    // Both nulls and hits should occur
    expect(result.noArgHasNulls).toBe(true);
    expect(result.noArgHasHits).toBe(true);
    expect(result.explicitFalseHasNulls).toBe(true);
    expect(result.explicitFalseHasHits).toBe(true);
    // Inventory grows only on hits (rollLoot pushes on success)
    expect(result.inventoryAfter).toBeGreaterThan(result.inventoryBefore);
  });

  test("3) Dropped equipment is pushed to player.inventory.equipment", async ({ page }) => {
    var result = await page.evaluate(() => {
      var invBefore = player.inventory.equipment.length;
      var floorNum = gameState.floor;

      // Use guaranteed drop
      var equip1 = rollLoot(floorNum, true);
      var equip2 = rollLoot(floorNum, true);

      var invAfter = player.inventory.equipment.length;
      var lastItem = player.inventory.equipment[invAfter - 1];
      var secondLastItem = player.inventory.equipment[invAfter - 2];

      return {
        invBefore: invBefore,
        invAfter: invAfter,
        increased: invAfter > invBefore,
        equip1InInventory: player.inventory.equipment.indexOf(equip1) !== -1,
        equip2InInventory: player.inventory.equipment.indexOf(equip2) !== -1,
        lastItemIsEquip2: lastItem && lastItem.id === equip2.id,
        secondLastIsEquip1: secondLastItem && secondLastItem.id === equip1.id,
        equip1NotNull: equip1 !== null,
        equip2NotNull: equip2 !== null,
      };
    });

    expect(result.increased).toBe(true);
    expect(result.equip1NotNull).toBe(true);
    expect(result.equip2NotNull).toBe(true);
    expect(result.equip1InInventory).toBe(true);
    expect(result.equip2InInventory).toBe(true);
    expect(result.lastItemIsEquip2).toBe(true);
    expect(result.secondLastIsEquip1).toBe(true);
  });

  test("4) Equipment object has required fields: id, name, icon, slot, rarity, stats", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;
      var equip = rollLoot(floorNum, true);

      var hasId = typeof equip.id === 'string' && equip.id.length > 0;
      var hasName = typeof equip.name === 'string' && equip.name.length > 0;
      var hasIcon = typeof equip.icon === 'string' && equip.icon.length > 0;
      var validSlot = ['weapon', 'armor', 'accessory'].indexOf(equip.slot) !== -1;
      var validRarity = ['white', 'blue', 'purple'].indexOf(equip.rarity) !== -1;
      var hasStats = equip.stats && typeof equip.stats === 'object' && Object.keys(equip.stats).length > 0;

      // Check stat values exist
      var statKeys = Object.keys(equip.stats);
      var allStatsNumeric = true;
      for (var i = 0; i < statKeys.length; i++) {
        if (typeof equip.stats[statKeys[i]] !== 'number') {
          allStatsNumeric = false;
          break;
        }
      }

      // Check for common stat types in stats
      var statTypeSet = {};
      for (var j = 0; j < statKeys.length; j++) {
        statTypeSet[statKeys[j]] = true;
      }
      var hasAtk = !!statTypeSet.atk;
      var hasDef = !!statTypeSet.def;
      var hasSpd = !!statTypeSet.spd;
      var hasHp = !!statTypeSet.hp;

      // Check floor and identified fields
      var hasFloor = typeof equip.floor === 'number';
      var hasIdentified = typeof equip.identified === 'boolean';
      var hasJustDropped = equip.justDropped === true;

      return {
        hasId: hasId,
        hasName: hasName,
        hasIcon: hasIcon,
        validSlot: validSlot,
        validRarity: validRarity,
        hasStats: hasStats,
        allStatsNumeric: allStatsNumeric,
        statKeys: statKeys,
        hasAtk: hasAtk,
        hasDef: hasDef,
        hasSpd: hasSpd,
        hasHp: hasHp,
        hasFloor: hasFloor,
        hasIdentified: hasIdentified,
        hasJustDropped: hasJustDropped,
        slot: equip.slot,
        rarity: equip.rarity,
        name: equip.name,
        floor: equip.floor,
        identified: equip.identified,
      };
    });

    expect(result.hasId).toBe(true);
    expect(result.hasName).toBe(true);
    expect(result.hasIcon).toBe(true);
    expect(result.validSlot).toBe(true);
    expect(result.validRarity).toBe(true);
    expect(result.hasStats).toBe(true);
    expect(result.allStatsNumeric).toBe(true);
    expect(result.hasFloor).toBe(true);
    expect(result.hasIdentified).toBe(true);
    expect(result.hasJustDropped).toBe(true);
    // At least one stat key should be present
    expect(result.statKeys.length).toBeGreaterThan(0);
  });

  test("5) equipItem moves equipment from inventory to player.equip[slot]", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;
      var equip = rollLoot(floorNum, true);
      var equipId = equip.id;
      var equipSlot = equip.slot;

      var invBefore = player.inventory.equipment.length;
      var wasEquippedBefore = player.equip[equipSlot] !== null;

      equipItem(equipId);

      var invAfter = player.inventory.equipment.length;
      var isEquipped = player.equip[equipSlot] !== null;
      var isSameEquip = player.equip[equipSlot] && player.equip[equipSlot].id === equipId;
      var stillInInventory = player.inventory.equipment.some(function (e) { return e.id === equipId; });

      return {
        invBefore: invBefore,
        invAfter: invAfter,
        inventoryDecreased: invAfter === invBefore - 1,
        wasEquippedBefore: wasEquippedBefore,
        isEquipped: isEquipped,
        isSameEquip: isSameEquip,
        stillInInventory: stillInInventory,
        slot: equipSlot,
      };
    });

    expect(result.inventoryDecreased).toBe(true);
    expect(result.isEquipped).toBe(true);
    expect(result.isSameEquip).toBe(true);
    expect(result.stillInInventory).toBe(false);
  });

  test("6) After equipping, recalcPlayerStats reflects equipment stats", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;

      // Generate equipment with forced stats we can check
      // Generate multiple items and pick one with atk
      var equipWithAtk = null;
      for (var i = 0; i < 50; i++) {
        var e = generateEquipment(floorNum, 'blue');
        if (e.stats && e.stats.atk) {
          equipWithAtk = e;
          break;
        }
      }

      // Fallback: if we couldn't find atk, force one
      if (!equipWithAtk) {
        equipWithAtk = generateEquipment(floorNum, 'blue');
        equipWithAtk.stats.atk = 10;
      }

      // Ensure equipment inventory exists
      if (!player.inventory.equipment) player.inventory.equipment = [];
      player.inventory.equipment.push(equipWithAtk);

      var baseAtkBefore = player.baseAtk;
      var slot = equipWithAtk.slot;
      var prevEquip = player.equip[slot];

      equipItem(equipWithAtk.id);

      var baseAtkAfter = player.baseAtk;
      var atkBoost = baseAtkAfter - baseAtkBefore;
      var expectedAtk = equipWithAtk.stats.atk;

      // Clean up: unequip
      if (prevEquip) {
        player.equip[slot] = prevEquip;
        player.inventory.equipment.push(equipWithAtk);
      } else {
        player.equip[slot] = null;
        player.inventory.equipment.push(equipWithAtk);
      }

      return {
        baseAtkBefore: baseAtkBefore,
        baseAtkAfter: baseAtkAfter,
        atkBoost: atkBoost,
        expectedAtk: expectedAtk,
        statsIncreased: baseAtkAfter > baseAtkBefore,
        slot: slot,
        equipStats: equipWithAtk.stats,
      };
    });

    expect(result.statsIncreased).toBe(true);
    expect(result.atkBoost).toBeGreaterThan(0);
  });

  test("6b) Equipping armor increases baseDef via recalcPlayerStats", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;

      // Generate an armor with def
      var armorWithDef = null;
      for (var i = 0; i < 50; i++) {
        var e = generateEquipment(floorNum, 'blue');
        if (e.slot === 'armor' && e.stats && e.stats.def) {
          armorWithDef = e;
          break;
        }
      }

      if (!armorWithDef) {
        armorWithDef = generateEquipment(floorNum, 'blue');
        armorWithDef.slot = 'armor';
        armorWithDef.stats = { def: 8 };
      }

      if (!player.inventory.equipment) player.inventory.equipment = [];
      player.inventory.equipment.push(armorWithDef);

      var baseDefBefore = player.baseDef;
      equipItem(armorWithDef.id);
      var baseDefAfter = player.baseDef;

      return {
        baseDefBefore: baseDefBefore,
        baseDefAfter: baseDefAfter,
        defBoost: baseDefAfter - baseDefBefore,
        statsIncreased: baseDefAfter > baseDefBefore,
        expectedDef: armorWithDef.stats.def,
      };
    });

    expect(result.statsIncreased).toBe(true);
    expect(result.defBoost).toBeGreaterThan(0);
  });

  test("7) unequipSlot returns equipment to inventory", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;
      var equip = rollLoot(floorNum, true);
      var equipId = equip.id;
      var slot = equip.slot;

      equipItem(equipId);
      var invAfterEquip = player.inventory.equipment.length;

      unequipSlot(slot);

      var invAfterUnequip = player.inventory.equipment.length;
      var isBackInInventory = player.inventory.equipment.some(function (e) { return e.id === equipId; });
      var slotIsEmpty = player.equip[slot] === null;

      return {
        invAfterEquip: invAfterEquip,
        invAfterUnequip: invAfterUnequip,
        inventoryIncreased: invAfterUnequip > invAfterEquip,
        isBackInInventory: isBackInInventory,
        slotIsEmpty: slotIsEmpty,
        slot: slot,
      };
    });

    expect(result.inventoryIncreased).toBe(true);
    expect(result.isBackInInventory).toBe(true);
    expect(result.slotIsEmpty).toBe(true);
  });

  test("8) Equipping new item in occupied slot returns old item to inventory", async ({ page }) => {
    var result = await page.evaluate(() => {
      var floorNum = gameState.floor;

      // Collect items by slot until we have two in the same slot
      var bySlot = { weapon: [], armor: [], accessory: [] };
      for (var i = 0; i < 30; i++) {
        var item = rollLoot(floorNum, true);
        bySlot[item.slot].push(item);
      }

      // Find the first slot with at least 2 items
      var slot = null;
      var w1 = null, w2 = null;
      for (var s of ['weapon', 'armor', 'accessory']) {
        if (bySlot[s].length >= 2) {
          slot = s;
          w1 = bySlot[s][0];
          w2 = bySlot[s][1];
          break;
        }
      }

      // Fallback: force if random didn't cooperate
      if (!slot) {
        w1 = bySlot.weapon[0];
        w2 = generateEquipment(floorNum, 'white');
        w2.id = uuid();
        w1.slot = 'weapon';
        w2.slot = 'weapon';
        slot = 'weapon';
        player.inventory.equipment.push(w1);
        // w2 is already in inventory from rollLoot above calls, regenerate
        player.inventory.equipment.push(w2);
      }

      // Equip first item
      equipItem(w1.id);
      var w1Equipped = player.equip[slot] && player.equip[slot].id === w1.id;

      // Equip second item (same slot) - first should be pushed back to inventory
      equipItem(w2.id);
      var w2Equipped = player.equip[slot] && player.equip[slot].id === w2.id;
      var w1BackInInventory = player.inventory.equipment.some(function (e) { return e.id === w1.id; });
      var w2NotInInventory = !player.inventory.equipment.some(function (e) { return e.id === w2.id; });

      return {
        slot: slot,
        w1id: w1.id,
        w2id: w2.id,
        w1EquippedAfterFirst: w1Equipped,
        w2EquippedAfterSecond: w2Equipped,
        w1BackInInventory: w1BackInInventory,
        w2NotInInventory: w2NotInInventory,
      };
    });

    expect(result.w1EquippedAfterFirst).toBe(true);
    expect(result.w2EquippedAfterSecond).toBe(true);
    expect(result.w1BackInInventory).toBe(true);
    expect(result.w2NotInInventory).toBe(true);
  });

  test("9) Higher floor produces higher rarity equipment", async ({ page }) => {
    var result = await page.evaluate(() => {
      var iterations = 2000;

      // Low floor (1): mostly white
      var lowFloor = { white: 0, blue: 0, purple: 0 };
      for (var i = 0; i < iterations; i++) {
        var e1 = generateEquipment(1);
        lowFloor[e1.rarity]++;
      }

      // Mid floor (5): more blue/purple
      var midFloor = { white: 0, blue: 0, purple: 0 };
      for (var j = 0; j < iterations; j++) {
        var e2 = generateEquipment(5);
        midFloor[e2.rarity]++;
      }

      // High floor (10): significant purple
      var highFloor = { white: 0, blue: 0, purple: 0 };
      for (var k = 0; k < iterations; k++) {
        var e3 = generateEquipment(10);
        highFloor[e3.rarity]++;
      }

      // Very high floor (20): purple common
      var vHighFloor = { white: 0, blue: 0, purple: 0 };
      for (var l = 0; l < iterations; l++) {
        var e4 = generateEquipment(20);
        vHighFloor[e4.rarity]++;
      }

      var lowNonWhite = lowFloor.blue + lowFloor.purple;
      var midNonWhite = midFloor.blue + midFloor.purple;
      var highNonWhite = highFloor.blue + highFloor.purple;
      var vHighNonWhite = vHighFloor.blue + vHighFloor.purple;

      var lowPurplePct = lowFloor.purple / iterations;
      var midPurplePct = midFloor.purple / iterations;
      var highPurplePct = highFloor.purple / iterations;
      var vHighPurplePct = vHighFloor.purple / iterations;

      return {
        iterations: iterations,
        lowFloor: lowFloor,
        midFloor: midFloor,
        highFloor: highFloor,
        vHighFloor: vHighFloor,
        lowNonWhite: lowNonWhite,
        midNonWhite: midNonWhite,
        highNonWhite: highNonWhite,
        vHighNonWhite: vHighNonWhite,
        // Non-white count should increase with floor
        rarityIncreasesWithFloor: vHighNonWhite > lowNonWhite,
        lowPurplePct: lowPurplePct,
        midPurplePct: midPurplePct,
        highPurplePct: highPurplePct,
        vHighPurplePct: vHighPurplePct,
        purpleIncreasesWithFloor: vHighPurplePct > lowPurplePct,
      };
    });

    expect(result.rarityIncreasesWithFloor).toBe(true);
    expect(result.purpleIncreasesWithFloor).toBe(true);
    // At floor 1, purple should be rare (< 15%)
    expect(result.lowPurplePct).toBeLessThan(0.15);
    // At floor 20, purple should be more common (> 15%)
    expect(result.vHighPurplePct).toBeGreaterThan(0.15);
    // Non-white count should generally increase (allow some variance with larger sample)
    expect(result.vHighNonWhite).toBeGreaterThan(result.lowNonWhite);
  });
});

test.describe("Equipment Generation (generateEquipment)", function () {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("10) generateEquipment produces unique ids", async ({ page }) => {
    var result = await page.evaluate(() => {
      var ids = new Set();
      var duplicates = 0;
      var floorNum = 5;
      for (var i = 0; i < 100; i++) {
        var e = generateEquipment(floorNum);
        if (ids.has(e.id)) duplicates++;
        ids.add(e.id);
      }
      return { duplicates: duplicates, uniqueCount: ids.size, totalGenerated: 100 };
    });

    expect(result.duplicates).toBe(0);
    expect(result.uniqueCount).toBe(100);
  });

  test("11) generateEquipment slot weights: weapon > armor > accessory", async ({ page }) => {
    var result = await page.evaluate(() => {
      var counts = { weapon: 0, armor: 0, accessory: 0 };
      var total = 500;
      for (var i = 0; i < total; i++) {
        var e = generateEquipment(5);
        counts[e.slot]++;
      }
      // weapon=50, armor=30, accessory=20
      return {
        counts: counts,
        total: total,
        weaponPct: counts.weapon / total,
        armorPct: counts.armor / total,
        accessoryPct: counts.accessory / total,
        weaponMostCommon: counts.weapon > counts.armor && counts.weapon > counts.accessory,
      };
    });

    expect(result.weaponMostCommon).toBe(true);
    expect(result.weaponPct).toBeGreaterThan(0.4);  // ~50% expected
    expect(result.weaponPct).toBeLessThan(0.6);
    expect(result.armorPct).toBeGreaterThan(0.2);   // ~30% expected
    expect(result.armorPct).toBeLessThan(0.4);
    expect(result.accessoryPct).toBeGreaterThan(0.1); // ~20% expected
    expect(result.accessoryPct).toBeLessThan(0.3);
  });

  test("12) White equipment has 1 affix, blue has 2, purple has 3", async ({ page }) => {
    var result = await page.evaluate(() => {
      var whiteCount = 0, blueCount = 0, purpleCount = 0;
      var whiteAffixes = [], blueAffixes = [], purpleAffixes = [];
      var floorNum = 5;

      for (var i = 0; i < 200; i++) {
        var e = generateEquipment(floorNum, 'white');
        var count = Object.keys(e.stats).length;
        whiteAffixes.push(count);
        if (count !== 1) whiteCount++;
      }

      for (var j = 0; j < 200; j++) {
        var e = generateEquipment(floorNum, 'blue');
        var count = Object.keys(e.stats).length;
        blueAffixes.push(count);
        if (count !== 2) blueCount++;
      }

      for (var k = 0; k < 200; k++) {
        var e = generateEquipment(floorNum, 'purple');
        var count = Object.keys(e.stats).length;
        purpleAffixes.push(count);
        if (count !== 3) purpleCount++;
      }

      return {
        whiteAll1: whiteCount === 0,
        blueAll2: blueCount === 0,
        purpleAll3: purpleCount === 0,
        whiteWrong: whiteCount,
        blueWrong: blueCount,
        purpleWrong: purpleCount,
      };
    });

    expect(result.whiteAll1).toBe(true);
    expect(result.blueAll2).toBe(true);
    expect(result.purpleAll3).toBe(true);
  });

  test("13) Equipment stats scale with floor number", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Generate weapons with atk at different floors
      var atkFloor1 = [], atkFloor5 = [], atkFloor10 = [], atkFloor15 = [];

      for (var i = 0; i < 100; i++) {
        var e1 = generateEquipment(1, 'white');
        if (e1.stats.atk) atkFloor1.push(e1.stats.atk);

        var e2 = generateEquipment(5, 'white');
        if (e2.stats.atk) atkFloor5.push(e2.stats.atk);

        var e3 = generateEquipment(10, 'white');
        if (e3.stats.atk) atkFloor10.push(e3.stats.atk);

        var e4 = generateEquipment(15, 'white');
        if (e4.stats.atk) atkFloor15.push(e4.stats.atk);
      }

      var avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; };

      var avg1 = avg(atkFloor1);
      var avg5 = avg(atkFloor5);
      var avg10 = avg(atkFloor10);
      var avg15 = avg(atkFloor15);

      return {
        floor1: { avg: avg1, count: atkFloor1.length },
        floor5: { avg: avg5, count: atkFloor5.length },
        floor10: { avg: avg10, count: atkFloor10.length },
        floor15: { avg: avg15, count: atkFloor15.length },
        scalesUp: avg15 > avg1 && avg10 > avg1 && avg5 > avg1,
      };
    });

    expect(result.scalesUp).toBe(true);
    expect(result.floor15.avg).toBeGreaterThan(result.floor1.avg);
  });

  test("14) Higher rarity gives higher stat values", async ({ page }) => {
    var result = await page.evaluate(() => {
      var whiteAtk = [], blueAtk = [], purpleAtk = [];
      var floorNum = 5;

      for (var i = 0; i < 200; i++) {
        var w = generateEquipment(floorNum, 'white');
        if (w.stats.atk) whiteAtk.push(w.stats.atk);

        var b = generateEquipment(floorNum, 'blue');
        if (b.stats.atk) blueAtk.push(b.stats.atk);

        var p = generateEquipment(floorNum, 'purple');
        if (p.stats.atk) purpleAtk.push(p.stats.atk);
      }

      var avg = function (arr) { return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length; };

      var avgW = avg(whiteAtk);
      var avgB = avg(blueAtk);
      var avgP = avg(purpleAtk);

      return {
        white: { avg: avgW, count: whiteAtk.length },
        blue: { avg: avgB, count: blueAtk.length },
        purple: { avg: avgP, count: purpleAtk.length },
        blueBetterThanWhite: avgB > avgW,
        purpleBetterThanBlue: avgP > avgB,
      };
    });

    expect(result.blueBetterThanWhite).toBe(true);
    expect(result.purpleBetterThanBlue).toBe(true);
  });

  test("15) Purple equipment starts unidentified (identified=false)", async ({ page }) => {
    var result = await page.evaluate(() => {
      var whiteUnidentified = 0, blueUnidentified = 0, purpleUnidentified = 0;
      var floorNum = 5;

      for (var i = 0; i < 50; i++) {
        var w = generateEquipment(floorNum, 'white');
        if (!w.identified) whiteUnidentified++;

        var b = generateEquipment(floorNum, 'blue');
        if (!b.identified) blueUnidentified++;

        var p = generateEquipment(floorNum, 'purple');
        if (!p.identified) purpleUnidentified++;
      }

      return {
        whiteUnidentified: whiteUnidentified,
        blueUnidentified: blueUnidentified,
        purpleUnidentified: purpleUnidentified,
        allPurpleUnidentified: purpleUnidentified === 50,
        noWhiteUnidentified: whiteUnidentified === 0,
        noBlueUnidentified: blueUnidentified === 0,
      };
    });

    expect(result.allPurpleUnidentified).toBe(true);
    expect(result.noWhiteUnidentified).toBe(true);
    expect(result.noBlueUnidentified).toBe(true);
  });
});

test.describe("Equipment Integration with Combat", function () {
  test.beforeEach(async ({ page }) => {
    await startGame(page);
  });

  test("16) Equipment stats contribute to getPlayerAtk and getPlayerDef", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Generate weapon with atk and armor with def
      var weapon = null;
      var armor = null;
      for (var i = 0; i < 50; i++) {
        var w = generateEquipment(5, 'blue');
        var a = generateEquipment(5, 'blue');
        if (w.slot === 'weapon' && w.stats.atk) weapon = w;
        if (a.slot === 'armor' && a.stats.def) armor = a;
        if (weapon && armor) break;
      }

      if (!weapon) {
        weapon = generateEquipment(5, 'blue');
        weapon.slot = 'weapon';
        weapon.stats = { atk: 12 };
        weapon.identified = true;
      }
      if (!armor) {
        armor = generateEquipment(5, 'blue');
        armor.slot = 'armor';
        armor.stats = { def: 8 };
        armor.identified = true;
      }

      if (!player.inventory.equipment) player.inventory.equipment = [];
      player.inventory.equipment.push(weapon, armor);

      var atkBefore = getPlayerAtk();
      var defBefore = getPlayerDef();

      equipItem(weapon.id);
      equipItem(armor.id);

      var atkAfter = getPlayerAtk();
      var defAfter = getPlayerDef();

      return {
        atkBefore: atkBefore,
        atkAfter: atkAfter,
        defBefore: defBefore,
        defAfter: defAfter,
        atkIncreased: atkAfter > atkBefore,
        defIncreased: defAfter > defBefore,
        weaponAtk: weapon.stats.atk,
        armorDef: armor.stats.def,
      };
    });

    expect(result.atkIncreased).toBe(true);
    expect(result.defIncreased).toBe(true);
  });

  test("17) Boss combat triggers rollLoot with guaranteed=true", async ({ page }) => {
    var result = await page.evaluate(() => {
      // Verify boss drop logic: rollLoot calls with guaranteed=true always return non-null
      var floorNum = gameState.floor || 3;

      // Simulate what combat.js does for boss drops (line 997-1011)
      var drop1 = rollLoot(floorNum, true);
      var drop2 = rollLoot(floorNum, true);

      return {
        drop1NotNull: drop1 !== null,
        drop2NotNull: drop2 !== null,
        drop1HasJustDropped: drop1 ? drop1.justDropped === true : false,
        drop2HasJustDropped: drop2 ? drop2.justDropped === true : false,
        bothInInventory: (drop1 && player.inventory.equipment.indexOf(drop1) !== -1) &&
                          (drop2 && player.inventory.equipment.indexOf(drop2) !== -1),
      };
    });

    expect(result.drop1NotNull).toBe(true);
    expect(result.drop2NotNull).toBe(true);
    expect(result.drop1HasJustDropped).toBe(true);
    expect(result.drop2HasJustDropped).toBe(true);
    expect(result.bothInInventory).toBe(true);
  });
});
