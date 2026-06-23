// combat.js — Turn-based combat system

/**
 * Look up an active synergy by id.
 * @param {string} id
 * @returns {Object|null}
 */
function getSynergy(id) {
  if (!player || !player.activeSynergies) return null;
  for (var i = 0; i < player.activeSynergies.length; i++) {
    if (player.activeSynergies[i].id === id) return player.activeSynergies[i];
  }
  return null;
}

/**
 * Get list of active (type=active) buffs the player has.
 * @returns {Array}
 */
function getActiveBuffs() {
  var result = [];
  if (!player || !player.activeBuffs) return result;
  for (var i = 0; i < player.activeBuffs.length; i++) {
    var bId = typeof player.activeBuffs[i] === "string" ? player.activeBuffs[i] : player.activeBuffs[i].id;
    for (var d = 0; d < BUFF_DEFS.length; d++) {
      if (BUFF_DEFS[d].id === bId && BUFF_DEFS[d].type === "active") {
        result.push({ id: bId, def: BUFF_DEFS[d] });
        break;
      }
    }
  }
  return result;
}

/**
 * Use an active buff. Returns true on success.
 * @param {string} buffId
 * @returns {boolean}
 */
function useActiveBuff(buffId) {
  if (!combatState || combatState.animating) return false;
  var def = null;
  for (var i = 0; i < BUFF_DEFS.length; i++) {
    if (BUFF_DEFS[i].id === buffId && BUFF_DEFS[i].type === "active") { def = BUFF_DEFS[i]; break; }
  }
  if (!def || !def.active) return false;

  // Check cooldown
  var cd = combatState.activeBuffCooldowns[buffId] || 0;
  if (cd > 0) {
    addLog(def.name + " 仍在冷却（" + cd + " 回合）", "info");
    return false;
  }

  var active = def.active;
  if (active.execute === "block_next_attack") {
    combatState.shieldBlocked = true;
    combatState.activeBuffCooldowns[buffId] = active.cooldown;
    addLog(def.icon + " " + def.name + "：抵挡下一次攻击！", "info");
    FX.floatText("护盾！", "player-sprite");
    playSound("defend");
  } else if (active.execute === "heal_pct") {
    var healPct = active.healPct || 0.4;
    var healAmt = Math.floor(player.maxHp * healPct);
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    combatState.activeBuffCooldowns[buffId] = active.cooldown;
    addLog(def.icon + " " + def.name + "：回复 " + healAmt + " HP", "heal");
    FX.floatText("+" + healAmt + " HP", "player-sprite");
    playSound("heal");
  }
  renderPlayerAfterAction();

  console.log("[buff] useActiveBuff " + buffId);
  return true;
}

/**
 * Start combat with an enemy by index in dungeon.enemies.
 * @param {number} enemyIdx
 */
function startCombat(enemyIdx) {
  var enemy = dungeon.enemies[enemyIdx];
  if (!enemy || enemy.hp <= 0) return;

  // Check if this is a boss with rules — use boss combat system
  if (enemy.boss && enemy.rules && enemy.rules.length > 0) {
    initBossCombat(enemy, dungeon);
    return;
  }

  combatState = {
    enemy: enemy,
    enemyIdx: enemyIdx,
    turn: 0,
    playerDefending: false,
    log: [],
    animating: false,
    activeBuffCooldowns: {},
    shieldBlocked: false,
    deathEmbraceUsed: false,
  };

  gameState.paused = true;
  gameState.screen = 'combat';
  showScreen('combat');

  // Show combat buttons, hide dungeon actions
  var combatActionsEl = document.getElementById('combat-actions');
  if (combatActionsEl) combatActionsEl.style.display = 'block';
  var dungeonActionsEl = document.getElementById('dungeon-actions');
  if (dungeonActionsEl) dungeonActionsEl.style.display = 'none';
  console.log('[combat] combatActionsEl found:', !!combatActionsEl, 'display:', combatActionsEl ? combatActionsEl.style.display : 'N/A');

  try {
    if (typeof renderCombatActions === 'function') renderCombatActions();
    console.log('[combat] renderCombatActions OK, innerHTML len:', combatActionsEl ? combatActionsEl.innerHTML.length : 0);
  } catch (e) {
    console.log('[combat] renderCombatActions ERROR:', e.message, e.stack);
  }

  addLog('遭遇 ' + enemy.name + '！', 'dmg');
  console.log('[combat] startCombat', enemy.name, 'hp:', enemy.hp, 'atk:', enemy.atk, 'def:', enemy.def, 'paused:', gameState.paused);
}

/**
 * Calculate damage.
 * @param {number} attackerAtk
 * @param {number} skillMult — damage multiplier from skill
 * @param {number} targetDef
 * @param {boolean} isCrit
 * @returns {number}
 */
function calcDamage(attackerAtk, skillMult, targetDef, isCrit) {
  skillMult = skillMult || 1;
  var mitigation = Math.min(0.8, targetDef / (targetDef + 100));
  var raw = attackerAtk * skillMult;
  var damage = Math.max(1, Math.floor(raw * (1 - mitigation)));
  if (isCrit) damage = Math.floor(damage * 1.5);

  return damage;
}

/** Get player's effective attack (base + buffs + equipment + mult). */
function getPlayerAtk() {
  var atk = player.baseAtk + (player.gemBonusAtk || 0);
  // Consume one-time event ATK bonus
  if (player._eventAtkBonus) {
    atk += player._eventAtkBonus;
    console.log('[event] applying _eventAtkBonus=' + player._eventAtkBonus);
    delete player._eventAtkBonus;
  }
  // Apply general atkMult from buffStats (includes passive + classBonus, but NOT boss-only)
  // recalcBuffStats now excludes boss-only buffs from atkMult
  if (player.buffStats && player.buffStats.atkMult > 1) {
    atk = Math.floor(atk * player.buffStats.atkMult);
  }
  // Apply boss-only atkMult separately (duelist: tags include "boss")
  if (player.activeBuffs) {
    for (var i = 0; i < player.activeBuffs.length; i++) {
      var bId = typeof player.activeBuffs[i] === "string" ? player.activeBuffs[i] : player.activeBuffs[i].id;
      for (var d = 0; d < BUFF_DEFS.length; d++) {
        if (BUFF_DEFS[d].id === bId && BUFF_DEFS[d].tags && BUFF_DEFS[d].tags.indexOf("boss") !== -1 && BUFF_DEFS[d].passive && BUFF_DEFS[d].passive.atkMult) {
          if (typeof isBossCombat === "function" && isBossCombat()) {
            atk = Math.floor(atk * BUFF_DEFS[d].passive.atkMult);
            console.log('[buff] bossOnly atkMult ' + BUFF_DEFS[d].passive.atkMult + ' vs boss');
          }
          break;
        }
      }
    }
  }
  return atk;
}

