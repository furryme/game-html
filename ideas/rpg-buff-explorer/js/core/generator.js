// generator.js — Dungeon map generation

/**
 * Generate a complete floor map.
 * @param {number} floorNum
 * @returns {Object|null} dungeon map data
 */
function generateFloor(floorNum) {
  return generateFloorInner(floorNum, 0);
}

function generateFloorInner(floorNum, retry) {
  if (retry > 20) {
    console.log('[init] 地图生成失败，重试过多，floor=' + floorNum);
    return null;
  }
  const theme = FLOOR_THEMES[floorNum - 1];
  if (!theme) return null;

  // 1. Fill grid with walls
  const grid = Array.from({ length: MAP_H }, function () {
    return Array(MAP_W).fill(TILE.WALL);
  });

  // 2. Generate rooms via BLOB
  const rooms = blobGenerate(grid, theme.roomTarget);
  if (rooms.length < 2) {
    console.log('[init] 房间过少(' + rooms.length + ')，重试 floor=' + floorNum + ' retry=' + (retry+1));
    return generateFloorInner(floorNum, retry + 1);
  }

  // 3. Connect with MST corridors
  carveCorridors(grid, rooms, theme.corridorWidth);

  // 4. Add redundant corridors (20% chance per pair)
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      if (Math.random() < 0.2) {
        carveCorridor(grid, rooms[i], rooms[j], theme.corridorWidth);
      }
    }
  }

  // 5. Assign room types
  assignRoomTypes(rooms, floorNum);

  // 6. Place content
  const enemies = placeEnemies(rooms, grid, floorNum, theme);
  const items = placeItems(rooms, floorNum);
  const traps = placeTraps(rooms, grid, floorNum, theme);

  // 7. Set start/stairs
  const playerStart = { x: rooms[0].cx, y: rooms[0].cy };
  const lastRoom = rooms[rooms.length - 1];
  const stairsPos = { x: lastRoom.cx, y: lastRoom.cy };

  // 8. Place boss in last room on floor bosses
  if (floorNum >= 1) {
    const bossKey = floorNum === 1 ? 'moss_giant' : floorNum === 2 ? 'shadow_mage' : 'greed_king';
    const bossData = BOSS_DATA[bossKey];
    if (bossData) {
      enemies.push({
        x: lastRoom.cx,
        y: lastRoom.cy,
        name: bossData.name,
        icon: bossData.icon,
        hp: bossData.hp,
        maxHp: bossData.hp,
        atk: bossData.atk,
        def: bossData.def,
        spd: bossData.spd,
        exp: bossData.exp,
        gold: Array.isArray(bossData.gold) ? rng(bossData.gold[0], bossData.gold[1]) : bossData.gold,
        boss: true,
        rules: bossData.rules,
        actions: [
          { type: 'attack', weight: 50, label: '攻击' },
          { type: 'attack', weight: 30, label: '重击', mult: 1.5 },
          { type: 'defend', weight: 20, label: '防御' },
        ],
      });
      lastRoom.type = 'boss';
    }
  }

  // 9. Init fog
  const revealed = createRevealedMap();

  const result = {
    grid: grid,
    rooms: rooms,
    enemies: enemies,
    items: items,
    traps: traps,
    playerStart: playerStart,
    stairsPos: stairsPos,
    theme: theme,
    revealed: revealed,
    visibility: theme.visibility,
    floor: floorNum,
  };

  // Reveal start area
  revealLineOfSight(grid, playerStart.x, playerStart.y, theme.visibility, revealed);

  return result;
}

/**
 * BLOB room generation: scatter seeds, inflate each.
 * @param {number[][]} grid
 * @param {number[]} roomTarget — [min, max]
 * @returns {Array<Object>} rooms with AABB
 */
