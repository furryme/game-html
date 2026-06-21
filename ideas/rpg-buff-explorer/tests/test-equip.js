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
