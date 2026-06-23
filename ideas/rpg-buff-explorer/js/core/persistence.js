// persistence.js — localStorage 存档系统

const SAVE_SLOT_COUNT = 5;
var autoSaveCounter = 1;

function saveSlotKey(n) { return 'rpg_buff_save_' + n; }

// Legacy key for backward-compatible reads
var LEGACY_SAVE_KEY = 'rpg_buff_save';
// Expose for main.js continue button
var SAVE_KEY = LEGACY_SAVE_KEY;

const PERMANENT_KEY = 'rpg_buff_permanent';
const THEME_UNLOCKS_KEY = 'rpg_buff_theme_unlocks';

const DEFAULT_UNLOCKED = [
  'iron_skin', 'swift_foot', 'sharp_eye', 'mana_flow',
  'steadfast', 'gold_hound', 'berserks_blessing', 'spirit_eagle'
];

const TALENT_DEFS = {
  vitalis:        { name: '生命涌动',  desc: '最大HP +20%',   stat: 'maxHp',  pct: 0.2 },
  mana_wellspring: { name: '法力源泉',  desc: '最大MP +20%',   stat: 'maxMp',  pct: 0.2 },
  might:          { name: '力量',      desc: '攻击 +20%',     stat: 'baseAtk', pct: 0.2 },
  ironwall:       { name: '铁壁',      desc: '防御 +20%',     stat: 'baseDef', pct: 0.2 },
  eagle_eye:      { name: '鹰眼',      desc: '暴击率 +10%',   stat: 'crit',    pct: 0.1 },
};

// =================== 默认值 ===================

function defaultPermanentStats() {
  return {
    totalKills: 0,
    maxFloor: 0,
    totalRuns: 0,
    bossKills: 0,
    totalGold: 0,
    totalDeaths: 0,
    wins: 0,
    totalDamageDealt: 0,
    totalFlees: 0,
    totalSkillUses: 0,
    totalDamageTaken: 0,
  };
}

function defaultTalents() {
  return { vitalis: 0, mana_wellspring: 0, might: 0, ironwall: 0, eagle_eye: 0 };
}

function defaultBuffUnlockProgress() {
  var progress = {};
  for (var i = 0; i < BUFF_DEFS.length; i++) {
    var cond = BUFF_DEFS[i].unlockCondition;
    if (cond) {
      progress[cond.type] = progress[cond.type] || {};
      progress[cond.type][BUFF_DEFS[i].id] = 0;
    }
  }
  return progress;
}

// =================== 永久数据 ===================

function loadPermanent() {
  try {
    var raw = localStorage.getItem(PERMANENT_KEY);
    if (raw) {
      var data = JSON.parse(raw);
      // merge with defaults
      var stats = Object.assign(defaultPermanentStats(), data.permanentStats);
      var talents = Object.assign(defaultTalents(), data.talents);
      var unlocked = data.unlockedBuffs || DEFAULT_UNLOCKED.slice();
      var progress = data.buffUnlockProgress || defaultBuffUnlockProgress();
      var shards = typeof data.soulShards === 'number' ? data.soulShards : 0;
      var relic = data.relic || null;
      var equipRelic = data.equipRelic || null;
      return { permanentStats: stats, soulShards: shards, talents: talents, unlockedBuffs: unlocked, buffUnlockProgress: progress, relic: relic, equipRelic: equipRelic };
    }
  } catch (e) { /* ignore */ }
  return {
    permanentStats: defaultPermanentStats(),
    soulShards: 0,
    talents: defaultTalents(),
    unlockedBuffs: DEFAULT_UNLOCKED.slice(),
    buffUnlockProgress: defaultBuffUnlockProgress(),
    relic: null,
    equipRelic: null,
  };
}

function savePermanent(permanent) {
  try {
    localStorage.setItem(PERMANENT_KEY, JSON.stringify(permanent));
  } catch (e) { /* quota exceeded — ignore */ }
}

// =================== 存档序列化 ===================

