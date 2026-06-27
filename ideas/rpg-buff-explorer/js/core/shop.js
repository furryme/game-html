// shop.js — Shop item generation, UI, purchase

const SHOP_CONSUMABLE_KEYS = [
  { key: 'hp_potion', weight: 30, minFloor: 1 },
  { key: 'mp_potion', weight: 20, minFloor: 1 },
  { key: 'bomb', weight: 20, minFloor: 1 },
  { key: 'antidote', weight: 15, minFloor: 1 },
  { key: 'big_hp_potion', weight: 10, minFloor: 1 },
  { key: 'detect_scroll', weight: 8, minFloor: 1 },
  { key: 'silver_key', weight: 5, minFloor: 1 },
  { key: 'identify_scroll', weight: 8, minFloor: 1 },
  { key: 'panacea', weight: 5, minFloor: 2 },
  { key: 'teleport_scroll', weight: 5, minFloor: 2 },
];

const SHOP_MIN_ITEMS = 3;
const SHOP_MAX_ITEMS = 5;
const SHOP_EQUIPMENT_CHANCE = 0.3;

var currentShopItems = [];
var currentShopType = 'permanent';

/**
 * Generate the shop item list for a given floor.
 * @param {number} floorNum
 * @returns {Array<{id, itemId, price, label, icon, type, equipData, desc}>}
 */
function generateShopItems(floorNum) {
  var available = SHOP_CONSUMABLE_KEYS.filter(function (k) { return k.minFloor <= floorNum; });
  var count = rng(SHOP_MIN_ITEMS, SHOP_MAX_ITEMS);
  var items = [];
  var usedKeys = {};

  // Decide how many equipment slots to fill
  var equipCount = 0;
  if (Math.random() < SHOP_EQUIPMENT_CHANCE) {
    equipCount = rng(1, Math.min(2, count));
  }
  var consumableCount = count - equipCount;

  // Pick consumables (floor-aware)
  for (var i = 0; i < consumableCount; i++) {
    var key = weightedPickFromKeys(available);
    var attempts = 0;
    while (usedKeys[key] && attempts < 20) {
      key = weightedPickFromKeys(available);
      attempts++;
    }
    usedKeys[key] = true;
    var def = ITEMS_DATA[key];
    if (!def) continue;

    var priceMult = shopPriceMultiplier(floorNum);
    var price = Math.round(def.price * priceMult);
    items.push({
      id: 'shop_' + items.length,
      itemId: key,
      price: price,
      label: def.name,
      icon: def.icon,
      type: 'consumable',
      desc: def.desc || '',
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
      desc: equip.rarity === 'purple' ? '史诗装备' : equip.rarity === 'blue' ? '稀有装备' : '普通装备',
    });
  }

  return items;
}

/**
 * Generate wandering merchant items (core consumables only, 70% discount).
 * @param {number} floorNum
 * @returns {Array<{id, itemId, price, origPrice, label, icon, type, desc}>}
 */
function generateWanderingShopItems(floorNum) {
  var coreKeys = SHOP_CONSUMABLE_KEYS.filter(function (k) {
    return k.minFloor <= floorNum && k.weight >= 15;
  });
  var items = [];
  var usedKeys = {};
  for (var i = 0; i < 2; i++) {
    var pick = null;
    var attempts = 0;
    while (attempts < 20) {
      var candidate = coreKeys[Math.floor(Math.random() * coreKeys.length)];
      if (!usedKeys[candidate.key]) { pick = candidate; break; }
      attempts++;
    }
    if (!pick) break;
    usedKeys[pick.key] = true;
    var def = ITEMS_DATA[pick.key];
    if (!def) continue;
    var stdPrice = Math.round(def.price * shopPriceMultiplier(floorNum));
    var discPrice = Math.round(stdPrice * 0.7);
    items.push({
      id: 'wand_' + i,
      itemId: pick.key,
      price: discPrice,
      origPrice: stdPrice,
      label: def.name,
      icon: def.icon,
      type: 'consumable',
      desc: def.desc || '',
    });
  }
  return items;
}

