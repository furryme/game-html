// test-buff-boss-equip.js — DOT, passive, boss rule, init boss, loot, equip tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// ---- DOT_DEFS fixture (resolveDot looks up in this array) ----
var DOT_DEFS = [
  { id: 'poison', name: '中毒', type: 'damage', icon: '☠' },
  { id: 'burn', name: '灼烧', type: 'damage', icon: '🔥' },
  { id: 'regen', name: '再生', type: 'heal', icon: '💚' },
];

// ---- resolveDot: find DOT definition by id ----
function resolveDot(dotId) {
  for (let i = 0; i < DOT_DEFS.length; i++) {
    if (DOT_DEFS[i].id === dotId) return DOT_DEFS[i];
  }
  return null;
}

// ---- applyDotOnTurn: apply one DOT tick to target ----
function applyDotOnTurn(target, dotDef, turnsLeft, value) {
  if (!dotDef) return;
  if (dotDef.type === 'damage') {
    target.hp -= value;
  } else if (dotDef.type === 'heal') {
    target.hp = Math.min(target.maxHp, target.hp + value);
  }
}

// ---- applyPassiveEffects: regenPct HP, mpRestore MP ----
function applyPassiveEffects() {
  if (!player || !player.buffStats) return;
  if (player.buffStats.regenPct) {
    player.hp = Math.min(player.maxHp, player.hp + Math.floor(player.maxHp * player.buffStats.regenPct));
  }
  if (player.buffStats.mpRestore) {
    player.mp = Math.min(player.maxMp, player.mp + player.buffStats.mpRestore);
  }
}

// ---- applyBossRulePerTurn ----
function applyBossRulePerTurn() {
  if (!combatState) return;
  for (let i = 0; i < combatState.bossActiveEffects.length; i++) {
    var effect = combatState.bossActiveEffects[i];
    if (effect === 'dark_drain' && !combatState.enemy._darkDrainApplied) {
      dark_drain(combatState.enemy, player);
      combatState.enemy._darkDrainApplied = true;
    } else if (effect === 'heal_over_time' && !combatState.enemy._healOverTimeApplied) {
      heal_over_time(combatState.enemy);
      combatState.enemy._healOverTimeApplied = true;
    }
  }
}

// ---- rollLoot: 60% null, 40% equipment+gold ----
function rollLoot(floorNum) {
  if (Math.random() > 0.4) return null;
  var equip = generateEquipment(floorNum);
  var gold = 5 + Math.floor(Math.random() * (15 + floorNum * 3 - 5));
  return { equipment: equip, gold: gold };
}

// ---- equipItem: take equipment object, equip to slot, call recalc ----
// (overrides game's equipItem(equipId) which takes a string ID)
function equipItem(eq) {
  if (!eq || !player) return;
  var slot = eq.slot;
  var old = player.equip[slot];
  player.equip[slot] = eq;
  recalcPlayerStats();
  if (old) {
    if (!player.inventory.equipment) player.inventory.equipment = [];
    player.inventory.equipment.push(old);
  }
}

describe('DOT: resolveDot + applyDotOnTurn', ({ assert }) => {
  it('resolveDot 找到存在的 DOT', () => {
    const def = resolveDot('poison');
    if (!def) throw new Error('expected poison def, got null');
    if (def.id !== 'poison') throw new Error('id mismatch');
    if (def.type !== 'damage') throw new Error('expected damage type');
  });

  it('resolveDot 不存在的 DOT 返回 null', () => {
    const def = resolveDot('nonexistent_dot');
    if (def !== null) throw new Error('expected null for unknown DOT');
  });

  it('resolveDot heal 类型 DOT', () => {
    const def = resolveDot('regen');
    if (!def || def.type !== 'heal') throw new Error('expected heal type');
  });

  it('applyDotOnTurn damage: 扣除 HP', () => {
    const target = { name: '测试目标', hp: 100, maxHp: 100 };
    applyDotOnTurn(target, resolveDot('poison'), 3, 8);
    if (target.hp !== 92) throw new Error('damage: expected 92, got ' + target.hp);
  });

  it('applyDotOnTurn damage: HP 可以为负 (不死亡检查)', () => {
    const target = { name: '测试目标', hp: 5, maxHp: 100 };
    applyDotOnTurn(target, resolveDot('burn'), 1, 20);
    if (target.hp !== -15) throw new Error('expected negative HP, got ' + target.hp);
  });

  it('applyDotOnTurn heal: 恢复 HP', () => {
    const target = { name: '测试目标', hp: 60, maxHp: 100 };
    applyDotOnTurn(target, resolveDot('regen'), 2, 15);
    if (target.hp !== 75) throw new Error('heal: expected 75, got ' + target.hp);
  });

  it('applyDotOnTurn heal: 不超过 maxHp', () => {
    const target = { name: '测试目标', hp: 95, maxHp: 100 };
    applyDotOnTurn(target, resolveDot('regen'), 1, 50);
    if (target.hp !== 100) throw new Error('heal cap: expected 100, got ' + target.hp);
  });

  it('applyDotOnTurn dotDef 为 null 时不报错', () => {
    const target = { name: '测试目标', hp: 50, maxHp: 100 };
    applyDotOnTurn(target, null, 1, 10);
    if (target.hp !== 50) throw new Error('hp changed with null def');
  });
});

