// movement.js — Player movement, item pickup, trap triggers, floor transition

/**
 * Move player by dx, dy. Handles collision, items, traps, stairs.
 * @param {number} dx
 * @param {number} dy
 */
function movePlayer(dx, dy) {
  if (gameState.paused || combatState || !dungeon) return;

  var nx = player.x + dx;
  var ny = player.y + dy;

  // 1. Bounds/wall check
  if (!inBounds(nx, ny) || dungeon.grid[ny][nx] === TILE.WALL) return;

  // 2. Enemy check — start combat
  for (var ei = 0; ei < dungeon.enemies.length; ei++) {
    var e = dungeon.enemies[ei];
    if (e && e.x === nx && e.y === ny && e.hp > 0) {
      console.log('[combat] 遭遇', e.name, 'at', nx, ny);
      startCombat(ei);
      return;
    }
  }

  // 3. Slow status — skip this turn (slow = skip half moves)
  if (player._slowTurns && player._slowTurns > 0) {
    if (Math.random() < 0.5) {
      console.log('[trap] slow active, skipped this turn (_slowTurns=' + player._slowTurns + ')');
      addLog('你行动迟缓，未能移动', 'info');
      player._slowTurns--;
      if (player._slowTurns <= 0) {
        delete player._slowTurns;
        addLog('迟缓效果解除', 'info');
      }
      renderPlayerPanel();
      return;
    }
  }

  // 3b. Move player
  player.x = nx;
  player.y = ny;
  player.dirY = dy;
  if (dx !== 0) player.dirX = dx;
  player.state = 'walk';
  if (player._walkTimer) clearTimeout(player._walkTimer);
  player._walkTimer = setTimeout(function () { player.state = 'idle'; }, 300);
  gameState.turnCount++;
  playSound('step');

  // 4. Item pickup
  for (var ii = 0; ii < dungeon.items.length; ii++) {
    var item = dungeon.items[ii];
    if (item.x === nx && item.y === ny) {
      if (item.type === 'gold') {
        player.gold += item.amount;
        addLog('获得 ' + item.amount + ' 金币', 'loot');
        playSound('pickup');
        dungeon.items.splice(ii, 1);
      } else if (item.type === 'resting') {
        var heal = Math.floor(player.maxHp * 0.3);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        addLog('在篝火旁休息，恢复 ' + heal + ' HP', 'heal');
        playSound('heal');
        dungeon.items.splice(ii, 1);
      } else {
        player.inventory[item.type] = (player.inventory[item.type] || 0) + 1;
        var itemData = ITEMS_DATA[item.type];
        var label = itemData ? itemData.name : item.type;
        addLog('获得 ' + label, 'loot');
        playSound('pickup');
        dungeon.items.splice(ii, 1);
      }

      // Chest trap — 10% chance when picking up items
      if (Math.random() < 0.1) {
        var chestTrapEffects = ['poison', 'lose_gold', 'teleport'];
        var chestEffect = pick(chestTrapEffects);
        console.log('[trap] chest trap triggered: ' + chestEffect);
        if (chestEffect === 'poison') {
          player.statuses.push({
            id: 'poison',
            type: 'dot',
            turnsLeft: 3,
            value: 4,
          });
          addLog('宝物有陷阱！你中毒了', 'dmg');
        } else if (chestEffect === 'lose_gold') {
          var goldLoss = Math.floor(player.gold * 0.3);
          if (goldLoss > 0) {
            player.gold -= goldLoss;
            addLog('宝物有陷阱！失去 ' + goldLoss + ' 金币', 'dmg');
          } else {
            addLog('宝物有陷阱！但没金币可抢', 'info');
          }
        } else if (chestEffect === 'teleport') {
          var revealedPos2 = [];
          for (var ry2 = 0; ry2 < MAP_H; ry2++) {
            for (var rx2 = 0; rx2 < MAP_W; rx2++) {
              if (dungeon.revealed[ry2][rx2] && dungeon.grid[ry2][rx2] !== TILE.WALL) {
                if (!(rx2 === player.x && ry2 === player.y)) {
                  revealedPos2.push({ x: rx2, y: ry2 });
                }
              }
            }
          }
          if (revealedPos2.length > 0) {
            var dest2 = pick(revealedPos2);
            player.x = dest2.x;
            player.y = dest2.y;
            player.state = 'walk';
            if (player._walkTimer) clearTimeout(player._walkTimer);
            player._walkTimer = setTimeout(function () { player.state = 'idle'; }, 300);
            addLog('宝物有陷阱！你被传送了', 'dmg');
          }
        }
      }
      break;
    }
  }

  // 5. Trap check
  for (var ti = 0; ti < dungeon.traps.length; ti++) {
    var trap = dungeon.traps[ti];
    if (trap.x === nx && trap.y === ny && !trap.triggered) {
      if (!trap.revealed || Math.random() > (trap.detectChance || 0.3)) {
        trap.triggered = true;
        trap.revealed = true;
        playSound('trap');
        console.log('[trap] triggered:', trap.label, 'effect:', trap.effect, 'val:', trap.val);
        if (trap.effect === 'dmg') {
          player.hp -= trap.damage;
          addLog('踩中' + trap.label + '！-' + trap.damage + 'HP', 'dmg');
        } else if (trap.effect === 'poison') {
          player.statuses.push({
            id: 'poison',
            type: 'dot',
            turnsLeft: trap.val,
            value: 4,
          });
          addLog('踩中' + trap.label + '！中毒', 'dmg');
        } else if (trap.effect === 'teleport') {
          var revealedPos = [];
          for (var ry = 0; ry < MAP_H; ry++) {
            for (var rx = 0; rx < MAP_W; rx++) {
              if (dungeon.revealed[ry][rx] && dungeon.grid[ry][rx] !== TILE.WALL) {
                revealedPos.push({ x: rx, y: ry });
              }
            }
          }
          if (revealedPos.length > 0) {
            var dest = pick(revealedPos);
            player.x = dest.x;
            player.y = dest.y;
            player.state = 'walk';
            if (player._walkTimer) clearTimeout(player._walkTimer);
            player._walkTimer = setTimeout(function () { player.state = 'idle'; }, 300);
            addLog('踩中' + trap.label + '！被传送了', 'info');
          }
        } else if (trap.effect === 'slow') {
          player._slowTurns = trap.val;
          console.log('[trap] slow applied, _slowTurns=' + player._slowTurns);
          addLog('踩中' + trap.label + '！行动迟缓 ' + trap.val + ' 回合', 'dmg');
        } else if (trap.effect === 'invert') {
          player._invertTurns = trap.val;
          console.log('[trap] invert applied, _invertTurns=' + player._invertTurns);
          addLog('踩中' + trap.label + '！方向反转 ' + trap.val + ' 回合', 'dmg');
        } else if (trap.effect === 'aoe_dmg') {
          player.hp -= trap.damage;
          console.log('[trap] aoe_dmg applied, damage=' + trap.damage);
          addLog('踩中' + trap.label + '！-' + trap.damage + 'HP', 'dmg');
        }
      } else {
        trap.revealed = true;
        addLog('察觉并避开了陷阱', 'info');
      }
      break;
    }
  }

  // 6. Death check after trap damage
  if (player.hp <= 0) {
    playerDied();
    return;
  }

  // 7. Shrine check — one-time heal per floor
  if (!gameState.shrinesUsedThisFloor) gameState.shrinesUsedThisFloor = {};
  for (var sri = 0; sri < dungeon.rooms.length; sri++) {
    var room = dungeon.rooms[sri];
    if (room.type === 'shrine' && player.x === room.cx && player.y === room.cy) {
      var shrineKey = room.cx + ',' + room.cy;
      if (!gameState.shrinesUsedThisFloor[shrineKey]) {
        gameState.shrinesUsedThisFloor[shrineKey] = true;
        var shrineHeal = Math.floor(player.maxHp * 0.2);
        player.hp = Math.min(player.maxHp, player.hp + shrineHeal);
        console.log('[shrine] healed ' + shrineHeal + ' HP at ' + shrineKey);
        addLog('感受到圣殿的治愈之力，恢复 ' + shrineHeal + ' HP', 'heal');
        playSound('heal');
      }
      break;
    }
  }

  // 8. Stairs check
  if (nx === dungeon.stairsPos.x && ny === dungeon.stairsPos.y) {
    if (dungeon.floor === MAX_FLOORS && !gameState.bossDefeated) {
      addLog('必须先击败Boss才能离开！', 'info');
      return;
    }
    showFloorBreak();
    return;
  }

  // 9. Environment buff/debuff
  if (dungeon.theme.envBuff) {
    var env = dungeon.theme.envBuff;
    if (env.id === 'decay' && gameState.turnCount % 5 === 0) {
      var loss = Math.floor(player.maxHp * 0.03);
      player.hp -= loss;
      addLog('腐朽侵蚀了你，-' + loss + 'HP', 'dmg');
    }
    if (env.id === 'inferno' && gameState.turnCount % 4 === 0) {
      var burnLoss = Math.floor(player.maxHp * 0.05);
      player.hp -= burnLoss;
      addLog('熔火灼烧了你，-' + burnLoss + 'HP', 'dmg');
    }
  }

  // 9b. Random event check (5% per move, max 2 per floor, corridors only)
  if (dungeon.grid[ny][nx] === TILE.CORRIDOR
      && gameState.eventsThisFloor < 2
      && Math.random() < 0.05) {
    gameState.eventsThisFloor++;
    var event = pickRandomEvent();
    if (event) {
      triggerEvent(event);
    }
  }

  // 10. Update FOV
  revealLineOfSight(dungeon.grid, player.x, player.y, dungeon.visibility, dungeon.revealed);

  // 11. Check death (env buff / event damage)
  if (player.hp <= 0) {
    playerDied();
  }

  // 12. Decrement trap status counters
  if (player._slowTurns && player._slowTurns > 0) {
    player._slowTurns--;
    if (player._slowTurns <= 0) {
      delete player._slowTurns;
      addLog('迟缓效果解除', 'info');
    }
  }
  if (player._invertTurns && player._invertTurns > 0) {
    player._invertTurns--;
    if (player._invertTurns <= 0) {
      delete player._invertTurns;
      addLog('幻觉消散，方向恢复正常', 'info');
    }
  }

  // 13. Re-render player panel (HP bar, stats) after any hp/gold change
  renderPlayerPanel();
}

