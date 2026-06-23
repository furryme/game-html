// sprites.js — Pixel art sprite data and draw functions
// Compact string format: each char = palette index, rows joined by '|'
//   0-9  -> indices 0-9      (0=transparent, 9=skin)
//   a-z  -> indices 10-35    (a=10 skinShd, c=12 redDk, d=13 blue, etc.)
// Full palette: see SPRITE_PAL below

var spriteAnimFrame = 0;
function spriteAnimStep() {
  spriteAnimFrame++;
}

function isImageLoaded(spriteData) {
  if (!spriteData || !spriteData.image) return false;
  var img = spriteData.image;
  if (img instanceof HTMLImageElement) return img.complete && img.naturalWidth > 0;
  if (img instanceof HTMLCanvasElement) return img.width > 0;
  if (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas) return img.width > 0;
  return false;
}

var SPRITE_PAL = [
  '#0a0a1a', // 0  transparent (never drawn)
  '#0a0a1a', // 1  void
  '#1a1a2e', // 2  dark
  '#2a2a4a', // 3  midDark
  '#3a3a5a', // 4  grayDk
  '#6a6a8a', // 5  gray
  '#9a9aba', // 6  grayLt
  '#cadabd', // 7  light
  '#e8e8e8', // 8  white
  '#e8b890', // 9  skin
  '#c89060', // a  skinShd
  '#d43',     // b  red
  '#922',     // c  redDk
  '#35c',     // d  blue
  '#238',     // e  blueDk
  '#4a4',     // f  green
  '#373',     // g  greenDk
  '#f0c040', // h  gold
  '#a0b0c0', // i  steel
  '#8b5a3b', // j  brown
  '#5a3a1f', // k  brownDk
  '#5a5a6a', // l  stone
  '#7a7a8a', // m  stoneLt
  '#c8c0b0', // n  bone
  '#ff4444', // o  crimson
  '#00e5ff', // p  cyan
  '#d500f9', // q  magenta
  '#f7971e', // r  orange
  '#2ecc71', // s  emerald
  '#6c5ce7', // t  violet
  '#202030'  // u  eye
];

// ======================
// Parse compact string -> 2D grid
// ======================

function parseSprite(dataStr) {
  var rows = dataStr.split('|');
  var grid = [];
  for (var r = 0; r < rows.length; r++) {
    var row = [];
    for (var c = 0; c < rows[r].length; c++) {
      var ch = rows[r][c];
      var idx;
      if (ch >= '0' && ch <= '9') {
        idx = ch.charCodeAt(0) - 48;
      } else if (ch >= 'a' && ch <= 'z') {
        idx = ch.charCodeAt(0) - 87;
      } else {
        idx = 0;
      }
      row.push(idx);
    }
    grid.push(row);
  }
  return grid;
}

// ======================
// Player sprites
// ======================

// Map sprites: 8x12, scale 1x (fits 16px tile)
// Helmet (i=steel), body armor (d=blue, e=blueDk), sword (i=steel) in right hand, boots (k=brownDk)

// idle-0: hands at side, sword ready, weight center
var playerMapIdle0 = '000ii000|00iii000|00i8u000|00999000|0iddddi8|0idd8ddi|00deed00|00eee000|00ddd000|00ee0000|00kk0k00';

// idle-1: slight bob, left hand drops, weight shifts left
var playerMapIdle1 = '000ii000|00iii000|00i8u000|00999000|0iddddi0|iddd8ddi|idddeedd|00deed00|00ddd000|000dd000|00kk0k00';

// walk-0: right leg forward, sword swings forward
var playerMapWalk0 = '000ii000|00iii000|00i8u000|00999000|idddddi0|iddd8dd0|0ddeed0i|00de0000|000dd000|0000d000|000kk000';

// walk-1: left leg forward, sword swings back
var playerMapWalk1 = '000ii000|00iii000|00i8u000|00999000|00ddddd8|0idd8ddi|0ddeeddi|00d00000|000dd000|00dd0000|0k0000k0';

