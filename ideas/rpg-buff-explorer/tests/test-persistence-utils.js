// test-persistence-utils.js — Persistence roundtrip, unlock, victory + utils edge cases
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// ============================================================
// persistence.js — save/load roundtrip, bad JSON, unlock, victory
// ============================================================

describe('savePermanent / loadPermanent roundtrip', ({ assert }) => {
  it('基本 save 后 load 数据一致', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 7;
    perm.permanentStats.totalKills = 42;
    savePermanent(perm);
    const loaded = loadPermanent();
    if (loaded.soulShards !== 7) throw new Error('soulShards: expected 7, got ' + loaded.soulShards);
    if (loaded.permanentStats.totalKills !== 42) throw new Error('totalKills: expected 42');
  });

  it('talents 数据经过 roundtrip 后保留', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.talents.vitalis = 3;
    perm.talents.might = 5;
    savePermanent(perm);
    const loaded = loadPermanent();
    if (loaded.talents.vitalis !== 3) throw new Error('vitalis: expected 3, got ' + loaded.talents.vitalis);
    if (loaded.talents.might !== 5) throw new Error('might: expected 5, got ' + loaded.talents.might);
  });

  it('unlockedBuffs 数组经过 roundtrip 后保留', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.unlockedBuffs.push('lifesteal');
    perm.unlockedBuffs.push('dragon_fury');
    savePermanent(perm);
    const loaded = loadPermanent();
    if (!loaded.unlockedBuffs.includes('lifesteal')) throw new Error('missing lifesteal');
    if (!loaded.unlockedBuffs.includes('dragon_fury')) throw new Error('missing dragon_fury');
  });

  it('buffUnlockProgress 经过 roundtrip 后保留', () => {
    localStorage.clear();
    const perm = loadPermanent();
    if (perm.buffUnlockProgress.kill) perm.buffUnlockProgress.kill['crit_lens'] = 9;
    savePermanent(perm);
    const loaded = loadPermanent();
    if (loaded.buffUnlockProgress.kill && loaded.buffUnlockProgress.kill['crit_lens'] !== 9)
      throw new Error('crit_lens progress: expected 9');
  });

  it('savePermanent(null) 不报错', () => {
    savePermanent(null); // should be a no-op
  });

  it('多次 save 以最后一次为准', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 1;
    savePermanent(perm);
    perm.soulShards = 99;
    savePermanent(perm);
    const loaded = loadPermanent();
    if (loaded.soulShards !== 99) throw new Error('soulShards: expected 99, got ' + loaded.soulShards);
  });
});

describe('loadPermanent 异常处理', ({ assert }) => {
  it('localStorage 为空时返回默认值', () => {
    localStorage.clear();
    const perm = loadPermanent();
    if (!perm) throw new Error('should not return null');
    if (perm.soulShards !== 0) throw new Error('soulShards: expected 0');
    if (!perm.unlockedBuffs || perm.unlockedBuffs.length === 0) throw new Error('should have default unlockedBuffs');
  });

  it('坏 JSON 字符串返回默认值', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, '{bad json!!!}');
    const perm = loadPermanent();
    if (!perm) throw new Error('should not return null on bad JSON');
    if (perm.soulShards !== 0) throw new Error('soulShards: expected 0 on fallback');
  });

  it('JSON 缺少 unlockedBuffs 字段时补默认值', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, JSON.stringify({ soulShards: 10, talents: {}, permanentStats: {} }));
    const perm = loadPermanent();
    if (!perm.unlockedBuffs || !Array.isArray(perm.unlockedBuffs)) throw new Error('should have default unlockedBuffs');
    if (perm.soulShards !== 10) throw new Error('soulShards: expected 10');
  });

  it('JSON 缺少 talents 字段时补默认值', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, JSON.stringify({ soulShards: 5, unlockedBuffs: ['iron_skin'] }));
    const perm = loadPermanent();
    if (!perm.talents || perm.talents.vitalis !== 0) throw new Error('should have default talents');
  });

  it('JSON 缺少 buffUnlockProgress 字段时补默认值', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, JSON.stringify({ soulShards: 0, talents: {}, unlockedBuffs: [] }));
    const perm = loadPermanent();
    if (!perm.buffUnlockProgress) throw new Error('should have default buffUnlockProgress');
  });

  it('soulShards 不是数字时使用 0', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, JSON.stringify({ soulShards: 'not_a_number', talents: {}, unlockedBuffs: [], permanentStats: {} }));
    const perm = loadPermanent();
    if (perm.soulShards !== 0) throw new Error('soulShards: expected 0 for non-number, got ' + perm.soulShards);
  });

  it('permanentStats 合并默认值（缺失字段补 0）', () => {
    localStorage.clear();
    localStorage.setItem(PERMANENT_KEY, JSON.stringify({ permanentStats: { totalKills: 99 }, talents: {}, unlockedBuffs: [] }));
    const perm = loadPermanent();
    if (perm.permanentStats.totalKills !== 99) throw new Error('totalKills: expected 99');
    if (perm.permanentStats.maxFloor !== 0) throw new Error('maxFloor: expected 0 default');
  });
});

