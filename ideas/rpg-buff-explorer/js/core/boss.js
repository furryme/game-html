// boss.js — Boss rule-combat system
// Bosses are "rule stackers" that modify game rules as the fight progresses.

/**
 * Rule effect registry — 10 reusable rule functions.
 * Each receives the enemy (combatState.enemy) and optionally player/dungeon.
 */

/** 狂暴: ATK+50% */
function berserk(enemy) {
  if (enemy._berserkApplied) return;
  enemy._berserkApplied = true;
  enemy.atk = Math.floor(enemy.atk * 1.5);
  addLog('[BOSS] ' + enemy.name + ' 进入狂暴！ATK +50% (' + enemy.atk + ')', 'dmg');
  FX.floatText('狂暴！', 'enemy-sprite');
  FX.burst('enemy-sprite', 'crimson');
}

/** 技能封印: 每回合随机封印一个技能 */
function skill_seal(enemy) {
  if (!player || !player.skillCooldowns) return;
  var sealedId = enemy._lastSealedSkill;
  var available = [];
  for (var i = 0; i < SKILLS.length; i++) {
    var sid = SKILLS[i].id;
    if (sid !== sealedId) available.push(sid);
  }
  if (available.length === 0) return;
  var pickId = available[Math.floor(Math.random() * available.length)];
  player.skillCooldowns[pickId] = 99;
  enemy._lastSealedSkill = pickId;
  var skillName = '';
  for (var j = 0; j < SKILLS.length; j++) { if (SKILLS[j].id === pickId) { skillName = SKILLS[j].name; break; } }
  addLog('[BOSS] ' + enemy.name + ' 封印了你的技能「' + skillName + '」！', 'dmg');
  FX.floatText('封印: ' + skillName, 'player-sprite');
}

/** 暗伤: 每回合固定 8 点伤害 */
function dark_drain(enemy, player) {
  if (!player) return;
  var dmg = 8;
  player.hp -= dmg;
  addLog('[BOSS] 暗影侵蚀造成 ' + dmg + ' 点暗伤', 'dmg');
  FX.floatText('-' + dmg + ' 暗伤', 'player-sprite');
  FX.burst('player-sprite', 'magenta');
}

/** 装备腐化: 每 2 回合装备属性 -20% */
function equip_corrupt(enemy, player) {
  if (!player || !player.equip) return;
  if ((combatState.turn % 2) !== 0) return;
  var slots = ['weapon', 'armor', 'accessory'];
  for (var i = 0; i < slots.length; i++) {
    var item = player.equip[slots[i]];
    if (item) {
      item._corruptMult = (item._corruptMult || 1) * 0.8;
      if (item.atk) item.atk = Math.floor(item.atk * item._corruptMult);
      if (item.def) item.def = Math.floor(item.def * item._corruptMult);
    }
  }
  var mult = (1 - (enemy._equipCorruptMult || 1 * 0.8 * 0.8 * 0.8)).toFixed(0);
  addLog('[BOSS] 装备腐化加深！装备属性衰减中', 'dmg');
  FX.floatText('腐化', 'player-sprite');
}

/** 金币诱惑: 弹出投降对话框 (30% 概率每回合触发) */
function gold_tempt(enemy) {
  if (Math.random() > 0.3) return;
  var gold = enemy.gold ? enemy.gold[1] || 50 : 50;
  // Prevent clicking outside from closing — combat stays paused until player chooses.
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.onclick = null;
  showModal(
    '<div class="modal-title">' + enemy.icon + ' ' + enemy.name + ' 低语</div>' +
    '<p>投降吧，这些金币都是你的……（' + gold + ' 金币）</p>' +
    '<div class="modal-actions">' +
    '<button class="modal-btn" onclick="declineSurrender()">拒绝</button>' +
    '<button class="modal-btn" onclick="bossSurrender(' + gold + ')" style="border-color:#f80; color:#f80;">投降</button>' +
    '</div>'
  );
  addLog('[BOSS] ' + enemy.name + ' 用金币诱惑你投降', 'info');
}

/** HP 隐藏: 不显示 Boss 血条真实值 (UI 层在渲染时检查此标志) */
function hp_hidden(enemy) {
  enemy._hpHidden = true;
  addLog('[BOSS] ' + enemy.name + ' 的真实 HP 被隐藏了', 'info');
  FX.floatText('???', 'enemy-sprite');
}

/** 双击: 每回合 30% 概率额外攻击 */
function double_strike(enemy) {
  if (Math.random() > 0.3) return;
  var atk = enemy.atk;
  var def = getPlayerDef();
  var damage = calcDamage(atk, 1, def, false);
  if (combatState.playerDefending) damage = Math.floor(damage * 0.5);
  if (player) player.hp -= damage;
  addLog('[BOSS] ' + enemy.name + ' 追加一次攻击！-' + damage + ' HP', 'dmg');
  FX.floatText('-' + damage + ' 双击', 'player-sprite');
  FX.burst('player-sprite', 'crimson');
  FX.shake('player-sprite', 3);
}

