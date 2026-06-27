// render.js — Canvas rendering with pixel dungeon aesthetic

let gameCanvas, gameCtx;
let cameraX = 0, cameraY = 0;
var themePalette = PAL;
var spritePal = null;

var CanvasTheme = null;
var _refreshingCanvas = false;
function refreshCanvasTheme() {
  CanvasTheme = window.themeManager ? window.themeManager.getActive() : null;
  // Trigger canvas redraw so theme colors take effect immediately
  if (!_refreshingCanvas && gameCtx && gameState && gameState.screen && gameState.screen !== 'title') {
    _refreshingCanvas = true;
    renderAll();
    _refreshingCanvas = false;
  }
}
refreshCanvasTheme();
window.refreshCanvasTheme = refreshCanvasTheme;

// Helper: get sprite data from SpriteLoader for a given name
function getPlayerSpriteData(isCombat) {
  if (!window.currentSpriteLoader || !player || !player.cls) {
    if (player && player.cls && (!_gpLastLogged || _gpLastLogged.cls !== player.cls)) {
      console.log('[sprite] getPlayerSpriteData no loader, cls=' + player.cls + ' isCombat=' + isCombat);
      _gpLastLogged = { cls: player.cls };
    }
    return null;
  }
  var name = 'player-' + player.cls; // warrior, mage, rogue
  var result = window.currentSpriteLoader.getEntryWithData(name, isCombat);
  var ok = result ? 'ok' : 'null';
  if (!_gpLastLogged || _gpLastLogged.ok !== ok || _gpLastLogged.cls !== player.cls) {
    console.log('[sprite] getPlayerSpriteData name=' + name + ' isCombat=' + isCombat + ' result=' + ok);
    _gpLastLogged = { ok: ok, cls: player.cls };
  }
  return result;
}
var _gpLastLogged = null;

function getEnemySpriteData(enemy, isCombat) {
  if (!window.currentSpriteLoader) return null;
  var name;
  if (enemy.boss) {
    name = 'boss-' + (enemy.bossId || 'moss_giant');
  } else {
    name = 'enemy-' + (enemy.type || 'slime');
  }
  return window.currentSpriteLoader.getEntryWithData(name, isCombat);
}

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
    themePalette = window.themeManager ? window.themeManager.getActive().palette : PAL;
    refreshCanvasTheme();
    spritePal = window.getThemeSpritePalette ? window.getThemeSpritePalette(CanvasTheme, player ? player.cls : null) : null;
    gameCtx.save();
    gameCtx.setTransform(1, 0, 0, 1, 0, 0);
    gameCtx.fillStyle = themePalette.void;
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

function tintBlend(hex, tintHex, pct) {
  var b = hexToRgb(hex);
  var t = hexToRgb(tintHex);
  return rgbToRbg(
    b[0] + (t[0] - b[0]) * pct,
    b[1] + (t[1] - b[1]) * pct,
    b[2] + (t[2] - b[2]) * pct
  );
}