describe('checkBuffUnlocks', ({ assert }) => {
  it('解锁新 buff（通过 kill 进度）', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.buffUnlockProgress.kill['crit_lens'] = 10;
    perm.permanentStats.totalKills = 10;
    const newUnlocks = checkBuffUnlocks(perm);
    if (newUnlocks.length === 0) throw new Error('expected at least 1 new unlock');
    if (!perm.unlockedBuffs.includes('crit_lens')) throw new Error('crit_lens should be unlocked');
  });

  it('已解锁的 buff 不会重复解锁', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.unlockedBuffs.push('lifesteal');
    perm.buffUnlockProgress.floor['lifesteal'] = 5;
    const newUnlocks = checkBuffUnlocks(perm);
    for (const u of newUnlocks) {
      if (u.id === 'lifesteal') throw new Error('lifesteal already unlocked, should not appear');
    }
  });

  it('通关解锁（clear 类型）', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.wins = 1;
    const newUnlocks = checkBuffUnlocks(perm);
    const ids = newUnlocks.map(u => u.id);
    if (!ids.includes('exp_vortex')) throw new Error('exp_vortex should unlock after 1 clear');
  });

  it('进度不足时不解锁', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.buffUnlockProgress.kill['flame_aura'] = 5;
    perm.permanentStats.totalKills = 5;
    const newUnlocks = checkBuffUnlocks(perm);
    const ids = newUnlocks.map(u => u.id);
    if (ids.includes('flame_aura')) throw new Error('flame_aura requires 30 kills, should not unlock');
  });

  it('死亡解锁（death 类型）', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.totalDeaths = 3;
    const newUnlocks = checkBuffUnlocks(perm);
    const ids = newUnlocks.map(u => u.id);
    if (!ids.includes('second_wind')) throw new Error('second_wind should unlock after 3 deaths');
  });
});

