// render.js — Canvas rendering with pixel dungeon aesthetic

let gameCanvas, gameCtx;
let cameraX = 0, cameraY = 0;

function initCanvas() {
  gameCanvas = document.getElementById('game-canvas');
  gameCtx = gameCanvas.getContext('2d');
  gameCanvas.width = CANVAS_W;
  gameCanvas.height = CANVAS_H;
}

var _lastScreen = '';
var _renderDebugCounter = 0;

function renderAll() {
  if (!gameCtx) return;
  if (!dungeon && gameState.screen === 'dungeon') return;

  spriteAnimStep();

  if (_lastScreen !== gameState.screen) {
    console.log('[render] screen changed: ' + _lastScreen + ' -> ' + gameState.screen);
    _lastScreen = gameState.screen;
    // Hide combat overlay when leaving combat screen
    if (_lastScreen !== 'combat') {
      var co = document.getElementById('combat-overlay');
      if (co) co.style.display = 'none';
    }
  }

  try {
    gameCtx.save();
    gameCtx.setTransform(1, 0, 0, 1, 0, 0);
    gameCtx.fillStyle = PAL.void;
    gameCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (gameState.screen === 'dungeon' || gameState.screen === 'game') {
      renderMap();
      renderMinimap();
    } else if (gameState.screen === 'combat') {
      renderCombat();
    }
  } catch (e) {
    console.log('[render] ERROR:', e.message, e.stack);
  }

  FX.update();
  FX.render(gameCtx);
  gameCtx.restore();

  _renderDebugCounter++;
  if (_renderDebugCounter % 60 === 0) {
    console.log('[render] alive, screen=' + gameState.screen + ' paused=' + gameState.paused + ' combat=', !!combatState);
  }
}

// =====================
// Helpers
// =====================

function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
}

function rgbToRbg(r, g, b) {
  return '#' + [r,g,b].map(function(c){
    var h = Math.max(0,Math.min(255,Math.round(c))).toString(16);
    return h.length < 2 ? '0'+h : h;
  }).join('');
}

function lighten(hex, amount) {
  var rgb = hexToRgb(hex);
  return rgbToRbg(rgb[0]+amount, rgb[1]+amount, rgb[2]+amount);
}

function darken(hex, amount) {
  return lighten(hex, -amount);
}

function tileHash(x, y) {
  var n = x * 374761393 + y * 668265263;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) & 0x7fffffff) / 0x7fffffff;
}

// =====================
// Autotile wall drawing
// =====================

function drawWallTile(ctx, sx, sy, rx, ry, theme) {
  var g = dungeon.grid;
  var wall = TILE.WALL;

  var topOpen = ry <= 0 || g[ry-1][rx] !== wall;
  var leftOpen = rx <= 0 || g[ry][rx-1] !== wall;
  var rightOpen = rx >= MAP_W-1 || g[ry][rx+1] !== wall;
  var bottomOpen = ry >= MAP_H-1 || g[ry+1][rx] !== wall;

  var t = TILE_SIZE;

  // Base: darker wall color for depth
  ctx.fillStyle = darken(theme.wallDark, 15);
  ctx.fillRect(sx, sy, t, t);

  // Top edge: always highlighted (top-down lighting simulation)
  ctx.fillStyle = lighten(theme.wall, 25);
  ctx.fillRect(sx, sy, t, 2);

  // Left edge: lighter front face if open, darker for depth if wall
  if (leftOpen) {
    ctx.fillStyle = lighten(theme.wall, 30);
    ctx.fillRect(sx, sy, 2, t);
  } else {
    ctx.fillStyle = darken(theme.wallDark, 8);
    ctx.fillRect(sx, sy, 2, t);
  }

  // Right edge: lighter front face if open, darker for depth if wall
  if (rightOpen) {
    ctx.fillStyle = lighten(theme.wall, 30);
    ctx.fillRect(sx+t-2, sy, 2, t);
  } else {
    ctx.fillStyle = darken(theme.wallDark, 5);
    ctx.fillRect(sx+t-2, sy, 2, t);
  }

  // Bottom edge: lighter front face if open, darker for depth if wall
  if (bottomOpen) {
    ctx.fillStyle = lighten(theme.wall, 30);
    ctx.fillRect(sx, sy+t-2, t, 2);
  } else {
    ctx.fillStyle = darken(theme.wallDark, 12);
    ctx.fillRect(sx, sy+t-2, t, 2);
  }

  // Inner face
  var inner = darken(theme.wall, 4);
  ctx.fillStyle = inner;
  ctx.fillRect(sx+2, sy+2, t-4, t-4);

  // Deterministic surface variation
  var h = tileHash(rx, ry);
  ctx.fillStyle = darken(inner, 10);
  if (h < 0.25) ctx.fillRect(sx+5, sy+5, 2, 2);
  else if (h < 0.5) { ctx.fillRect(sx+t-7, sy+t-7, 2, 2); }
  else if (h < 0.6) { ctx.fillRect(sx+t-6, sy+6, 2, 1); ctx.fillRect(sx+t-6, sy+8, 2, 1); }
  else if (h < 0.7) { ctx.fillRect(sx+5, sy+t-7, 3, 1); }

  // Corner highlights where open edges meet top light
  if (topOpen && leftOpen) {
    ctx.fillStyle = lighten(theme.wall, 40);
    ctx.fillRect(sx, sy, 2, 2);
  }
  if (topOpen && rightOpen) {
    ctx.fillStyle = lighten(theme.wall, 20);
    ctx.fillRect(sx+t-2, sy, 2, 2);
  }
}

