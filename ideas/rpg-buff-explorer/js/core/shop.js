// shop.js — Shop item generation, UI, purchase

const SHOP_CONSUMABLE_KEYS = [
  { key: 'hp_potion', weight: 25 },
  { key: 'mp_potion', weight: 20 },
  { key: 'big_hp_potion', weight: 12 },
  { key: 'panacea', weight: 5 },
  { key: 'bomb', weight: 15 },
  { key: 'antidote', weight: 8 },
  { key: 'identify_scroll', weight: 10 },
  { key: 'detect_scroll', weight: 12 },
  { key: 'teleport_scroll', weight: 7 },
  { key: 'silver_key', weight: 6 },
];

const SHOP_MIN_ITEMS = 3;
const SHOP_MAX_ITEMS = 5;
const SHOP_EQUIPMENT_CHANCE = 0.35;

var currentShopItems = [];

/**
 * Generate the shop item list for a given floor.
 * @param {number} floorNum
 * @returns {Array<{id, itemId, price, label, icon, type, equipData}>}
 */
function generateShopItems(floorNum) {
  var count = rng(SHOP_MIN_ITEMS, SHOP_MAX_ITEMS);
  var items = [];
  var usedKeys = {};

  // Decide how many equipment slots to fill
  var equipCount = 0;
  if (Math.random() < SHOP_EQUIPMENT_CHANCE) {
    equipCount = rng(1, Math.min(2, count));
  }
  var consumableCount = count - equipCount;

  // Pick consumables
  for (var i = 0; i < consumableCount; i++) {
    var key = weightedPickFromKeys();
    // Avoid duplicates unless pool is exhausted
    var attempts = 0;
    while (usedKeys[key] && attempts < 20) {
      key = weightedPickFromKeys();
      attempts++;
    }
    usedKeys[key] = true;
    var def = ITEMS_DATA[key];
    if (!def) continue;

    var priceMult = key === 'identify_scroll'
      ? (1 + 0.4 * (floorNum - 1))
      : shopPriceMultiplier(floorNum);
    var price = Math.round(def.price * priceMult);
    items.push({
      id: 'shop_' + items.length,
      itemId: key,
      price: price,
      label: def.name,
      icon: def.icon,
      type: 'consumable',
    });
  }

  // Pick equipment
  for (var i = 0; i < equipCount; i++) {
    var equip = generateEquipment(floorNum);
    var basePrice = equipmentBasePrice(equip);
    var price = Math.round(basePrice * shopPriceMultiplier(floorNum));
    items.push({
      id: 'shop_' + items.length,
      itemId: equip.id,
      price: price,
      label: equip.icon + ' ' + equip.name,
      icon: equip.icon,
      type: 'equipment',
      equipData: equip,
    });
  }

  return items;
}

function weightedPickFromKeys() {
  var total = 0;
  for (var i = 0; i < SHOP_CONSUMABLE_KEYS.length; i++) total += SHOP_CONSUMABLE_KEYS[i].weight;
  var r = Math.random() * total;
  for (var i = 0; i < SHOP_CONSUMABLE_KEYS.length; i++) {
    r -= SHOP_CONSUMABLE_KEYS[i].weight;
    if (r <= 0) return SHOP_CONSUMABLE_KEYS[i].key;
  }
  return SHOP_CONSUMABLE_KEYS[SHOP_CONSUMABLE_KEYS.length - 1].key;
}

/**
 * Base sell-price of a random equipment (used as shop price basis).
 * @param {Object} equip — equipment object from generateEquipment
 * @returns {number}
 */
function equipmentBasePrice(equip) {
  var base = { white: 15, blue: 40, purple: 80 }[equip.rarity] || 15;
  var statBonus = 0;
  for (var key in equip.stats) statBonus += equip.stats[key] * 1.5;
  return base + Math.round(statBonus);
}

/**
 * Price multiplier based on floor depth.
 * @param {number} floorNum
 * @returns {number}
 */
function shopPriceMultiplier(floorNum) {
  return 1 + 0.3 * (floorNum - 1);
}

/**
 * Open the shop modal UI.
 * @param {number} floorNum
 */
function openShop(floorNum) {
  floorNum = floorNum || gameState.floor;
  currentShopItems = generateShopItems(floorNum);

  var html = '<h3 style="margin-top:0">\u{1F6D2} 地城商店</h3>';
  html += '<div style="color:#f0c040;margin-bottom:8px;">\u{1F4B0} 你的金币: ' + player.gold + '</div>';
  html += '<div style="max-height:240px;overflow-y:auto;">';

  for (var i = 0; i < currentShopItems.length; i++) {
    var item = currentShopItems[i];
    var canBuy = player.gold >= item.price;
    var typeLabel = item.type === 'equipment'
      ? '<span style="color:#9a9aba;font-size:10px;">装备</span>'
      : '<span style="color:#8a8;font-size:10px;">消耗品</span>';

    var rarityColor = '#fff';
    if (item.type === 'equipment' && item.equipData) {
      if (item.equipData.rarity === 'purple') rarityColor = '#cc77ff';
      else if (item.equipData.rarity === 'blue') rarityColor = '#55aaff';
    }

    html += '<div style="display:flex;align-items:center;gap:8px;padding:6px;border:1px solid ' +
      (canBuy ? '#4a4a6a' : '#2a2a3a') + ';border-radius:4px;margin-bottom:4px;' +
      'background:#1a1a2e;">' +
      '<div style="font-size:20px;">' + item.icon + '</div>' +
      '<div style="flex:1;">' +
      '<div style="color:' + rarityColor + ';font-weight:bold;">' + item.label + '</div>' +
      typeLabel +
      '</div>' +
      '<div style="color:#f0c040;min-width:50px;text-align:right;">\u{1F4B0} ' + item.price + '</div>' +
      '<button class="modal-btn" style="min-width:50px;" ' +
      (canBuy ? 'onclick="shopBuy(\'' + item.id + '\', ' + item.price + ')"' : 'disabled') +
      '>' + (canBuy ? '购买' : '不足') + '</button>' +
      '</div>';
  }

  html += '</div>';
  html += '<div style="margin-top:8px;text-align:right;">' +
    '<button class="modal-btn" onclick="closeModal()">离开商店</button></div>';

  showModal(html);
}

/**
 * Buy a shop item.
 * @param {string} itemId — shop item id (e.g. 'shop_0')
 * @param {number} price
 */
function shopBuy(itemId, price) {
  if (!player || player.gold < price) return;

  var shopItem = null;
  for (var i = 0; i < currentShopItems.length; i++) {
    if (currentShopItems[i].id === itemId) { shopItem = currentShopItems[i]; break; }
  }
  if (!shopItem) return;

  playSound('shop');

  // Deduct gold
  player.gold -= price;

  // Add to inventory
  if (shopItem.type === 'consumable') {
    player.inventory[shopItem.itemId] = (player.inventory[shopItem.itemId] || 0) + 1;
    var def = ITEMS_DATA[shopItem.itemId];
    addLog('购买了 ' + (def ? def.icon : '') + ' ' + shopItem.label + '（-' + price + 'G）', 'loot');
  } else if (shopItem.type === 'equipment') {
    if (!player.inventory.equipment) player.inventory.equipment = [];
    player.inventory.equipment.push(shopItem.equipData);
    addLog('购买了 ' + shopItem.label + '（-' + price + 'G）', 'loot');
  }

  // Refresh shop UI
  openShop(gameState.floor);
  renderPlayerPanel();
}

// Expose to global scope for inline onclick handlers
window.openShop = openShop;
window.shopBuy = shopBuy;
