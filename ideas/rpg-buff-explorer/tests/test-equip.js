// test-equip.js — Equipment + loot tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('generateEquipment', ({ assert }) => {
  it('生成设备有基本属性', () => {
    const restore = seedRandom(42);
    const equip = generateEquipment(1);
    restore();
    if (!equip) throw new Error('equipment is null');
    if (!equip.name) throw new Error('missing name');
    if (!equip.slot) throw new Error('missing slot');
  });

  it('稀有度合法: white/blue/purple', () => {
    const validRarities = ['white', 'blue', 'purple'];
    const restore = seedRandom(7);
    for (let i = 0; i < 10; i++) {
      const equip = generateEquipment(1);
      if (!validRarities.includes(equip.rarity)) {
        throw new Error(`invalid rarity: ${equip.rarity}`);
      }
    }
    restore();
  });

  it('设备栏位合法', () => {
    const validSlots = ['weapon', 'armor', 'accessory'];
    const restore = seedRandom(7);
    for (let i = 0; i < 20; i++) {
      const equip = generateEquipment(1);
      if (!validSlots.includes(equip.slot)) {
        throw new Error(`invalid slot: ${equip.slot}`);
      }
    }
    restore();
  });
});

describe('getEquipStat', ({ assert }) => {
  it('空装备返回 0', () => {
    player.equip = { weapon: null, armor: null, accessory: null };
    if (getEquipStat('atk') !== 0) throw new Error('expected 0 atk');
    if (getEquipStat('def') !== 0) throw new Error('expected 0 def');
  });

  it('装备属性正确汇总 (从 stats 对象读取)', () => {
    player.equip = {
      weapon: { stats: { atk: 10, def: 0 } },
      armor: { stats: { atk: 0, def: 5 } },
      accessory: { stats: { atk: 3, def: 2 } },
    };
    if (getEquipStat('atk') !== 13) throw new Error(`atk: expected 13, got ${getEquipStat('atk')}`);
    if (getEquipStat('def') !== 7) throw new Error(`def: expected 7, got ${getEquipStat('def')}`);
  });
});

describe('enhanceEquippedWeapon', ({ assert }) => {
  it('没有武器时返回 false', () => {
    player.equip = { weapon: null, armor: null, accessory: null };
    player.gems = 10;
    if (enhanceEquippedWeapon() !== false) throw new Error('expected false');
  });

  it('宝石不足时返回 false', () => {
    player.equip = { weapon: { stats: { atk: 10 } }, armor: null, accessory: null };
    player.gems = 2;
    if (enhanceEquippedWeapon() !== false) throw new Error('expected false');
  });

  it('消耗 3 宝石，武器 ATK +2', () => {
    player.equip = { weapon: { stats: { atk: 10, def: 0 } }, armor: null, accessory: null };
    player.gems = 5;
    const ok = enhanceEquippedWeapon();
    if (!ok) throw new Error('expected true');
    if (player.gems !== 2) throw new Error(`gems expected 2, got ${player.gems}`);
    if (player.equip.weapon.stats.atk !== 12) throw new Error(`weapon atk expected 12, got ${player.equip.weapon.stats.atk}`);
  });

  it('武器没有 atk 属性时创建', () => {
    player.equip = { weapon: { stats: { def: 5 } }, armor: null, accessory: null };
    player.gems = 3;
    enhanceEquippedWeapon();
    if (player.equip.weapon.stats.atk !== 2) throw new Error(`weapon atk expected 2, got ${player.equip.weapon.stats.atk}`);
  });

  it('可多次叠加', () => {
    player.equip = { weapon: { stats: { atk: 10 } }, armor: null, accessory: null };
    player.gems = 9;
    enhanceEquippedWeapon();
    enhanceEquippedWeapon();
    enhanceEquippedWeapon();
    if (player.equip.weapon.stats.atk !== 16) throw new Error(`expected 16, got ${player.equip.weapon.stats.atk}`);
    if (player.gems !== 0) throw new Error(`gems expected 0, got ${player.gems}`);
  });
});

describe('enhanceEquippedArmor', ({ assert }) => {
  it('没有防具时返回 false', () => {
    player.equip = { weapon: null, armor: null, accessory: null };
    player.gems = 10;
    if (enhanceEquippedArmor() !== false) throw new Error('expected false');
  });

  it('宝石不足时返回 false', () => {
    player.equip = { weapon: null, armor: { stats: { def: 8 } }, accessory: null };
    player.gems = 2;
    if (enhanceEquippedArmor() !== false) throw new Error('expected false');
  });

  it('消耗 3 宝石，防具 DEF +2', () => {
    player.equip = { weapon: null, armor: { stats: { def: 8, hp: 20 } }, accessory: null };
    player.gems = 6;
    const ok = enhanceEquippedArmor();
    if (!ok) throw new Error('expected true');
    if (player.gems !== 3) throw new Error(`gems expected 3, got ${player.gems}`);
    if (player.equip.armor.stats.def !== 10) throw new Error(`armor def expected 10, got ${player.equip.armor.stats.def}`);
  });
});

describe('spendRunGems', ({ assert }) => {
  it('正常扣除宝石', () => {
    player.gems = 10;
    if (spendRunGems(3) !== true) throw new Error('expected true');
    if (player.gems !== 7) throw new Error(`expected 7, got ${player.gems}`);
  });

  it('宝石不足返回 false', () => {
    player.gems = 2;
    if (spendRunGems(5) !== false) throw new Error('expected false');
    if (player.gems !== 2) throw new Error('gems should be unchanged');
  });

  it('player 不存在返回 false', () => {
    const saved = player;
    player = null;
    if (spendRunGems(1) !== false) throw new Error('expected false');
    player = saved;
  });
});
