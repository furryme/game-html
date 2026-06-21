// test-boss.js — Boss rule system tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('Boss 数据', ({ assert }) => {
  it('3 个 Boss 都已定义', () => {
    const keys = Object.keys(BOSS_DATA);
    if (keys.length < 3) throw new Error(`boss count: expected >= 3, got ${keys.length}`);
  });

  it('Boss 有 rules 数组', () => {
    for (const key in BOSS_DATA) {
      const boss = BOSS_DATA[key];
      if (!boss.rules || !Array.isArray(boss.rules)) throw new Error(`${boss.name}: missing rules`);
    }
  });

  it('Boss 属性合理', () => {
    for (const key in BOSS_DATA) {
      const boss = BOSS_DATA[key];
      if (boss.hp < 100) throw new Error(`${boss.name}: hp should be >= 100`);
    }
  });
});

describe('RULE_REGISTRY', ({ assert }) => {
  it('所有规则函数已注册', () => {
    const effects = ['berserk', 'skill_seal', 'dark_drain', 'equip_corrupt',
                     'gold_tempt', 'hp_hidden', 'double_strike', 'dodge_boost',
                     'heal_over_time', 'summon_minion'];
    for (const effect of effects) {
      if (typeof RULE_REGISTRY[effect] !== 'function') {
        throw new Error(`${effect}: not registered`);
      }
    }
  });

  it('berserk: ATK +50%', () => {
    const enemy = { name: '测试', atk: 20, maxHp: 100, hp: 40 };
    berserk(enemy);
    if (enemy.atk !== 30) throw new Error(`berserk atk: expected 30, got ${enemy.atk}`);
  });

  it('berserk 不重复应用', () => {
    const enemy = { name: '测试', atk: 20, maxHp: 100, hp: 40 };
    berserk(enemy);
    berserk(enemy);
    if (enemy.atk !== 30) throw new Error(`berserk double: expected 30, got ${enemy.atk}`);
  });

  it('dark_drain: 固定 8 点伤害', () => {
    const enemy = { name: '测试', maxHp: 100, hp: 100 };
    player.hp = 50;
    dark_drain(enemy, player);
    if (player.hp !== 42) throw new Error(`dark_drain hp: expected 42, got ${player.hp}`);
  });

  it('dodge_boost: 设置标志', () => {
    const enemy = { name: '测试', maxHp: 100, hp: 100 };
    dodge_boost(enemy);
    if (!enemy._dodgeBoost) throw new Error('_dodgeBoost should be true');
  });

  it('heal_over_time: 回复 3% HP', () => {
    const enemy = { name: '测试', maxHp: 100, hp: 80 };
    heal_over_time(enemy);
    if (enemy.hp !== 83) throw new Error(`heal: expected 83, got ${enemy.hp}`);
  });

  it('heal_over_time: 不超过 maxHp', () => {
    const enemy = { name: '测试', maxHp: 100, hp: 99 };
    heal_over_time(enemy);
    if (enemy.hp > 100) throw new Error('hp should not exceed maxHp');
  });
});

describe('tickBossRules', ({ assert }) => {
  it('HP 阈值触发规则激活', () => {
    combatState = {
      enemy: { name: '测试Boss', hp: 100, maxHp: 100, atk: 20 },
      turn: 0, bossRules: [
        { threshold: 0.5, effect: 'berserk', desc: '狂暴' },
      ],
      bossActiveEffects: [], bossTriggeredRules: [], bossPhase: 1,
      _bossDungeon: null,
    };

    tickBossRules();
    if (combatState.enemy.atk !== 20) throw new Error('berserk should not trigger at 100%');

    combatState.enemy.hp = 50;
    combatState.enemy._berserkApplied = false;
    tickBossRules();
    if (combatState.enemy.atk !== 30) throw new Error(`berserk atk: expected 30, got ${combatState.enemy.atk}`);
  });

  it('已触发的规则不重复激活', () => {
    combatState = {
      enemy: { name: '测试Boss', hp: 10, maxHp: 100, atk: 20, _berserkApplied: false },
      turn: 0, bossRules: [
        { threshold: 0.5, effect: 'berserk', desc: '狂暴' },
      ],
      bossActiveEffects: [], bossTriggeredRules: [], bossPhase: 1,
      _bossDungeon: null,
    };

    tickBossRules();
    const phase1 = combatState.bossPhase;
    tickBossRules();
    const phase2 = combatState.bossPhase;

    if (phase1 !== phase2) throw new Error(`phase changed on re-call`);
  });
});

describe('isBossCombat', ({ assert }) => {
  it('非 Boss 战返回 false', () => {
    combatState = { enemy: { name: '小怪' }, turn: 0 };
    if (isBossCombat() !== false) throw new Error('expected false');
  });

  it('Boss 战返回 true', () => {
    combatState = { enemy: { name: 'Boss' }, turn: 0, bossRules: [] };
    if (isBossCombat() !== true) throw new Error('expected true');
  });
});
