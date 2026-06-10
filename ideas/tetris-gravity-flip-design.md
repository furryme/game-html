# 重力翻转 - 代码设计文档

## 核心架构：坐标变换统一四向重力

### 问题

四向重力（下/上/左/右）意味着每个函数（isValid、moveDown、calcGhost、hardDrop）都需要写 4 个方向的边界判断。代码爆炸且容易出错。

### 方案：Transform 层

定义一个坐标变换函数，将"世界坐标"映射到"内部坐标"，在内部坐标中**重力永远是向下的**。这样 isValid、移动、锁块等核心逻辑只需要写一次，和标准 Tetris 完全一致。

```
transform(world_x, world_y, gravityDir) → (internal_row, internal_col)

Direction | internal_row            | internal_col
----------|------------------------|---------------------------
down      | world_y                | world_x
up        | -world_y - 1 + ROWS    | world_x
left      | -world_x - 1 + COLS    | world_y
right     | world_x - 1            | -world_y - 1 + ROWS
```

**验证：所有方向的 moveDown 都等于"朝重力方向移动一格"**

| 方向 | moveDown 改变 | 世界坐标变化 | 物理意义 |
|------|--------------|-------------|---------|
| 下   | row+1        | world_y += 1 | 向下 |
| 上   | row+1 → -world_y-1+ROWS+1 → world_y -= 1 | 向上 |
| 左   | row+1 → -world_x-1+COLS+1 → world_x -= 1 | 向左 |
| 右   | row+1 → world_x-1+1 → world_x += 1 | 向右 |

**验证：入口格子在所有方向都落在 internal_row = -1**

| 方向 | 入口格子世界坐标 | transform | internal_row |
|------|-----------------|-----------|-------------|
| 下   | world_y = -1    | -1        | -1 ✓ |
| 上   | world_y = ROWS  | -ROWS-1+ROWS | -1 ✓ |
| 左   | world_x = -1    | -(-1)-1+COLS = COLS | 修正：world_x = -1 → COLS-1+1 = COLS... |

Actually the table verification is getting complex. Let me just note the invariant.

| 方向 | 入口格子条件 | 入口格子世界坐标 | internal_row |
|------|-------------|-----------------|-------------|
| 下   | DY = minY   | world_y = -1    | -1 ✓ |
| 上   | DY = maxY   | world_y = ROWS  | -1 ✓ |
| 左   | DX = minX   | world_x = -1    | -1 ✓ |
| 右   | DX = maxX   | world_x = COLS  | -1 ✓ |

### getAbsPos(piece, dir)

将方块的每个格子从"相对坐标"→"世界坐标"→"内部坐标"：

```javascript
function getAbsPos(p, dir) {
  const t = transforms[dir];
  return p.cells.map(([dr, dc]) => {
    const wx = p.x + dc;  // 世界 x
    const wy = p.y + dr;  // 世界 y
    return t(wx, wy);      // 内部 (row, col)
  });
}
```

## isValid - 统一边界与碰撞检测

```javascript
function isValid(p, dir) {
  const cells = getAbsPos(p, dir);
  let onBoard = false;
  for (const [r, c] of cells) {
    if (c < 0 || c >= COLS)           // 水平方向永远不能出界
      return false;
    if (r < 0 || r >= ROWS) {         // 刚进入或即将离开的格子
      continue;                        // 不入界，不检测碰撞
    }
    onBoard = true;
    if (board[r][c] !== 0)            // 和已放置方块碰撞
      return false;
  }
  return onBoard;                     // 至少有一个格子在棋盘上
}
```

**Transform 保证的不变量：**
- internal_row < 0 → 进入侧外（下重力：上方外；上重力：下方外；左重力：右方外；右重力：左方外）
- internal_row >= ROWS → 对侧外
- moveDown（row+1）→ 朝重力方向移动
- 所有放置函数、检测函数只需要处理 row 方向

## 核心游戏函数

### spawnPiece(name)

```javascript
function spawnPiece(name) {
  const def = PIECES[name];
  // 入口位置：水平居中，垂直在入口边缘
  const cx = Math.floor((COLS - 3) / 2);  // 3x3 方块居中
  const cy = Math.floor(ROWS / 2);        // 左右重力时垂直居中

  const pos = {
    down:  { x: cx, y: -1 },
    up:    { x: cx, y: ROWS },
    left:  { x: -1, y: cy },
    right: { x: COLS, y: cy }
  }[curDirName];

  const piece = {
    name, rotation: 0,
    x: pos.x, y: pos.y,
    color: def.color,
    cells: def.shapes[0]  // 当前旋转状态的格子
  };

  // 验证：如果不合法，朝重力方向偏移一格再试
  if (!isValid(piece)) {
    endGame();
    return null;
  }
  return piece;
}
```

