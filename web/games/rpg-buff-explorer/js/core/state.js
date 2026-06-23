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
    activeSynergies: [],
    synergyReviveUsed: false,
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
    maxHp: 120 + (lvl - 1) * 20,
    maxMp: 20 + (lvl - 1) * 3,
    baseAtk: 10 + (lvl - 1) * 3,
    baseDef: 5 + (lvl - 1) * 2,
    baseSpd: 8 + (lvl - 1) * 1,
  };
}

/** Class-aware base stats. Uses CLASS_DATA growth if available, falls back to warrior formula. */
function calcClassStats(lvl, cls) {
  var cd = CLASS_DATA[cls];
  if (!cd) return calcStatsFromLevel(lvl);
  return {
    maxHp: cd.hp + (lvl - 1) * (cd.hpGrowth || 20),
    maxMp: cd.mp + (lvl - 1) * (cd.mpGrowth || 3),
    baseAtk: cd.atk + (lvl - 1) * (cd.atkGrowth || 3),
    baseDef: cd.def + (lvl - 1) * (cd.defGrowth || 2),
    baseSpd: cd.spd + (lvl - 1) * (cd.spdGrowth || 1),
  };
}

/**
 * Recalculate derived stats from buffs, equipment, and level.
 * Also applies permanent talent bonuses.
 */
function recalcPlayerStats() {
  const lvlStats = calcClassStats(player.lvl, player.cls);
  player.maxHp = lvlStats.maxHp;
  player.maxMp = lvlStats.maxMp;
  player.baseAtk = lvlStats.baseAtk;
  player.baseDef = lvlStats.baseDef;
  player.baseSpd = lvlStats.baseSpd;

  // Update crit from class data (rogue has high crit)
  var cd = CLASS_DATA[player.cls];
  if (cd) {
    player.crit = cd.crit + (player.lvl - 1) * (cd.critGrowth || 0);
  }

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

  // Apply hpMult from buffStats so HP penalty scales with level
  if (player.buffStats && player.buffStats.hpMult !== 1) {
    player.maxHp = Math.floor(player.maxHp * player.buffStats.hpMult);
  }

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

  // Start with no buffs — player earns them via showBuffSelection at floor breaks
  player.activeBuffs = [];

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

  // Load equipment relic from previous run
  if (perm && perm.equipRelic && perm.equipRelic instanceof Object) {
    player.equip = JSON.parse(JSON.stringify(perm.equipRelic));
    console.log('[relic] Loaded equipment relic:', Object.keys(perm.equipRelic).join(', '));
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
  // hpMult handled in recalcPlayerStats via buffStats so it scales with level
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

function getClassLabel(cls) {
  var cd = CLASS_DATA[cls];
  return cd ? cd.label : (cls || '战士');
}

function getClassIcon(cls) {
  var cd = CLASS_DATA[cls];
  return cd ? cd.icon : '⚔️';
}

function getClassColor(cls) {
  var cd = CLASS_DATA[cls];
  return cd ? cd.color : '#d4a855';
}

Object.defineProperty(window, "gameState", { get: function() { return gameState; }, configurable: true });
Object.defineProperty(window, "player", { get: function() { return player; }, configurable: true });
Object.defineProperty(window, "dungeon", { get: function() { return dungeon; }, configurable: true });
Object.defineProperty(window, "combatState", { get: function() { return combatState; }, configurable: true });
window.calcClassStats = calcClassStats;
window.getClassLabel = getClassLabel;
window.getClassIcon = getClassIcon;
window.getClassColor = getClassColor;