function serializeGameData() {
  return {
    player: {
      cls: player.cls, lvl: player.lvl, exp: player.exp, expNext: player.expNext,
      hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp,
      baseAtk: player.baseAtk, baseDef: player.baseDef, baseSpd: player.baseSpd,
      crit: player.crit, luck: player.luck,
      equip: player.equip, inventory: player.inventory,
      gold: player.gold, gems: player.gems,
      activeBuffs: player.activeBuffs, skillCooldowns: player.skillCooldowns,
      statuses: player.statuses,
      x: player.x, y: player.y,
      gemBonusAtk: player.gemBonusAtk, gemBonusDef: player.gemBonusDef, gemBonusHp: player.gemBonusHp,
      synergyReviveUsed: player.synergyReviveUsed,
      buffsLeft: player.buffsLeft,
      _slowTurns: player._slowTurns,
      _invertTurns: player._invertTurns,
    },
    dungeon: {
      grid: dungeon.grid, rooms: dungeon.rooms,
      items: dungeon.items, traps: dungeon.traps,
      enemies: dungeon.enemies,
      playerStart: dungeon.playerStart, stairsPos: dungeon.stairsPos,
      revealed: dungeon.revealed, floor: dungeon.floor,
      theme: dungeon.theme,
      visibility: dungeon.visibility,
    },
    gold: player.gold,
    gameState: {
      floor: gameState.floor, turnCount: gameState.turnCount,
      eventsThisFloor: gameState.eventsThisFloor, bossDefeated: gameState.bossDefeated,
      shrinesUsedThisFloor: gameState.shrinesUsedThisFloor,
      paused: gameState.paused, screen: gameState.screen,
    },
  };
}

function deserializeGameData(data) {
  player = data.player;
  player.statuses = data.player.statuses || [];

  // Restore transient trap effects
  if (data.player._slowTurns) player._slowTurns = data.player._slowTurns;
  if (data.player._invertTurns) player._invertTurns = data.player._invertTurns;

  // Restore gem enhancements
  if (data.player.gemBonusAtk) player.gemBonusAtk = data.player.gemBonusAtk;
  if (data.player.gemBonusDef) player.gemBonusDef = data.player.gemBonusDef;
  if (data.player.gemBonusHp) player.gemBonusHp = data.player.gemBonusHp;

  // Restore synergy state
  if (data.player.synergyReviveUsed) player.synergyReviveUsed = data.player.synergyReviveUsed;
  if (data.player.buffsLeft) player.buffsLeft = data.player.buffsLeft;

  dungeon = data.dungeon;
  if (data.gameState) {
    gameState.floor = data.gameState.floor;
    gameState.turnCount = data.gameState.turnCount;
    gameState.eventsThisFloor = data.gameState.eventsThisFloor;
    gameState.bossDefeated = data.gameState.bossDefeated;
    gameState.shrinesUsedThisFloor = data.gameState.shrinesUsedThisFloor || {};
    gameState.paused = data.gameState.paused;
    gameState.screen = data.gameState.screen || 'dungeon';
  }

  // Recalculate derived stats (buffStats, activeSynergies) from activeBuffs
  if (typeof recalcBuffStats === 'function') recalcBuffStats();
  recalcPlayerStats();
}

function buildMetadata(data, slot, type, isDead) {
  return {
    slot: slot,
    type: type,
    timestamp: new Date().getTime(),
    className: data.player.cls,
    level: data.player.lvl,
    floor: data.dungeon.floor,
    hp: data.player.hp,
    maxHp: data.player.maxHp,
    isDead: !!isDead,
    gold: data.player.gold,
    gems: data.player.gems || 0,
    data: data
  };
}

// =================== 多存档位系统 ===================