// attack: lunge right, sword thrust
var playerMapAttack = '000ii000|00iii000|00i8u8u0|00999900|idd0dddd|idd0dd8i|0ddeed8i|000000ii|00ddd000|00ee0000|00kk0k00';

// hurt: flash white, recoil left
var playerMapHurt = '000ii000|00iii000|00i8b800|00b9b900|0iddddi8|0ibd8ddi|00deed00|00eee000|00ddd000|00ee0000|00kk0k00';

// Combat sprites: 10x14, scale 2x (32px rendered)
// More detail: visor, shoulder pads, belt buckle, layered cape, sword tip

// idle-0: standing tall, cape behind, hands on hips
var playerCombatIdle0 = '0000ii0000|000iii0000|00ii8uu000|00iiiii000|0009999000|0idd0ddddi|idd0dddddi|idddeeeddi|00deeeed00|000ddddd00|00deedde00|000eeeee00|00kkeeek00|00kkeeek00';

// idle-1: slight bob, cape flows, sword shifts
var playerCombatIdle1 = '0000ii0000|000iii0000|00ii8uu000|00iiiii000|0009999000|0idd0dddd0|idd0dddddi|idddeeeddi|00deedde00|000ddddd00|00ddeedd00|0000eeee00|00kk00kk00|00kk00kk00';

// walk-0: right leg forward, cape swings left, sword back
var playerCombatWalk0 = '0000ii0000|000iii0000|00ii8uu000|00iiiii000|0009999000|idd0dddddi|idd0ddddei|iddeeedddi|00d0000000|000dd00000|00ddd00000|00dd000000|00000kkek0|00000kkek0';

// walk-1: left leg forward, cape swings right, sword forward
var playerCombatWalk1 = '0000ii0000|000iii0000|00ii8uu000|00iiiii000|0009999000|0idd0ddddi|idd0dddddi|idddeeeddi|00deedd000|000ddddd00|00deeddd00|00eeeee000|00kkekk000|00kkekk000';

// attack: lunge right, sword extended forward
var playerCombatAttack = '0000ii0000|000iii0000|00ii8uuu00|00iiiii000|0009999900|idd0dddddi|idd0ddddd8|iddeeeddii|00000000ii|000ddddd00|00deeddd00|000eeee000|00kkeeek00|00kkeeek00';

// hurt: flash, recoil
var playerCombatHurt = '0000ii0000|000iii0000|00ii8b8u00|00iiiii000|000b99b000|0idd0ddddi|ibb0dddddi|idddeeeddi|00deeeed00|000ddddd00|00deedde00|000eeeee00|00kkeeek00|00kkeeek00';

// ======================
// Enemy sprites: 8x8
// ======================
// Each: { idle: [str0, str1], death: str }

var enemySlime = {
  idle: [
    '000ff000|00ffff00|0fsfsf00|ffffffff|ffsffsff|ffffffsf|0sffffff|00gggg00',
    '000ff000|00ffff00|0fssffs0|ffffffff|fssffsff|ffffffsf|0ffffffs|00gggg00'
  ],
  death: '00000000|00000000|00000000|00ffff00|0ffffff0|ffffffff|0ffffff0|00gggg00'
};

var enemySkeleton = {
  idle: [
    '0nnnn000|nnuuunnn|0nnnn000|00nnn000|00nlmn00|nnnnnnnn|nn0nn0n0|n0000n00',
    '0nnnn000|nnuuunnn|0nnnn000|00nnn000|00nlln00|nnnnnnnn|00nnnn00|0n0000n0'
  ],
  death: '0nnnn000|nnuu0uun|0nnn0000|000nn000|0nllln00|0nnnnn00|0n000n00|00000000'
};

var enemySpider = {
  idle: [
    '000ll000|0lloool0|000ll400|l0ll4l04|0llll400|000ll000|l00ll00l|0l000l00',
    '000ll000|0lloool0|000ll400|0l0040l0|0llll400|000ll000|0l0000l0|00llll00'
  ],
  death: '00000000|000ll000|0lloool0|000ll400|0lllll00|000ll000|00000000|00000000'
};

