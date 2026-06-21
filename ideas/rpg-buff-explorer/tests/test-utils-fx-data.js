// test-utils-fx-data.js — utils, fx, items, traps, constants coverage
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// ============================================================
// utils.js
// ============================================================

describe('clamp', ({ assert }) => {
  it('值在范围内原样返回', () => {
    if (clamp(5, 0, 10) !== 5) throw new Error('expected 5');
  });

  it('小于下限返回 min', () => {
    if (clamp(-3, 0, 10) !== 0) throw new Error('expected 0');
  });

  it('大于上限返回 max', () => {
    if (clamp(15, 0, 10) !== 10) throw new Error('expected 10');
  });

  it('min === max 时始终返回该值', () => {
    if (clamp(99, 5, 5) !== 5) throw new Error('expected 5');
  });
});

describe('manhattan', ({ assert }) => {
  it('同一点距离为 0', () => {
    if (manhattan(0, 0, 0, 0) !== 0) throw new Error('expected 0');
  });

  it('标准距离 (0,0)->(3,4) = 7', () => {
    if (manhattan(0, 0, 3, 4) !== 7) throw new Error('expected 7');
  });

  it('负坐标 (-2,-3)->(1,1) = 7', () => {
    if (manhattan(-2, -3, 1, 1) !== 7) throw new Error('expected 7');
  });
});

describe('inBounds', ({ assert }) => {
  it('(0,0) 在范围内', () => {
    if (inBounds(0, 0) !== true) throw new Error('expected true');
  });

  it('(39,29) 在范围内 (MAP_W-1, MAP_H-1)', () => {
    if (inBounds(39, 29) !== true) throw new Error('expected true');
  });

  it('(40,30) 超出范围', () => {
    if (inBounds(40, 30) !== false) throw new Error('expected false');
  });

  it('(-1,0) 超出范围', () => {
    if (inBounds(-1, 0) !== false) throw new Error('expected false');
  });

  it('(20,-5) 超出范围', () => {
    if (inBounds(20, -5) !== false) throw new Error('expected false');
  });
});

describe('shuffle', ({ assert }) => {
  it('空数组不报错', () => {
    const arr = [];
    const result = shuffle(arr);
    if (result.length !== 0) throw new Error('expected empty');
  });

  it('单元素不变', () => {
    const arr = [42];
    shuffle(arr);
    if (arr[0] !== 42) throw new Error('expected 42');
  });

  it('seedRandom 下结果可复现', () => {
    const restore1 = seedRandom(123);
    const a = [1, 2, 3, 4, 5];
    shuffle(a);
    const result1 = a.slice();
    restore1();

    const restore2 = seedRandom(123);
    const b = [1, 2, 3, 4, 5];
    shuffle(b);
    const result2 = b.slice();
    restore2();

    if (JSON.stringify(result1) !== JSON.stringify(result2))
      throw new Error('shuffle not deterministic with same seed');
  });

  it('返回同一数组引用', () => {
    const arr = [1, 2, 3];
    if (shuffle(arr) !== arr) throw new Error('expected same reference');
  });

  it('元素守恒：排序后等于原数组', () => {
    const restore = seedRandom(77);
    const arr = [5, 3, 1, 4, 2];
    const original = arr.slice().sort();
    shuffle(arr);
    arr.sort();
    restore();
    if (JSON.stringify(arr) !== JSON.stringify(original))
      throw new Error('elements not conserved after shuffle');
  });
});

describe('weightedPick', ({ assert }) => {
  it('单元素必选', () => {
    if (weightedPick([{ item: 'a', weight: 10 }]) !== 'a')
      throw new Error('expected a');
  });

  it('weight=0 不会被选中', () => {
    const restore = seedRandom(1);
    const result = weightedPick([
      { item: 'a', weight: 0 },
      { item: 'b', weight: 10 }
    ]);
    restore();
    if (result !== 'b') throw new Error('expected b, got ' + result);
  });

  it('没有 .item 字段时返回条目本身', () => {
    const result = weightedPick([{ weight: 5, label: 'x' }]);
    if (result.label !== 'x') throw new Error('expected entry object');
  });

  it('大量采样验证分布大致正确', () => {
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 1000; i++) {
      const restore = seedRandom(i);
      const r = weightedPick([
        { item: 'a', weight: 9 },
        { item: 'b', weight: 1 }
      ]);
      restore();
      counts[r]++;
    }
    // a should be roughly 90% of 1000 = ~900
    if (counts.a < 850 || counts.a > 950)
      throw new Error(`distribution off: a=${counts.a}, b=${counts.b}`);
  });

  it('所有 weight=0 时返回第一个元素 (r=0 满足 r<=0)', () => {
    const result = weightedPick([
      { item: 'a', weight: 0 },
      { item: 'b', weight: 0 }
    ]);
    if (result !== 'a') throw new Error('expected a (first item, r=0 matches first)');
  });
});