describe('unlockTalent', ({ assert }) => {
  it('成功升级一个天赋', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 10;
    const ok = unlockTalent(perm, 'vitalis');
    if (!ok) throw new Error('unlockTalent should return true');
    if (perm.talents.vitalis !== 1) throw new Error('vitalis: expected 1, got ' + perm.talents.vitalis);
    if (perm.soulShards !== 9) throw new Error('soulShards: expected 9, got ' + perm.soulShards);
  });

  it('等级已满 10 拒绝升级', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 100;
    perm.talents.vitalis = 10;
    const ok = unlockTalent(perm, 'vitalis');
    if (ok !== false) throw new Error('should return false at max level');
  });

  it('灵魂碎片不足时拒绝升级', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    perm.talents.vitalis = 0;
    const ok = unlockTalent(perm, 'vitalis');
    if (ok !== false) throw new Error('should return false with 0 shards');
  });

  it('已花费的碎片等于 soulShards 时拒绝升级', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 5;
    perm.talents.vitalis = 5;
    const ok = unlockTalent(perm, 'vitalis');
    if (ok !== false) throw new Error('should return false when totalSpent >= soulShards');
  });

  it('无效 talentId 返回 false', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 100;
    const ok = unlockTalent(perm, 'nonexistent_talent_xyz');
    if (ok !== false) throw new Error('should return false for invalid talentId');
  });

  it('连续升级多次正常递增', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 20;
    unlockTalent(perm, 'vitalis');
    unlockTalent(perm, 'vitalis');
    unlockTalent(perm, 'vitalis');
    if (perm.talents.vitalis !== 3) throw new Error('vitalis: expected 3 after 3 upgrades');
    if (perm.soulShards !== 17) throw new Error('soulShards: expected 17, got ' + perm.soulShards);
  });

  it('不同天赋升级互不影响', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 20;
    unlockTalent(perm, 'vitalis');
    unlockTalent(perm, 'might');
    if (perm.talents.vitalis !== 1) throw new Error('vitalis: expected 1');
    if (perm.talents.might !== 1) throw new Error('might: expected 1');
    if (perm.talents.ironwall !== 0) throw new Error('ironwall should still be 0');
    if (perm.soulShards !== 18) throw new Error('soulShards: expected 18, got ' + perm.soulShards);
  });
});

describe('onVictory', ({ assert }) => {
  it('soulShards 增加 3', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 5;
    gameState.floor = 3;
    onVictory(perm);
    if (perm.soulShards !== 8) throw new Error('soulShards: expected 8, got ' + perm.soulShards);
  });

  it('wins 和 totalRuns 各加 1', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.wins = 0;
    perm.permanentStats.totalRuns = 0;
    gameState.floor = 1;
    onVictory(perm);
    if (perm.permanentStats.wins !== 1) throw new Error('wins: expected 1');
    if (perm.permanentStats.totalRuns !== 1) throw new Error('totalRuns: expected 1');
  });

  it('maxFloor 更新为当前楼层（高于之前）', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.maxFloor = 2;
    gameState.floor = 5;
    onVictory(perm);
    if (perm.permanentStats.maxFloor !== 5) throw new Error('maxFloor: expected 5, got ' + perm.permanentStats.maxFloor);
  });

  it('maxFloor 不更新（当前楼层低于之前）', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.maxFloor = 5;
    gameState.floor = 3;
    onVictory(perm);
    if (perm.permanentStats.maxFloor !== 5) throw new Error('maxFloor should stay 5');
  });

  it('调用 trackProgress 间接触发 buff 解锁', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.wins = 0;
    perm.buffUnlockProgress.clear['exp_vortex'] = 0;
    gameState.floor = 1;
    onVictory(perm);
    if (!perm.unlockedBuffs.includes('exp_vortex')) throw new Error('exp_vortex should unlock on victory (wins reached 1)');
  });

  it('数据保存到 localStorage', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    perm.permanentStats.wins = 0;
    gameState.floor = 1;
    onVictory(perm);
    const loaded = loadPermanent();
    if (loaded.soulShards !== 3) throw new Error('saved soulShards: expected 3');
    if (loaded.permanentStats.wins !== 1) throw new Error('saved wins: expected 1');
  });

  it('多次 victory 累计 shards', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    perm.permanentStats.wins = 0;
    gameState.floor = 1;
    onVictory(perm);
    onVictory(perm);
    onVictory(perm);
    if (perm.soulShards !== 9) throw new Error('soulShards: expected 9 after 3 victories');
    if (perm.permanentStats.wins !== 3) throw new Error('wins: expected 3');
  });
});

