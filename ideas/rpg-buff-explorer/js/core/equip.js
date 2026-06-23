// equip.js — Equipment generation, loot, equip/unequip, inventory

const EQUIP_SLOT = {
  weapon: { weight: 50, label: '武器' },
  armor: { weight: 30, label: '护甲' },
  accessory: { weight: 20, label: '饰品' },
};

const RARITY = {
  white: { label: '普通', weight: 60, valueMult: 1.0, color: '#ffffff' },
  blue: { label: '稀有', weight: 30, valueMult: 1.6, color: '#55aaff' },
  purple: { label: '史诗', weight: 10, valueMult: 2.5, color: '#cc77ff' },
};

const EQUIP_STAT_DEFS = {
  atk: { label: '攻击', icon: '⚔' },
  def: { label: '防御', icon: '🔖' },
  hp: { label: '最大HP', icon: '❤' },
  crit: { label: '暴击率', icon: '⚡' },
  spd: { label: '速度', icon: '⚡' },
  lifesteal: { label: '吸血率', icon: '🔫' },
  dmgReduction: { label: '减伤率', icon: '💥' },
};

const PREFIX = {
  white: ['生锈的', '破旧的', '普通的', '粗糙的', '简易的'],
  blue: ['锋利的', '坚固的', '流畅的', '光辉的', '精致的', '强力的'],
  purple: ['史诗的', '传说的', '远古的', '神话的', '圣光的', '暗蚀的', '神级的'],
};

const SUFFIX = {
  weapon: ['短剑', '长剑', '重剑', '巨剑', '战斧', '重锤', '匕首', '镰刀'],
  armor: ['轻铠', '锁子甲', '板甲', '战铠', '皮甲', '法袍'],
  accessory: ['戒指', '项链', '护符', '腰带', '头冠', '徽章'],
};

const EQUIP_ICON = {
  weapon: '⚔',
  armor: '🔖',
  accessory: '📋',
};

// Number of random affixes per rarity
const AFFIX_COUNT = { white: 1, blue: 2, purple: 3 };

// Stat pool weights per slot (which stats are likely on each slot type)
const STAT_POOL = {
  weapon: {
    atk: 40, crit: 25, spd: 15, lifesteal: 10, hp: 10,
  },
  armor: {
    def: 40, hp: 25, dmgReduction: 15, spd: 5, atk: 5, crit: 5, lifesteal: 5,
  },
  accessory: {
    hp: 15, atk: 12, def: 12, crit: 12, spd: 15, lifesteal: 15, dmgReduction: 19,
  },
};

// --- Helpers ---

function uuid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function weightedPickFromObject(pool) {
  let total = 0;
  for (const key in pool) total += pool[key];
  let r = Math.random() * total;
  for (const key in pool) {
    r -= pool[key];
    if (r <= 0) return key;
  }
  return Object.keys(pool)[Object.keys(pool).length - 1];
}

function rollSlot() {
  return weightedPickFromObject({ weapon: 50, armor: 30, accessory: 20 });
}

function rollRarity(floorNum) {
  const epicBonus = Math.min(Math.max(floorNum - 3, 0) * 2, 15);
  const blueBonus = Math.min(Math.max(floorNum - 1, 0) * 1, 10);
  const w = 60 - epicBonus - blueBonus;
  const b = 30 + blueBonus;
  const p = 10 + epicBonus;
  return weightedPickFromObject({ white: Math.max(w, 15), blue: b, purple: p });
}

function rollStatForSlot(slot) {
  return weightedPickFromObject(STAT_POOL[slot]);
}

function rollStatValue(stat, rarity, floorNum) {
  const base = {
    atk: 4, def: 3, hp: 15, crit: 2, spd: 2, lifesteal: 2, dmgReduction: 2,
  }[stat] || 3;
  const floorScale = 1 + (floorNum - 1) * 0.15;
  const m = RARITY[rarity].valueMult;
  const raw = base * m * floorScale;
  return Math.round(raw * 10) / 10;
}

// --- Public API ---

/**
 * Generate equipment name from slot + rarity.
 */
function generateEquipmentName(slot, rarity) {
  const prefixPool = PREFIX[rarity] || PREFIX.white;
  const prefix = prefixPool[Math.floor(Math.random() * prefixPool.length)];
  const suffixPool = SUFFIX[slot] || SUFFIX.weapon;
  const suffix = suffixPool[Math.floor(Math.random() * suffixPool.length)];
  return prefix + suffix;
}

/**
 * Generate a random equipment item.
 * @param {number} floorNum
 * @param {string|null} forcedRarity — override rarity roll
 * @returns {{ id, slot, rarity, name, icon, stats, floor }}
 */
function generateEquipment(floorNum, forcedRarity) {
  const slot = rollSlot();
  const rarity = forcedRarity || rollRarity(floorNum);
  const name = generateEquipmentName(slot, rarity);
  const icon = EQUIP_ICON[slot];
  const numAffixes = AFFIX_COUNT[rarity] || 1;

  const stats = {};
  const usedStats = new Set();
  for (let i = 0; i < numAffixes; i++) {
    let stat;
    let attempts = 0;
    do {
      stat = rollStatForSlot(slot);
      attempts++;
    } while (usedStats.has(stat) && attempts < 20);
    if (usedStats.has(stat)) continue;
    usedStats.add(stat);
    stats[stat] = (stats[stat] || 0) + rollStatValue(stat, rarity, floorNum);
  }

  return {
    id: uuid(),
    slot,
    rarity,
    name,
    icon,
    stats,
    floor: floorNum,
    identified: rarity !== 'purple',
  };
}