function weightedPickFromKeys(list) {
  list = list || SHOP_CONSUMABLE_KEYS;
  var total = 0;
  for (var i = 0; i < list.length; i++) total += list[i].weight;
  var r = Math.random() * total;
  for (var i = 0; i < list.length; i++) {
    r -= list[i].weight;
    if (r <= 0) return list[i].key;
  }
  return list[list.length - 1].key;
}

/**
 * Base sell-price of a random equipment (used as shop price basis).
 * @param {Object} equip
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
 * Formula: 1 + 0.15*(floorNum - 1) — corrected from 0.3 to match design doc.
 * @param {number} floorNum
 * @returns {number}
 */
function shopPriceMultiplier(floorNum) {
  return 1 + 0.15 * (floorNum - 1);
}

// =================== Shop UI Rendering ===================

function shopThemeColors() {
  var t = getTheme();
  var p = t ? t.palette : null;
  var u = t ? t.ui : null;
  return {
    gold: p ? p.gold : '#f0c040',
    textPrimary: p ? p.textPrimary : '#e0e0e0',
    textSecondary: p ? p.textSecondary : '#8888aa',
    textMuted: p ? p.textMuted : '#555566',
    bgSurface: p ? p.bgSurface : '#1a1a2e',
    bgDeep: p ? p.bgDeep : '#0a0a14',
    borderSubtle: p ? p.borderSubtle : 'rgba(255,255,255,0.08)',
    grayDk: p ? p.grayDk : '#3a3a5a',
    grayLt: p ? p.grayLt : '#9a9aba',
    heal: p ? p.heal : '#66bb6a',
    info: p ? p.info : '#64b5f6',
    magic: p ? p.magic : '#7c4dff',
    danger: p ? p.danger : '#e53935',
    radius: u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px',
    radiusSm: u ? (u.borderRadiusSm != null ? u.borderRadiusSm + 'px' : '4px') : '4px',
  };
}

/**
 * Open the permanent shop modal UI.
 * @param {number} floorNum
 */
function openShop(floorNum) {
  floorNum = floorNum || gameState.floor;
  currentShopType = 'permanent';
  currentShopItems = generateShopItems(floorNum);
  renderShopModal();
}

function renderShopModal() {
  var c = shopThemeColors();
  var floorNum = gameState.floor;

  var html = '<div class="shop-modal">';

  // Header
  if (currentShopType === 'permanent') {
    html += '<h3 style="margin-top:0">\u{1F6D2} 地城商店';
    html += '<span style="font-size:10px; color:' + c.textSecondary + '; font-weight:normal;">第 ' + floorNum + ' 层</span>';
    html += '</h3>';
  } else {
    html += '<h3 style="margin-top:0">\u{1F692} 流浪商人';
    html += '<span style="font-size:10px; color:' + c.textSecondary + '; font-weight:normal;">';
    html += '"今天特价，不要错过！"';
    html += '</span></h3>';
  }

  // Gold display
  html += '<div class="shop-gold">\u{1F4B0} 金币: <span class="shop-gold-value">' + player.gold + '</span></div>';

  // Item list
  html += '<div class="shop-item-list">';
  for (var i = 0; i < currentShopItems.length; i++) {
    html += shopItemRowHTML(currentShopItems[i], c);
  }
  html += '</div>';

  // Leave button
  html += '<div class="shop-footer">';
  html += '<button class="modal-btn shop-leave-btn" onclick="closeShop()">✕ 离开商店</button>';
  html += '</div>';

  html += '</div>';
  showModal(html);
}