var enemyDemon = {
  idle: [
    't00000t0|tt222ttt|0t2oo2t0|00tttt00|00222000|0tttttt0|00200200|00022000',
    't00000t0|tt222ttt|0t2oo2t0|00tttt00|00266200|0tttttt0|00202000|00020200'
  ],
  death: '00000000|00222000|002oo000|00tttt00|00266200|0ttttt00|00200200|00000000'
};

// ======================
// Boss sprites: 16x16
// ======================

var bossMossGiant = {
  idle: [
    // 0: head slightly up, tongue tip visible
    '0000000000000000|00000ffs00000000|0000ffs000000000|00ffs00000000000|00f0000000000000|00000jjjj0000000|0000jjfj0jj00000|000jjffjffj0j000|00jffjfjfjffj000|00jffjffjffj0j00|000jjfjfjfj0j000|00000jjjjj000000|00000j0j0j0j0000|000000kkkk000000|0000000000000000|0000000000000000',
    // 1: head lowered, body shifts
    '0000000000000000|0000000000000000|00000ffs00000000|0000ff0s00000000|000f000000000000|000000jjjj000000|00000jjfjjj00000|0000jjfjffjj0000|000jffjfjfjff000|000jffjffjffj000|000jjfjfjfj0j000|00000jjjjj000000|00000jjj0j000000|00000kkkkk000000|0000000000000000|0000000000000000'
  ],
  death: '0000000000000000|0000000000000000|00000ffs00000000|0000ff0000000000|0000000000000000|00000jjjj0000000|000jjfjffj0j0000|00jffjfjfjff0000|00jffjffjffj0000|00jffjfjfjfj0000|000jjfjfjfj00000|00000jjjj0000000|00000j0j0j000000|00000kkkk0000000|0000000000000000|0000000000000000'
};

var bossShadowMage = {
  idle: [
    // 0: hat tall, robe flowing
    '0000002t00000000|000002ttt0000000|00002ttttt000000|0002tttttt000000|00000tttp2000000|00000t222t000000|0002ttttttt00000|002ttttttttt0000|002tttttttttt000|02ttttttttttt000|002ttttttttt0000|0002tttttt200000|00002tttt2000000|000002tt20000000|00002tttt2000000|0000222222000000',
    // 1: hat tilts, robe billows
    '0000002t20000000|000002tttt000000|00002tttttt00000|002ttttttt000000|00000tttp2000000|00000t222t000000|0002ttttttt00000|002ttttttttt0000|002tttttttttt000|002tttttttttt000|0002ttttttt20000|0002ttttttt20000|00002tttt2000000|000002tt20000000|00002tttttt00000|0000222222200000'
  ],
  death: '0000000000000000|0000000t2t000000|000000ttttt00000|00000tttttt00000|00000tttp0000000|0000000000000000|00000t222t000000|00002tttttt00000|0002tttttttt2000|002tttttttttt000|002ttttttttt2000|0002ttttttt20000|00002tttt2000000|000002tt20000000|00002ttttt000000|0000222222000000'
};

var bossGreedKing = {
  idle: [
    // 0: crown upright, robe regal
    '00000h0h0h000000|00000hhhhh000000|00000hohh0000000|0000009990000000|000000oo00000000|0000hbbbbbbb0000|000hbbbbbbbb0000|00hbbbbbbbbbb000|0hbbbbbbbbbbb000|00hbbbbbbbbb0000|00000cccccc00000|0000hbbbbbbb0000|000hbbbbbbbb0000|0000hbbbb0000000|00000bbbb0000000|000000bb00000000',
    // 1: crown tilts, robe flares
    '00000h0h0h000000|00000hhhhh000000|00000hhooh000000|0000009990000000|0000009o90000000|0000hbbbbbbb0000|000hbbbbbbbb0000|00hbbbbbbbbbb000|00hbbbbbbbbbbb00|00hbbbbbbbbb0000|00000cccccc00000|0000hbbbbbbb0000|000hbbbbbbbb0000|0000hbbbb0000000|00000bbb00000000|0000000bb0000000'
  ],
  death: '0000000000000000|00000h0h0h000000|00000hhhhh000000|000000ooh0000000|0000009990000000|0000hbbbbbbb0000|000hbbbbbbbb0000|00hbbbbbbbb00000|00hbbbbbbb000000|00000cccccc00000|0000hbbbbbbb0000|000hbbbbbb000000|0000hbbbb0000000|00000bbbb0000000|000000bb00000000|0000000000000000'
};