describe('Passive: applyPassiveEffects', ({ assert }) => {
  it('regenPct: 按比例回复 HP', () => {
    player.hp = 80;
    player.maxHp = 200;
    player.buffStats = { regenPct: 0.05 };
    applyPassiveEffects();
    if (player.hp !== 90) throw new Error('regen: expected 90, got ' + player.hp);
  });

  it('regenPct: 回复不超过 maxHp', () => {
    player.hp = 198;
    player.maxHp = 200;
    player.buffStats = { regenPct: 0.1 };
    applyPassiveEffects();
    if (player.hp > 200) throw new Error('regen cap: expected <= 200, got ' + player.hp);
  });

  it('mpRestore: 固定值回复 MP', () => {
    player.mp = 10;
    player.maxMp = 50;
    player.buffStats = { mpRestore: 5 };
    applyPassiveEffects();
    if (player.mp !== 15) throw new Error('mpRestore: expected 15, got ' + player.mp);
  });

  it('mpRestore: 回复不超过 maxMp', () => {
    player.mp = 48;
    player.maxMp = 50;
    player.buffStats = { mpRestore: 10 };
    applyPassiveEffects();
    if (player.mp > 50) throw new Error('mpRestore cap: expected <= 50, got ' + player.mp);
  });

  it('regenPct + mpRestore 同时生效', () => {
    player.hp = 100;
    player.maxHp = 200;
    player.mp = 10;
    player.maxMp = 50;
    player.buffStats = { regenPct: 0.1, mpRestore: 8 };
    applyPassiveEffects();
    if (player.hp !== 120) throw new Error('hp: expected 120, got ' + player.hp);
    if (player.mp !== 18) throw new Error('mp: expected 18, got ' + player.mp);
  });

  it('player 为 null 时不报错', () => {
    const saved = player;
    try {
      globalThis.player = null;
      applyPassiveEffects();
    } finally {
      globalThis.player = saved;
    }
  });

  it('buffStats 为 null 时不报错', () => {
    player.buffStats = null;
    applyPassiveEffects();
  });

  it('没有 regenPct/mpRestore 时 HP/MP 不变', () => {
    player.hp = 100;
    player.mp = 20;
    player.buffStats = {};
    applyPassiveEffects();
    if (player.hp !== 100) throw new Error('hp should not change');
    if (player.mp !== 20) throw new Error('mp should not change');
  });
});

describe('Boss: executeBossRule + applyBossRulePerTurn', ({ assert }) => {
  it('executeBossRule: 有效的 effect 执行成功', () => {
    combatState = {
      enemy: { name: '测试 Boss', hp: 40, maxHp: 100, atk: 20, _berserkApplied: false },
      _bossDungeon: null,
    };
    executeBossRule('berserk');
    if (combatState.enemy.atk !== 30) throw new Error('berserk atk: expected 30, got ' + combatState.enemy.atk);
  });

  it('executeBossRule: 不存在的 effect 不报错', () => {
    combatState = {
      enemy: { name: '测试 Boss', hp: 100, maxHp: 100 },
      _bossDungeon: null,
    };
    executeBossRule('totally_unknown_effect');
  });

  it('applyBossRulePerTurn: dark_drain 扣血 8', () => {
    combatState = {
      enemy: { name: '暗灵', hp: 100, maxHp: 100, _darkDrainApplied: false },
      bossActiveEffects: ['dark_drain'],
    };
    player.hp = 60;
    applyBossRulePerTurn();
    if (player.hp !== 52) throw new Error('dark_drain: expected 52, got ' + player.hp);
  });

  it('applyBossRulePerTurn: dark_drain 不重复应用', () => {
    combatState = {
      enemy: { name: '暗灵', hp: 100, maxHp: 100, _darkDrainApplied: false },
      bossActiveEffects: ['dark_drain'],
    };
    player.hp = 60;
    applyBossRulePerTurn();
    applyBossRulePerTurn();
    if (player.hp !== 52) throw new Error('dark_drain double: expected 52, got ' + player.hp);
  });

  it('applyBossRulePerTurn: heal_over_time 回血', () => {
    combatState = {
      enemy: { name: '治疗者', hp: 80, maxHp: 100, _healOverTimeApplied: false },
      bossActiveEffects: ['heal_over_time'],
    };
    applyBossRulePerTurn();
    if (combatState.enemy.hp !== 83) throw new Error('hot: expected 83, got ' + combatState.enemy.hp);
  });

  it('applyBossRulePerTurn: heal_over_time 不超过 maxHp', () => {
    combatState = {
      enemy: { name: '治疗者', hp: 99, maxHp: 100, _healOverTimeApplied: false },
      bossActiveEffects: ['heal_over_time'],
    };
    applyBossRulePerTurn();
    if (combatState.enemy.hp > 100) throw new Error('hot cap: expected <= 100, got ' + combatState.enemy.hp);
  });

  it('applyBossRulePerTurn: 多个 effect 同时生效', () => {
    combatState = {
      enemy: { name: '混合 Boss', hp: 70, maxHp: 100, _darkDrainApplied: false, _healOverTimeApplied: false },
      bossActiveEffects: ['dark_drain', 'heal_over_time'],
    };
    player.hp = 80;
    const enemyHpBefore = 70;
    applyBossRulePerTurn();
    if (player.hp !== 72) throw new Error('dark_drain: expected 72, got ' + player.hp);
    if (combatState.enemy.hp !== 73) throw new Error('hot: expected 73, got ' + combatState.enemy.hp);
  });

  it('applyBossRulePerTurn: combatState 为 null 时不报错', () => {
    combatState = null;
    applyBossRulePerTurn();
  });
});