describe('rng', ({ assert }) => {
  it('min === max 返回该值', () => {
    if (rng(5, 5) !== 5) throw new Error('expected 5');
  });

  it('seedRandom 下返回值在范围内', () => {
    const restore = seedRandom(42);
    const v = rng(1, 100);
    restore();
    if (v < 1 || v > 100) throw new Error(`expected in [1,100], got ${v}`);
  });

  it('返回整数', () => {
    const restore = seedRandom(99);
    const v = rng(0, 10);
    restore();
    if (v !== Math.floor(v)) throw new Error(`expected integer, got ${v}`);
  });
});

describe('pick', ({ assert }) => {
  it('单元素必选', () => {
    if (pick(['only']) !== 'only') throw new Error('expected only');
  });

  it('seedRandom 下结果可复现', () => {
    const restore = seedRandom(7);
    const v = pick([1, 2, 3]);
    restore();
    const restore2 = seedRandom(7);
    const v2 = pick([1, 2, 3]);
    restore2();
    if (v !== v2) throw new Error('not deterministic');
  });

  it('返回值在数组中', () => {
    const restore = seedRandom(33);
    const arr = ['a', 'b', 'c', 'd'];
    const v = pick(arr);
    restore();
    if (!arr.includes(v)) throw new Error(`expected in array, got ${v}`);
  });
});

describe('findBuffDef', ({ assert }) => {
  it('不存在的 id 返回 null', () => {
    if (findBuffDef('___does_not_exist___') !== null)
      throw new Error('expected null');
  });

  it('存在时返回对应定义', () => {
    const def = findBuffDef(BUFF_DEFS[0].id);
    if (def !== BUFF_DEFS[0]) throw new Error('expected first buff def');
  });

  it('空字符串 id 返回 null', () => {
    if (findBuffDef('') !== null) throw new Error('expected null');
  });
});

// ============================================================
// fx.js
// ============================================================

describe('resolveColor', ({ assert }) => {
  it('undefined 返回 #fff', () => {
    if (resolveColor(undefined) !== '#fff') throw new Error('expected #fff');
  });

  it('null 返回 #fff', () => {
    if (resolveColor(null) !== '#fff') throw new Error('expected #fff');
  });

  it('PAL key 正确解析', () => {
    if (resolveColor('crimson') !== '#ff4444')
      throw new Error('expected #ff4444');
  });

  it('hex 字符串原样返回', () => {
    if (resolveColor('#abc') !== '#abc') throw new Error('expected #abc');
  });

  it('未知 key 返回 #fff', () => {
    if (resolveColor('nonexistent_key_xyz') !== '#fff')
      throw new Error('expected #fff');
  });
});

describe('resolveTarget', ({ assert }) => {
  it('center 返回画布中心', () => {
    const p = resolveTarget('center');
    if (p.x !== 240 || p.y !== 135)
      throw new Error(`expected {240,135}, got {${p.x},${p.y}}`);
  });

  it('enemy-sprite 返回正确坐标 (CANVAS_W/2-32, 80)', () => {
    const p = resolveTarget('enemy-sprite');
    if (p.x !== 208 || p.y !== 80)
      throw new Error(`expected {208,80}, got {${p.x},${p.y}}`);
  });

  it('player-sprite 返回正确坐标', () => {
    const p = resolveTarget('player-sprite');
    if (p.x !== 100 || p.y !== 150)
      throw new Error(`expected {100,150}, got {${p.x},${p.y}}`);
  });

  it('未知 label 返回 null', () => {
    if (resolveTarget('unknown') !== null) throw new Error('expected null');
  });
});

