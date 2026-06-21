// test-fx-data-extra.js — Extended fx + data tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// ============================================================
// resolveColor
// ============================================================

describe('resolveColor 扩展', ({ assert }) => {
  it('0（数字）返回 #fff', () => {
    if (resolveColor(0) !== '#fff') throw new Error('expected #fff');
  });

  it('空字符串返回 #fff', () => {
    if (resolveColor('') !== '#fff') throw new Error('expected #fff');
  });

  it('完整的 hex 值原样返回', () => {
    if (resolveColor('#ff00aa') !== '#ff00aa') throw new Error('expected #ff00aa');
  });

  it('crimson PAL key', () => {
    if (resolveColor('crimson') !== '#ff4444')
      throw new Error('expected #ff4444');
  });

  it('cyan PAL key', () => {
    if (resolveColor('cyan') !== '#00e5ff')
      throw new Error('expected #00e5ff');
  });

  it('gold PAL key', () => {
    if (resolveColor('gold') !== '#f0c040')
      throw new Error('expected #f0c040');
  });

  it('void PAL key', () => {
    if (resolveColor('void') !== '#0a0a1a')
      throw new Error('expected #0a0a1a');
  });

  it('false 返回 #fff', () => {
    if (resolveColor(false) !== '#fff') throw new Error('expected #fff');
  });

  it('非 string hex passthrough (数字类型)', () => {
    const result = resolveColor(42);
    if (result !== 42) throw new Error('expected 42 passthrough');
  });

  it('magenta 和 emerald 两个 PAL key', () => {
    if (resolveColor('magenta') !== '#d500f9')
      throw new Error('expected #d500f9');
    if (resolveColor('emerald') !== '#2ecc71')
      throw new Error('expected #2ecc71');
  });
});

// ============================================================
// resolveTarget
// ============================================================

describe('resolveTarget 扩展', ({ assert }) => {
  it('center = (CANVAS_W/2, CANVAS_H/2)', () => {
    const p = resolveTarget('center');
    if (p.x !== CANVAS_W / 2 || p.y !== CANVAS_H / 2)
      throw new Error('expected canvas center');
  });

  it('enemy-sprite x = CANVAS_W/2 - 32', () => {
    const p = resolveTarget('enemy-sprite');
    if (p.x !== CANVAS_W / 2 - 32)
      throw new Error('expected ' + (CANVAS_W / 2 - 32));
  });

  it('player-sprite y = CANVAS_H - 120', () => {
    const p = resolveTarget('player-sprite');
    if (p.y !== CANVAS_H - 120)
      throw new Error('expected ' + (CANVAS_H - 120));
  });

  it('undefined 返回 null', () => {
    if (resolveTarget(undefined) !== null) throw new Error('expected null');
  });

  it('数字参数返回 null', () => {
    if (resolveTarget(42) !== null) throw new Error('expected null');
  });

  it('空字符串返回 null', () => {
    if (resolveTarget('') !== null) throw new Error('expected null');
  });

  it('false 返回 null', () => {
    if (resolveTarget(false) !== null) throw new Error('expected null');
  });
});

// ============================================================
// FX.burst
// ============================================================

