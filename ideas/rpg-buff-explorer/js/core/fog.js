// fog.js — Fog of war and line-of-sight

/** Create an empty revealed map (all false). */
function createRevealedMap() {
  return Array.from({ length: MAP_H }, function () {
    return Array(MAP_W).fill(false);
  });
}

/**
 * Cast rays in all directions from a point, marking tiles as revealed.
 * @param {number[][]} grid
 * @param {number} px — player tile x
 * @param {number} py — player tile y
 * @param {number} radius — visibility radius in tiles
 * @param {boolean[][]} revealed — mutable revealed map to update
 */
function revealLineOfSight(grid, px, py, radius, revealed) {
  for (var angle = 0; angle < 360; angle += 2) {
    var rad = angle * Math.PI / 180;
    var dx = Math.cos(rad);
    var dy = Math.sin(rad);
    var x = px + 0.5;
    var y = py + 0.5;

    for (var step = 0; step < radius; step++) {
      var tx = Math.floor(x);
      var ty = Math.floor(y);
      if (!inBounds(tx, ty)) break;
      revealed[ty][tx] = true;
      if (grid[ty][tx] === TILE.WALL && Math.random() > 0.3) break;
      x += dx * 0.5;
      y += dy * 0.5;
    }
  }
}

/**
 * Get set of currently visible tile keys "x,y" from a point.
 * @param {number} px
 * @param {number} py
 * @param {number[][]} grid
 * @param {number} radius
 * @returns {Set}
 */
function getCurrentVisible(px, py, grid, radius) {
  var visible = new Set();
  for (var angle = 0; angle < 360; angle += 2) {
    var rad = angle * Math.PI / 180;
    var dx = Math.cos(rad);
    var dy = Math.sin(rad);
    var x = px + 0.5;
    var y = py + 0.5;

    for (var step = 0; step < radius; step++) {
      var tx = Math.floor(x);
      var ty = Math.floor(y);
      if (!inBounds(tx, ty)) break;
      visible.add(tx + ',' + ty);
      if (grid[ty][tx] === TILE.WALL && Math.random() > 0.3) break;
      x += dx * 0.5;
      y += dy * 0.5;
    }
  }
  return visible;
}

/** Check if a tile has been previously revealed. */
function isRevealed(x, y, revealed) {
  if (!inBounds(x, y)) return false;
  return revealed[y][x];
}

/** Simple manhattan-based check if a tile is within line-of-sight. */
function isInSight(x, y, px, py, grid, radius) {
  return manhattan(x, y, px, py) <= radius;
}
