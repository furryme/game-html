// combat.js — Turn-based combat system

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
  if (player.buffStats && player.buffStats.atkMult) {
    atk = Math.floor(atk * player.buffStats.atkMult);
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

  var isCrit = Math.random() * 100 < getPlayerCrit();
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
  FX.burst('enemy-sprite', isCrit ? 'crimson' : 'steel');
  FX.floatText('-' + damage + (isCrit ? ' 暴击！' : ''), 'enemy-sprite');
  FX.shake('enemy-sprite', 3);

  addLog(
    '你攻击 ' + combatState.enemy.name + '，造成 ' + damage + ' 点伤害' + (isCrit ? '（暴击）' : ''),
    'combat'
  );

  if (combatState.enemy.hp <= 0) {
    combatState.enemy.hp = 0;
    enemyDefeated();
    return;
  }

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

  var isCrit = Math.random() * 100 < getPlayerCrit();
  var damage = calcDamage(atk, skill.mult || 1, def, isCrit);

  combatState.enemy.hp -= damage;
  FX.burst('enemy-sprite', skill.color || 'blue');
  FX.floatText('-' + damage + ' ' + skill.name, 'enemy-sprite');
  FX.shake('enemy-sprite', 5);

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
  } else if (skill.type === 'dmg_self') {
    var selfDmg2 = Math.floor(player.maxHp * (skill.selfDmgPct || 0.3));
    player.hp -= selfDmg2;
    addLog('受到了 ' + selfDmg2 + ' 点反噬伤害！', 'dmg');
  } else if (skill.type === 'multi_hit') {
    var hits = skill.hits || 2;
    for (var hi = 1; hi < hits; hi++) {
      var extraDmg = calcDamage(atk, skill.mult || 0.8, def, Math.random() * 100 < getPlayerCrit());
      combatState.enemy.hp -= extraDmg;
      addLog('第 ' + (hi + 1) + ' 击造成 ' + extraDmg + ' 点伤害', 'combat');
    }
  }

  if (combatState.enemy.hp <= 0) {
    combatState.enemy.hp = 0;
    enemyDefeated();
    return;
  }

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
      player.hp -= damage;

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

  if (player.hp <= 0) {
    player.hp = 0;
    playerDied();
    return;
  }

  // Tick cooldowns
  tickCooldowns();

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

/** Void debuff — floor 3: enemies get ATK+20%, player gets EXP+50%. */
function voidEnemyAtk(baseAtk) {
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'void') {
    return Math.floor(baseAtk * 1.2);
  }
  return baseAtk;
}

function voidExpMult() {
  if (dungeon && dungeon.theme && dungeon.theme.envBuff && dungeon.theme.envBuff.id === 'void') {
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

  try {
    // Gold bonus from buffs
    if (player.activeBuffs) {
      for (var gi = 0; gi < player.activeBuffs.length; gi++) {
        var b = player.activeBuffs[gi];
        var def = findBuffDef(b.id);
        if (def && def.passive && def.passive.goldBonus) {
          gold = Math.floor(gold * (1 + def.passive.goldBonus));
        }
      }
    }

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
      if (typeof checkBuffUnlocks === 'function') checkBuffUnlocks(permanent);
    }

    // Boss defeated flag
    if (enemy.boss) {
      gameState.bossDefeated = true;
      addLog('Boss 被击败！楼梯已开启', 'loot');
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
  playSound('death');
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
      showRelicSelection(pickable, keptGold);
      return;
    }
  }

  // No buffs to choose from — go straight to game over
  console.log('[relic] playerDied: no buffs, going straight to game over');
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
  }
  console.log('[combat] gainExp done, exp=' + player.exp + ' lvl=' + player.lvl);
}

/** Decrement all skill cooldowns. */
function tickCooldowns() {
  var keys = Object.keys(player.skillCooldowns);
  for (var i = 0; i < keys.length; i++) {
    if (player.skillCooldowns[keys[i]] > 0) {
      player.skillCooldowns[keys[i]]--;
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
    if (typeof renderPlayerPanel === 'function') renderPlayerPanel();
  } else {
    addLog('逃跑失败！', 'dmg');
    setTimeout(function () {
      enemyAttack();
      combatState.turn++;
    }, 300);
  }
}