// =====================
// Floor + corridor with texture
// =====================

function drawFloorTile(ctx, sx, sy, color, rx, ry) {
  ctx.fillStyle = color;
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

  // Tile edge lines
  ctx.fillStyle = darken(color, 8);
  ctx.fillRect(sx, sy, TILE_SIZE, 1);
  ctx.fillRect(sx, sy, 1, TILE_SIZE);

  // Every 3rd tile: draw 1x1 dot in slightly darker shade
  if ((rx + ry) % 3 === 0) {
    ctx.fillStyle = darken(color, 15);
    ctx.fillRect(sx + Math.floor(TILE_SIZE / 2), sy + Math.floor(TILE_SIZE / 2), 1, 1);
  }

  // Additional deterministic texture for variation
  var h = tileHash(rx, ry);
  ctx.fillStyle = darken(color, 10);
  var ts = TILE_SIZE;
  if (h < 0.3) { ctx.fillRect(sx+3, sy+3, 1, 1); }
  else if (h < 0.55) { ctx.fillRect(sx+ts-4, sy+ts-4, 1, 1); }
  else if (h < 0.75) { ctx.fillRect(sx+ts-5, sy+3, 1, 1); }
}

// =====================
// Pixel stairs
// =====================

function drawStairsAt(ctx, sx, sy, theme) {
  var ts = TILE_SIZE;
  var base = theme.corridor || darken(theme.floor, 20);

  ctx.fillStyle = darken(base, 10);
  ctx.fillRect(sx+2, sy+1, ts-4, ts-2);

  // 3 descending grey steps going down-right
  var steps = [
    { color: lighten(PAL.steel, 15), x: sx+3, y: sy+2, w: 10, h: 3 },
    { color: PAL.steel, x: sx+5, y: sy+5, w: 9, h: 3 },
    { color: darken(PAL.steel, 15), x: sx+7, y: sy+8, w: 8, h: 3 }
  ];
  for (var i = 0; i < steps.length; i++) {
    ctx.fillStyle = steps[i].color;
    ctx.fillRect(steps[i].x, steps[i].y, steps[i].w, steps[i].h);
    // Step front face (darker)
    ctx.fillStyle = darken(steps[i].color, 20);
    ctx.fillRect(steps[i].x, steps[i].y + steps[i].h - 1, steps[i].w, 1);
  }
}

// =====================
// Item icon drawing
// =====================