describe('FX.burst', ({ assert }) => {
  it('target 模式默认 count=8', () => {
    FX.clear();
    FX.burst('enemy-sprite', 'crimson');
    if (FX.particles.length !== 8)
      throw new Error(`expected 8, got ${FX.particles.length}`);
  });

  it('target 模式指定 count=20', () => {
    FX.clear();
    FX.burst('enemy-sprite', 'red', 20, 4, 30);
    if (FX.particles.length !== 20)
      throw new Error(`expected 20, got ${FX.particles.length}`);
  });

  it('坐标模式产生正确数量粒子', () => {
    FX.clear();
    FX.burst(100, 50, 5, '#0f0', 3, 10);
    if (FX.particles.length !== 5)
      throw new Error(`expected 5, got ${FX.particles.length}`);
  });

  it('粒子有正确字段', () => {
    FX.clear();
    FX.burst(0, 0, 1, 'gold');
    const p = FX.particles[0];
    if (p.type !== 'square') throw new Error('expected type square');
    if (p.color !== PAL.gold) throw new Error('expected gold color');
    if (typeof p.vx !== 'number') throw new Error('expected vx number');
    if (typeof p.vy !== 'number') throw new Error('expected vy number');
    if (p.life !== p.maxLife) throw new Error('expected life === maxLife');
  });
});

describe('FX.shake', ({ assert }) => {
  it('numeric 模式设置正确', () => {
    FX.shake(3, 10);
    if (shakeIntensity !== 3) throw new Error('expected intensity 3');
    if (shakeDuration !== 10) throw new Error('expected duration 10');
  });

  it('string 模式 duration 固定为 5', () => {
    FX.shake('enemy-sprite', 5);
    if (shakeIntensity !== 5) throw new Error('expected intensity 5');
    if (shakeDuration !== 5) throw new Error('expected duration 5');
  });

  it('string 模式默认 intensity=3', () => {
    FX.shake('center');
    if (shakeIntensity !== 3) throw new Error('expected intensity 3');
    if (shakeDuration !== 5) throw new Error('expected duration 5');
  });

  it('每次调用重置 shakeX/Y 为 0', () => {
    shakeX = 10; shakeY = 10;
    FX.shake(1, 1);
    if (shakeX !== 0 || shakeY !== 0)
      throw new Error('expected shakeX=0, shakeY=0');
  });
});

describe('FX.floatText', ({ assert }) => {
  it('target 模式创建 text 粒子', () => {
    FX.clear();
    FX.floatText('-5 暴击', 'enemy-sprite');
    if (FX.particles.length !== 1) throw new Error('expected 1 particle');
    const p = FX.particles[0];
    if (p.type !== 'text') throw new Error('expected type text');
    if (p.text !== '-5 暴击') throw new Error('expected correct text');
  });

  it('坐标模式创建 text 粒子', () => {
    FX.clear();
    FX.floatText(100, 50, '-10', '#f00');
    const p = FX.particles[0];
    if (p.type !== 'text') throw new Error('expected type text');
    if (p.text !== '-10') throw new Error('expected text -10');
    if (p.color !== '#f00') throw new Error('expected color #f00');
  });

  it('text 粒子 vy=-1（上浮）且 life=40', () => {
    FX.clear();
    FX.floatText('hi', 'center');
    const p = FX.particles[0];
    if (p.vy !== -1) throw new Error('expected vy=-1');
    if (p.life !== 40) throw new Error('expected life=40');
    if (p.vx !== 0) throw new Error('expected vx=0');
  });
});

describe('FX.flash', ({ assert }) => {
  it('创建 flash 粒子', () => {
    FX.clear();
    FX.flash(10, 10, 32, 'red');
    const p = FX.particles[0];
    if (p.type !== 'flash') throw new Error('expected type flash');
    if (p.size !== 32) throw new Error('expected size 32');
    if (p.life !== 6) throw new Error('expected life 6');
  });

  it('size 默认 TILE_SIZE', () => {
    FX.clear();
    FX.flash(5, 5);
    if (FX.particles[0].size !== TILE_SIZE)
      throw new Error('expected default size ' + TILE_SIZE);
  });
});

