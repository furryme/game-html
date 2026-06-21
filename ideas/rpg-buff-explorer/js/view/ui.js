// ui.js — HTML UI updates

function renderPlayerPanel() {
  if (!player) return;

  const hpPct = clamp((player.hp / player.maxHp) * 100, 0, 100);
  const mpPct = clamp((player.mp / player.maxMp) * 100, 0, 100);
  const expPct = clamp((player.exp / player.expNext) * 100, 0, 100);

  const panel = document.getElementById('player-panel');
  if (!panel) return;

  panel.innerHTML =
    '<div class="panel-header">Lv.' + player.lvl + ' 战士</div>' +
    '<div class="bar-container"><div class="bar hp" style="width:' + hpPct + '%"></div><span class="bar-label">' + player.hp + '/' + player.maxHp + '</span></div>' +
    '<div class="bar-container"><div class="bar mp" style="width:' + mpPct + '%"></div><span class="bar-label">' + player.mp + '/' + player.maxMp + '</span></div>' +
    '<div class="bar-container"><div class="bar exp" style="width:' + expPct + '%"></div><span class="bar-label">' + player.exp + '/' + player.expNext + '</span></div>' +
    '<div class="stat-row"><span>⚔️' + getPlayerAtk() + '</span><span>\u{1f6e1}' + getPlayerDef() + '</span><span>\u{1f4a8}' + getPlayerSpd() + '</span></div>' +
    '<div class="stat-row"><span>\u{1f4b0}' + player.gold + '</span><span>\u{1f48e}' + player.gems + '</span></div>' +
    buffChipHTML() +
    equipPanelHTML() +
    inventoryHTML();
}

function buffChipHTML() {
  if (!player.activeBuffs || player.activeBuffs.length === 0) return '';
  let html = '<div class="buff-chips">';
  for (let i = 0; i < player.activeBuffs.length; i++) {
    const buffEntry = player.activeBuffs[i];
    const buffId = typeof buffEntry === 'string' ? buffEntry : buffEntry.id;
    if (!buffId) continue;
    const def = findBuffDef(buffId);
    if (!def) continue;
    const isRelic = buffEntry && buffEntry.isRelic;
    const relicTag = isRelic ? ' <span style="color:#f0c040; font-size:9px;">(遗物)</span>' : '';
    const style = isRelic ? ' border:1px dashed #f0c040;' : '';
    html += '<span class="buff-chip buff-' + def.rarity + '" style="' + style + '">' + def.icon + ' ' + def.name + relicTag + '</span>';
  }
  html += '</div>';
  return html;
}

function equipPanelHTML() {
  let html = '<div class="equip-slots">';
  const labels = { weapon: '⚔️', armor: '\u{1f6e1}', accessory: '\u{1f48d}' };
  const rarityLabel = { white: '普通', blue: '稀有', purple: '史诗' };
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const eq = player.equip[slot];
    if (eq && !eq.identified) {
      const unidColor = eq.rarity === 'purple' ? '#cc77ff' : eq.rarity === 'blue' ? '#55aaff' : '#ffffff';
      html += '<div class="equip-slot" style="border-color:#555; background:#1a1a2a; color:#666;">' +
        '<span>' + eq.icon + ' ??? (' + rarityLabel[eq.rarity] + ')</span>' +
        '<span style="color:' + unidColor + '; font-size:9px;">未鉴定</span></div>';
    } else if (eq) {
      const name = eq.icon + ' ' + eq.name;
      const color = eq.rarity === 'purple' ? PAL.gold : eq.rarity === 'blue' ? PAL.blue : PAL.grayLt;
      html += '<div class="equip-slot" style="border-color:' + color + '"><span>' + name + '</span></div>';
    } else {
      html += '<div class="equip-slot" style="border-color:' + PAL.grayDk + '"><span>' + labels[slot] + ' 空</span></div>';
    }
  }
  html += '</div>';
  return html;
}

function inventoryHTML() {
  const keys = Object.keys(player.inventory).filter(function (k) { return player.inventory[k] > 0; });
  if (keys.length === 0) return '';
  let html = '<div class="inventory">';
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const def = ITEMS_DATA[key];
    if (!def) continue;
    html += '<button class="inv-btn" onclick="useItem(\'' + key + '\')">' + def.icon + ' ' + def.name + ' ×' + player.inventory[key] + '</button>';
  }
  html += '</div>';
  return html;
}

