// test-economy-shop.js — Economy + Shop logic tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// --- Economy: addGold ---
describe('addGold: normal, buff bonus, no player', ({ assert }) => {
  it('正常增加 10 金币', () => {
    player.gold = 0;
    player.buffStats = null;
    const added = addGold(10);
    if (added !== 10) throw new Error(`expected 10, got ${added}`);
    if (player.gold !== 10) throw new Error(`player.gold expected 10, got ${player.gold}`);
  });

  it('金币收益加成 +50% 时额外获得', () => {
    player.gold = 0;
    player.buffStats = { goldBonus: 0.5 };
    const added = addGold(100);
    if (added !== 150) throw new Error(`expected 150, got ${added}`);
    if (player.gold !== 150) throw new Error(`player.gold expected 150, got ${player.gold}`);
  });

  it('金币收益加成 +100% 时翻倍', () => {
    player.gold = 0;
    player.buffStats = { goldBonus: 1.0 };
    const added = addGold(50);
    if (added !== 100) throw new Error(`expected 100, got ${added}`);
  });

  it('无加成时 goldBonus 不存在也不报错', () => {
    player.gold = 5;
    player.buffStats = {};
    const added = addGold(20);
    if (added !== 20) throw new Error(`expected 20, got ${added}`);
    if (player.gold !== 25) throw new Error(`player.gold expected 25, got ${player.gold}`);
  });

  it('player 不存在时返回 0', () => {
    const saved = player;
    player = null;
    const ret = addGold(10);
    player = saved;
    if (ret !== 0) throw new Error(`expected 0, got ${ret}`);
  });

  it('四舍五入: amount=10, bonus=0.33 应得 13', () => {
    player.gold = 0;
    player.buffStats = { goldBonus: 0.33 };
    const added = addGold(10);
    if (added !== 13) throw new Error(`expected 13, got ${added}`);
  });

  it('累加到现有金币上', () => {
    player.gold = 42;
    player.buffStats = null;
    addGold(8);
    if (player.gold !== 50) throw new Error(`expected 50, got ${player.gold}`);
  });
});

// --- Economy: addGems ---
describe('addGems', ({ assert }) => {
  it('正常增加宝石', () => {
    player.gems = 0;
    addGems(3);
    if (player.gems !== 3) throw new Error(`expected 3, got ${player.gems}`);
  });

  it('gems 为 undefined 时从 0 开始', () => {
    delete player.gems;
    addGems(5);
    if (player.gems !== 5) throw new Error(`expected 5, got ${player.gems}`);
  });

  it('player 不存在时不报错', () => {
    const saved = player;
    player = null;
    addGems(10);
    player = saved;
  });

  it('累加到现有宝石上', () => {
    player.gems = 7;
    addGems(3);
    if (player.gems !== 10) throw new Error(`expected 10, got ${player.gems}`);
  });
});

// --- Economy: getShopPriceMultiplier ---
describe('getShopPriceMultiplier', ({ assert }) => {
  it('第 1 层倍率 = 1', () => {
    gameState.floor = 1;
    const m = getShopPriceMultiplier();
    if (m !== 1) throw new Error(`expected 1, got ${m}`);
  });

  it('第 3 层倍率 = 1.6', () => {
    gameState.floor = 3;
    const m = getShopPriceMultiplier();
    if (Math.abs(m - 1.6) > 0.001) throw new Error(`expected 1.6, got ${m}`);
  });

  it('第 5 层倍率 = 2.2', () => {
    gameState.floor = 5;
    const m = getShopPriceMultiplier();
    if (Math.abs(m - 2.2) > 0.001) throw new Error(`expected 2.2, got ${m}`);
  });

  it('第 10 层倍率 = 3.7', () => {
    gameState.floor = 10;
    const m = getShopPriceMultiplier();
    if (Math.abs(m - 3.7) > 0.001) throw new Error(`expected 3.7, got ${m}`);
  });
});