function migrateLegacySave() {
  try {
    var raw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (raw) {
      var oldData = JSON.parse(raw);
      if (oldData.player && oldData.dungeon) {
        var meta = buildMetadata(oldData, 1, 'auto', oldData.player.hp <= 0);
        localStorage.setItem(saveSlotKey(1), JSON.stringify(meta));
      }
      localStorage.removeItem(LEGACY_SAVE_KEY);
      console.log('[save] migrated legacy save to slot 1');
    }
  } catch (e) {
    try { localStorage.removeItem(LEGACY_SAVE_KEY); } catch (_) {}
  }
}

function saveGame(slot) {
  if (!player || !dungeon) return;

  // Auto-save: rotate between slot 1 and 2
  if (slot === undefined || slot === null) {
    slot = autoSaveCounter;
    autoSaveCounter = autoSaveCounter === 1 ? 2 : 1;
  }

  console.log('[save] slot=' + slot + ' player: cls=' + player.cls + ' x=' + player.x + ' y=' + player.y);
  console.log('[save] dungeon: floor=' + dungeon.floor + ' gridLen=' + (dungeon.grid ? dungeon.grid.length : 0) + ' enemiesLen=' + (dungeon.enemies ? dungeon.enemies.length : 0) + ' hasTheme=' + !!dungeon.theme);
  console.log('[save] gameState: floor=' + gameState.floor + ' paused=' + gameState.paused);

  try {
    var data = serializeGameData();
    var type = (slot === 1 || slot === 2) ? 'auto' : 'manual';
    var meta = buildMetadata(data, slot, type, player.hp <= 0);
    localStorage.setItem(saveSlotKey(slot), JSON.stringify(meta));
  } catch (e) { /* ignore */ }
}

function loadGame(slot) {
  // Default to slot 1 for backward compatibility
  if (slot === undefined || slot === null) slot = 1;

  try {
    var raw = localStorage.getItem(saveSlotKey(slot));
    if (!raw) return false;
    var meta = JSON.parse(raw);
    var data = meta.data;
    if (!data || !data.player || !data.dungeon) return false;

    deserializeGameData(data);
    return true;
  } catch (e) {
    return false;
  }
}

function getAllSaves() {
  var result = [];
  for (var i = 1; i <= SAVE_SLOT_COUNT; i++) {
    try {
      var raw = localStorage.getItem(saveSlotKey(i));
      if (raw) {
        var meta = JSON.parse(raw);
        result.push({
          slot: i,
          type: meta.type || 'auto',
          timestamp: meta.timestamp || 0,
          className: meta.className || '',
          level: meta.level || 1,
          floor: meta.floor || 1,
          hp: meta.hp || 0,
          maxHp: meta.maxHp || 0,
          isDead: !!meta.isDead,
          gold: meta.gold || 0,
          gems: meta.gems || 0,
          isEmpty: false
        });
      } else {
        result.push({ slot: i, isEmpty: true });
      }
    } catch (e) {
      result.push({ slot: i, isEmpty: true });
    }
  }
  return result;
}

function deleteSave(slot) {
  try {
    localStorage.removeItem(saveSlotKey(slot));
  } catch (e) { /* ignore */ }
}

function clearAutoSaves() {
  deleteSave(1);
  deleteSave(2);
}

function hasAnySave() {
  // Check new slots first
  for (var i = 1; i <= SAVE_SLOT_COUNT; i++) {
    if (localStorage.getItem(saveSlotKey(i))) return true;
  }
  // Fallback to legacy
  return !!localStorage.getItem(LEGACY_SAVE_KEY);
}

// =================== 灵魂碎片 ===================

function addSoulShards(permanent, amount) {
  permanent.soulShards += amount;
  savePermanent(permanent);
}

// =================== 遗物 ===================

function saveRelic(permanent, buffId) {
  console.log('[relic] saveRelic:', buffId);
  permanent.relic = buffId;
  savePermanent(permanent);
}

// =================== 天赋解锁 ===================

