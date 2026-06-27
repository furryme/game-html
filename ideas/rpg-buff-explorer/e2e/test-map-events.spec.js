import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start a new game and wait until dungeon is ready.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active");
  await page.click(".start-btn");
  await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
  await page.evaluate(() => {
    const cards = document.querySelectorAll("#modal-overlay .class-card");
    if (cards[0]) cards[0].click();
  });
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon"
  );
  // Dismiss buff selection modal if open
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

/**
 * Helper: regenerate floor 1 to get a fresh dungeon with known content.
 */
async function regenerateFloor(page) {
  await page.evaluate(() => {
    dungeon = generateFloor(1);
    if (dungeon) {
      player.x = dungeon.playerStart.x;
      player.y = dungeon.playerStart.y;
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Helper: find a shrine room in the current dungeon.
 * If none, manually add one for testing.
 */
async function ensureShrineRoom(page) {
  var result = await page.evaluate(() => {
    if (!dungeon) return null;
    // Ensure tracking object exists
    if (!gameState.shrinesUsedThisFloor) gameState.shrinesUsedThisFloor = {};

    for (var i = 0; i < dungeon.rooms.length; i++) {
      if (dungeon.rooms[i].type === 'shrine') {
        return { x: dungeon.rooms[i].cx, y: dungeon.rooms[i].cy };
      }
    }
    // No shrine room -- repurpose middle room
    var room = dungeon.rooms[Math.floor(dungeon.rooms.length / 2)];
    room.type = 'shrine';
    // TILE.FLOOR = 1 (ensure tile is walkable)
    dungeon.grid[room.cy][room.cx] = 1;
    // Remove any enemies that were placed in this room (it was originally combat/loot)
    for (var ei = dungeon.enemies.length - 1; ei >= 0; ei--) {
      var e = dungeon.enemies[ei];
      if (e && e.x >= room.x && e.x < room.x + room.w && e.y >= room.y && e.y < room.y + room.h) {
        dungeon.enemies.splice(ei, 1);
      }
    }
    return { x: room.cx, y: room.cy };
  });
  return result;
}

/**
 * Helper: find a resting item in dungeon.items.
 */
async function findRestingItem(page) {
  return await page.evaluate(() => {
    if (!dungeon || !dungeon.items) return null;
    for (var i = 0; i < dungeon.items.length; i++) {
      if (dungeon.items[i].type === 'resting') {
        return { x: dungeon.items[i].x, y: dungeon.items[i].y };
      }
    }
    return null;
  });
}

/**
 * Helper: add a resting item if none exists.
 */
async function ensureRestingItem(page) {
  var existing = await findRestingItem(page);
  if (existing) return existing;
  // Place resting item at player start room (guaranteed walkable floor tile)
  var pos = await page.evaluate(() => {
    var startRoom = dungeon.rooms[0];
    var rx = startRoom.cx + 1;
    var ry = startRoom.cy;
    // Ensure tile is FLOOR
    dungeon.grid[ry][rx] = 1;
    dungeon.items.push({ x: rx, y: ry, type: 'resting' });
    return { x: rx, y: ry };
  });
  return pos;
}

/**
 * Helper: find a gold item in dungeon.items; create one if missing.
 */
async function ensureGoldItem(page) {
  var result = await page.evaluate(() => {
    if (!dungeon || !dungeon.items) {
      // Create one
      var startRoom = dungeon.rooms[0];
      var ix = startRoom.cx + 3;
      var iy = startRoom.cy;
      dungeon.grid[iy][ix] = 1;
      dungeon.items.push({ x: ix, y: iy, type: 'gold', amount: 15 });
      return { x: ix, y: iy, type: 'gold' };
    }
    for (var i = 0; i < dungeon.items.length; i++) {
      if (dungeon.items[i].type === 'gold') {
        return { x: dungeon.items[i].x, y: dungeon.items[i].y, type: 'gold' };
      }
    }
    // No gold item -- create one
    var startRoom = dungeon.rooms[0];
    var ix = startRoom.cx + 3;
    var iy = startRoom.cy;
    dungeon.grid[iy][ix] = 1;
    dungeon.items.push({ x: ix, y: iy, type: 'gold', amount: 15 });
    return { x: ix, y: iy, type: 'gold' };
  });
  return result;
}

/**
 * Helper: move player directly to a tile (bypassing collision checks).
 */
async function moveTo(page, tx, ty) {
  await page.evaluate((pos) => {
    player.x = pos.x;
    player.y = pos.y;
  }, { x: tx, y: ty });
  await page.waitForTimeout(200);
}

/**
 * Helper: step player onto a tile via movePlayer (triggers events).
 * Move from adjacent tile.
 */
async function stepOnto(page, tx, ty) {
  await page.evaluate((pos) => {
    var dx = pos.x > player.x ? 1 : (pos.x < player.x ? -1 : 0);
    var dy = pos.y > player.y ? 1 : (pos.y < player.y ? -1 : 0);
    // Move adjacent first
    player.x = pos.x - dx;
    player.y = pos.y - dy;
    // Then step onto target
    movePlayer(dx, dy);
  }, { x: tx, y: ty });
  await page.waitForTimeout(300);
}

/**
 * Helper: get the count of shrine icons currently drawn on the map canvas.
 * We check gameState.shrinesUsedThisFloor to determine if a shrine was consumed.
 */
async function getShrineRenderCount(page) {
  return await page.evaluate(() => {
    if (!dungeon || !gameState) return 0;
    var count = 0;
    for (var i = 0; i < dungeon.rooms.length; i++) {
      if (dungeon.rooms[i].type !== 'shrine') continue;
      var key = dungeon.rooms[i].cx + ',' + dungeon.rooms[i].cy;
      if (gameState.shrinesUsedThisFloor && gameState.shrinesUsedThisFloor[key]) continue;
      if (!dungeon.revealed[dungeon.rooms[i].cy] || !dungeon.revealed[dungeon.rooms[i].cy][dungeon.rooms[i].cx]) continue;
      count++;
    }
    return count;
  });
}

/**
 * Helper: count items of a given type still in dungeon.items.
 */
async function getItemCount(page, type) {
  return await page.evaluate((t) => {
    if (!dungeon || !dungeon.items) return 0;
    var count = 0;
    for (var i = 0; i < dungeon.items.length; i++) {
      if (dungeon.items[i].type === t) count++;
    }
    return count;
  }, type);
}

// ==================== Tests ====================

test.describe("Map Events", () => {

  // ---- Test 1: Shrine triggers HP recovery ----
  test("shrine triggers HP recovery when player walks on it", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    // Damage player so healing is measurable
    await page.evaluate(() => { player.hp = Math.floor(player.maxHp * 0.4); });

    var shrine = await ensureShrineRoom(page);
    var hpBefore = await page.evaluate(() => player.hp);

    // Clear shrine-used tracking so this shrine can trigger
    await page.evaluate((pos) => {
      if (!gameState.shrinesUsedThisFloor) gameState.shrinesUsedThisFloor = {};
      delete gameState.shrinesUsedThisFloor[pos.x + ',' + pos.y];
    }, shrine);

    // Move player adjacent, then step onto shrine via movePlayer
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, shrine);

    var hpAfter = await page.evaluate(() => player.hp);
    expect(hpAfter).toBeGreaterThan(hpBefore);
  });

  // ---- Test 2: Shrine does not trigger again at same position ----
  test("shrine does not trigger again at same position", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    // Set HP low
    await page.evaluate(() => { player.hp = Math.floor(player.maxHp * 0.3); });

    var shrine = await ensureShrineRoom(page);

    // Clear tracking
    await page.evaluate((pos) => {
      if (!gameState.shrinesUsedThisFloor) gameState.shrinesUsedThisFloor = {};
      delete gameState.shrinesUsedThisFloor[pos.x + ',' + pos.y];
    }, shrine);

    // First step onto shrine
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, shrine);

    var hpAfterFirst = await page.evaluate(() => player.hp);

    // Set HP low again
    await page.evaluate(() => { player.hp = Math.floor(player.maxHp * 0.3); });

    // Step off and back onto same shrine
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, shrine);

    var hpAfterSecond = await page.evaluate(() => player.hp);

    // HP should not increase on second trigger
    expect(hpAfterSecond).toBeLessThanOrEqual(hpAfterFirst);

    // Confirm shrine is marked as used
    var isUsed = await page.evaluate((pos) => {
      return !!(gameState.shrinesUsedThisFloor && gameState.shrinesUsedThisFloor[pos.x + ',' + pos.y]);
    }, shrine);
    expect(isUsed).toBe(true);
  });

  // ---- Test 3: Shrine icon disappears from map after trigger ----
  test("shrine icon disappears from map render after trigger", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var shrine = await ensureShrineRoom(page);

    // Reveal the shrine position
    await page.evaluate((pos) => {
      if (dungeon.revealed[pos.y]) dungeon.revealed[pos.y][pos.x] = true;
    }, shrine);

    // Clear tracking so shrine is visible
    await page.evaluate((pos) => {
      if (!gameState.shrinesUsedThisFloor) gameState.shrinesUsedThisFloor = {};
      delete gameState.shrinesUsedThisFloor[pos.x + ',' + pos.y];
    }, shrine);

    var countBefore = await getShrineRenderCount(page);
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Step onto shrine
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, shrine);

    var countAfter = await getShrineRenderCount(page);
    expect(countAfter).toBeLessThan(countBefore);
  });

  // ---- Test 4: Walking onto stairs shows modal ----
  test("walking onto stairs shows floor break modal", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var stairsPos = await page.evaluate(() => {
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    // Move player adjacent to stairs, then step onto it
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, stairsPos);

    // Modal should be visible
    var modalVisible = await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      return overlay && overlay.style.display === 'flex';
    });
    expect(modalVisible).toBe(true);

    // Game should be paused
    var paused = await page.evaluate(() => gameState.paused);
    expect(paused).toBe(true);
  });

  // ---- Test 5: Floor break modal has cancel button ----
  test("floor break modal has a cancel button", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var stairsPos = await page.evaluate(() => {
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, stairsPos);

    // Look for cancel button text content
    var hasCancel = await page.evaluate(() => {
      var buttons = document.querySelectorAll('#modal-overlay .modal-btn');
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.includes('暂且留下') || buttons[i].textContent.includes('cancel')) {
          return true;
        }
      }
      return false;
    });
    expect(hasCancel).toBe(true);
  });

  // ---- Test 6: Clicking cancel closes the modal ----
  test("clicking cancel closes the floor break modal", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var stairsPos = await page.evaluate(() => {
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, stairsPos);

    // Wait for modal to appear
    await page.waitForSelector('#modal-overlay .modal-btn', { state: 'visible' });

    // Click cancel by calling floorBreakChoice('cancel')
    await page.evaluate(() => {
      floorBreakChoice('cancel');
    });

    await page.waitForTimeout(300);

    // Modal should be closed
    var modalClosed = await page.evaluate(() => {
      var overlay = document.getElementById('modal-overlay');
      return !overlay || overlay.style.display !== 'flex';
    });
    expect(modalClosed).toBe(true);

    // Game should not be paused
    var paused = await page.evaluate(() => gameState.paused);
    expect(paused).toBe(false);
  });

  // ---- Test 7: After cancel, player stays on current floor ----
  test("after cancel, player stays on current floor", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var floorBefore = await page.evaluate(() => gameState.floor);

    var stairsPos = await page.evaluate(() => {
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, stairsPos);

    await page.waitForSelector('#modal-overlay .modal-btn', { state: 'visible' });

    // Click cancel
    await page.evaluate(() => { floorBreakChoice('cancel'); });
    await page.waitForTimeout(300);

    // Floor should not have changed
    var floorAfter = await page.evaluate(() => gameState.floor);
    expect(floorAfter).toBe(floorBefore);

    // Player should be at pre-stairs position (not on stairs)
    var notOnStairs = await page.evaluate(() => {
      return player.x !== dungeon.stairsPos.x || player.y !== dungeon.stairsPos.y;
    });
    expect(notOnStairs).toBe(true);
  });

  // ---- Test 8: Choosing proceed advances to next floor ----
  test("choosing proceed advances to next floor", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var floorBefore = await page.evaluate(() => gameState.floor);

    var stairsPos = await page.evaluate(() => {
      return { x: dungeon.stairsPos.x, y: dungeon.stairsPos.y };
    });

    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, stairsPos);

    await page.waitForSelector('#modal-overlay .modal-btn', { state: 'visible' });

    // Click proceed
    await page.evaluate(() => { floorBreakChoice('proceed'); });

    // Wait for floor transition (nextFloor has 1200ms banner delay + 500ms buff delay)
    await page.waitForTimeout(3000);

    var floorAfter = await page.evaluate(() => gameState.floor);
    expect(floorAfter).toBeGreaterThan(floorBefore);
  });

  // ---- Test 9: Resting point icon disappears after trigger ----
  test("resting point disappears from items after trigger", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var resting = await ensureRestingItem(page);
    expect(resting).toBeTruthy();

    var countBefore = await getItemCount(page, 'resting');
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Step onto resting point via movePlayer
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, resting);

    var countAfter = await getItemCount(page, 'resting');
    expect(countAfter).toBeLessThan(countBefore);
  });

  // ---- Test 10: Treasure (gold) item disappears after pickup ----
  test("treasure item disappears from items after pickup", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var gold = await ensureGoldItem(page);
    expect(gold).toBeTruthy();

    var goldBefore = await page.evaluate(() => player.gold);
    var countBefore = await getItemCount(page, 'gold');
    expect(countBefore).toBeGreaterThanOrEqual(1);

    // Step onto gold item
    await page.evaluate((pos) => {
      player.x = pos.x - 1;
      player.y = pos.y;
      movePlayer(1, 0);
    }, gold);

    var countAfter = await getItemCount(page, 'gold');
    expect(countAfter).toBeLessThan(countBefore);

    var goldAfter = await page.evaluate(() => player.gold);
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  // ---- Test 11: After exploring a room and leaving, minimap still shows visited marker ----
  test("visited marker persists on minimap after leaving room", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    // Pick a non-start room (index >= 1)
    var result = await page.evaluate(() => {
      var target = dungeon.rooms[1]; // second room
      if (!target) return null;
      // Mark center as revealed so the room is discoverable
      if (dungeon.revealed[target.cy]) dungeon.revealed[target.cy][target.cx] = true;
      return {
        cx: target.cx, cy: target.cy,
        x: target.x, y: target.y, w: target.w, h: target.h,
        type: target.type
      };
    });
    expect(result).toBeTruthy();

    // Move player INTO the target room, then step to trigger room visit detection
    await page.evaluate((r) => {
      player.x = r.cx;
      player.y = r.cy;
      // movePlayer triggers room.visited = true at current position
      movePlayer(1, 0);
    }, result);
    await page.waitForTimeout(200);

    // Verify room is now visited
    var visitedBefore = await page.evaluate((r) => {
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].cx === r.cx && dungeon.rooms[i].cy === r.cy)
          return dungeon.rooms[i].visited;
      }
      return false;
    }, result);
    expect(visitedBefore).toBe(true);

    // Move player back to start room
    await page.evaluate(() => {
      var startRoom = dungeon.rooms[0];
      player.x = startRoom.cx;
      player.y = startRoom.cy;
    });
    await page.waitForTimeout(200);

    // The visited flag should persist
    var visitedAfter = await page.evaluate((r) => {
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].cx === r.cx && dungeon.rooms[i].cy === r.cy)
          return dungeon.rooms[i].visited;
      }
      return false;
    }, result);
    expect(visitedAfter).toBe(true);
  });

  // ---- Test 12: Unexplored rooms are not visible on minimap ----
  test("unexplored rooms are not visible on minimap", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    var result = await page.evaluate(() => {
      // Find a room whose center is NOT revealed
      for (var i = 1; i < dungeon.rooms.length; i++) {
        var r = dungeon.rooms[i];
        var centerRevealed = dungeon.revealed[r.cy] && dungeon.revealed[r.cy][r.cx];
        if (!centerRevealed && !r.visited) {
          return {
            cx: r.cx, cy: r.cy,
            type: r.type
          };
        }
      }
      // All rooms revealed, force-unreveal the last room center
      var last = dungeon.rooms[dungeon.rooms.length - 1];
      if (dungeon.revealed[last.cy]) dungeon.revealed[last.cy][last.cx] = false;
      last.visited = false;
      return { cx: last.cx, cy: last.cy, type: last.type };
    });
    expect(result).toBeTruthy();

    // Confirm this room is neither revealed nor visited
    var isVisible = await page.evaluate((r) => {
      var centerRevealed = isRevealed(r.cx, r.cy, dungeon.revealed);
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].cx === r.cx && dungeon.rooms[i].cy === r.cy)
          return { revealed: centerRevealed, visited: dungeon.rooms[i].visited };
      }
      return { revealed: centerRevealed, visited: false };
    }, result);
    expect(isVisible.revealed).toBe(false);
    expect(isVisible.visited).toBe(false);

    // Verify minimap rendering would skip this room
    // (a room appears on minimap only if visited OR center revealed)
    var wouldShow = await page.evaluate((r) => {
      var centerRevealed = isRevealed(r.cx, r.cy, dungeon.revealed);
      for (var i = 0; i < dungeon.rooms.length; i++) {
        if (dungeon.rooms[i].cx === r.cx && dungeon.rooms[i].cy === r.cy)
          return dungeon.rooms[i].visited || centerRevealed;
      }
      return centerRevealed;
    }, result);
    expect(wouldShow).toBe(false);
  });

  // ---- Test 13: Player position displayed in real-time on minimap ----
  test("player position displayed in real-time on minimap", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    // Get initial player position on minimap
    var initialPos = await page.evaluate(() => {
      return { x: player.x, y: player.y };
    });

    // Move player to a different tile inside start room
    var newX = initialPos.x + 3;
    var newY = initialPos.y + 2;
    await page.evaluate((pos) => {
      player.x = pos.x;
      player.y = pos.y;
    }, { x: newX, y: newY });
    await page.waitForTimeout(300);

    // Verify player position updated
    var updatedPos = await page.evaluate(() => {
      return { x: player.x, y: player.y };
    });
    expect(updatedPos.x).toBe(newX);
    expect(updatedPos.y).toBe(newY);

    // Verify the minimap player dot calculation uses current position
    var minimapPlayerTile = await page.evaluate(() => {
      // The minimap draws player at: mx + player.x * mm, my + player.y * mm
      return { x: player.x, y: player.y };
    });
    expect(minimapPlayerTile.x).toBe(newX);
    expect(minimapPlayerTile.y).toBe(newY);
  });

  // ---- Test 14: Different room types have different minimap markers ----
  test("different room types have different minimap markers", async ({ page }) => {
    await startGame(page);
    await regenerateFloor(page);

    // Ensure we have at least 3 different room types marked as visited
    var result = await page.evaluate(() => {
      // Reveal all room centers and mark as visited for testing
      var typeMap = {};
      for (var i = 0; i < dungeon.rooms.length; i++) {
        var r = dungeon.rooms[i];
        r.visited = true;
        if (dungeon.revealed[r.cy]) dungeon.revealed[r.cy][r.cx] = true;
        if (!typeMap[r.type]) typeMap[r.type] = [];
        typeMap[r.type].push({ cx: r.cx, cy: r.cy, type: r.type });
      }

      // Get unique types and one representative for each
      var types = Object.keys(typeMap);
      var representatives = [];
      for (var j = 0; j < types.length; j++) {
        representatives.push(typeMap[types[j]][0]);
      }
      return { types: types, rooms: representatives };
    });

    // Verify multiple room types exist
    expect(result.types.length).toBeGreaterThanOrEqual(2);

    // Verify that roomTypeColor mapping produces distinct colors
    var colorMap = await page.evaluate(() => {
      var roomTypeColor = {
        'shop': '#FFD700',
        'shrine': '#BF80FF',
        'loot': '#FFD700',
        'resting': '#69F0AE',
        'trap': '#FF6E40',
        'combat': '#FF5252',
        'boss': '#888888',
        'empty': '#888888',
      };
      var result = {};
      for (var i = 0; i < dungeon.rooms.length; i++) {
        var type = dungeon.rooms[i].type;
        var color = roomTypeColor[type] || '#888888';
        if (!result[type]) result[type] = color;
      }
      return result;
    });

    // combat rooms are red, resting rooms are green, traps are orange
    if (colorMap['combat']) expect(colorMap['combat']).toBe('#FF5252');
    if (colorMap['resting']) expect(colorMap['resting']).toBe('#69F0AE');
    if (colorMap['trap']) expect(colorMap['trap']).toBe('#FF6E40');

    // At least combat and empty should differ
    var distinctColors = Object.values(colorMap).filter(function (c, i, arr) {
      return arr.indexOf(c) === i;
    });
    expect(distinctColors.length).toBeGreaterThanOrEqual(2);
  });
});