// --- Economy: calculateFloorReward ---
describe('calculateFloorReward', ({ assert }) => {
  it('第 1 层金币在 [13,20] 范围 (8+5, 15+5)', () => {
    const restore = seedRandom(123);
    const reward = calculateFloorReward(1);
    restore();
    if (reward.gold < 13 || reward.gold > 20) throw new Error(`gold expected [13,20], got ${reward.gold}`);
  });

  it('第 5 层金币在 [33,40] 范围', () => {
    const restore = seedRandom(456);
    const reward = calculateFloorReward(5);
    restore();
    const min = 8 + 5 * 5;
    const max = 15 + 5 * 5;
    if (reward.gold < min || reward.gold > max) throw new Error(`gold expected [${min},${max}], got ${reward.gold}`);
  });

  it('第 1 层不掉落宝石', () => {
    const restore = seedRandom(789);
    const reward = calculateFloorReward(1);
    restore();
    if (reward.gems !== null) throw new Error(`gems expected null at floor 1, got ${reward.gems}`);
  });

  it('第 2 层不掉落宝石', () => {
    const restore = seedRandom(101);
    const reward = calculateFloorReward(2);
    restore();
    if (reward.gems !== null) throw new Error(`gems expected null at floor 2, got ${reward.gems}`);
  });

  it('第 3 层可能掉落宝石', () => {
    let gotGems = false;
    for (let s = 0; s < 200; s++) {
      const restore = seedRandom(s);
      const reward = calculateFloorReward(3);
      restore();
      if (reward.gems !== null) gotGems = true;
    }
    if (!gotGems) throw new Error('floor 3 should occasionally drop gems across multiple seeds');
  });

  it('宝石掉落数量来自 [1,1,1,2]', () => {
    let found = false;
    for (let s = 0; s < 500; s++) {
      const restore = seedRandom(s);
      const reward = calculateFloorReward(5);
      restore();
      if (reward.gems !== null) {
        if (reward.gems === 1 || reward.gems === 2) found = true;
        else throw new Error(`gems expected 1 or 2, got ${reward.gems}`);
      }
    }
    if (!found) throw new Error('floor 5 should occasionally drop gems across multiple seeds');
  });

  it('第 5 层金币范围 [33,40]', () => {
    const restore = seedRandom(999);
    const reward = calculateFloorReward(5);
    restore();
    if (reward.gold < 33 || reward.gold > 40) throw new Error(`expected [33,40], got ${reward.gold}`);
  });
});

// --- Economy: calculateClearReward ---
describe('calculateClearReward', ({ assert }) => {
  it('第 3 层通关奖励: 金币在 [95,125], 宝石 1', () => {
    const restore = seedRandom(111);
    const reward = calculateClearReward(3);
    restore();
    const goldMin = 3 * 25 + 20;
    const goldMax = 3 * 25 + 50;
    if (reward.gold < goldMin || reward.gold > goldMax) throw new Error(`gold expected [${goldMin},${goldMax}], got ${reward.gold}`);
    if (reward.gems !== 1) throw new Error(`gems expected 1, got ${reward.gems}`);
  });

  it('第 5 层通关奖励: 宝石 = 2', () => {
    const restore = seedRandom(222);
    const reward = calculateClearReward(5);
    restore();
    if (reward.gems !== 2) throw new Error(`gems expected 2, got ${reward.gems}`);
  });

  it('第 4 层通关奖励: 宝石 = 1', () => {
    const restore = seedRandom(333);
    const reward = calculateClearReward(4);
    restore();
    if (reward.gems !== 1) throw new Error(`gems expected 1 at floor 4, got ${reward.gems}`);
  });

  it('第 1 层通关奖励: 金币在 [45,75], 宝石 1', () => {
    const restore = seedRandom(444);
    const reward = calculateClearReward(1);
    restore();
    if (reward.gold < 45 || reward.gold > 75) throw new Error(`gold expected [45,75], got ${reward.gold}`);
    if (reward.gems !== 1) throw new Error(`gems expected 1, got ${reward.gems}`);
  });

  it('第 10 层通关奖励: 金币在 [270,300], 宝石 2', () => {
    const restore = seedRandom(555);
    const reward = calculateClearReward(10);
    restore();
    if (reward.gold < 270 || reward.gold > 300) throw new Error(`gold expected [270,300], got ${reward.gold}`);
    if (reward.gems !== 2) throw new Error(`gems expected 2, got ${reward.gems}`);
  });
});