function unlockTalent(permanent, talentId) {
  var def = TALENT_DEFS[talentId];
  if (!def) return false;
  if (permanent.talents[talentId] >= 10) return false; // cap at 10
  var totalSpent = 0;
  var keys = Object.keys(permanent.talents);
  for (var i = 0; i < keys.length; i++) totalSpent += permanent.talents[keys[i]];
  if (totalSpent >= permanent.soulShards) return false;

  permanent.talents[talentId]++;
  permanent.soulShards--;
  savePermanent(permanent);
  return true;
}

// =================== 天赋重置 ===================

function resetTalents(permanent) {
  var totalToRefund = 0;
  var keys = Object.keys(permanent.talents);
  for (var i = 0; i < keys.length; i++) {
    totalToRefund += permanent.talents[keys[i]];
    permanent.talents[keys[i]] = 0;
  }
  permanent.soulShards += totalToRefund;
  savePermanent(permanent);
  return totalToRefund;
}

// =================== 天赋加成（初始化时应用） ===================

function applyTalentBonuses(permanent) {
  if (!player) return;
  var t = permanent.talents;
  if (t.vitalis)         player.maxHp = Math.floor(player.maxHp * (1 + TALENT_DEFS.vitalis.pct * t.vitalis));
  if (t.mana_wellspring) player.maxMp = Math.floor(player.maxMp * (1 + TALENT_DEFS.mana_wellspring.pct * t.mana_wellspring));
  if (t.might)           player.baseAtk = Math.floor(player.baseAtk * (1 + TALENT_DEFS.might.pct * t.might));
  if (t.ironwall)        player.baseDef = Math.floor(player.baseDef * (1 + TALENT_DEFS.ironwall.pct * t.ironwall));
  if (t.eagle_eye)       player.crit = Math.floor(player.crit * (1 + TALENT_DEFS.eagle_eye.pct * t.eagle_eye));
  // HP/MP already set from max, sync current
  player.hp = player.maxHp;
  player.mp = player.maxMp;
}

// =================== Buff 解锁检查 ===================

function trackProgress(permanent, type, amount) {
  var progress = permanent.buffUnlockProgress;
  if (!progress || !progress[type]) return;
  var targets = progress[type];
  var ids = Object.keys(targets);
  for (var i = 0; i < ids.length; i++) {
    targets[ids[i]] = (targets[ids[i]] || 0) + amount;
  }
}

function checkBuffUnlocks(permanent) {
  var newUnlocks = [];
  var progress = permanent.buffUnlockProgress;
  if (!progress) return newUnlocks;

  for (var i = 0; i < BUFF_DEFS.length; i++) {
    var buff = BUFF_DEFS[i];
    var cond = buff.unlockCondition;
    if (!cond) continue;
    if (permanent.unlockedBuffs.indexOf(buff.id) !== -1) continue;

    var current = 0;
    if (progress[cond.type] && progress[cond.type][buff.id] !== undefined) {
      current = progress[cond.type][buff.id];
    }
    // Also check permanentStats for some types
    if (cond.type === 'kill' && permanent.permanentStats.totalKills >= cond.value) current = cond.value;
    if (cond.type === 'death' && permanent.permanentStats.totalDeaths >= cond.value) current = cond.value;
    if (cond.type === 'boss' && permanent.permanentStats.bossKills >= cond.value) current = cond.value;
    if (cond.type === 'clear' && permanent.permanentStats.wins >= cond.value) current = cond.value;
    if (cond.type === 'gold' && permanent.permanentStats.totalGold >= cond.value) current = cond.value;
    if (cond.type === 'flee' && permanent.permanentStats.totalFlees >= cond.value) current = cond.value;
    if (cond.type === 'floor' && permanent.permanentStats.maxFloor >= cond.value) current = cond.value;
    if (cond.type === 'damage_taken') {
      var dtProgress = progress.damage_taken ? progress.damage_taken[buff.id] || 0 : 0;
      if (dtProgress >= cond.value) current = cond.value;
    }
    if (cond.type === 'skill_use') {
      var suProgress = progress.skill_use ? progress.skill_use[buff.id] || 0 : 0;
      if (suProgress >= cond.value) current = cond.value;
    }

    if (current >= cond.value) {
      permanent.unlockedBuffs.push(buff.id);
      newUnlocks.push(buff);
    }
  }

  if (newUnlocks.length > 0) {
    savePermanent(permanent);
    if (typeof showUnlockModal === 'function') {
      setTimeout(function() { showUnlockModal(newUnlocks); }, 300);
    }
  }
  return newUnlocks;
}