/** Get player's effective defense. */
function getPlayerDef() {
  var def = player.baseDef + (player.gemBonusDef || 0);
  if (player.buffStats && player.buffStats.defMult) {
    def = Math.floor(def * player.buffStats.defMult);
  }
  return def;
}

/** Get player's effective crit chance. */
function getPlayerCrit() {
  var crit = player.crit;
  if (player.buffStats && player.buffStats.critBonus) {
    crit += player.buffStats.critBonus;
  }
  // Synergy: boss_hunter — double crit rate vs boss
  if (getSynergy('boss_hunter') && combatState && combatState.enemy && combatState.enemy.boss) {
    crit *= getSynergy('boss_hunter').effect.mult;
    console.log('[synergy] boss_hunter crit rate doubled vs boss');
  }
  return crit;
}

/** Get player's effective speed. */
function getPlayerSpd() {
  var spd = player.baseSpd;
  if (player.buffStats && player.buffStats.spdMult) {
    spd = Math.floor(spd * player.buffStats.spdMult);
  }
  return spd;
}

/**
 * Player standard attack.
 */
function doAttack() {
  console.log('[combat] doAttack called! combatState=', !!combatState, 'animating=', combatState ? combatState.animating : 'N/A');
  if (!combatState || combatState.animating) { console.log('[combat] doAttack early return'); return; }
  combatState.playerDefending = false;

  var atk = getPlayerAtk();
  var def = combatState.enemy.def;

  // Boss dodge check
  if (typeof isBossCombat === 'function' && isBossCombat() && typeof bossShouldDodge === 'function') {
    if (bossShouldDodge()) {
      FX.floatText('闪避', 'enemy-sprite');
      setTimeout(function () {
        enemyAttack();
        combatState.turn++;
      }, 300);
      return;
    }
  }

  var isCrit = Math.random() * 100 < getClassAdjustedCrit();
  var damage = calcDamage(atk, 1, def, isCrit);
  console.log('[combat] doAttack atk=' + atk + ' def=' + def + ' crit=' + isCrit + ' dmg=' + damage + ' enemyHpBefore=' + combatState.enemy.hp);
  playSound(isCrit ? 'crit' : 'attack');

  // Apply damage over time to enemy if player has dot buffs
  if (player.activeBuffs) {
    for (var bi = 0; bi < player.activeBuffs.length; bi++) {
      var b = player.activeBuffs[bi];
      if (b.combatDot) {
        damage += b.combatDot;
      }
    }
  }

  combatState.enemy.hp -= damage;

  // Buff passive: lifesteal
  if (player.buffStats && player.buffStats.lifestealPct > 0) {
    var lsHeal = Math.floor(damage * player.buffStats.lifestealPct);
    if (lsHeal > 0) {
      player.hp = Math.min(player.maxHp, player.hp + lsHeal);
      FX.floatText('+' + lsHeal + ' 吸血', 'player-sprite');
      addLog('吸血回复 ' + lsHeal + ' HP', 'heal');
      console.log('[buff] lifesteal ' + lsHeal + ' from damage ' + damage);
    }
  }

  FX.burst('enemy-sprite', isCrit ? 'crimson' : 'steel');
  FX.floatText('-' + damage + (isCrit ? ' 暴击！' : ''), 'enemy-sprite');
  FX.shake('enemy-sprite', 3);

  addLog(
    '你攻击 ' + combatState.enemy.name + '，造成 ' + damage + ' 点伤害' + (isCrit ? '（暴击）' : ''),
    'combat'
  );

  applyClassPassiveOnAttack();

  if (combatState.enemy.hp <= 0) {
    combatState.enemy.hp = 0;
    enemyDefeated();
    return;
  }

  // Synergy: dual_blade — 15% chance of double strike
  var dualBlade = getSynergy('dual_blade');
  if (dualBlade && Math.random() < dualBlade.effect.chance) {
    var atk2 = getPlayerAtk();
    var isCrit2 = Math.random() * 100 < getPlayerCrit();
    var dmg2 = calcDamage(atk2, 1, combatState.enemy.def, isCrit2);
    if (player.activeBuffs) {
      for (var bi2 = 0; bi2 < player.activeBuffs.length; bi2++) {
        if (player.activeBuffs[bi2].combatDot) dmg2 += player.activeBuffs[bi2].combatDot;
      }
    }
    combatState.enemy.hp -= dmg2;
    FX.burst('enemy-sprite', 'gold');
    FX.floatText('-' + dmg2 + ' 连击！', 'enemy-sprite');
    FX.shake('enemy-sprite', 3);
    addLog('双刀流连击！造成 ' + dmg2 + ' 点额外伤害', 'combat');
    if (combatState.enemy.hp <= 0) {
      combatState.enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }

  // Synergy: critical_fury -- 10% chance of追击 dealing 10% current HP damage
  if (isCrit && getSynergy('critical_fury') && Math.random() < getSynergy('critical_fury').effect.pct) {
    var bonusDmg = Math.max(1, Math.floor(player.hp * getSynergy('critical_fury').effect.pct));
    combatState.enemy.hp -= bonusDmg;
    FX.floatText('-' + bonusDmg + ' 追击', 'enemy-sprite');
    FX.burst('enemy-sprite', 'gold');
    addLog('暴击狂怒追击！造成 ' + bonusDmg + ' 点伤害', 'combat');
    console.log('[synergy] critical_fury bonusDmg ' + bonusDmg);
    if (combatState.enemy.hp <= 0) {
      combatState.enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }

  renderPlayerAfterAction();
  setTimeout(function () {
    enemyAttack();
    combatState.turn++;
  }, 300);
}

/**
 * Player defend — reduces incoming damage by 50% this turn.
 */
function doDefend() {
  if (!combatState || combatState.animating) return;
  combatState.playerDefending = true;
  playSound('defend');

  // Small MP regen on defend
  var mpRestore = Math.floor(player.maxMp * 0.05) + 1;
  player.mp = Math.min(player.maxMp, player.mp + mpRestore);

  addLog('你采取防御姿态，恢复 ' + mpRestore + ' MP', 'info');

  FX.floatText('防御', 'player-sprite');
  renderPlayerAfterAction();

  setTimeout(function () {
    enemyAttack();
    combatState.turn++;
  }, 300);
}

/**
 * Player use a skill.
 * @param {string} skillId
 */
function doSkill(skillId) {
  if (!combatState || combatState.animating) return;
  combatState.playerDefending = false;

  var skill = null;
  for (var si = 0; si < SKILLS.length; si++) { if (SKILLS[si].id === skillId) { skill = SKILLS[si]; break; } }
  if (!skill) return;

  // Check cooldown
  if (player.skillCooldowns[skillId] && player.skillCooldowns[skillId] > 0) {
    addLog(skill.name + ' 仍在冷却（' + player.skillCooldowns[skillId] + ' 回合）', 'info');
    return;
  }

  // Check MP
  if (player.mp < skill.mpCost) {
    addLog('MP 不足，无法使用 ' + skill.name, 'info');
    return;
  }

  player.mp -= skill.mpCost;
  player.skillCooldowns[skillId] = skill.cooldown || 0;

  // Track skill use for buff unlock progress
  if (typeof permanent !== "undefined" && permanent && typeof trackProgress === "function") {
    trackProgress(permanent, "skill_use", 1);
    console.log('[buff] skill_use tracked for ' + skill.name);
  }

  var atk = getPlayerAtk();
  var def = combatState.enemy.def;

  // Boss dodge check
  if (typeof isBossCombat === 'function' && isBossCombat() && typeof bossShouldDodge === 'function') {
    if (bossShouldDodge()) {
      FX.floatText('闪避', 'enemy-sprite');
      setTimeout(function () {
        enemyAttack();
        combatState.turn++;
      }, 300);
      return;
    }
  }

  var isCrit = Math.random() * 100 < getClassAdjustedCrit();
  var damage = calcDamage(atk, skill.mult || 1, def, isCrit);

  combatState.enemy.hp -= damage;
  FX.burst('enemy-sprite', skill.color || 'blue');
  FX.floatText('-' + damage + ' ' + skill.name, 'enemy-sprite');
  FX.shake('enemy-sprite', 5);

  // Buff passive: lifesteal
  if (player.buffStats && player.buffStats.lifestealPct > 0) {
    var lsHeal = Math.floor(damage * player.buffStats.lifestealPct);
    if (lsHeal > 0) {
      player.hp = Math.min(player.maxHp, player.hp + lsHeal);
      FX.floatText('+' + lsHeal + ' 吸血', 'player-sprite');
      addLog('吸血回复 ' + lsHeal + ' HP', 'heal');
      console.log('[buff] lifesteal ' + lsHeal + ' from skill damage ' + damage);
    }
  }

  addLog('使用 ' + skill.name + '！对 ' + combatState.enemy.name + ' 造成 ' + damage + ' 点伤害', 'combat');

  // Apply secondary effects based on skill type
  if (skill.type === 'dmg_heal') {
    var healAmt = Math.floor(damage * (skill.healPct || 0.1));
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    addLog('回复了 ' + healAmt + ' HP', 'heal');
  } else if (skill.type === 'dmg_drain') {
    var drainAmt = Math.floor(damage * (skill.drainPct || 0.2));
    player.hp = Math.min(player.maxHp, player.hp + drainAmt);
    addLog('吸取了 ' + drainAmt + ' HP', 'heal');
  } else if (skill.type === 'dmg_debuff') {
    combatState.enemy.def = Math.floor(combatState.enemy.def * (skill.debuffMult || 0.7));
    addLog(combatState.enemy.name + ' 防御被降低！', 'combat');
  } else if (skill.type === 'buff') {
    player.buffsLeft = skill.buffDuration || 2;
    player.baseAtk = Math.floor(player.baseAtk * (skill.buffMult || 1.5));
    addLog('获得 ' + skill.name + ' 增益！', 'combat');
  } else if (skill.type === 'buff_self_dmg') {
    player.buffsLeft = skill.buffDuration || 2;
    player.baseAtk = Math.floor(player.baseAtk * (skill.buffMult || 1.5));
    var selfDmg = Math.floor(player.maxHp * (skill.selfDmgPct || 0.05));
    player.hp -= selfDmg;
    addLog('获得 ' + skill.name + ' 增益！但损失了 ' + selfDmg + ' HP', 'combat');
    if (player.hp <= 0) { player.hp = 0; playerDied(); return; }
  } else if (skill.type === 'dmg_self') {
    var selfDmg2 = Math.floor(player.maxHp * (skill.selfDmgPct || 0.3));
    player.hp -= selfDmg2;
    addLog('受到了 ' + selfDmg2 + ' 点反噬伤害！', 'dmg');
    if (player.hp <= 0) { player.hp = 0; playerDied(); return; }
  } else if (skill.type === 'multi_hit') {
    var hits = skill.hits || 2;
    for (var hi = 1; hi < hits; hi++) {
      var extraDmg = calcDamage(atk, skill.mult || 0.8, def, Math.random() * 100 < getPlayerCrit());
      combatState.enemy.hp -= extraDmg;
      addLog('第 ' + (hi + 1) + ' 击造成 ' + extraDmg + ' 点伤害', 'combat');
    }
  } else if (skill.type === 'aoe') {
    applyClassPassiveOnAttack();
  } else if (skill.type === 'dmg_pierce') {
    var pierceDef = Math.floor(def * (1 - (skill.piercePct || 0.3)));
    damage = calcDamage(atk, skill.mult || 1, pierceDef, isCrit);
    combatState.enemy.hp = combatState.enemy.hp + damage - (combatState.enemy.hp - damage);
    combatState.enemy.hp -= damage;
    addLog('无视了 ' + Math.floor(def * (skill.piercePct || 0.3)) + ' 点防御！', 'combat');
  } else if (skill.type === 'dmg_poison') {
    var poisonDmgVal = Math.floor(atk * 0.3) + player.lvl;
    combatState.enemy.poisoning = skill.poisonTurns || 5;
    combatState.enemy.poisonDamage = poisonDmgVal;
    addLog(combatState.enemy.name + ' 中毒！每回合 ' + poisonDmgVal + ' 伤害，持续 ' + (skill.poisonTurns || 5) + ' 回合', 'combat');
  } else if (skill.type === 'dmg_conditional') {
    var mult = isFirstStrike() ? (skill.mult || 2.0) : (skill.multFallback || 1.0);
    damage = calcDamage(atk, mult, def, isCrit);
    combatState.enemy.hp = combatState.enemy.hp + damage - (combatState.enemy.hp - damage);
    combatState.enemy.hp -= damage;
    addLog(isFirstStrike() ? '先手背刺！' : '背刺（非先手）', 'combat');
  } else if (skill.type === 'defend_shield') {
    combatState.playerDefending = true;
    combatState.shielded = true;
    addLog('法力护盾已激活！本回合伤害免疫', 'info');
    FX.floatText('护盾', 'player-sprite');
  } else if (skill.type === 'aoe_debuff') {
    combatState.enemy.def = Math.floor(combatState.enemy.def * (skill.debuffMult || 0.7));
    addLog(combatState.enemy.name + ' 防御和速度被降低！', 'combat');
  } else if (skill.type === 'aoe_burn') {
    var burnDmgVal = Math.floor(atk * 0.3) + player.lvl;
    combatState.enemy.burning = 3;
    combatState.enemy.burnDamage = burnDmgVal;
    addLog(combatState.enemy.name + ' 被灼烧！', 'combat');
  } else if (skill.type === 'dmg_execute') {
    if (combatState.enemy.hp / combatState.enemy.maxHp <= (skill.executePct || 0.3)) {
      damage = combatState.enemy.hp;
      addLog('致命一击！' + combatState.enemy.name + ' HP 低于 ' + Math.floor((skill.executePct || 0.3) * 100) + '%', 'combat');
    }
  } else if (skill.type === 'defend_evade') {
    combatState.playerDefending = true;
    combatState.evading = true;
    combatState.evadeChance = skill.evadeChance || 0.8;
    addLog('闪避步！本回合有高概率闪避攻击', 'info');
    FX.floatText('闪避', 'player-sprite');
  } else if (skill.type === 'defend_next_atk') {
    combatState.playerDefending = true;
    combatState.shielded = true;
    combatState.nextAtkMult = skill.nextAtkMult || 2.0;
    var healAmt = Math.floor(player.maxHp * (skill.healPct || 0.2));
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
    addLog('消失！回复 ' + healAmt + ' HP，下回合攻击双倍伤害', 'heal');
    FX.floatText('消失', 'player-sprite');
  }

  if (combatState.enemy.hp <= 0) {
    combatState.enemy.hp = 0;
    enemyDefeated();
    return;
  }

  // Synergy: dual_blade — 15% chance of double strike
  var dualBladeSkill = getSynergy('dual_blade');
  if (dualBladeSkill && Math.random() < dualBladeSkill.effect.chance) {
    var atk2 = getPlayerAtk();
    var isCrit2 = Math.random() * 100 < getPlayerCrit();
    var dmg2 = calcDamage(atk2, 1, combatState.enemy.def, isCrit2);
    combatState.enemy.hp -= dmg2;
    FX.burst('enemy-sprite', 'gold');
    FX.floatText('-' + dmg2 + ' 连击！', 'enemy-sprite');
    FX.shake('enemy-sprite', 3);
    addLog('双刀流连击！造成 ' + dmg2 + ' 点额外伤害', 'combat');
    if (combatState.enemy.hp <= 0) {
      combatState.enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }

  // Synergy: critical_fury -- 10% chance of追击 dealing 10% current HP damage
  if (isCrit && getSynergy('critical_fury') && Math.random() < getSynergy('critical_fury').effect.pct) {
    var bonusDmg = Math.max(1, Math.floor(player.hp * getSynergy('critical_fury').effect.pct));
    combatState.enemy.hp -= bonusDmg;
    FX.floatText('-' + bonusDmg + ' 追击', 'enemy-sprite');
    FX.burst('enemy-sprite', 'gold');
    addLog('暴击狂怒追击！造成 ' + bonusDmg + ' 点伤害', 'combat');
    console.log('[synergy] critical_fury bonusDmg ' + bonusDmg);
    if (combatState.enemy.hp <= 0) {
      combatState.enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }

  renderPlayerAfterAction();
  setTimeout(function () {
    enemyAttack();
    combatState.turn++;
  }, 300);
}

/**
 * Enemy AI chooses and executes an action.
 */
function enemyAttack() {
  if (!combatState) return;
  var enemy = combatState.enemy;
  if (enemy.hp <= 0) return;

  // Boss: tick rules (HP thresholds + per-turn effects) at start of each enemy turn
  if (typeof isBossCombat === 'function' && isBossCombat()) {
    console.log('[boss] tickBossRules at turn', combatState.turn);
    if (typeof tickBossRules === 'function') tickBossRules();
    // Check player death after boss per-turn effects (dark_drain, double_strike)
    if (player.hp <= 0) {
      player.hp = 0;
      playerDied();
      return;
    }
  }

  // Tick class DOTs (burn, poison)
  tickEnemyDOTs();
  if (combatState && combatState.enemy && combatState.enemy.hp > 0) {
  } else if (combatState && combatState.enemy && combatState.enemy.hp <= 0) {
    return;
  }

  // Tick enemy DOTs
  if (enemy.bleeding && enemy.bleeding > 0) {
    enemy.hp -= enemy.bleedDamage;
    enemy.bleeding--;
    FX.floatText('-' + enemy.bleedDamage + ' 流血', 'enemy-sprite');
    addLog(enemy.name + ' 受到 ' + enemy.bleedDamage + ' 点流血伤害', 'combat');
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }

  // Choose action
  var action = chooseEnemyAction(enemy);

  if (action.type === 'attack') {
    var mult = action.mult || 1;
    var atk = voidEnemyAtk(enemy.atk) * mult;
    var def = getPlayerDef();

    if (combatState.playerDefending) {
      atk *= 0.5;
    }

    var damage = calcDamage(atk, 1, def, false);

    // Shield: mage mana shield blocks all damage
    if (combatState.shielded) {
      FX.floatText('护盾阻挡!', 'player-sprite');
      addLog('法力护盾抵消了 ' + enemy.name + ' 的攻击！', 'info');
      combatState.shielded = false;
      damage = 0;
    }

    // Evade: rogue evade step
    if (combatState.evading && Math.random() < (combatState.evadeChance || 0.8)) {
      FX.floatText('闪避!', 'player-sprite');
      addLog('你闪避了 ' + enemy.name + ' 的攻击并反击！', 'info');
      combatState.evading = false;
      var counterDmg = calcDamage(getPlayerAtk(), 1, enemy.def, false);
      enemy.hp -= counterDmg;
      FX.floatText('-' + counterDmg + ' 反击', 'enemy-sprite');
      addLog('反击造成 ' + counterDmg + ' 点伤害', 'combat');
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        enemyDefeated();
        return;
      }
      damage = 0;
    }

    // Buff passive: dodge
    if (player.buffStats && player.buffStats.dodgeChance > 0 && Math.random() < player.buffStats.dodgeChance) {
      FX.floatText('闪避！', 'player-sprite');
      addLog(enemy.name + ' ' + (action.label || '攻击') + '，你闪避了攻击！', 'info');
      console.log('[buff] dodge vs ' + enemy.name);
    } else {
      // Buff passive: dmgReduction
      if (player.buffStats && player.buffStats.dmgReduction > 0) {
        damage = Math.max(1, Math.floor(damage * (1 - player.buffStats.dmgReduction)));
        console.log('[buff] dmgReduction ' + player.buffStats.dmgReduction + ' -> ' + damage);
      }

      // Active buff: shield_burst blocks next attack
      if (combatState.shieldBlocked) {
        FX.floatText("护盾抵挡！", "player-sprite");
        addLog("护盾爆发抵挡了 " + enemy.name + " 的攻击！", "info");
        combatState.shieldBlocked = false;
        damage = 0;
      }

      player.hp -= damage;

      // Track damage taken for buff unlock progress
      if (typeof permanent !== "undefined" && permanent && typeof trackProgress === "function") {
        trackProgress(permanent, "damage_taken", damage);
      }

      FX.burst('player-sprite', 'crimson');
      FX.floatText('-' + damage, 'player-sprite');
      FX.shake('player-sprite', 4);

      var actionLabel = action.label || '攻击';
      addLog(enemy.name + ' ' + actionLabel + '，对你造成 ' + damage + ' 点伤害', 'dmg');

      // Buff passive: reflect
      if (player.buffStats && player.buffStats.reflectPct > 0) {
        var reflectDmg = Math.max(1, Math.floor(damage * player.buffStats.reflectPct));
        enemy.hp -= reflectDmg;
        FX.floatText('-' + reflectDmg + ' 反伤', 'enemy-sprite');
        addLog('反弹 ' + reflectDmg + ' 点伤害给 ' + enemy.name, 'combat');
        console.log('[buff] reflect ' + reflectDmg + ' to ' + enemy.name);
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          enemyDefeated();
          return;
        }
      }
    }

  } else if (action.type === 'defend') {
    enemy.defending = true;
    addLog(enemy.name + ' 采取防御', 'info');

  } else if (action.type === 'special') {
    // Boss special attacks
    if (action.effect === 'drain') {
      var dmg = Math.floor(voidEnemyAtk(enemy.atk) * 0.8);
      applySpecialDmgToPlayer(dmg, enemy, '吸取了你的生命！');
    } else {
      var specialDmg = calcDamage(voidEnemyAtk(enemy.atk), 1.2, getPlayerDef(), false);
      if (combatState.playerDefending) specialDmg = Math.floor(specialDmg * 0.5);
      applySpecialDmgToPlayer(specialDmg, enemy, '释放暗魔法，造成');
    }
    FX.burst('player-sprite', 'magenta');
    FX.shake('player-sprite', 6);
    renderPlayerAfterAction();

  } else if (action.type === 'buff') {
    var selfBuff = action.selfBuff;
    if (selfBuff) {
      if (selfBuff.stat === 'atk') enemy.atk = Math.floor(enemy.atk * selfBuff.mult);
      if (selfBuff.stat === 'def') enemy.def = Math.floor(enemy.def * selfBuff.mult);
      if (selfBuff.stat === 'spd') enemy.spd = Math.floor(enemy.spd * selfBuff.mult);
      enemy.buffsLeft = selfBuff.duration;
    }
    addLog(enemy.name + ' ' + (action.label || '强化') + '！', 'dmg');

  } else if (action.type === 'debuff') {
    var enemyDebuff = action.enemyDebuff;
    if (enemyDebuff) {
      player.statuses.push({
        id: 'debuff_' + (enemyDebuff.stat || 'atk'),
        type: 'debuff', turnsLeft: enemyDebuff.duration || 2,
        stat: enemyDebuff.stat, mult: enemyDebuff.mult,
      });
    }
    addLog(enemy.name + ' ' + (action.label || '诅咒') + '！你被削弱了', 'dmg');

  } else if (action.type === 'flee') {
    if (Math.random() < 0.5) {
      addLog(enemy.name + ' 逃跑了！', 'info');
      combatState = null;
      gameState.paused = false;
      gameState.screen = 'dungeon';
      showScreen('dungeon');
      var ca3 = document.getElementById('combat-actions');
      if (ca3) ca3.style.display = 'none';
      var da3 = document.getElementById('dungeon-actions');
      if (da3) da3.style.display = 'block';
      return;
    } else {
      addLog(enemy.name + ' 逃跑失败！', 'info');
    }
  }

  renderPlayerAfterAction();
  if (player.hp <= 0) {
    player.hp = 0;
    playerDied();
    return;
  }

  // Tick cooldowns
  tickCooldowns();

  // Tick active buff cooldowns
  tickActiveBuffCooldowns();

  // Tick player statuses (DOTs)
  tickPlayerStatuses();

  // Buff passives: end-of-turn restores + DOT
  if (player.buffStats) {
    // mpRestore: restore MP each turn
    if (player.buffStats.mpRestore > 0) {
      var mpHealed = Math.min(player.maxMp - player.mp, player.buffStats.mpRestore);
      player.mp += mpHealed;
      if (mpHealed > 0) {
        addLog('恢复 ' + mpHealed + ' MP', 'heal');
        console.log('[buff] mpRestore ' + mpHealed);
      }
    }
    // hpRestorePct: restore % of max HP each turn
    if (player.buffStats.hpRestorePct > 0) {
      var hpHealed = Math.min(player.maxHp - player.hp, Math.floor(player.maxHp * player.buffStats.hpRestorePct));
      player.hp += hpHealed;
      if (hpHealed > 0) {
        addLog('恢复 ' + hpHealed + ' HP', 'heal');
        console.log('[buff] hpRestorePct ' + player.buffStats.hpRestorePct + ' -> ' + hpHealed);
      }
    }
    // dotDmg: deal DOT damage to enemy each turn
    if (player.buffStats.dotDmg > 0 && combatState && combatState.enemy && combatState.enemy.hp > 0) {
      var dotDmg = player.buffStats.dotDmg;
      combatState.enemy.hp -= dotDmg;
      FX.floatText('-' + dotDmg + ' DOT', 'enemy-sprite');
      addLog(combatState.enemy.name + ' 受到 ' + dotDmg + ' 点持续伤害', 'combat');
      console.log('[buff] dotDmg ' + dotDmg + ' to ' + combatState.enemy.name);
      if (combatState.enemy.hp <= 0) {
        combatState.enemy.hp = 0;
        enemyDefeated();
        return;
      }
    }
  }

  if (player.hp <= 0) {
    player.hp = 0;
    playerDied();
  }
}

/**
 * Apply special enemy damage to player with dodge, dmgReduction, reflect.
 * @param {number} dmg - raw damage amount
 * @param {Object} enemy - the enemy attacking
 * @param {string} label - log message prefix (e.g. '释放暗魔法，造成')
 */
function applySpecialDmgToPlayer(dmg, enemy, label) {
  // Active buff: shield_burst blocks special attacks too
  if (combatState && combatState.shieldBlocked) {
    FX.floatText("护盾抵挡！", "player-sprite");
    addLog(enemy.name + " " + label + " 护盾抵挡！", "info");
    combatState.shieldBlocked = false;
    return;
  }

  // Buff passive: dodge
  if (player.buffStats && player.buffStats.dodgeChance > 0 && Math.random() < player.buffStats.dodgeChance) {
    FX.floatText('闪避！', 'player-sprite');
    addLog(enemy.name + ' ' + label + ' 你闪避了攻击！', 'info');
    console.log('[buff] dodge vs ' + enemy.name + ' (special)');
    return;
  }
  // Buff passive: dmgReduction
  if (player.buffStats && player.buffStats.dmgReduction > 0) {
    dmg = Math.max(1, Math.floor(dmg * (1 - player.buffStats.dmgReduction)));
    console.log('[buff] dmgReduction ' + player.buffStats.dmgReduction + ' -> ' + dmg);
  }
  player.hp -= dmg;

  // Track damage taken for buff unlock progress
  if (typeof permanent !== "undefined" && permanent && typeof trackProgress === "function") {
    trackProgress(permanent, "damage_taken", dmg);
  }

  if (label.indexOf('吸取') !== -1) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + dmg);
    addLog(enemy.name + ' ' + label + '-' + dmg + 'HP', 'dmg');
  } else {
    addLog(enemy.name + ' ' + label + ' ' + dmg + ' 点伤害', 'dmg');
  }

  // Buff passive: reflect
  if (player.buffStats && player.buffStats.reflectPct > 0) {
    var reflectDmg = Math.max(1, Math.floor(dmg * player.buffStats.reflectPct));
    enemy.hp -= reflectDmg;
    FX.floatText('-' + reflectDmg + ' 反伤', 'enemy-sprite');
    addLog('反弹 ' + reflectDmg + ' 点伤害给 ' + enemy.name, 'combat');
    console.log('[buff] reflect ' + reflectDmg + ' to ' + enemy.name);
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemyDefeated();
      return;
    }
  }
}