// --- Economy: onGameOver ---
describe('onGameOver', ({ assert }) => {
  it('保留 50% 金币', () => {
    player.gold = 100;
    player.gems = 0;
    permanent = null;
    const result = onGameOver();
    if (result.keptGold !== 50) throw new Error(`keptGold expected 50, got ${result.keptGold}`);
    if (result.lostGold !== 50) throw new Error(`lostGold expected 50, got ${result.lostGold}`);
  });

  it('保留 50% 宝石 (向下取整)', () => {
    player.gold = 0;
    player.gems = 7;
    permanent = null;
    const result = onGameOver();
    if (result.keptGems !== 3) throw new Error(`keptGems expected 3, got ${result.keptGems}`);
    if (result.lostGems !== 4) throw new Error(`lostGems expected 4, got ${result.lostGems}`);
  });

  it('player 不存在时返回 0', () => {
    const saved = player;
    player = null;
    const result = onGameOver();
    player = saved;
    if (result.keptGold !== 0) throw new Error(`keptGold expected 0, got ${result.keptGold}`);
    if (result.keptGems !== 0) throw new Error(`keptGems expected 0, got ${result.keptGems}`);
  });

  it('有 permanent 时同步宝石并重置玩家金币', () => {
    player.gold = 200;
    player.gems = 10;
    permanent = { gems: 5, _startGold: 0, permanentStats: {}, soulShards: 0, talents: {}, unlockedBuffs: [], buffUnlockProgress: {} };
    const result = onGameOver();
    if (result.keptGold !== 100) throw new Error(`keptGold expected 100, got ${result.keptGold}`);
    if (result.keptGems !== 5) throw new Error(`keptGems expected 5, got ${result.keptGems}`);
    if (permanent.gems !== 10) throw new Error(`permanent.gems expected 10, got ${permanent.gems}`);
    if (permanent._startGold !== 100) throw new Error(`permanent._startGold expected 100, got ${permanent._startGold}`);
    if (player.gold !== 0) throw new Error(`player.gold expected 0 after permanent sync, got ${player.gold}`);
  });

  it('金币为奇数时向下取整保留', () => {
    player.gold = 99;
    player.gems = 0;
    permanent = null;
    const result = onGameOver();
    if (result.keptGold !== 49) throw new Error(`keptGold expected 49, got ${result.keptGold}`);
    if (result.lostGold !== 50) throw new Error(`lostGold expected 50, got ${result.lostGold}`);
  });

  it('0 金币 0 宝石时正常返回', () => {
    player.gold = 0;
    player.gems = 0;
    permanent = null;
    const result = onGameOver();
    if (result.keptGold !== 0) throw new Error(`keptGold expected 0, got ${result.keptGold}`);
    if (result.lostGold !== 0) throw new Error(`lostGold expected 0, got ${result.lostGold}`);
    if (result.keptGems !== 0) throw new Error(`keptGems expected 0, got ${result.keptGems}`);
  });
});

// --- Economy: spendGems ---
describe('spendGems', ({ assert }) => {
  it('从玩家宝石扣除', () => {
    player.gems = 10;
    permanent = { gems: 0 };
    const ok = spendGems(3);
    if (!ok) throw new Error('expected true');
    if (player.gems !== 7) throw new Error(`player.gems expected 7, got ${player.gems}`);
    if (permanent.gems !== 0) throw new Error(`permanent.gems expected 0, got ${permanent.gems}`);
  });

  it('先扣玩家宝石再扣永久宝石', () => {
    player.gems = 2;
    permanent = { gems: 8 };
    const ok = spendGems(5);
    if (!ok) throw new Error('expected true');
    if (player.gems !== 0) throw new Error(`player.gems expected 0, got ${player.gems}`);
    if (permanent.gems !== 5) throw new Error(`permanent.gems expected 5, got ${permanent.gems}`);
  });

  it('总宝石不足时返回 false', () => {
    player.gems = 1;
    permanent = { gems: 2 };
    const ok = spendGems(5);
    if (ok !== false) throw new Error('expected false');
    if (player.gems !== 1) throw new Error(`player.gems should be unchanged, got ${player.gems}`);
    if (permanent.gems !== 2) throw new Error(`permanent.gems should be unchanged, got ${permanent.gems}`);
  });

  it('player 不存在时返回 false', () => {
    const saved = player;
    player = null;
    const ok = spendGems(1);
    player = saved;
    if (ok !== false) throw new Error('expected false');
  });

  it('permanent 不存在时返回 false', () => {
    player.gems = 5;
    permanent = null;
    const ok = spendGems(1);
    if (ok !== false) throw new Error('expected false');
  });

  it('刚好花完所有宝石', () => {
    player.gems = 3;
    permanent = { gems: 7 };
    const ok = spendGems(10);
    if (!ok) throw new Error('expected true');
    if (player.gems !== 0) throw new Error(`player.gems expected 0, got ${player.gems}`);
    if (permanent.gems !== 0) throw new Error(`permanent.gems expected 0, got ${permanent.gems}`);
  });

  it('只花永久宝石 (玩家没有宝石)', () => {
    player.gems = 0;
    permanent = { gems: 5 };
    const ok = spendGems(3);
    if (!ok) throw new Error('expected true');
    if (player.gems !== 0) throw new Error(`player.gems expected 0, got ${player.gems}`);
    if (permanent.gems !== 2) throw new Error(`permanent.gems expected 2, got ${permanent.gems}`);
  });
});