/** Proceed to next floor (called from floor break). */
function proceedToNextFloor() {
  if (typeof nextFloor === 'function') nextFloor();
}

/** Advance to the next dungeon floor. */
function nextFloor() {
  if (dungeon.floor >= MAX_FLOORS) {
    // Victory!
    if (permanent) onVictory(permanent);
    showVictoryScreen();
    return;
  }

  // Collect floor completion reward before advancing
  if (typeof collectFloorReward === 'function') {
    collectFloorReward(dungeon.floor);
  }

  var nextFloorNum = dungeon.floor + 1;
  gameState.floor = nextFloorNum;
  gameState.eventsThisFloor = 0;
  gameState.shrinesUsedThisFloor = {};

  var theme = FLOOR_THEMES[nextFloorNum - 1];

  // Show floor banner
  var overlay = document.getElementById('floor-overlay');
  if (overlay) {
    overlay.innerHTML =
      '<div class="floor-banner"><h2>第 ' + nextFloorNum + ' 层</h2><p>' + theme.name + '</p></div>';
    overlay.style.display = 'flex';
  }

  setTimeout(function () {
    if (overlay) { overlay.innerHTML = ''; overlay.style.display = 'none'; }
    dungeon = generateFloor(nextFloorNum);
    player.x = dungeon.playerStart.x;
    player.y = dungeon.playerStart.y;
    player.state = 'idle';
    if (player._walkTimer) { clearTimeout(player._walkTimer); player._walkTimer = null; }
    var envLabel = dungeon.theme.envBuff ? '(' + dungeon.theme.envBuff.desc + ')' : '';
    addLog('进入 ' + theme.name + ' ' + envLabel, 'info');

    // Apply dungeon layer theme override for this floor
    if (window.themeManager) window.themeManager.applyLayerOverride(dungeon.floor);

    // Track floor progress
    if (permanent) {
      trackProgress(permanent, 'floor', nextFloorNum);
      checkBuffUnlocks(permanent);
    }

    // Theme unlock check
    if (typeof checkThemeUnlocks === 'function') checkThemeUnlocks(nextFloorNum);

    // Theme progress: deepest floor
    if (typeof trackThemeProgress === 'function') trackThemeProgress('deepestFloor', nextFloorNum);

    // Save progress on floor transition
    saveGame();

    // Show buff selection AFTER any unlock modal (checkBuffUnlocks uses setTimeout 300ms).
    // Delay 500ms so showBuffSelection is the final modal shown, not overwritten.
    setTimeout(function () {
      showBuffSelection(nextFloorNum);
      gameState.paused = false;
    }, 500);
  }, 1200);
}