describe('onDeath', ({ assert }) => {
  it('totalDeaths 和 totalRuns 各加 1', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.totalDeaths = 0;
    perm.permanentStats.totalRuns = 0;
    player.gold = 100;
    gameState.floor = 2;
    onDeath(perm);
    if (perm.permanentStats.totalDeaths !== 1) throw new Error('totalDeaths: expected 1');
    if (perm.permanentStats.totalRuns !== 1) throw new Error('totalRuns: expected 1');
  });

  it('返回 player.gold 的 50%', () => {
    localStorage.clear();
    const perm = loadPermanent();
    player.gold = 80;
    gameState.floor = 1;
    const kept = onDeath(perm);
    if (kept !== 40) throw new Error('keptGold: expected 40, got ' + kept);
  });

  it('player 为 null 时 keptGold 为 0', () => {
    localStorage.clear();
    const perm = loadPermanent();
    const orig = player;
    player = null;
    gameState.floor = 1;
    const kept = onDeath(perm);
    player = orig;
    if (kept !== 0) throw new Error('keptGold: expected 0 when player is null');
  });

  it('更新 maxFloor', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.permanentStats.maxFloor = 1;
    gameState.floor = 4;
    onDeath(perm);
    if (perm.permanentStats.maxFloor !== 4) throw new Error('maxFloor: expected 4');
  });

  it('odd gold 向下取整 50%', () => {
    localStorage.clear();
    const perm = loadPermanent();
    player.gold = 31;
    gameState.floor = 1;
    const kept = onDeath(perm);
    if (kept !== 15) throw new Error('keptGold: expected 15 (floor of 31/2), got ' + kept);
  });
});

describe('addSoulShards', ({ assert }) => {
  it('增加指定数量碎片', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 5;
    addSoulShards(perm, 10);
    if (perm.soulShards !== 15) throw new Error('soulShards: expected 15, got ' + perm.soulShards);
  });

  it('保存到 localStorage', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    addSoulShards(perm, 3);
    const loaded = loadPermanent();
    if (loaded.soulShards !== 3) throw new Error('saved soulShards: expected 3');
  });

  it('增加 0 不改变碎片', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 10;
    addSoulShards(perm, 0);
    if (perm.soulShards !== 10) throw new Error('soulShards: expected 10, got ' + perm.soulShards);
  });

  it('多次调用累加', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    addSoulShards(perm, 5);
    addSoulShards(perm, 3);
    addSoulShards(perm, 2);
    if (perm.soulShards !== 10) throw new Error('soulShards: expected 10, got ' + perm.soulShards);
  });

  it('增加负数减少碎片', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 20;
    addSoulShards(perm, -5);
    if (perm.soulShards !== 15) throw new Error('soulShards: expected 15, got ' + perm.soulShards);
  });

  it('大数额增加不溢出', () => {
    localStorage.clear();
    const perm = loadPermanent();
    perm.soulShards = 0;
    addSoulShards(perm, 999999);
    if (perm.soulShards !== 999999) throw new Error('soulShards: expected 999999');
  });
});

describe('defaultPermanentStats', ({ assert }) => {
  it('所有字段初始化为 0', () => {
    const stats = defaultPermanentStats();
    const keys = ['totalKills', 'maxFloor', 'totalRuns', 'bossKills', 'totalGold', 'totalDeaths', 'wins', 'totalDamageDealt'];
    for (const k of keys) {
      if (stats[k] !== 0) throw new Error(k + ': expected 0, got ' + stats[k]);
    }
  });

  it('恰好 8 个字段', () => {
    const keys = Object.keys(defaultPermanentStats());
    if (keys.length !== 8) throw new Error('expected 8 keys, got ' + keys.length);
  });

  it('每次调用返回新对象', () => {
    const a = defaultPermanentStats();
    const b = defaultPermanentStats();
    if (a === b) throw new Error('should return new object each call');
  });

  it('totalKills 字段存在', () => {
    const s = defaultPermanentStats();
    if (s.totalKills === undefined) throw new Error('totalKills field missing');
  });

  it('maxFloor 字段存在', () => {
    const s = defaultPermanentStats();
    if (s.maxFloor === undefined) throw new Error('maxFloor field missing');
  });

  it('totalDamageDealt 字段存在', () => {
    const s = defaultPermanentStats();
    if (s.totalDamageDealt === undefined) throw new Error('totalDamageDealt field missing');
  });
});