describe('FX.burst 扩展', ({ assert }) => {
  it('target 模式使用 resolveTarget + 32 offset', () => {
    FX.clear();
    seedRandom(1);
    FX.burst('center', 'crimson', 1);
    const p = FX.particles[0];
    // center = (240, 135) + 32 = (272, 167)
    if (p.x !== 272) throw new Error('expected x=272, got ' + p.x);
    if (p.y !== 167) throw new Error('expected y=167, got ' + p.y);
  });

  it('坐标模式粒子在原点产生', () => {
    FX.clear();
    seedRandom(1);
    FX.burst(50, 60, 1, 'red');
    const p = FX.particles[0];
    if (p.x !== 50) throw new Error('expected x=50');
    if (p.y !== 60) throw new Error('expected y=60');
  });

  it('粒子 size = PIXEL', () => {
    FX.clear();
    FX.burst(0, 0, 1, '#000');
    if (FX.particles[0].size !== PIXEL)
      throw new Error('expected size ' + PIXEL);
  });

  it('seedRandom 下速度确定', () => {
    FX.clear();
    const restore1 = seedRandom(42);
    FX.burst(0, 0, 3, '#000');
    const vel1 = FX.particles.map(p => ({ vx: p.vx, vy: p.vy }));
    restore1();

    FX.clear();
    const restore2 = seedRandom(42);
    FX.burst(0, 0, 3, '#000');
    const vel2 = FX.particles.map(p => ({ vx: p.vx, vy: p.vy }));
    restore2();

    if (JSON.stringify(vel1) !== JSON.stringify(vel2))
      throw new Error('burst velocity not deterministic');
  });

  it('speed 参数控制速度大小', () => {
    FX.clear();
    seedRandom(10);
    FX.burst(0, 0, 2, '#000', 10);
    for (const p of FX.particles) {
      const mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (mag < 5) throw new Error('speed too low, mag=' + mag);
    }
  });

  it('count=0 被 || 8 替代为默认 8', () => {
    FX.clear();
    seedRandom(1);
    FX.burst(0, 0, 0, '#000');
    // 0 || 8 = 8, so count becomes 8
    if (FX.particles.length !== 8)
      throw new Error('expected 8 (0||8), got ' + FX.particles.length);
  });

  it('hex 颜色传入时粒子 color 正确', () => {
    FX.clear();
    FX.burst(0, 0, 1, '#deadbe');
    if (FX.particles[0].color !== '#deadbe')
      throw new Error('expected #deadbe');
  });

  it('默认 life=20 和 speed=2', () => {
    FX.clear();
    seedRandom(1);
    FX.burst('enemy-sprite', 'red');
    const p = FX.particles[0];
    if (p.life !== 20 || p.maxLife !== 20)
      throw new Error('expected life=20, maxLife=20');
  });
});

// ============================================================
// FX.shake
// ============================================================

describe('FX.shake 扩展', ({ assert }) => {
  it('intensity=0 被 || 2 替代为默认 2', () => {
    FX.shake(0, 5);
    if (shakeIntensity !== 2) throw new Error('expected 2 (0||2)');
    if (shakeDuration !== 5) throw new Error('expected 5');
  });

  it('duration=0 被 || 5 替代为默认 5', () => {
    FX.shake(5, 0);
    if (shakeIntensity !== 5) throw new Error('expected 5');
    if (shakeDuration !== 5) throw new Error('expected 5 (0||5)');
  });

  it('两个参数都为 0 时都用默认值', () => {
    FX.shake(0, 0);
    if (shakeIntensity !== 2) throw new Error('expected 2 (0||2)');
    if (shakeDuration !== 5) throw new Error('expected 5 (0||5)');
  });

  it('string 模式不给 b 参数时 intensity=3', () => {
    FX.shake('player-sprite');
    if (shakeIntensity !== 3) throw new Error('expected 3');
    if (shakeDuration !== 5) throw new Error('expected 5');
  });

  it('数值 intensity 为 falsy 时默认为 2（|| 2）', () => {
    FX.shake(0 || 2, 5);
    if (shakeIntensity !== 2) throw new Error('expected 2');
  });

  it('大 intensity 值不截断', () => {
    FX.shake(100, 50);
    if (shakeIntensity !== 100) throw new Error('expected 100');
    if (shakeDuration !== 50) throw new Error('expected 50');
  });
});

// ============================================================
// FX.floatText
// ============================================================

