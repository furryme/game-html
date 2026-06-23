// buff.js — Buff aggregation, synergy check, selection UI

// Equipment-Buff Synergy Bonuses
// Since equipment uses random affixes, we check: purple rarity + relevant stat = bonus
var EQUIP_BONUS = {
  flame_aura:  { slot: 'weapon', rarity: 'purple', statCheck: 'atk', bonus: { dotDmg: 4 } },
  iron_skin:   { slot: 'armor', rarity: 'purple', statCheck: 'def', bonus: { dmgReduction: 0.15 } },
  shadow_step: { slot: 'weapon', rarity: 'purple', statCheck: 'spd', bonus: { dodgeChance: 0.1 } },
  lifesteal:   { slot: 'weapon', rarity: 'purple', statCheck: 'atk', bonus: { lifestealPct: 0.1 } },
  mana_flow:   { slot: 'weapon', rarity: 'purple', statCheck: 'mp', bonus: { mpRestore: 3 } },
};

/**
 * Aggregate player.activeBuffs into player.buffStats.
 * activeBuffs is expected to be an array of { id, ... } objects or plain id strings.
 */
function recalcBuffStats() {
  const s = {
    atkMult: 1,
    defMult: 1,
    hpMult: 1,
    critBonus: 0,
    lifestealPct: 0,
    dmgReduction: 0,
    dodgeChance: 0,
    spdMult: 1,
    firstStrike: 0,
    mpRestore: 0,
    hpRestorePct: 0,
    goldBonus: 0,
    expBonus: 0,
    reflectPct: 0,
    onAttack: null,
    dotDmg: 0,
    dotTurns: 0,
    bossOnly: false
  };

  var ids = player.activeBuffs || [];

  for (var i = 0; i < ids.length; i++) {
    var entry = ids[i];
    var id = typeof entry === 'string' ? entry : entry.id;
    if (!id) continue;

    var def = null;
    for (var d = 0; d < BUFF_DEFS.length; d++) {
      if (BUFF_DEFS[d].id === id) { def = BUFF_DEFS[d]; break; }
    }
    if (!def || !def.passive) continue;

    var p = def.passive;
    if (p.atkMult && !(def.tags && def.tags.indexOf("boss") !== -1)) s.atkMult *= p.atkMult;
    if (p.defMult) s.defMult *= p.defMult;
    if (p.hpMult) s.hpMult *= p.hpMult;
    if (p.spdMult) s.spdMult *= p.spdMult;
    if (p.critBonus) s.critBonus += p.critBonus;
    if (p.lifestealPct) s.lifestealPct += p.lifestealPct;
    if (p.dmgReduction) s.dmgReduction = 1 - (1 - s.dmgReduction) * (1 - p.dmgReduction);
    if (p.dodgeChance) s.dodgeChance += p.dodgeChance;
    if (p.firstStrike) s.firstStrike += p.firstStrike;
    if (p.mpRestore) s.mpRestore += p.mpRestore;
    if (p.hpRestorePct) s.hpRestorePct += p.hpRestorePct;
    if (p.goldBonus) s.goldBonus += p.goldBonus;
    if (p.expBonus) s.expBonus += p.expBonus;
    if (p.reflectPct) s.reflectPct += p.reflectPct;
    if (p.dotDmg) s.dotDmg += p.dotDmg;
    if (p.dotTurns) s.dotTurns = Math.max(s.dotTurns, p.dotTurns);
    if (p.onAttack && !s.onAttack) s.onAttack = p.onAttack;

    // Class bonus: apply extra multipliers for class-specific bonuses
    if (def.classBonus && player.cls && def.classBonus[player.cls]) {
      var cb = def.classBonus[player.cls];
      if (cb.atkMult) s.atkMult *= cb.atkMult;
      if (cb.defMult) s.defMult *= cb.defMult;
      if (cb.hpMult) s.hpMult *= cb.hpMult;
      if (cb.dotDmg) s.dotDmg += cb.dotDmg;
      if (cb.dodgeChance) s.dodgeChance += cb.dodgeChance;
      if (cb.firstStrike) s.firstStrike += cb.firstStrike;
      if (cb.dmgReduction) s.dmgReduction += cb.dmgReduction;
      if (cb.critBonus) s.critBonus += cb.critBonus;
      if (cb.expBonus) s.expBonus += cb.expBonus;
      console.log('[buff] classBonus for ' + def.id + ' on class ' + player.cls);
    }

    // Equipment-buff synergy check
    if (EQUIP_BONUS[id] && player.equip && player.equip[EQUIP_BONUS[id].slot]) {
      var eq = player.equip[EQUIP_BONUS[id].slot];
      var eb = EQUIP_BONUS[id];
      // Check: equipment must be at least specified rarity (purple = best)
      var rarityOrder = { white: 1, blue: 2, purple: 3 };
      var eqRarity = rarityOrder[eq.rarity] || 0;
      var reqRarity = rarityOrder[eb.rarity] || 0;
      if (eqRarity >= reqRarity && eq.identified) {
        // Equipment qualifies - apply bonus
        if (eb.bonus.dotDmg) s.dotDmg += eb.bonus.dotDmg;
        if (eb.bonus.dmgReduction) s.dmgReduction += eb.bonus.dmgReduction;
        if (eb.bonus.dodgeChance) s.dodgeChance += eb.bonus.dodgeChance;
        if (eb.bonus.lifestealPct) s.lifestealPct += eb.bonus.lifestealPct;
        if (eb.bonus.mpRestore) s.mpRestore += eb.bonus.mpRestore;
        console.log('[buff] equipBonus for ' + id + ' with ' + (eq.name || eb.slot));
      }
    }
  }

  // Check boss-only tag
  for (var i = 0; i < ids.length; i++) {
    var id = typeof ids[i] === 'string' ? ids[i] : ids[i].id;
    if (!id) continue;
    for (var d = 0; d < BUFF_DEFS.length; d++) {
      if (BUFF_DEFS[d].id === id && BUFF_DEFS[d].tags && BUFF_DEFS[d].tags.indexOf('boss') !== -1) {
        s.bossOnly = true;
        break;
      }
    }
    if (s.bossOnly) break;
  }

  // Clamp percentage fields
  s.dmgReduction = Math.min(s.dmgReduction, 0.8);
  s.dodgeChance = Math.min(s.dodgeChance, 0.5);
  s.lifestealPct = Math.min(s.lifestealPct, 1.0);
  s.reflectPct = Math.min(s.reflectPct, 1.0);

  player.buffStats = s;

  // Apply synergy effects on top of buffStats
  checkSynergies();
  applySynergyToStats();
}