describe('FX.ring', ({ assert }) => {
  it('创建 ring 粒子', () => {
    FX.clear();
    FX.ring(100, 100, 'cyan');
    const p = FX.particles[0];
    if (p.type !== 'ring') throw new Error('expected type ring');
    if (p.radius !== 0) throw new Error('expected radius 0');
    if (p.life !== 15) throw new Error('expected life 15');
    if (p.color !== PAL.cyan) throw new Error('expected cyan color');
  });
});

describe('FX.update', ({ assert }) => {
  it('空粒子数组不报错', () => {
    FX.clear();
    FX.update();
    if (FX.particles.length !== 0) throw new Error('expected 0');
  });

  it('life=1 的粒子被移除', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, type: 'square', color: '#000', size: 4 });
    FX.update();
    if (FX.particles.length !== 0)
      throw new Error('expected dead particle removed, got ' + FX.particles.length);
  });

  it('ring 类型 radius 递增 2', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 10, maxLife: 10, type: 'ring', color: '#000', radius: 0 });
    FX.update();
    if (FX.particles[0].radius !== 2)
      throw new Error('expected radius 2, got ' + FX.particles[0].radius);
  });

  it('shakeDuration 递减到 0 后重置 shakeX/Y', () => {
    shakeX = 5; shakeY = 5;
    shakeDuration = 3; shakeIntensity = 10;
    FX.update(); shakeDuration === 2; // turn 1
    FX.update(); // turn 2
    FX.update(); // turn 3 -> shakeDuration becomes 0
    FX.update(); // turn 4 -> shakeDuration <= 0, shakeX/Y reset
    if (shakeX !== 0 || shakeY !== 0)
      throw new Error('expected shake reset, got x=' + shakeX + ' y=' + shakeY);
  });

  it('粒子位置按 vx/vy 更新', () => {
    FX.clear();
    FX.particles.push({ x: 0, y: 0, vx: 3, vy: -2, life: 10, maxLife: 10, type: 'square', color: '#000', size: 4 });
    FX.update();
    if (FX.particles[0].x !== 3)
      throw new Error('expected x=3, got ' + FX.particles[0].x);
    if (FX.particles[0].y !== -2)
      throw new Error('expected y=-2, got ' + FX.particles[0].y);
  });
});

describe('FX.clear', ({ assert }) => {
  it('清空粒子数组', () => {
    FX.particles.push({ a: 1 });
    FX.particles.push({ a: 2 });
    FX.clear();
    if (FX.particles.length !== 0)
      throw new Error('expected empty, got ' + FX.particles.length);
  });
});

// ============================================================
// data/items.js
// ============================================================

describe('ITEMS_DATA', ({ assert }) => {
  it('恰好 10 个物品', () => {
    if (Object.keys(ITEMS_DATA).length !== 10)
      throw new Error(`expected 10, got ${Object.keys(ITEMS_DATA).length}`);
  });

  it('所有 key 存在', () => {
    const expected = [
      'hp_potion', 'mp_potion', 'big_hp_potion', 'panacea', 'bomb',
      'antidote', 'silver_key', 'identify_scroll', 'detect_scroll', 'teleport_scroll'
    ];
    for (const k of expected) {
      if (ITEMS_DATA[k] === undefined)
        throw new Error(`missing key: ${k}`);
    }
  });

  it('每个物品有 6 个必要字段', () => {
    const required = ['name', 'icon', 'effect', 'value', 'price', 'desc'];
    for (const key in ITEMS_DATA) {
      for (const field of required) {
        if (ITEMS_DATA[key][field] === undefined)
          throw new Error(`${key}: missing field '${field}'`);
      }
    }
  });

  it('effect 值合法', () => {
    const validEffects = [
      'heal', 'restore_mp', 'full_restore', 'damage',
      'cure_poison', 'key', 'identify', 'detect_traps', 'teleport'
    ];
    for (const key in ITEMS_DATA) {
      if (!validEffects.includes(ITEMS_DATA[key].effect))
        throw new Error(`${key}: invalid effect '${ITEMS_DATA[key].effect}'`);
    }
  });

  it('price 为正整数，value >= 0', () => {
    for (const key in ITEMS_DATA) {
      if (ITEMS_DATA[key].price <= 0)
        throw new Error(`${key}: price must be > 0, got ${ITEMS_DATA[key].price}`);
      if (ITEMS_DATA[key].value < 0)
        throw new Error(`${key}: value must be >= 0, got ${ITEMS_DATA[key].value}`);
    }
  });
});

