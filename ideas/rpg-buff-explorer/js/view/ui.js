// ui.js — HTML UI updates

function getTheme() { return window.themeManager ? window.themeManager.getActive() : null; }

function renderPlayerPanel() {
  if (!player) return;

  const hpPct = clamp((player.hp / player.maxHp) * 100, 0, 100);
  const mpPct = clamp((player.mp / player.maxMp) * 100, 0, 100);
  const expPct = clamp((player.exp / player.expNext) * 100, 0, 100);

  const panel = document.getElementById('player-panel');
  if (!panel) return;

  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const hpGrad = u ? u.hpBarGrad : 'linear-gradient(90deg, #e53935, #66bb6a)';
  const mpGrad = u ? u.mpBarGrad : 'linear-gradient(90deg, #1565c0, #42a5f5)';
  const expGrad = u ? u.expBarGrad : 'linear-gradient(90deg, #f9a825, #ffd740)';
  const textPrimary = p ? p.textPrimary : '#e0e0e0';
  const textSecondary = p ? p.textSecondary : '#8888aa';

  panel.innerHTML =
    '<div class="panel-header">Lv.' + player.lvl + ' ' + (typeof getClassLabel === 'function' ? getClassLabel(player.cls) : '战士') + '</div>' +
    '<div class="bar-container"><div class="bar hp" style="width:' + hpPct + '%; background:' + hpGrad + '"></div><span class="bar-label">' + player.hp + '/' + player.maxHp + '</span></div>' +
    '<div class="bar-container"><div class="bar mp" style="width:' + mpPct + '%; background:' + mpGrad + '"></div><span class="bar-label">' + player.mp + '/' + player.maxMp + '</span></div>' +
    '<div class="bar-container"><div class="bar exp" style="width:' + expPct + '%; background:' + expGrad + '"></div><span class="bar-label">' + player.exp + '/' + player.expNext + '</span></div>' +
    '<div class="stat-row" style="color:' + textPrimary + '"><span>⚔️' + getPlayerAtk() + '</span><span>\u{1f6e1}' + getPlayerDef() + '</span><span>\u{1f4a8}' + getPlayerSpd() + '</span></div>' +
    '<div class="stat-row" style="color:' + textSecondary + '"><span>\u{1f4b0}' + player.gold + '</span><span>\u{1f48e}' + player.gems + '</span></div>' +
    buffChipHTML() +
    synergyChipHTML() +
    equipPanelHTML() +
    inventoryHTML();
}

function buffChipHTML() {
  if (!player.activeBuffs || player.activeBuffs.length === 0) return '';
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const magic = p ? p.magic : '#7c4dff';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';
  let html = '<div class="buff-chips">';
  for (let i = 0; i < player.activeBuffs.length; i++) {
    const buffEntry = player.activeBuffs[i];
    const buffId = typeof buffEntry === 'string' ? buffEntry : buffEntry.id;
    if (!buffId) continue;
    const def = findBuffDef(buffId);
    if (!def) continue;
    const isRelic = buffEntry && buffEntry.isRelic;
    const relicTag = isRelic ? ' <span style="color:' + gold + '; font-size:9px;">(遗物)</span>' : '';
    const style = isRelic ? ' border:1px dashed ' + gold + '; border-radius:' + radius + ';' : ' border-radius:' + radius + ';';
    html += '<span class="buff-chip buff-' + def.rarity + '" style="' + style + '">' + def.icon + ' ' + def.name + relicTag + '</span>';
    html += '<span class="buff-tooltip">' +
      '<div class="buff-tooltip-title">' + def.icon + ' ' + def.name + '</div>' +
      '<div class="buff-tooltip-desc">' + (def.desc || '') + '</div>' +
      '<div class="buff-tooltip-source">来源: 层前祝福</div>' +
      '<div class="buff-tooltip-type">类型: 本局</div>' +
      '</span>';
  }
  html += '</div>';
  return html;
}

function synergyChipHTML() {
  if (!player.activeSynergies || player.activeSynergies.length === 0) return '';
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const bgDeep = p ? p.bgDeep : '#0a0a14';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';
  var html = '<div class="buff-chips" style="margin-top:2px;">';
  for (var i = 0; i < player.activeSynergies.length; i++) {
    var syn = player.activeSynergies[i];
    html += '<span class="synergy-chip" style="' +
      'display:inline-block; padding:2px 6px; margin:1px 2px; ' +
      'background:linear-gradient(135deg, ' + bgSurface + ', ' + bgDeep + '); ' +
      'border:1.5px solid ' + gold + '; border-radius:' + radius + '; ' +
      'color:' + gold + '; font-size:11px; font-weight:bold; ' +
      'box-shadow:0 0 4px rgba(240,192,64,0.3);">' +
      syn.name + '</span>';
  }
  html += '</div>';
  return html;
}

function equipPanelHTML() {
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const grayDk = p ? p.grayDk : '#3a3a5a';
  const grayLt = p ? p.grayLt : '#9a9aba';
  const magic = p ? p.magic : '#7c4dff';
  const info = p ? p.info : '#64b5f6';
  const gold = p ? p.gold : '#ffd700';
  const white = p ? p.white : '#e8e8e8';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const textMuted = p ? p.textMuted : '#555566';
  const rc = u ? u.rarityColors : null;
  const rcEpic = rc ? rc.epic : magic;
  const rcRare = rc ? rc.rare : info;
  const rcCommon = rc ? rc.common : white;
  let html = '<div class="equip-slots">';
  const labels = { weapon: '⚔️', armor: '\u{1f6e1}', accessory: '\u{1f48d}' };
  const rarityLabel = { white: '普通', blue: '稀有', purple: '史诗' };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const eq = player.equip[slot];
    if (eq && !eq.identified) {
      const unidColor = eq.rarity === 'purple' ? rcEpic : eq.rarity === 'blue' ? rcRare : rcCommon;
      html += '<div class="equip-slot" style="border-color:' + grayDk + '; background:' + bgSurface + '; color:' + textMuted + ';">' +
        '<span>' + eq.icon + ' ??? (' + rarityLabel[eq.rarity] + ')</span>' +
        '<span style="color:' + unidColor + '; font-size:9px;">未鉴定</span></div>';
    } else if (eq) {
      const name = eq.icon + ' ' + eq.name;
      const color = eq.rarity === 'purple' ? gold : eq.rarity === 'blue' ? info : grayLt;
      html += '<div class="equip-slot" style="border-color:' + color + '"><span>' + name + '</span></div>';
    } else {
      html += '<div class="equip-slot" style="border-color:' + grayDk + '"><span>' + labels[slot] + ' 空</span></div>';
    }
  }
  html += '</div>';
  html += '<div style="display:flex; gap:4px; margin:3px 0;">';
  var invEquipCount = (player.inventory.equipment && player.inventory.equipment.length) || 0;
  var equipBadge = invEquipCount > 0 ? '<span style="background:#e53935; color:#fff; font-size:9px; padding:0 4px; border-radius:8px; margin-left:2px; font-weight:bold;">' + invEquipCount + '</span>' : '';
  var equipBtnColor = invEquipCount > 0 ? 'border-color:#ffd700; color:#ffd700;' : '';
  html += '<button class="equip-modal-btn" style="' + equipBtnColor + '" onclick="showEquipmentModal()">装备' + equipBadge + '</button>';
  html += '<button class="equip-modal-btn" onclick="showSaveSlotPicker()">存档</button>';
  html += '</div>';
  return html;
}