// ======================
// Enemy type -> sprite group mapping
// ======================

var enemySpriteGroup = {
  slime: 'slime', bat: 'slime', mole: 'slime',
  skeleton: 'skeleton', goblin: 'skeleton',
  spider: 'spider', hound: 'spider',
  archer: 'demon', ghost: 'demon', golem: 'demon',
  voodoo: 'demon', assassin: 'demon'
};

function getEnemySpriteGroup(type) {
  return enemySpriteGroup[type] || 'slime';
}

// ======================
// Collapse helper (for death effects)
// ======================

function collapsePattern(pattern) {
  var rows = [];
  for (var i = 0; i < pattern.length; i++) {
    rows.push(pattern[i].slice());
  }
  var nonEmpty = [];
  for (var i = 1; i < rows.length - 1; i++) {
    var hasPixel = false;
    for (var j = 0; j < rows[i].length; j++) {
      if (rows[i][j]) { hasPixel = true; break; }
    }
    if (hasPixel) nonEmpty.push(rows[i]);
  }
  var result = [];
  var startRow = Math.floor((pattern.length - nonEmpty.length) / 2);
  for (var i = 0; i < startRow; i++) {
    result.push(new Array(pattern[0].length).fill(0));
  }
  for (var i = 0; i < nonEmpty.length; i++) {
    result.push(nonEmpty[i]);
  }
  var endPad = pattern.length - result.length;
  for (var i = 0; i < endPad; i++) {
    result.push(new Array(pattern[0].length).fill(0));
  }
  return result.length === pattern.length ? result : pattern.slice();
}

// ======================
// Draw functions
// ======================

function drawSprite(ctx, x, y, pattern, palette, opts) {
  opts = opts || {};
  var alpha = opts.alpha !== undefined ? opts.alpha : 1;
  var flip = opts.flip || false;

  if (alpha < 1) {
    ctx.globalAlpha = alpha;
  }

  if (opts.spriteData && isImageLoaded(opts.spriteData)) {
    var sd = opts.spriteData;
    ctx.save();
    if (flip) {
      ctx.translate(x + sd.w, y);
      ctx.scale(-1, 1);
    }
    if (sd.sx !== undefined) {
      ctx.drawImage(sd.image, sd.sx, sd.sy, sd.sw, sd.sh, flip ? 0 : x, flip ? 0 : y, sd.w, sd.h);
    } else {
      ctx.drawImage(sd.image, flip ? 0 : x, flip ? 0 : y, sd.w, sd.h);
    }
    ctx.restore();
    if (alpha < 1) ctx.globalAlpha = 1;
    return;
  }

  var scale = opts.scale || 1;
  var p = PIXEL * scale;

  ctx.save();
  if (flip) {
    ctx.translate(x + pattern[0].length * p, y);
    ctx.scale(-1, 1);
    x = 0;
    y = 0;
  }

  for (var r = 0; r < pattern.length; r++) {
    for (var c = 0; c < pattern[r].length; c++) {
      var colorIdx = pattern[r][c];
      if (!colorIdx) continue;
      ctx.fillStyle = palette[colorIdx];
      ctx.fillRect(x + c * p, y + r * p, p, p);
    }
  }
  ctx.restore();
  if (alpha < 1) {
    ctx.globalAlpha = 1;
  }
}

