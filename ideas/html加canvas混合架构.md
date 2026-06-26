---
name: HTML + Canvas 混合架构设计
description: 游戏画面 Canvas + UI HTML 的混合渲染方案
metadata:
  category: 通用框架设计
  status: 设计中
  created: 2026-06-19
  reference: [[TinyWind 调研]]
---

# HTML + Canvas 混合架构

## 灵感来源

TinyWind 的 UI 并非全部画在 Canvas 上。分析发现，主游戏画面用 Canvas 渲染，但所有交互 UI（按钮、滑块、资源栏、弹窗）都是 `DIV.fixed` HTML 元素浮在 Canvas 之上。

## 核心观察

### 传统单 Canvas 模式的问题

```
┌────────────────────────────────┐
│ CANVAS (everything)            │
│  ├─ 游戏画面                    │
│  ├─ 按钮（需手动画）            │
│  ├─ 文字（需手动 fillText）     │
│  └─ 点击检测（需手动算坐标）     │
└────────────────────────────────┘
```

- UI 绘制和渲染耦合在同一帧循环
- 按钮点击要手动算坐标、判断碰撞
- hover 效果要实现鼠标移动检测 + 重绘
- 无法用 CSS 做动画、过渡、响应式

### 混合模式

```
┌────────────────────────────────┐
│ HTML UI Layer (fixed position) │  ← DOM 层：按钮、弹窗、HUD
│ ┌──────────────────────────┐   │
│ │ CANVAS (game world)      │   │  ← Canvas 层：角色、地图、粒子
│ │                          │   │
│ └──────────────────────────┘   │
└────────────────────────────────┘
```

**分工明确**：
- Canvas 只负责「会动的东西」（角色、地图、粒子、特效）
- HTML 负责「可交互的东西」（按钮、输入框、弹窗、进度条）
- CSS `position: fixed` 把 UI 钉在视口上，不参与 Canvas 帧循环

## 实现方案

### 基础 HTML 骨架

```html
<div class="game-container">
  <canvas id="game" width="800" height="600"></canvas>

  <!-- HUD 层 -->
  <div class="hud-top">
    <span class="score">分数: <span id="score">0</span></span>
    <span class="lives">生命: <span id="lives">3</span></span>
  </div>

  <!-- 操作按钮 -->
  <div class="controls-bottom">
    <button id="btn-pause" class="pixel-btn">暂停</button>
  </div>

  <!-- 弹窗 -->
  <div id="modal-overlay" class="modal hidden">
    <div class="modal-content">
      <h2>游戏结束</h2>
      <p>最终分数: <span id="final-score">0</span></p>
      <button id="btn-restart" class="pixel-btn">重新开始</button>
    </div>
  </div>
</div>
```

### CSS 核心

```css
.game-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

canvas#game {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;  /* 像素风关键 */
}

/* 所有 UI 用 fixed 钉在视口 */
.hud-top, .controls-bottom {
  position: fixed;
  z-index: 10;
  pointer-events: none;       /* UI 容器不阻挡，按钮单独开启 */
}

.hud-top > *, .controls-bottom > * {
  pointer-events: auto;       /* 子元素可交互 */
}

.pixel-btn {
  pointer-events: auto;
  font-family: "Press Start 2P", monospace;
  /* 像素风按钮样式 */
  border: 2px solid #fff;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 8px 16px;
  cursor: pointer;
  image-rendering: pixelated;
}

.pixel-btn:hover {
  transform: translateY(-2px);  /* 纯 CSS hover 效果 */
  box-shadow: 0 2px 0 #fff;
}

.pixel-btn:active {
  transform: translateY(0);
  box-shadow: none;
}
```

### Canvas 与 DOM 通信模式

**Canvas 不知道 UI 的存在，UI 通过 data attribute 或全局变量读取游戏状态**：

```javascript
// 游戏状态放在全局（或模块级）变量
const gameState = {
  score: 0,
  lives: 3,
  paused: false,
};

// Canvas 帧循环只关心渲染和物理
function gameLoop() {
  if (!gameState.paused) {
    update();
    render();
  }
  requestAnimationFrame(gameLoop);
}

// UI 更新由事件驱动，不占帧循环
function onScoreChange(newScore) {
  document.getElementById("score").textContent = newScore;
}

// 按钮事件直接修改游戏状态
document.getElementById("btn-pause").addEventListener("click", () => {
  gameState.paused = !gameState.paused;
});
```

