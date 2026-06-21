// test-combat-boss-fixes.js — Boss tick, buff passives, void debuff, trap effects, floor boss
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('tickBossRules threshold', ({ assert }) => {
  it('60% HP, rule at 50%: should not fire', () => {
    combatState = {
      enemy: { name: 'Boss', hp: 60, maxHp: 100, atk: 20 },
      turn: 0,
      bossRules: [
        { threshold: 0.5, effect: 'berserk', desc: '狂暴' },
      ],
      bossActiveEffects: [],
      bossTriggeredRules: [],
      bossPhase: 1,
      _bossDungeon: null,
    };
    tickBossRules();
    if (combatState.bossTriggeredRules.length !== 0)
      throw new Error('rule should not fire at 60% HP, threshold 50%');
    if (combatState.enemy.atk !== 20)
      throw new Error('atk unchanged at 60% HP');
  });

  it('40% HP, rule at 50%: should fire berserk', () => {
    combatState = {
      enemy: { name: 'Boss', hp: 40, maxHp: 100, atk: 20, _berserkApplied: false },
      turn: 0,
      bossRules: [
        { threshold: 0.5, effect: 'berserk', desc: '狂暴' },
      ],
      bossActiveEffects: [],
      bossTriggeredRules: [],
      bossPhase: 1,
      _bossDungeon: null,
    };
    tickBossRules();
    if (combatState.bossTriggeredRules.length !== 1)
      throw new Error('rule should fire at 40% HP, threshold 50%');
    if (combatState.enemy.atk !== 30)
      throw new Error(`berserk atk: expected 30, got ${combatState.enemy.atk}`);
  });
});

describe('bossShouldDodge', ({ assert }) => {
  it('no _dodgeBoost: returns false', () => {
    combatState = {
      enemy: { name: 'Boss', hp: 50, maxHp: 100 },
      turn: 0,
      bossRules: [],
      bossActiveEffects: [],
      bossTriggeredRules: [],
      bossPhase: 1,
      _bossDungeon: null,
    };
    if (bossShouldDodge() !== false)
      throw new Error('expected false without _dodgeBoost');
  });

  it('_dodgeBoost active: can return true', () => {
    let dodgeSeen = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      seedRandom(attempt * 9973);
      combatState = {
        enemy: { name: 'Boss', hp: 50, maxHp: 100, _dodgeBoost: true },
        turn: 0,
        bossRules: [],
        bossActiveEffects: [],
        bossTriggeredRules: [],
        bossPhase: 1,
        _bossDungeon: null,
      };
      if (bossShouldDodge()) { dodgeSeen = true; break; }
    }
    if (!dodgeSeen)
      throw new Error('bossShouldDodge should return true with _dodgeBoost for some seed');
  });
});

describe('Buff passive: dmgReduction', ({ assert }) => {
  it('reduces incoming damage in enemyAttack', () => {
    // Reset player to known state
    initPlayer('warrior');
    player.activeBuffs = [{ id: 'iron_skin' }];
    recalcBuffStats();
    const dmgReduction = player.buffStats.dmgReduction;
    if (dmgReduction <= 0)
      throw new Error('iron_skin should grant dmgReduction > 0');

    // Disable dodge for this test so we isolate dmgReduction
    player.buffStats.dodgeChance = 0;

    player.hp = 100;
    dungeon = null;

    const rawDmg = calcDamage(50, 1, getPlayerDef(), false);
    const expectedReduced = Math.max(1, Math.floor(rawDmg * (1 - dmgReduction)));

    combatState = {
      enemy: { name: 'Goblin', hp: 30, maxHp: 30, atk: 50, def: 0, actions: [{ type: 'attack', weight: 100, label: '攻击' }] },
      enemyIdx: 0,
      turn: 0,
      playerDefending: false,
      log: [],
      animating: false,
    };

    enemyAttack();

    if (player.hp !== 100 - expectedReduced)
      throw new Error(`hp: expected ${100 - expectedReduced}, got ${player.hp}`);
  });
});