function renderCombatActions() {
  const actionsEl = document.getElementById('combat-actions');
  if (!actionsEl) { console.log('[ui] renderCombatActions: no combat-actions element'); return; }

  console.log('[ui] renderCombatActions called, player.lvl=', player.lvl, 'SKILLS.len=', SKILLS.length);
  let html = '<div class="combat-btns">';
  html += '<button class="btn btn-atk" onclick="doAttack()">⚔️ 攻击</button>';
  html += '<button class="btn btn-def" onclick="doDefend()">\u{1f6e1} 防御</button>';

  html += '<div class="skill-btns">';
  var skillCount = 0;
  for (let i = 0; i < SKILLS.length; i++) {
    const skill = SKILLS[i];
    if (player.lvl < skill.unlockLvl) continue;
    skillCount++;
    const cd = player.skillCooldowns[skill.id] || 0;
    const canUse = player.mp >= skill.mpCost && cd === 0;
    html += '<button class="btn btn-skill' + (canUse ? '' : ' disabled') + '" ' +
      (canUse ? 'onclick="doSkill(\'' + skill.id + '\')"' : 'disabled') +
      '">' + skill.icon + ' ' + skill.name + ' ' + (skill.mpCost ? skill.mpCost + 'MP' : '') + (cd > 0 ? '(CD:' + cd + ')' : '') + '</button>';
  }
  html += '</div>';
  console.log('[ui] skills rendered:', skillCount);

  html += '<button class="btn btn-item" onclick="toggleInventoryModal()">\u{1f3fa}️ 物品</button>';
  html += '<button class="btn btn-flee" onclick="tryFlee()">\u{1f6c0} 跑跑</button>';
  html += '</div>';

  actionsEl.innerHTML = html;
  console.log('[ui] combat-actions innerHTML set, len=', actionsEl.innerHTML.length, 'buttonCount=', actionsEl.querySelectorAll('button').length);
}

function renderHUD() {
  const actionsEl = document.getElementById('dungeon-actions');
  if (!actionsEl) return;

  let html = '<div class="action-hint">WASD / 方向键 移动</div>';
  html += '<div class="action-hint">Enter 使用药水  |  I 背包</div>';
  actionsEl.innerHTML = html;
}

// =================== Game Over Screen ===================

function renderGameOverScreen(keptGold) {
  var screen = document.getElementById('gameover-screen');
  if (!screen) return;
  var statsText =
    '<div class="stats">' +
    '  到达第 ' + gameState.floor + ' 层 · 击杀 ' + (permanent ? permanent.permanentStats.totalKills : 0) + ' 只 · 回合 ' + gameState.turnCount +
    '</div>';
  if (keptGold > 0) statsText += '<div class="stats" style="color:#f0c040;">保留 ' + keptGold + ' 金币（50%）</div>';

  // Show relic info if player has one
  var relicText = '';
  if (permanent && permanent.relic) {
    var relicDef = findBuffDef(permanent.relic);
    if (relicDef) {
      relicText = '<div class="stats" style="color:#f0c040; margin-top:4px;">\u{1F48E} 遗物: ' + relicDef.icon + ' ' + relicDef.name + '（带入下次冒险）</div>';
    }
  }

  screen.innerHTML =
    '<div class="game-over">' +
    '  <h2>阵亡</h2>' +
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
  var screen = document.getElementById('victory-screen');
  if (!screen) return;
  screen.innerHTML =
    '<div class="game-over victory">' +
    '  <h2>通关！</h2>' +
    '  <div class="stats">' +
    '    用时 ' + gameState.turnCount + ' 回合 · 达到 Lv.' + player.lvl +
    '  </div>' +
    '  <div class="stats" style="color:#f0c040;">获得 3 灵魂碎片！</div>' +
    '  <button class="restart-btn" onclick="startNewGame()">再来一次</button>' +
    '  <button class="restart-btn" style="margin-left:8px;" onclick="returnToTitle()">返回标题</button>' +
    '</div>';
}

// =================== Talent Screen ===================

function showTalentScreen() {
  if (!permanent) return;
  var html = '<h3>⚡ 天赋树</h3>';
  html += '<p style="color:#f0c040;margin-bottom:8px;">灵魂碎片: ' + permanent.soulShards + '</p>';

  var keys = Object.keys(TALENT_DEFS);
  for (var i = 0; i < keys.length; i++) {
    var id = keys[i];
    var def = TALENT_DEFS[id];
    var lvl = permanent.talents[id] || 0;
    var canBuy = lvl < 10 && permanent.soulShards > 0;
    var bar = '';
    for (var j = 0; j < 10; j++) bar += j < lvl ? '■' : '□';
    html += '<div style="border:1px solid #3a3a5a;border-radius:4px;padding:6px;margin:4px 0;">';
    html += '<div style="font-weight:bold;">' + def.name + ' <span style="color:#9a9aba;">(Lv.' + lvl + ')</span></div>';
    html += '<div style="color:#9a9aba;font-size:10px;">' + def.desc + ' → ' + bar + '</div>';
    html += '<button class="modal-btn" ' + (canBuy ? 'onclick="buyTalent(\'' + id + '\');showTalentScreen();"' : 'disabled') + '>' +
      (canBuy ? '升级 (1 碎片)' : (lvl >= 10 ? '已满' : '碎片不足')) + '</button>';
    html += '</div>';
  }
  html += '<br><button class="modal-btn" onclick="closeModal()">关闭</button>';
  showModal(html);
}