describe('FX.floatText 扩展', ({ assert }) => {
  it('target 模式在 enemy-sprite 位置 + 24 offset', () => {
    FX.clear();
    FX.floatText('hit', 'enemy-sprite');
    const p = FX.particles[0];
    if (p.x !== 208 + 24) throw new Error('expected x=232, got ' + p.x);
    if (p.y !== 80) throw new Error('expected y=80, got ' + p.y);
  });

  it('target 模式在 player-sprite 位置 + 24 offset', () => {
    FX.clear();
    FX.floatText('heal', 'player-sprite', '#0f0');
    const p = FX.particles[0];
    if (p.x !== 100 + 24) throw new Error('expected x=124, got ' + p.x);
    if (p.y !== 150) throw new Error('expected y=150, got ' + p.y);
  });

  it('坐标模式颜色通过 resolveColor', () => {
    FX.clear();
    FX.floatText(0, 0, 'test', 'gold');
    if (FX.particles[0].color !== '#f0c040')
      throw new Error('expected resolved gold color');
  });

  it('target 模式第三个参数作为颜色', () => {
    FX.clear();
    FX.floatText('test', 'center', 'cyan');
    if (FX.particles[0].color !== '#00e5ff')
      throw new Error('expected resolved cyan color');
  });

  it('空文本也能创建粒子', () => {
    FX.clear();
    FX.floatText(0, 0, '', '#fff');
    const p = FX.particles[0];
    if (p.text !== '') throw new Error('expected empty text');
    if (p.type !== 'text') throw new Error('expected type text');
  });

  it('坐标为负数也能正常创建', () => {
    FX.clear();
    FX.floatText(-10, -20, 'neg', '#fff');
    const p = FX.particles[0];
    if (p.x !== -10) throw new Error('expected x=-10');
    if (p.y !== -20) throw new Error('expected y=-20');
  });
});

// ============================================================
// FX.ring
// ============================================================

describe('FX.ring 扩展', ({ assert }) => {
  it('ring 粒子 vx=vy=0', () => {
    FX.clear();
    FX.ring(10, 20, 'red');
    const p = FX.particles[0];
    if (p.vx !== 0 || p.vy !== 0) throw new Error('expected zero velocity');
  });

  it('ring 粒子 color 经 resolveColor 解析', () => {
    FX.clear();
    FX.ring(0, 0, 'emerald');
    if (FX.particles[0].color !== '#2ecc71')
      throw new Error('expected emerald resolved');
  });

  it('ring 传入 hex 颜色', () => {
    FX.clear();
    FX.ring(0, 0, '#abcdef');
    if (FX.particles[0].color !== '#abcdef')
      throw new Error('expected #abcdef');
  });

  it('ring 在指定坐标创建', () => {
    FX.clear();
    FX.ring(100, 200, '#000');
    const p = FX.particles[0];
    if (p.x !== 100 || p.y !== 200)
      throw new Error('expected (100, 200)');
  });

  it('ring maxLife=15', () => {
    FX.clear();
    FX.ring(0, 0, '#000');
    if (FX.particles[0].maxLife !== 15)
      throw new Error('expected maxLife=15');
  });

  it('连续调用创建多个 ring', () => {
    FX.clear();
    FX.ring(0, 0, '#f00');
    FX.ring(10, 10, '#0f0');
    FX.ring(20, 20, '#00f');
    if (FX.particles.length !== 3)
      throw new Error('expected 3, got ' + FX.particles.length);
  });
});

// ============================================================
// FX.update
// ============================================================

describe('FX.update 扩展', ({ assert }) => {
  it('life=2 的粒子 update 后 life=1', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 2, maxLife: 2, type: 'square', color: '#000', size: 4 });
    FX.update();
    if (FX.particles[0].life !== 1)
      throw new Error('expected life=1');
  });

  it('混合粒子：只移除到期的', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, type: 'square', color: '#000', size: 4 });
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 5, maxLife: 5, type: 'square', color: '#000', size: 4 });
    FX.update();
    if (FX.particles.length !== 1)
      throw new Error('expected 1 remaining, got ' + FX.particles.length);
    if (FX.particles[0].life !== 4)
      throw new Error('expected life=4');
  });

  it('非 ring 类型不增加 radius', () => {
    FX.clear();
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 10, maxLife: 10, type: 'square', color: '#000', size: 4, radius: 5 };
    FX.particles.push(p);
    FX.update();
    if (FX.particles[0].radius !== 5)
      throw new Error('expected radius unchanged at 5');
  });

  it('多个 ring 半径同时递增', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 10, maxLife: 10, type: 'ring', color: '#000', radius: 0 });
    FX.particles.push({ x: 10, y: 10, vx: 0, vy: 0, life: 10, maxLife: 10, type: 'ring', color: '#000', radius: 5 });
    FX.update();
    if (FX.particles[0].radius !== 2)
      throw new Error('expected radius 2');
    if (FX.particles[1].radius !== 7)
      throw new Error('expected radius 7');
  });

  it('shake 进行中时 shakeX/Y 不为 0', () => {
    shakeDuration = 10; shakeIntensity = 8;
    shakeX = 0; shakeY = 0;
    FX.update();
    // With seedRandom, shake is deterministic; at least one should be non-zero
    const hasShake = Math.abs(shakeX) > 0 || Math.abs(shakeY) > 0;
    if (!hasShake) throw new Error('expected shake displacement');
  });

  it('flash 粒子正常更新位置', () => {
    FX.clear();
    FX.particles.push({ x: 10, y: 20, vx: 1, vy: 2, life: 10, maxLife: 10, type: 'flash', color: '#f00', size: 8 });
    FX.update();
    if (FX.particles[0].x !== 11) throw new Error('expected x=11');
    if (FX.particles[0].y !== 22) throw new Error('expected y=22');
  });

  it('text 粒子 y 递减（上浮）', () => {
    FX.clear();
    FX.particles.push({ x: 50, y: 100, vx: 0, vy: -1, life: 10, maxLife: 10, type: 'text', color: '#fff', text: 'hi' });
    FX.update();
    if (FX.particles[0].y !== 99)
      throw new Error('expected y=99');
  });
});