function shopItemRowHTML(item, c) {
  var canBuy = player && player.gold >= item.price;
  var isEquip = item.type === 'equipment';

  // Border color based on item type / rarity
  var borderColor = c.grayDk;
  var labelColor = c.textPrimary;
  if (isEquip && item.equipData) {
    if (item.equipData.rarity === 'purple') { borderColor = c.magic; labelColor = c.magic; }
    else if (item.equipData.rarity === 'blue') { borderColor = c.info; labelColor = c.info; }
  }

  var html = '<div class="shop-item-row" style="border-color:' + borderColor + ';">';

  // Icon
  html += '<div class="shop-item-icon">' + item.icon + '</div>';

  // Info area
  html += '<div class="shop-item-info">';
  html += '<div class="shop-item-name" style="color:' + labelColor + ';">' + item.label + '</div>';

  // Type tag
  var tagColor = isEquip ? c.grayLt : c.heal;
  var tagText = isEquip ? '装备' : '消耗品';
  html += '<span class="shop-item-tag" style="color:' + tagColor + ';">' + tagText + '</span>';

  // Description
  if (item.desc) {
    html += '<div class="shop-item-desc">' + item.desc + '</div>';
  }
  html += '</div>';

  // Price + buy button
  html += '<div class="shop-item-action">';
  if (item.origPrice != null) {
    // Wandering merchant: show discounted price + crossed-out original
    html += '<div class="shop-price">';
    html += '<span class="shop-price-orig" style="color:' + c.textMuted + ';">~~' + item.origPrice + 'G~~</span>';
    html += '<span class="shop-price-disc" style="color:' + c.gold + ';">' + item.price + 'G</span>';
    html += '</div>';
  } else {
    html += '<div class="shop-price"><span style="color:' + c.gold + ';">' + item.price + 'G</span></div>';
  }

  if (canBuy) {
    html += '<button class="shop-buy-btn" onclick="shopBuy(\'' + item.id + '\')">\u{1F4D0} 购买</button>';
  } else {
    html += '<button class="shop-buy-btn shop-buy-disabled" disabled>\u{1F6AB} 不足</button>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

/**
 * Open wandering merchant shop.
 * @param {number} floorNum
 */
function openWanderingShop(floorNum) {
  floorNum = floorNum || gameState.floor;
  currentShopType = 'wandering';
  currentShopItems = generateWanderingShopItems(floorNum);
  renderShopModal();
}

/**
 * Close shop and resume game.
 */
function closeShop() {
  closeModal();
  gameState.paused = false;
  currentShopItems = [];
  currentShopType = '';
  // Re-render map to clear any shop-overlay state
  renderPlayerPanel();
  if (typeof renderMap === 'function') renderMap();
}

/**
 * Buy a shop item.
 * @param {string} itemId — shop item id (e.g. 'shop_0')
 */
function shopBuy(itemId) {
  if (!player) return;

  var shopItem = null;
  for (var i = 0; i < currentShopItems.length; i++) {
    if (currentShopItems[i].id === itemId) { shopItem = currentShopItems[i]; break; }
  }
  if (!shopItem) return;

  if (player.gold < shopItem.price) {
    playSound('deny');
    return;
  }

  playSound('shop');
  player.gold -= shopItem.price;

  if (shopItem.type === 'consumable') {
    player.inventory[shopItem.itemId] = (player.inventory[shopItem.itemId] || 0) + 1;
    var def = ITEMS_DATA[shopItem.itemId];
    addLog('购买了 ' + (def ? def.icon : '') + ' ' + shopItem.label + '（-' + shopItem.price + 'G）', 'loot');
  } else if (shopItem.type === 'equipment') {
    if (!player.inventory.equipment) player.inventory.equipment = [];
    player.inventory.equipment.push(shopItem.equipData);
    addLog('购买了 ' + shopItem.label + '（-' + shopItem.price + 'G）', 'loot');
  }

  // Flash effect on gold display
  var goldEl = document.querySelector('.shop-gold-value');
  if (goldEl) {
    goldEl.style.color = '#4eff4e';
    goldEl.style.transition = 'color 0.3s';
    setTimeout(function () { goldEl.style.color = ''; }, 500);
  }

  // Refresh UI
  renderShopModal();
  renderPlayerPanel();
}

// Expose to global scope for inline onclick handlers
window.openShop = openShop;
window.openWanderingShop = openWanderingShop;
window.shopBuy = shopBuy;
window.closeShop = closeShop;
window.generateWanderingShopItems = generateWanderingShopItems;