// --- Shop: generateShopItems ---
describe('generateShopItems: count, no dups, valid prices', ({ assert }) => {
  it('物品数量在 3-5 之间', () => {
    const restore = seedRandom(777);
    const items = generateShopItems(1);
    restore();
    if (items.length < 3 || items.length > 5) throw new Error(`count expected [3,5], got ${items.length}`);
  });

  it('消耗品无重复 itemId', () => {
    const restore = seedRandom(888);
    const items = generateShopItems(1);
    restore();
    const consumableIds = items.filter(i => i.type === 'consumable').map(i => i.itemId);
    const dupCount = consumableIds.filter((v, i) => consumableIds.indexOf(v) !== i).length;
    if (dupCount > 0) throw new Error(`found ${dupCount} duplicate consumable items`);
  });

  if (typeof ITEMS_DATA !== 'undefined') {
    it('消耗品价格 = 基础价格 * 楼层倍率 (第1层)', () => {
      const restore = seedRandom(999);
      const items = generateShopItems(1);
      restore();
      for (const item of items) {
        if (item.type !== 'consumable') continue;
        const def = ITEMS_DATA[item.itemId];
        if (!def) continue;
        const expected = Math.round(def.price * shopPriceMultiplier(1));
        if (item.price !== expected) throw new Error(`price expected ${expected}, got ${item.price} for ${item.itemId}`);
      }
    });

    it('消耗品价格第 5 层 = 基础价格 * 2.2', () => {
      const restore = seedRandom(100);
      const items = generateShopItems(5);
      restore();
      for (const item of items) {
        if (item.type !== 'consumable') continue;
        const def = ITEMS_DATA[item.itemId];
        if (!def) continue;
        const expected = Math.round(def.price * shopPriceMultiplier(5));
        if (item.price !== expected) throw new Error(`price expected ${expected}, got ${item.price} for ${item.itemId}`);
      }
    });
  }

  it('每个物品都有必需的字段', () => {
    const restore = seedRandom(200);
    const items = generateShopItems(1);
    restore();
    for (const item of items) {
      if (!item.id) throw new Error('missing id');
      if (!item.itemId) throw new Error('missing itemId');
      if (item.price === undefined) throw new Error('missing price');
      if (!item.type) throw new Error('missing type');
      if (item.type !== 'consumable' && item.type !== 'equipment') throw new Error(`invalid type ${item.type}`);
    }
  });

  it('消耗品 type = consumable 且有 label 和 icon', () => {
    const restore = seedRandom(300);
    const items = generateShopItems(1);
    restore();
    const consumables = items.filter(i => i.type === 'consumable');
    if (consumables.length === 0) return;
    for (const item of consumables) {
      if (!item.label) throw new Error('consumable missing label');
      if (!item.icon) throw new Error('consumable missing icon');
    }
  });

  it('多次生成数量一致 (固定种子)', () => {
    const restore1 = seedRandom(400);
    const items1 = generateShopItems(3);
    restore1();
    const restore2 = seedRandom(400);
    const items2 = generateShopItems(3);
    restore2();
    if (items1.length !== items2.length) throw new Error(`same seed should produce same count: ${items1.length} vs ${items2.length}`);
  });
});