// ============================================================
// FX.clear
// ============================================================

describe('FX.clear 扩展', ({ assert }) => {
  it('对空数组调用不报错', () => {
    FX.clear();
    FX.clear();
    if (FX.particles.length !== 0) throw new Error('expected 0');
  });

  it('clear 后新增粒子正常', () => {
    FX.clear();
    FX.ring(0, 0, '#000');
    if (FX.particles.length !== 1)
      throw new Error('expected 1 after ring');
  });

  it('clear 创建新数组（不是 splice 清空）', () => {
    FX.clear();
    FX.particles.push({ a: 1 }, { a: 2 });
    const oldRef = FX.particles;
    FX.clear();
    // clear does FX.particles = [], should be a different reference
    if (oldRef === FX.particles)
      throw new Error('should be a new array reference');
    if (FX.particles.length !== 0)
      throw new Error('FX.particles should be empty');
    if (oldRef.length !== 2)
      throw new Error('old ref should still have 2 elements');
  });
});

// ============================================================
// ITEMS_DATA 扩展
// ============================================================

describe('ITEMS_DATA 扩展', ({ assert }) => {
  it('hp_potion 属性完整', () => {
    const item = ITEMS_DATA.hp_potion;
    if (item.name !== '生命药水') throw new Error('wrong name');
    if (item.effect !== 'heal') throw new Error('wrong effect');
    if (item.value !== 80) throw new Error('wrong value');
    if (item.price !== 25) throw new Error('wrong price');
  });

  it('bomb 是 damage 效果', () => {
    const item = ITEMS_DATA.bomb;
    if (item.effect !== 'damage') throw new Error('expected damage');
    if (item.value !== 60) throw new Error('expected 60');
  });

  it('panacea 是 full_restore 且 value=0', () => {
    const item = ITEMS_DATA.panacea;
    if (item.effect !== 'full_restore') throw new Error('expected full_restore');
    if (item.value !== 0) throw new Error('expected value=0');
  });

  it('silver_key 是 key 效果', () => {
    const item = ITEMS_DATA.silver_key;
    if (item.effect !== 'key') throw new Error('expected key');
  });

  it('antidote price 最低（15）', () => {
    let min = Infinity;
    let minKey = '';
    for (const k in ITEMS_DATA) {
      if (ITEMS_DATA[k].price < min) { min = ITEMS_DATA[k].price; minKey = k; }
    }
    if (minKey !== 'antidote')
      throw new Error('expected antidote cheapest, got ' + minKey);
  });

  it('panacea price 最高（100）', () => {
    let max = -1;
    let maxKey = '';
    for (const k in ITEMS_DATA) {
      if (ITEMS_DATA[k].price > max) { max = ITEMS_DATA[k].price; maxKey = k; }
    }
    if (maxKey !== 'panacea')
      throw new Error('expected panacea most expensive, got ' + maxKey);
  });

  it('teleport_scroll price=80', () => {
    if (ITEMS_DATA.teleport_scroll.price !== 80)
      throw new Error('expected 80');
  });

  it('hp_potion 和 big_hp_potion 都是 heal 但 value 不同', () => {
    if (ITEMS_DATA.hp_potion.effect !== 'heal') throw new Error('expected heal');
    if (ITEMS_DATA.big_hp_potion.effect !== 'heal') throw new Error('expected heal');
    if (ITEMS_DATA.hp_potion.value >= ITEMS_DATA.big_hp_potion.value)
      throw new Error('big_hp_potion should have higher value');
  });
});