/**
 * Check which synergies are active based on tag counts from activeBuffs.
 * Writes result to player.activeSynergies array.
 */
function checkSynergies() {
  var tagCount = {};
  var ids = player.activeBuffs || [];

  for (var i = 0; i < ids.length; i++) {
    var id = typeof ids[i] === 'string' ? ids[i] : ids[i].id;
    if (!id) continue;
    for (var d = 0; d < BUFF_DEFS.length; d++) {
      if (BUFF_DEFS[d].id === id && BUFF_DEFS[d].tags) {
        for (var t = 0; t < BUFF_DEFS[d].tags.length; t++) {
          var tag = BUFF_DEFS[d].tags[t];
          tagCount[tag] = (tagCount[tag] || 0) + 1;
        }
        break;
      }
    }
  }

  var active = [];
  for (var i = 0; i < SYNERGY_DEFS.length; i++) {
    var syn = SYNERGY_DEFS[i];
    var count = 0;
    for (var t = 0; t < syn.tags.length; t++) {
      if (tagCount[syn.tags[t]] && tagCount[syn.tags[t]] >= 1) count++;
    }
    if (count >= syn.minTags) {
      active.push({
        id: syn.id,
        name: syn.name,
        effect: syn.effect,
        desc: syn.desc
      });
    }
  }

  player.activeSynergies = active;
}

/**
 * Apply synergy effects onto player.buffStats.
 */
function applySynergyToStats() {
  var s = player.buffStats;
  if (!s || !player.activeSynergies) return;

  for (var i = 0; i < player.activeSynergies.length; i++) {
    var e = player.activeSynergies[i].effect;
    if (!e) continue;
    switch (e.type) {
      case 'multiply_dot':
        s.dotDmg = Math.floor(s.dotDmg * e.mult);
        break;
      case 'reflect_pct':
        s.reflectPct = Math.max(s.reflectPct, e.pct);
        break;
      case 'add_lifesteal':
        s.lifestealPct = Math.min(1.0, s.lifestealPct + e.pct);
        break;
      case 'add_gold':
        s.goldBonus += e.pct;
        break;
    }
  }
}