describe('defaultTalents', ({ assert }) => {
  it('5 个天赋初始为 0', () => {
    const t = defaultTalents();
    if (Object.keys(t).length !== 5) throw new Error('expected 5 talents');
    for (const k in t) {
      if (t[k] !== 0) throw new Error(k + ': expected 0, got ' + t[k]);
    }
  });

  it('包含 vitalis 天赋', () => {
    const t = defaultTalents();
    if (t.vitalis === undefined) throw new Error('vitalis missing');
  });

  it('包含 mana_wellspring 天赋', () => {
    const t = defaultTalents();
    if (t.mana_wellspring === undefined) throw new Error('mana_wellspring missing');
  });

  it('包含 might 天赋', () => {
    const t = defaultTalents();
    if (t.might === undefined) throw new Error('might missing');
  });

  it('包含 ironwall 天赋', () => {
    const t = defaultTalents();
    if (t.ironwall === undefined) throw new Error('ironwall missing');
  });

  it('包含 eagle_eye 天赋', () => {
    const t = defaultTalents();
    if (t.eagle_eye === undefined) throw new Error('eagle_eye missing');
  });
});

// ============================================================
// utils.js — clamp, manhattan, inBounds, shuffle, weightedPick
// ============================================================

describe('clamp', ({ assert }) => {
  it('值在范围内原样返回', () => {
    if (clamp(5, 0, 10) !== 5) throw new Error('expected 5');
  });

  it('小于下限返回 min', () => {
    if (clamp(-3, 0, 10) !== 0) throw new Error('expected 0');
  });

  it('大于上限返回 max', () => {
    if (clamp(15, 0, 10) !== 10) throw new Error('expected 10');
  });

  it('负数区间也正常工作', () => {
    if (clamp(-5, -10, -1) !== -5) throw new Error('expected -5');
    if (clamp(-15, -10, -1) !== -10) throw new Error('expected -10');
    if (clamp(0, -10, -1) !== -1) throw new Error('expected -1');
  });

  it('min === max 时始终返回该值', () => {
    if (clamp(99, 5, 5) !== 5) throw new Error('expected 5');
  });
});

describe('manhattan', ({ assert }) => {
  it('同一点距离为 0', () => {
    if (manhattan(0, 0, 0, 0) !== 0) throw new Error('expected 0');
  });

  it('标准距离 (0,0)->(3,4) = 7', () => {
    if (manhattan(0, 0, 3, 4) !== 7) throw new Error('expected 7');
  });

  it('负坐标 (-2,-3)->(1,1) = 7', () => {
    if (manhattan(-2, -3, 1, 1) !== 7) throw new Error('expected 7');
  });

  it('仅 x 轴不同 (0,5)->(8,5) = 8', () => {
    if (manhattan(0, 5, 8, 5) !== 8) throw new Error('expected 8');
  });

  it('仅 y 轴不同 (3,0)->(3,12) = 12', () => {
    if (manhattan(3, 0, 3, 12) !== 12) throw new Error('expected 12');
  });

  it('对称性 manhattan(a,b) === manhattan(b,a)', () => {
    if (manhattan(1, 2, 9, 20) !== manhattan(9, 20, 1, 2))
      throw new Error('manhattan not symmetric');
  });
});

