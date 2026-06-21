// main.js — Game initialization, loop, input, screen management

var permanent = null; // loaded permanent data

function initGame() {
  initCanvas();
  permanent = loadPermanent();
  setupInput();
  showScreen('title');
  updateTitleScreen();
  gameLoop();
}

function gameLoop() {
  renderAll();
  requestAnimationFrame(gameLoop);
}

function updateTitleScreen() {
  var btns = document.getElementById('title-buttons');
  if (!btns) return;
  var hasSave = !!localStorage.getItem(SAVE_KEY);
  btns.innerHTML =
    '<button class="start-btn" onclick="startNewGame()">开始冒险</button>' +
    (hasSave ? '<button class="start-btn" style="margin-top:8px;border-color:#f0c040;" onclick="continueGame()">继续冒险</button>' : '') +
    '<button class="start-btn" style="margin-top:8px;border-color:#9a9aba;" onclick="showTalentScreen()">天赋 (' + permanent.soulShards + ' 碎片)</button>';
}

function startNewGame() {
  initAudio();
  resetForNewRun(permanent);
  applyTalentBonuses(permanent);
  recalcPlayerStats();
  // bonus gold from death keep
  if (permanent && permanent._startGold) {
    player.gold += permanent._startGold;
    permanent._startGold = 0;
  }
  gameState.screen = 'dungeon';
  // Hide ALL overlay screens (title stays active from initGame)
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  dungeon = generateFloor(1);
  player.x = dungeon.playerStart.x;
  player.y = dungeon.playerStart.y;
  addLog('[init] 进入 ' + dungeon.theme.name + '，探索吧！', 'info');
  addLog('[init] HP:' + player.hp + ' ATK:' + getPlayerAtk() + ' DEF:' + getPlayerDef() + ' SPD:' + getPlayerSpd(), 'info');
  renderPlayerPanel();
  renderHUD();
}

function continueGame() {
  initAudio();
  if (loadGame()) {
    permanent = loadPermanent();
    applyTalentBonuses(permanent);
    recalcPlayerStats();
    gameState.screen = 'dungeon';
    showScreen('dungeon');
    addLog('读档成功，继续冒险！', 'info');
    renderPlayerPanel();
    renderHUD();
  } else {
    addLog('存档已损坏，请重新开始', 'dmg');
  }
}

function setupInput() {
  document.addEventListener('keydown', function (e) {
    console.log('[input] keydown:', e.key, 'paused:', gameState.paused, 'screen:', gameState.screen);
    initAudio();
    if (gameState.paused) return;

    if (gameState.screen === 'title') {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        startNewGame();
      }
      return;
    }

    if (gameState.screen === 'dungeon') {
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': e.preventDefault(); movePlayer(0, -1); break;
        case 'ArrowDown': case 's': case 'S': e.preventDefault(); movePlayer(0, 1); break;
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
window.pickBuff = pickBuff;
window.pickClass = pickClass;
window.selectRelic = selectRelic;
window.showRelicSelection = showRelicSelection;
window.finishGameOver = finishGameOver;