/**
 * Check whether a buff def is unlocked based on player stats + permanent unlocks.
 * @param {Object} def — a BUFF_DEFS entry
 * @returns {boolean}
 */
function isBuffUnlocked(def) {
  var cond = def.unlockCondition;
  if (!cond) return true;

  // Check permanent unlockedBuffs list (source of truth)
  if (permanent && permanent.unlockedBuffs) {
    return permanent.unlockedBuffs.indexOf(def.id) !== -1;
  }

  // Fallback: check if default unlocked
  return DEFAULT_UNLOCKED.indexOf(def.id) !== -1;
}

/**
 * Weighted random pick of a buff based on floor number and rarity.
 * Only considers unlocked, not-yet-equipped buffs.
 * @param {number} floorNum
 * @returns {Object|null} — a BUFF_DEFS entry or null
 */
function weightedBuffPick(floorNum) {
  var equipped = {};
  for (var i = 0; i < (player.activeBuffs || []).length; i++) {
    var id = typeof player.activeBuffs[i] === 'string' ? player.activeBuffs[i] : player.activeBuffs[i].id;
    equipped[id] = true;
  }

  var candidates = [];
  for (var i = 0; i < BUFF_DEFS.length; i++) {
    if (equipped[BUFF_DEFS[i].id]) continue;
    if (!isBuffUnlocked(BUFF_DEFS[i])) continue;
    var w = RARITY_WEIGHTS[BUFF_DEFS[i].rarity];
    var weight = w ? w[floorNum] || 0 : 0;
    if (weight <= 0) continue;
    candidates.push({ item: BUFF_DEFS[i], weight: weight });
  }

  if (!candidates.length) return null;
  return weightedPick(candidates);
}

/**
 * Show the pre-floor buff 3-of-1 selection UI.
 * @param {number} floorNum
 */
function showBuffSelection(floorNum) {
  floorNum = floorNum || (player ? player.lvl : 1);
  var choices = [];
  var attempts = 0;
  while (choices.length < 3 && attempts < 30) {
    var pick = weightedBuffPick(floorNum);
    if (!pick) break;
    // Avoid duplicates in the same selection
    var dup = false;
    for (var i = 0; i < choices.length; i++) {
      if (choices[i].id === pick.id) { dup = true; break; }
    }
    if (!dup) choices.push(pick);
    attempts++;
  }

  if (choices.length === 0) {
    showModal('<div class="modal"><h3>暂无可用的增益</h3><p>继续探索吧！</p></div>');
    setTimeout(closeModal, 1500);
    return;
  }

  // Pad with info if fewer than 3 choices available
  while (choices.length < 3) {
    choices.push(null);
  }

  var rarityColor = { common: '#a0a0a0', rare: '#4a9eff', legendary: '#d4a017', mythic: '#d500f9' };

  var html = '<h3 style="margin-top:0">✨ 选择一项增益</h3>';
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">';

  for (var i = 0; i < 3; i++) {
    if (choices[i]) {
      var c = choices[i];
      var color = rarityColor[c.rarity] || '#ccc';

      // Equipment synergy hint
      var synergyHint = '';
      if (typeof EQUIP_BONUS !== 'undefined' && EQUIP_BONUS[c.id] && player && player.equip) {
        var eb = EQUIP_BONUS[c.id];
        if (player.equip[eb.slot] && player.equip[eb.slot].identified) {
          var eq = player.equip[eb.slot];
          var eqName = eq.name || eb.slot;
          var rarityOrder = { white: 1, blue: 2, purple: 3 };
          var eqRarity = rarityOrder[eq.rarity] || 0;
          var reqRarity = rarityOrder[eb.rarity] || 0;
          if (eqRarity >= reqRarity) {
            var bonusText = '';
            if (eb.bonus.dotDmg) bonusText = '灼伤伤害+' + eb.bonus.dotDmg;
            if (eb.bonus.dmgReduction) bonusText = '减伤+' + Math.floor(eb.bonus.dmgReduction * 100) + '%';
            if (eb.bonus.dodgeChance) bonusText = '闪避+' + Math.floor(eb.bonus.dodgeChance * 100) + '%';
            if (eb.bonus.lifestealPct) bonusText = '吸血+' + Math.floor(eb.bonus.lifestealPct * 100) + '%';
            if (eb.bonus.mpRestore) bonusText = '回蓝+' + eb.bonus.mpRestore;
            if (bonusText) {
              synergyHint = '<div style="font-size:9px;color:#f0c040;margin-top:4px;">' + eqName + '：' + bonusText + '</div>';
            }
          }
        }
      }

      html += '<div class="buff-card" style="' +
        'flex:1;min-width:140px;max-width:200px;cursor:pointer;user-select:none;' +
        'background:#1a1a2e;border:2px solid ' + color + ';border-radius:8px;' +
        'padding:12px;text-align:center;transition:transform 0.15s;" ' +
        'onmouseover="this.style.transform=\'scale(1.05)\'" ' +
        'onmouseout="this.style.transform=\'scale(1)\'">' +
        '<div style="font-size:32px">' + c.icon + '</div>' +
        '<div style="color:' + color + ';font-weight:bold;margin:4px 0">' + c.name + '</div>' +
        '<div style="font-size:11px;color:#888;text-transform:uppercase">' + c.rarity + '</div>' +
        '<div style="font-size:12px;color:#ccc;margin-top:6px">' + c.desc + '</div>' +
        synergyHint +
        (c.unlockCondition ? '<div style="font-size:10px;color:#666;margin-top:4px">\u{1F513} ' + c.unlockCondition.label + '</div>' : '') +
        '</div>';
    } else {
      html += '<div class="buff-card" style="' +
        'flex:1;min-width:140px;max-width:200px;' +
        'background:transparent;border:2px dashed #333;border-radius:8px;' +
        'display:flex;align-items:center;justify-content:center;' +
        'color:#444;font-size:13px;">空</div>';
    }
  }

  html += '</div>';

  // Store choices for post-render click handlers
  window._buffChoices = choices;

  showModal(html);

  // Attach click handlers after DOM insertion
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    var cards = overlay.querySelectorAll('.buff-card');
    for (var i = 0; i < cards.length; i++) {
      (function (idx) {
        cards[i].addEventListener('click', function () {
          if (window._buffChoices && window._buffChoices[idx]) {
            selectBuff(window._buffChoices[idx].id);
          }
        });
      })(i);
    }
  }
}

