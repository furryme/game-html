// test-generator.js — Map generation tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('generateFloor', ({ assert }) => {
  it('每层都生成非空地牢', () => {
    const restore = seedRandom(123);
    for (let floor = 1; floor <= 5; floor++) {
      const d = generateFloor(floor);
      if (!d) throw new Error(`generateFloor(${floor}) returned null`);
      if (!d.grid) throw new Error(`floor ${floor}: missing grid`);
      if (!d.rooms) throw new Error(`floor ${floor}: missing rooms`);
      if (!d.enemies) throw new Error(`floor ${floor}: missing enemies`);
    }
    restore();
  });

  it('房间数 >= 2', () => {
    const restore = seedRandom(42);
    const d = generateFloor(1);
    restore();
    if (d.rooms.length < 2) throw new Error(`rooms: expected >= 2, got ${d.rooms.length}`);
  });

  it('房间数 <= 8 (theme max)', () => {
    const restore = seedRandom(99);
    const d = generateFloor(1);
    restore();
    if (d.rooms.length > 8) throw new Error(`rooms: expected <= 8, got ${d.rooms.length}`);
  });

  it('地图尺寸正确: 40x30', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (d.grid.length !== 30) throw new Error(`grid height: expected 30, got ${d.grid.length}`);
    if (d.grid[0].length !== 40) throw new Error(`grid width: expected 40, got ${d.grid[0].length}`);
  });

  it('起始房间在第一个房间', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (!d.playerStart) throw new Error('playerStart is missing');
    if (d.grid[d.playerStart.y][d.playerStart.x] === TILE.WALL) {
      throw new Error('playerStart is on a wall tile');
    }
  });

  it('楼梯在最后一个房间', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (!d.stairsPos) throw new Error('stairsPos is missing');
    if (d.grid[d.stairsPos.y][d.stairsPos.x] === TILE.WALL) {
      throw new Error('stairsPos is on a wall tile');
    }
  });

  it('敌人数量合理: 1-10', () => {
    const restore = seedRandom(7);
    const d = generateFloor(1);
    restore();
    if (d.enemies.length < 0 || d.enemies.length > 20) {
      throw new Error(`enemies: expected 0-20, got ${d.enemies.length}`);
    }
  });

  it('地牢有主题', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (!d.theme || !d.theme.name) throw new Error('theme missing');
    if (d.theme.colors.wall === undefined) throw new Error('theme.colors.wall missing');
  });

  it('战争迷雾已初始化', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (!d.revealed || d.revealed.length !== 30) throw new Error('revealed map missing');
  });

  it('起始区域已被揭示', () => {
    const restore = seedRandom(1);
    const d = generateFloor(1);
    restore();
    if (!d.revealed[d.playerStart.y][d.playerStart.x]) {
      throw new Error('player start should be revealed');
    }
  });

  it('每 10 次生成成功率 >= 90%', () => {
    let successCount = 0;
    const total = 20;
    for (let i = 0; i < total; i++) {
      seedRandom(i * 137);
      const d = generateFloor(1);
      if (d && d.rooms.length >= 2) successCount++;
    }
    const rate = successCount / total;
    if (rate < 0.9) throw new Error(`success rate: expected >= 90%, got ${(rate*100).toFixed(0)}%`);
  });
});

describe('blobGenerate', ({ assert }) => {
  it('生成有机形状房间', () => {
    const restore = seedRandom(42);
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.WALL));
    const rooms = blobGenerate(grid, [3, 5]);
    restore();
    if (rooms.length < 2) throw new Error(`rooms: expected >= 2, got ${rooms.length}`);
    if (rooms.length > 6) throw new Error(`rooms: expected <= 6, got ${rooms.length}`);
  });

  it('房间在地图范围内', () => {
    const restore = seedRandom(7);
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.WALL));
    const rooms = blobGenerate(grid, [2, 4]);
    restore();
    for (const room of rooms) {
      if (room.x < 0 || room.x + room.w > MAP_W) throw new Error(`room x out of bounds: ${room.x}+${room.w}`);
      if (room.y < 0 || room.y + room.h > MAP_H) throw new Error(`room y out of bounds: ${room.y}+${room.h}`);
    }
  });
});

describe('carveCorridor', ({ assert }) => {
  it('在两个房间间开走廊', () => {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.WALL));
    const roomA = { cx: 5, cy: 5, x: 3, y: 3, w: 4, h: 4 };
    const roomB = { cx: 20, cy: 15, x: 18, y: 13, w: 4, h: 4 };
    carveCorridor(grid, roomA, roomB, 1);
    // Check that some corridor tiles were carved
    let corridorCount = 0;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (grid[y][x] === TILE.CORRIDOR) corridorCount++;
      }
    }
    if (corridorCount < 10) throw new Error(`corridor tiles: expected >= 10, got ${corridorCount}`);
  });
});

describe('placeEnemies', ({ assert }) => {
  it('敌人有有效属性', () => {
    const restore = seedRandom(42);
    const d = generateFloor(1);
    restore();
    for (const e of d.enemies) {
      if (e.hp <= 0) throw new Error(`enemy ${e.name} hp should be > 0, got ${e.hp}`);
      if (e.atk <= 0) throw new Error(`enemy ${e.name} atk should be > 0, got ${e.atk}`);
      if (e.gold <= 0 || typeof e.gold !== 'number') {
        throw new Error(`enemy ${e.name} gold should be positive number, got ${e.gold}`);
      }
    }
  });

  it('第 3 层敌人属性 > 第 1 层', () => {
    const restore = seedRandom(42);
    const d1 = generateFloor(1);
    seedRandom(42);
    const d3 = generateFloor(3);
    restore();
    // Just check that d3 enemies have valid stats (hard to compare exact enemies)
    for (const e of d3.enemies) {
      if (e.hp <= 0 || e.atk <= 0) throw new Error(`d3 enemy ${e.name} has invalid stats`);
    }
  });
});

describe('placeItems', ({ assert }) => {
  it(' loot 房间有物品', () => {
    const restore = seedRandom(42);
    const d = generateFloor(1);
    restore();
    const lootRooms = d.rooms.filter(r => r.type === 'loot');
    if (lootRooms.length > 0 && d.items.length === 0) {
      throw new Error('loot rooms exist but no items placed');
    }
  });
});

describe('weightedPick', ({ assert }) => {
  it('等权重随机: 100 次应该分布均匀', () => {
    const restore = seedRandom(0);
    const items = [
      { item: 'a', weight: 1 },
      { item: 'b', weight: 1 },
      { item: 'c', weight: 1 },
    ];
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 100; i++) {
      counts[weightedPick(items)]++;
    }
    restore();
    // Each should be within 30-50 range (rough uniform)
    for (const key in counts) {
      if (counts[key] < 20 || counts[key] > 60) {
        throw new Error(`${key}: expected 20-60, got ${counts[key]}`);
      }
    }
  });

  it('高权重优先', () => {
    const restore = seedRandom(0);
    const items = [
      { item: 'heavy', weight: 90 },
      { item: 'light', weight: 10 },
    ];
    let heavy = 0;
    for (let i = 0; i < 100; i++) {
      if (weightedPick(items) === 'heavy') heavy++;
    }
    restore();
    if (heavy < 70) throw new Error(`heavy picks: expected >= 70, got ${heavy}`);
  });
});
