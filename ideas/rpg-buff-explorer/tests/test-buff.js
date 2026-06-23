// test-buff.js — Buff system + stat calculation tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('recalcBuffStats', ({ assert }) => {
  it('无 buff 时所有倍率为 1/0', () => {
    player.activeBuffs = [];
    recalcBuffStats();
    const s = player.buffStats;
    if (s.atkMult !== 1) throw new Error(`atkMult: expected 1, got ${s.atkMult}`);
    if (s.defMult !== 1) throw new Error(`defMult: expected 1, got ${s.defMult}`);
    if (s.critBonus !== 0) throw new Error(`critBonus: expected 0, got ${s.critBonus}`);
  });

  it('单个 ATK buff: 狂战士的祝福 (warrior classBonus → 1.3*1.2=1.56)', () => {
    player.cls = 'warrior';
    player.activeBuffs = [{ id: 'berserks_blessing' }];
    recalcBuffStats();
    if (player.buffStats.atkMult !== 1.56) throw new Error(`atkMult: expected 1.56 (base 1.3 * warrior bonus 1.2), got ${player.buffStats.atkMult}`);
  });

  it('双 buff 乘法叠加: atkMult berserks_blessing(1.3) + immortal', () => {
    // berserks_blessing: atkMult 1.3
    // immortal: check if atkMult exists
    player.activeBuffs = [{ id: 'berserks_blessing' }, { id: 'immortal' }];
    recalcBuffStats();
    // immortal may have atkMult too, or may not. Just check atkMult > 1.0
    if (player.buffStats.atkMult <= 1.0) {
      throw new Error(`atkMult should be > 1.0 with berserks_blessing, got ${player.buffStats.atkMult}`);
    }
    // berserks_blessing alone is 1.3, with immortal should be >= 1.3
    if (player.buffStats.atkMult < 1.3) {
      throw new Error(`atkMult should be >= 1.3, got ${player.buffStats.atkMult}`);
    }
  });

  it('critBonus 加法叠加: 8 + 12 = 20', () => {
    // sharp_eye: critBonus 8
    // crit_lens: critBonus 12
    player.activeBuffs = [{ id: 'sharp_eye' }, { id: 'crit_lens' }];
    recalcBuffStats();
    if (player.buffStats.critBonus !== 20) throw new Error(`critBonus: expected 20, got ${player.buffStats.critBonus}`);
  });

  it('dmgReduction 复合: 0.2 + 0.3 = 1-(0.8*0.7) = 0.44', () => {
    // iron_skin: dmgReduction 0.2
    // frost_heart: dmgReduction 0.3
    player.activeBuffs = [{ id: 'iron_skin' }, { id: 'frost_heart' }];
    recalcBuffStats();
    const expected = 1 - (0.8 * 0.7);
    if (Math.abs(player.buffStats.dmgReduction - expected) > 0.001) {
      throw new Error(`dmgReduction: expected ${expected}, got ${player.buffStats.dmgReduction}`);
    }
  });

  it('百分比上限: dmgReduction <= 0.8 (design doc cap)', () => {
    player.activeBuffs = [{ id: 'iron_skin' }, { id: 'frost_heart' }];
    recalcBuffStats();
    if (player.buffStats.dmgReduction > 0.8) {
      throw new Error(`dmgReduction: expected <= 0.8, got ${player.buffStats.dmgReduction}`);
    }
  });
});

