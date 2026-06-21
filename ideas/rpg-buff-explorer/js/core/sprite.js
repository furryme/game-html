// sprite.js — Pixel sprite rendering engine

/**
 * Draw a pixel-art sprite on canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x — top-left x in pixels
 * @param {number} y — top-left y in pixels
 * @param {number[][]} pattern — 2D array where 0 = transparent, positive = palette index, (0,1) = alpha color
 * @param {Object} palette — mapping: index -> hex color string
 * @param {Object} [opts] — { flip, alpha, scale }
 */
function drawSprite(ctx, x, y, pattern, palette, opts) {
  opts = opts || {};
  var flip = opts.flip || false;
  var alpha = opts.alpha !== undefined ? opts.alpha : 1;
  var scale = opts.scale || 1;
  var p = PIXEL * scale;

  ctx.globalAlpha = alpha;

  if (flip) {
    ctx.save();
    ctx.translate(x + pattern[0].length * p, y);
    ctx.scale(-1, 1);
    x = 0;
  }

  for (var row = 0; row < pattern.length; row++) {
    for (var col = 0; col < pattern[row].length; col++) {
      var idx = pattern[row][col];
      if (!idx) continue;
      if (idx < 1) {
        ctx.globalAlpha = alpha * idx;
        ctx.fillStyle = palette['_alpha'] || '#a0b8d8';
      } else {
        ctx.fillStyle = palette[idx];
      }
      ctx.fillRect(x + col * p, y + row * p, p, p);
    }
  }

  if (flip) ctx.restore();
  ctx.globalAlpha = 1;
}

/** Draw a solid pixel-aligned rectangle. */
function pixelRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(
    Math.floor(x / PIXEL) * PIXEL,
    Math.floor(y / PIXEL) * PIXEL,
    w * PIXEL,
    h * PIXEL
  );
}
