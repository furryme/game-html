// state.js — Global game state and initialization

let gameState = {
  screen: 'title',
  floor: 1,
  paused: false,
  turnCount: 0,
  eventsThisFloor: 0,
  bossDefeated: false,
};
let player = null;
let dungeon = null;
let combatState = null;

/**
 * Initialize player with a given class.
 * @param {'warrior'|'mage'|'ranger'} cls
 */
function initPlayer(cls) {
  cls = cls || 'warrior';
  const base = CLASS_DATA[cls];
  player = {
    cls: cls,
    lvl: 1,
    exp: 0,
    expNext: 30,
    hp: 120,
    maxHp: 120,
    mp: 30,
    maxMp: 30,
    baseAtk: 14,
    baseDef: 10,
    baseSpd: 8,
    crit: 5,
    luck: 0,
    equip: { weapon: null, armor: null, accessory: null },
    inventory: { hp_potion: 3, equipment: [] },
    gold: 20,
    gems: 0,
    activeBuffs: [],
    buffStats: null,
    skillCooldowns: {},
    statuses: [],
    weaponBoost: 0,
    armorBoost: 0,
    gemBonusAtk: 0,
    gemBonusDef: 0,
    gemBonusHp: 0,
    x: 0,
    y: 0,
  };
  if (base) {
    player.baseAtk = base.atk;
    player.baseDef = base.def;
    player.baseSpd = base.spd;
    player.crit = base.crit || 5;
    player.luck = base.luck || 0;
    player.maxHp = base.hp;
    player.hp = base.hp;
    player.maxMp = base.mp;
    player.mp = base.mp;
  }
}

/** EXP needed for next level by level. */
function calcExpNext(lvl) {
  const table = [0, 30, 80, 150, 240, 350, 480, 640, 830, 1060];
  return table[lvl] || 1300;
}

/** Base stats at a given level (for level-up recalc). */
function calcStatsFromLevel(lvl) {
  return {
    maxHp: 100 + lvl * 20,
    maxMp: 20 + lvl * 3,
    baseAtk: 10 + lvl * 3,
    baseDef: 5 + lvl * 2,
    baseSpd: 8 + lvl * 1,
  };
}

/**
 * Recalculate derived stats from buffs, equipment, and level.
 * Also applies permanent talent bonuses.
 */
function recalcPlayerStats() {
  const lvlStats = calcStatsFromLevel(player.lvl);
  const cls = CLASS_DATA[player.cls] || {};

  // Use level stats as base (level formula already accounts for growth)
  // Class only provides diffs from default warrior baseline
  player.maxHp = lvlStats.maxHp + ((cls.hp || 0) - 100);
  player.maxMp = lvlStats.maxMp + ((cls.mp || 0) - 20);
  player.baseAtk = lvlStats.baseAtk + ((cls.atk || 0) - 10);
  player.baseDef = lvlStats.baseDef + ((cls.def || 0) - 5);
  player.baseSpd = lvlStats.baseSpd + ((cls.spd || 0) - 8);

  // Apply permanent talent bonuses
  if (typeof permanent !== 'undefined' && permanent && permanent.talents && typeof TALENT_DEFS !== 'undefined') {
    const t = permanent.talents;
    if (t.vitalis)         player.maxHp = Math.floor(player.maxHp * (1 + TALENT_DEFS.vitalis.pct * t.vitalis));
    if (t.mana_wellspring) player.maxMp = Math.floor(player.maxMp * (1 + TALENT_DEFS.mana_wellspring.pct * t.mana_wellspring));
    if (t.might)           player.baseAtk = Math.floor(player.baseAtk * (1 + TALENT_DEFS.might.pct * t.might));
    if (t.ironwall)        player.baseDef = Math.floor(player.baseDef * (1 + TALENT_DEFS.ironwall.pct * t.ironwall));
    if (t.eagle_eye)       player.crit = Math.floor((player.crit || 5) * (1 + TALENT_DEFS.eagle_eye.pct * t.eagle_eye));
  }

  // Add permanent buffs
  if (player.activeBuffs && player.activeBuffs.length) {
    for (let i = 0; i < player.activeBuffs.length; i++) {
      const b = player.activeBuffs[i];
      if (b.stats) {
        if (b.stats.maxHp) player.maxHp += b.stats.maxHp;
        if (b.stats.maxMp) player.maxMp += b.stats.maxMp;
        if (b.stats.baseAtk) player.baseAtk += b.stats.baseAtk;
        if (b.stats.baseDef) player.baseDef += b.stats.baseDef;
        if (b.stats.baseSpd) player.baseSpd += b.stats.baseSpd;
        if (b.stats.crit) player.crit += b.stats.crit;
      }
    }
  }

  // Equipment boosts (from equip.js getEquipStat)
  if (typeof getEquipStat === 'function') {
    const eAtk = getEquipStat('atk');
    const eDef = getEquipStat('def');
    const eHp = getEquipStat('hp');
    const eCrit = getEquipStat('crit');
    const eSpd = getEquipStat('spd');
    if (eAtk) player.baseAtk += eAtk;
    if (eDef) player.baseDef += eDef;
    if (eHp) player.maxHp += eHp;
    if (eCrit) player.crit += eCrit;
    if (eSpd) player.baseSpd += eSpd;
  }

  // Gem enhancement HP bonus
  if (player.gemBonusHp) player.maxHp += player.gemBonusHp;

  // Also recalc buff multipliers (atkMult, defMult, etc.)
  if (typeof recalcBuffStats === 'function') recalcBuffStats();

  // Ensure current hp/mp don't exceed new max
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.mp > player.maxMp) player.mp = player.maxMp;
}