/**
 * Roll loot after combat victory. May return null.
 * Drop chance increases with floor depth.
 * @param {number} floorNum
 * @returns {{}}|null
 */
function rollLoot(floorNum) {
  const baseChance = 0.18;
  const floorBonus = Math.min((floorNum - 1) * 0.03, 0.25);
  if (Math.random() > baseChance + floorBonus) return null;

  const equip = generateEquipment(floorNum);

  if (!player.inventory.equipment) {
    player.inventory.equipment = [];
  }
  player.inventory.equipment.push(equip);

  return equip;
}

/**
 * Equip an item from the inventory.
 * If the slot is already occupied, the current item is unequipped to inventory.
 * @param {string} equipId
 */
function equipItem(equipId) {
  const eq = findEquipInInventory(equipId);
  if (!eq) return;

  removeEquipFromInventory(equipId);

  const slot = eq.slot;
  if (player.equip[slot]) {
    player.inventory.equipment.push(player.equip[slot]);
  }
  player.equip[slot] = eq;
  recalcPlayerStats();
}

/**
 * Unequip a specific slot, return item to inventory.
 * @param {'weapon'|'armor'|'accessory'} slot
 */
function unequipSlot(slot) {
  if (!player.equip[slot]) return;

  player.inventory.equipment.push(player.equip[slot]);
  player.equip[slot] = null;
  recalcPlayerStats();
}

/**
 * Get the total value of a given stat from all equipped items.
 * @param {string} stat
 * @returns {number}
 */
function getEquipStat(stat) {
  let total = 0;
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const eq = player.equip[slot];
    if (eq && eq.identified !== false && eq.stats && eq.stats[stat]) {
      total += eq.stats[stat];
    }
  }
  return total;
}

/**
 * Get all stats from equipped items as an object.
 * @returns {{ atk: number, def: number, ... }}
 */
function getAllEquipStats() {
  const result = {};
  for (const key in EQUIP_STAT_DEFS) {
    result[key] = getEquipStat(key);
  }
  return result;
}

/**
 * Sell an equipment item from inventory for gold.
 * Price is based on rarity and floor.
 * @param {string} equipId
 * @returns {number} gold earned
 */
function sellEquipment(equipId) {
  const idx = player.inventory.equipment.findIndex(e => e.id === equipId);
  if (idx === -1) return 0;

  const eq = player.inventory.equipment.splice(idx, 1)[0];
  const base = { white: 5, blue: 15, purple: 40 }[eq.rarity] || 5;
  const gold = Math.round(base + eq.floor * 2);
  player.gold += gold;
  return gold;
}

/**
 * Ensure the player.inventory.equipment array exists.
 * Call during player init.
 */
function ensureEquipmentInventory() {
  if (player && !player.inventory.equipment) {
    player.inventory.equipment = [];
  }
}

/**
 * Identify a specific equipment item (sets identified=true, recalcs stats).
 * @param {{}} eq — equipment object
 */
function identifyEquipment(eq) {
  if (!eq || eq.identified) return false;
  eq.identified = true;
  console.log('[identify] Identified:', eq.icon, eq.name, eq.rarity);
  recalcPlayerStats();
  return true;
}

/**
 * Enhance the currently equipped weapon: +2 ATK for 3 gems.
 * @returns {boolean}
 */
function enhanceEquippedWeapon() {
  if (!player.equip.weapon) return false;
  if (!player.gems || player.gems < 3) return false;
  player.gems -= 3;
  player.equip.weapon.stats.atk = (player.equip.weapon.stats.atk || 0) + 2;
  recalcPlayerStats();
  return true;
}

/**
 * Enhance the currently equipped armor: +2 DEF for 3 gems.
 * @returns {boolean}
 */
function enhanceEquippedArmor() {
  if (!player.equip.armor) return false;
  if (!player.gems || player.gems < 3) return false;
  player.gems -= 3;
  player.equip.armor.stats.def = (player.equip.armor.stats.def || 0) + 2;
  recalcPlayerStats();
  return true;
}

/**
 * Find the first unidentified equipment (equipped slots first, then inventory).
 * @returns {{}|null}
 */
function findFirstUnidentified() {
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const eq = player.equip[slot];
    if (eq && !eq.identified) return eq;
  }
  if (player.inventory.equipment) {
    for (let i = 0; i < player.inventory.equipment.length; i++) {
      if (!player.inventory.equipment[i].identified) return player.inventory.equipment[i];
    }
  }
  return null;
}

// --- Private helpers ---

function findEquipInInventory(equipId) {
  if (!player.inventory.equipment) return null;
  return player.inventory.equipment.find(e => e.id === equipId);
}

function removeEquipFromInventory(equipId) {
  const idx = player.inventory.equipment.findIndex(e => e.id === equipId);
  if (idx !== -1) player.inventory.equipment.splice(idx, 1);
}