function drawPlayerSprite(ctx, x, y, state, isCombat, flip, pal, spriteData) {
  var f = spriteAnimFrame;

  if (spriteData && spriteData.image && isImageLoaded(spriteData)) {
    var animCfg = spriteData.combatAnimations ? spriteData.combatAnimations[state] : spriteData.animations[state];
    if (!animCfg) animCfg = spriteData.combatAnimations ? spriteData.combatAnimations.idle : spriteData.animations.idle;
    if (animCfg && animCfg.frames) {
      var speed = animCfg.speed || 10;
      var frameIdx = Math.floor(f / speed) % animCfg.frames.length;
      var frameNum = animCfg.frames[frameIdx];
      var sdW = isCombat ? (spriteData.combatFrameW || spriteData.frameW || 32) : (spriteData.frameW || 32);
      var sdH = isCombat ? (spriteData.combatFrameH || spriteData.frameH || 48) : (spriteData.frameH || 32);
      var totalFrames = animCfg.frames.length;
      var spriteOpts = {
        spriteData: {
          image: spriteData.image,
          sx: frameNum * sdW,
          sy: 0,
          sw: sdW,
          sh: sdH,
          w: sdW,
          h: sdH
        }
      };
      var tileSize = isCombat ? 64 : TILE_SIZE;
      var ox = x + (tileSize - sdW) / 2;
      var oy = y + (tileSize - sdH) / 2;
      var palUse = pal || SPRITE_PAL;
      if (!pal && player && player.cls) {
        if (player.cls === 'mage') palUse = getClassPalette('mage');
        else if (player.cls === 'rogue') palUse = getClassPalette('rogue');
      }
      drawSprite(ctx, ox, oy, null, palUse, spriteOpts);
      return;
    }
  }

  var pattern, scale, frame;

  if (isCombat) {
    scale = 2;
    switch (state) {
      case 'idle':   frame = (Math.floor(f / 10) % 2 === 0) ? 0 : 1;
                     pattern = [playerCombatIdle0, playerCombatIdle1][frame]; break;
      case 'walk':   frame = (Math.floor(f / 6) % 2 === 0) ? 0 : 1;
                     pattern = [playerCombatWalk0, playerCombatWalk1][frame]; break;
      case 'attack': pattern = playerCombatAttack; break;
      case 'hurt':   pattern = playerCombatHurt; break;
      default:       pattern = playerCombatIdle0; break;
    }
  } else {
    scale = 1;
    switch (state) {
      case 'idle':   frame = (Math.floor(f / 10) % 2 === 0) ? 0 : 1;
                     pattern = [playerMapIdle0, playerMapIdle1][frame]; break;
      case 'walk':   frame = (Math.floor(f / 6) % 2 === 0) ? 0 : 1;
                     pattern = [playerMapWalk0, playerMapWalk1][frame]; break;
      case 'attack': pattern = playerMapAttack; break;
      case 'hurt':   pattern = playerMapHurt; break;
      default:       pattern = playerMapIdle0; break;
    }
  }

  var grid = typeof pattern === 'string' ? parseSprite(pattern) : pattern;
  var w = grid[0].length * PIXEL * scale;
  var h = grid.length * PIXEL * scale;
  var tileSize = TILE_SIZE * (isCombat ? 2 : 1);
  var ox = x + (tileSize - w) / 2;
  var oy = y + (tileSize - h) / 2;

  var palette = pal || SPRITE_PAL;
  if (!pal && player && player.cls) {
    if (player.cls === 'mage') {
      palette = getClassPalette('mage');
    } else if (player.cls === 'rogue') {
      palette = getClassPalette('rogue');
    }
  }

  drawSprite(ctx, ox, oy, grid, palette, { scale: scale, flip: flip || false });
}