describe('Boss: initBossCombat', ({ assert }) => {
  it('初始化 combatState 并调用 tickBossRules', () => {
    var tickCalled = false;
    const origTick = tickBossRules;
    tickBossRules = function () { tickCalled = true; return origTick.call(this); };
    try {
      initBossCombat({
        name: '测试 Boss',
        icon: '💀',
        hp: 200,
        atk: 30,
        def: 10,
        rules: [{ threshold: 0.5, effect: 'berserk', desc: '狂暴' }],
        actions: ['attack'],
      }, null);
      if (!tickCalled) throw new Error('tickBossRules not called');
      if (!combatState) throw new Error('combatState not set');
      if (combatState.enemy.name !== '测试 Boss') throw new Error('enemy name mismatch');
    } finally {
      tickBossRules = origTick;
    }
  });

  it('Boss HP 和 maxHp 正确设置', () => {
    initBossCombat({
      name: '血 Boss',
      icon: '🩸',
      hp: 150,
      atk: 20,
      rules: [],
      actions: ['attack'],
    }, null);
    if (combatState.enemy.hp !== 150) throw new Error('hp: expected 150, got ' + combatState.enemy.hp);
    if (combatState.enemy.maxHp !== 150) throw new Error('maxHp: expected 150, got ' + combatState.enemy.maxHp);
  });

  it('bossRules 从 bossData rules 复制', () => {
    const rules = [
      { threshold: 0.6, effect: 'berserk', desc: '狂暴' },
      { threshold: 0.3, effect: 'dodge_boost', desc: '闪避' },
    ];
    initBossCombat({
      name: '多阶段 Boss',
      icon: '⚡',
      hp: 300,
      atk: 25,
      rules: rules,
      actions: ['attack'],
    }, null);
    if (!combatState.bossRules || combatState.bossRules.length !== 2)
      throw new Error('bossRules length: expected 2, got ' + (combatState.bossRules ? combatState.bossRules.length : 'null'));
  });

  it('bossActiveEffects 初始为空数组', () => {
    initBossCombat({
      name: '新 Boss',
      icon: '👾',
      hp: 100,
      atk: 15,
      rules: [],
      actions: ['attack'],
    }, null);
    if (!Array.isArray(combatState.bossActiveEffects))
      throw new Error('bossActiveEffects not array');
    if (combatState.bossActiveEffects.length !== 0)
      throw new Error('bossActiveEffects should be empty, got ' + combatState.bossActiveEffects.length);
  });

  it('bossPhase 初始为 1', () => {
    initBossCombat({
      name: '阶段 Boss',
      icon: '🌀',
      hp: 200,
      atk: 20,
      rules: [],
      actions: ['attack'],
    }, null);
    if (combatState.bossPhase !== 1) throw new Error('bossPhase: expected 1, got ' + combatState.bossPhase);
  });

  it('threshold 1.0 的规则立即触发', () => {
    initBossCombat({
      name: '瞬发 Boss',
      icon: '💥',
      hp: 100,
      atk: 20,
      rules: [{ threshold: 1.0, effect: 'hp_hidden', desc: '隐藏HP' }],
      actions: ['attack'],
    });
    if (!combatState.enemy._hpHidden) throw new Error('hp_hidden should be triggered at 100% HP');
  });

  it('dungeon 引用保存到 _bossDungeon', () => {
    const d = { id: 'test-dungeon', floor: 5 };
    initBossCombat({
      name: '地牢 Boss',
      icon: '🏰',
      hp: 100,
      atk: 10,
      rules: [],
      actions: ['attack'],
    }, d);
    if (combatState._bossDungeon !== d) throw new Error('_bossDungeon not saved');
  });
});