function inventoryHTML() {
  const t = getTheme();
  const p = t ? t.palette : null;
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const textPrimary = p ? p.textPrimary : '#e0e0e0';
  const borderSubtle = p ? p.borderSubtle : 'rgba(255,255,255,0.08)';
  const keys = Object.keys(player.inventory).filter(function (k) { return player.inventory[k] > 0; });
  if (keys.length === 0) return '';
  let html = '<div class="inventory">';
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const def = ITEMS_DATA[key];
    if (!def) continue;
    html += '<button class="inv-btn" style="background:' + bgSurface + '; color:' + textPrimary + '; border-color:' + borderSubtle + '" onclick="useItem(\'' + key + '\')">' + def.icon + ' ' + def.name + ' ×' + player.inventory[key] + '</button>';
  }
  html += '</div>';
  return html;
}

function renderCombatActions() {
  const actionsEl = document.getElementById('combat-actions');
  if (!actionsEl) { console.log('[ui] renderCombatActions: no combat-actions element'); return; }

  console.log('[ui] renderCombatActions called, player.lvl=', player.lvl, 'SKILLS.len=', SKILLS.length);
  const t = getTheme();
  const u = t ? t.ui : null;
  const p = t ? t.palette : null;

  let btnStyle = '';
  if (u) {
    if (u.buttonStyle === 'outlined') {
      btnStyle = 'background:transparent; border-color:' + (p ? p.gold : '#ffd700') + '; color:' + (u.buttonTextColor || '#e0e0e0') + ';';
    } else if (u.buttonStyle === 'flat') {
      btnStyle = 'background:' + (p ? (p.primary || p.bgSurface || '#1a1a2e') : '#1a1a2e') + '; border-color:' + (p ? p.borderSubtle : 'rgba(255,255,255,0.08)') + ';';
    } else {
      btnStyle = 'background:' + (u.buttonGradient || 'linear-gradient(135deg, #ffd700, #f0a500)') + '; color:' + (u.buttonTextColor || '#1a1a1a') + ';';
    }
  }

  let html = '<div class="combat-btns">';
  html += '<button class="btn btn-atk" style="' + btnStyle + '" onclick="doAttack()">⚔️ 攻击</button>';
  html += '<button class="btn btn-def" style="' + btnStyle + '" onclick="doDefend()">\u{1f6e1} 防御</button>';

  html += '<div class="skill-btns">';
  var skillCount = 0;
  var classSkills = typeof getClassSkills === 'function' ? getClassSkills(player.cls) : SKILLS;
  for (let i = 0; i < classSkills.length; i++) {
    const skill = classSkills[i];
    if (player.lvl < skill.unlockLvl) continue;
    skillCount++;
    const cd = player.skillCooldowns[skill.id] || 0;
    const canUse = player.mp >= skill.mpCost && cd === 0;
    html += '<button class="btn btn-skill' + (canUse ? '' : ' disabled') + '" style="' + btnStyle + '" ' +
      (canUse ? 'onclick="doSkill(\'' + skill.id + '\')"' : 'disabled') +
      '">' + skill.icon + ' ' + skill.name + ' ' + (skill.mpCost ? skill.mpCost + 'MP' : '') + (cd > 0 ? '(CD:' + cd + ')' : '') + '</button>';
  }
  html += '</div>';
  console.log('[ui] skills rendered:', skillCount);

  // Active buff buttons
  var activeBuffs = [];
  if (typeof getActiveBuffs === 'function') {
    activeBuffs = getActiveBuffs();
  }
  if (activeBuffs.length > 0) {
    var abuffHtml = '<div class="active-buff-btns" style="display:flex; gap:4px; margin-top:6px; grid-column: span 2;">';
    for (var abi = 0; abi < activeBuffs.length; abi++) {
      var ab = activeBuffs[abi];
      var cd = combatState && combatState.activeBuffCooldowns ? (combatState.activeBuffCooldowns[ab.id] || 0) : 0;
      var disabled = cd > 0 ? 'disabled' : '';
      var cdText = cd > 0 ? ' (' + cd + ')' : '';
      var def = ab.def;
      abuffHtml += '<button class="btn btn-skill" onclick="useActiveBuff(\'' + ab.id + '\')" ' + disabled + ' style="font-size:8px; padding:4px 6px; min-height:28px;">';
      abuffHtml += def.icon + ' ' + def.name + cdText;
      abuffHtml += '</button>';
    }
    abuffHtml += '</div>';
    html += abuffHtml;
  }

  html += '<button class="btn btn-item" style="' + btnStyle + '" onclick="toggleInventoryModal()">\u{1f3fa}️ 物品</button>';
  html += '<button class="btn btn-flee" style="' + btnStyle + '" onclick="tryFlee()">\u{1f6c0} 跑跑</button>';
  html += '</div>';

  actionsEl.innerHTML = html;
  console.log('[ui] combat-actions innerHTML set, len=', actionsEl.innerHTML.length, 'buttonCount=', actionsEl.querySelectorAll('button').length);
}

function renderHUD() {
  const actionsEl = document.getElementById('dungeon-actions');
  if (!actionsEl) return;

  const t = getTheme();
  const p = t ? t.palette : null;
  const textMuted = p ? p.textMuted : '#555566';
  const gold = p ? p.gold : '#f0c040';

  let html = '<div class="action-hint" style="color:' + textMuted + '">WASD / 方向键 移动</div>';
  html += '<div class="action-hint" style="color:' + textMuted + '">Enter 药水  |  I 背包  |  Ctrl+S 保存</div>';
  actionsEl.innerHTML = html;
}

function manualSave() {
  showSaveSlotPicker();
}

// =================== Game Over Screen ===================

function renderGameOverScreen(keptGold) {
  const t = getTheme();
  const p = t ? t.palette : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const danger = p ? p.danger : '#e53935';

  var screen = document.getElementById('gameover-screen');
  if (!screen) return;
  var statsText =
    '<div class="stats" style="color:' + textSecondary + '">' +
    '  到达第 ' + gameState.floor + ' 层 · 击杀 ' + (permanent ? permanent.permanentStats.totalKills : 0) + ' 只 · 回合 ' + gameState.turnCount +
    '</div>';
  if (keptGold > 0) statsText += '<div class="stats" style="color:' + gold + ';">保留 ' + keptGold + ' 金币（50%）</div>';

  // Show relic info if player has one
  var relicText = '';
  if (permanent && permanent.relic) {
    var relicDef = findBuffDef(permanent.relic);
    if (relicDef) {
      relicText = '<div class="stats" style="color:' + gold + '; margin-top:4px;">\u{1F48E} 遗物: ' + relicDef.icon + ' ' + relicDef.name + '（带入下次冒险）</div>';
    }
  }

  screen.innerHTML =
    '<div class="game-over">' +
    '  <h2 style="color:' + danger + '">阵亡</h2>' +
    '  ' + statsText + relicText +
    '  <button class="restart-btn" onclick="startNewGame()">重新开始</button>' +
    '  <button class="restart-btn" style="margin-left:8px;" onclick="returnToTitle()">返回标题</button>' +
    '</div>';
}