/**
 * Player selects a buff — add to activeBuffs, recalc, close modal, log.
 * @param {string} buffId
 */
function selectBuff(buffId) {
  var def = null;
  for (var i = 0; i < BUFF_DEFS.length; i++) {
    if (BUFF_DEFS[i].id === buffId) { def = BUFF_DEFS[i]; break; }
  }
  if (!def) return;

  player.activeBuffs.push({ id: buffId });
  recalcPlayerStats();
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  closeModal();
  addLog('获得增益：' + def.icon + ' ' + def.name, 'loot');
  renderPlayerPanel();

  // Clean up temp storage
  window._buffChoices = null;

  // Show gem enhancement if player has gems
  if (player.gems > 0 && typeof showGemEnhancement === 'function') {
    setTimeout(showGemEnhancement, 200);
  }
}

// Expose to global scope for inline onclick handlers
window.showBuffSelection = showBuffSelection;
window.selectBuff = selectBuff;
window.recalcBuffStats = recalcBuffStats;
window.checkSynergies = checkSynergies;
window.applySynergyToStats = applySynergyToStats;

// =================== Relic Selection ===================

/**
 * Show relic selection UI after death.
 * @param {Array} buffs — non-relic active buffs
 * @param {number} keptGold
 */
function showRelicSelection(buffs, keptGold) {
  console.log('[relic] showRelicSelection:', buffs.length, 'buffs');
  window._relicKeptGold = keptGold;
  window._relicModalActive = true;
  var rarityColor = { common: '#a0a0a0', rare: '#4a9eff', legendary: '#d4a017', mythic: '#d500f9' };

  var html = '<h3 style="margin-top:0; color:#f0c040;">\u{1F48E} 遗物选择</h3>';
  html += '<p style="font-size:12px; color:#9a9aba; margin-bottom:12px;">选择一项增益作为遗物，带入下次冒险</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">';

  window._relicChoices = buffs;

  for (var i = 0; i < buffs.length; i++) {
    var buff = buffs[i];
    var def = findBuffDef(buff.id);
    if (!def) continue;
    var color = rarityColor[def.rarity] || '#ccc';
    html += '<div class="buff-card" style="' +
      'flex:1; min-width:120px; max-width:180px; cursor:pointer; user-select:none;' +
      'background:#1a1a2e; border:2px solid ' + color + '; border-radius:8px;' +
      'padding:10px; text-align:center; transition:transform 0.15s;" ' +
      'onmouseover="this.style.transform=\'scale(1.05)\'" ' +
      'onmouseout="this.style.transform=\'scale(1)\'">' +
      '<div style="font-size:24px;">' + def.icon + '</div>' +
      '<div style="color:' + color + '; font-weight:bold; margin:4px 0;">' + def.name + '</div>' +
      '<div style="font-size:10px; color:#888; text-transform:uppercase;">' + def.rarity + '</div>' +
      '<div style="font-size:11px; color:#ccc; margin-top:4px;">' + def.desc + '</div>' +
      '</div>';
  }

  html += '</div>';

  // Equipment relic option
  if (player && player.equip) {
    var hasEquip = false;
    var equipSlots = ['weapon', 'armor', 'accessory'];
    for (var ei = 0; ei < equipSlots.length; ei++) {
      if (player.equip[equipSlots[ei]]) { hasEquip = true; break; }
    }
    if (hasEquip) {
      html += '<div style="margin-top:12px; padding-top:12px; border-top:1px solid #333;">';
      html += '<p style="font-size:11px; color:#9a9aba; margin-bottom:8px;">或者保留当前装备作为遗物</p>';
      html += '<button class="modal-btn" onclick="selectEquipRelic()" style="border-color:#f0c040; color:#f0c040;">保留装备</button>';
      html += '</div>';
    }
  }

  html += '<div style="text-align:center; margin-top:12px;">' +
    '<button class="modal-btn" onclick="selectRelic(null)">跳过（不选择遗物）</button>' +
    '</div>';

  showModal(html);

  // Prevent outside-click close during relic selection
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.onclick = null; // remove the default outside-click handler
  }

  // Attach click handlers after DOM insertion
  if (overlay) {
    var cards = overlay.querySelectorAll('.buff-card');
    for (var i = 0; i < cards.length; i++) {
      (function (idx) {
        cards[i].addEventListener('click', function () {
          if (window._relicChoices && window._relicChoices[idx]) {
            selectRelic(window._relicChoices[idx].id);
          }
        });
      })(i);
    }
  }
}

