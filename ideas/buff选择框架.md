---
name: buff 选择框架设计
description: 可复用的 buff 选择系统，参考 TinyWind Cursed Cargo
metadata:
  category: 通用框架设计
  status: 设计中
  created: 2026-06-19
  reference: [[TinyWind 调研]]
---

# Buff 选择框架

## 灵感来源

TinyWind 的 Cursed Cargo 系统：8 个可收集 buff，关卡前选择，收集解锁，账号存档。

## 设计目标

做一个**即插即用的 buff 选择 UI 框架**，任何单文件游戏都能嵌入：
- 游戏定义 buff 数据（名字、描述、图标、效果函数）
- 框架负责：展示、选择、解锁进度、本地存档
- 不依赖外部库，纯 HTML + CSS + JS 内联

## 核心数据结构

```javascript
const BUFFS = [
  {
    id: "black_pearl",
    name: "黑珍珠",
    description: "攻击间隔减少 1 秒",
    icon: "🏴‍☠️",        // emoji 或 base64 像素画
    rarity: "legendary",  // common / rare / legendary / mythic
    effect: (state) => { state.attackCooldown = Math.max(100, state.attackCooldown - 1000); },
    unlockCondition: null,  // null = 默认解锁
  },
  // ...
];
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识，用于存档 |
| `name` | string | 显示名称 |
| `description` | string | 效果描述 |
| `icon` | string | emoji 优先（零资源），或 base64 像素画 |
| `rarity` | enum | 稀有度，决定 UI 配色 |
| `effect` | function | 实际效果，接收游戏状态并修改 |
| `unlockCondition` | object/null | 解锁条件，null 表示默认解锁 |

### 解锁条件

```javascript
unlockCondition: {
  type: "score",        // score / count / achievement / manual
  value: 1000,          // 需要达到的值
  label: "单次得分达到 1000",  // 解锁前显示的文字
}
```

## UI 流程

```
进入游戏 → buff 选择界面 → 选择 1-3 个 buff → 开始游戏 → buff 生效
                                                              ↓
                                                 游戏过程中检测解锁条件
                                                              ↓
                                                 新 buff 解锁 → 弹窗提示
```

### 选择界面布局

参考 TinyWind 的 Cursed Cargo：

```
┌────────────────────────────────────┐
│         CURSED CARGO               │
│      选择至多 3 个神秘 buff         │
├────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ 🏴‍☠️ │  │ ⚓    │  │ 🔒   │     │
│  │黑珍珠│  │锚之力 │  │已锁定 │     │
│  │传奇  │  │稀有   │  │      │     │
│  │[已选]│  │       │  │需:xxx│     │
│  └──────┘  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ 💀   │  │ 🌊   │  │ 🔒   │     │
│  │      │  │      │  │      │     │
│  └──────┘  └──────┘  └──────┘     │
├────────────────────────────────────┤
│            [SET SAIL]              │
└────────────────────────────────────┘
```

### 稀有度配色

| 稀有度 | 边框色 | 背景色 | 文字色 |
|--------|--------|--------|--------|
| common | `#6b7280` | `rgba(107,114,128,0.1)` | `#9ca3af` |
| rare | `#3b82f6` | `rgba(59,130,246,0.1)` | `#60a5fa` |
| legendary | `#f59e0b` | `rgba(245,158,11,0.1)` | `#fbbf24` |
| mythic | `#a855f7` | `rgba(168,85,247,0.1)` | `#c084fc` |

## 存档系统

```javascript
const STORAGE_KEY = "buff_unlocks_v1";

function loadUnlockedBuffs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveUnlockedBuff(buffId) {
  const unlocked = loadUnlockedBuffs();
  if (!unlocked.includes(buffId)) {
    unlocked.push(buffId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unlocked));
    return true;  // 新解锁
  }
  return false;
}
```

**问题**：多个游戏共用一个项目，buff 存档是否需要隔离？

方案：每个游戏用不同的 `STORAGE_KEY` 前缀，如 `game01_buff_unlocks_v1`。

## 框架 API 设计

```javascript
// 游戏初始化时调用
const buffSystem = createBuffSystem({
  buffs: BUFFS,
  maxSelect: 3,           // 最多选几个
  storageKey: "game01",  // 存档前缀
  onApply: (selectedBuffs, gameState) => {
    // 可选：批量应用 hook
    selectedBuffs.forEach(buff => buff.effect(gameState));
  },
});

// 显示选择界面（返回 Promise）
const selectedBuffs = await buffSystem.showSelectionUI();

// 游戏过程中检测解锁
buffSystem.checkUnlocks({ score: currentScore, kills: killCount });

// 通知用户新解锁
buffSystem.onUnlock = (buff) => {
  showUnlockPopup(buff);  // 游戏自定义
};
```

## 与游戏集成的生命周期

```
游戏加载
  ↓
初始化 buffSystem（加载存档）
  ↓
显示选择界面 → 玩家选择 → 关闭选择界面
  ↓
应用选中 buff 到游戏状态
  ↓
游戏运行中 → checkUnlocks() 检测新解锁
  ↓
游戏结束 → 返回大厅
```

## 像素风 UI 风格

延续项目的像素风统一风格：

- 边框：1px solid，用稀有度颜色
- 字体：Press Start 2P 或系统像素字体 fallback
- 卡片：方块造型，选中时有高亮边框 + 阴影
- 动画：选中/解锁时的像素风闪烁效果，用 CSS `@keyframes`
- 按钮：方块风格，hover 时位移 2px（模拟像素跳跃）

## 扩展性

### 被动 vs 主动 buff

```javascript
{
  id: "shield",
  type: "passive",       // passive: 自动生效 / active: 需要玩家触发
  // passive effect
  effect: (state) => { state.maxHP += 50; },

  // active effect（可选）
  active: {
    label: "护盾",
    cooldown: 10000,      // 冷却时间
    useKey: "E",          // 快捷键
    execute: (state) => { state.shieldActive = true; setTimeout(() => state.shieldActive = false, 5000); },
  },
}
```

### buff 组合效果

```javascript
{
  id: "combo_bonus",
  // 当同时选中包含 "fire" 标签的 buff 时，额外加成
  synergy: {
    tags: ["fire"],
    bonus: (state) => { state.damageMultiplier *= 1.5; },
  },
  tags: ["speed"],
}
```

## 实施计划

1. **Phase 1** — 最小可用框架：buff 数据 → 选择 UI → localStorage 存档
2. **Phase 2** — 接入一个已有游戏（如贪吃蛇或坦克大战）验证
3. **Phase 3** — 解锁条件检测、主动 buff、组合效果
4. **Phase 4** — 像素风 UI 打磨

## 文件大小预估

框架代码（纯 HTML + CSS + JS）：~2KB 压缩后
选择一个 UI 的 HTML/CSS：~1.5KB
总新增：~3.5KB，对单文件游戏来说很小。

可通过 `<script src="buff-system.js">` 外链或内联嵌入。