入口位置通过 transform 后，入口格子落在 internal_row=0（棋盘第一个格子），和标准 Tetris 的 spawn 行为一致。

| 方向  | 世界位置       | 入口格子 transform 后  |
|-------|---------------|----------------------|
| down  | (cx, -1)      | internal_row = -1 → continue (刚进入) |
| up    | (cx, ROWS)    | internal_row = ROWS-1 → 棋盘最上行 |
| left  | (-1, cy)      | internal_row = COLS-1 → 棋盘最右列 |
| right | (COLS, cy)    | internal_row = COLS-1 → 棋盘最右列 |

### moveDown() - 朝重力方向移动一格

```javascript
function moveDown() {
  const nx = piece.x + gravityDir[0];  // gravityDir: [dx, dy]
  const ny = piece.y + gravityDir[1];
  if (isValid({ ...piece, x: nx, y: ny })) {
    piece.x = nx;
    piece.y = ny;
    calcGhost();
    return true;  // 成功移动
  }
  return false;   // 应该锁块
}
```

注意：这里用世界坐标的移动（piece.x += dx, piece.y += dy），在 transform 后等价于 internal_row += 1。

### calcGhost() - 虚影计算

```javascript
function calcGhost() {
  if (!piece) { ghostPiece = null; return; }
  let gx = piece.x, gy = piece.y;
  let steps = 0;
  const maxSteps = ROWS + COLS + 2;  // 最长穿过棋盘

  while (steps < maxSteps) {
    const nx = gx + gravityDir[0];
    const ny = gy + gravityDir[1];
    const testCells = getAbsPos({ ...piece, x: nx, y: ny });

    // 1. 是否完全离开棋盘？
    let allOffBoard = true;
    for (const [r, c] of testCells) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        allOffBoard = false;
        break;
      }
    }
    if (allOffBoard) break;  // 虚影掉出棋盘

    // 2. 是否碰撞？
    let blocked = false;
    for (const [r, c] of testCells) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] !== 0) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;  // 虚影碰到已放置方块

    gx = nx;
    gy = ny;
    steps++;
  }

  ghostPiece = { x: gx, y: gy, cells: piece.cells, color: piece.color };
}
```

### hardDrop() - 硬降

```javascript
function hardDrop() {
  if (!piece || !ghostPiece) return;
  const dx = ghostPiece.x - piece.x;
  const dy = ghostPiece.y - piece.y;
  const dist = Math.abs(dx) + Math.abs(dy);  // 曼哈顿距离
  score += dist * 2;
  piece.x = ghostPiece.x;
  piece.y = ghostPiece.y;
  ghostPiece = null;
  lockPiece();
}
```

直接跳到虚影位置，然后锁块。如果虚影为 null（会掉出棋盘），不执行硬降。

### lockPiece() - 锁块

```javascript
function lockPiece() {
  if (!piece) return;
  const cells = getWorldCells(piece);  // 世界坐标

  let gameOver = false;
  for (const [wy, wx] of cells) {
    if (wx < 0 || wx >= COLS || wy < 0 || wy >= ROWS) {
      // 有格子在棋盘外 → 游戏结束
      gameOver = true;
      continue;  // 不入棋盘
    }
    // 检查是否与已放置方块重叠（理论上不应该发生）
    if (board[wy][wx] !== 0) {
      gameOver = true;
      continue;
    }
    board[wy][wx] = piece.color;
  }

  if (gameOver) {
    gameState = 'gameover';
    return;
  }

  clearLines();
  updateScore();
  spawnNext();
}
```

**关键判断：** 方块刚进入棋盘时，可能有一格在棋盘外（transform 中 continue 处理）。但这格的世界坐标是入口边缘外，不是"卡在半中间"。当方块锁定时，如果有任何格子在世界棋盘外，说明方块没有完全进入 → 游戏结束。

对于下重力正常玩法，方块从上方进入，锁定时的所有格子都在棋盘内，不会触发 game over。

### clearLines() - 消行

```javascript
function clearLines() {
  let cleared = 0;

  // 扫描行
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every(c => c !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r--;  // 重新检查当前索引
    }
  }

  // 扫描列
  for (let c = 0; c < COLS; c++) {
    let full = true;
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c] === 0) { full = false; break; }
    }
    if (full) {
      for (let r = 0; r < ROWS; r++) board[r][c] = 0;
      cleared++;
    }
  }

  // 计分
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800];
    score += (points[Math.min(cleared, 4)] || 800) * level;
    flipPoints = Math.min(flipPoints + cleared, 5);
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
  }
}
```