function returnToTitle() {
  showScreen('title');
  updateTitleScreen();
}

// =================== Victory Screen ===================

function renderVictoryScreen() {
  const t = getTheme();
  const p = t ? t.palette : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const heal = p ? p.heal : '#66bb6a';

  var screen = document.getElementById('victory-screen');
  if (!screen) return;
  screen.innerHTML =
    '<div class="game-over victory">' +
    '  <h2 style="color:' + heal + '">通关！</h2>' +
    '  <div class="stats" style="color:' + textSecondary + '">' +
    '    用时 ' + gameState.turnCount + ' 回合 · 达到 Lv.' + player.lvl +
    '  </div>' +
    '  <div class="stats" style="color:' + gold + ';">获得 3 灵魂碎片！</div>' +
    '  <button class="restart-btn" onclick="startNewGame()">再来一次</button>' +
    '  <button class="restart-btn" style="margin-left:8px;" onclick="returnToTitle()">返回标题</button>' +
    '</div>';
}

// =================== Talent Screen ===================

function showTalentScreen() {
  if (!permanent) return;
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const grayDk = p ? p.grayDk : '#3a3a5a';
  const grayLt = p ? p.grayLt : '#9a9aba';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';

  var html = '<h3>⚡ 天赋树</h3>';
  html += '<p style="color:' + gold + ';margin-bottom:8px;">灵魂碎片: ' + permanent.soulShards + '</p>';

  var keys = Object.keys(TALENT_DEFS);
  for (var i = 0; i < keys.length; i++) {
    var id = keys[i];
    var def = TALENT_DEFS[id];
    var lvl = permanent.talents[id] || 0;
    var canBuy = lvl < 10 && permanent.soulShards > 0;
    var bar = '';
    for (var j = 0; j < 10; j++) bar += j < lvl ? '■' : '□';
    html += '<div style="border:1px solid ' + grayDk + ';border-radius:' + radius + ';padding:6px;margin:4px 0; background:' + bgSurface + ';">';
    html += '<div style="font-weight:bold; color:' + textSecondary + ';">' + def.name + ' <span style="color:' + grayLt + ';">(Lv.' + lvl + ')</span></div>';
    html += '<div style="color:' + grayLt + ';font-size:10px;">' + def.desc + ' → ' + bar + '</div>';
    html += '<button class="modal-btn" ' + (canBuy ? 'onclick="buyTalent(\'' + id + '\');showTalentScreen();"' : 'disabled') + '>' +
      (canBuy ? '升级 (1 碎片)' : (lvl >= 10 ? '已满' : '碎片不足')) + '</button>';
    html += '</div>';
  }
  html += '<br><button class="modal-btn" onclick="closeTalentScreen()">关闭</button>';

  // Reset all talents button
  var totalSpent = 0;
  var tKeys = Object.keys(permanent.talents);
  for (var ti = 0; ti < tKeys.length; ti++) totalSpent += permanent.talents[tKeys[ti]];
  if (totalSpent > 0) {
    html += '<div style="text-align:center; margin-top:16px;">';
    html += '<button class="modal-btn" onclick="resetAllTalents()" style="border-color:#e74c3c; color:#e74c3c; font-size:9px;">重置所有天赋（返还 ' + totalSpent + ' 灵魂碎片）</button>';
    html += '</div>';
  }

  showModal(html);
}

function closeTalentScreen() {
  closeModal();
  updateTitleScreen();
}

function buyTalent(talentId) {
  if (!permanent) return;
  if (unlockTalent(permanent, talentId)) {
    addLog('解锁天赋：' + TALENT_DEFS[talentId].name, 'loot');
  }
}

function resetAllTalents() {
  if (typeof resetTalents === 'function') {
    var refunded = resetTalents(permanent);
    addLog('天赋已重置，返还 ' + refunded + ' 灵魂碎片', 'info');
    closeModal();
    showTalentScreen(); // Refresh UI
  }
}

window.resetAllTalents = resetAllTalents;

// =================== Gem Enhancement ===================

function showGemEnhancement() {
  if (!player || player.gems <= 0) return;
  console.log('[gem] showGemEnhancement, gems:', player.gems);

  const t = getTheme();
  const p = t ? t.palette : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const danger = p ? p.danger : '#d43';
  const info = p ? p.info : '#35c';
  const heal = p ? p.heal : '#4a4';

  var html = '<h3 style="margin-top:0; color:' + gold + ';">\u{1F48E} 宝石强化</h3>';
  html += '<p style="font-size:12px; color:' + textSecondary + '; margin-bottom:12px;">';
  html += '宝石: ' + player.gems + ' — 花费 1 宝石永久提升一项属性（本局有效）';
  html += '</p>';
  html += '<div style="display:flex; grid-row-gap:8px; grid-column-gap:8px; flex-wrap:wrap; justify-content:center;">';

  var options = [
    { label: '⚔ 攻击+5', stat: 'atk', icon: '⚔️', color: danger },
    { label: '\u{1f6e1} 防御+5', stat: 'def', icon: '\u{1f6e1}', color: info },
    { label: '❤ 最大HP+20', stat: 'hp', icon: '❤', color: heal },
  ];

  for (var i = 0; i < options.length; i++) {
    var opt = options[i];
    html += '<button class="modal-btn" style="min-width:90px; border-color:' + opt.color + '; color:' + opt.color + ';" ' +
      'onclick="spendGemOn(\'' + opt.stat + '\')">' + opt.label + '</button>';
  }

  html += '</div>';
  html += '<div style="margin-top:8px; text-align:center;">';
  html += '<button class="modal-btn" onclick="closeModal()">跳过</button>';
  html += '</div>';

  showModal(html);
}

function spendGemOn(stat) {
  if (!player || player.gems <= 0) return;
  player.gems--;

  var bonus = 0;
  if (stat === 'atk') { player.gemBonusAtk += 5; bonus = 5; }
  else if (stat === 'def') { player.gemBonusDef += 5; bonus = 5; }
  else if (stat === 'hp') { player.gemBonusHp += 20; bonus = 20; }

  recalcPlayerStats();
  player.hp = player.maxHp;
  player.mp = player.maxMp;

  console.log('[gem] spendGemOn:', stat, '+', bonus, 'gems:', player.gems);
  addLog('宝石强化：' + stat.toUpperCase() + '+' + bonus + '（剩余宝石: ' + player.gems + '）', 'loot');

  // Show again if player still has gems
  if (player.gems > 0) {
    closeModal();
    setTimeout(showGemEnhancement, 200);
  } else {
    closeModal();
  }
  renderPlayerPanel();
}

// =================== Floor Break ===================