/** Safely render the player panel after in-combat stat changes. */
function renderPlayerAfterAction() {
  if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
}

function voidEnemyAtk(baseAtk) {
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'void') {
    return Math.floor(baseAtk * 1.2);
  }
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'final') {
    return Math.floor(baseAtk * 1.3);
  }
  return baseAtk;
}

function voidEnemyDef(baseDef) {
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'final') {
    return Math.floor(baseDef * 1.15);
  }
  return baseDef;
}

function voidExpMult() {
  var mult = 1;
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'void') {
    mult *= 1.5;
  }
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'final') {
    mult *= 2.0;
  }
  return mult;
}

function finalGoldMult() {
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'final') {
    return 1.5;
  }
  return 1;
}

/**
 * Choose enemy action using weighted random.
 * @param {Object} enemy
 * @returns {Object} action
 */
function chooseEnemyAction(enemy) {
  var actions = enemy.actions;
  if (!actions || !actions.length) {
    return { type: 'attack', label: '攻击' };
  }

  // Filter silenced
  var available = [];
  for (var i = 0; i < actions.length; i++) {
    if (enemy.silenced && actions[i].type === 'special') continue;
    available.push(actions[i]);
  }
  if (!available.length) available = [{ type: 'attack', weight: 100, label: '攻击' }];

  return weightedPick(available);
}