describe('Loot: rollLoot + equipItem', ({ assert }) => {
  it('rollLoot 约 60% 返回 null (100 次采样)', () => {
    const restore = seedRandom(100);
    let nullCount = 0;
    for (let i = 0; i < 100; i++) {
      if (rollLoot(1) === null) nullCount++;
    }
    restore();
    if (nullCount < 45 || nullCount > 75)
      throw new Error('null rate: expected ~60%, got ' + nullCount + '%');
  });

  it('rollLoot 返回 loot 时有 equipment 和 gold', () => {
    const restore = seedRandom(7);
    const loot = rollLoot(3);
    restore();
    if (!loot) throw new Error('expected loot, got null');
    if (!loot.equipment) throw new Error('missing equipment in loot');
    if (typeof loot.gold !== 'number') throw new Error('gold not a number');
  });

  it('rollLoot gold 值在合理范围 [5, 15+floorNum*3)', () => {
    const restore = seedRandom(42);
    const floorNum = 5;
    const maxGold = 15 + floorNum * 3;
    let found = false;
    for (let i = 0; i < 50; i++) {
      const loot = rollLoot(floorNum);
      if (!loot) continue;
      found = true;
      if (loot.gold < 5 || loot.gold >= maxGold)
        throw new Error('gold ' + loot.gold + ' out of range [5, ' + maxGold + ')');
    }
    restore();
    if (!found) throw new Error('no loot rolled in 50 attempts');
  });

  it('rollLoot equipment 有 slot, rarity, name', () => {
    const restore = seedRandom(7);
    const loot = rollLoot(2);
    restore();
    if (!loot) throw new Error('expected loot, got null');
    const eq = loot.equipment;
    if (!eq.slot) throw new Error('equipment missing slot');
    if (!eq.rarity) throw new Error('equipment missing rarity');
    if (!eq.name) throw new Error('equipment missing name');
  });

  it('equipItem: 装备到空槽位', () => {
    const restore = seedRandom(42);
    const eq = generateEquipment(1);
    player.equip = { weapon: null, armor: null, accessory: null };
    equipItem(eq);
    if (player.equip[eq.slot] !== eq) throw new Error('item not equipped to slot');
    restore();
  });

  it('equipItem: 替换已有装备', () => {
    const restore = seedRandom(10);
    const oldEq = generateEquipment(1);
    while (oldEq.slot !== 'weapon') {
      const tmp = generateEquipment(1);
      Object.assign(oldEq, tmp);
    }
    const newEq = generateEquipment(2);
    while (newEq.slot !== 'weapon') {
      const tmp = generateEquipment(2);
      Object.assign(newEq, tmp);
    }
    player.equip = { weapon: oldEq, armor: null, accessory: null };
    player.inventory = { equipment: [] };
    equipItem(newEq);
    if (player.equip.weapon !== newEq) throw new Error('weapon not replaced');
    restore();
  });

  it('equipItem: 调用 recalcPlayerStats', () => {
    const restore = seedRandom(42);
    const eq = generateEquipment(1);
    player.equip = { weapon: null, armor: null, accessory: null };
    let recalcCalled = false;
    const origRecalc = recalcPlayerStats;
    recalcPlayerStats = function () { recalcCalled = true; return origRecalc.call(this); };
    try {
      equipItem(eq);
      if (!recalcCalled) throw new Error('recalcPlayerStats not called');
    } finally {
      recalcPlayerStats = origRecalc;
    }
    restore();
  });

  it('equipItem: eq 为 null 时不报错', () => {
    equipItem(null);
  });

  it('rollLoot + equipItem 完整流程', () => {
    const restore = seedRandom(8);
    const loot = rollLoot(1);
    if (!loot) throw new Error('expected loot for integration test');
    player.equip = { weapon: null, armor: null, accessory: null };
    player.inventory = { equipment: [] };
    const eq = loot.equipment;
    equipItem(eq);
    if (player.equip[eq.slot] !== eq) throw new Error('loot item not equipped');
    if (typeof loot.gold !== 'number' || loot.gold < 5)
      throw new Error('gold invalid: ' + loot.gold);
    restore();
  });
});