function showFloorBreak() {
  gameState.paused = true;
  // Prevent clicking outside from closing — floor break is required to proceed.
  // Closing without choosing would leave gameState.paused=true and freeze the game.
  var overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.onclick = null;
  }
  var gems = player.gems || 0;
  var hasWeapon = !!player.equip.weapon;
  var hasArmor = !!player.equip.armor;
  var hasUnidentified = false;
  if (player.equip) {
    for (var s = 0; s < ['weapon', 'armor', 'accessory'].length; s++) {
      var eq = player.equip[['weapon', 'armor', 'accessory'][s]];
      if (eq && !eq.identified) { hasUnidentified = true; break; }
    }
  }
  if (!hasUnidentified && player.inventory.equipment) {
    for (var i = 0; i < player.inventory.equipment.length; i++) {
      if (!player.inventory.equipment[i].identified) { hasUnidentified = true; break; }
    }
  }

  const t = getTheme();
  const p = t ? t.palette : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const danger = p ? p.danger : '#d43';
  const info = p ? p.info : '#35c';

  var html = '<h3 style="margin-top:0; color:' + gold + ';">\u{1F3F0} 层间强化</h3>';
  html += '<p style="font-size:12px; color:' + textSecondary + '; margin-bottom:12px;">';
  html += '宝石: ' + gems + ' · 金币: ' + player.gold + '</p>';

  html += '<div style="display:flex; grid-row-gap:8px; grid-column-gap:8px; flex-wrap:wrap; justify-content:center;">';

  html += '<button class="modal-btn" style="min-width:110px; border-color:' + danger + '; color:' + danger + ';" ' +
    (hasWeapon && gems >= 3 ? 'onclick="floorBreakChoice(\'weapon\')"' : 'disabled') + '>' +
    '⚔ 强化武器 (3 宝石, +2 ATK)' + '</button>';

  html += '<button class="modal-btn" style="min-width:110px; border-color:' + info + '; color:' + info + ';" ' +
    (hasArmor && gems >= 3 ? 'onclick="floorBreakChoice(\'armor\')"' : 'disabled') + '>' +
    '\u{1F6E1} 强化防具 (3 宝石, +2 DEF)' + '</button>';

  html += '<button class="modal-btn" style="min-width:110px; border-color:' + gold + '; color:' + gold + ';" ' +
    (hasUnidentified ? 'onclick="floorBreakChoice(\'identify\')"' : 'disabled') + '>' +
    '\u{1F4DC} 免费鉴定' + '</button>';

  html += '<button class="modal-btn" style="min-width:110px;" onclick="floorBreakChoice(\'proceed\')">' +
    '➡ 继续前进' + '</button>';

  html += '</div>';

  showModal(html);
}

function floorBreakChoice(choice) {
  var msg = '';
  if (choice === 'weapon') {
    if (enhanceEquippedWeapon()) {
      msg = '武器强化：ATK +2（剩余宝石: ' + player.gems + '）';
    } else {
      closeModal();
      return;
    }
  } else if (choice === 'armor') {
    if (enhanceEquippedArmor()) {
      msg = '防具强化：DEF +2（剩余宝石: ' + player.gems + '）';
    } else {
      closeModal();
      return;
    }
  } else if (choice === 'identify') {
    var eq = findFirstUnidentified();
    if (eq) {
      identifyEquipment(eq);
      msg = '免费鉴定：' + eq.icon + ' ' + eq.name;
    } else {
      closeModal();
      return;
    }
  }

  if (msg) {
    addLog(msg, 'loot');
  }

  closeModal();
  renderPlayerPanel();
  setTimeout(function () {
    proceedToNextFloor();
  }, 200);
}

// =================== Class Selection (future multi-class) ===================

function showClassSelection() {
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const textMuted = p ? p.textMuted : '#555566';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const gold = p ? p.gold : '#d4a855';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';

  var html = '<h3 style="margin-top:0; text-align:center;">选择职业</h3>';
  html += '<p style="font-size:10px; color:' + textSecondary + '; text-align:center; margin-bottom:12px;">按 1/2/3 选择职业</p>';
  html += '<div style="display:flex; grid-row-gap:10px; grid-column-gap:10px; flex-wrap:wrap; justify-content:center;">';

  var classes = ['warrior', 'mage', 'rogue'];
  for (var i = 0; i < classes.length; i++) {
    var cid = classes[i];
    var cd = CLASS_DATA[cid];
    if (!cd) continue;
    var color = cd.color || gold;
    html += '<div class="class-card" style="' +
      'flex:1; min-width:140px; max-width:200px; cursor:pointer; user-select:none;' +
      'background:' + bgSurface + '; border:3px solid ' + color + '; border-radius:' + radius + ';' +
      'padding:14px 10px; text-align:center; transition:transform 0.15s;" ' +
      'onmouseover="this.style.transform=\'scale(1.03)\'" ' +
      'onmouseout="this.style.transform=\'scale(1)\'" ' +
      'onclick="pickClass(\'' + cid + '\')">' +
      '<div style="font-size:28px;">' + cd.icon + '</div>' +
      '<div style="color:' + color + '; font-weight:bold; margin:6px 0; font-size:12px;">' + cd.label + '</div>' +
      '<div style="font-size:8px; color:' + textSecondary + '; line-height:1.8;">' +
      'HP:' + cd.hp + ' MP:' + cd.mp + '<br/>' +
      'ATK:' + cd.atk + ' DEF:' + cd.def + '<br/>' +
      'SPD:' + cd.spd + ' CRIT:' + cd.crit + '%' +
      '</div>' +
      '<div style="font-size:7px; color:' + textMuted + '; margin-top:6px; line-height:1.6;">';
    if (cid === 'warrior') {
      html += '均衡的战士<br/>高血量高防御';
    } else if (cid === 'mage') {
      html += '攻击20%灼烧<br/>AOE范围伤害';
    } else if (cid === 'rogue') {
      html += '先手必暴击<br/>高速高暴击率';
    }
    html += '</div></div>';
  }

  html += '</div>';
  showModal(html);
}

function pickClass(cls) {
  startNewGameWithClass(cls);
}

function startNewGameWithClass(cls) {
  initAudio();
  // initPlayer will use this cls
  resetForNewRun(permanent);
  player.cls = cls;
  var base = CLASS_DATA[cls];
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
  applyTalentBonuses(permanent);
  recalcPlayerStats();

  if (permanent && permanent._startGold) {
    player.gold += permanent._startGold;
    permanent._startGold = 0;
  }

  closeModal();
  gameState.screen = 'dungeon';
  showScreen('dungeon');
  dungeon = generateFloor(1);
  player.x = dungeon.playerStart.x;
  player.y = dungeon.playerStart.y;
  addLog('进入 ' + dungeon.theme.name + '，探索吧！', 'info');
  renderPlayerPanel();
  renderHUD();
}

// =================== Theme Thumbnail ===================