function drawItemIcon(ctx, x, y, type) {
  var p = PIXEL;

  if (type === 'gold') {
    // Gold coin — yellow circle
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(x+5*p, y+2*p, 3*p, p);
    ctx.fillRect(x+4*p, y+3*p, 5*p, p);
    ctx.fillRect(x+4*p, y+4*p, 5*p, 2*p);
    ctx.fillRect(x+5*p, y+6*p, 3*p, p);
    ctx.fillRect(x+6*p, y+7*p, p, p);
    ctx.fillStyle = '#d4a020';
    ctx.fillRect(x+5*p, y+3*p, p, 3*p);
    ctx.fillStyle = '#ffe070';
    ctx.fillRect(x+5*p, y+3*p, p, p);
    ctx.fillRect(x+6*p, y+3*p, p, p);
    return;
  }

  var def = ITEMS_DATA[type];
  if (!def) {
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x+5*p, y+5*p, 2*p, 2*p);
    return;
  }

  var eff = def.effect;

  // Health potion — red bottle
  if (eff === 'heal') {
    var isBig = type === 'big_hp_potion';
    if (isBig) {
      ctx.fillStyle = '#d43';
      ctx.fillRect(x+5*p, y+p, 4*p, p);
      ctx.fillRect(x+5*p, y+2*p, 4*p, p);
      ctx.fillRect(x+4*p, y+3*p, 6*p, p);
      ctx.fillRect(x+4*p, y+4*p, 6*p, 4*p);
      ctx.fillStyle = '#a22';
      ctx.fillRect(x+4*p, y+6*p, 3*p, 2*p);
      ctx.fillStyle = '#f66';
      ctx.fillRect(x+4*p, y+4*p, 2*p, 2*p);
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(x+5*p, y+2*p, 4*p, p);
      ctx.fillStyle = '#802';
      ctx.fillRect(x+4*p, y+3*p, 6*p, p);
    } else {
      ctx.fillStyle = '#d43';
      ctx.fillRect(x+6*p, y+2*p, 2*p, p);
      ctx.fillRect(x+5*p, y+3*p, 4*p, p);
      ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
      ctx.fillStyle = '#a22';
      ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
      ctx.fillStyle = '#f66';
      ctx.fillRect(x+5*p, y+4*p, p, p);
      ctx.fillStyle = '#802';
      ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    }
    return;
  }

  // Mana potion — blue bottle
  if (eff === 'restore_mp') {
    ctx.fillStyle = '#35c';
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = '#238';
    ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
    ctx.fillStyle = '#68f';
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillStyle = '#228';
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Full restore — golden sparkle
  if (eff === 'full_restore') {
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = '#ffe080';
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillRect(x+9*p, y+4*p, p, p);
    ctx.fillRect(x+6*p, y+3*p, p, p);
    ctx.fillRect(x+6*p, y+7*p, p, p);
    ctx.fillStyle = '#c09020';
    ctx.fillRect(x+5*p, y+6*p, 4*p, 2*p);
    ctx.fillStyle = '#806010';
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Bomb
  if (eff === 'damage') {
    ctx.fillStyle = '#222';
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+7*p, y+p, p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 3*p);
    ctx.fillRect(x+6*p, y+7*p, 2*p, p);
    ctx.fillStyle = '#f7971e';
    ctx.fillRect(x+7*p, y+p, p, p);
    ctx.fillStyle = '#444';
    ctx.fillRect(x+6*p, y+5*p, 2*p, 2*p);
    ctx.fillStyle = '#888';
    ctx.fillRect(x+6*p, y+5*p, p, p);
    return;
  }

  // Key
  if (eff === 'key') {
    ctx.fillStyle = '#c8c0b0';
    ctx.fillRect(x+5*p, y+2*p, 4*p, p);
    ctx.fillRect(x+4*p, y+3*p, 5*p, 3*p);
    ctx.fillRect(x+5*p, y+6*p, 4*p, p);
    ctx.fillRect(x+9*p, y+5*p, 2*p, 3*p);
    ctx.fillRect(x+10*p, y+4*p, p, 5*p);
    ctx.fillStyle = '#6a6a5a';
    ctx.fillRect(x+5*p, y+3*p, 4*p, 3*p);
    ctx.fillStyle = '#e0d8c8';
    ctx.fillRect(x+5*p, y+2*p, p, p);
    ctx.fillRect(x+9*p, y+5*p, p, p);
    ctx.fillRect(x+10*p, y+4*p, p, p);
    return;
  }

  // Scroll (identify, detect, teleport — anything else with scroll-like icon)
  if (eff === 'identify' || eff === 'detect_traps' || eff === 'teleport') {
    ctx.fillStyle = '#e8d8b0';
    ctx.fillRect(x+5*p, y+2*p, 4*p, 5*p);
    ctx.fillStyle = '#c8b890';
    ctx.fillRect(x+5*p, y+2*p, 4*p, p);
    ctx.fillRect(x+5*p, y+6*p, 4*p, p);
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x+6*p, y+3*p, 2*p, 3*p);
    ctx.fillStyle = '#d8c8a0';
    ctx.fillRect(x+5*p, y+2*p, p, p);
    ctx.fillRect(x+5*p, y+6*p, p, p);
    return;
  }

  // Antidote / cure — green bottle
  if (eff === 'cure_poison') {
    ctx.fillStyle = '#4a4';
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = '#373';
    ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
    ctx.fillStyle = '#6d6';
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillStyle = '#2a2';
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Fallback — generic gray dot
  ctx.fillStyle = '#888';
  ctx.fillRect(x+5*p, y+5*p, 2*p, 2*p);
}