function buyTalent(talentId) {
  if (!permanent) return;
  if (unlockTalent(permanent, talentId)) {
    addLog('解锁天赋：' + TALENT_DEFS[talentId].name, 'loot');
  }
}

// =================== Buff Selection ===================

function showBuffSelection() {
  if (!permanent) return;
  // Pick 3 random unlocked buffs
  var pool = [];
  for (var i = 0; i < BUFF_DEFS.length; i++) {
    if (permanent.unlockedBuffs.indexOf(BUFF_DEFS[i].id) !== -1) {
      pool.push(BUFF_DEFS[i]);
    }
  }
  if (pool.length < 3) {
    // fallback: show whatever is unlocked
    if (pool.length === 0) return;
  } else {
    // Shuffle and pick 3
    shuffle(pool);
    pool = pool.slice(0, 3);
  }

  var html = '<h3>✨ 层前祝福 — 三选一</h3>';
  html += '<div class="buff-choices">';
  for (var i = 0; i < pool.length; i++) {
    var b = pool[i];
    html += '<div class="buff-card" onclick="pickBuff(\'' + b.id + '\')">' +
      '<div class="icon">' + b.icon + '</div>' +
      '<div class="name">' + b.name + '</div>' +
      '<div class="desc">' + b.desc + '</div>' +
      '</div>';
  }
  html += '</div>';
  showModal(html);
}

function pickBuff(buffId) {
  var def = findBuffDef(buffId);
  if (!def) return;

  // Check if already active
  for (var i = 0; i < player.activeBuffs.length; i++) {
    if (player.activeBuffs[i].id === buffId) {
      addLog('已拥有 ' + def.name, 'info');
      closeModal();
      return;
    }
  }

  player.activeBuffs.push({
    id: def.id,
    stats: buffDefToStats(def),
    combatDot: def.passive && def.passive.dotDmg ? def.passive.dotDmg : 0,
  });
  recalcPlayerStats();
  player.hp = player.maxHp; // heal to max on buff pick
  player.mp = player.maxMp;
  addLog('选择 ' + def.icon + ' ' + def.name + '！', 'loot');
  closeModal();
  renderPlayerPanel();

  // Show gem enhancement if player has gems
  if (player.gems > 0) {
    setTimeout(showGemEnhancement, 200);
  }
}

// =================== Gem Enhancement ===================

function showGemEnhancement() {
  if (!player || player.gems <= 0) return;
  console.log('[gem] showGemEnhancement, gems:', player.gems);

  var html = '<h3 style="margin-top:0; color:#f0c040;">\u{1F48E} 宝石强化</h3>';
  html += '<p style="font-size:12px; color:#9a9aba; margin-bottom:12px;">';
  html += '宝石: ' + player.gems + ' — 花费 1 宝石永久提升一项属性（本局有效）';
  html += '</p>';
  html += '<div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">';

  var options = [
    { label: '⚔ 攻击+5', stat: 'atk', icon: '⚔️', color: '#d43' },
    { label: '🛡 防御+5', stat: 'def', icon: '🛡', color: '#35c' },
    { label: '❤ 最大HP+20', stat: 'hp', icon: '❤', color: '#4a4' },
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

// =================== Class Selection (future multi-class) ===================

function pickClass(cls) {
  startNewGameWithClass(cls);
}

function startNewGameWithClass(cls) {
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

  gameState.screen = 'dungeon';
  showScreen('dungeon');
  dungeon = generateFloor(1);
  player.x = dungeon.playerStart.x;
  player.y = dungeon.playerStart.y;
  addLog('进入 ' + dungeon.theme.name + '，探索吧！', 'info');
  renderPlayerPanel();
  renderHUD();
}

// =================== Global exports for onclick handlers ===================
window.renderPlayerPanel = renderPlayerPanel;
window.renderCombatActions = renderCombatActions;
window.renderHUD = renderHUD;
window.renderGameOverScreen = renderGameOverScreen;
window.renderVictoryScreen = renderVictoryScreen;
window.returnToTitle = returnToTitle;
window.showTalentScreen = showTalentScreen;
window.buyTalent = buyTalent;
window.showBuffSelection = showBuffSelection;
window.pickBuff = pickBuff;
window.pickClass = pickClass;
window.showGemEnhancement = showGemEnhancement;
window.spendGemOn = spendGemOn;
// findBuffDef is in utils.js
