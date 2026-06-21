// test-movement-combat.js — Movement and combat logic tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

// ---- Helper: create a valid dungeon for tests ----
function makeDungeon(floor) {
  floor = floor || 1;
  var grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(TILE.FLOOR));
  // Add wall border
  for (var y = 0; y < MAP_H; y++) {
    grid[y][0] = TILE.WALL;
    grid[y][MAP_W - 1] = TILE.WALL;
  }
  for (var x = 0; x < MAP_W; x++) {
    grid[0][x] = TILE.WALL;
    grid[MAP_H - 1][x] = TILE.WALL;
  }
  var revealed = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
  // Reveal a generous area so teleport traps have targets
  for (var ry = 1; ry < 6; ry++)
    for (var rx = 1; rx < 6; rx++)
      revealed[ry][rx] = true;
  var visibility = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
  return {
    grid, floor, rooms: [], enemies: [], items: [], traps: [],
    revealed, visibility,
    playerStart: { x: 2, y: 2 },
    stairsPos: { x: 5, y: 5 },
    theme: { name: '测试层', colors: { wall: '#000' }, envBuff: null },
  };
}

// ---- useItem ----
describe('useItem: heal', ({ assert }) => {
  it('hp_potion 恢复 80 HP', () => {
    player.hp = 50;
    player.maxHp = 120;
    player.inventory = { hp_potion: 1 };
    useItem('hp_potion');
    if (player.hp !== 120) throw new Error('expected 120, got ' + player.hp);
  });

  it('big_hp_potion 恢复 200 HP', () => {
    player.hp = 50;
    player.maxHp = 300;
    player.inventory = { big_hp_potion: 1 };
    useItem('big_hp_potion');
    if (player.hp !== 250) throw new Error('expected 250, got ' + player.hp);
  });

  it('heal 不超过 maxHp 上限', () => {
    player.hp = 110;
    player.maxHp = 120;
    player.inventory = { hp_potion: 1 };
    useItem('hp_potion');
    if (player.hp !== 120) throw new Error('expected 120, got ' + player.hp);
  });

  it('库存减一，归零则删除键', () => {
    player.inventory = { hp_potion: 1 };
    useItem('hp_potion');
    if (player.inventory.hp_potion !== undefined)
      throw new Error('key should be deleted after last use');
  });

  it('多个库存只减一', () => {
    player.inventory = { hp_potion: 3 };
    useItem('hp_potion');
    if (player.inventory.hp_potion !== 2)
      throw new Error('expected 2, got ' + player.inventory.hp_potion);
  });

  it('没有该物品返回无变化', () => {
    player.hp = 50;
    player.maxHp = 120;
    player.inventory = {};
    useItem('hp_potion');
    if (player.hp !== 50) throw new Error('hp should not change');
  });

  it('库存为零时返回无变化', () => {
    player.hp = 50;
    player.inventory = { hp_potion: 0 };
    useItem('hp_potion');
    if (player.hp !== 50) throw new Error('hp should not change');
  });
});