describe('inBounds', ({ assert }) => {
  it('(0,0) 在范围内', () => {
    if (inBounds(0, 0) !== true) throw new Error('expected true');
  });

  it('(39,29) 在范围内 (MAP_W-1, MAP_H-1)', () => {
    if (inBounds(39, 29) !== true) throw new Error('expected true');
  });

  it('x 为负时超出范围', () => {
    if (inBounds(-1, 0) !== false) throw new Error('expected false for x=-1');
  });

  it('y 等于 MAP_H 时超出范围', () => {
    if (inBounds(0, 30) !== false) throw new Error('expected false for y=MAP_H');
  });

  it('x 等于 MAP_W 时超出范围', () => {
    if (inBounds(40, 15) !== false) throw new Error('expected false for x=MAP_W');
  });

  it('y 为负时超出范围', () => {
    if (inBounds(20, -5) !== false) throw new Error('expected false for y=-5');
  });

  it('大负数坐标超出范围', () => {
    if (inBounds(-100, -100) !== false) throw new Error('expected false');
  });
});

describe('shuffle', ({ assert }) => {
  it('空数组不报错且返回空', () => {
    const arr = [];
    const result = shuffle(arr);
    if (result.length !== 0) throw new Error('expected empty');
  });

  it('长度保持不变', () => {
    const restore = seedRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    shuffle(arr);
    restore();
    if (arr.length !== 10) throw new Error('length should be 10');
  });

  it('包含相同的元素（排序后相等）', () => {
    const restore = seedRandom(99);
    const arr = [5, 3, 1, 4, 2];
    const original = arr.slice().sort();
    shuffle(arr);
    arr.sort();
    restore();
    if (JSON.stringify(arr) !== JSON.stringify(original))
      throw new Error('elements not conserved after shuffle');
  });

  it('单元素不变', () => {
    const arr = [42];
    shuffle(arr);
    if (arr[0] !== 42) throw new Error('expected 42');
  });

  it('返回同一数组引用', () => {
    const arr = [1, 2, 3];
    if (shuffle(arr) !== arr) throw new Error('expected same reference');
  });

  it('seedRandom 下结果可复现', () => {
    const restore1 = seedRandom(123);
    const a = [1, 2, 3, 4, 5];
    shuffle(a);
    const result1 = a.slice();
    restore1();

    const restore2 = seedRandom(123);
    const b = [1, 2, 3, 4, 5];
    shuffle(b);
    const result2 = b.slice();
    restore2();

    if (JSON.stringify(result1) !== JSON.stringify(result2))
      throw new Error('shuffle not deterministic with same seed');
  });
});

describe('weightedPick', ({ assert }) => {
  it('单元素必选', () => {
    if (weightedPick([{ item: 'a', weight: 10 }]) !== 'a')
      throw new Error('expected a');
  });

  it('没有 .item 属性时返回条目本身', () => {
    const result = weightedPick([{ weight: 5, label: 'x' }]);
    if (result.label !== 'x') throw new Error('expected entry object');
  });

  it('没有 .item 属性且多条目', () => {
    const restore = seedRandom(7);
    const items = [{ weight: 3, name: 'alpha' }, { weight: 7, name: 'beta' }];
    const result = weightedPick(items);
    restore();
    if (!result || !result.name) throw new Error('expected an entry object with name');
    if (result.name !== 'alpha' && result.name !== 'beta')
      throw new Error('expected alpha or beta, got ' + (result ? result.name : 'null'));
  });

  it('weight=0 的元素不会被选中（当有其他元素时）', () => {
    const restore = seedRandom(1);
    const result = weightedPick([
      { item: 'a', weight: 0 },
      { item: 'b', weight: 10 }
    ]);
    restore();
    if (result !== 'b') throw new Error('expected b, got ' + result);
  });

  it('大量采样验证分布大致正确', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const restore = seedRandom(i);
      const r = weightedPick([
        { item: 'a', weight: 9 },
        { item: 'b', weight: 1 }
      ]);
      restore();
      counts[r]++;
    }
    if (counts.a < 850 || counts.a > 950)
      throw new Error('distribution off: a=' + counts.a + ', b=' + counts.b);
  });

  it('没有 .item 时所有 weight=0 返回第一个元素', () => {
    const result = weightedPick([
      { weight: 0, label: 'first' },
      { weight: 0, label: 'second' }
    ]);
    if (result.label !== 'first') throw new Error('expected first item when all weights 0');
  });
});
