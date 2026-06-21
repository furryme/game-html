// test-fog.js — Fog of War + FOV tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('createRevealedMap', ({ assert }) => {
  it('创建 MAP_W x MAP_H 的 false 矩阵', () => {
    const map = createRevealedMap();
    if (map.length !== MAP_H) throw new Error(`height: expected ${MAP_H}, got ${map.length}`);
    if (map[0].length !== MAP_W) throw new Error(`width: expected ${MAP_W}, got ${map[0].length}`);
  });

  it('全部为 false', () => {
    const map = createRevealedMap();
    let anyTrue = false;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (map[y][x]) anyTrue = true;
    if (anyTrue) throw new Error('all should be false');
  });
});

describe('revealLineOfSight', ({ assert }) => {
  it('揭示玩家周围区域', () => {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.FLOOR));
    const revealed = createRevealedMap();
    revealLineOfSight(grid, 10, 10, 8, revealed);

    let count = 0;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        if (revealed[y][x]) count++;
    if (count < 20) throw new Error(`revealed: expected >= 20, got ${count}`);
    if (count > 300) throw new Error(`revealed: expected <= 300, got ${count}`);
  });

  it('玩家位置一定被揭示', () => {
    const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.FLOOR));
    const revealed = createRevealedMap();
    revealLineOfSight(grid, 10, 10, 8, revealed);
    if (!revealed[10][10]) throw new Error('player position should be revealed');
  });
});

describe('isRevealed', ({ assert }) => {
  it('已揭示的格返回 true', () => {
    const map = createRevealedMap();
    map[5][5] = true;
    if (!isRevealed(5, 5, map)) throw new Error('expected true');
  });

  it('未揭示的格返回 false', () => {
    const map = createRevealedMap();
    if (isRevealed(5, 5, map)) throw new Error('expected false');
  });
});