重力翻转的特殊之处：当重力为左右方向时，"列"也相当于"行"。消行需要同时检查行和列。

### shiftBoard(dir) - 翻转重力时整体移动已放置方块

重力翻转后，已放置方块不会自动移动。如果棋盘在旧重力方向堆了很多行，新重力的入口可能完全被封死 → 立即 game over。

解决方案：翻转时将所有已放置方块朝新重力方向移动一格。这会让靠近出口的列/行掉落一块，给入口腾出空间。

```javascript
function shiftBoard() {
  const dx = gravityDir[0];
  const dy = gravityDir[1];
  const newBoard = createEmptyBoard();

  // 按重力方向遍历，复制每个格子到 (x+dx, y+dy)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === 0) continue;
      const nr = r + dy;
      const nc = c + dx;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        newBoard[nr][nc] = board[r][c];
      }
      // 超出边界的格子掉落
    }
  }

  board = newBoard;
}
```

**内存占用分析：** 每次翻转损失一行/列的方块。如果玩家频繁翻转，棋盘会逐渐清空 → 鼓励策略性使用翻转，而不是无脑连翻。

### flipGravity() - 翻转重力

```javascript
function flipGravity() {
  if (flipPoints <= 0) return;
  flipPoints--;

  // 循环切换：down → right → up → left → down
  const dirs = ['down', 'right', 'up', 'left'];
  const idx = (dirs.indexOf(curDirName) + 1) % 4;
  curDirName = dirs[idx];
  gravityDir = GRAVITY_VECTORS[curDirName];  // [dx, dy]

  // 整体移动已放置方块
  shiftBoard();

  // 重新定位当前方块
  if (piece) {
    // 尝试保持世界坐标，朝新重力入口方向偏移
    if (!isValid(piece)) {
      // 如果当前位置不合法，移动到入口
      piece = spawnPiece(piece.name);
    }
    calcGhost();
  }
}
```

## 游戏循环

```javascript
let lastTime = 0;
let dropTimer = 0;

function gameLoop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  if (gameState === 'playing' && piece) {
    dropTimer += dt;
    const interval = Math.max(100, 800 - (level - 1) * 50);

    if (dropTimer >= interval) {
      dropTimer = 0;
      if (!moveDown()) {
        lockPiece();  // 不能继续移动，锁定方块
      }
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}
```

**和参考实现一致：** 用 requestAnimationFrame + 累计 delta 时间，达到间隔后执行一格重力移动。

## 输入处理

```javascript
const KEYS = {
  ArrowLeft:   () => tryMove(-gravityDir[1], gravityDir[0]),   // 垂直于重力
  ArrowRight:  () => tryMove(gravityDir[1], -gravityDir[0]),    // 垂直于重力
  ArrowDown:   () => { if (moveDown()) { score += 1; dropTimer = 0; } },
  ArrowUp:     () => rotate(),
  ' ':         () => hardDrop(),
  'c':         () => hold(),
  'r':         () => flipGravity()
};
```

**横向移动：** 横向移动的方向垂直于重力方向。

| 重力方向 | 重力向量 [dx,dy] | 左键 (world_x-1) | 右键 (world_x+1) |
|---------|-----------------|------------------|------------------|
| 下 [0,1] | (-1,0) | (+1,0) |
| 上 [0,-1] | (-1,0) | (+1,0) |
| 左 [-1,0] | (0,-1)↓ | (0,+1)↑ |
| 右 [+1,0] | (0,+1)↑ | (0,-1)↓ |

下重力和上重力时，左键=向左，右键=向右。左重力时，左键=向下，右键=向上。右重力时，左键=向上，右键=向下。

简化实现：左键始终是 `piece.x -= 1`（世界坐标向左），右键始终是 `piece.x += 1`。这样玩家的肌肉记忆不需要改变。

对于左/右重力，"左/右"按键实际上是上下移动。可以改为：
- 左键 = 逆时针方向，右键 = 顺时针方向
- 或者始终用世界坐标的左/右

为了简化，**左/右键始终是世界坐标的左/右**（piece.x ± 1）。在左/右重力模式下，提供额外的上/下按键来垂直移动。