// =================== 通关/死亡回调 ===================

function onVictory(permanent) {
  permanent.permanentStats.wins++;
  permanent.permanentStats.totalRuns++;
  if (gameState.floor > permanent.permanentStats.maxFloor) {
    permanent.permanentStats.maxFloor = gameState.floor;
  }
  // +3 soul shards
  permanent.soulShards += 3;
  checkBuffUnlocks(permanent);
  savePermanent(permanent);

  // Clear reward: gold + gems from economy system
  if (typeof calculateClearReward === 'function') {
    var clearReward = calculateClearReward(gameState.floor);
    addGold(clearReward.gold);
    addGems(clearReward.gems);
    console.log('[victory] clear reward: gold=' + clearReward.gold + ', gems=' + clearReward.gems);
  }

  // Theme progress: total clears + clears by class + play time
  if (typeof trackThemeProgress === 'function') {
    trackThemeProgress('totalClears', 1);
    if (player) trackThemeProgress('clearsByClass', player.cls);
    trackThemeProgress('totalPlayTime', Math.floor(gameState.turnCount * 5));
  }
}

function onDeath(permanent) {
  permanent.permanentStats.totalDeaths++;
  permanent.permanentStats.totalRuns++;
  if (gameState.floor > permanent.permanentStats.maxFloor) {
    permanent.permanentStats.maxFloor = gameState.floor;
  }

  // Call economy's onGameOver() to handle gem + gold death logic (unified handler)
  if (typeof onGameOver === 'function') {
    var eco = onGameOver();
    var keptGold = eco.keptGold;
    var keptGems = eco.keptGems;
  } else {
    // Fallback: original behavior if onGameOver not available
    var keptGold = Math.floor((player ? player.gold : 0) * 0.5);
    var keptGems = 0;
  }

  // Sync gems to permanent if onGameOver didn't (old path)
  if (keptGems > 0 && !('gems' in permanent)) {
    permanent.gems = (permanent.gems || 0) + keptGems;
  }

  savePermanent(permanent);
  return keptGold;
}

// =================== 主题解锁 ===================

function loadThemeUnlocks() {
  try {
    var raw = localStorage.getItem(THEME_UNLOCKS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { pixel_retro: true };
}

function saveThemeUnlocks(unlocks) {
  try {
    localStorage.setItem(THEME_UNLOCKS_KEY, JSON.stringify(unlocks));
  } catch (e) {}
}

function unlockTheme(id) {
  if (id === 'default') return true;
  var unlocks = loadThemeUnlocks();
  unlocks[id] = true;
  saveThemeUnlocks(unlocks);
  if (typeof window.themeManager === 'object') window.themeManager.unlock(id);
}

function checkThemeUnlocks(floor) {
  if (!floor) return;
  if (floor >= 3 && typeof window.themeManager === 'object') {
    if (!window.themeManager.isUnlocked('blood_moon')) {
      unlockTheme('blood_moon');
      addLog('解锁主题：血月之夜！', 'loot');
    }
  }
}

// Global exports for onclick handlers and testing
window.saveGame = saveGame;
window.loadGame = loadGame;
window.savePermanent = savePermanent;
window.loadPermanent = loadPermanent;
window.unlockTheme = unlockTheme;
window.checkThemeUnlocks = checkThemeUnlocks;
window.loadThemeUnlocks = loadThemeUnlocks;
window.resetTalents = resetTalents;
window.getAllSaves = getAllSaves;
window.deleteSave = deleteSave;
window.clearAutoSaves = clearAutoSaves;
window.hasAnySave = hasAnySave;
window.migrateLegacySave = migrateLegacySave;