/**
 * Enemy was defeated — award EXP, gold, return to map.
 */
function enemyDefeated() {
  var enemy = combatState.enemy;
  console.log('[combat] enemyDefeated:', enemy.name, 'exp:', enemy.exp || 10, 'gold:', enemy.gold || 5);
  var exp = enemy.exp || 10;
  var gold = enemy.gold || 5;

  // Void debuff: EXP+50% on floor 3
  var expMult = voidExpMult();
  if (expMult !== 1) {
    exp = Math.floor(exp * expMult);
    console.log('[void] EXP bonus: ' + (expMult - 1) * 100 + '% -> ' + exp + ' EXP');
  }

  // Final env: gold+50% on floor 5
  var goldMult = finalGoldMult();
  if (goldMult !== 1) {
    gold = Math.floor(gold * goldMult);
  }

  try {
    // Gold bonus from buffs
    if (player.activeBuffs) {
      for (var gi = 0; gi < player.activeBuffs.length; gi++) {
        var b = player.activeBuffs[gi];
        var gid = typeof b === 'string' ? b : b.id;
        var def = findBuffDef(gid);
        if (def && def.passive && def.passive.goldBonus) {
          gold = Math.floor(gold * (1 + def.passive.goldBonus));
        }
      }
    }

    // Synergy: wealth_flood — additional 30% gold
    var wf = getSynergy('wealth_flood');
    if (wf) gold = Math.floor(gold * (1 + wf.effect.pct));

    player.gold += gold;
    addLog('击败 ' + enemy.name + '！获得 ' + exp + ' EXP, ' + gold + ' 金币', 'loot');

    FX.floatText('+' + exp + ' EXP', 'center');

    // Remove enemy from dungeon
    dungeon.enemies[combatState.enemyIdx] = null;
    console.log('[combat] step3: removed enemy from dungeon');

    // Track permanent progress
    if (typeof permanent !== 'undefined' && permanent) {
      permanent.permanentStats.totalKills++;
      permanent.permanentStats.totalGold += gold;
      if (typeof trackProgress === 'function') {
        trackProgress(permanent, 'kill', 1);
        trackProgress(permanent, 'gold', gold);
      }
      if (enemy.boss) {
        permanent.permanentStats.bossKills++;
        if (typeof trackProgress === 'function') trackProgress(permanent, 'boss', 1);
      }
      // Boss defeated: award soul shards
      if (enemy.boss) {
        var shardsAwarded = 1;
        if (typeof addSoulShards === 'function') {
          addSoulShards(permanent, shardsAwarded);
          addLog('Boss 击败！获得 ' + shardsAwarded + ' 个灵魂碎片', 'loot');
          console.log('[boss] awarded ' + shardsAwarded + ' soul shard(s)');
        }
      }
      if (typeof checkBuffUnlocks === 'function') checkBuffUnlocks(permanent);
    }

    // Boss defeated flag
    if (enemy.boss) {
      gameState.bossDefeated = true;
      addLog('Boss 被击败！楼梯已开启', 'loot');

      // Boss drops 3 gems (design spec: Boss掉落3颗宝石)
      addGems(3);
      addLog('Boss 掉落 3 颗宝石！', 'loot');
      console.log('[loot] Boss gem drop: +3 gems, total=' + (player.gems || 0));

      // Boss guaranteed equipment drop (1-2 items)
      if (typeof rollLoot === 'function') {
        var bossLoot1 = rollLoot(gameState.floor);
        if (bossLoot1) {
          addLog('Boss 掉落装备：' + bossLoot1.icon + ' ' + bossLoot1.name + ' (' + RARITY[bossLoot1.rarity].label + ')', 'loot');
          console.log('[loot] Boss equip drop:', bossLoot1.name);
        }
        var bossLoot2 = rollLoot(gameState.floor);
        if (bossLoot2) {
          addLog('Boss 掉落装备：' + bossLoot2.icon + ' ' + bossLoot2.name + ' (' + RARITY[bossLoot2.rarity].label + ')', 'loot');
          console.log('[loot] Boss equip drop:', bossLoot2.name);
        }
      }
    }

    // Normal enemy equipment drop (rollLoot has built-in ~18% + floor scaling chance)
    if (!enemy.boss && typeof rollLoot === 'function') {
      var loot = rollLoot(gameState.floor);
      if (loot) {
        addLog('敌人掉落装备：' + loot.icon + ' ' + loot.name + ' (' + RARITY[loot.rarity].label + ')', 'loot');
        console.log('[loot] enemy equip drop:', loot.name);
      }
    }

    console.log('[combat] step4: about to gainExp(' + exp + ')');
    gainExp(exp);
    console.log('[combat] step5: after gainExp');

    // End combat
    combatState = null;
    gameState.paused = false;
    gameState.screen = 'dungeon';
    showScreen('dungeon');

    // Hide combat buttons, show dungeon actions
    var combatActionsEl = document.getElementById('combat-actions');
    if (combatActionsEl) combatActionsEl.style.display = 'none';
    var dungeonActionsEl = document.getElementById('dungeon-actions');
    if (dungeonActionsEl) dungeonActionsEl.style.display = 'block';

    console.log('[combat] step6: screen=' + gameState.screen + ' dungeon=' + !!dungeon + ' player=(' + player.x + ',' + player.y + ')');
    if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
    console.log('[combat] step7: done!');
    saveGame();
  } catch (e) {
    console.log('[combat] ERROR in enemyDefeated:', e.message, e.stack);
    // Force recovery
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
}

/**
 * Player died — show relic selection if buffs available, otherwise game over.
 */
function playerDied() {
  // Clear dungeon layer theme override on death
  if (window.themeManager) window.themeManager.clearLayerOverride();
  playSound('death');

  // Save enemy ref before clearing combatState
  var dyingEnemy = combatState ? combatState.enemy : null;

  gameState.paused = true;
  gameState.screen = 'gameover';
  combatState = null;

  // Hide combat buttons
  var ca = document.getElementById('combat-actions');
  if (ca) ca.style.display = 'none';

  // Permanent death handler
  var keptGold = 0;
  if (typeof permanent !== 'undefined' && permanent) {
    keptGold = onDeath(permanent);
    permanent._startGold = keptGold;
  }

  // Theme progress: play time (approximate 1 turn ~ 5 seconds)
  if (typeof trackThemeProgress === 'function' && gameState.turnCount) {
    trackThemeProgress('totalPlayTime', Math.floor(gameState.turnCount * 5));
  }

  // Synergy: immortal — revive once at 20% HP
  var immortal = getSynergy('immortal');
  if (immortal && !player.synergyReviveUsed && dyingEnemy && dyingEnemy.hp > 0) {
    player.synergyReviveUsed = true;
    player.hp = Math.max(1, Math.floor(player.maxHp * immortal.effect.pct));
    player.mp = Math.min(player.maxMp, player.mp + 10);
    gameState.paused = false;
    gameState.screen = 'combat';
    combatState = { enemy: dyingEnemy, turn: 0, playerDefending: false };
    var ca4 = document.getElementById('combat-actions');
    if (ca4) ca4.style.display = 'block';
    if (typeof renderCombatActions === 'function') renderCombatActions();
    if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
    FX.floatText('复活！', 'player-sprite');
    addLog('不死之身！恢复 ' + player.hp + ' HP 复活', 'heal');
    return;
  }

  // Check death_embrace active buff
  var hasDeathEmbrace = false;
  var deathEmbraceId = null;
  if (player.activeBuffs) {
    for (var dei = 0; dei < player.activeBuffs.length; dei++) {
      var deId = typeof player.activeBuffs[dei] === "string" ? player.activeBuffs[dei] : player.activeBuffs[dei].id;
      if (deId === "death_embrace") { hasDeathEmbrace = true; deathEmbraceId = deId; break; }
    }
  }
  if (hasDeathEmbrace && (!combatState || !combatState.deathEmbraceUsed)) {
    if (combatState) combatState.deathEmbraceUsed = true;
    player.hp = 1;
    player.mp = Math.min(player.maxMp, player.mp + 10);
    gameState.paused = false;
    gameState.screen = "combat";
    combatState = { enemy: dyingEnemy, turn: combatState ? combatState.turn : 0, playerDefending: false, animating: false, activeBuffCooldowns: combatState ? combatState.activeBuffCooldowns : {}, deathEmbraceUsed: true };
    var ca5 = document.getElementById("combat-actions");
    if (ca5) ca5.style.display = "block";
    if (typeof renderCombatActions === "function") renderCombatActions();
    if (typeof renderPlayerPanel === "function") renderPlayerPanel();
    FX.floatText("死亡拥抱！复活！", "player-sprite");
    addLog("死亡拥抱！以 1HP 复活", "heal");
    console.log("[buff] death_embrace revived");
    return;
  }

  // Check if player has non-relic buffs to choose from
  if (player && player.activeBuffs && player.activeBuffs.length > 0) {
    var pickable = [];
    for (var i = 0; i < player.activeBuffs.length; i++) {
      if (!player.activeBuffs[i].isRelic) {
        pickable.push(player.activeBuffs[i]);
      }
    }
    if (pickable.length > 0) {
      console.log('[relic] playerDied: showing relic selection with', pickable.length, 'buffs');
      player.isDead = true;
      saveGame();
      showRelicSelection(pickable, keptGold);
      return;
    }
  }

  // No buffs to choose from — go straight to game over
  console.log('[relic] playerDied: no buffs, going straight to game over');
  player.isDead = true;
  saveGame();
  finishGameOver(keptGold);
}

/**
 * Finalize game over screen (called after relic selection).
 * @param {number} keptGold
 */
function finishGameOver(keptGold) {
  gameState.screen = 'gameover';
  showScreen('gameover');
  renderGameOverScreen(keptGold);
  addLog('你倒下了……', 'dmg');
}

/**
 * Gain EXP, level up if needed.
 * @param {number} amount
 */
function gainExp(amount) {
  var bonusMult = 1;
  if (player.buffStats && player.buffStats.expBonus > 0) bonusMult = 1 + player.buffStats.expBonus;
  amount = Math.floor(amount * bonusMult);
  if (bonusMult !== 1) console.log('[buff] expBonus ' + (bonusMult - 1) * 100 + '%: original amount was ' + Math.floor(amount / bonusMult) + ' -> ' + amount);
  console.log('[combat] gainExp(' + amount + ') current=' + player.exp + ' next=' + player.expNext);
  player.exp += amount;

  while (player.exp >= player.expNext) {
    player.exp -= player.expNext;
    player.lvl++;
    player.expNext = calcExpNext(player.lvl);

    console.log('[combat] LEVEL UP to ' + player.lvl);
    try {
      recalcPlayerStats();
    } catch (e) {
      console.log('[combat] ERROR in recalcPlayerStats:', e.message, e.stack);
    }

    // Full heal on level up
    player.hp = player.maxHp;
    player.mp = player.maxMp;

    addLog('升级！等级 ' + player.lvl + ' — HP:' + player.maxHp + ' ATK:' + getPlayerAtk() + ' DEF:' + getPlayerDef(), 'loot');
    FX.floatText('LEVEL UP!', 'center');
    playSound('levelUp');
    saveGame();
  }
  console.log('[combat] gainExp done, exp=' + player.exp + ' lvl=' + player.lvl);
}

/** Decrement all skill cooldowns. */
function tickCooldowns() {
  // Check for mana_tide buff (reduces cooldowns by 1 extra, min 1)
  var hasManaTide = false;
  if (player.activeBuffs) {
    for (var mi = 0; mi < player.activeBuffs.length; mi++) {
      var mId = typeof player.activeBuffs[mi] === "string" ? player.activeBuffs[mi] : player.activeBuffs[mi].id;
      if (mId === "mana_tide") { hasManaTide = true; break; }
    }
  }
  var keys = Object.keys(player.skillCooldowns);
  for (var i = 0; i < keys.length; i++) {
    if (player.skillCooldowns[keys[i]] > 0) {
      var reduce = hasManaTide ? 2 : 1;
      player.skillCooldowns[keys[i]] = Math.max(0, player.skillCooldowns[keys[i]] - reduce);
    }
  }
}

/** Tick player status effects (DOTs, etc.). */
function tickPlayerStatuses() {
  var surviving = [];
  for (var i = 0; i < player.statuses.length; i++) {
    var s = player.statuses[i];
    s.turnsLeft--;
    if (s.type === 'dot' && s.turnsLeft > 0) {
      player.hp -= s.value;
      addLog('受到 ' + s.value + ' 点' + (s.id === 'poison' ? '中毒' : '') + '伤害', 'dmg');
    }
    if (s.turnsLeft > 0) surviving.push(s);
  }
  player.statuses = surviving;
}

/** Decrement active buff cooldowns. */
function tickActiveBuffCooldowns() {
  if (!combatState || !combatState.activeBuffCooldowns) return;
  var keys = Object.keys(combatState.activeBuffCooldowns);
  for (var i = 0; i < keys.length; i++) {
    if (combatState.activeBuffCooldowns[keys[i]] > 0) {
      combatState.activeBuffCooldowns[keys[i]]--;
    }
  }
}

/**
 * Attempt to flee from combat. Higher speed = higher chance.
 * Bosses cannot be fled from.
 */
function tryFlee() {
  if (!combatState || combatState.animating) return;
  var enemy = combatState.enemy;

  if (enemy.boss) {
    addLog('无法从 Boss 战逃跑！', 'info');
    return;
  }

  var fleeChance = 30 + getPlayerSpd() * 2;
  if (Math.random() * 100 < fleeChance) {
    if (typeof permanent !== 'undefined' && permanent) trackProgress(permanent, 'flee', 1);
    addLog('成功逃跑！', 'info');
    combatState = null;
    gameState.paused = false;
    gameState.screen = 'dungeon';
    showScreen('dungeon');
    var ca2 = document.getElementById('combat-actions');
    if (ca2) ca2.style.display = 'none';
    var da2 = document.getElementById('dungeon-actions');
    if (da2) da2.style.display = 'block';
    var co2 = document.getElementById('combat-overlay');
    if (co2) co2.style.display = 'none';
    if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
  } else {
    addLog('逃跑失败！', 'dmg');
    renderPlayerAfterAction();
    setTimeout(function () {
      enemyAttack();
      combatState.turn++;
    }, 300);
  }
}

// =================== Class Passives ===================

function isFirstStrike() {
  if (!combatState || !combatState.enemy) return false;
  if (getPlayerSpd() >= (combatState.enemy.spd || 0)) return true;
  // Buff passive: firstStrike chance (swift_foot gives 10%)
  if (player.buffStats && player.buffStats.firstStrike > 0 && Math.random() * 100 < player.buffStats.firstStrike) {
    console.log('[buff] firstStrike by buff chance (' + player.buffStats.firstStrike + '%)');
    return true;
  }
  return false;
}

function applyClassPassiveOnAttack() {
  if (!player || !combatState || !combatState.enemy) return;
  var cd = CLASS_DATA[player.cls];
  if (!cd) return;
  if (cd.passiveBurnChance && Math.random() < cd.passiveBurnChance) {
    var burnDmg = (cd.passiveBurnDmgBase || 3) + player.lvl;
    combatState.enemy.burning = 3;
    combatState.enemy.burnDamage = burnDmg;
    FX.floatText('灼烧!', 'enemy-sprite');
    addLog(combatState.enemy.name + ' 被灼烧！每回合 ' + burnDmg + ' 伤害，持续 3 回合', 'combat');
  }
}

function getClassAdjustedCrit() {
  var crit = getPlayerCrit();
  var cd = CLASS_DATA[player.cls];
  if (cd && cd.passiveFirstStrikeCrit && isFirstStrike()) {
    crit = 100;
  }
  return crit;
}

function tickEnemyBurn() {
  if (!combatState || !combatState.enemy) return;
  var enemy = combatState.enemy;
  if (enemy.burning && enemy.burning > 0) {
    enemy.hp -= enemy.burnDamage;
    enemy.burning--;
    FX.floatText('-' + enemy.burnDamage + ' 灼烧', 'enemy-sprite');
    addLog(enemy.name + ' 受到 ' + enemy.burnDamage + ' 点灼烧伤害', 'combat');
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemyDefeated();
      return true;
    }
  }
  return false;
}

