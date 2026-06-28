// main.js — Game initialization, loop, input, screen management

var permanent = null; // loaded permanent data

function initGame() {
  console.log('[init] page loaded, initializing...');
  initCanvas();
  var c = document.getElementById('game-canvas');
  console.log('[init] canvas created?', !!c, 'width=' + (c ? c.width : 'n/a') + ' height=' + (c ? c.height : 'n/a'));
  permanent = loadPermanent();
  migrateLegacySave();
  setupInput();
  showScreen('title');
  updateTitleScreen();
  applyThemeToBody(window.themeManager.getActive());
  gameLoop();
}

function gameLoop() {
  renderAll();
  requestAnimationFrame(gameLoop);
}

function updateTitleScreen() {
  var btns = document.getElementById('title-buttons');
  if (!btns) return;

  // Check all 5 save slots for any data
  var hasAnySave = false;
  if (typeof getAllSaves === 'function') {
    var saves = getAllSaves();
    if (saves && saves.length > 0) {
      for (var i = 0; i < saves.length; i++) {
        if (saves[i] && !saves[i].isEmpty) { hasAnySave = true; break; }
      }
    }
  }
  // Fallback: check old single save key for backward compatibility
  if (!hasAnySave) hasAnySave = !!localStorage.getItem(SAVE_KEY);

  var continueHtml = '';
  if (hasAnySave) {
    continueHtml = '<button class="start-btn" style="margin-top:8px;border-color:#f0c040;" onclick="showLoadSaveTitleScreen()">加载存档</button>';
  } else {
    continueHtml = '';
  }

  btns.innerHTML =
    '<button class="start-btn" onclick="showClassSelection()">选择职业</button>' +
    continueHtml +
    '<button class="start-btn" style="margin-top:8px;border-color:#9a9aba;" onclick="showTalentScreen()">天赋 (' + permanent.soulShards + ' 碎片)</button>' +
    '<button class="start-btn" style="margin-top:8px;border-color:#40c07a;" onclick="toggleBGM()">🎵 BGM: ' + (window.isBGMPlaying ? (isBGMPlaying() ? '开' : '关') : '关') + '</button>';
  console.log('[BGM] updateTitleScreen, BGM button text:', (window.isBGMPlaying ? (isBGMPlaying() ? '开' : '关') : '关'));

  // Check theme unlocks on title load
  if (window.themeManager) {
    var stats = window.themeManager.loadStats();
    window.themeManager.checkUnlockConditions(stats);
  }

  // Update BGM button state
  if (typeof updateBGMButton === 'function') {
    updateBGMButton();
  }
}

function startNewGame() {
  // Dismiss modals and reset game state
  gameState.paused = false;
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
  // Hide ALL overlay screens
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });

  // Show class selection so player can choose (or re-confirm) class on restart
  showClassSelection();
}

function showLoadSaveTitleScreen() {
  // Delegate to ui.js which renders the save slot selection grid
  if (typeof window.showLoadSaveScreen === 'function') {
    window.showLoadSaveScreen();
  } else {
    // Fallback: if ui.js not loaded, try old continueGame
    continueGame();
  }
}

function loadSave(slot) {
  initAudio();
  var ok;

  if (typeof loadGame === 'function' && loadGame.length > 0) {
    // New multi-slot loadGame(slot)
    ok = loadGame(slot);
  } else {
    // Fallback: old single-slot loadGame()
    ok = loadGame();
  }

  console.log('[loadSave] slot=' + slot + ' result: ' + ok);
  if (!ok) {
    addLog('存档已损坏或为空', 'dmg');
    updateTitleScreen();
    return;
  }

  // Check if this was a multi-slot load (metadata available)
  var isDead = false;
  if (typeof getAllSaves === 'function') {
    var saves = getAllSaves();
    if (saves && saves[slot - 1]) {
      isDead = saves[slot - 1].isDead === true;
    }
  }

  if (isDead) {
    if (!confirm('角色已死亡，是否继续？\n（损失一半金币和宝石）')) {
      showScreen('title');
      updateTitleScreen();
      return;
    }
    // Apply death penalty: halve gold and gems
    if (player) {
      player.gold = Math.floor(player.gold * 0.5);
      player.gems = Math.floor((player.gems || 0) * 0.5);
    }
  } else if (player && player.hp <= 0) {
    // Old save format without isDead flag
    addLog('角色已死亡，请重新开始', 'dmg');
    updateTitleScreen();
    return;
  }

  console.log('[loadSave] player: cls=' + player.cls + ' lvl=' + player.lvl + ' hp=' + player.hp + ' x=' + player.x + ' y=' + player.y);
  console.log('[loadSave] dungeon: floor=' + dungeon.floor + ' gridLen=' + (dungeon.grid ? dungeon.grid.length : 0) + ' roomsLen=' + (dungeon.rooms ? dungeon.rooms.length : 0) + ' enemiesLen=' + (dungeon.enemies ? dungeon.enemies.length : 0) + ' itemsLen=' + (dungeon.items ? dungeon.items.length : 0));
  console.log('[loadSave] dungeon.theme: ' + (dungeon.theme ? JSON.stringify({ id: dungeon.theme.id, name: dungeon.theme.name }) : 'MISSING'));
  permanent = loadPermanent();
  applyTalentBonuses(permanent);
  recalcPlayerStats();
  closeModal();
  gameState.paused = false;
  gameState.screen = 'dungeon';
  showScreen('dungeon');
  console.log('[loadSave] gameState: screen=' + gameState.screen + ' paused=' + gameState.paused);
  var c = document.getElementById('game-canvas');
  console.log('[loadSave] canvas exists?', !!c, 'width=' + (c ? c.width : 'n/a') + ' height=' + (c ? c.height : 'n/a'));
  var ds = document.getElementById('dungeon-screen');
  console.log('[loadSave] #dungeon-screen active?', !!ds, 'display=' + (ds ? ds.style.display : 'n/a'));
  var dc = document.getElementById('dungeon-canvas');
  console.log('[loadSave] #dungeon-canvas visible?', !!dc, 'display=' + (dc ? dc.style.display : 'n/a'));
  addLog('读档成功，继续冒险！', 'info');
  // Apply dungeon layer theme override for current floor
  if (window.themeManager && dungeon) window.themeManager.applyLayerOverride(dungeon.floor);
  renderPlayerPanel();
  renderHUD();
}