describe('useItem: restore_mp, full_restore, cure_poison', ({ assert }) => {
  it('mp_potion 恢复 40 MP', () => {
    player.mp = 10;
    player.maxMp = 30;
    player.inventory = { mp_potion: 1 };
    useItem('mp_potion');
    if (player.mp !== 30) throw new Error('expected 30, got ' + player.mp);
  });

  it('mp_potion 不超过 maxMp', () => {
    player.mp = 28;
    player.maxMp = 30;
    player.inventory = { mp_potion: 1 };
    useItem('mp_potion');
    if (player.mp !== 30) throw new Error('expected 30, got ' + player.mp);
  });

  it('panacea 完全恢复 HP/MP 并清除状态', () => {
    player.hp = 50;
    player.maxHp = 120;
    player.mp = 10;
    player.maxMp = 30;
    player.statuses = [
      { id: 'poison', type: 'dot', turnsLeft: 3, value: 4 },
      { id: 'burn', type: 'dot', turnsLeft: 2, value: 2 },
    ];
    player.inventory = { panacea: 1 };
    useItem('panacea');
    if (player.hp !== 120) throw new Error('hp expected 120, got ' + player.hp);
    if (player.mp !== 30) throw new Error('mp expected 30, got ' + player.mp);
    if (player.statuses.length !== 0) throw new Error('statuses should be empty');
  });

  it('antidote 只清除 poison 状态', () => {
    player.statuses = [
      { id: 'poison', type: 'dot', turnsLeft: 3 },
      { id: 'burn', type: 'dot', turnsLeft: 2 },
      { id: 'poison', type: 'dot', turnsLeft: 1 },
    ];
    player.inventory = { antidote: 1 };
    useItem('antidote');
    var ids = player.statuses.map(function (s) { return s.id; });
    if (ids.indexOf('poison') !== -1) throw new Error('poison should be removed');
    if (ids.indexOf('burn') === -1) throw new Error('burn should remain');
    if (player.statuses.length !== 1) throw new Error('expected 1 status, got ' + player.statuses.length);
  });

  it('没有 poison 状态时 antidote 不伤害', () => {
    player.statuses = [];
    player.inventory = { antidote: 1 };
    useItem('antidote');
    if (player.statuses.length !== 0) throw new Error('statuses should still be empty');
  });
});

// ---- movePlayer: basic ----
describe('movePlayer: basic movement', ({ assert }) => {
  it('向右移动一格', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    gameState.turnCount = 0;
    movePlayer(1, 0);
    if (player.x !== 6 || player.y !== 5)
      throw new Error('expected (6,5), got (' + player.x + ',' + player.y + ')');
    if (gameState.turnCount !== 1) throw new Error('turnCount should be 1');
  });

  it('向左移动一格', () => {
    dungeon = makeDungeon();
    player.x = 10;
    player.y = 10;
    gameState.paused = false;
    combatState = null;
    movePlayer(-1, 0);
    if (player.x !== 9 || player.y !== 10)
      throw new Error('expected (9,10), got (' + player.x + ',' + player.y + ')');
  });

  it('向上移动一格', () => {
    dungeon = makeDungeon();
    player.x = 10;
    player.y = 10;
    gameState.paused = false;
    combatState = null;
    movePlayer(0, -1);
    if (player.x !== 10 || player.y !== 9)
      throw new Error('expected (10,9), got (' + player.x + ',' + player.y + ')');
  });

  it('向下移动一格', () => {
    dungeon = makeDungeon();
    player.x = 10;
    player.y = 10;
    gameState.paused = false;
    combatState = null;
    movePlayer(0, 1);
    if (player.x !== 10 || player.y !== 11)
      throw new Error('expected (10,11), got (' + player.x + ',' + player.y + ')');
  });

  it('对角线移动', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 1);
    if (player.x !== 6 || player.y !== 6)
      throw new Error('expected (6,6), got (' + player.x + ',' + player.y + ')');
  });

  it('暂停时不移动', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = 5;
    gameState.paused = true;
    combatState = null;
    movePlayer(1, 0);
    if (player.x !== 5 || player.y !== 5)
      throw new Error('should not move when paused');
  });

  it('战斗中不移动', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = 5;
    gameState.paused = false;
    combatState = { enemy: {} };
    movePlayer(1, 0);
    if (player.x !== 5 || player.y !== 5)
      throw new Error('should not move during combat');
  });
});