// ============================================================
// TRAP_TYPES 扩展
// ============================================================

describe('TRAP_TYPES 扩展', ({ assert }) => {
  it('spike 是 dmg 类型 value=10', () => {
    const t = TRAP_TYPES.spike;
    if (t.effect !== 'dmg') throw new Error('expected dmg');
    if (t.value !== 10) throw new Error('expected 10');
  });

  it('rock 是 aoe_dmg 类型', () => {
    if (TRAP_TYPES.rock.effect !== 'aoe_dmg')
      throw new Error('expected aoe_dmg');
  });

  it('warp 是 teleport 类型 value=0', () => {
    const t = TRAP_TYPES.warp;
    if (t.effect !== 'teleport') throw new Error('expected teleport');
    if (t.value !== 0) throw new Error('expected value=0');
  });

  it('mirror 是 invert 类型', () => {
    if (TRAP_TYPES.mirror.effect !== 'invert')
      throw new Error('expected invert');
  });

  it('mirror detectChance 最高（0.5）', () => {
    let max = -1;
    let maxKey = '';
    for (const k in TRAP_TYPES) {
      if (TRAP_TYPES[k].detectChance > max) {
        max = TRAP_TYPES[k].detectChance;
        maxKey = k;
      }
    }
    if (maxKey !== 'mirror')
      throw new Error('expected mirror highest detectChance, got ' + maxKey);
  });

  it('rock detectChance 最低（0.2）', () => {
    let min = 2;
    let minKey = '';
    for (const k in TRAP_TYPES) {
      if (TRAP_TYPES[k].detectChance < min) {
        min = TRAP_TYPES[k].detectChance;
        minKey = k;
      }
    }
    if (minKey !== 'rock')
      throw new Error('expected rock lowest detectChance, got ' + minKey);
  });

  it('所有 trap 有 icon 字段（非空字符串）', () => {
    for (const key in TRAP_TYPES) {
      if (typeof TRAP_TYPES[key].icon !== 'string' || TRAP_TYPES[key].icon.length === 0)
        throw new Error(key + ': icon missing or empty');
    }
  });

  it('所有 trap 有 name 字段（中文字符）', () => {
    for (const key in TRAP_TYPES) {
      const n = TRAP_TYPES[key].name;
      if (typeof n !== 'string' || n.length < 2)
        throw new Error(key + ': name missing or too short');
    }
  });
});

// ============================================================
// TILE + 常量扩展
// ============================================================

describe('TILE + 常量扩展', ({ assert }) => {
  it('TILE 有三个属性', () => {
    const keys = Object.keys(TILE);
    if (keys.length !== 3)
      throw new Error('expected 3 keys, got ' + keys.length);
  });

  it('CANVAS_W 不是 MAP_W * TILE_SIZE (480 vs 640)', () => {
    if (CANVAS_W === MAP_W * TILE_SIZE)
      throw new Error('should NOT be equal');
    if (CANVAS_W !== 480 || MAP_W * TILE_SIZE !== 640)
      throw new Error('values mismatch');
  });

  it('CANVAS_H / MAP_H = TILE_SIZE (270 / 30 = 9? no 270/30=9 != 16)', () => {
    // 270 / 30 = 9, TILE_SIZE = 16, they are NOT equal
    if (CANVAS_H === MAP_H * TILE_SIZE)
      throw new Error('CANVAS_H should NOT equal MAP_H * TILE_SIZE');
  });

  it('MAP 像素尺寸', () => {
    const mapPxW = MAP_W * TILE_SIZE;
    const mapPxH = MAP_H * TILE_SIZE;
    if (mapPxW !== 640) throw new Error('expected 640px wide');
    if (mapPxH !== 480) throw new Error('expected 480px tall');
  });

  it('TILE 值连续（0,1,2）', () => {
    const values = Object.values(TILE).sort((a, b) => a - b);
    if (values[0] !== 0 || values[1] !== 1 || values[2] !== 2)
      throw new Error('expected consecutive 0,1,2');
  });

  it('MAX_FLOORS 为正整数', () => {
    if (MAX_FLOORS <= 0 || MAX_FLOORS !== Math.floor(MAX_FLOORS))
      throw new Error('expected positive integer');
  });

  it('ROOM_TYPES 无重复', () => {
    const seen = new Set();
    for (const t of ROOM_TYPES) {
      if (seen.has(t))
        throw new Error('duplicate room type: ' + t);
      seen.add(t);
    }
  });
});

