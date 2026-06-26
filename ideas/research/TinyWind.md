---
name: TinyWind 调研
description: 像素风海盗航海浏览器游戏，真实航海物理引擎
metadata:
  category: 技术调研 / 玩法借鉴
  status: 进行中
  created: 2026-06-19
  url: https://tinywind.io
---

# TinyWind 调研

## 基本信息

- **网址**: https://tinywind.io
- **类型**: 像素风海盗航海 IO 游戏
- **技术栈**: Next.js + Canvas 渲染（多 Canvas，约 5 个）
- **单局时长**: ~5 分钟
- **核心玩法**: 操控帆船逃离皇家海军追捕，海域含 7 个岛屿

## 核心卖点

### 航海物理
- 顺风航行（beam reach）
- 迎风转向（tack）
- 顺风转向（jibe）
- 侧舷炮击（broadside）
- 风向影响航速与航线

### 视觉风格
- 像素艺术（pixel art）
- 海盗主题

### 技术特点
- 纯浏览器运行，无需安装
- 多 Canvas 分层渲染
- 响应式布局，移动端适配
- 基于 Next.js 框架

## 实测结果（2026-06-19）

### 技术层面

#### Canvas 分层策略（游戏页共 5 个 Canvas）

| # | 分辨率 | CSS 尺寸 | 位置 | 用途 |
|---|--------|----------|------|------|
| 0 | 2240×1278 | 100%×100% | 全屏 | **主游戏画面**（地图、船、岛屿、海浪） |
| 1 | 104×184 → 52×92 | 左上 8px | 左上方 | **速度表**（SPEED/INFAMY 数值） |
| 2 | 104×104 → 52×52 | 右上 8px | 右上方 | **风向仪**（SAIL 角度指示，0°-180°/90°） |
| 3 | 220×220 → 132×132 | 右下 27px | 右下方 | **小地图**（岛屿、船位、视野范围） |
| 4 | 88×50 → 88×50 | 底部中央 | 底部 | **虚拟摇杆 / 操作按钮**（SAILS, FIRE 等触屏控件） |

** Landing 页只有 1 个 Canvas**（2240×1278），作为背景装饰：
- CSS 样式：`filter: blur(2px) brightness(0.65) saturate(1.05); transform: scale(1.02); z-index: -1; pointer-events: none; image-rendering: pixelated;`
- 效果：模糊的海景背景，文字层浮在上面

#### 渲染方式

- Canvas 内部渲染分辨率（2240×1278）远高于显示尺寸，配合 `image-rendering: pixelated` 实现清晰的像素风
- 所有 Canvas 统一用 `image-rendering: pixelated` 保持像素边缘锐利
- 渲染上下文：未实测验证（推测 2d，像素风游戏常见做法。可在 DevTools 手动验证：`document.querySelectorAll('canvas')[0].getContext('2d')`）

#### 前端框架

- **Next.js**（Turbopack 构建，从 URL 路径 `_next/static/chunks/turbopack-*` 可确认）
- 部署标识：`dpl_irjpMCKtWaGAWFDQfMbMEz5scyiZ`（推测部署在 Vercel）
- 版本：v0.59.6
- 路由模式：SPA 路由（首页 `/` → 游戏页 `/play?voyage=timed&map=british`）
- 打包：Turbopack（Next.js 15+ 默认），多个 chunk 文件，有 `.es.js` 后缀（ESM）

#### 字体

- 使用 **"Press Start 2P"** 像素字体（Google Fonts），配合 monospace fallback
- Landing 页全 inline CSS，无外部样式表

#### 移动端适配

- `meta viewport`: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport`
- 底部 Canvas（#4）88×50 为虚拟摇杆，专为触屏设计
- 所有 UI 用 `clamp()` 响应式字号
- Landing 页 max-width: 560px，居中布局

### 玩法层面

#### 菜单结构

从 Landing 页到游戏的层级：
```
首页 → START VOYAGE → 选模式(LIBERATION/INVASION/PVP COVE) → 选地图(BRITISH WATERS等)
  → Cursed Cargo 选择（buff 系统） → SET SAIL → 游戏
```

#### 实际游玩画面分析（2026-06-19 实测）

**DOM 层级结构**：
```
BODY
└── DIV.fixed.inset-0.overflow-hidden          ← 游戏容器
    ├── CANVAS.block.w-full.h-full              ← #0 主画面 (2240×1278)
    ├── CANVAS.fixed (×3)                       ← #1 速度表, #2 风向仪, #3 小地图
    └── (多个 DIV.fixed)                        ← HTML UI 层
    └── CANVAS (A.fixed 内)                     ← #4 触屏控件