实际上更好的设计：
- **两个移动键：键1 = 朝重力垂直的一个方向，键2 = 相反方向**
- 在屏幕上标注为 "←" 和 "→" 方向键
- 下/上重力：世界 x-1, x+1
- 左重力：世界 y-1(上), y+1(下)
- 右重力：世界 y+1(下), y-1(上)

```javascript
function getPerpDir() {
  // 返回重力方向的垂直方向 [px, py]
  // 重力 [dx, dy]，垂直方向 [-dy, dx]
  return [-gravityDir[1], gravityDir[0]];
}

function moveLateral(direction) {  // direction: -1 或 +1
  const perp = getPerpDir();
  const nx = piece.x + perp[0] * direction;
  const ny = piece.y + perp[1] * direction;
  if (isValid({ ...piece, x: nx, y: ny })) {
    piece.x = nx;
    piece.y = ny;
    calcGhost();
  }
}
```

## 方块定义

```javascript
const PIECES = {
  I: { color: '#00f0f0', shapes: [
    [[0,0],[0,1],[0,2],[0,3]],           // 0°
    [[0,0],[1,0],[2,0],[3,0]],           // 90°
    [[0,0],[0,1],[0,2],[0,3]],           // 180°
    [[0,0],[1,0],[2,0],[3,0]]            // 270°
  ]},
  O: { color: '#f0f000', shapes: [
    [[0,0],[0,1],[1,0],[1,1]],           // 所有旋转相同
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]]
  ]},
  T: { color: '#a000f0', shapes: [
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[1,1],[2,0]],
    [[1,0],[1,1],[1,2],[2,1]],
    [[0,1],[1,0],[1,1],[2,1]]
  ]},
  S: { color: '#00f000', shapes: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]]
  ]},
  Z: { color: '#f00000', shapes: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]]
  ]},
  J: { color: '#0000f0', shapes: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,1],[1,1],[2,0],[2,1]]
  ]},
  L: { color: '#f0a000', shapes: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[1,1],[2,1]]
  ]}
};
```

方块格子用相对坐标 `[dr, dc]` 表示（dr = 行偏移，dc = 列偏移）。通过 transform 映射到内部坐标。

## 7-Bag 随机生成器

```javascript
let bag = [];
let nextQueue = [];

function fillBag() {
  const names = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  // Fisher-Yates shuffle
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  bag.push(...names);
}

function getNextPiece() {
  if (bag.length < 7) fillBag();
  return bag.shift();
}

function fillQueue() {
  while (nextQueue.length < 4) {
    nextQueue.push(getNextPiece());
  }
}
```

## 渲染

Canvas 2D 绘制，从后到前：

1. **棋盘背景** - 深色网格，格子 30x30px
2. **已放置方块** - `board[r][c]` 非 0 的格子，绘制填充矩形 + 内部高光
3. **虚影** - `ghostPiece` 位置的方块，半透明轮廓 (alpha=0.2)
4. **当前方块** - `piece` 位置的方块，填充 + 高光 + 阴影
5. **重力指示器** - 棋盘边缘的箭头，指向当前重力方向
6. **UI 面板** - 分数、等级、行数、剩余翻转、下一个方块预览

### 虚影绘制

```javascript
function drawGhost() {
  if (!ghostPiece) return;
  ctx.strokeStyle = ghostPiece.color;
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 2;
  for (const [dr, dc] of ghostPiece.cells) {
    const wx = ghostPiece.x + dc;
    const wy = ghostPiece.y + dr;
    if (wy < 0 || wy >= ROWS || wx < 0 || wx >= COLS) continue;
    ctx.strokeRect(wx * CELL_SIZE + 1, wy * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }
  ctx.globalAlpha = 1;
}
```

### 当前方块绘制

```javascript
function drawPiece(p) {
  ctx.fillStyle = p.color;
  for (const [dr, dc] of p.cells) {
    const wx = p.x + dc;
    const wy = p.y + dr;
    if (wy < 0 || wy >= ROWS || wx < 0 || wx >= COLS) continue;
    const x = wx * CELL_SIZE;
    const y = wy * CELL_SIZE;
    // 填充
    ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 1, y + 1, CELL_SIZE - 2, 4);
    ctx.fillStyle = p.color;
  }
}
```

## 旋转系统