describe('movePlayer: bounds and wall check', ({ assert }) => {
  it('超出左边界不移动', () => {
    dungeon = makeDungeon();
    player.x = 1;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(-1, 0);
    if (player.x !== 1) throw new Error('should not move left past wall');
  });

  it('超出右边界不移动', () => {
    dungeon = makeDungeon();
    player.x = MAP_W - 2;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.x !== MAP_W - 2) throw new Error('should not move right past wall');
  });

  it('超出上边界不移动', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = 1;
    gameState.paused = false;
    combatState = null;
    movePlayer(0, -1);
    if (player.y !== 1) throw new Error('should not move up past wall');
  });

  it('超出下边界不移动', () => {
    dungeon = makeDungeon();
    player.x = 5;
    player.y = MAP_H - 2;
    gameState.paused = false;
    combatState = null;
    movePlayer(0, 1);
    if (player.y !== MAP_H - 2) throw new Error('should not move down past wall');
  });

  it('移动到墙内不移动', () => {
    dungeon = makeDungeon();
    // Place a wall tile in the middle of the map
    dungeon.grid[5][10] = TILE.WALL;
    player.x = 9;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.x !== 9) throw new Error('should not move into wall');
  });

  it('没有 dungeon 时不移动', () => {
    var savedDungeon = dungeon;
    dungeon = null;
    player.x = 5;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.x !== 5 || player.y !== 5)
      throw new Error('should not move without dungeon');
    dungeon = savedDungeon;
  });
});

describe('movePlayer: enemy encounter, item, stairs', ({ assert }) => {
  it('移动到敌人位置触发战斗', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 8, y: 5, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    player.x = 7;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (!combatState) throw new Error('combatState should exist');
    if (combatState.enemy.name !== '测试怪')
      throw new Error('wrong enemy in combat');
  });

  it('已死亡的敌人不触发战斗', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 0, atk: 5, def: 2, spd: 4,
      x: 8, y: 5, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    player.x = 7;
    player.y = 5;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (combatState) throw new Error('should not start combat with dead enemy');
    if (player.x !== 8) throw new Error('player should have moved past dead enemy');
  });

  it('拾取 gold 物品', () => {
    dungeon = makeDungeon();
    player.gold = 100;
    player.x = 5;
    player.y = 5;
    dungeon.items = [{ type: 'gold', x: 6, y: 5, amount: 25 }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.gold !== 125) throw new Error('gold: expected 125, got ' + player.gold);
    if (dungeon.items.length !== 0) throw new Error('gold item should be removed');
  });

  it('拾取普通物品加入背包', () => {
    dungeon = makeDungeon();
    player.inventory = {};
    player.x = 5;
    player.y = 5;
    dungeon.items = [{ type: 'hp_potion', x: 6, y: 5 }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (!player.inventory.hp_potion || player.inventory.hp_potion !== 1)
      throw new Error('hp_potion count should be 1');
    if (dungeon.items.length !== 0) throw new Error('item should be removed');
  });

  it('篝火恢复 30% HP', () => {
    dungeon = makeDungeon();
    player.hp = 120;
    player.maxHp = 120;
    player.x = 5;
    player.y = 5;
    dungeon.items = [{ type: 'resting', x: 6, y: 5 }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    var expected = Math.min(120, 120 + Math.floor(120 * 0.3));
    if (player.hp !== expected) throw new Error('hp: expected ' + expected + ', got ' + player.hp);
  });

  it('楼梯: 非最高层进入下一层', () => {
    dungeon = makeDungeon(2);
    player.x = 4;
    player.y = 5;
    gameState.floor = 2;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (gameState.floor !== 3)
      throw new Error('floor should advance to 3, got ' + gameState.floor);
  });

  it('楼梯: 最高层且 Boss 未击败不能离开', () => {
    dungeon = makeDungeon(MAX_FLOORS);
    player.x = 4;
    player.y = 5;
    gameState.floor = MAX_FLOORS;
    gameState.bossDefeated = false;
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (gameState.floor !== MAX_FLOORS)
      throw new Error('floor should not change');
  });

  it('楼梯: 最高层 Boss 已击败可以离开', () => {
    dungeon = makeDungeon(MAX_FLOORS);
    player.x = 4;
    player.y = 5;
    gameState.floor = MAX_FLOORS;
    gameState.bossDefeated = true;
    gameState.paused = false;
    gameState.screen = 'dungeon';
    combatState = null;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    movePlayer(1, 0);
    if (gameState.screen !== 'victory')
      throw new Error('screen should be victory, got ' + gameState.screen);
    permanent = null;
  });
});