function renderThemeThumbnail(canvas, theme) {
  var ctx = canvas.getContext('2d');
  var t = theme;
  var p = t.palette;
  var w = canvas.width;
  var h = canvas.height;

  // Background
  ctx.fillStyle = p.bgDeep || '#0a0a14';
  ctx.fillRect(0, 0, w, h);

  // Mini map: 10x8 grid
  var ts = 6;
  for (var y = 0; y < 8; y++) {
    for (var x = 0; x < 10; x++) {
      var isWall = (x === 0 || y === 0 || x === 9 || y === 7 ||
                    (x >= 3 && x <= 5 && y >= 3 && y <= 5));
      if (isWall) {
        ctx.fillStyle = p.wallDark || '#2a2a3e';
        ctx.fillRect(x * ts, y * ts, ts, ts);
      } else {
        ctx.fillStyle = p.floorDark || '#1e1e30';
        ctx.fillRect(x * ts, y * ts, ts, ts);
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = p.floorLight || '#222238';
          ctx.fillRect(x * ts + 1, y * ts + 1, ts - 2, ts - 2);
        }
      }
    }
  }

  // Player glow dot
  var glowColor = (p.classColors && p.classColors.warrior) || '#e53935';
  var glowBlur = Math.min(t.effects ? t.effects.glowBlur : 10, 6);
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = glowBlur;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(4 * ts + 1, 2 * ts + 1, ts - 2, ts - 2);
  ctx.shadowBlur = 0;

  // Stair glow
  var stairGlow = t.sprites ? t.sprites.stairGlow : '#ffd700';
  ctx.fillStyle = stairGlow;
  ctx.fillRect(8 * ts + 1, 6 * ts + 1, ts - 2, ts - 2);

  // Particles
  var dangerColor = p.danger || '#e53935';
  for (var i = 0; i < 3; i++) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = dangerColor;
    ctx.fillRect(6 * ts + i * 2, 1 * ts + i * 3, 2, 2);
  }
  ctx.globalAlpha = 1;
}

// =================== Theme Shop ===================

var RARITY_STARS = {
  common: 1,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legend: 5
};

var RARITY_LABEL = {
  common: '普通',
  uncommon: '稀有',
  rare: '稀有',
  epic: '史诗',
  legend: '传说'
};

function getUnlockConditionText(cond, stats) {
  if (!cond) return '';
  switch (cond.type) {
    case 'deepestFloor':
      return '到达第' + cond.value + '层';
    case 'totalClears':
      return '通关 ' + cond.value + ' 次';
    case 'totalPlayTime':
      var mins = Math.floor(cond.value / 60);
      return '累计游玩 ' + mins + ' 分钟';
    case 'clearsByClass':
      var label = getClassLabel ? getClassLabel(cond.cls) : cond.cls;
      return label + '通关 ' + cond.value + ' 次';
    default:
      return '';
  }
}