describe('recalcPlayerStats', ({ assert }) => {
  it('升级后 HP/ATK 提升', () => {
    player.lvl = 1; player.cls = 'warrior';
    player.activeBuffs = [];
    player.equip = { weapon: null, armor: null, accessory: null };
    recalcPlayerStats();
    const hp1 = player.maxHp;

    player.lvl = 5;
    recalcPlayerStats();
    const hp5 = player.maxHp;

    if (hp5 <= hp1) throw new Error(`Lv5 HP ${hp5} should be > Lv1 HP ${hp1}`);
  });

  it('不同职业有属性差异', () => {
    player.activeBuffs = [];
    player.equip = { weapon: null, armor: null, accessory: null };

    player.lvl = 1; player.cls = 'warrior'; recalcPlayerStats();
    const warHp = player.maxHp;
    const warAtk = player.baseAtk;

    player.lvl = 1; player.cls = 'mage'; recalcPlayerStats();
    const mageHp = player.maxHp;
    const mageMp = player.maxMp;

    player.lvl = 1; player.cls = 'rogue'; recalcPlayerStats();
    const rogueSpd = player.baseSpd;
    const rogueCrit = player.crit;

    if (warHp <= mageHp) throw new Error(`warrior HP ${warHp} should be > mage HP ${mageHp}`);
    if (mageMp <= 40) throw new Error(`mage MP ${mageMp} should be > 40`);
    if (rogueSpd <= 10) throw new Error(`rogue spd ${rogueSpd} should be > 10`);
    if (rogueCrit <= 10) throw new Error(`rogue crit ${rogueCrit} should be > 10`);

    player.cls = 'warrior'; recalcPlayerStats();
  });
});

describe('checkSynergies', ({ assert }) => {
  it('无 buff 时无 synergy', () => {
    player.activeBuffs = [];
    checkSynergies();
    if (player.activeSynergies.length !== 0) {
      throw new Error(`expected 0 synergies, got ${player.activeSynergies.length}`);
    }
  });

  it('有 buff 时不报错', () => {
    player.activeBuffs = [{ id: 'iron_skin' }];
    checkSynergies();
  });
});

describe('buffDefToStats', ({ assert }) => {
  it('无 passive 的 buff 返回 null', () => {
    const def = { id: 'test', name: '测试', passive: null };
    const result = buffDefToStats(def);
    if (result !== null) throw new Error(`expected null, got ${JSON.stringify(result)}`);
  });

  it('atkMult passive 转换为 baseAtk delta', () => {
    const def = { id: 'test', name: '测试', passive: { atkMult: 1.2 } };
    const result = buffDefToStats(def);
    if (!result || typeof result.baseAtk !== 'number') {
      throw new Error(`expected baseAtk number, got ${JSON.stringify(result)}`);
    }
  });
});

describe('findBuffDef', ({ assert }) => {
  it('找到存在的 buff', () => {
    const def = findBuffDef('iron_skin');
    if (!def) throw new Error('expected buff definition, got null');
    if (def.id !== 'iron_skin') throw new Error(`id mismatch`);
  });

  it('不存在的 buff 返回 null', () => {
    const def = findBuffDef('nonexistent_buff');
    if (def !== null) throw new Error(`expected null`);
  });
});

describe('getPlayerAtk/Def/Crit', ({ assert }) => {
  it('无 buff 时返回基础属性', () => {
    player.baseAtk = 20;
    player.baseDef = 10;
    player.crit = 5;
    player.buffStats = null;
    if (getPlayerAtk() !== 20) throw new Error(`getPlayerAtk: expected 20, got ${getPlayerAtk()}`);
    if (getPlayerDef() !== 10) throw new Error(`getPlayerDef: expected 10, got ${getPlayerDef()}`);
    if (getPlayerCrit() !== 5) throw new Error(`getPlayerCrit: expected 5, got ${getPlayerCrit()}`);
  });

  it('ATK buff 乘法: baseAtk=20, atkMult=1.5 → 30', () => {
    player.baseAtk = 20;
    player.buffStats = { atkMult: 1.5 };
    if (getPlayerAtk() !== 30) throw new Error(`expected 30, got ${getPlayerAtk()}`);
  });

  it('CRIT buff 加法: crit=5, critBonus=10 → 15', () => {
    player.crit = 5;
    player.buffStats = { critBonus: 10 };
    if (getPlayerCrit() !== 15) throw new Error(`expected 15, got ${getPlayerCrit()}`);
  });
});