/**
 * Player selects a relic buff (or null to skip).
 * @param {string|null} buffId
 */
function selectRelic(buffId) {
  console.log('[relic] selectRelic:', buffId);
  window._relicChoices = null;
  window._relicModalActive = false;
  // Restore modal overlay's outside-click handler
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.onclick = function(e) { if (e.target === this) closeModal(); };
  }
  closeModal();

  if (buffId && typeof permanent !== 'undefined' && permanent) {
    saveRelic(permanent, buffId);
    var def = findBuffDef(buffId);
    addLog('选择遗物：' + (def ? def.icon : '') + ' ' + (def ? def.name : buffId), 'loot');
  } else {
    // Clear any existing relic
    if (typeof permanent !== 'undefined' && permanent) {
      permanent.relic = null;
      savePermanent(permanent);
    }
    addLog('跳过遗物选择', 'info');
  }

  // Now show game over
  finishGameOver(window._relicKeptGold || 0);
}

window.showRelicSelection = showRelicSelection;
window.selectRelic = selectRelic;

/**
 * Player selects to keep current equipment as a relic.
 */
function selectEquipRelic() {
  console.log('[relic] selectEquipRelic');
  window._relicChoices = null;
  window._relicModalActive = false;
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.onclick = function(e) { if (e.target === this) closeModal(); };
  }
  closeModal();

  if (typeof permanent !== 'undefined' && permanent) {
    var equipCopy = {};
    if (player.equip) {
      for (var slot in player.equip) {
        if (player.equip[slot]) {
          equipCopy[slot] = JSON.parse(JSON.stringify(player.equip[slot]));
        }
      }
    }
    permanent.equipRelic = equipCopy;
    savePermanent(permanent);
    var slotNames = Object.keys(equipCopy);
    var names = [];
    for (var i = 0; i < slotNames.length; i++) {
      if (equipCopy[slotNames[i]]) names.push(equipCopy[slotNames[i]].name || slotNames[i]);
    }
    addLog('保留装备遗物：' + names.join(', '), 'loot');
  }

  finishGameOver(window._relicKeptGold || 0);
}

window.selectEquipRelic = selectEquipRelic;