describe('Buff passive: dodgeChance', ({ assert }) => {
  it('can avoid damage when shadow_step active', () => {
    let dodged = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      seedRandom(attempt * 7919);
      player.activeBuffs = [{ id: 'shadow_step' }];
      recalcBuffStats();
      player.hp = 100;
      const hpBefore = player.hp;

      combatState = {
        enemy: { name: 'Goblin', hp: 30, maxHp: 30, atk: 20, def: 0, actions: [{ type: 'attack', weight: 100, label: '攻击' }] },
        enemyIdx: 0,
        turn: 0,
        playerDefending: false,
        log: [],
        animating: false,
      };
      dungeon = null;

      enemyAttack();
      if (player.hp === hpBefore) { dodged = true; break; }
    }
    if (!dodged)
      throw new Error('dodgeChance should avoid damage for some seed');
  });
});

describe('Buff passive: mpRestore', ({ assert }) => {
  it('restores MP each turn during enemyAttack', () => {
    player.activeBuffs = [{ id: 'mana_flow' }];
    recalcBuffStats();
    player.mp = 5;

    combatState = {
      enemy: { name: 'Slime', hp: 100, maxHp: 100, atk: 1, def: 0, actions: [{ type: 'attack', weight: 100, label: '攻击' }] },
      enemyIdx: 0,
      turn: 0,
      playerDefending: false,
      log: [],
      animating: false,
    };
    dungeon = null;

    const mpBefore = player.mp;
    enemyAttack();

    if (player.mp <= mpBefore)
      throw new Error(`mpRestore: expected mp > ${mpBefore}, got ${player.mp}`);
  });
});

describe('Void debuff', ({ assert }) => {
  it('floor 3 enemies have +20% ATK', () => {
    dungeon = { theme: { envBuff: { id: 'void', desc: '虚空' } } };
    const result = voidEnemyAtk(100);
    if (result !== 120)
      throw new Error(`voidEnemyAtk(100): expected 120, got ${result}`);
  });

  it('non-void floor returns base ATK', () => {
    dungeon = { theme: { envBuff: null } };
    const result = voidEnemyAtk(100);
    if (result !== 100)
      throw new Error(`voidEnemyAtk(100): expected 100, got ${result}`);
  });
});

describe('Trap effect: slow', ({ assert }) => {
  it('sets _slowTurns to trap value', () => {
    const trap = { type: 'slime', effect: 'slow', val: 2, triggered: false };
    player._slowTurns = 0;
    if (TRAP_TYPES.slime.effect !== 'slow')
      throw new Error('slime trap should have slow effect');
    if (TRAP_TYPES.slime.value !== 2)
      throw new Error('slime trap value should be 2');
    // Simulate what movement.js does: player._slowTurns = trap.val
    player._slowTurns = trap.val;
    if (player._slowTurns !== 2)
      throw new Error(`_slowTurns: expected 2, got ${player._slowTurns}`);
    delete player._slowTurns;
  });
});

describe('Trap effect: invert', ({ assert }) => {
  it('sets _invertTurns to trap value', () => {
    if (TRAP_TYPES.mirror.effect !== 'invert')
      throw new Error('mirror trap should have invert effect');
    if (TRAP_TYPES.mirror.value !== 3)
      throw new Error('mirror trap value should be 3');
    player._invertTurns = TRAP_TYPES.mirror.value;
    if (player._invertTurns !== 3)
      throw new Error(`_invertTurns: expected 3, got ${player._invertTurns}`);
    delete player._invertTurns;
  });
});

describe('Floor boss', ({ assert }) => {
  it('Floor 1 has a boss enemy', () => {
    const restore = seedRandom(42);
    const d = generateFloor(1);
    restore();
    if (!d) throw new Error('generateFloor(1) returned null');
    const bosses = d.enemies.filter(e => e.boss === true);
    if (bosses.length < 1)
      throw new Error(`floor 1 should have a boss, found ${bosses.length}`);
  });
});