// ============================================================
// data/traps.js
// ============================================================

describe('TRAP_TYPES', ({ assert }) => {
  it('恰好 6 种陷阱', () => {
    if (Object.keys(TRAP_TYPES).length !== 6)
      throw new Error(`expected 6, got ${Object.keys(TRAP_TYPES).length}`);
  });

  it('所有 key 存在', () => {
    const expected = ['spike', 'slime', 'mirror', 'poison', 'rock', 'warp'];
    for (const k of expected) {
      if (TRAP_TYPES[k] === undefined)
        throw new Error(`missing key: ${k}`);
    }
  });

  it('每个陷阱有 7 个必要字段', () => {
    const required = ['name', 'icon', 'color', 'effect', 'value', 'detectChance', 'desc'];
    for (const key in TRAP_TYPES) {
      for (const field of required) {
        if (TRAP_TYPES[key][field] === undefined)
          throw new Error(`${key}: missing field '${field}'`);
      }
    }
  });

  it('effect 值合法', () => {
    const validEffects = ['dmg', 'slow', 'invert', 'poison', 'aoe_dmg', 'teleport'];
    for (const key in TRAP_TYPES) {
      if (!validEffects.includes(TRAP_TYPES[key].effect))
        throw new Error(`${key}: invalid effect '${TRAP_TYPES[key].effect}'`);
    }
  });

  it('detectChance 在 [0,1] 范围内', () => {
    for (const key in TRAP_TYPES) {
      const dc = TRAP_TYPES[key].detectChance;
      if (dc < 0 || dc > 1)
        throw new Error(`${key}: detectChance ${dc} out of [0,1]`);
    }
  });

  it('color 是合法的 hex 字符串', () => {
    for (const key in TRAP_TYPES) {
      if (typeof TRAP_TYPES[key].color !== 'string' ||
          !TRAP_TYPES[key].color.startsWith('#'))
        throw new Error(`${key}: invalid color '${TRAP_TYPES[key].color}'`);
    }
  });
});

// ============================================================
// data/constants.js
// ============================================================

describe('TILE enum', ({ assert }) => {
  it('WALL=0, FLOOR=1, CORRIDOR=2', () => {
    if (TILE.WALL !== 0) throw new Error('expected TILE.WALL === 0');
    if (TILE.FLOOR !== 1) throw new Error('expected TILE.FLOOR === 1');
    if (TILE.CORRIDOR !== 2) throw new Error('expected TILE.CORRIDOR === 2');
  });
});

describe('地图尺寸常量', ({ assert }) => {
  it('MAP_W=40, MAP_H=30', () => {
    if (MAP_W !== 40) throw new Error('expected MAP_W=40');
    if (MAP_H !== 30) throw new Error('expected MAP_H=30');
  });

  it('PIXEL=4, TILE_SIZE=16', () => {
    if (PIXEL !== 4) throw new Error('expected PIXEL=4');
    if (TILE_SIZE !== 16) throw new Error('expected TILE_SIZE=16');
    if (TILE_SIZE !== PIXEL * 4) throw new Error('TILE_SIZE !== PIXEL * 4');
  });

  it('CANVAS_W=480, CANVAS_H=270', () => {
    if (CANVAS_W !== 480) throw new Error('expected CANVAS_W=480');
    if (CANVAS_H !== 270) throw new Error('expected CANVAS_H=270');
  });

  it('MAX_FLOORS=3', () => {
    if (MAX_FLOORS !== 3) throw new Error('expected MAX_FLOORS=3');
  });

  it('ROOM_TYPES 包含 6 种类型', () => {
    if (!Array.isArray(ROOM_TYPES)) throw new Error('expected array');
    if (ROOM_TYPES.length !== 6)
      throw new Error(`expected 6, got ${ROOM_TYPES.length}`);
    const expected = ['combat', 'loot', 'trap', 'resting', 'shrine', 'empty'];
    for (const t of expected) {
      if (!ROOM_TYPES.includes(t))
        throw new Error(`missing room type: ${t}`);
    }
  });
});