function tickEnemyPoison() {
  if (!combatState || !combatState.enemy) return;
  var enemy = combatState.enemy;
  if (enemy.poisoning && enemy.poisoning > 0) {
    var poisonDmg = enemy.poisonDamage || 5;
    enemy.hp -= poisonDmg;
    enemy.poisoning--;
    FX.floatText('-' + poisonDmg + ' 中毒', 'enemy-sprite');
    addLog(enemy.name + ' 受到 ' + poisonDmg + ' 点中毒伤害', 'combat');
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemyDefeated();
      return true;
    }
  }
  return false;
}

function tickEnemyDOTs() {
  if (tickEnemyBurn()) return;
  if (tickEnemyPoison()) return;
}

function getClassSkills(cls) {
  cls = cls || 'warrior';
  var result = [];
  for (var i = 0; i < SKILLS.length; i++) {
    if (SKILLS[i].cls === cls || !SKILLS[i].cls) {
      result.push(SKILLS[i]);
    }
  }
  return result;
}

window.applyClassPassiveOnAttack = applyClassPassiveOnAttack;
window.getClassAdjustedCrit = getClassAdjustedCrit;
window.getClassSkills = getClassSkills;
window.tickEnemyDOTs = tickEnemyDOTs;
window.isFirstStrike = isFirstStrike;
window.getActiveBuffs = getActiveBuffs;
window.useActiveBuff = useActiveBuff;
window.tickActiveBuffCooldowns = tickActiveBuffCooldowns;