function drawEnemySprite(ctx, x, y, enemyType, frame, isCombat, isDead, pal, spriteData) {
  var f = spriteAnimFrame;

  if (spriteData && spriteData.image && isImageLoaded(spriteData) && !isDead) {
    var animCfg = spriteData.combatAnimations ? spriteData.combatAnimations.idle : spriteData.animations.idle;
    if (animCfg && animCfg.frames) {
      var speed = animCfg.speed || 15;
      var frameIdx = Math.floor(f / speed) % animCfg.frames.length;
      var frameNum = animCfg.frames[frameIdx];
      var sdW = isCombat ? (spriteData.combatFrameW || spriteData.frameW || 32) : (spriteData.frameW || 32);
      var sdH = isCombat ? (spriteData.combatFrameH || spriteData.frameH || 32) : (spriteData.frameH || 32);
      var spriteOpts = {
        spriteData: {
          image: spriteData.image,
          sx: frameNum * sdW,
          sy: 0,
          sw: sdW,
          sh: sdH,
          w: sdW,
          h: sdH
        }
      };
      var targetW = isCombat ? 64 : TILE_SIZE;
      var targetH = isCombat ? 64 : TILE_SIZE;
      var ox = x + (targetW - sdW) / 2;
      var oy = y + (targetH - sdH) / 2;
      drawSprite(ctx, ox, oy, null, pal || SPRITE_PAL, spriteOpts);
      return;
    }
  }

  var group = getEnemySpriteGroup(enemyType);
  var data;
  switch (group) {
    case 'slime':     data = enemySlime; break;
    case 'skeleton':  data = enemySkeleton; break;
    case 'spider':    data = enemySpider; break;
    case 'demon':     data = enemyDemon; break;
    default:          data = enemySlime; break;
  }

  var pattern;
  if (isDead) {
    pattern = data.death;
  } else {
    var fi = (frame !== undefined ? frame : Math.floor(spriteAnimFrame / 15) % 2);
    pattern = data.idle[fi % data.idle.length];
  }

  var grid = typeof pattern === 'string' ? parseSprite(pattern) : pattern;
  var scale = isCombat ? 2 : 1;
  var w = grid[0].length * PIXEL * scale;
  var h = grid.length * PIXEL * scale;
  var targetW = isCombat ? 64 : TILE_SIZE;
  var targetH = isCombat ? 64 : TILE_SIZE;
  var ox = x + (targetW - w) / 2;
  var oy = y + (targetH - h) / 2;

  drawSprite(ctx, ox, oy, grid, pal || SPRITE_PAL, { scale: scale });
}

function drawBossSprite(ctx, x, y, bossId, frame, isCombat, isDead, pal, spriteData) {
  var f = spriteAnimFrame;

  if (spriteData && spriteData.image && isImageLoaded(spriteData) && !isDead) {
    var animCfg = spriteData.combatAnimations ? spriteData.combatAnimations.idle : spriteData.animations.idle;
    if (animCfg && animCfg.frames) {
      var speed = animCfg.speed || 20;
      var frameIdx = Math.floor(f / speed) % animCfg.frames.length;
      var frameNum = animCfg.frames[frameIdx];
      var sdW = isCombat ? (spriteData.combatFrameW || spriteData.frameW || 64) : (spriteData.frameW || 64);
      var sdH = isCombat ? (spriteData.combatFrameH || spriteData.frameH || 64) : (spriteData.frameH || 64);
      var spriteOpts = {
        spriteData: {
          image: spriteData.image,
          sx: frameNum * sdW,
          sy: 0,
          sw: sdW,
          sh: sdH,
          w: sdW,
          h: sdH
        },
        alpha: 1
      };
      var targetW = isCombat ? 120 : TILE_SIZE * 2;
      var targetH = isCombat ? 120 : TILE_SIZE * 2;
      var ox = x + (targetW - sdW) / 2;
      var oy = y + (targetH - sdH) / 2;
      drawSprite(ctx, ox, oy, null, pal || SPRITE_PAL, spriteOpts);
      return;
    }
  }

  var data;
  switch (bossId) {
    case 'moss_giant':  data = bossMossGiant; break;
    case 'shadow_mage': data = bossShadowMage; break;
    case 'greed_king':  data = bossGreedKing; break;
    default:            data = bossMossGiant; break;
  }

  var pattern;
  if (isDead) {
    pattern = data.death;
  } else {
    var fi = (frame !== undefined ? frame : Math.floor(spriteAnimFrame / 20) % 2);
    pattern = data.idle[fi % data.idle.length];
  }

  var grid = typeof pattern === 'string' ? parseSprite(pattern) : pattern;
  var scale = isCombat ? 1 : 0.5;
  var w = grid[0].length * PIXEL * scale;
  var h = grid.length * PIXEL * scale;
  var targetW = isCombat ? 120 : TILE_SIZE * 2;
  var targetH = isCombat ? 120 : TILE_SIZE * 2;
  var ox = x + (targetW - w) / 2;
  var oy = y + (targetH - h) / 2;

  var opts = { scale: scale };
  if (isDead) opts.alpha = 0.6;
  drawSprite(ctx, ox, oy, grid, pal || SPRITE_PAL, opts);
}