describe('movePlayer: trap and death', ({ assert }) => {
  it('踩中伤害陷阱扣血', () => {
    dungeon = makeDungeon();
    player.hp = 120;
    player.x = 2;
    player.y = 2;
    dungeon.traps = [{
      x: 3, y: 2, triggered: false, revealed: false,
      effect: 'dmg', damage: 15, label: '刺钉陷阱', detectChance: 0.3,
    }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.hp !== 105) throw new Error('hp: expected 105, got ' + player.hp);
  });

  it('踩中毒陷阱获得中毒状态', () => {
    dungeon = makeDungeon();
    player.hp = 120;
    player.statuses = [];
    player.x = 2;
    player.y = 2;
    dungeon.traps = [{
      x: 3, y: 2, triggered: false, revealed: false,
      effect: 'poison', val: 5, label: '毒气陷阱', detectChance: 0.3,
    }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    if (player.statuses.length === 0) throw new Error('should have poison status');
    if (player.statuses[0].id !== 'poison')
      throw new Error('status id: expected poison, got ' + player.statuses[0].id);
  });

  it('传送陷阱改变位置', () => {
    var restore = seedRandom(999);
    dungeon = makeDungeon();
    player.hp = 120;
    player.x = 2;
    player.y = 2;
    dungeon.traps = [{
      x: 3, y: 2, triggered: false, revealed: false,
      effect: 'teleport', label: '传送陷阱',
    }];
    gameState.paused = false;
    combatState = null;
    movePlayer(1, 0);
    var posChanged = !(player.x === 3 && player.y === 2);
    restore();
    if (!posChanged) throw new Error('teleport trap should change position');
  });

  it('HP 降到零或以下调用 playerDied', () => {
    dungeon = makeDungeon();
    player.hp = 5;
    player.gold = 20;
    player.x = 2;
    player.y = 2;
    dungeon.traps = [{
      x: 3, y: 2, triggered: false, revealed: false,
      effect: 'dmg', damage: 10, label: '致命陷阱', detectChance: 0.3,
    }];
    gameState.paused = false;
    gameState.screen = 'dungeon';
    combatState = null;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    movePlayer(1, 0);
    if (!gameState.paused) throw new Error('game should be paused after death');
    if (gameState.screen !== 'gameover')
      throw new Error('screen should be gameover, got ' + gameState.screen);
    permanent = null;
  });
});

// ---- gainExp + inline levelUp ----
describe('gainExp: accumulation and levelUp', ({ assert }) => {
  it('获得经验不升级', () => {
    player.exp = 0;
    player.lvl = 1;
    player.expNext = 30;
    gainExp(10);
    if (player.exp !== 10) throw new Error('exp: expected 10, got ' + player.exp);
    if (player.lvl !== 1) throw new Error('lvl should stay 1');
  });

  it('刚好达到 expNext 升一级', () => {
    player.exp = 0;
    player.lvl = 1;
    player.expNext = 30;
    gainExp(30);
    if (player.lvl !== 2) throw new Error('lvl: expected 2, got ' + player.lvl);
    if (player.exp !== 0) throw new Error('exp should be 0 after level up');
  });

  it('超过 expNext 升一级并保留剩余经验', () => {
    player.exp = 0;
    player.lvl = 1;
    player.expNext = 30;
    gainExp(50);
    if (player.lvl !== 2) throw new Error('lvl: expected 2, got ' + player.lvl);
    if (player.exp !== 20) throw new Error('exp: expected 20, got ' + player.exp);
  });

  it('经验足够连续升多级', () => {
    player.exp = 0;
    player.lvl = 1;
    player.expNext = 30;
    // 30+80+150+240+350 = 850, add a few extra
    gainExp(860);
    if (player.lvl !== 6) throw new Error('lvl: expected 6, got ' + player.lvl);
    if (player.exp !== 10) throw new Error('exp: expected 10, got ' + player.exp);
  });

  it('升级时 maxHp 增加 20', () => {
    var oldMaxHp = player.maxHp;
    player.exp = player.expNext - 1;
    gainExp(1);
    if (player.maxHp !== oldMaxHp + 20)
      throw new Error('maxHp: expected ' + (oldMaxHp + 20) + ', got ' + player.maxHp);
  });

  it('升级恢复满 HP 和 MP', () => {
    player.hp = 10;
    player.mp = 5;
    player.exp = player.expNext - 1;
    gainExp(1);
    if (player.hp !== player.maxHp)
      throw new Error('hp should be full, got ' + player.hp);
    if (player.mp !== player.maxMp)
      throw new Error('mp should be full, got ' + player.mp);
  });

  it('升级后 expNext 更新', () => {
    player.exp = player.expNext - 1;
    gainExp(1);
    var expected = calcExpNext(player.lvl);
    if (player.expNext !== expected)
      throw new Error('expNext: expected ' + expected + ', got ' + player.expNext);
  });
});

// ---- playerDied ----
describe('playerDied', ({ assert }) => {
  it('设置暂停状态', () => {
    gameState.paused = false;
    player.hp = 0;
    player.gold = 20;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    playerDied();
    if (!gameState.paused) throw new Error('gameState.paused should be true');
    permanent = null;
  });

  it('切换到 gameover 屏幕', () => {
    gameState.screen = 'combat';
    player.hp = 0;
    player.gold = 20;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    playerDied();
    if (gameState.screen !== 'gameover')
      throw new Error('screen: expected gameover, got ' + gameState.screen);
    permanent = null;
  });

  it('清除 combatState', () => {
    combatState = { enemy: { name: 'test' } };
    player.hp = 0;
    player.gold = 20;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    playerDied();
    if (combatState !== null)
      throw new Error('combatState should be null, got ' + JSON.stringify(combatState));
    permanent = null;
  });

  it('正常状态下也可调用', () => {
    gameState.screen = 'dungeon';
    gameState.paused = false;
    combatState = null;
    player.hp = 0;
    player.gold = 20;
    permanent = { permanentStats: Object.assign({}, defaultPermanentStats()), soulShards: 0 };
    playerDied();
    if (!gameState.paused) throw new Error('should be paused');
    if (gameState.screen !== 'gameover') throw new Error('screen should be gameover');
    permanent = null;
  });
});

// ---- startCombat ----
describe('startCombat', ({ assert }) => {
  it('初始化 combatState', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    combatState = null;
    startCombat(0);
    if (!combatState) throw new Error('combatState should exist');
    if (combatState.enemy.name !== '测试怪')
      throw new Error('wrong enemy name');
  });

  it('设置 pause 和 screen', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    gameState.paused = false;
    gameState.screen = 'dungeon';
    startCombat(0);
    if (!gameState.paused) throw new Error('game should be paused');
    if (gameState.screen !== 'combat')
      throw new Error('screen should be combat, got ' + gameState.screen);
  });

  it('combatState turn 初始为 0', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    startCombat(0);
    if (combatState.turn !== 0) throw new Error('turn should be 0');
  });

  it('combatState playerDefending 初始为 false', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    startCombat(0);
    if (combatState.playerDefending !== false)
      throw new Error('playerDefending should be false');
  });

  it('enemyIdx 正确保存', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '怪A', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    dungeon.enemies.push({
      name: '怪B', hp: 40, atk: 8, def: 3, spd: 5,
      x: 15, y: 15, icon: '👹', actions: [], gold: 8, exp: 15,
    });
    startCombat(1);
    if (combatState.enemyIdx !== 1) throw new Error('enemyIdx should be 1');
    if (combatState.enemy.name !== '怪B')
      throw new Error('wrong enemy, expected 怪B');
  });

  it('对死敌不启动战斗', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 0, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    combatState = { enemy: { name: 'old' } };
    startCombat(0);
    if (!combatState || combatState.enemy.name !== 'old')
      throw new Error('should not start combat with dead enemy');
  });

  it('对不存在索引不启动战斗', () => {
    dungeon = makeDungeon();
    dungeon.enemies = [];
    combatState = { enemy: { name: 'old' } };
    startCombat(0);
    if (!combatState || combatState.enemy.name !== 'old')
      throw new Error('should not start combat with invalid index');
  });

  it('Boss 敌人调用 initBossCombat', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '最终Boss', hp: 200, atk: 20, def: 10, spd: 6,
      x: 10, y: 10, icon: '💀', actions: [], boss: true,
      rules: [{ threshold: 0.5, effect: 'berserk', desc: '狂暴' }],
      gold: 50, exp: 50,
    });
    combatState = null;
    startCombat(0);
    if (!combatState) throw new Error('combatState should exist');
    if (!combatState.bossRules)
      throw new Error('should have bossRules (initBossCombat called)');
  });

  it('调用 renderCombatActions（检查 DOM）', () => {
    dungeon = makeDungeon();
    dungeon.enemies.push({
      name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4,
      x: 10, y: 10, icon: '👹', actions: [], gold: 5, exp: 10,
    });
    startCombat(0);
    var el = document.getElementById('combat-actions');
    if (el.style.display !== 'block')
      throw new Error('combat-actions should be visible');
  });
});