/** 闪避增强: 20% 概率闪避玩家攻击 (在 doAttack/doSkill 中检查 enemy._dodgeBoost) */
function dodge_boost(enemy) {
  enemy._dodgeBoost = true;
  addLog('[BOSS] ' + enemy.name + ' 进入闪避姿态！', 'info');
  FX.floatText('闪避+', 'enemy-sprite');
}

/** 持续回复: 每回合回复 3% HP */
function heal_over_time(enemy) {
  var heal = Math.max(1, Math.floor((enemy.maxHp || enemy.hp) * 0.03));
  enemy.hp = Math.min(enemy.maxHp || enemy.hp, enemy.hp + heal);
  addLog('[BOSS] ' + enemy.name + ' 回复了 ' + heal + ' HP', 'heal');
  FX.floatText('+' + heal, 'enemy-sprite');
}

/** 召唤小怪: 每 N 回合召唤一个 (默认 3, 可通过 enemy._summonInterval 配置) */
function summon_minion(enemy, dungeon) {
  var interval = enemy._summonInterval || 3;
  if ((combatState.turn % interval) !== 0) return;
  if (!dungeon) return;
  var floor = enemy.floor || gameState.floor;
  var candidates = Object.keys(ENEMY_DATA).filter(function (k) {
    var e = ENEMY_DATA[k];
    return e && (!e.floor || e.floor <= floor);
  });
  if (candidates.length === 0) return;
  var key = candidates[Math.floor(Math.random() * candidates.length)];
  var base = ENEMY_DATA[key];
  var minion = {
    name: base.name + '（召唤物）',
    icon: base.icon,
    hp: Math.floor(base.hp * 0.6),
    atk: Math.floor(base.atk * 0.6),
    def: Math.floor(base.def * 0.6),
    spd: base.spd,
    exp: 0,
    gold: [0, 0],
    actions: base.actions.slice(0, 2),
    summoned: true
  };
  // Append to dungeon enemies (will show up as a new encounter after current boss turn)
  dungeon._pendingMinion = dungeon._pendingMinion || [];
  dungeon._pendingMinion.push(minion);
  addLog('[BOSS] ' + enemy.name + ' 召唤了 ' + minion.name + '！', 'dmg');
  FX.floatText('召唤！', 'enemy-sprite');
  FX.burst('enemy-sprite', 'magenta');
}

// ---- Public API ----

/**
 * Initialize boss combat.
 * @param {Object} bossData — entry from BOSS_DATA
 * @param {Object} dungeon — current dungeon state
 */
function initBossCombat(bossData, dungeon) {
  var copy = {};
  for (var k in bossData) {
    if (k === 'rules') {
      copy.rules = bossData.rules.map(function (r) { return { threshold: r.threshold, effect: r.effect, desc: r.desc }; });
    } else if (k === 'actions') {
      copy.actions = bossData.actions;
    } else {
      copy[k] = bossData[k];
    }
  }
  copy.maxHp = copy.hp;
  copy.boss = true;

  // Find the actual boss index in dungeon.enemies so enemyDefeated() can remove it
  var bossIdx = -1;
  if (dungeon && dungeon.enemies) {
    for (var fi = 0; fi < dungeon.enemies.length; fi++) {
      if (dungeon.enemies[fi] && dungeon.enemies[fi].x === bossData.x && dungeon.enemies[fi].y === bossData.y && dungeon.enemies[fi].boss) {
        bossIdx = fi;
        break;
      }
    }
  }

  combatState = {
    enemy: copy,
    enemyIdx: bossIdx,
    turn: 0,
    playerDefending: false,
    log: [],
    animating: false,
    bossRules: copy.rules,
    bossPhase: 1,
    bossActiveEffects: [],
    bossTriggeredRules: [],
    _bossDungeon: dungeon,
  };

  gameState.paused = true;
  gameState.screen = 'combat';
  showScreen('combat');

  // Show combat buttons, hide dungeon actions (critical: without this buttons are invisible!)
  var combatActionsEl = document.getElementById('combat-actions');
  if (combatActionsEl) combatActionsEl.style.display = 'block';
  var dungeonActionsEl = document.getElementById('dungeon-actions');
  if (dungeonActionsEl) dungeonActionsEl.style.display = 'none';

  addLog('=== ' + copy.icon + ' Boss ' + copy.name + ' 出现！ ===', 'dmg');
  FX.floatText('BOSS', 'center');
  FX.shake(5, 10);

  // Activate any rules with threshold 1.0
  tickBossRules();

  if (typeof renderCombatActions === 'function') renderCombatActions();
}

/**
 * Called at the start of each turn to check HP thresholds and activate new rules.
 */