// Backward compatibility: continueGame loads from slot 1 (auto-save)
function continueGame() {
  loadSave(1);
}

function setupInput() {
  document.addEventListener('keydown', function (e) {
    console.log('[input] keydown:', e.key, 'paused:', gameState.paused, 'screen:', gameState.screen);
    initAudio();
    if (gameState.paused) return;

    if (gameState.screen === 'title') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        showClassSelection();
      }
      return;
    }

    if (gameState.screen === 'dungeon') {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); movePlayer(0, -1); break;
        case 'ArrowDown': case 's': case 'S':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (typeof manualSave === 'function') manualSave(); break; }
          e.preventDefault(); movePlayer(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); movePlayer(player._invertTurns > 0 ? 1 : -1, 0); break;
        case 'ArrowRight': case 'd': case 'D': e.preventDefault(); movePlayer(player._invertTurns > 0 ? -1 : 1, 0); break;
        case 'e': case 'E': case 'Enter': useItem('hp_potion'); break;
        case 'i': case 'I': toggleInventoryModal(); break;
      }
    }
  });

  // Touch controls for mobile
  let touchStartX = 0, touchStartY = 0;
  document.addEventListener('touchstart', function (e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });
  document.addEventListener('touchend', function (e) {
    initAudio();
    if (gameState.screen !== 'dungeon' || combatState) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 30) return; // too small, ignore
    if (absDx > absDy) {
      movePlayer(dx > 0 ? 1 : -1, 0);
    } else {
      movePlayer(0, dy > 0 ? 1 : -1);
    }
  });
}

function toggleInventoryModal() {
  const keys = Object.keys(player.inventory).filter(k => player.inventory[k] > 0);
  if (keys.length === 0) {
    addLog('背包是空的', 'info');
    return;
  }

  let html = '<h3>\u{1F392} 背包</h3>';
  for (const key of keys) {
    const def = ITEMS_DATA[key];
    if (!def) continue;
    html += '<button class="modal-btn" onclick="useItem(\'' + key + '\');toggleInventoryModal();">' + def.icon + ' ' + def.name + ' ×' + player.inventory[key] + '</button><br>';
  }
  html += '<button class="modal-btn" onclick="closeModal()">关闭</button>';
  showModal(html);
}

// Make key functions global for onclick
window.initGame = initGame;
window.startNewGame = startNewGame;
window.continueGame = continueGame;
window.updateTitleScreen = updateTitleScreen;
window.showLoadSaveTitleScreen = showLoadSaveTitleScreen;
window.loadSave = loadSave;
window.movePlayer = movePlayer;
window.useItem = useItem;
window.doAttack = doAttack;
window.doDefend = doDefend;
window.doSkill = doSkill;
window.toggleInventoryModal = toggleInventoryModal;
window.closeModal = closeModal;
window.tryFlee = tryFlee;
window.returnToTitle = returnToTitle;
window.showTalentScreen = showTalentScreen;
window.buyTalent = buyTalent;
window.pickClass = pickClass;
window.showClassSelection = showClassSelection;
window.selectRelic = selectRelic;
window.showRelicSelection = showRelicSelection;
window.finishGameOver = finishGameOver;
window.cycleTheme = cycleTheme;
window.showThemeShop = showThemeShop;
window.equipTheme = equipTheme;

/** Cycle through unlocked themes, skipping locked ones. */
function cycleTheme() {
  var tm = window.themeManager;
  if (!tm) return;
  var ids = tm.getAllIds();
  var current = tm.getActiveId();
  var total = ids.length;
  var startIdx = -1;
  for (var i = 0; i < total; i++) {
    if (ids[i] === current) { startIdx = i; break; }
  }
  if (startIdx < 0) return;
  // Find next unlocked theme after current
  var next = null;
  for (var step = 1; step < total; step++) {
    var idx = (startIdx + step) % total;
    if (tm.isUnlocked(ids[idx])) {
      next = ids[idx];
      break;
    }
  }
  if (!next) return;
  if (tm.switch(next)) {
    var theme = tm.getActive();
    applyThemeToBody(theme);
    addLog('主题切换: ' + (theme.name || next), 'info');
  }
}

/** Apply theme colors to the body, title screen, and button label. */
function applyThemeToBody(theme) {
  var p = theme.palette;
  document.body.style.background = p.bodyBg;
  document.body.style.color = p.textPrimary;

  // Update title screen so theme change is visible on title screen
  var ts = document.getElementById('title-screen');
  if (ts) {
    ts.style.background = p.bodyBg;
    var h1 = ts.querySelector('h1');
    if (h1) h1.style.color = p.headerGold;
  }

  // Update theme button text to show current theme name
  var btns = document.querySelectorAll('[onclick="cycleTheme()"]');
  for (var i = 0; i < btns.length; i++) {
    btns[i].textContent = '切换主题 (' + (theme.name || theme.id) + ')';
  }
}
