// economy.js — Gold, gems, shop pricing, floor rewards, death settlement

const GOLD_VICTORY_MIN = 8;
const GOLD_VICTORY_MAX = 15;
const GOLD_BONUS_PER_FLOOR = 5;

const GEMS_MIN_DROP_FLOOR = 3;
const GEMS_DROP_CHANCE = 0.12;
const GEMS_DROP_AMOUNT = [1, 1, 1, 2]; // pick from this array

const DEATH_KEEP_RATIO = 0.5;

const FLOOR_REWARD_GOLD_PER_FLOOR = 25;
const FLOOR_REWARD_GEMS = 1;

/**
 * Add gold to player, applying buff bonus if active.
 * @param {number} amount
 * @returns {number} actual amount added
 */
function addGold(amount) {
  if (!player) return 0;
  var bonus = 1;
  if (player.buffStats && player.buffStats.goldBonus) {
    bonus += player.buffStats.goldBonus;
  }
  var actual = Math.round(amount * bonus);
  player.gold += actual;
  return actual;
}

/**
 * Add gems to player (run-time gems, synced to permanent on save).
 * @param {number} amount
 */
function addGems(amount) {
  if (!player) return;
  player.gems = (player.gems || 0) + amount;
}

/**
 * Get the shop price multiplier for the current floor.
 * @returns {number}
 */
function getShopPriceMultiplier() {
  return 1 + 0.3 * (gameState.floor - 1);
}

/**
 * Calculate gold reward for completing a floor.
 * Scales with floor depth.
 * @param {number} floorNum
 * @returns {{gold: number, gems: number|null}}
 */
function calculateFloorReward(floorNum) {
  var goldMin = GOLD_VICTORY_MIN + floorNum * GOLD_BONUS_PER_FLOOR;
  var goldMax = GOLD_VICTORY_MAX + floorNum * GOLD_BONUS_PER_FLOOR;
  var gold = rng(goldMin, goldMax);

  var gems = null;
  if (floorNum >= GEMS_MIN_DROP_FLOOR) {
    if (Math.random() < GEMS_DROP_CHANCE + (floorNum - GEMS_MIN_DROP_FLOOR) * 0.03) {
      gems = pick(GEMS_DROP_AMOUNT);
    }
  }

  return { gold: gold, gems: gems };
}

/**
 * Calculate final reward for clearing the entire dungeon.
 * @param {number} floorNum — final floor number
 * @returns {{gold: number, gems: number}}
 */
function calculateClearReward(floorNum) {
  var gold = floorNum * FLOOR_REWARD_GOLD_PER_FLOOR + rng(20, 50);
  var gems = FLOOR_REWARD_GEMS + (floorNum >= 5 ? 1 : 0);
  return { gold: gold, gems: gems };
}

/**
 * Death economy settlement.
 * Player keeps a percentage of gold and gems; rest is lost.
 * Gems are synced to permanent data.
 * @returns {{keptGold: number, lostGold: number, keptGems: number}}
 */
function onGameOver() {
  if (!player) return { keptGold: 0, lostGold: 0, keptGems: 0 };

  var totalGold = player.gold;
  var keptGold = Math.floor(totalGold * DEATH_KEEP_RATIO);
  var lostGold = totalGold - keptGold;

  var totalGems = player.gems || 0;
  var keptGems = Math.floor(totalGems * DEATH_KEEP_RATIO);
  var lostGems = totalGems - keptGems;

  // Set player to kept amounts
  player.gold = keptGold;
  player.gems = keptGems;

  // Sync gems to permanent
  if (permanent) {
    permanent.gems = (permanent.gems || 0) + keptGems;
    // Gold kept after death is given at next new game start
    permanent._startGold = (permanent._startGold || 0) + keptGold;
    player.gold = 0; // reset, will be added on next startNewGame
  }

  // Save permanent data
  if (typeof savePermanents === 'function') {
    savePermanents();
  }

  return { keptGold: keptGold, lostGold: lostGold, keptGems: keptGems, lostGems: lostGems };
}

/**
 * Spend gems (e.g. for permanent unlocks).
 * @param {number} amount
 * @returns {boolean} true if successful
 */
function spendGems(amount) {
  if (!player || !permanent) return false;
  var total = (player.gems || 0) + (permanent.gems || 0);
  if (total < amount) return false;

  // Deduct from run-time gems first, then permanent
  var fromRun = Math.min(player.gems || 0, amount);
  var fromPerm = amount - fromRun;
  player.gems = (player.gems || 0) - fromRun;
  permanent.gems = (permanent.gems || 0) - fromPerm;

  if (typeof savePermanents === 'function') {
    savePermanents();
  }
  return true;
}

/**
 * Collect gold from a floor (after combat or loot room).
 * @param {number} floorNum
 */
function collectFloorReward(floorNum) {
  var reward = calculateFloorReward(floorNum);
  var actual = addGold(reward.gold);
  addLog('获得 ' + actual + ' 金币', 'loot');
  if (reward.gems) {
    addGems(reward.gems);
    addLog('发现 ' + reward.gems + ' 颗宝石！', 'loot');
  }
  renderPlayerPanel();
}

// Expose to global scope
function spendRunGems(amount) {
  if (!player || !player.gems || player.gems < amount) return false;
  player.gems -= amount;
  return true;
}

window.addGold = addGold;
window.addGems = addGems;
window.getShopPriceMultiplier = getShopPriceMultiplier;
window.onGameOver = onGameOver;
window.spendGems = spendGems;
window.collectFloorReward = collectFloorReward;
window.spendRunGems = spendRunGems;