// =====================
// Generic pixel sprite from grid
// =====================

function drawPixelSprite(ctx, x, y, grid, scale) {
  var p = PIXEL * (scale || 1);
  for (var r = 0; r < grid.length; r++) {
    for (var c = 0; c < grid[r].length; c++) {
      var color = grid[r][c];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * p, y + r * p, p, p);
    }
  }
}

// =====================
// Map rendering
// =====================

function renderMap() {
  cameraX = clamp(player.x - Math.floor(CANVAS_W / TILE_SIZE / 2), 0, MAP_W - Math.floor(CANVAS_W / TILE_SIZE));
  cameraY = clamp(player.y - Math.floor(CANVAS_H / TILE_SIZE / 2), 0, MAP_H - Math.floor(CANVAS_H / TILE_SIZE));

  gameCtx.save();
  gameCtx.translate(-cameraX * TILE_SIZE + shakeX, -cameraY * TILE_SIZE + shakeY);

  var cols = Math.ceil(CANVAS_W / TILE_SIZE) + 1;
  var rows = Math.ceil(CANVAS_H / TILE_SIZE) + 1;
  var theme = dungeon.theme.colors;

  // Pre-compute FOV level for each visible tile
  // fov 0 = unseen (solid black), 1 = seen not visible (15% overlay), 2 = visible
  var fov = [];
  for (var ry = 0; ry < rows + 2; ry++) {
    fov[ry] = [];
    for (var rx = 0; rx < cols + 2; rx++) {
      fov[ry][rx] = 0;
    }
  }

  for (var ry = cameraY; ry < cameraY + rows; ry++) {
    for (var rx = cameraX; rx < cameraX + cols; rx++) {
      if (!inBounds(rx, ry)) continue;
      var li = ry - cameraY, lj = rx - cameraX;
      if (dungeon.revealed[ry][rx]) {
        fov[li][lj] = isInSight(rx, ry, player.x, player.y, dungeon.grid, dungeon.visibility) ? 2 : 1;
      }
    }
  }

  // Pre-compute vignette multiplier (radial gradient around player)
  // 100% bright center -> 70% at 6 tiles out
  var vignette = [];
  for (var ry = 0; ry < rows + 2; ry++) {
    vignette[ry] = [];
    for (var rx = 0; rx < cols + 2; rx++) {
      var vdx = (cameraX + rx) - player.x, vdy = (cameraY + ry) - player.y;
      var vdist = Math.sqrt(vdx * vdx + vdy * vdy);
      vignette[ry][rx] = Math.max(0.7, 1.0 - (vdist / 6.0) * 0.3);
    }
  }

  // Draw tiles with fog of war
  for (var ry = cameraY; ry < cameraY + rows; ry++) {
    for (var rx = cameraX; rx < cameraX + cols; rx++) {
      if (!inBounds(rx, ry)) continue;

      var tile = dungeon.grid[ry][rx];
      var sx = rx * TILE_SIZE, sy = ry * TILE_SIZE;
      var li = ry - cameraY, lj = rx - cameraX;
      var level = fov[li][lj];

      if (level === 0) {
        // Unseen: solid black
        gameCtx.fillStyle = '#000000';
        gameCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        continue;
      }

      gameCtx.globalAlpha = 1;

      if (tile === TILE.WALL) {
        drawWallTile(gameCtx, sx, sy, rx, ry, theme);
      } else if (tile === TILE.FLOOR) {
        drawFloorTile(gameCtx, sx, sy, theme.floor, rx, ry);
      } else if (tile === TILE.CORRIDOR) {
        drawFloorTile(gameCtx, sx, sy, theme.corridor, rx, ry);
      }

      // Seen but not visible: dark overlay (15% brightness)
      if (level === 1) {
        gameCtx.globalAlpha = 0.85;
        gameCtx.fillStyle = '#000000';
        gameCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        gameCtx.globalAlpha = 1;
      }

      // Visible: apply vignette dimming
      if (level === 2) {
        var vig = vignette[li][lj];
        if (vig < 1.0) {
          gameCtx.globalAlpha = 1.0 - vig;
          gameCtx.fillStyle = '#000000';
          gameCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
          gameCtx.globalAlpha = 1;
        }
      }
    }
  }

  // Helper: get effective brightness for entities at (rx, ry)
  function entityAlpha(rx, ry) {
    var li = ry - cameraY, lj = rx - cameraX;
    if (li < 0 || lj < 0 || li >= rows || lj >= cols) return 0;
    var level = fov[li][lj];
    if (level === 0) return 0;
    if (level === 1) return 0.15;
    return vignette[li][lj];
  }

  // Draw items
  for (var i = 0; i < dungeon.items.length; i++) {
    var item = dungeon.items[i];
    if (!isRevealed(item.x, item.y, dungeon.revealed)) continue;
    var alpha = entityAlpha(item.x, item.y);
    if (alpha <= 0) continue;
    var sx = item.x * TILE_SIZE, sy = item.y * TILE_SIZE;
    gameCtx.globalAlpha = alpha;
    drawItemIcon(gameCtx, sx, sy, item.type);
    gameCtx.globalAlpha = 1;
  }

  // Draw traps
  for (var i = 0; i < dungeon.traps.length; i++) {
    var trap = dungeon.traps[i];
    if (!trap.revealed || trap.triggered) continue;
    if (!isRevealed(trap.x, trap.y, dungeon.revealed)) continue;
    var alpha = entityAlpha(trap.x, trap.y);
    if (alpha <= 0) continue;
    var sx = trap.x * TILE_SIZE, sy = trap.y * TILE_SIZE;
    gameCtx.globalAlpha = alpha * 0.6;
    gameCtx.fillStyle = trap.color;
    var ts = TILE_SIZE, p = PIXEL;
    gameCtx.fillRect(sx+3, sy+3, p, p);
    gameCtx.fillRect(sx+ts-3-p, sy+3, p, p);
    gameCtx.fillRect(sx+3, sy+ts-3-p, p, p);
    gameCtx.fillRect(sx+ts-3-p, sy+ts-3-p, p, p);
    gameCtx.fillRect(sx+ts/2-1, sy+ts/2-1, 2, 2);
    gameCtx.globalAlpha = 1;
  }

  // Draw stairs
  var alpha = entityAlpha(dungeon.stairsPos.x, dungeon.stairsPos.y);
  if (alpha > 0) {
    var sx = dungeon.stairsPos.x * TILE_SIZE, sy = dungeon.stairsPos.y * TILE_SIZE;
    gameCtx.globalAlpha = alpha;
    drawStairsAt(gameCtx, sx, sy, theme);
    gameCtx.globalAlpha = 1;
  }

  // Draw enemies
  for (var i = 0; i < dungeon.enemies.length; i++) {
    var enemy = dungeon.enemies[i];
    if (!enemy || enemy.hp <= 0) continue;
    if (!isInSight(enemy.x, enemy.y, player.x, player.y, dungeon.grid, dungeon.visibility)) continue;
    var ex = enemy.x * TILE_SIZE, ey = enemy.y * TILE_SIZE;
    var alpha = entityAlpha(enemy.x, enemy.y);
    gameCtx.globalAlpha = alpha;
    try {
      if (enemy.boss) {
        drawBossSprite(gameCtx, ex - 8, ey - 8, enemy.bossId || 'moss_giant', undefined, false, false);
      } else {
        drawEnemySprite(gameCtx, ex, ey, enemy.type, undefined, false, false);
      }
    } catch (e) {
      gameCtx.fillStyle = enemy.boss ? PAL.crimson : PAL.red;
      gameCtx.fillRect(ex + 2, ey + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
    gameCtx.globalAlpha = 1;
  }

  // Draw player
  var px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
  try {
    drawPlayerSprite(gameCtx, px, py, 'idle', false);
  } catch (e) {
    gameCtx.fillStyle = PAL.blue;
    gameCtx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }

  gameCtx.restore();
}

// =====================
// Minimap
// =====================

function renderMinimap() {
  if (!dungeon) return;
  var mm = 3;
  var mw = MAP_W * mm, mh = MAP_H * mm;
  var mx = CANVAS_W - mw - 4, my = 4;

  // Border: 2px solid #5a4a3a
  gameCtx.fillStyle = '#5a4a3a';
  gameCtx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

  // Background: #0a0a14
  gameCtx.fillStyle = '#0a0a14';
  gameCtx.fillRect(mx, my, mw, mh);

  var theme = dungeon.theme.colors;
  for (var y = 0; y < MAP_H; y++) {
    for (var x = 0; x < MAP_W; x++) {
      if (!dungeon.revealed[y][x]) continue;
      var tile = dungeon.grid[y][x];
      var isLit = isInSight(x, y, player.x, player.y, dungeon.grid, dungeon.visibility);
      if (tile === TILE.WALL) {
        gameCtx.fillStyle = isLit ? theme.wallDark : darken(theme.wallDark, 20);
      } else {
        gameCtx.fillStyle = isLit ? theme.floor : darken(theme.floor, 30);
      }
      gameCtx.fillRect(mx + x * mm, my + y * mm, mm, mm);
    }
  }

  // Enemies as red dots
  for (var i = 0; i < dungeon.enemies.length; i++) {
    var e = dungeon.enemies[i];
    if (!e || e.hp <= 0) continue;
    if (!isInSight(e.x, e.y, player.x, player.y, dungeon.grid, dungeon.visibility)) continue;
    gameCtx.fillStyle = e.boss ? PAL.crimson : PAL.red;
    gameCtx.fillRect(mx + e.x * mm, my + e.y * mm, mm, mm);
  }

  // Items as yellow dots
  for (var i = 0; i < dungeon.items.length; i++) {
    var it = dungeon.items[i];
    if (!isRevealed(it.x, it.y, dungeon.revealed)) continue;
    gameCtx.fillStyle = PAL.gold;
    gameCtx.fillRect(mx + it.x * mm, my + it.y * mm, mm, mm);
  }

  // Player: bright white dot with blink (toggle every 600ms)
  var blink = Math.floor(Date.now() / 600) % 2;
  gameCtx.fillStyle = blink ? '#ffffff' : '#aaccff';
  gameCtx.fillRect(mx + player.x * mm, my + player.y * mm, mm, mm);
}

// =====================
// Combat view
// =====================

function renderCombat() {
  if (!combatState) return;
  var enemy = combatState.enemy;
  if (!enemy) return;

  // Dark dramatic gradient background
  var grd = gameCtx.createLinearGradient(0, 0, 0, CANVAS_H);
  grd.addColorStop(0, PAL.void);
  grd.addColorStop(0.4, darken(PAL.dark, 5));
  grd.addColorStop(1, PAL.void);
  gameCtx.fillStyle = grd;
  gameCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Combat arena floor with tile pattern
  gameCtx.fillStyle = PAL.dark;
  gameCtx.fillRect(40, 70, CANVAS_W - 80, CANVAS_H - 130);

  // Subtle tile lines on floor
  gameCtx.fillStyle = darken(PAL.dark, 6);
  for (var tx = 40; tx < CANVAS_W - 40; tx += TILE_SIZE * 2) {
    gameCtx.fillRect(tx, 70, 1, CANVAS_H - 130);
  }
  for (var ty = 70; ty < CANVAS_H - 60; ty += TILE_SIZE * 2) {
    gameCtx.fillRect(40, ty, CANVAS_W - 80, 1);
  }

  // Floor edge
  gameCtx.fillStyle = lighten(PAL.dark, 8);
  gameCtx.fillRect(40, 70, CANVAS_W - 80, 2);

  // Dust particles
  var dust = Math.floor(spriteAnimFrame / 8) % 3;
  gameCtx.globalAlpha = 0.15;
  gameCtx.fillStyle = PAL.gray;
  var dustPositions = [
    {x: 80, y: CANVAS_H - 100}, {x: CANVAS_W - 120, y: 90},
    {x: CANVAS_W / 2, y: CANVAS_H - 80}, {x: 60, y: 85}
  ];
  for (var i = 0; i < dustPositions.length; i++) {
    var dp = dustPositions[i];
    var dOff = (dust + i) % 3;
    gameCtx.fillRect(dp.x + dOff * 10, dp.y + dOff * 5, 2, 2);
  }
  gameCtx.globalAlpha = 1;

  // Boss phase glow — pulse when below thresholds
  if (enemy.boss) {
    var hpRatio = enemy.hp / enemy.maxHp;
    var phaseActive = false;
    var phaseIntensity = 0;

    if (hpRatio < 0.33) {
      phaseActive = true;
      phaseIntensity = 0.7;
    } else if (hpRatio < 0.66) {
      phaseActive = true;
      phaseIntensity = 0.5;
    }

    if (phaseActive) {
      var pulse = (Math.sin(spriteAnimFrame * 0.12) * 0.5 + 0.5) * phaseIntensity;
      var ebx = CANVAS_W / 2, eby = 110;
      var aura = gameCtx.createRadialGradient(ebx, eby, 20, ebx, eby, 90);
      aura.addColorStop(0, 'rgba(200,30,30,' + (pulse * 0.3) + ')');
      aura.addColorStop(0.5, 'rgba(150,20,20,' + (pulse * 0.15) + ')');
      aura.addColorStop(1, 'rgba(100,10,10,0)');
      gameCtx.fillStyle = aura;
      gameCtx.fillRect(ebx - 90, eby - 90, 180, 180);
    }
  }

  // Enemy sprite with idle bob animation
  var bob = 0;
  if (!enemy.boss) {
    bob = Math.sin(spriteAnimFrame * 0.08) * 2;
  } else {
    bob = Math.sin(spriteAnimFrame * 0.05) * 1.5;
  }

  var ex = CANVAS_W / 2 - 32, ey = 80 + bob;
  try {
    if (enemy.boss) {
      // Boss pulsing glow effect using shadowBlur
      var glowPulse = Math.sin(Date.now() / 300) * 0.5 + 0.5;
      gameCtx.shadowColor = PAL.crimson;
      gameCtx.shadowBlur = 10 + glowPulse * 15;
      drawBossSprite(gameCtx, ex - 28, ey - 28, enemy.bossId || 'moss_giant', undefined, true, false);
      gameCtx.shadowBlur = 0;
    } else {
      drawEnemySprite(gameCtx, ex, ey, enemy.type, undefined, true, false);
    }
  } catch (e) {
    gameCtx.fillStyle = enemy.boss ? PAL.crimson : PAL.red;
    gameCtx.fillRect(ex, ey, 64, 64);
  }

  // Enemy name + HP bar -> HTML overlay

  // Player sprite on left
  var playerBob = Math.sin(spriteAnimFrame * 0.06 + 1) * 1;
  try {
    drawPlayerSprite(gameCtx, 80, CANVAS_H - 120 + playerBob, 'idle', true);
  } catch (e) {
    gameCtx.fillStyle = PAL.blue;
    gameCtx.fillRect(80, CANVAS_H - 120, 32, 32);
  }

  // Player stats (name + bars) -> HTML overlay

  // Action log -> HTML overlay
  updateCombatOverlay();
}

// =====================
// Combat HTML overlay (crisp text)
// =====================

function updateCombatOverlay() {
  var co = document.getElementById('combat-overlay');
  if (!co) return;

  // Initialize child elements on first call
  if (!co.querySelector('.enemy-name')) {
    co.innerHTML =
      '<div class="enemy-name" style="position:absolute;top:15%;left:50%;transform:translateX(-50%);' +
      'font-size:8px;font-weight:bold;white-space:nowrap;text-align:center;"></div>' +
      '<div class="enemy-hp-bg" style="position:absolute;top:19%;left:50%;transform:translateX(-50%);' +
      'width:80px;height:6px;background:#2a0a0a;border:1px solid #000;"></div>' +
      '<div class="enemy-hp-fill" style="position:absolute;top:19%;left:50%;transform:translateX(-50%);' +
      'width:80px;height:6px;background:#c00;transition:width 0.2s;"></div>' +
      '<div class="player-name" style="position:absolute;top:60%;left:28%;' +
      'font-size:8px;font-weight:bold;color:#0ff;"></div>' +
      '<div class="player-hp-bg" style="position:absolute;top:63%;left:28%;' +
      'width:120px;height:6px;background:#0a2a0a;border:1px solid #000;"></div>' +
      '<div class="player-hp-fill" style="position:absolute;top:63%;left:28%;' +
      'width:120px;height:6px;background:#0c0;transition:width 0.2s;"></div>' +
      '<div class="player-mp-bg" style="position:absolute;top:67%;left:28%;' +
      'width:120px;height:4px;background:#0a0a2a;border:1px solid #000;"></div>' +
      '<div class="player-mp-fill" style="position:absolute;top:67%;left:28%;' +
      'width:120px;height:4px;background:#3399ff;transition:width 0.2s;"></div>' +
      '<div class="action-log" style="position:absolute;bottom:8%;left:2%;' +
      'font-size:8px;color:#aaa;white-space:nowrap;max-width:95%;overflow:hidden;text-overflow:ellipsis;"></div>';
  }

  co.style.display = 'block';
  var enemy = combatState.enemy;

  // Enemy name
  var en = co.querySelector('.enemy-name');
  if (en) {
    en.textContent = enemy.name + (enemy.boss ? ' ★' : '');
    en.style.color = enemy.boss ? '#f0c040' : '#fff';
  }

  // Enemy HP bar
  var ehb = co.querySelector('.enemy-hp-bg');
  var ehf = co.querySelector('.enemy-hp-fill');
  if (ehb && ehf) {
    var ehpR = enemy.hp / enemy.maxHp;
    var ew = enemy.boss ? 140 : 80;
    ehb.style.width = ew + 'px';
    ehf.style.width = ew + 'px';
    ehf.style.width = (ew * ehpR) + 'px';
    ehf.style.background = ehpR > 0.3 ? '#c00' : '#f00';
  }

  // Player name
  var pn = co.querySelector('.player-name');
  if (pn) pn.textContent = player.name || 'Hero';

  // Player HP bar
  var php = co.querySelector('.player-hp-bg');
  var phf = co.querySelector('.player-hp-fill');
  if (php && phf) {
    var hpR = player.hp / player.maxHp;
    phf.style.width = (120 * hpR) + 'px';
    phf.style.background = hpR > 0.3 ? '#0c0' : '#f00';
  }

  // Player MP bar
  var mpb = co.querySelector('.player-mp-bg');
  var mpf = co.querySelector('.player-mp-fill');
  if (mpb && mpf) {
    var mpR = player.mp / player.maxMp;
    mpf.style.width = (120 * mpR) + 'px';
  }

  // Action log (last log entry)
  var al = co.querySelector('.action-log');
  if (al) {
    var logEl = document.getElementById('log');
    if (logEl && logEl.children.length > 0) {
      var lastMsg = logEl.children[logEl.children.length - 1].innerHTML;
      al.textContent = lastMsg.replace(/<[^>]*>/g, '').substring(0, 40);
    } else {
      al.textContent = '';
    }
  }
}
