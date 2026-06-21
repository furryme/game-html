// persistence.js — localStorage 存档系统

const SAVE_KEY = 'rpg_buff_save';
const PERMANENT_KEY = 'rpg_buff_permanent';

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
      return { permanentStats: stats, soulShards: shards, talents: talents, unlockedBuffs: unlocked, buffUnlockProgress: progress, relic: relic };
    }
  } catch (e) { /* ignore */ }
  return {
    permanentStats: defaultPermanentStats(),
    soulShards: 0,
    talents: defaultTalents(),
    unlockedBuffs: DEFAULT_UNLOCKED.slice(),
    buffUnlockProgress: defaultBuffUnlockProgress(),
    relic: null,
  };
}

function savePermanent(permanent) {
  try {
    localStorage.setItem(PERMANENT_KEY, JSON.stringify(permanent));
  } catch (e) { /* quota exceeded — ignore */ }
}

// =================== 当前存档 ===================

function saveGame() {
  if (!player || !dungeon) return;
  try {
    var data = {
      player: {
        cls: player.cls, lvl: player.lvl, exp: player.exp, expNext: player.expNext,
        hp: player.hp, maxHp: player.maxHp, mp: player.mp, maxMp: player.maxMp,
        baseAtk: player.baseAtk, baseDef: player.baseDef, baseSpd: player.baseSpd,
        crit: player.crit, luck: player.luck,
        equip: player.equip, inventory: player.inventory,
        gold: player.gold, gems: player.gems,
        activeBuffs: player.activeBuffs, skillCooldowns: player.skillCooldowns,
        x: player.x, y: player.y,
      },
      dungeon: {
        grid: dungeon.grid, rooms: dungeon.rooms,
        items: dungeon.items, traps: dungeon.traps,
        playerStart: dungeon.playerStart, stairsPos: dungeon.stairsPos,
        revealed: dungeon.revealed, floor: dungeon.floor,
      },
      gold: player.gold,
      gameState: {
        floor: gameState.floor, turnCount: gameState.turnCount,
        eventsThisFloor: gameState.eventsThisFloor, bossDefeated: gameState.bossDefeated,
      },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* ignore */ }
}

function loadGame() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    var data = JSON.parse(raw);
    if (!data.player || !data.dungeon) return false;

    player = data.player;
    dungeon = data.dungeon;
    if (data.gameState) {
      gameState.floor = data.gameState.floor;
      gameState.turnCount = data.gameState.turnCount;
      gameState.eventsThisFloor = data.gameState.eventsThisFloor;
      gameState.bossDefeated = data.gameState.bossDefeated;
    }

    recalcPlayerStats();
    return true;
  } catch (e) {
    return false;
  }
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

    if (current >= cond.value) {
      permanent.unlockedBuffs.push(buff.id);
      newUnlocks.push(buff);
    }
  }

  if (newUnlocks.length > 0) savePermanent(permanent);
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
}

function onDeath(permanent) {
  permanent.permanentStats.totalDeaths++;
  permanent.permanentStats.totalRuns++;
  if (gameState.floor > permanent.permanentStats.maxFloor) {
    permanent.permanentStats.maxFloor = gameState.floor;
  }
  // keep 50% gold as permanent bonus (carried to next run startGold)
  var keptGold = Math.floor((player ? player.gold : 0) * 0.5);
  savePermanent(permanent);
  return keptGold;
}

// Global exports for onclick handlers and testing
window.saveGame = saveGame;
window.loadGame = loadGame;
window.savePermanent = savePermanent;
window.loadPermanent = loadPermanent;