```

**关键发现：游戏 UI 是 HTML + Canvas 混合的！**
- 主游戏画面（地图、船、岛屿、海浪、粒子效果）→ Canvas #0
- 速度表、风向仪、小地图 → Canvas #1/#2/#3（纯数值/指示器用 Canvas 绘制）
- **操作按钮、资源栏、风向文字、滑动条 → HTML 元素**（`DIV.fixed`）
- 这意味着 UI 交互（点击按钮、滑动角度条）走的是 DOM 事件，不是 Canvas 事件

**HUD 布局（游玩时）：**

| 区域 | 内容 | 实现方式 |
|------|------|----------|
| 左上 | WIND NW（风向）+ 资源指示器 | DIV.fixed |
| 顶部中央 | 资源栏：金币×60、宝石×0、钱币×2 | DIV.fixed |
| 右上 | 罗盘（圆形）| Canvas #3 小地图 |
| 右侧 | Sail 角度滑块 0°-180°（垂直滑动条） | DIV.relative.flex-1.cursor-pointer |
| 右下 | 方向舵（船舵图标）| Canvas |
| 左下 | CLAIM ISLAND / -3（交互按钮） | DIV.fixed.select-none.touch-none |
| 底部中央 | SAILS / BOARD / FIRE（操作按钮） | DIV.fixed × 3 |

**游戏内弹窗（首次进入）：**
- "SAVE YOUR PROGRESS" 居中弹窗
- 下方三个按钮：设置齿轮、卡片、LOAD
- 弹窗是 HTML 层，浮在 Canvas 之上

**核心玩法状态（从页面提取）：**

```json
{
  "speed": "15kt",        // 航速
  "infamy": "100",         // 恶名值
  "wind": "NW",            // 风向：西北
  "sailAngle": "164°",     // 帆角：164度
  "resources": {
    "gold": 60,            // 金币
    "gem": 0,              // 宝石
    "coin": 2              // 钱币
  }
}
```

**操作按钮语义：**
- **SAILS** — 升帆/收帆。收帆可以加速（DROP SAILS TO HEAL / DROP SAILS TO UPGRADE 提示可见）
- **BOARD** — 登船（接敌后攻击）
- **FIRE** — 侧舷炮开火
- **CLAIM ISLAND** — 占领岛屿（靠近岛屿后出现，"-3" 可能表示还需要消除 3 个守卫）
- **方向舵**（右下角船舵图标）— 控制航向（左转/右转）
- **Sail 角度滑块**（右侧垂直条）— 调节帆的角度（0°-180°），直接影响航速和航向

**可见的游戏对象（截图）：**
- 玩家帆船（画面中央，像素风，白色帆）
- 皇家海军战舰（左上角，红白格旗帜即 Union Jack）
- 岛屿（左下角，草地+建筑，像素风）
- 炮弹弹道（第二张截图中，船下方有红色发光轨迹）
- 海浪（程序化生成的纹理）

#### 核心循环（Liberation 模式）

1. **航行** — 通过方向舵 + 帆角控制船只在海洋中移动
2. **风向系统** — 帆船速度取决于帆角与风向的夹角。顺风快，迎风慢（真实的帆船物理）
3. **战斗** — 靠近敌船后 FIRE 发射侧舷炮，BOARD 登船近战
4. **占领岛屿** — 靠近岛屿，清除守卫后 CLAIM ISLAND
5. **资源收集** — 金币、宝石、钱币通过战斗和占领获取
6. **进度** — 解放全部 7 个岛屿即通关

#### 进度 / 解锁系统

- **Cursed Cargo**（被诅咒的货物）：8 个可收集的 mythic buff，当前已解锁 1/8
  - "The Black Pearl"：侧舷炮装填快 1 秒
  - 其余 7 个需要游戏中 "Recover" 才能解锁
- **Sign In** 可保存进度（有账号系统）
- **INFAMY** 数值是声望 / 积分系统
- 排行榜：`/wiki/ranks` 页面

#### 地图系统

- **BRITISH WATERS**（免费）：皇家海军巡逻区，Crown Cove 为核心
- **SPANISH WATERS**（付费）
- **DUTCH WATERS**（Coming soon + 付费）
- 共 7 个岛屿（与新闻描述一致）

#### 商业模式

- 基础版免费（British Waters + 部分模式）
- 付费 $4.99 解锁全部地图和模式
- 同时在线：~1557 人，总航程 222 万+ km

### 可借鉴点

#### 1. 多 Canvas 分层渲染（★★★★★）

最值得关注。5 个 canvas 各司其职：主画面、速度表、风向仪、小地图、触屏控件。
我们的单文件游戏完全可以引入这种分层方式，让 UI 和游戏画面分离渲染，互不干扰。

#### 2. 像素风 + 内联资源（★★★★☆）

2240×1278 的内部分辨率 + `image-rendering: pixelated` = 清晰像素风，无需外部图片。
我们的单文件模式下，可以用程序化绘制（Canvas API 画方块）或 base64 内嵌像素素材来实现类似风格。

#### 3. 航海物理简化为方块机制（★★★☆☆）

迎风/顺风速度差异、转向惯性，可以抽象为：不同方向有不同速度加成，转向有延迟。
这可能很适合做成"海洋方块"或"风向棋盘"类的小游戏。

#### 4. Cursed Cargo 系统（★★★★☆）

buff 选择 + 收集解锁，是一个轻量进度系统。可以直接移植为关卡前的 buff 选择界面。

#### 5. Landing 页设计（★★☆☆☆）

模糊背景 + 像素前景文字的对比感很好。我们的游戏大厅可以借鉴这种视觉层次。

## 初步印象

航海物理 + 像素风是一个差异化很强的组合。单文件模式下最难复现的是多 Canvas 分层和像素资源管理，但如果简化为单 Canvas + 程序化像素风（不依赖外部图片），完全可以纳入我们的项目。

## 下一步

1. 实际游玩几局，记录操作体验与核心循环
2. 用浏览器 DevTools 分析 DOM 结构、Canvas 层级、网络请求
3. 梳理出最值得借鉴的 1-2 个机制，评估单文件可行性