function showThemeShop() {
  var t = getTheme();
  var p = t ? t.palette : null;
  var u = t ? t.ui : null;

  var gold = p ? p.gold : '#ffd700';
  var textSecondary = p ? p.textSecondary : '#8888aa';
  var textMuted = p ? p.textMuted : '#555566';
  var bgSurface = p ? p.bgSurface : '#1a1a2e';
  var borderSubtle = p ? p.borderSubtle : 'rgba(255,255,255,0.08)';
  var heal = p ? p.heal : '#66bb6a';
  var radius = u ? (u.borderRadiusLg != null ? u.borderRadiusLg + 'px' : '12px') : '12px';
  var radiusSm = u ? (u.borderRadiusSm != null ? u.borderRadiusSm + 'px' : '4px') : '4px';

  var activeId = window.themeManager ? window.themeManager.getActiveId() : 'classic';
  var activeTheme = window.themeManager ? window.themeManager.getActive() : BASE_THEME;
  var activeName = activeTheme ? activeTheme.name : '经典地城';

  var stats = window.themeManager ? window.themeManager.loadStats() : {};
  var themes = window.themeManager ? window.themeManager.getAllThemes() : [];

  var html = '<div style="max-width:560px;">';
  html += '<h3 style="margin-top:0; text-align:center; color:' + gold + ';">';
  html += '★ 主题商城';
  html += '<span style="font-size:10px; color:' + textSecondary + '; font-weight:normal;">当前: ' + activeName + '</span>';
  html += '</h3>';

  // Theme cards grid
  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:12px 0;">';

  for (var i = 0; i < themes.length; i++) {
    var th = themes[i];
    var themeObj = window.themeManager ? window.themeManager.getTheme(th.id) : null;
    var stars = RARITY_STARS[th.rarity] || 1;
    var rarityColor = u && u.rarityColors ? u.rarityColors[th.rarity] || textSecondary : textSecondary;
    var starStr = '';
    for (var s = 0; s < stars; s++) starStr += '★';

    var isEquipped = activeId === th.id;
    var borderColor = isEquipped ? heal : (th.unlocked ? rarityColor : textMuted);
    var cardBg = isEquipped ? 'rgba(102,187,106,0.08)' : bgSurface;

    html += '<div style="background:' + cardBg + '; border:2px solid ' + borderColor + '; border-radius:' + radius + '; padding:10px; ' +
      (isEquipped ? 'box-shadow:0 0 10px rgba(102,187,106,0.3);' : '') + ';">';

    // Canvas thumbnail (inline canvas element)
    html += '<div style="text-align:center; margin-bottom:6px;">';
    html += '<canvas id="thumb-' + th.id + '" width="80" height="60" style="border:1px solid ' + borderSubtle + '; border-radius:' + radiusSm + '; image-rendering:pixelated;"></canvas>';
    html += '</div>';

    // Name + rarity
    html += '<div style="font-weight:bold; font-size:11px; color:' + gold + '; margin-bottom:4px;">' + th.name + '</div>';
    html += '<div style="font-size:9px; color:' + rarityColor + '; margin-bottom:4px;">' + starStr + ' ' + (RARITY_LABEL[th.rarity] || th.rarity) + '</div>';

    if (th.unlocked) {
      if (isEquipped) {
        html += '<div style="font-size:9px; color:' + heal + '; margin-top:4px;">✓ 已装备</div>';
      } else {
        html += '<button class="modal-btn" style="margin-top:4px; padding:4px 12px; font-size:9px; border-color:' + gold + '; color:' + gold + ';" ' +
          'onclick="equipTheme(\'' + th.id + '\')">装备</button>';
      }
    } else {
      var cond = th.unlockCondition;
      var condText = getUnlockConditionText(cond, stats);
      html += '<div style="font-size:8px; color:' + textSecondary + '; margin-top:4px;">条件: ' + condText + '</div>';
      var progress = th.progress != null ? th.progress : 0;
      var required = th.required != null ? th.required : 1;
      html += '<div style="font-size:8px; color:' + textMuted + ';">进度: ' + progress + '/' + required + '</div>';

      // Progress bar
      var pct = Math.min(100, Math.floor((progress / required) * 100));
      html += '<div style="background:' + (p ? p.bgDeep : '#0a0a14') + '; border-radius:' + radiusSm + '; height:4px; margin-top:3px; overflow:hidden;">';
      html += '<div style="width:' + pct + '%; background:' + rarityColor + '; height:100%;"></div>';
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>'; // end grid

  // Close button
  html += '<div style="text-align:center; margin-top:8px;">';
  html += '<button class="modal-btn" onclick="closeModal()">关闭</button>';
  html += '</div>';
  html += '</div>';

  // Style the modal overlay with theme colors
  showModal(html);

  // Render thumbnails after DOM update
  setTimeout(function () {
    for (var i = 0; i < themes.length; i++) {
      var th = themes[i];
      var canvas = document.getElementById('thumb-' + th.id);
      var themeObj = window.themeManager ? window.themeManager.getTheme(th.id) : null;
      if (canvas && themeObj) {
        renderThemeThumbnail(canvas, themeObj);
      }
    }
  }, 50);
}

function equipTheme(id) {
  if (!window.themeManager) return;
  if (!window.themeManager.switch(id)) {
    addLog('无法装备该主题', 'info');
    return;
  }
  var theme = window.themeManager.getActive();
  applyThemeToBody(theme);
  addLog('主题切换: ' + (theme.name || id), 'info');
  closeModal();
  updateTitleScreen();
}

// =================== Theme Progress Tracking ===================

function trackThemeProgress(type, value) {
  if (!window.themeManager || !permanent) return;
  var stats = window.themeManager.loadStats();

  switch (type) {
    case 'deepestFloor':
      stats.deepestFloor = Math.max(stats.deepestFloor || 0, value);
      break;
    case 'totalClears':
      stats.totalClears = (stats.totalClears || 0) + value;
      break;
    case 'clearsByClass':
      if (!stats.clearsByClass) stats.clearsByClass = { warrior: 0, mage: 0, rogue: 0 };
      stats.clearsByClass[value] = (stats.clearsByClass[value] || 0) + 1;
      break;
    case 'totalPlayTime':
      stats.totalPlayTime = (stats.totalPlayTime || 0) + value;
      break;
  }

  window.themeManager.saveStats(stats);

  // Check for newly unlocked themes
  var newlyUnlocked = window.themeManager.checkUnlockConditions(stats);
  for (var i = 0; i < newlyUnlocked.length; i++) {
    var nu = window.themeManager.getTheme(newlyUnlocked[i]);
    if (nu) {
      addLog('解锁主题：' + nu.name + '！', 'loot');
    }
  }
}

// =================== Unlock Modal ===================

function showUnlockModal(newUnlocks) {
  if (!newUnlocks || !newUnlocks.length) return;

  var rarityColor = { common: '#a0a0a0', rare: '#4a9eff', legendary: '#d4a017', mythic: '#d500f9' };

  var html = '<h3 style="margin-top:0; color:#f0c040;">新 祝 福 解 锁！</h3>';

  for (var i = 0; i < newUnlocks.length; i++) {
    var buff = newUnlocks[i];
    var color = rarityColor[buff.rarity] || '#ccc';
    html += '<div style="text-align:center; padding:16px; margin:8px 0; background:rgba(0,0,0,0.3); border:2px solid ' + color + '; border-radius:8px;">';
    html += '<div style="font-size:48px;">' + buff.icon + '</div>';
    html += '<div style="color:' + color + '; font-weight:bold; font-size:14px; margin:8px 0;">' + buff.name + '</div>';
    html += '<div style="font-size:11px; color:#888; text-transform:uppercase; margin-bottom:8px;">' + (buff.rarity || '') + '</div>';
    html += '<div style="font-size:12px; color:#ccc;">' + (buff.desc || '') + '</div>';
    if (buff.tags) {
      html += '<div style="margin-top:8px;">';
      for (var t = 0; t < buff.tags.length; t++) {
        html += '<span style="display:inline-block; font-size:10px; color:#888; background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; margin:2px;">' + buff.tags[t] + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';
  }

  html += '<div style="text-align:center; margin-top:16px;">';
  html += '<button class="modal-btn" onclick="closeModal()" style="border-color:#f0c040; color:#f0c040;">太 棒 了</button>';
  html += '</div>';

  showModal(html);

  console.log('[unlock] showed unlock modal for ' + newUnlocks.length + ' buffs');
}

// =================== Save Slot Selection ===================

function formatSaveTime(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  var yy = d.getFullYear();
  var mm = ('0' + (d.getMonth() + 1)).slice(-2);
  var dd = ('0' + d.getDate()).slice(-2);
  var hh = ('0' + d.getHours()).slice(-2);
  var mi = ('0' + d.getMinutes()).slice(-2);
  return yy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi;
}

function getClassLabelSafe(cls) {
  if (typeof getClassLabel === 'function') return getClassLabel(cls);
  var map = { warrior: '战士', mage: '法师', rogue: '盗贼' };
  return map[cls] || cls || '--';
}

function saveSlotCardHTML(slot) {
  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const textMuted = p ? p.textMuted : '#555566';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const danger = p ? p.danger : '#e53935';
  const heal = p ? p.heal : '#66bb6a';
  const borderSubtle = p ? p.borderSubtle : 'rgba(255,255,255,0.08)';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';

  var typeLabel = slot.type === 'auto' ? '自动' : '手动';

  if (!slot || slot.isEmpty) {
    return '<div class="save-slot-card empty" style="' +
      'background:' + bgSurface + '; border:2px dashed ' + textMuted + '; border-radius:' + radius + ';' +
      'padding:16px; text-align:center; display:flex; flex-direction:column; justify-content:center;">' +
      '<div style="font-size:12px; color:' + textMuted + ';">' + slot.slot + '. [' + typeLabel + ']</div>' +
      '<div style="font-size:20px; color:' + textMuted + '; margin-top:8px;">空</div>' +
      '</div>';
  }

  var deadClass = slot.isDead ? ' dead' : '';
  var borderCol = slot.isDead ? danger : (slot.type === 'auto' ? heal : gold);
  var hpPct = slot.maxHp > 0 ? Math.round((slot.hp / slot.maxHp) * 100) : 0;

  var html = '<div class="save-slot-card' + deadClass + '" style="' +
    'background:' + bgSurface + '; border:2px solid ' + borderCol + '; border-radius:' + radius + ';' +
    'padding:10px;">';
  html += '<div style="font-size:11px; font-weight:bold; color:' + gold + ';">' +
    slot.slot + '. [' + typeLabel + ']' +
    (slot.isDead ? ' <span style="color:' + danger + ';">[已死亡]</span>' : '') +
    '</div>';
  html += '<div style="font-size:9px; color:' + textSecondary + '; margin:2px 0;">' + formatSaveTime(slot.timestamp) + '</div>';
  html += '<div style="font-size:11px; color:' + textSecondary + '; margin:4px 0;">' +
    getClassLabelSafe(slot.className) + ' Lv.' + (slot.level || 1) + ' · 第' + (slot.floor || 1) + '层' +
    '</div>';
  html += '<div class="bar-container" style="margin:4px 0;"><div class="bar hp" style="width:' + hpPct + '%;"></div>' +
    '<span class="bar-label" style="font-size:9px;">' + (slot.hp || 0) + '/' + (slot.maxHp || 0) + '</span></div>';
  html += '<div style="font-size:10px; color:' + textSecondary + ';">' +
    '\u{1f4b0}' + (slot.gold || 0) + '  \u{1f48e}' + (slot.gems || 0) + '</div>';
  html += '<div style="margin-top:6px; text-align:center;">';
  html += '<button class="modal-btn" style="font-size:10px; padding:3px 10px; border-color:' + gold + '; color:' + gold + ';" ' +
    'onclick="loadSave(' + slot.slot + ')">加载</button> ';
  html += '<button class="modal-btn" style="font-size:10px; padding:3px 10px; border-color:' + danger + '; color:' + danger + ';" ' +
    'onclick="deleteSaveAndRefresh(' + slot.slot + ', true)">删除</button>';
  html += '</div></div>';
  return html;
}

function showLoadSaveScreen() {
  var saves = typeof getAllSaves === 'function' ? getAllSaves() : null;
  if (!saves) saves = [null, null, null, null, null];

  var html = '<h3 style="margin-top:0; text-align:center;">选择存档</h3>';
  html += '<div class="save-slot-grid" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center; margin:12px 0;">';

  for (var i = 0; i < 5; i++) {
    var slot = saves[i];
    if (!slot) slot = { slot: i + 1, type: i < 2 ? 'auto' : 'manual', isEmpty: true };
    else slot.slot = i + 1;
    html += saveSlotCardHTML(slot);
  }

  html += '</div>';
  html += '<div style="text-align:center; margin-top:8px;">';
  html += '<button class="modal-btn" onclick="closeModal()">返回</button>';
  html += '</div>';

  showModal(html);
}

function showSaveSlotPicker() {
  var saves = typeof getAllSaves === 'function' ? getAllSaves() : null;

  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const textMuted = p ? p.textMuted : '#555566';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';

  var html = '<h3 style="margin-top:0; text-align:center;">手动存档</h3>';
  html += '<p style="font-size:10px; color:' + textSecondary + '; text-align:center; margin-bottom:10px;">选择存档位（3-5）</p>';
  html += '<div class="save-slot-grid" style="display:flex; flex-direction:column; gap:8px; max-width:320px; margin:0 auto;">';

  for (var i = 3; i < 6; i++) {
    var slot = saves && saves[i - 1] ? saves[i - 1] : null;
    var isEmpty = !slot;
    var borderCol = isEmpty ? textMuted : gold;

    html += '<div style="background:' + bgSurface + '; border:2px solid ' + borderCol + '; border-radius:' + radius + '; padding:10px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';

    if (isEmpty) {
      html += '<div style="font-size:12px; color:' + textMuted + ';">' + i + '. 空</div>';
    } else {
      html += '<div>' +
        '<span style="font-size:12px; color:' + gold + ';">' + i + '. </span>' +
        '<span style="font-size:11px; color:' + textSecondary + ';">' +
        getClassLabelSafe(slot.className) + ' Lv.' + (slot.level || 1) + ' · 第' + (slot.floor || 1) + '层</span>' +
        '<span style="font-size:9px; color:' + textMuted + '; margin-left:6px;">' + formatSaveTime(slot.timestamp) + '</span>' +
        '</div>';
    }

    html += '<button class="modal-btn" style="font-size:10px; padding:3px 12px; border-color:' + gold + '; color:' + gold + ';" ' +
      'onclick="doManualSaveToSlot(' + i + ')">存档</button>';
    html += '</div></div>';
  }

  html += '</div>';
  html += '<div style="text-align:center; margin-top:12px;">';
  html += '<button class="modal-btn" onclick="closeModal()">返回</button>';
  html += '</div>';

  showModal(html);
}

function deleteSaveAndRefresh(slot, fromLoadScreen) {
  if (typeof deleteSave === 'function') {
    deleteSave(slot);
    addLog('存档位 ' + slot + ' 已删除', 'info');
  }
  if (fromLoadScreen) {
    closeModal();
    setTimeout(function () { showLoadSaveScreen(); }, 150);
  } else {
    closeModal();
    setTimeout(function () { showSaveSlotPicker(); }, 150);
  }
}

function loadSave(slot) {
  if (typeof loadGame === 'function') {
    var ok = loadGame(slot);
    if (ok) {
      closeModal();
      gameState.screen = 'dungeon';
      showScreen('dungeon');
      renderPlayerPanel();
      renderHUD();
      if (typeof renderDungeon === 'function') renderDungeon();
      addLog('已加载存档位 ' + slot, 'info');
    } else {
      addLog('存档加载失败', 'info');
      closeModal();
    }
  }
}

function doManualSaveToSlot(slot) {
  if (typeof saveGame === 'function') {
    saveGame(slot);
    addLog('已保存到存档位 ' + slot, 'info');
  }
  closeModal();
  setTimeout(function () { showSaveSlotPicker(); }, 150);
}

// =================== Equipment Management Modal ===================

function showEquipmentModal() {
  if (!player) return;
  if (!player.inventory.equipment) player.inventory.equipment = [];

  const t = getTheme();
  const p = t ? t.palette : null;
  const u = t ? t.ui : null;
  const gold = p ? p.gold : '#f0c040';
  const textSecondary = p ? p.textSecondary : '#8888aa';
  const textMuted = p ? p.textMuted : '#555566';
  const bgSurface = p ? p.bgSurface : '#1a1a2e';
  const bgDeep = p ? p.bgDeep : '#0a0a14';
  const grayDk = p ? p.grayDk : '#3a3a5a';
  const grayLt = p ? p.grayLt : '#9a9aba';
  const white = p ? p.white : '#e8e8e8';
  const magic = p ? p.magic : '#7c4dff';
  const info = p ? p.info : '#64b5f6';
  const danger = p ? p.danger : '#e53935';
  const heal = p ? p.heal : '#66bb6a';
  const radius = u ? (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : '8px') : '8px';

  var rarityLabel = { white: '普通', blue: '稀有', purple: '史诗' };
  var rarityColor = { white: white, blue: info, purple: gold };

  var html = '<h3 style="margin-top:0; color:' + gold + ';">⚔ 装备管理</h3>';

  // --- New drops notification ---
  var newDropCount = 0;
  if (player.inventory.equipment) {
    for (var nd = 0; nd < player.inventory.equipment.length; nd++) {
      if (player.inventory.equipment[nd].justDropped) newDropCount++;
    }
  }
  if (newDropCount > 0) {
    html += '<div style="background:rgba(240,192,64,0.12); border:1.5px solid ' + gold + '; border-radius:' + radius + '; padding:6px 10px; margin:6px 0; text-align:center;">';
    html += '<span style="color:' + gold + '; font-weight:bold; font-size:11px;">获得 ' + newDropCount + ' 件新装备！</span>';
    html += '</div>';
  }

  // --- Equipped slots ---
  html += '<div style="margin-bottom:8px;">';
  html += '<div style="font-size:10px; color:' + textSecondary + '; margin-bottom:4px;">当前装备</div>';
  var labels = { weapon: '⚔ 武器', armor: '\u{1f6e1} 护甲', accessory: '\u{1f48d} 饰品' };
  for (var si = 0; si < 3; si++) {
    var slot = ['weapon', 'armor', 'accessory'][si];
    var eq = player.equip[slot];
    var borderColor = grayDk;
    var slotContent = '';

    if (eq) {
      borderColor = rarityColor[eq.rarity] || grayLt;
      if (eq.identified === false) {
        slotContent = '<span style="color:' + textMuted + '">??? (' + rarityLabel[eq.rarity] + ')</span>';
      } else {
        var statsStr = '';
        var statKeys = Object.keys(eq.stats);
        for (var sk = 0; sk < statKeys.length; sk++) {
          var sd = EQUIP_STAT_DEFS[statKeys[sk]];
          if (sd) statsStr += sd.icon + sd.label + eq.stats[statKeys[sk]] + ' ';
        }
        slotContent =
          '<span style="color:' + (rarityColor[eq.rarity] || white) + '; font-weight:bold;">' + eq.icon + ' ' + eq.name + '</span><br>' +
          '<span style="font-size:9px; color:' + grayLt + '">' + statsStr + '</span>';
      }
    } else {
      slotContent = '<span style="color:' + textMuted + '">— 空 —</span>';
    }

    html += '<div style="display:flex; align-items:center; gap:4px; border:1.5px solid ' + borderColor + '; border-radius:' + radius + '; padding:5px 8px; margin:3px 0; background:' + bgSurface + ';">';
    html += '<div style="flex:1; font-size:10px;">' + labels[slot] + '</div>';
    html += '<div style="font-size:9px; text-align:right; flex:2;">' + slotContent + '</div>';

    if (eq && eq.identified !== false) {
      html += '<button class="equip-modal-btn" style="border-color:' + danger + '; color:' + danger + '; font-size:8px; padding:2px 6px; min-width:auto;" onclick="doUnequipSlot(\'' + slot + '\')">卸下</button>';
    }
    html += '</div>';
  }
  html += '</div>';

  // --- Inventory equipment ---
  var invEquip = player.inventory.equipment || [];
  html += '<div>';
  html += '<div style="font-size:10px; color:' + textSecondary + '; margin-bottom:4px;">背包装备 (' + invEquip.length + ')</div>';

  if (invEquip.length === 0) {
    html += '<div style="font-size:9px; color:' + textMuted + '; padding:8px; text-align:center;">没有装备</div>';
  } else {
    for (var i = 0; i < invEquip.length; i++) {
      var item = invEquip[i];
      var ic = rarityColor[item.rarity] || white;
      var isNew = item.justDropped === true;
      var itemBorder = isNew ? gold : grayDk;
      var itemBg = isNew ? 'rgba(240,192,64,0.08)' : 'rgba(255,255,255,0.02)';
      var newTag = isNew ? '<span style="color:' + gold + '; font-size:8px; font-weight:bold; margin-left:3px;">NEW</span>' : '';
      html += '<div style="display:flex; align-items:center; gap:4px; border:1.5px solid ' + itemBorder + '; border-radius:' + radius + '; padding:5px 8px; margin:3px 0; background:' + itemBg + (isNew ? '; box-shadow:0 0 6px rgba(240,192,64,0.25);' : '') + ';">';
      html += '<div style="flex:1; font-size:10px;">';

      if (item.identified === false) {
        html += '<span style="color:' + textMuted + '">' + item.icon + ' ??? (' + rarityLabel[item.rarity] + ') 未鉴定</span>' + newTag;
      } else {
        var iStatsStr = '';
        var iStatKeys = Object.keys(item.stats);
        for (var isk = 0; isk < iStatKeys.length; isk++) {
          var iSd = EQUIP_STAT_DEFS[iStatKeys[isk]];
          if (iSd) iStatsStr += iSd.icon + iSd.label + item.stats[iStatKeys[isk]] + ' ';
        }
        html += '<span style="color:' + ic + '; font-weight:bold;">' + item.icon + ' ' + item.name + '</span>' + newTag + '<br>';
        html += '<span style="font-size:9px; color:' + grayLt + '">' + iStatsStr + '</span>';
      }

      html += '</div>';
      html += '<button class="equip-modal-btn" style="border-color:' + heal + '; color:' + heal + '; font-size:8px; padding:2px 6px; min-width:auto;" onclick="doEquipItem(\'' + item.id + '\')">装备</button>';
      html += '<button class="equip-modal-btn" style="border-color:' + gold + '; color:' + gold + '; font-size:8px; padding:2px 6px; min-width:auto;" onclick="doSellEquipment(\'' + item.id + '\')">出售</button>';
      html += '</div>';
    }
  }
  html += '</div>';

  html += '<div style="text-align:center; margin-top:12px;">';
  html += '<button class="modal-btn" onclick="closeModal()">关闭</button>';
  html += '</div>';

  showModal(html);

  // Clear the justDropped flag so next open doesn't show NEW
  if (newDropCount > 0 && typeof clearNewDrops === 'function') {
    clearNewDrops();
  }
}

function doEquipItem(equipId) {
  equipItem(equipId);
  playSound('defend');
  renderPlayerPanel();
  showEquipmentModal();
}

function doUnequipSlot(slot) {
  unequipSlot(slot);
  playSound('step');
  renderPlayerPanel();
  showEquipmentModal();
}

function doSellEquipment(equipId) {
  var gold = sellEquipment(equipId);
  if (gold > 0) {
    addLog('出售装备获得 ' + gold + ' 金币', 'loot');
  }
  renderPlayerPanel();
  showEquipmentModal();
}

// =================== Global exports for onclick handlers ===================
window.getTheme = getTheme;
window.renderPlayerPanel = renderPlayerPanel;
window.renderCombatActions = renderCombatActions;
window.renderHUD = renderHUD;
window.renderGameOverScreen = renderGameOverScreen;
window.renderVictoryScreen = renderVictoryScreen;
window.returnToTitle = returnToTitle;
window.showTalentScreen = showTalentScreen;
window.buyTalent = buyTalent;
window.closeTalentScreen = closeTalentScreen;
window.pickClass = pickClass;
window.showClassSelection = showClassSelection;
window.showGemEnhancement = showGemEnhancement;
window.spendGemOn = spendGemOn;
window.showFloorBreak = showFloorBreak;
window.floorBreakChoice = floorBreakChoice;
window.proceedToNextFloor = proceedToNextFloor;
window.showThemeShop = showThemeShop;
window.equipTheme = equipTheme;
window.renderThemeThumbnail = renderThemeThumbnail;
window.trackThemeProgress = trackThemeProgress;
window.showUnlockModal = showUnlockModal;
window.manualSave = manualSave;
window.showLoadSaveScreen = showLoadSaveScreen;
window.showSaveSlotPicker = showSaveSlotPicker;
window.loadSave = loadSave;
window.deleteSaveAndRefresh = deleteSaveAndRefresh;
window.doManualSaveToSlot = doManualSaveToSlot;
window.showEquipmentModal = showEquipmentModal;
window.doEquipItem = doEquipItem;
window.doUnequipSlot = doUnequipSlot;
window.doSellEquipment = doSellEquipment;
// findBuffDef is in utils.js