function tickBossRules() {
  if (!combatState || !combatState.bossRules) return;
  var enemy = combatState.enemy;
  var hpRatio = enemy.hp / (enemy.maxHp || enemy.hp);

  // Track effects activated this tick so we don't double-fire them in per-turn loop
  var activatedThisTick = [];

  for (var i = 0; i < combatState.bossRules.length; i++) {
    var rule = combatState.bossRules[i];
    var key = rule.effect + ':' + rule.threshold;
    if (combatState.bossTriggeredRules.indexOf(key) !== -1) continue;
    if (hpRatio <= rule.threshold) {
      combatState.bossTriggeredRules.push(key);
      combatState.bossActiveEffects.push(rule.effect);
      activatedThisTick.push(rule.effect);
      combatState.bossPhase = combatState.bossTriggeredRules.length + 1;
      addLog('[BOSS] 阶段 ' + combatState.bossPhase + ' — ' + rule.desc, 'dmg');
      FX.floatText('阶段 ' + combatState.bossPhase, 'center');
      bossPhaseTransition(combatState.bossPhase);
      executeBossRule(rule.effect, rule);
    }
  }

  // Tick per-turn active effects (skip effects just activated this tick to avoid double-fire)
  var perTurnEffects = ['skill_seal', 'dark_drain', 'equip_corrupt', 'gold_tempt', 'double_strike', 'heal_over_time', 'summon_minion'];
  for (var j = 0; j < combatState.bossActiveEffects.length; j++) {
    var effect = combatState.bossActiveEffects[j];
    if (activatedThisTick.indexOf(effect) !== -1) continue;
    if (perTurnEffects.indexOf(effect) !== -1) {
      var fn = RULE_REGISTRY[effect];
      if (fn) fn(enemy, player, combatState._bossDungeon);
    }
  }
}

/**
 * Execute a one-shot rule effect (for initial activation).
 * @param {string} effect — rule effect id
 * @param {Object} rule — rule config from boss rules array
 */
function executeBossRule(effect, rule) {
  var fn = RULE_REGISTRY[effect];
  if (!fn) return;
  var enemy = combatState.enemy;
  if (effect === 'summon_minion' && rule && rule.interval) {
    enemy._summonInterval = rule.interval;
  }
  fn(enemy, player, combatState._bossDungeon);
}

/**
 * Boss phase transition visual effect.
 * @param {number} newPhase
 */
function bossPhaseTransition(newPhase) {
  FX.shake(6, 12);
  FX.burst('enemy-sprite', 'gold', 16, 3, 25);
  FX.ring(CANVAS_W / 2 - 32, 80, '#ff0');
  FX.floatText('=== 阶段 ' + newPhase + ' ===', 'center');
  playSound('bossPhase');
}

/**
 * Check if the current combat is a boss fight.
 * @returns {boolean}
 */
function isBossCombat() {
  return combatState && combatState.bossRules !== undefined;
}

/**
 * Check if boss should dodge this player attack. Called from combat.js.
 * @returns {boolean}
 */
function bossShouldDodge() {
  if (!isBossCombat()) return false;
  var enemy = combatState.enemy;
  if (enemy._dodgeBoost && Math.random() < 0.2) {
    addLog(enemy.name + ' 闪避了你的攻击！', 'info');
    FX.floatText('闪避', 'enemy-sprite');
    return true;
  }
  return false;
}

/** Called from gold_tempt modal if player surrenders. */
function bossSurrender(gold) {
  closeModal();
  addLog('你向 ' + combatState.enemy.name + ' 投降了', 'dmg');
  player.gold += gold;
  addLog('获得 ' + gold + ' 金币（耻辱之金）', 'loot');
  combatState = null;
  gameState.paused = false;
  gameState.screen = 'dungeon';
  showScreen('dungeon');
  var ca = document.getElementById('combat-actions');
  if (ca) ca.style.display = 'none';
  var da = document.getElementById('dungeon-actions');
  if (da) da.style.display = 'block';
  if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
}

/** Called from gold_tempt modal if player declines surrender. Combat continues. */
function declineSurrender() {
  closeModal();
  addLog('你拒绝了 ' + (combatState && combatState.enemy ? combatState.enemy.name : '敌人') + ' 的诱惑', 'info');
}

/** Register of all rule effect functions. */
var RULE_REGISTRY = {
  berserk: berserk,
  skill_seal: skill_seal,
  dark_drain: dark_drain,
  equip_corrupt: equip_corrupt,
  gold_tempt: gold_tempt,
  hp_hidden: hp_hidden,
  double_strike: double_strike,
  dodge_boost: dodge_boost,
  heal_over_time: heal_over_time,
  summon_minion: summon_minion,
};

// Global exports for onclick handlers
window.bossSurrender = bossSurrender;
window.declineSurrender = declineSurrender;
window.initBossCombat = initBossCombat;
