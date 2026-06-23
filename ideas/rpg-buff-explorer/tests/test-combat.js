// test-combat.js — Combat logic tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('calcDamage', ({ assert }) => {
  it('基础伤害: ATK=10, DEF=0 → 10', () => {
    if (calcDamage(10, 1, 0, false) !== 10) throw new Error('expected 10');
  });

  it('防御减免: ATK=100, DEF=50 → 66', () => {
    // mitigation = min(0.8, 50/150) = 0.3333
    // dmg = floor(100 * 0.6667) = 66
    if (calcDamage(100, 1, 50, false) !== 66) throw new Error(`expected 66, got ${calcDamage(100, 1, 50, false)}`);
  });

  it('防御减免上限 80%: ATK=100, DEF=400 → ~19-20', () => {
    const dmg = calcDamage(100, 1, 400, false);
    if (dmg < 18 || dmg > 20) throw new Error(`expected ~20, got ${dmg}`);
  });

  it('暴击倍率 1.5x: ATK=100, DEF=0 → 150', () => {
    if (calcDamage(100, 1, 0, true) !== 150) throw new Error('expected 150');
  });

  it('技能倍率: ATK=50, mult=1.8, DEF=0 → 90', () => {
    if (calcDamage(50, 1.8, 0, false) !== 90) throw new Error('expected 90');
  });

  it('最小伤害 = 1: ATK=1, DEF=100 → 1', () => {
    if (calcDamage(1, 1, 100, false) !== 1) throw new Error('expected 1');
  });
});

describe('calcExpNext / calcStatsFromLevel', ({ assert }) => {
  it('Lv1 expNext = 30', () => {
    if (calcExpNext(1) !== 30) throw new Error(`expected 30, got ${calcExpNext(1)}`);
  });

  it('Lv3 expNext = 150', () => {
    if (calcExpNext(3) !== 150) throw new Error(`expected 150, got ${calcExpNext(3)}`);
  });

  it('Lv10 expNext = 1300 (default, out of table)', () => {
    if (calcExpNext(10) !== 1300) throw new Error(`expected 1300, got ${calcExpNext(10)}`);
  });

  it('Lv5 stats: hp=200, atk=22, def=13', () => {
    const s = calcStatsFromLevel(5);
    if (s.maxHp !== 200) throw new Error(`hp: expected 200, got ${s.maxHp}`);
    if (s.baseAtk !== 22) throw new Error(`atk: expected 22, got ${s.baseAtk}`);
    if (s.baseDef !== 13) throw new Error(`def: expected 13, got ${s.baseDef}`);
  });
});

describe('chooseEnemyAction', ({ assert }) => {
  it('空 actions 返回默认攻击', () => {
    const action = chooseEnemyAction({ actions: [] });
    if (action.type !== 'attack') throw new Error(`expected attack, got ${action.type}`);
  });

  it('有 actions 时加权随机返回合法 action', () => {
    const restore = seedRandom(42);
    const action = chooseEnemyAction({
      actions: [
        { type: 'attack', weight: 70, label: '攻击' },
        { type: 'defend', weight: 30, label: '防御' },
      ]
    });
    restore();
    if (!action || !action.type) throw new Error('expected action object');
  });
});