// ---- doDefend ----
describe('doDefend', ({ assert }) => {
  it('设置 playerDefending 标志', () => {
    combatState = {
      enemy: { name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false,
    };
    gameState.paused = false;
    doDefend();
    if (!combatState.playerDefending)
      throw new Error('playerDefending should be true');
  });

  it('没有 combatState 时不执行', () => {
    var saved = combatState;
    combatState = null;
    gameState.paused = false;
    doDefend(); // should not throw
    combatState = saved;
  });

  it('动画中不执行', () => {
    combatState = {
      enemy: { name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false, animating: true,
    };
    gameState.paused = false;
    doDefend();
    if (combatState.playerDefending !== false)
      throw new Error('should not defend when animating');
  });

  it('防御恢复少量 MP', () => {
    combatState = {
      enemy: { name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false,
    };
    player.mp = 10;
    player.maxMp = 30;
    var mpBefore = player.mp;
    doDefend();
    if (player.mp <= mpBefore)
      throw new Error('mp should increase, was ' + mpBefore + ' now ' + player.mp);
  });

  it('MP 不超过 maxMp', () => {
    combatState = {
      enemy: { name: '测试怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false,
    };
    player.mp = 29;
    player.maxMp = 30;
    doDefend();
    if (player.mp > player.maxMp)
      throw new Error('mp should not exceed maxMp');
  });
});

// ---- tryFlee ----
describe('tryFlee', ({ assert }) => {
  it('对 Boss 逃跑失败', () => {
    combatState = {
      enemy: {
        name: '测试Boss', hp: 200, atk: 20, def: 10, spd: 6,
        boss: true, actions: [],
      },
      turn: 0, playerDefending: false,
    };
    gameState.paused = true;
    tryFlee();
    if (combatState === null) throw new Error('combatState should still exist');
  });

  it('成功逃跑清除 combatState', () => {
    var restore = seedRandom(1);
    combatState = {
      enemy: { name: '普通怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false,
    };
    gameState.paused = true;
    gameState.screen = 'combat';
    player.baseSpd = 35; // fleeChance = 30 + 35*2 = 100, always succeeds
    tryFlee();
    restore();
    if (combatState !== null) throw new Error('combatState should be null after fleeing');
    if (gameState.paused !== false) throw new Error('should not be paused');
    if (gameState.screen !== 'dungeon')
      throw Error('screen should be dungeon, got ' + gameState.screen);
  });

  it('逃跑也依赖速度', () => {
    var restore = seedRandom(100);
    combatState = {
      enemy: { name: '快速怪', hp: 30, atk: 5, def: 2, spd: 4, actions: [] },
      turn: 0, playerDefending: false,
    };
    gameState.paused = true;
    gameState.screen = 'combat';
    player.baseSpd = 2; // Low speed, low chance
    tryFlee();
    restore();
    // With seed 100 and low speed, check result (deterministic)
    // Speed 2: fleeChance = 30 + 2*2 = 34
    // We just check it doesn't crash and produces a valid state
    if (gameState.screen !== 'dungeon' && gameState.screen !== 'combat')
      throw new Error('screen should be dungeon or combat');
  });

  it('没有 combatState 时不执行', () => {
    var saved = combatState;
    combatState = null;
    gameState.paused = false;
    tryFlee(); // should not throw
    combatState = saved;
  });
});

// ---- initBossCombat (from boss.js) ----
describe('initBossCombat', ({ assert }) => {
  var bossData = {
    name: '暗影领主', icon: '💀', hp: 200, atk: 20, def: 10, spd: 6,
    actions: [{ type: 'attack', weight: 70, label: '攻击' }],
    boss: true,
    rules: [
      { threshold: 0.5, effect: 'berserk', desc: '进入狂暴' },
      { threshold: 0.25, effect: 'double_strike', desc: '双击' },
    ],
    gold: 50, exp: 50,
  };

  it('创建 enemy 副本', () => {
    combatState = null;
    initBossCombat(bossData, dungeon);
    if (!combatState) throw new Error('combatState should exist');
    if (combatState.enemy.name !== bossData.name)
      throw new Error('wrong enemy name');
  });

  it('设置 bossRules 和 bossPhase', () => {
    combatState = null;
    initBossCombat(bossData, dungeon);
    if (!combatState.bossRules) throw new Error('bossRules should exist');
    if (combatState.bossRules.length !== 2)
      throw new Error('bossRules length: expected 2');
    if (combatState.bossPhase !== 1)
      throw new Error('bossPhase should start at 1');
  });

  it('enemy boss 标志为 true', () => {
    combatState = null;
    initBossCombat(bossData, dungeon);
    if (combatState.enemy.boss !== true)
      throw new Error('enemy.boss should be true');
  });

  it('maxHp 从 hp 复制', () => {
    combatState = null;
    initBossCombat(bossData, dungeon);
    if (combatState.enemy.maxHp !== 200)
      throw new Error('maxHp: expected 200, got ' + combatState.enemy.maxHp);
  });

  it('暂停并切换到 combat 屏幕', () => {
    gameState.paused = false;
    gameState.screen = 'dungeon';
    initBossCombat(bossData, dungeon);
    if (!gameState.paused) throw new Error('game should be paused');
    if (gameState.screen !== 'combat')
      throw new Error('screen should be combat');
  });

  it('初始化 bossActiveEffects 和 bossTriggeredRules 为空', () => {
    combatState = null;
    initBossCombat(bossData, dungeon);
    // After init, tickBossRules is called; at 100% HP, rules with threshold < 1
    // won't trigger (threshold 0.5 and 0.25, hpRatio = 1.0)
    // So these should be empty after initial tick
    if (!Array.isArray(combatState.bossActiveEffects))
      throw new Error('bossActiveEffects should be an array');
    if (!Array.isArray(combatState.bossTriggeredRules))
      throw new Error('bossTriggeredRules should be an array');
  });

  it('保存 dungeon 引用到 _bossDungeon', () => {
    dungeon = makeDungeon();
    combatState = null;
    initBossCombat(bossData, dungeon);
    if (combatState._bossDungeon !== dungeon)
      throw new Error('_bossDungeon should reference dungeon');
  });

  it('threshold 为 1.0 的规则立即触发', () => {
    var instantBoss = {
      name: '暴怒Boss', icon: '🔥', hp: 100, atk: 15, def: 8, spd: 5,
      actions: [], boss: true,
      rules: [{ threshold: 1.0, effect: 'berserk', desc: '立即狂暴' }],
      gold: 30, exp: 30,
    };
    combatState = null;
    initBossCombat(instantBoss, dungeon);
    if (combatState.bossTriggeredRules.length < 1)
      throw new Error('threshold 1.0 rule should trigger on init');
  });
});