function blobGenerate(grid, roomTarget) {
  var minRooms = roomTarget[0];
  var maxRooms = roomTarget[1];
  var targetCount = rng(minRooms, maxRooms);
  var seeds = [];

  // Scatter seeds
  for (var attempt = 0; attempt < 200 && seeds.length < targetCount; attempt++) {
    var sx = rng(3, MAP_W - 4);
    var sy = rng(3, MAP_H - 4);
    var tooClose = false;
    for (var si = 0; si < seeds.length; si++) {
      if (manhattan(sx, sy, seeds[si].x, seeds[si].y) < 4) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    seeds.push({ x: sx, y: sy, cells: [{ x: sx, y: sy }], frontier: [{ x: sx, y: sy }] });
  }

  // Inflate each seed
  var rooms = [];
  for (var si = 0; si < seeds.length; si++) {
    var seed = seeds[si];
    // Mark seed center
    grid[seed.y][seed.x] = TILE.FLOOR;
    var growTimes = rng(2, 4);
    for (var pass = 0; pass < growTimes && pass < 6; pass++) {
      var newFrontier = [];
      var frontier = shuffle(seed.frontier.slice());
      for (var fi = 0; fi < frontier.length; fi++) {
        var f = frontier[fi];
        var dirs = shuffle([[0, 1], [0, -1], [1, 0], [-1, 0]]);
        for (var di = 0; di < dirs.length; di++) {
          var nx = f.x + dirs[di][0];
          var ny = f.y + dirs[di][1];
          if (inBounds(nx, ny) && grid[ny][nx] === TILE.WALL) {
            grid[ny][nx] = TILE.FLOOR;
            seed.cells.push({ x: nx, y: ny });
            newFrontier.push({ x: nx, y: ny });
          }
        }
      }
      seed.frontier = newFrontier;
      if (newFrontier.length === 0) break;
    }

    // Extract AABB
    var minX = MAP_W, minY = MAP_H, maxX = 0, maxY = 0;
    for (var ci = 0; ci < seed.cells.length; ci++) {
      var c = seed.cells[ci];
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    rooms.push({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      cx: Math.floor((minX + maxX) / 2),
      cy: Math.floor((minY + maxY) / 2),
      type: 'empty',
    });
  }

  return rooms;
}

/** Connect all rooms via MST using union-find. */
function carveCorridors(grid, rooms, width) {
  var parent = [];
  for (var i = 0; i < rooms.length; i++) parent[i] = i;

  function find(i) {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(a, b) {
    a = find(a);
    b = find(b);
    if (a !== b) parent[a] = b;
  }

  // Generate all edges sorted by distance
  var edges = [];
  for (var i = 0; i < rooms.length; i++) {
    for (var j = i + 1; j < rooms.length; j++) {
      edges.push({
        a: i,
        b: j,
        dist: manhattan(rooms[i].cx, rooms[i].cy, rooms[j].cx, rooms[j].cy),
      });
    }
  }
  edges.sort(function (a, b) { return a.dist - b.dist; });

  for (var ei = 0; ei < edges.length; ei++) {
    var edge = edges[ei];
    if (find(edge.a) !== find(edge.b)) {
      union(edge.a, edge.b);
      carveCorridor(grid, rooms[edge.a], rooms[edge.b], width);
    }
  }
}

/** Carve an L-shaped corridor between two rooms. */
function carveCorridor(grid, roomA, roomB, width) {
  var x = roomA.cx;
  var y = roomA.cy;
  var horizontalFirst = Math.random() < 0.5;

  var carve = function (cx, cy) {
    if (inBounds(cx, cy)) {
      grid[cy][cx] = TILE.CORRIDOR;
      if (width >= 2 && inBounds(cx + 1, cy)) grid[cy][cx + 1] = TILE.CORRIDOR;
      if (width >= 2 && inBounds(cx, cy + 1)) grid[cy + 1][cx] = TILE.CORRIDOR;
    }
  };

  if (horizontalFirst) {
    while (x !== roomB.cx) {
      carve(x, y);
      x += x < roomB.cx ? 1 : -1;
    }
    while (y !== roomB.cy) {
      carve(x, y);
      y += y < roomB.cy ? 1 : -1;
    }
  } else {
    while (y !== roomB.cy) {
      carve(x, y);
      y += y < roomB.cy ? 1 : -1;
    }
    while (x !== roomB.cx) {
      carve(x, y);
      x += x < roomB.cx ? 1 : -1;
    }
  }
  carve(x, y);
}

/** Assign room types (combat, loot, trap, resting, shrine, empty). */
function assignRoomTypes(rooms, floorNum) {
  rooms[0].type = 'empty';
  rooms[rooms.length - 1].type = 'combat';

  var middle = rooms.slice(1, -1);
  shuffle(middle);

  // Ensure at least 1 loot room
  if (middle.length > 0) middle[0].type = 'loot';

  for (var i = 1; i < middle.length; i++) {
    var roll = Math.random() * 100;
    if (roll < 45) middle[i].type = 'combat';
    else if (roll < 60) middle[i].type = 'loot';
    else if (roll < 72) middle[i].type = 'trap';
    else if (roll < 82) middle[i].type = 'resting';
    else if (roll < 90) middle[i].type = 'shrine';
    else middle[i].type = 'empty';
  }
}

/** Place enemies in combat rooms. */
function placeEnemies(rooms, grid, floorNum, theme) {
  var enemies = [];
  var floorScale = floorNum - 1;

  for (var ri = 0; ri < rooms.length; ri++) {
    var room = rooms[ri];
    if (room.type !== 'combat') continue;
    // Skip boss room (handled separately)
    if (ri === rooms.length - 1) continue;

    var count = rng(1, 2);
    for (var ei = 0; ei < count; ei++) {
      var key = pick(theme.enemyPool);
      var data = ENEMY_DATA[key];
      if (!data) continue;

      // Find a valid floor position in this room
      var ex, ey, attempts = 0;
      do {
        ex = rng(room.x + 1, room.x + room.w - 2);
        ey = rng(room.y + 1, room.y + room.h - 2);
        attempts++;
      } while (inBounds(ex, ey) && grid[ey][ex] === TILE.WALL && attempts < 20);

      if (!inBounds(ex, ey) || grid[ey][ex] === TILE.WALL) continue;

      enemies.push({
        x: ex,
        y: ey,
        name: data.name,
        icon: data.icon,
        hp: Math.floor(data.hp * (1 + 0.2 * floorScale)),
        maxHp: Math.floor(data.hp * (1 + 0.2 * floorScale)),
        atk: Math.floor(data.atk * (1 + 0.25 * floorScale)),
        def: Math.floor(data.def * (1 + 0.15 * floorScale)),
        spd: data.spd,
        exp: Math.floor(data.exp * (1 + 0.5 * floorScale)),
        gold: Array.isArray(data.gold) ? rng(data.gold[0], data.gold[1]) : data.gold,
        actions: data.actions,
        boss: false,
      });
    }
  }

  return enemies;
}

/** Place items in loot/resting rooms. */
function placeItems(rooms, floorNum) {
  var items = [];

  for (var i = 0; i < rooms.length; i++) {
    var room = rooms[i];
    if (room.type === 'loot') {
      var pos = { x: room.cx, y: room.cy };
      if (Math.random() < 0.5) {
        items.push({
          x: pos.x,
          y: pos.y,
          type: 'gold',
          amount: rng(10, 25 + floorNum * 5),
        });
      } else {
        items.push({ x: pos.x, y: pos.y, type: 'hp_potion' });
      }
    } else if (room.type === 'resting') {
      items.push({ x: room.cx, y: room.cy, type: 'resting' });
    } else if (room.type === 'combat' && Math.random() < 0.3) {
      items.push({ x: room.cx + 1, y: room.cy, type: 'hp_potion' });
    }
  }

  return items;
}

/** Place traps in trap rooms. */
function placeTraps(rooms, grid, floorNum, theme) {
  if (theme.trapChance <= 0) return [];

  var traps = [];
  var trapKeys = Object.keys(TRAP_TYPES);

  for (var ri = 0; ri < rooms.length; ri++) {
    var room = rooms[ri];
    if (room.type !== 'trap') continue;

    var count = rng(1, 3);
    for (var ti = 0; ti < count; ti++) {
      var tx = rng(room.x + 1, room.x + room.w - 2);
      var ty = rng(room.y + 1, room.y + room.h - 2);
      if (inBounds(tx, ty) && grid[ty][tx] !== TILE.WALL) {
        var trapKey = pick(trapKeys);
        var trapData = TRAP_TYPES[trapKey];
        traps.push({
          x: tx,
          y: ty,
          type: trapKey,
          triggered: false,
          revealed: Math.random() < 0.4,
          damage: (trapData.value || 10) + floorNum * 3,
          label: trapData.name,
          icon: trapData.icon,
          effect: trapData.effect,
          val: trapData.value || 10,
          detectChance: trapData.detectChance || 0.3,
        });
      }
    }
  }

  return traps;
}