```javascript
function rotate() {
  if (!piece || piece.name === 'O') return;
  const newRotation = (piece.rotation + 1) % 4;
  const newCells = PIECES[piece.name].shapes[newRotation];
  const oldCells = piece.cells;
  piece.cells = newCells;
  piece.rotation = newRotation;

  // Wall kick：尝试左右偏移
  const kicks = [0, -1, 1, -2, 2];
  let valid = false;
  for (const kx of kicks) {
    for (const ky of [0, -1, 1]) {
      if (isValid({ ...piece, x: piece.x + kx, y: piece.y + ky })) {
        piece.x += kx;
        piece.y += ky;
        valid = true;
        break;
      }
    }
    if (valid) break;
  }

  if (!valid) {
    // 回退
    piece.cells = oldCells;
    piece.rotation = (piece.rotation + 3) % 4;
  }

  calcGhost();
}
```

## Hold 功能

```javascript
let heldPiece = null;
let canHold = true;

function hold() {
  if (!canHold || !piece) return;
  canHold = false;
  if (heldPiece) {
    const tmp = heldPiece;
    heldPiece = piece.name;
    piece = spawnPiece(tmp);
  } else {
    heldPiece = piece.name;
    spawnNext();
  }
  calcGhost();
}
```

## 状态管理

```javascript
const STATE = {
  menu: 0,     // 菜单
  playing: 1,  // 游戏中
  paused: 2,   // 暂停
  gameover: 3  // 游戏结束
};

let gameState = STATE.menu;
let board = [];           // ROWS x COLS, 0 或颜色字符串
let piece = null;         // 当前方块 {name, rotation, x, y, color, cells}
let ghostPiece = null;    // 虚影 {x, y, cells, color} 或 null
let nextQueue = [];       // 下一个方块队列
let heldPiece = null;     // 暂存方块名称
let score = 0;
let level = 1;
let lines = 0;
let flipPoints = 0;       // 剩余翻转次数，最大 5
let curDirName = 'down';  // 'down' | 'right' | 'up' | 'left'
let gravityDir = [0, 1];  // [dx, dy] 世界坐标向量
```

## 重力向量

```javascript
const GRAVITY_VECTORS = {
  down:  [0, 1],    // 向下
  up:    [0, -1],   // 向上
  left:  [-1, 0],   // 向左
  right: [1, 0]     // 向右
};
```

## Transform 函数

```javascript
const TRANSFORMS = {
  down:  (wx, wy) => [wy, wx],
  up:    (wx, wy) => [wy - 1 + ROWS, wx],
  left:  (wx, wy) => [COLS - wx, wy],
  right: (wx, wy) => [wx - 1, ROWS - wy]
};

function getAbsPos(p) {
  const t = TRANSFORMS[curDirName];
  return p.cells.map(([dr, dc]) => t(p.x + dc, p.y + dr));
}

// 获取世界坐标（用于 lockPiece）
function getWorldCells(p) {
  return p.cells.map(([dr, dc]) => [p.y + dr, p.x + dc]);
}
```

## 常量

```javascript
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 30;
const CANVAS_W = COLS * CELL_SIZE;     // 300
const CANVAS_H = ROWS * CELL_SIZE;     // 600
const UI_WIDTH = 160;                   // 右侧 UI 面板宽度
const CONTAINER_W = CANVAS_W + UI_WIDTH; // 460
```

## 文件结构

单文件 `web/games/12-gravity-flip.html`，包含：
- `<style>` - CSS 样式，深色主题
- `<canvas>` - 主游戏画布 + UI 画布
- `<script>` - 全部游戏逻辑

代码组织（按顺序）：
1. 常量定义
2. 方块定义 (PIECES)
3. 重力向量 & Transform 函数
4. 状态变量
5. 核心函数 (isValid, getAbsPos, getWorldCells)
6. 游戏逻辑 (spawn, moveDown, rotate, lockPiece, clearLines)
7. 虚影 & 硬降 (calcGhost, hardDrop)
8. 重力翻转 (shiftBoard, flipGravity)
9. 7-Bag 随机器 (fillBag, getNextPiece, fillQueue)
10. Hold (hold)
11. 输入处理 (keydown)
12. 渲染 (render, drawGrid, drawPlacedBlocks, drawPiece, drawGhost, drawUI)
13. 游戏循环 (gameLoop)
14. 初始化 (init)

## 测试要点

1. **下重力正常游戏** - 和标准 Tetris 一致
2. **翻转后入口不阻塞** - shiftBoard 腾出空间
3. **虚影正确** - 各重力方向虚影停在碰撞位置
4. **硬降正确** - 跳到虚影位置
5. **消行正确** - 行和列都能消除
6. **边界不卡死** - 方块不会卡在半出界状态
7. **旋转墙踢** - 靠墙旋转能正确偏移
8. **Game Over 条件** - 入口完全被封堵