function rgbaToHex(rgbaStr) {
  if (!rgbaStr || rgbaStr.indexOf('rgba') < 0) return null;
  var inner = rgbaStr.substring(5, rgbaStr.length - 1);
  var parts = inner.split(',').map(function(s) { return s.trim(); });
  return rgbToRbg(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
}

function getTintedColor(baseHex) {
  var tint = null;
  if (dungeon && dungeon.tints && dungeon.floor && dungeon.tints[dungeon.floor]) {
    tint = rgbaToHex(dungeon.tints[dungeon.floor]);
  }
  if (!tint && CanvasTheme && CanvasTheme.palette && CanvasTheme.palette.wallTint) {
    tint = rgbaToHex(CanvasTheme.palette.wallTint);
  }
  return tint ? tintBlend(baseHex, tint, 0.15) : baseHex;
}

function getTintedFloorColor(baseHex) {
  var tint = null;
  if (dungeon && dungeon.tints && dungeon.floor && dungeon.tints[dungeon.floor]) {
    tint = rgbaToHex(dungeon.tints[dungeon.floor]);
  }
  if (!tint && CanvasTheme && CanvasTheme.palette && CanvasTheme.palette.floorTint) {
    tint = rgbaToHex(CanvasTheme.palette.floorTint);
  }
  return tint ? tintBlend(baseHex, tint, 0.15) : baseHex;
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
  var p = CanvasTheme ? CanvasTheme.palette : PAL;
  var wallDark = p.wallDark || PAL.wallDark || '#2a2a3e';
  var wallLight = p.wallLight || PAL.wallLight || '#333349';
  var wallBase = getTintedColor(wallDark);
  var wallFace = getTintedColor(wallLight);

  // Base: darker wall color for depth
  ctx.fillStyle = darken(wallBase, 15);
  ctx.fillRect(sx, sy, t, t);

  // Top edge: always highlighted (top-down lighting simulation)
  ctx.fillStyle = lighten(wallFace, 25);
  ctx.fillRect(sx, sy, t, 2);

  // Left edge: lighter front face if open, darker for depth if wall
  if (leftOpen) {
    ctx.fillStyle = lighten(wallFace, 30);
    ctx.fillRect(sx, sy, 2, t);
  } else {
    ctx.fillStyle = darken(wallBase, 8);
    ctx.fillRect(sx, sy, 2, t);
  }

  // Right edge: lighter front face if open, darker for depth if wall
  if (rightOpen) {
    ctx.fillStyle = lighten(wallFace, 30);
    ctx.fillRect(sx+t-2, sy, 2, t);
  } else {
    ctx.fillStyle = darken(wallBase, 5);
    ctx.fillRect(sx+t-2, sy, 2, t);
  }

  // Bottom edge: lighter front face if open, darker for depth if wall
  if (bottomOpen) {
    ctx.fillStyle = lighten(wallFace, 30);
    ctx.fillRect(sx, sy+t-2, t, 2);
  } else {
    ctx.fillStyle = darken(wallBase, 12);
    ctx.fillRect(sx, sy+t-2, t, 2);
  }

  // Inner face
  var inner = darken(wallFace, 4);
  ctx.fillStyle = inner;
  ctx.fillRect(sx+2, sy+2, t-4, t-4);

  var wallStyle = CanvasTheme ? CanvasTheme.tiles.wallStyle : 'bricks';

  // Style-specific inner detail
  if (wallStyle === 'bricks') {
    drawWallBricks(ctx, sx, sy, t, inner, rx, ry);
  } else if (wallStyle === 'cave') {
    drawWallCave(ctx, sx, sy, t, inner, rx, ry);
  } else {
    // 'solid': deterministic surface variation
    var h = tileHash(rx, ry);
    ctx.fillStyle = darken(inner, 10);
    if (h < 0.25) ctx.fillRect(sx+5, sy+5, 2, 2);
    else if (h < 0.5) { ctx.fillRect(sx+t-7, sy+t-7, 2, 2); }
    else if (h < 0.6) { ctx.fillRect(sx+t-6, sy+6, 2, 1); ctx.fillRect(sx+t-6, sy+8, 2, 1); }
    else if (h < 0.7) { ctx.fillRect(sx+5, sy+t-7, 3, 1); }
  }

  // Corner highlights where open edges meet top light
  if (topOpen && leftOpen) {
    ctx.fillStyle = lighten(wallFace, 40);
    ctx.fillRect(sx, sy, 2, 2);
  }
  if (topOpen && rightOpen) {
    ctx.fillStyle = lighten(wallFace, 20);
    ctx.fillRect(sx+t-2, sy, 2, 2);
  }

  // Wall cracks from layer override
  if (CanvasTheme && CanvasTheme.tiles.wallCracks) {
    drawWallCracks(ctx, sx, sy, t, inner, rx, ry);
  }
}

function drawWallBricks(ctx, sx, sy, t, inner, rx, ry) {
  var brickH = 4;
  var brickGap = 1;
  var mortar = darken(inner, 8);
  var highlight = lighten(inner, 6);

  ctx.fillStyle = mortar;

  for (var row = 2; row < t - 2; row += brickH + brickGap) {
    var offset = ((ry + Math.floor((sy + row) / (brickH + brickGap))) % 2) * 4;
    ctx.fillRect(sx + 2, sy + row - brickGap, t - 4, brickGap);

    for (var col = 2 + offset; col < t - 2; col += 8) {
      ctx.fillRect(sx + col, sy + row, brickGap, brickH);

      var bh = brickH;
      if (sx + col + 4 > t - 3) bh = Math.min(bh, t - 3 - col);
      if (bh > 0) {
        var h = tileHash(rx + col, ry + row);
        ctx.fillStyle = h < 0.5 ? highlight : darken(inner, 3);
        ctx.fillRect(sx + col + brickGap, sy + row, Math.max(1, 7 - brickGap), bh);
        ctx.fillStyle = mortar;
      }
    }
  }
}

function drawWallCave(ctx, sx, sy, t, inner, rx, ry) {
  var h = tileHash(rx, ry);
  var ox = Math.floor(h * 4) - 2;
  var oy = Math.floor(tileHash(rx + 100, ry + 100) * 4) - 2;
  var iw = t - 6 + ox;
  var ih = t - 6 + oy;
  var ix = sx + 3 + (ox > 0 ? 0 : ox);
  var iy = sy + 3 + (oy > 0 ? 0 : oy);

  ctx.fillStyle = darken(inner, 6);
  ctx.fillRect(ix, iy, Math.max(2, iw), Math.max(2, ih));

  var highlight = lighten(inner, 5);
  ctx.fillStyle = highlight;
  ctx.fillRect(ix + 1, iy + 1, Math.max(1, iw - 2), 1);
}

function drawWallCracks(ctx, sx, sy, t, inner, rx, ry) {
  var h = tileHash(rx * 31, ry * 37);
  if (h > 0.35) return;

  var crackColor = darken(inner, 18);
  ctx.strokeStyle = crackColor;
  ctx.lineWidth = 1;

  var seed = tileHash(rx + 7, ry + 13);
  var startX = sx + 2 + Math.floor(seed * (t - 6));
  var startY = sy + 2;

  ctx.beginPath();
  ctx.moveTo(startX, startY);

  var cx = startX, cy = startY;
  var steps = 3 + Math.floor(tileHash(rx + 3, ry + 7) * 3);
  for (var i = 0; i < steps; i++) {
    var dir = tileHash(rx + i * 11, ry + i * 17);
    cx += (dir > 0.5 ? 2 : -1);
    cy += 2;
    ctx.lineTo(cx, cy);
    if (cy >= sy + t - 2) break;
  }
  ctx.stroke();
}

// =====================
// Floor + corridor with texture
// =====================

function drawFloorTile(ctx, sx, sy, color, rx, ry) {
  var ts = TILE_SIZE;
  var p = CanvasTheme ? CanvasTheme.palette : PAL;
  var floorDark = p.floorDark || PAL.floorDark || color || '#1e1e30';
  var tinted = getTintedFloorColor(floorDark);

  ctx.fillStyle = tinted;
  ctx.fillRect(sx, sy, ts, ts);

  var floorStyle = CanvasTheme ? CanvasTheme.tiles.floorStyle : 'checker';

  if (floorStyle === 'checker') {
    drawFloorChecker(ctx, sx, sy, ts, tinted, rx, ry);
  } else if (floorStyle === 'dots') {
    drawFloorDots(ctx, sx, sy, ts, tinted, rx, ry);
  } else if (floorStyle === 'cracked') {
    drawFloorCracked(ctx, sx, sy, ts, tinted, rx, ry);
  } else {
    // 'smooth': tile edge lines for subtle definition
    ctx.fillStyle = darken(tinted, 8);
    ctx.fillRect(sx, sy, ts, 1);
    ctx.fillRect(sx, sy, 1, ts);
  }

  // Floor detail from layer overrides
  var floorDetail = CanvasTheme ? CanvasTheme.tiles.floorDetail : null;
  if (floorDetail) {
    drawFloorDetail(ctx, sx, sy, ts, tinted, rx, ry, floorDetail);
  }
}

function drawFloorChecker(ctx, sx, sy, ts, color, rx, ry) {
  var half = Math.floor(ts / 2);
  var dark = darken(color, 8);
  var checker = (rx + ry) % 2 === 0;

  for (var row = 0; row < 2; row++) {
    for (var col = 0; col < 2; col++) {
      var isLight = (checker && row === col) || (!checker && row !== col);
      ctx.fillStyle = isLight ? lighten(color, 4) : dark;
      ctx.fillRect(sx + col * half, sy + row * half, half, half);
    }
  }
}

function drawFloorDots(ctx, sx, sy, ts, color, rx, ry) {
  var cx = sx + Math.floor(ts / 2);
  var cy = sy + Math.floor(ts / 2);
  ctx.fillStyle = lighten(color, 8);
  ctx.fillRect(cx - 1, cy - 1, 3, 3);
  ctx.fillStyle = lighten(color, 12);
  ctx.fillRect(cx, cy, 1, 1);
}

function drawFloorCracked(ctx, sx, sy, ts, color, rx, ry) {
  var h = tileHash(rx, ry);
  if (h > 0.5) return;

  var crackColor = darken(color, 14);
  ctx.fillStyle = crackColor;
  var seed = tileHash(rx + 5, ry + 9);

  var startX = sx + 2 + Math.floor(seed * (ts - 4));
  var startY = sy + 2 + Math.floor(tileHash(rx + 2, ry + 4) * (ts - 4));

  ctx.fillRect(startX, startY, 1, 1);
  var dx = (h > 0.25) ? 2 : -1;
  var dy = (tileHash(rx + 1, ry + 6) > 0.5) ? 2 : 1;
  ctx.fillRect(startX + dx, startY + dy, 1, 1);
  ctx.fillRect(startX + dx * 2, startY + dy * 2, 1, 1);
}

function drawFloorDetail(ctx, sx, sy, ts, color, rx, ry, detail) {
  var h = tileHash(rx * 7 + 13, ry * 11 + 17);

  if (detail === 'moss') {
    if (h > 0.4) return;
    var mossColor = CanvasTheme ? CanvasTheme.palette.heal : PAL.green;
    var count = 1 + Math.floor(h * 3);
    for (var i = 0; i < count; i++) {
      var mx = sx + 2 + Math.floor(tileHash(rx + i, ry) * (ts - 4));
      var my = sy + 2 + Math.floor(tileHash(rx, ry + i) * (ts - 4));
      ctx.fillStyle = mossColor;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(mx, my, 2, 2);
      ctx.globalAlpha = 1;
    }
  } else if (detail === 'bones') {
    if (h > 0.15) return;
    var boneColor = CanvasTheme ? CanvasTheme.palette.bone : PAL.bone;
    ctx.fillStyle = boneColor;
    ctx.globalAlpha = 0.3;
    var bx = sx + 3;
    var by = sy + Math.floor(ts / 2) - 1;
    ctx.fillRect(bx, by, 5, 2);
    ctx.fillRect(bx - 1, by - 1, 2, 2);
    ctx.fillRect(bx + 4, by - 1, 2, 2);
    ctx.globalAlpha = 1;
  } else if (detail === 'void_crack') {
    if (h > 0.25) return;
    var voidColor = CanvasTheme ? CanvasTheme.palette.magenta : PAL.magenta;
    ctx.strokeStyle = voidColor;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    var vx = sx + Math.floor(ts / 2);
    var vy = sy + 2;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    var cx = vx, cy = vy;
    for (var i = 0; i < 3; i++) {
      cx += (tileHash(rx + i, ry) > 0.5 ? 2 : -1);
      cy += 3;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// =====================
// Corridor drawing with style variants
// =====================

function drawCorridorTile(ctx, sx, sy, rx, ry) {
  var ts = TILE_SIZE;
  var p = CanvasTheme ? CanvasTheme.palette : PAL;
  var corridorBase = p.corridor || darken(p.floorDark || PAL.floorDark || '#1e1e30', 10);
  var tinted = getTintedFloorColor(corridorBase);
  var corridorStyle = CanvasTheme ? CanvasTheme.tiles.corridorStyle : 'solid';

  ctx.fillStyle = tinted;
  ctx.fillRect(sx, sy, ts, ts);

  if (corridorStyle === 'solid') {
    ctx.fillStyle = darken(tinted, 6);
    ctx.fillRect(sx, sy, ts, 1);
    ctx.fillRect(sx, sy, 1, ts);
  } else if (corridorStyle === 'dashed') {
    ctx.fillStyle = lighten(tinted, 5);
    for (var i = 3; i < ts; i += 6) {
      ctx.fillRect(sx + i, sy + 2, 3, 1);
      ctx.fillRect(sx + i, sy + ts - 3, 3, 1);
    }
  } else if (corridorStyle === 'cobble') {
    var h1 = tileHash(rx * 5, ry * 7);
    var h2 = tileHash(rx * 7, ry * 5);
    var ox = Math.floor(h1 * 3) - 1;
    var oy = Math.floor(h2 * 3) - 1;
    ctx.fillStyle = lighten(tinted, 4);
    ctx.fillRect(sx + 3 + ox, sy + 3 + oy, ts - 8, ts - 8);
    ctx.fillStyle = darken(tinted, 5);
    ctx.fillRect(sx + 3 + ox, sy + 3 + oy, ts - 8, 1);
    ctx.fillRect(sx + 3 + ox, sy + 3 + oy, 1, ts - 8);
  }
}

// =====================
// Pixel stairs
// =====================

function drawStairsAt(ctx, sx, sy, theme, stairGlow) {
  var ts = TILE_SIZE;
  var p = CanvasTheme ? CanvasTheme.palette : PAL;
  var base = p.corridor || darken(p.floorDark || '#1e1e30', 10);

  // Stair glow from theme
  if (stairGlow) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = stairGlow;
    ctx.fillRect(sx - 2, sy - 2, ts + 4, ts + 4);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = darken(base, 10);
  ctx.fillRect(sx+2, sy+1, ts-4, ts-2);

  // 3 descending grey steps going down-right
  var steps = [
    { color: lighten(p.steel, 15), x: sx+3, y: sy+2, w: 10, h: 3 },
    { color: p.steel, x: sx+5, y: sy+5, w: 9, h: 3 },
    { color: darken(p.steel, 15), x: sx+7, y: sy+8, w: 8, h: 3 }
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
// Pixel shrine icon
// =====================

function drawShrineIcon(ctx, sx, sy, theme) {
  var p = PIXEL;
  var c = CanvasTheme ? CanvasTheme.palette : PAL;

  // Base / steps
  ctx.fillStyle = c.stone || PAL.stone;
  ctx.fillRect(sx+2*p, sy+9*p, 10*p, 2*p);
  ctx.fillRect(sx+3*p, sy+8*p, 8*p, p);

  // Pillars
  ctx.fillStyle = lighten(c.stone || PAL.stone, 15);
  ctx.fillRect(sx+3*p, sy+4*p, p, 4*p);
  ctx.fillRect(sx+9*p, sy+4*p, p, 4*p);

  // Roof / crossbeam
  ctx.fillStyle = c.gold;
  ctx.fillRect(sx+2*p, sy+3*p, 10*p, p);
  ctx.fillRect(sx+3*p, sy+2*p, 8*p, p);
  ctx.fillRect(sx+5*p, sy+p, 4*p, p);

  // Center cross
  ctx.fillStyle = lighten(c.gold, 40);
  ctx.fillRect(sx+6*p, sy+4*p, 2*p, 3*p);
  ctx.fillRect(sx+5*p, sy+5*p, 4*p, p);

  // Glow highlight
  ctx.fillStyle = lighten(c.gold, 60);
  ctx.fillRect(sx+6*p, sy+2*p, p, p);
  ctx.fillRect(sx+5*p, sy+5*p, p, p);
}

// =====================
// Shop merchant icon
// =====================

function drawShopMerchantIcon(ctx, x, y) {
  var p = PIXEL;
  var c = CanvasTheme ? CanvasTheme.palette : PAL;

  // Merchant cart - dark brown base
  ctx.fillStyle = c.brownDk || c.brown || '#5c3a1e';
  ctx.fillRect(x + 2 * p, y + 8 * p, 10 * p, 3 * p);
  // Cart wheels
  ctx.fillStyle = c.stone || '#8a8a8a';
  ctx.fillRect(x + 3 * p, y + 10 * p, 2 * p, 2 * p);
  ctx.fillRect(x + 9 * p, y + 10 * p, 2 * p, 2 * p);
  // Cart body
  ctx.fillStyle = c.brown || '#8B4513';
  ctx.fillRect(x + 3 * p, y + 5 * p, 8 * p, 3 * p);
  // Cart awning (colorful)
  ctx.fillStyle = c.danger || '#e53935';
  ctx.fillRect(x + 2 * p, y + 4 * p, 4 * p, p);
  ctx.fillStyle = c.gold || '#f0c040';
  ctx.fillRect(x + 6 * p, y + 4 * p, 4 * p, p);
  // Merchant figure behind cart
  ctx.fillStyle = c.bone || '#d4c5a9';
  ctx.fillRect(x + 6 * p, y + p, 2 * p, 3 * p);
  // Hat
  ctx.fillStyle = c.grayDk || '#3a3a5a';
  ctx.fillRect(x + 5 * p, y, 4 * p, p);
}

// =====================
// Item icon drawing
// =====================

function drawItemIcon(ctx, x, y, type) {
  var p = PIXEL;
  var c = CanvasTheme ? CanvasTheme.palette : PAL;

  if (type === 'gold') {
    // Gold coin — yellow circle
    ctx.fillStyle = c.gold;
    ctx.fillRect(x+5*p, y+2*p, 3*p, p);
    ctx.fillRect(x+4*p, y+3*p, 5*p, p);
    ctx.fillRect(x+4*p, y+4*p, 5*p, 2*p);
    ctx.fillRect(x+5*p, y+6*p, 3*p, p);
    ctx.fillRect(x+6*p, y+7*p, p, p);
    ctx.fillStyle = darken(c.gold, 40);
    ctx.fillRect(x+5*p, y+3*p, p, 3*p);
    ctx.fillStyle = lighten(c.gold, 50);
    ctx.fillRect(x+5*p, y+3*p, p, p);
    ctx.fillRect(x+6*p, y+3*p, p, p);
    return;
  }

  if (type === 'resting') {
    // Campfire — pixel art flame with log base
    ctx.fillStyle = c.brown;
    ctx.fillRect(x+3*p, y+8*p, 8*p, 2*p);
    ctx.fillStyle = darken(c.brown, 20);
    ctx.fillRect(x+2*p, y+9*p, 10*p, p);
    ctx.fillStyle = c.danger;
    ctx.fillRect(x+5*p, y+3*p, 3*p, 2*p);
    ctx.fillRect(x+4*p, y+5*p, 5*p, 2*p);
    ctx.fillRect(x+5*p, y+7*p, 3*p, p);
    ctx.fillStyle = c.orange;
    ctx.fillRect(x+5*p, y+4*p, 2*p, 2*p);
    ctx.fillRect(x+4*p, y+6*p, 3*p, p);
    ctx.fillStyle = lighten(c.gold, 60);
    ctx.fillRect(x+6*p, y+2*p, p, p);
    ctx.fillRect(x+5*p, y+5*p, p, p);
    return;
  }

  var def = ITEMS_DATA[type];
  if (!def) {
    ctx.fillStyle = c.gray;
    ctx.fillRect(x+5*p, y+5*p, 2*p, 2*p);
    return;
  }

  var eff = def.effect;

  // Health potion — red bottle
  if (eff === 'heal') {
    var isBig = type === 'big_hp_potion';
    if (isBig) {
      ctx.fillStyle = c.danger;
      ctx.fillRect(x+5*p, y+p, 4*p, p);
      ctx.fillRect(x+5*p, y+2*p, 4*p, p);
      ctx.fillRect(x+4*p, y+3*p, 6*p, p);
      ctx.fillRect(x+4*p, y+4*p, 6*p, 4*p);
      ctx.fillStyle = c.redDk;
      ctx.fillRect(x+4*p, y+6*p, 3*p, 2*p);
      ctx.fillStyle = lighten(c.danger, 40);
      ctx.fillRect(x+4*p, y+4*p, 2*p, 2*p);
      ctx.fillStyle = lighten(c.gold, 50);
      ctx.fillRect(x+5*p, y+2*p, 4*p, p);
      ctx.fillStyle = c.brownDk;
      ctx.fillRect(x+4*p, y+3*p, 6*p, p);
    } else {
      ctx.fillStyle = c.danger;
      ctx.fillRect(x+6*p, y+2*p, 2*p, p);
      ctx.fillRect(x+5*p, y+3*p, 4*p, p);
      ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
      ctx.fillStyle = c.redDk;
      ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
      ctx.fillStyle = lighten(c.danger, 40);
      ctx.fillRect(x+5*p, y+4*p, p, p);
      ctx.fillStyle = c.brownDk;
      ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    }
    return;
  }

  // Mana potion — blue bottle
  if (eff === 'restore_mp') {
    ctx.fillStyle = c.magic;
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = c.blueDk;
    ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
    ctx.fillStyle = lighten(c.magic, 30);
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillStyle = c.violet;
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Full restore — golden sparkle
  if (eff === 'full_restore') {
    ctx.fillStyle = c.gold;
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = lighten(c.gold, 40);
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillRect(x+9*p, y+4*p, p, p);
    ctx.fillRect(x+6*p, y+3*p, p, p);
    ctx.fillRect(x+6*p, y+7*p, p, p);
    ctx.fillStyle = darken(c.gold, 30);
    ctx.fillRect(x+5*p, y+6*p, 4*p, 2*p);
    ctx.fillStyle = darken(c.gold, 80);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Bomb
  if (eff === 'damage') {
    ctx.fillStyle = c.void;
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+7*p, y+p, p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 3*p);
    ctx.fillRect(x+6*p, y+7*p, 2*p, p);
    ctx.fillStyle = c.orange;
    ctx.fillRect(x+7*p, y+p, p, p);
    ctx.fillStyle = c.grayDk;
    ctx.fillRect(x+6*p, y+5*p, 2*p, 2*p);
    ctx.fillStyle = c.gray;
    ctx.fillRect(x+6*p, y+5*p, p, p);
    return;
  }

  // Key
  if (eff === 'key') {
    ctx.fillStyle = c.bone;
    ctx.fillRect(x+5*p, y+2*p, 4*p, p);
    ctx.fillRect(x+4*p, y+3*p, 5*p, 3*p);
    ctx.fillRect(x+5*p, y+6*p, 4*p, p);
    ctx.fillRect(x+9*p, y+5*p, 2*p, 3*p);
    ctx.fillRect(x+10*p, y+4*p, p, 5*p);
    ctx.fillStyle = c.stone;
    ctx.fillRect(x+5*p, y+3*p, 4*p, 3*p);
    ctx.fillStyle = lighten(c.bone, 15);
    ctx.fillRect(x+5*p, y+2*p, p, p);
    ctx.fillRect(x+9*p, y+5*p, p, p);
    ctx.fillRect(x+10*p, y+4*p, p, p);
    return;
  }

  // Scroll (identify, detect, teleport — anything else with scroll-like icon)
  if (eff === 'identify' || eff === 'detect_traps' || eff === 'teleport') {
    ctx.fillStyle = c.bone;
    ctx.fillRect(x+5*p, y+2*p, 4*p, 5*p);
    ctx.fillStyle = darken(c.bone, 20);
    ctx.fillRect(x+5*p, y+2*p, 4*p, p);
    ctx.fillRect(x+5*p, y+6*p, 4*p, p);
    ctx.fillStyle = lighten(c.bone, 20);
    ctx.fillRect(x+6*p, y+3*p, 2*p, 3*p);
    ctx.fillStyle = darken(c.bone, 10);
    ctx.fillRect(x+5*p, y+2*p, p, p);
    ctx.fillRect(x+5*p, y+6*p, p, p);
    return;
  }

  // Antidote / cure — green bottle
  if (eff === 'cure_poison') {
    ctx.fillStyle = c.heal;
    ctx.fillRect(x+6*p, y+2*p, 2*p, p);
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    ctx.fillRect(x+5*p, y+4*p, 4*p, 4*p);
    ctx.fillStyle = c.greenDk;
    ctx.fillRect(x+5*p, y+6*p, 2*p, 2*p);
    ctx.fillStyle = lighten(c.heal, 30);
    ctx.fillRect(x+5*p, y+4*p, p, p);
    ctx.fillStyle = c.greenDk;
    ctx.fillRect(x+5*p, y+3*p, 4*p, p);
    return;
  }

  // Fallback — generic gray dot
  ctx.fillStyle = c.gray;
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
        // Unseen: fog color
        var fogColor = CanvasTheme && CanvasTheme.tiles ? CanvasTheme.tiles.fogColor : themePalette.unseenFill;
        gameCtx.fillStyle = fogColor;
        gameCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        continue;
      }

      gameCtx.globalAlpha = 1;

      if (tile === TILE.WALL) {
        drawWallTile(gameCtx, sx, sy, rx, ry, theme);
      } else if (tile === TILE.FLOOR) {
        drawFloorTile(gameCtx, sx, sy, theme.floor, rx, ry);
      } else if (tile === TILE.CORRIDOR) {
        drawCorridorTile(gameCtx, sx, sy, rx, ry);
      }

      // Seen but not visible: dark overlay using revealedDarkness
      if (level === 1) {
        var darknessAlpha = CanvasTheme && CanvasTheme.tiles ? CanvasTheme.tiles.revealedDarkness : 0.4;
        gameCtx.globalAlpha = 1.0 - darknessAlpha;
        var fogColor2 = CanvasTheme && CanvasTheme.tiles ? CanvasTheme.tiles.fogColor : themePalette.fogOverlay;
        gameCtx.fillStyle = fogColor2;
        gameCtx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        gameCtx.globalAlpha = 1;
      }

      // Visible: apply vignette dimming
      if (level === 2) {
        var vig = vignette[li][lj];
        if (vig < 1.0) {
          gameCtx.globalAlpha = 1.0 - vig;
          var fogColor3 = CanvasTheme && CanvasTheme.tiles ? CanvasTheme.tiles.fogColor : themePalette.fogOverlay;
          gameCtx.fillStyle = fogColor3;
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
    if (level === 1) return CanvasTheme && CanvasTheme.tiles ? CanvasTheme.tiles.revealedDarkness : 0.4;
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

  // Draw shrine markers
  for (var ri = 0; ri < dungeon.rooms.length; ri++) {
    var room = dungeon.rooms[ri];
    if (room.type !== 'shrine') continue;
    if (!isRevealed(room.cx, room.cy, dungeon.revealed)) continue;
    var shrineKey = room.cx + ',' + room.cy;
    if (gameState.shrinesUsedThisFloor && gameState.shrinesUsedThisFloor[shrineKey]) continue;
    var alpha = entityAlpha(room.cx, room.cy);
    if (alpha <= 0) continue;
    var sx = room.cx * TILE_SIZE, sy = room.cy * TILE_SIZE;
    gameCtx.globalAlpha = alpha;
    drawShrineIcon(gameCtx, sx, sy);
    gameCtx.globalAlpha = 1;
  }

  // Draw shop merchant markers
  for (var ri = 0; ri < dungeon.rooms.length; ri++) {
    var room = dungeon.rooms[ri];
    if (room.type !== 'shop') continue;
    if (!isRevealed(room.cx, room.cy, dungeon.revealed)) continue;
    var alpha = entityAlpha(room.cx, room.cy);
    if (alpha <= 0) continue;
    var sx = room.cx * TILE_SIZE, sy = room.cy * TILE_SIZE;
    gameCtx.globalAlpha = alpha;
    drawShopMerchantIcon(gameCtx, sx, sy);
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
    drawStairsAt(gameCtx, sx, sy, theme, CanvasTheme && CanvasTheme.sprites ? CanvasTheme.sprites.stairGlow : (CanvasTheme ? CanvasTheme.palette.gold : PAL.gold));
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
        drawBossSprite(gameCtx, ex - 8, ey - 8, enemy.bossId || 'moss_giant', undefined, false, false, spritePal ? spritePal.enemy : null, getEnemySpriteData(enemy, false));
      } else {
        drawEnemySprite(gameCtx, ex, ey, enemy.type, undefined, false, false, spritePal ? spritePal.enemy : null, getEnemySpriteData(enemy, false));
      }
    } catch (e) {
      gameCtx.fillStyle = enemy.boss ? (CanvasTheme ? CanvasTheme.palette.danger : PAL.crimson) : (CanvasTheme ? CanvasTheme.palette.red : PAL.red);
      gameCtx.fillRect(ex + 2, ey + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }
    gameCtx.globalAlpha = 1;
  }

  // Draw player
  var px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
  var pState = player.state || 'idle';
  var facingLeft = player.dirX < 0;
  try {
    drawPlayerSprite(gameCtx, px, py, pState, false, facingLeft, spritePal ? spritePal.player : null, getPlayerSpriteData(false));
  } catch (e) {
    gameCtx.fillStyle = CanvasTheme ? CanvasTheme.palette.blue : PAL.blue;
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
  gameCtx.fillStyle = themePalette.minimapBorder;
  gameCtx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);

  // Background: #0a0a14
  gameCtx.fillStyle = themePalette.minimapBg;
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
    gameCtx.fillStyle = e.boss ? (CanvasTheme ? CanvasTheme.palette.danger : PAL.crimson) : (CanvasTheme ? CanvasTheme.palette.red : PAL.red);
    gameCtx.fillRect(mx + e.x * mm, my + e.y * mm, mm, mm);
  }

  // Items as yellow dots
  for (var i = 0; i < dungeon.items.length; i++) {
    var it = dungeon.items[i];
    if (!isRevealed(it.x, it.y, dungeon.revealed)) continue;
    gameCtx.fillStyle = CanvasTheme ? CanvasTheme.palette.gold : PAL.gold;
    gameCtx.fillRect(mx + it.x * mm, my + it.y * mm, mm, mm);
  }

  // Room type markers at room centers (visited or revealed)
  var roomTypeColor = {
    'shop': '#FFD700',      // gold
    'shrine': '#BF80FF',    // purple
    'loot': '#FFD700',      // gold
    'resting': '#69F0AE',   // green
    'trap': '#FF6E40',      // orange
    'combat': '#FF5252',    // red
  };
  var currentRoomIdx = -1;
  for (var ri = 0; ri < dungeon.rooms.length; ri++) {
    var room = dungeon.rooms[ri];
    var isCurrentRoom = (player.x >= room.x && player.x < room.x + room.w
                     && player.y >= room.y && player.y < room.y + room.h);
    if (isCurrentRoom) currentRoomIdx = ri;

    var centerRevealed = isRevealed(room.cx, room.cy, dungeon.revealed);
    if (!room.visited && !centerRevealed) continue;

    var color = roomTypeColor[room.type] || '#888888';
    var sx = mx + room.cx * mm;
    var sy = my + room.cy * mm;

    if (isCurrentRoom) {
      // Current room: bright outline ring (3x3 with hollow center)
      gameCtx.fillStyle = '#FFFFFF';
      gameCtx.fillRect(sx - 1, sy - 1, 5, 1);
      gameCtx.fillRect(sx - 1, sy + 3, 5, 1);
      gameCtx.fillRect(sx - 1, sy, 1, 3);
      gameCtx.fillRect(sx + 3, sy, 1, 3);
      // Inner dot in room type color
      gameCtx.fillStyle = color;
      gameCtx.fillRect(sx, sy, 3, 3);
    } else {
      // Visited room: small colored dot
      gameCtx.globalAlpha = 0.55;
      gameCtx.fillStyle = color;
      gameCtx.fillRect(sx, sy, mm, mm);
      gameCtx.globalAlpha = 1.0;
    }
  }

  // Player: bright white dot with blink (toggle every 600ms)
  var blink = Math.floor(Date.now() / 600) % 2;
  gameCtx.fillStyle = blink ? themePalette.playerDotA : themePalette.playerDotB;
  gameCtx.fillRect(mx + player.x * mm, my + player.y * mm, mm, mm);
}

// =====================
// Combat view
// =====================

function renderCombat() {
  refreshCanvasTheme();
  if (!combatState) return;
  var enemy = combatState.enemy;
  if (!enemy) return;

  // Dark dramatic gradient background
  var grd = gameCtx.createLinearGradient(0, 0, 0, CANVAS_H);
  grd.addColorStop(0, themePalette.void);
  grd.addColorStop(0.4, darken(themePalette.dark, 5));
  grd.addColorStop(1, themePalette.void);
  gameCtx.fillStyle = grd;
  gameCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Combat arena floor with tile pattern
  gameCtx.fillStyle = themePalette.dark;
  gameCtx.fillRect(40, 70, CANVAS_W - 80, CANVAS_H - 130);

  // Subtle tile lines on floor
  gameCtx.fillStyle = darken(themePalette.dark, 6);
  for (var tx = 40; tx < CANVAS_W - 40; tx += TILE_SIZE * 2) {
    gameCtx.fillRect(tx, 70, 1, CANVAS_H - 130);
  }
  for (var ty = 70; ty < CANVAS_H - 60; ty += TILE_SIZE * 2) {
    gameCtx.fillRect(40, ty, CANVAS_W - 80, 1);
  }

  // Floor edge
  gameCtx.fillStyle = lighten(themePalette.dark, 8);
  gameCtx.fillRect(40, 70, CANVAS_W - 80, 2);

  // Dust particles
  var dust = Math.floor(spriteAnimFrame / 8) % 3;
  gameCtx.globalAlpha = 0.15;
  gameCtx.fillStyle = themePalette.gray;
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
      var te = window.themeManager ? window.themeManager.getActive().effects : {};
      var auraBase = te.bossAuraColor || (CanvasTheme ? CanvasTheme.effects.bossAuraColor : 'rgba(200,30,30,0.3)');
      // Parse RGB from bossAuraColor for gradient stops
      var ar = 200, ag = 30, ab = 30;
      var rgbaMatch = auraBase.match(/rgba?\((\d+),(\d+),(\d+)/);
      if (rgbaMatch) { ar = parseInt(rgbaMatch[1]); ag = parseInt(rgbaMatch[2]); ab = parseInt(rgbaMatch[3]); }
      var aura = gameCtx.createRadialGradient(ebx, eby, 20, ebx, eby, 90);
      aura.addColorStop(0, 'rgba(' + ar + ',' + ag + ',' + ab + ',' + (pulse * 0.3) + ')');
      aura.addColorStop(0.5, 'rgba(' + Math.max(0,ar-50) + ',' + Math.max(0,ag-10) + ',' + Math.max(0,ab-10) + ',' + (pulse * 0.15) + ')');
      aura.addColorStop(1, 'rgba(' + Math.max(0,ar-100) + ',' + Math.max(0,ag-20) + ',' + Math.max(0,ab-20) + ',0)');
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
  var te = window.themeManager ? window.themeManager.getActive().effects : {};
  try {
    if (enemy.boss) {
      // Boss pulsing glow effect using shadowBlur
      var glowPulse = Math.sin(Date.now() / 300) * 0.5 + 0.5;
      gameCtx.shadowColor = te.glowEnabled ? (CanvasTheme ? CanvasTheme.palette.crimson : themePalette.crimson) : PAL.crimson;
      gameCtx.shadowBlur = te.glowEnabled ? te.glowBlur + glowPulse * te.glowBlur * 0.5 : 0;
      drawBossSprite(gameCtx, ex - 28, ey - 28, enemy.bossId || 'moss_giant', undefined, true, false, spritePal ? spritePal.enemy : null, getEnemySpriteData(enemy, true));
      gameCtx.shadowBlur = 0;
    } else {
      drawEnemySprite(gameCtx, ex, ey, enemy.type, undefined, true, false, spritePal ? spritePal.enemy : null, getEnemySpriteData(enemy, true));
    }
  } catch (e) {
    gameCtx.fillStyle = enemy.boss ? (CanvasTheme ? CanvasTheme.palette.danger : PAL.crimson) : (CanvasTheme ? CanvasTheme.palette.red : PAL.red);
    gameCtx.fillRect(ex, ey, 64, 64);
  }

  // Enemy name + HP bar -> HTML overlay

  // Player sprite on left
  var playerBob = Math.sin(spriteAnimFrame * 0.06 + 1) * 1;
  try {
    drawPlayerSprite(gameCtx, 80, CANVAS_H - 120 + playerBob, 'idle', true, false, spritePal ? spritePal.player : null, getPlayerSpriteData(true));
  } catch (e) {
    gameCtx.fillStyle = CanvasTheme ? CanvasTheme.palette.blue : themePalette.blue;
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
  var u = CanvasTheme ? CanvasTheme.palette : PAL;

  // Initialize child elements on first call
  if (!co.querySelector('.enemy-name')) {
    co.innerHTML =
      '<div class="enemy-name" style="position:absolute;top:15%;left:50%;transform:translateX(-50%);' +
      'font-size:8px;font-weight:bold;white-space:nowrap;text-align:center;"></div>' +
      '<div class="enemy-hp-bg" style="position:absolute;top:19%;left:50%;transform:translateX(-50%);' +
      'width:80px;height:6px;background:' + u.void + ';border:1px solid #000;"></div>' +
      '<div class="enemy-hp-fill" style="position:absolute;top:19%;left:50%;transform:translateX(-50%);' +
      'width:80px;height:6px;background:' + u.danger + ';transition:width 0.2s;"></div>' +
      '<div class="player-name" style="position:absolute;top:60%;left:28%;' +
      'font-size:8px;font-weight:bold;color:' + u.cyan + ';"></div>' +
      '<div class="player-hp-bg" style="position:absolute;top:63%;left:28%;' +
      'width:120px;height:6px;background:' + u.void + ';border:1px solid #000;"></div>' +
      '<div class="player-hp-fill" style="position:absolute;top:63%;left:28%;' +
      'width:120px;height:6px;background:' + u.heal + ';transition:width 0.2s;"></div>' +
      '<div class="player-mp-bg" style="position:absolute;top:67%;left:28%;' +
      'width:120px;height:4px;background:' + u.void + ';border:1px solid #000;"></div>' +
      '<div class="player-mp-fill" style="position:absolute;top:67%;left:28%;' +
      'width:120px;height:4px;background:' + u.info + ';transition:width 0.2s;"></div>' +
      '<div class="action-log" style="position:absolute;bottom:8%;left:2%;' +
      'font-size:8px;color:' + u.grayLt + ';white-space:nowrap;max-width:95%;overflow:hidden;text-overflow:ellipsis;"></div>';
  }

  co.style.display = 'block';
  var enemy = combatState.enemy;

  // Enemy name
  var en = co.querySelector('.enemy-name');
  if (en) {
    en.textContent = enemy.name + (enemy.boss ? ' ★' : '');
    en.style.color = enemy.boss ? u.gold : u.white;
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
    ehf.style.background = ehpR > 0.3 ? u.danger : u.red;
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
    phf.style.background = hpR > 0.3 ? u.heal : u.red;
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