/** Use a consumable item from inventory. */
function useItem(itemId) {
  if (!player.inventory[itemId] || player.inventory[itemId] <= 0) return;

  var itemData = ITEMS_DATA[itemId];
  if (!itemData) return;

  player.inventory[itemId]--;
  if (player.inventory[itemId] <= 0) delete player.inventory[itemId];

  if (itemData.effect === 'heal') {
    player.hp = Math.min(player.maxHp, player.hp + itemData.value);
    addLog('使用' + itemData.name + '，恢复' + itemData.value + 'HP', 'heal');
    playSound('heal');
  } else if (itemData.effect === 'restore_mp') {
    player.mp = Math.min(player.maxMp, player.mp + itemData.value);
    addLog('使用' + itemData.name + '，恢复' + itemData.value + 'MP', 'heal');
    playSound('heal');
  } else if (itemData.effect === 'full_restore') {
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.statuses = [];
    addLog('使用' + itemData.name + '，完全恢复！', 'heal');
    playSound('heal');
  } else if (itemData.effect === 'cure_poison') {
    var newStatuses = [];
    for (var i = 0; i < player.statuses.length; i++) {
      if (player.statuses[i].id !== 'poison') newStatuses.push(player.statuses[i]);
    }
    player.statuses = newStatuses;
    addLog('使用' + itemData.name + '，解除中毒', 'heal');
    playSound('heal');
  } else if (itemData.effect === 'identify') {
    if (typeof findFirstUnidentified === 'function' && typeof identifyEquipment === 'function') {
      var eq = findFirstUnidentified();
      if (eq) {
        identifyEquipment(eq);
        addLog('使用' + itemData.name + '，鉴定了 ' + eq.icon + ' ' + eq.name, 'loot');
      } else {
        addLog('没有需要鉴定的装备', 'info');
      }
    }
    playSound('pickup');
  } else if (itemData.effect === 'teleport') {
    var revealedPos = [];
    for (var ry = 0; ry < MAP_H; ry++) {
      for (var rx = 0; rx < MAP_W; rx++) {
        if (dungeon.revealed[ry][rx] && dungeon.grid[ry][rx] !== TILE.WALL) {
          if (!(rx === player.x && ry === player.y)) {
            revealedPos.push({ x: rx, y: ry });
          }
        }
      }
    }
    if (revealedPos.length > 0) {
      var dest = pick(revealedPos);
      player.x = dest.x;
      player.y = dest.y;
      player.state = 'walk';
      if (player._walkTimer) clearTimeout(player._walkTimer);
      player._walkTimer = setTimeout(function () { player.state = 'idle'; }, 300);
      addLog('使用' + itemData.name + '，传送到 (' + dest.x + ',' + dest.y + ')', 'info');
    } else {
      addLog('没有可传送的位置', 'info');
    }
    playSound('pickup');
  }
  renderPlayerPanel();
  saveGame();
}

/** Show the victory screen after clearing all floors. */
function showVictoryScreen() {
  gameState.screen = 'victory';
  showScreen('victory');
  renderVictoryScreen();
  addLog('恭喜你征服了地城！获得 3 灵魂碎片！', 'loot');
  playSound('levelUp');
  setTimeout(function () { playSound('levelUp'); }, 400);
}