### 数据流向

```
用户点击按钮  →  DOM 事件  →  修改 gameState  →  Canvas 帧循环读取
Canvas 计算结果  →  修改 gameState  →  DOM 元素更新 textContent
```

**关键原则**：
- Canvas 帧循环不操作 DOM（避免布局抖动）
- DOM 事件不直接操作 Canvas（职责分离）
- 两者通过共享 `gameState` 对象通信
- DOM 更新用事件驱动（`onScoreChange`），不用每帧轮询

## 多 Canvas 分层（可选进阶）

TinyWind 用了 5 个 Canvas，其中 3 个是 UI 专用的。我们的单文件游戏可以简化为 2-3 个：

| Canvas | 用途 | 帧率 |
|--------|------|------|
| 主 Canvas | 游戏画面（角色、地图、碰撞） | 60fps |
| 粒子 Canvas（可选） | 特效层（爆炸、火花、光效） | 60fps，可独立降级 |
| 小地图 Canvas（可选） | 俯视地图 | 10fps 即可 |

**多 Canvas 的好处**：
- 粒子层可以被大量修改而不用重绘整个场景
- 粒子特效可以独立做 `globalCompositeOperation`（发光、混合模式）
- 小地图可以降帧渲染，省性能

**多 Canvas 的代价**：
- 每个 Canvas 有自己的帧循环，需协调
- 单文件体积增大
- 移动端可能性能不佳

**推荐**：默认单 Canvas，性能足够。粒子多或地图大时再加第二个 Canvas。

## 移动端触屏控件

TinyWind 用 HTML `DIV.fixed` 做虚拟摇杆和按钮：

```html
<div class="touch-controls">
  <div class="touch-zone" id="joystick"></div>
  <button class="touch-btn" id="btn-fire">FIRE</button>
  <button class="touch-btn" id="btn-action">ACTION</button>
</div>
```

```css
.touch-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 16px;
  z-index: 20;
  display: none;  /* 默认隐藏 */
}

@media (pointer: coarse) {
  .touch-controls { display: flex; }  /* 触屏设备才显示 */
}

.touch-btn {
  width: 64px;
  height: 64px;
  border: 2px solid rgba(255,255,255,0.5);
  background: rgba(0,0,0,0.4);
  color: #fff;
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
}
```

**关键 CSS**：
- `@media (pointer: coarse)` — 只在触屏设备显示虚拟控件
- `-webkit-tap-highlight-color: transparent` — 移除安卓点击高亮
- `touch-action: manipulation` — 禁用双击缩放

## 与纯 Canvas 方案对比

| 维度 | 纯 Canvas | 混合模式 |
|------|-----------|----------|
| UI 开发效率 | 低（手写绘制 + 点击检测） | 高（HTML + CSS + 事件） |
| hover/动画 | 需手动实现 | CSS 原生支持 |
| 响应式 | 需手动 resize | CSS media query |
| 无障碍 | 差（屏幕阅读器不可读） | 好（原生 HTML 语义） |
| 性能 | 单帧循环，稳定 | 需确保 DOM 更新不阻塞帧循环 |
| 文件大小 | 可能更大（UI 代码） | HTML 自带布局引擎，更小 |
| 移动端触控 | 需 touch 事件 + 自定义 | DOM 事件自动适配 |

## 适用场景

**推荐用混合模式的场景**：
- 游戏有大量 UI 元素（按钮、菜单、进度条、弹窗）
- 需要 hover 效果、CSS 动画
- 要做移动端适配（虚拟摇杆、触屏按钮）
- 需要响应式布局

**纯 Canvas 更合适的场景**：
- 极简游戏（Flappy Bird 级别，只有分数 + 重新开始）
- 像素完美对齐（每个 UI 元素要和游戏画面像素级对齐）
- 全屏幕交互（整个 Canvas 都是可点击区域）

## 集成建议

框架层面的通用部分：

1. **`game-container` CSS 模板** — 可直接复制的 HTML 骨架
2. **`pixel-btn` 样式** — 像素风按钮的 CSS，hover/active 动画
3. **HUD 更新辅助函数** — `updateDOMElement(selector, value)` 批量更新
4. **响应式断点** — 统一的 `@media` 规则，桌面/平板/手机

这些可以抽成 `web/shared/game-layout.css` 和 `web/shared/game-ui.js` 两个公共文件，所有游戏引用。