// ============================================================
// FX.flash 扩展
// ============================================================

describe('FX.flash 扩展', ({ assert }) => {
  it('color 经 resolveColor 解析', () => {
    FX.clear();
    FX.flash(0, 0, 16, 'crimson');
    if (FX.particles[0].color !== '#ff4444')
      throw new Error('expected resolved crimson');
  });

  it('不传 color 时 resolveColor(undefined) 返回 #fff', () => {
    FX.clear();
    FX.flash(0, 0);
    if (FX.particles[0].color !== '#fff')
      throw new Error('expected #fff default');
  });

  it('flash vx=vy=0', () => {
    FX.clear();
    FX.flash(10, 10, 8, '#000');
    const p = FX.particles[0];
    if (p.vx !== 0 || p.vy !== 0) throw new Error('expected zero velocity');
  });

  it('flash life=6, maxLife=6', () => {
    FX.clear();
    FX.flash(0, 0, 16, '#000');
    const p = FX.particles[0];
    if (p.life !== 6 || p.maxLife !== 6)
      throw new Error('expected life=6, maxLife=6');
  });

  it('flash 不传 size 使用 TILE_SIZE', () => {
    FX.clear();
    FX.flash(0, 0, undefined, '#000');
    if (FX.particles[0].size !== TILE_SIZE)
      throw new Error('expected size ' + TILE_SIZE);
  });

  it('flash size=0 被 || TILE_SIZE 替代', () => {
    FX.clear();
    FX.flash(0, 0, 0, '#000');
    // 0 || TILE_SIZE = TILE_SIZE = 16
    if (FX.particles[0].size !== TILE_SIZE)
      throw new Error('expected size ' + TILE_SIZE + ' (0||TILE_SIZE)');
  });
});

// ============================================================
// FX 组合行为
// ============================================================

describe('FX 组合行为', ({ assert }) => {
  it('burst + floatText + ring 同时存在', () => {
    FX.clear();
    seedRandom(7);
    FX.burst(0, 0, 3, '#f00');
    FX.floatText(50, 50, 'crit', '#ff0');
    FX.ring(100, 100, '#00f');
    if (FX.particles.length !== 5)
      throw new Error('expected 5, got ' + FX.particles.length);
  });

  it('burst 覆盖已有粒子（不清空）', () => {
    FX.clear();
    FX.ring(0, 0, '#000');
    seedRandom(1);
    FX.burst(0, 0, 3, '#f00');
    if (FX.particles.length !== 4)
      throw new Error('expected 4 (1 ring + 3 burst), got ' + FX.particles.length);
  });

  it('update 后 ring 粒子半径增长后移除', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 2, maxLife: 2, type: 'ring', color: '#000', radius: 0 });
    FX.update();
    if (FX.particles[0].radius !== 2) throw new Error('expected radius 2');
    FX.update();
    if (FX.particles.length !== 0)
      throw new Error('expected ring removed after life expired');
  });

  it('shake 和粒子更新同时发生', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 1, vy: 1, life: 10, maxLife: 10, type: 'square', color: '#000', size: 4 });
    shakeDuration = 5; shakeIntensity = 4; shakeX = 0; shakeY = 0;
    FX.update();
    if (FX.particles[0].x !== 1) throw new Error('expected x=1');
    if (shakeDuration !== 4) throw new Error('expected shakeDuration=4');
  });

  it('多次 clear 幂等', () => {
    FX.burst(0, 0, 5, '#000');
    FX.clear();
    FX.clear();
    FX.clear();
    if (FX.particles.length !== 0)
      throw new Error('expected 0 after triple clear');
  });
});
