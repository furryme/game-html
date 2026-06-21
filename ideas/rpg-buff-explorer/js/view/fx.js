// fx.js — Particle system and screen effects

/** Resolve a color name (PAL key) to hex. Return as-is if already hex. */
function resolveColor(c) {
  if (!c) return '#fff';
  if (typeof c === 'string' && c[0] !== '#') return PAL[c] || '#fff';
  return c;
}

/** Resolve a target label ('enemy-sprite', 'player-sprite', 'center') to canvas pixel coords. */
function resolveTarget(target) {
  if (target === 'enemy-sprite') return { x: CANVAS_W / 2 - 32, y: 80 };
  if (target === 'player-sprite') return { x: 100, y: CANVAS_H - 120 };
  if (target === 'center') return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  return null;
}

const FX = {
  particles: [],

  /**
   * burst(target|canvasX, color|canvasY, [count], [speed], [life])
   * - burst('enemy-sprite', 'crimson') — simplified
   * - burst(200, 150, 10, '#f00') — classic canvas coords
   */
  burst(a, b, c, d, e, f) {
    let x, y, count, color, speed, life;
    if (typeof a === 'string') {
      const pos = resolveTarget(a);
      x = pos.x + 32; y = pos.y + 32;
      color = resolveColor(b);
      count = c || 8; speed = d || 2; life = e || 20;
    } else {
      x = a; y = b; count = c || 8; color = resolveColor(d); speed = e || 2; life = f || 20;
    }
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const spd = speed * (0.5 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life, maxLife: life,
        color,
        size: PIXEL,
        type: 'square',
      });
    }
  },

  /**
   * shake(target|intensity, [duration|intensity])
   * - shake('enemy-sprite', 3) — simplified (screen shake regardless of target)
   * - shake(3, 5) — classic
   */
  shake(a, b) {
    let intensity, duration;
    if (typeof a === 'string') {
      intensity = b || 3; duration = 5;
    } else {
      intensity = a || 2; duration = b || 5;
    }
    shakeX = 0; shakeY = 0;
    shakeIntensity = intensity;
    shakeDuration = duration;
  },

  /**
   * floatText(text, target|color) OR floatText(x, y, text, color)
   * - floatText('-5 暴击', 'enemy-sprite') — simplified
   * - floatText(200, 150, '-5', '#f00') — classic
   */
  floatText(a, b, c, d) {
    let x, y, text, color;
    if (typeof a === 'string' && typeof b === 'string') {
      text = a;
      const pos = resolveTarget(b);
      x = pos.x + 24; y = pos.y;
      color = resolveColor(c) || '#fff';
    } else {
      x = a; y = b; text = c; color = resolveColor(d);
    }
    this.particles.push({
      x, y,
      vx: 0, vy: -1,
      life: 40, maxLife: 40,
      text,
      color,
      type: 'text',
    });
  },

  flash(x, y, size, color) {
    this.particles.push({
      x, y, size: size || TILE_SIZE,
      vx: 0, vy: 0,
      life: 6, maxLife: 6,
      color: resolveColor(color),
      type: 'flash',
    });
  },

  ring(x, y, color) {
    this.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 15, maxLife: 15,
      color: resolveColor(color),
      type: 'ring',
      radius: 0,
    });
  },

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.type === 'ring') p.radius += 2;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (shakeDuration > 0) {
      shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeDuration--;
    } else {
      shakeX = 0; shakeY = 0;
    }
  },

  render(ctx) {
    for (const p of this.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      if (p.type === 'square') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = 'bold ' + (PIXEL * 2) + 'px monospace';
        ctx.fillText(p.text, p.x, p.y);
      } else if (p.type === 'flash') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = PIXEL;
        ctx.beginPath();
        ctx.arc(p.x + p.size / 2, p.y + p.size / 2, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },

  clear() {
    this.particles = [];
  },
};

let shakeX = 0, shakeY = 0, shakeIntensity = 0, shakeDuration = 0;