// ======================
// Color utilities
// ======================

function hexToRgb(hex) {
  hex = (hex || '#000').replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(function(c) {
    var h = Math.max(0,Math.min(255,Math.round(c))).toString(16);
    return h.length < 2 ? '0'+h : h;
  }).join('');
}

function shiftHue(hex, degrees) {
  var rgb = hexToRgb(hex);
  var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s = max === 0 ? 0 : (max - min) / max, l = (max + min) / 2;

  if (max === min) {
    h = 0;
  } else {
    var d = max - min;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }

  h = (h + degrees) % 360;
  if (h < 0) h += 360;

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  var r1 = hue2rgb(p, q, h / 360 + 1/3);
  var g1 = hue2rgb(p, q, h / 360);
  var b1 = hue2rgb(p, q, h / 360 - 1/3);

  return rgbToHex(r1 * 255, g1 * 255, b1 * 255);
}

// ======================
// Theme-based sprite palette
// ======================

function getThemeSpritePalette(theme, playerClass) {
  var pPlayer = SPRITE_PAL.slice();
  var pEnemy = SPRITE_PAL.slice();

  // Apply warrior class colors from theme to player palette
  if (theme && theme.palette && theme.palette.classColors) {
    var cc = theme.palette.classColors;
    if (cc.warrior) {
      var w = hexToRgb(cc.warrior);
      pPlayer[13] = cc.warrior;
      pPlayer[14] = rgbToHex(w[0] * 0.7, w[1] * 0.7, w[2] * 0.7);
      var wMax = Math.max(w[0], w[1], w[2]);
      pPlayer[30] = rgbToHex(
        Math.min(255, wMax + (255 - wMax) * 0.4),
        Math.min(255, w[1] + (255 - w[1]) * 0.3),
        Math.min(255, w[2] + (255 - w[2]) * 0.3)
      );
    }
  }

  // Apply player class override (mage/rogue override theme colors)
  if (playerClass === 'mage') {
    pPlayer[14] = '#6644cc';
    pPlayer[15] = '#4422aa';
    pPlayer[30] = '#8866ee';
  } else if (playerClass === 'rogue') {
    pPlayer[14] = '#22aa44';
    pPlayer[15] = '#118833';
    pPlayer[30] = '#44cc66';
  }

  // Apply enemy hue shift
  if (theme && theme.sprites && theme.sprites.enemyHueShift) {
    var hs = theme.sprites.enemyHueShift;
    for (var i = 0; i < pEnemy.length; i++) {
      pEnemy[i] = shiftHue(pEnemy[i], hs);
    }
  }

  return { player: pPlayer, enemy: pEnemy };
}

window.getThemeSpritePalette = getThemeSpritePalette;

// ======================
// Class-specific sprite palettes
// ======================

function getClassPalette(cls) {
  var palette = SPRITE_PAL.slice();
  if (cls === 'mage') {
    palette[14] = '#6644cc';
    palette[15] = '#4422aa';
    palette[30] = '#8866ee';
    return palette;
  } else if (cls === 'rogue') {
    palette[14] = '#22aa44';
    palette[15] = '#118833';
    palette[30] = '#44cc66';
    return palette;
  }
  return SPRITE_PAL;
}

window.getClassPalette = getClassPalette;