/**
 * Reset run state for a new dungeon run.
 * Keeps permanent unlocks (buffs, skills).
 * @param {Object} [perm] — permanent data from persistence
 */
function resetForNewRun(perm) {
  initPlayer(player ? player.cls : 'warrior');
  gameState.floor = 1;
  gameState.turnCount = 0;
  gameState.eventsThisFloor = 0;
  gameState.bossDefeated = false;
  gameState.paused = false;
  combatState = null;

  // Give player default unlocked buffs as passive stat sources
  if (perm && perm.unlockedBuffs) {
    player.activeBuffs = [];
    for (var i = 0; i < perm.unlockedBuffs.length; i++) {
      // Skip relic buff — it gets added below with isRelic tag
      if (perm.relic && perm.unlockedBuffs[i] === perm.relic) continue;
      var def = findBuffDef(perm.unlockedBuffs[i]);
      if (def) {
        player.activeBuffs.push({
          id: def.id,
          stats: buffDefToStats(def),
          combatDot: def.passive && def.passive.dotDmg ? def.passive.dotDmg : 0,
        });
      }
    }
  }

  // Add relic buff from previous run
  if (perm && perm.relic) {
    var relicDef = findBuffDef(perm.relic);
    if (relicDef) {
      player.activeBuffs.push({
        id: relicDef.id,
        stats: buffDefToStats(relicDef),
        combatDot: relicDef.passive && relicDef.passive.dotDmg ? relicDef.passive.dotDmg : 0,
        isRelic: true,
      });
      console.log('[relic] Added relic buff:', perm.relic, relicDef.name);
    } else {
      // Invalid relic ID, clear it
      perm.relic = null;
      if (typeof savePermanent === 'function') savePermanent(perm);
      console.log('[relic] Cleared invalid relic ID:', perm.relic);
    }
  }
}

/**
 * Convert a buff definition to stat bonuses for recalcPlayerStats.
 * @param {Object} def — buff definition from BUFF_DEFS
 * @returns {Object|null} stat deltas
 */
function buffDefToStats(def) {
  if (!def.passive) return null;
  var p = def.passive;
  var stats = {};
  if (p.atkMult)   stats.baseAtk = Math.floor(14 * (p.atkMult - 1));
  if (p.spdMult)   stats.baseSpd = Math.floor(8 * (p.spdMult - 1));
  if (p.critBonus) stats.crit = p.critBonus;
  if (p.hpMult)    stats.maxHp = Math.floor(120 * (p.hpMult - 1));
  // passive-only effects (dmgReduction, mpRestore, etc.) are handled in combat/movement
  if (Object.keys(stats).length === 0) return null;
  return stats;
}

/** Load permanent progress — alias for persistence.js loadPermanent. */
function loadPermanents() {
  return loadPermanent();
}

/**
 * Save permanent progress — called by economy.js with plural form.
 * Delegates to persistence.js savePermanent.
 */
function savePermanents() {
  if (typeof savePermanent === 'function' && permanent) {
    savePermanent(permanent);
  }
}

Object.defineProperty(window, "gameState", { get: function() { return gameState; }, configurable: true });
Object.defineProperty(window, "player", { get: function() { return player; }, configurable: true });
Object.defineProperty(window, "dungeon", { get: function() { return dungeon; }, configurable: true });
Object.defineProperty(window, "combatState", { get: function() { return combatState; }, configurable: true });