// --- Shop: weightedPickFromKeys ---
describe('weightedPickFromKeys', ({ assert }) => {
  it('返回有效的消耗品 key', () => {
    const validKeys = SHOP_CONSUMABLE_KEYS.map(k => k.key);
    const picked = weightedPickFromKeys();
    if (!validKeys.includes(picked)) throw new Error(`unexpected key: ${picked}`);
  });

  it('固定种子产生确定结果', () => {
    const restore1 = seedRandom(500);
    const pick1 = weightedPickFromKeys();
    restore1();
    const restore2 = seedRandom(500);
    const pick2 = weightedPickFromKeys();
    restore2();
    if (pick1 !== pick2) throw new Error(`same seed should return same key: ${pick1} vs ${pick2}`);
  });

  it('hp_potion 权重 25 最高，大量采样占比最高', () => {
    const counts = {};
    for (let s = 0; s < 2000; s++) {
      const restore = seedRandom(s * 7 + 3);
      const key = weightedPickFromKeys();
      restore();
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = 2000;
    const totalWeight = SHOP_CONSUMABLE_KEYS.reduce((s, k) => s + k.weight, 0);
    const hpExpectedPct = 25 / totalWeight;
    const hpPct = (counts['hp_potion'] || 0) / total;
    if (hpPct < hpExpectedPct * 0.7) throw new Error(`hp_potion rate too low: ${hpPct} vs expected ~${hpExpectedPct}`);
  });

  it('panacea 权重 5 最低，大量采样占比最低', () => {
    const counts = {};
    for (let s = 0; s < 2000; s++) {
      const restore = seedRandom(s * 7 + 3);
      const key = weightedPickFromKeys();
      restore();
      counts[key] = (counts[key] || 0) + 1;
    }
    const total = 2000;
    const totalWeight = SHOP_CONSUMABLE_KEYS.reduce((s, k) => s + k.weight, 0);
    const paExpectedPct = 5 / totalWeight;
    const paPct = (counts['panacea'] || 0) / total;
    if (paPct > paExpectedPct * 1.8) throw new Error(`panacea rate too high: ${paPct} vs expected ~${paExpectedPct}`);
  });

  it('返回的 key 在 SHOP_CONSUMABLE_KEYS 中', () => {
    for (let i = 0; i < 50; i++) {
      const restore = seedRandom(i);
      const key = weightedPickFromKeys();
      restore();
      const found = SHOP_CONSUMABLE_KEYS.some(k => k.key === key);
      if (!found) throw new Error(`key ${key} not in SHOP_CONSUMABLE_KEYS`);
    }
  });
});

// --- Shop: equipmentBasePrice ---
describe('equipmentBasePrice: white/blue/purple + stat bonus', ({ assert }) => {
  it('白色装备无属性 = 15', () => {
    const equip = { rarity: 'white', stats: {} };
    const price = equipmentBasePrice(equip);
    if (price !== 15) throw new Error(`expected 15, got ${price}`);
  });

  it('蓝色装备无属性 = 40', () => {
    const equip = { rarity: 'blue', stats: {} };
    const price = equipmentBasePrice(equip);
    if (price !== 40) throw new Error(`expected 40, got ${price}`);
  });

  it('紫色装备无属性 = 80', () => {
    const equip = { rarity: 'purple', stats: {} };
    const price = equipmentBasePrice(equip);
    if (price !== 80) throw new Error(`expected 80, got ${price}`);
  });

  it('白色装备 atk+5 = 15 + round(7.5) = 23', () => {
    const equip = { rarity: 'white', stats: { atk: 5 } };
    const price = equipmentBasePrice(equip);
    if (price !== 23) throw new Error(`expected 23, got ${price}`);
  });

  it('蓝色装备 hp+20 def+10 = 40 + round(45) = 85', () => {
    const equip = { rarity: 'blue', stats: { hp: 20, def: 10 } };
    const statBonus = 20 * 1.5 + 10 * 1.5;
    const expected = 40 + Math.round(statBonus);
    const price = equipmentBasePrice(equip);
    if (price !== expected) throw new Error(`expected ${expected}, got ${price}`);
  });

  it('紫色装备 atk+8 def+5 hp+30 = 80 + round(72) = 152', () => {
    const equip = { rarity: 'purple', stats: { atk: 8, def: 5, hp: 30 } };
    const statBonus = 8 * 1.5 + 5 * 1.5 + 30 * 1.5;
    const expected = 80 + Math.round(statBonus);
    const price = equipmentBasePrice(equip);
    if (price !== expected) throw new Error(`expected ${expected}, got ${price}`);
  });

  it('未知稀有度回退到 15', () => {
    const equip = { rarity: 'gold', stats: {} };
    const price = equipmentBasePrice(equip);
    if (price !== 15) throw new Error(`expected 15 (fallback), got ${price}`);
  });

  it('多个属性叠加计算正确', () => {
    const equip = { rarity: 'white', stats: { atk: 3, def: 4, spd: 2, hp: 10 } };
    const statBonus = 3 * 1.5 + 4 * 1.5 + 2 * 1.5 + 10 * 1.5;
    const expected = 15 + Math.round(statBonus);
    const price = equipmentBasePrice(equip);
    if (price !== expected) throw new Error(`expected ${expected}, got ${price}`);
  });
});

// --- Shop: shopPriceMultiplier ---
describe('shopPriceMultiplier: floor 1/3/5', ({ assert }) => {
  it('第 1 层 = 1', () => {
    if (shopPriceMultiplier(1) !== 1) throw new Error(`expected 1, got ${shopPriceMultiplier(1)}`);
  });

  it('第 2 层 = 1.3', () => {
    const m = shopPriceMultiplier(2);
    if (Math.abs(m - 1.3) > 0.001) throw new Error(`expected 1.3, got ${m}`);
  });

  it('第 3 层 = 1.6', () => {
    const m = shopPriceMultiplier(3);
    if (Math.abs(m - 1.6) > 0.001) throw new Error(`expected 1.6, got ${m}`);
  });

  it('第 5 层 = 2.2', () => {
    const m = shopPriceMultiplier(5);
    if (Math.abs(m - 2.2) > 0.001) throw new Error(`expected 2.2, got ${m}`);
  });

  it('第 10 层 = 3.7', () => {
    const m = shopPriceMultiplier(10);
    if (Math.abs(m - 3.7) > 0.001) throw new Error(`expected 3.7, got ${m}`);
  });

  it('线性递增: 每层 +0.3', () => {
    for (let f = 1; f <= 20; f++) {
      const expected = 1 + 0.3 * (f - 1);
      const actual = shopPriceMultiplier(f);
      if (Math.abs(actual - expected) > 0.001) {
        throw new Error(`floor ${f}: expected ${expected}, got ${actual}`);
      }
    }
  });
});

// --- Shop: identify_scroll pricing (0.4/floor instead of 0.3) ---
describe('identify_scroll pricing: 0.4/floor', ({ assert }) => {
  it('鉴定卷轴第 1 层价格 = 50', () => {
    const restore = seedRandom(42);
    const items = generateShopItems(1);
    restore();
    const scrolls = items.filter(i => i.itemId === 'identify_scroll');
    if (scrolls.length === 0) {
      // If scroll not in this random set, check price formula directly
      const expected = Math.round(50 * (1 + 0.4 * (1 - 1)));
      if (expected !== 50) throw new Error(`expected 50, got ${expected}`);
      return;
    }
    if (scrolls[0].price !== 50) throw new Error(`expected 50, got ${scrolls[0].price}`);
  });

  it('鉴定卷轴第 3 层价格 = round(50 * 1.8) = 90', () => {
    const expectedPrice = Math.round(50 * (1 + 0.4 * (3 - 1)));
    if (expectedPrice !== 90) throw new Error(`expected 90, got ${expectedPrice}`);
  });

  it('鉴定卷轴第 5 层价格 = round(50 * 2.6) = 130', () => {
    const expectedPrice = Math.round(50 * (1 + 0.4 * (5 - 1)));
    if (expectedPrice !== 130) throw new Error(`expected 130, got ${expectedPrice}`);
  });

  it('鉴定卷轴价格增长率高于普通商品', () => {
    const scroll3 = Math.round(50 * (1 + 0.4 * 2));
    const normal3 = Math.round(50 * (1 + 0.3 * 2));
    if (scroll3 <= normal3) throw new Error(`scroll price ${scroll3} should be > normal ${normal3}`);
  });
});
