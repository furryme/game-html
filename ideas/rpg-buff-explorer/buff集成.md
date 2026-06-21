# Buff 系统集成设计

> 整合 4 位专家方案，输出完整、可执行、无矛盾的 buff 系统设计文档。
> 基于 `dev-1-rpg.html` 现有代码结构。

## 设计约束

- 单文件 HTML，无构建工具，无后端，localStorage 存档
- Canvas + HTML 混合渲染，像素风
- MVP：3 职业（战士/法师/游侠），等级 1-10，5 层地城
- 每局从 1 级开始（Roguelite），死亡保留 buff 解锁进度
- 每层前 3 选 1，每局最多携带 3 个 buff
- 文件体积控制：新增代码 ~600 行，压缩后 ~5KB

---

## 1. Buff 选择 UI 设计

### 1.1 层前大厅 ASCII Mockup

每层通关（或走到楼梯）后弹出，复用现有 `showModal()` 框架：

```
+---------------------------------------------------------------+
|               =  第  2  层  祝  福  =                        |
|                                                               |
|   从下方祝福中选择 1 个携带进入下一层                          |
|                                                               |
|   [已携带: 1/3]  [! 狂战士的祝福]  [___]  [___]              |
|                                                               |
|   +------------------+  +------------------+  +------------+-|
|   |  x4  x4        |  |  x4  x4         |  |  x4  x4    | |
|   |  x @ @ x      |  |  x O O x        |  |  x ?  ? x  | |
|   |  x  !  x      |  |  x  F  x        |  |  x  ?  x   | |
|   |  x______x     |  |  x______x       |  |  x______x  | |
|   | ! 狂战士的祝福 |  | F 烈焰光环      |  | ? 未知之物  | |
|   | 稀有    |1.3ATK|  | 传奇  灼烧8/回  |  | 已锁定     | |
|   | HP x0.85       |  |                |  | 累计击杀10个| |
|   | [ 选 择 ]      |  | [ 选 择 ]      |  |            | |
|   +------------------+  +------------------+  +------------+-|
|                                                               |
|                                 [ 不带祝福, 继续 > ]          |
+---------------------------------------------------------------+
```

**交互流程：**

1. 玩家走到楼梯 / Boss 死后 -> 暂停游戏 -> `showModal()` 弹出 buff 选择
2. 随机从已解锁 buff 池中按稀有度权重抽 3 个（排除本局已携带的）
3. 玩家点击卡片 或 按键盘 1/2/3 选择
4. 选中后该 buff 加入 `player.activeBuffs`，调用 `recalcBuffStats()`
5. 关闭弹窗 -> 进入下一层 / 结算
6. 玩家也可选择"不带祝福，继续"跳过

**动画时序：**
- 弹窗出现：`fadeIn 0.3s`（与现有 modal 一致）
- 选中脉冲：点击卡片后从中心扩散一圈稀有度色光晕 `400ms`
- 确认关闭：卡片缩小 + 淡出 `350ms`

### 1.2 Buff 卡片设计

每张卡片 180x150px，像素风 4px 阶梯边框：

```
+------------------+
|  x4  x4        |   <-- 4px 阶梯边框，稀有度色
|  x @ @ x      |   <-- 8x8 像素画区域（emoji fallback）
|  x  !  x      |
|  x  !  x      |
|  x______x     |
| ! 狂战士的祝福 |   <-- 14px 加粗，稀有度色
| 稀有           |   <-- 11px 稀有度标签
| ATK+30% HP-15% |   <-- 11px #aaa 效果描述
| [攻击] [被动]  |   <-- 9px tag 芯片
| [ 选 择 ]      |   <-- 按钮：已选=绿色/可选=金色/锁定=#444
+------------------+
```

**稀有度配色方案：**

| 稀有度 | 边框色 | 背景 | 文字色 | 光晕 |
|--------|--------|------|--------|------|
| common | `#6b7280` | `rgba(107,114,128,0.08)` | `#9ca3af` | 无 |
| rare | `#3b82f6` | `rgba(59,130,246,0.1)` | `#60a5fa` | hover 微蓝光 |
| legendary | `#f59e0b` | `rgba(245,158,11,0.1)` | `#fbbf24` | 金色呼吸光 |
| mythic | `#a855f7` | `rgba(168,85,247,0.1)` | `#c084fc` | 紫金双色呼吸光 |

**锁定卡片：**
- 8x8 问号像素画（灰色）
- "已锁定" 文字 + 解锁条件提示
- 整体 `opacity: 0.5`，灰色边框

### 1.3 战斗 HUD 中的 Buff 展示

在左侧角色面板（`#game-left`，200px 宽）中，属性行下方、装备栏上方新增 Buff 区：

```
#game-left
+--------------------+
| ⚔️ 战士            |
| Lv.3 战士          |
| HP [=======] 190/240|
| MP [===     ] 15/30 |
| EXP [==      ] 25/150|
| ATK:22 DEF:13 SPD:12|
+--------------------+
| === BUFF ===       |   <-- 分隔线
| ! 狂战士祝福 [永久] |   <-- 增益芯片，绿色左边框
| ! 吸血(本局)       |
+--------------------+
| < DEBUFF >         |
| x 中毒(2回合)      |   <-- 减益芯片，紫色左边框
+--------------------+
| 武器: 铁剑          |
| 防具: 皮甲          |
| 金币: 20            |
+--------------------+
```

**Buff 芯片 CSS 规格（80x24px pill）：**

```css
.buff-chip {
  display: inline-block;
  min-width: 80px; height: 24px;
  line-height: 24px; padding: 0 8px;
  font-size: 11px; border-radius: 4px;
  margin: 2px 4px 2px 0;
  cursor: default; position: relative;
}
.buff-chip.buff {
  border-left: 3px solid #4caf50;
  background: rgba(76,175,80,0.1);
  color: #81c784;
}
.buff-chip.debuff {
  border-left: 3px solid #ab47bc;
  background: rgba(171,71,188,0.1);
  color: #ce93d8;
}
.buff-chip .turns-warn {
  color: #ef5350;            /* 剩余<=2 回合时红色 */
  animation: pulse 0.8s infinite;
}
.buff-chip .permanent {
  color: #ffd700;            /* 永久 buff 金色角标 */
}
```

**Tooltip（hover 展开）：**

鼠标悬停芯片时，右侧弹出 180px 浮窗：
```
+---------------------------+
| ! 吸血                    |
|---------------------------|
| 攻击回复造成伤害的15%为HP  |
| 来源: 层前祝福             |
| 类型: 永久（本局）         |
+---------------------------+
```

### 1.4 新解锁弹窗

游戏结束后、结算界面之前，如有新解锁的 buff，先弹出：

```
+---------------------------------------------------+
|                                                   |
|              .--------.                           |
|              |   F    |    新 祝 福  解 锁 ！      |
|              |        |                           |
|              '--------'                           |
|                                                   |
|           烈 焰 光 环                              |
|              [ 传奇 ]                              |
|                                                   |
|   每次攻击附带灼烧，每回合对目标造成 8 点伤害       |
|                                                   |
|    Tags: [攻击] [灼烧] [被动]                      |
|                                                   |
|                    [ 太 棒 了 ]                    |
+---------------------------------------------------+
```

- 中央 emoji 放大显示（48px）
- legendary 以上稀有度背景有粒子散落动画（复用现有 `spawnCombatParticles`）
- "太棒了" 关闭弹窗，继续结算

---

## 2. Buff 数据架构

### 2.1 核心设计决策

**数据与逻辑分离（取专家 2 方案）：**
- `BUFF_DEFS` 只包含声明式数据（数值 + 标签 + 字符串枚举）
- 效果计算由 `recalcBuffStats()` 统一执行
- 复杂行为（on-hit DoT、吸血）通过字符串 hook 名触发，不在数据中嵌函数
- 例外：`synergy` 组合效果使用独立表 `SYNERGY_DEFS`，避免 A 写 A+B、B 写 B+A 的冗余

**为什么不用函数式数据（专家 3/4）：**
- 单文件内函数嵌套难以调试
- 声明式数据可直接序列化到 localStorage 做热更新预留
- `recalcBuffStats()` 单次聚合后战斗读取 `player.buffStats` 缓存，O(1) 查询

### 2.2 Buff 对象完整结构

```javascript
const BUFF_DEFS = {
  berserks_blessing: {
    id: "berserks_blessing",
    name: "狂战士的祝福",
    desc: "ATK +30%，HP -15%",
    icon: "⚔️",
    rarity: "rare",
    tags: ["attack"],
    type: "passive",
    passive: {
      atkMult: 1.3,
      hpMult: 0.85,
    },
    classBonus: {
      warrior: { atkMult: 1.2 },
    },
    unlockCondition: null,
  },

  flame_aura: {
    id: "flame_aura",
    name: "烈焰光环",
    desc: "攻击附带灼烧（每回合8点，持续3回合）",
    icon: "🔥",
    rarity: "legendary",
    tags: ["attack", "fire"],
    type: "passive",
    passive: {
      onAttack: "burn",
      dotDmg: 8,
      dotTurns: 3,
    },
    unlockCondition: { type: "kill", value: 10, label: "累计击杀 10 只敌人" },
  },

  shield_burst: {
    id: "shield_burst",
    name: "护盾爆发",
    desc: "[主动] 抵挡下一次攻击，冷却 5 回合",
    icon: "🔰",
    rarity: "rare",
    tags: ["defense"],
    type: "active",
    active: {
      cooldown: 5,
      execute: "block_next_attack",
    },
    unlockCondition: { type: "floor", value: 1, label: "完成第 1 层" },
  },
};
```

### 2.3 字段全量说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | Y | 唯一键，存档/组合匹配用 |
| `name` | string | Y | UI 显示名 |
| `desc` | string | Y | 效果描述（含数值） |
| `icon` | string | Y | emoji（零资源） |
| `rarity` | enum | Y | `common` / `rare` / `legendary` / `mythic` |
| `tags` | string[] | Y | 标签，用于组合检测/筛选/UI 提示 |
| `type` | enum | Y | `passive` / `active` |
| `passive` | object | 条件 | type=passive 时必填 |
| `active` | object | 条件 | type=active 时必填 |
| `classBonus` | object | N | key=职业key，value=额外倍率对象 |
| `unlockCondition` | object/null | N | null=默认解锁 |

### 2.4 Passive 对象字段全集

```javascript
passive: {
  atkMult?       : number,  // 攻击倍率，乘法叠加
  defMult?       : number,  // 防御倍率，乘法叠加
  hpMult?        : number,  // 最大HP倍率，乘法叠加
  spdMult?       : number,  // 速度倍率，乘法叠加
  critBonus?     : number,  // 暴击率加成（百分比，加法叠加）
  dmgReduction?  : number,  // 减伤比例 0-1，加法叠加，封顶 0.8
  lifestealPct?  : number,  // 吸血比例 0-1，加法叠加
  onAttack?      : string,  // "burn" / "poison" → 攻击附带状态
  dotDmg?        : number,  // 附带状态每回合伤害
  dotTurns?      : number,  // 附带状态持续回合
  goldBonus?     : number,  // 金币掉落加成比例，加法叠加
  expBonus?      : number,  // EXP 加成比例，加法叠加
  mpRestore?     : number,  // 每回合回复 MP 量，加法叠加
  hpRestorePct?  : number,  // 每回合回复 HP 比例 0-1，加法叠加
  dodgeChance?   : number,  // 额外闪避概率 0-1，加法叠加，封顶 0.5
  firstStrike?   : number,  // 先手概率加成（百分比）
}
```

### 2.5 Active 对象字段

```javascript
active: {
  cooldown : number,   // 冷却回合数
  execute  : string,   // "block_next_attack" | "heal_pct" | "damage_burst" | "revive"
  healPct? : number,   // execute=heal_pct 时，回复 HP 比例
  dmgMult? : number,   // execute=damage_burst 时，攻击倍率
}
```

### 2.6 UnlockCondition 对象

```javascript
unlockCondition: {
  type  : string,  // "kill" | "floor" | "run" | "boss" | "gold" | "death" | "achievement"
  value : number | string,
  label : string,  // 锁定状态显示的文字
}
```

### 2.7 运行时数据结构

**玩家持有：**

```javascript
player.activeBuffs = [                     // 本局生效的 buff 实例
  {
    defId: "berserks_blessing",
    cooldown: 0,                           // 主动 buff 剩余冷却
    source: "selection",                   // "selection" / "combat" / "item"
  }
];

player.buffStats = {                       // 聚合后的运行时倍率缓存
  atkMult: 1.3,
  defMult: 1.0,
  hpMult: 0.85,
  spdMult: 1.0,
  critBonus: 0,
  dmgReduction: 0,
  lifestealPct: 0,
  onAttackEffects: [],                     // ["burn", "poison"]
  dotDmg: 0,
  dotTurns: 0,
  goldBonus: 0,
  expBonus: 0,
  mpRestore: 0,
  hpRestorePct: 0,
  dodgeChance: 0,
  firstStrike: 0,
};

player.activeSynergies = [];               // 当前激活的组合效果
```

**敌人战斗状态中的 DoT：**

```javascript
combatState.enemyDots = [
  { type: "burn", dmg: 8, turns: 3 },
];
```

### 2.8 聚合函数 `recalcBuffStats()`

```javascript
function recalcBuffStats() {
  const s = {
    atkMult: 1, defMult: 1, hpMult: 1, spdMult: 1,
    critBonus: 0, dmgReduction: 0, lifestealPct: 0,
    onAttackEffects: [], dotDmg: 0, dotTurns: 0,
    goldBonus: 0, expBonus: 0, mpRestore: 0, hpRestorePct: 0,
    dodgeChance: 0, firstStrike: 0,
  };

  player.activeBuffs.forEach(b => {
    const def = BUFF_DEFS[b.defId];
    if (!def) return;

    // Passive numeric叠加
    if (def.type === "passive" && def.passive) {
      const p = def.passive;
      if (p.atkMult)      s.atkMult *= p.atkMult;
      if (p.defMult)      s.defMult *= p.defMult;
      if (p.hpMult)       s.hpMult *= p.hpMult;
      if (p.spdMult)      s.spdMult *= p.spdMult;
      if (p.critBonus)    s.critBonus += p.critBonus;
      if (p.dmgReduction) s.dmgReduction = clamp(s.dmgReduction + p.dmgReduction, 0, 0.8);
      if (p.lifestealPct) s.lifestealPct += p.lifestealPct;
      if (p.goldBonus)    s.goldBonus += p.goldBonus;
      if (p.expBonus)     s.expBonus += p.expBonus;
      if (p.mpRestore)    s.mpRestore += p.mpRestore;
      if (p.hpRestorePct) s.hpRestorePct += p.hpRestorePct;
      if (p.dodgeChance)  s.dodgeChance = clamp(s.dodgeChance + p.dodgeChance, 0, 0.5);
      if (p.firstStrike)  s.firstStrike += p.firstStrike;
      if (p.onAttack) {
        s.onAttackEffects.push(p.onAttack);
        if (p.dotDmg)     s.dotDmg = p.dotDmg;
        if (p.dotTurns)   s.dotTurns = p.dotTurns;
      }
    }

    // 职业加成
    if (def.classBonus && def.classBonus[player.cls]) {
      const bonus = def.classBonus[player.cls];
      if (bonus.atkMult) s.atkMult *= bonus.atkMult;
      if (bonus.defMult) s.defMult *= bonus.defMult;
      if (bonus.hpMult)  s.hpMult *= bonus.hpMult;
    }
  });

  player.buffStats = s;

  // 同步检测组合
  player.activeSynergies = checkSynergies();
}
```

**调用时机：** `initPlayer()`、选择 buff 后、装备变更时。

### 2.9 框架 API

```javascript
// 初始化 buff 系统（游戏启动时调用一次）
function initBuffSystem() {
  const data = loadBuffData();
  window._buffUnlocks = data;
  recalcBuffStats();
}

// 生成 3 选 1 候选池
function generateBuffChoices(floor) {
  const unlocked = window._buffUnlocks.unlocked || [];
  const owned = new Set(player.activeBuffs.map(b => b.defId));

  const pool = Object.values(BUFF_DEFS)
    .filter(b => unlocked.includes(b.id))
    .filter(b => !owned.includes(b.id));

  // 按稀有度 + 楼层加权抽样
  const weighted = pool.map(b => ({
    buff: b,
    weight: RARITY_WEIGHTS[b.rarity][floor] || 0.5,
  }));

  // 加权随机抽 3 个
  return weightedDraw(weighted, Math.min(3, weighted.length));
}

// 显示选择 UI（回调式，适配现有代码风格）
function showBuffSelection(floor, cb) {
  const choices = generateBuffChoices(floor);
  // 用 showModal() 渲染 3 张卡片
  // 玩家选择后调用 cb(selectedDefId) 或 cb(null) 跳过
}

// 应用选中的 buff
function applyBuff(defId) {
  player.activeBuffs.push({ defId, cooldown: 0, source: "selection" });
  recalcBuffStats();
}

// 检测新解锁
function checkUnlocks() {
  const stats = window._buffUnlocks.stats || {};
  const unlocked = window._buffUnlocks.unlocked || [];
  const newUnlocks = [];

  for (const [id, def] of Object.entries(BUFF_DEFS)) {
    if (!def.unlockCondition || unlocked.includes(id)) continue;
    const cond = def.unlockCondition;
    let met = false;
    switch (cond.type) {
      case "kill":    met = (stats.totalKills || 0) >= cond.value; break;
      case "floor":   met = (stats.maxFloor || 0) >= cond.value; break;
      case "run":     met = (stats.totalRuns || 0) >= cond.value; break;
      case "boss":    met = (stats.bossKills || 0) >= cond.value; break;
      case "gold":    met = (stats.totalGold || 0) >= cond.value; break;
      case "death":   met = (stats.totalDeaths || 0) >= cond.value; break;
    }
    if (met) { unlocked.push(id); newUnlocks.push(def); }
  }

  window._buffUnlocks.unlocked = unlocked;
  saveBuffData();
  return newUnlocks;
}

// localStorage 读写
function loadBuffData() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"unlocked":[],"stats":{}}');
}
function saveBuffData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window._buffUnlocks));
}
```

### 2.10 与现有代码的接入点

| 现有函数 | 改动内容 |
|----------|----------|
| `initPlayer()` | 初始化 `activeBuffs: []`，调用 `recalcBuffStats()`；应用 `hpMult` 到 `maxHp` |
| `getPlayerAtk()` | 返回值 × `player.buffStats.atkMult` |
| `getPlayerDef()` | 返回值 × `player.buffStats.defMult` |
| `getPlayerCrit()` | 返回值 + `player.buffStats.critBonus` |
| `doAttack()` | 命中后：检查 `onAttackEffects` 附加 DoT；检查 `lifestealPct` 回血 |
| `doSkill()` | 技能伤害同样乘 `atkMult`，同样触发 onAttack/lifesteal |
| `enemyAttack()` | 伤害计算前：检查 `dodgeChance` 闪避；乘 `(1 - dmgReduction)` 减伤 |
| `resolveTurn()` | 回合开始：`mpRestore` 回蓝；`hpRestorePct` 回血；tick `enemyDots` |
| `enemyDefeated()` | EXP × `(1 + expBonus)`，Gold × `(1 + goldBonus)` |
| `movePlayer()` 楼梯处 | Boss 死后/下楼前，调用 `showBuffSelection()` |
| `playerDied()` | 持久化统计、`checkUnlocks()` |
| `renderPlayerPanel()` | 新增 buff 芯片渲染 |

### 2.11 战斗公式（含 buff）

```
// 玩家攻击
基础伤害 = getPlayerAtk() × 技能倍率            (getPlayerAtk 已含 buffStats.atkMult)
暴击判定 = rng(100) < (基础暴击率 + buffStats.critBonus)
最终伤害 = 基础伤害 - 目标DEF / 2
暴击时   = 最终伤害 × 1.8
吸血回复 = 最终伤害 × buffStats.lifestealPct
附加DoT  = onAttackEffects.includes("burn") → enemyDots.push()

// 敌人攻击
玩家闪避 = rng(100) < (SPD差值加成 + buffStats.dodgeChance * 100)
基础伤害 = 敌方ATK - getPlayerDef() / 2         (getPlayerDef 已含 buffStats.defMult)
buff减伤 = 基础伤害 × (1 - buffStats.dmgReduction)
防御姿态 = buff减伤 × 0.5
```

### 2.12 代码组织（单文件内分块）

在 `dev-1-rpg.html` 的 `<script>` 中，按以下顺序组织：

```
<SCRIPT>
  // === DATA ===
  CLASSES / ENEMIES / ITEMS_DATA / EQUIP_TEMPLATES  (已有)
  BUFF_DEFS                                          (新增)
  SYNERGY_DEFS                                       (新增)
  RARITY_WEIGHTS                                     (新增)

  // === STATE ===
  (现有 state 变量)
  window._buffUnlocks                                (新增)

  // === BUFF SYSTEM ===
  STORAGE_KEY = "rpg_buff_unlocks_v1"
  loadBuffData / saveBuffData
  initBuffSystem
  recalcBuffStats
  generateBuffChoices / showBuffSelection / applyBuff
  checkSynergies
  checkUnlocks / weightedDraw

  // === UTILITIES ===
  (现有)

  // === CLASS SELECTION ===
  (现有)

  // === PLAYER ===
  initPlayer (改) / getPlayerAtk (改) / getPlayerDef (改)
  getPlayerCrit (改) / gainExp (改: expBonus)

  // === MAP GENERATION ===
  (现有)

  // === RENDERING ===
  renderPlayerPanel (改: 新增 buff 芯片)
  (其他现有)

  // === MOVEMENT ===
  movePlayer (改: 楼梯处弹出 buff 选择)

  // === COMBAT ===
  doAttack (改) / doSkill (改) / enemyAttack (改)
  resolveTurn (改) / enemyDefeated (改: goldBonus)
  playerDied (改: checkUnlocks)

  // === MODALS ===
  (现有)

  // === FLOAT TEXT & PARTICLES ===
  (现有)
</SCRIPT>
```

---

## 3. Buff 池完整列表（24 个）

### 3.1 默认解锁（8 个）

| # | ID | 名称 | Icon | 稀有度 | Tags | 效果 | 解锁条件 |
|---|----|------|------|--------|------|------|----------|
| 1 | `iron_skin` | 铁壁 | 🛡️ | common | defense | 受到伤害 -20% | 默认 |
| 2 | `swift_foot` | 迅捷 | 💨 | common | speed | SPD×1.3，先手率+10% | 默认 |
| 3 | `sharp_eye` | 锐眼 | 🎯 | common | attack, crit | 暴击率 +8% | 默认 |
| 4 | `mana_flow` | 法力涌动 | 💎 | common | sustain | 每回合回复 3 MP | 默认 |
| 5 | `steadfast` | 坚毅 | 🏔️ | common | defense, sustain | 每回合回复 2% HP | 默认 |
| 6 | `gold_hound` | 寻宝者 | 🐕 | common | economy | 金币掉落 +25% | 默认 |
| 7 | `berserks_blessing` | 狂战士的祝福 | ⚔️ | rare | attack | ATK×1.3, HP×0.85 | 默认 |
| 8 | `spirit_eagle` | 灵鹰之眼 | 🦅 | rare | sustain, exp | EXP +30%，每回合回复 2%HP | 默认 |

### 3.2 低门槛解锁（8 个）

| # | ID | 名称 | Icon | 稀有度 | Tags | 效果 | 解锁条件 |
|---|----|------|------|--------|------|------|----------|
| 9 | `lifesteal` | 吸血 | 🩸 | rare | attack, sustain | 攻击回复造成伤害 15% 为 HP | 到达第 2 层 |
| 10 | `shield_burst` | 护盾爆发 | 🔰 | rare | defense | [主动] 抵挡下次攻击，CD 5 回合 | 完成第 1 层 |
| 11 | `second_wind` | 回光返照 | 💫 | legendary | sustain, survival | HP<20% 时自动回复 40%，CD 8 回合 | 累计死亡 3 次 |
| 12 | `crit_lens` | 暴击透镜 | 🔍 | rare | crit, attack | 暴击率 +12%，暴击伤害 +20% | 累计击杀 10 个 |
| 13 | `gold_magnet` | 贪金术 | 🧲 | common | economy | 金币掉落 +50% | 累计获得 200 金 |
| 14 | `exp_vortex` | 经验漩涡 | 🌀 | rare | exp | EXP +50% | 通关 1 次 |
| 15 | `thorns` | 荆棘 | 🌹 | rare | defense, reflect | 受到攻击时反弹 15% 伤害 | 完成第 2 层 |
| 16 | `shadow_step` | 暗影步 | 🌑 | rare | speed, dodge | 闪避率 +15% | 累计逃跑 5 次 |

### 3.3 高门槛解锁（8 个）

| # | ID | 名称 | Icon | 稀有度 | Tags | 效果 | 解锁条件 |
|---|----|------|------|--------|------|------|----------|
| 17 | `flame_aura` | 烈焰光环 | 🔥 | legendary | attack, fire | 攻击附带灼烧 8dmg/3 回合 | 累计击杀 30 个 |
| 18 | `poison_blade` | 淬毒之刃 | ☠️ | rare | attack, poison | 攻击附带中毒 5dmg/3 回合 | 到达第 3 层 |
| 19 | `frost_heart` | 冰心 | ❄️ | legendary | defense, fire | 减伤 30%，免疫灼烧 | 累计受伤 2000 点 |
| 20 | `duelist` | 决斗家 | 🗡️ | mythic | attack, boss | Boss 战中 ATK +30% | 击杀 Boss 1 次 |
| 21 | `death_embrace` | 死亡之拥 | 💀 | mythic | survival, death | 受到致命伤保留 1HP（每战 1 次） | 累计死亡 10 次 |
| 22 | `mana_tide` | 魔力潮汐 | 🌊 | legendary | sustain, mana | 技能 CD -1（最低 1），每回合 +5MP | 累计使用技能 100 次 |
| 23 | `dragon_fury` | 龙怒 | 🐉 | mythic | attack, fire | ATK×1.5，HP×0.7 | 通关 3 次 |
| 24 | `alchemy` | 炼金术士 | ⚗️ | rare | economy, sustain | 金币 +30%，每回合 +1MP +1%HP | 累计获得 1000 金 |

### 3.4 分类统计

| 类别 | 数量 | buff IDs |
|------|------|----------|
| 攻击 attack | 10 | berserks_blessing, sharp_eye, lifesteal, crit_lens, flame_aura, poison_blade, duelist, dragon_fury, 以及通过 synergy 间接加成的 |
| 防御 defense | 6 | iron_skin, shield_burst, thorns, frost_heart, shadow_step, death_embrace |
| 经济 economy | 3 | gold_hound, gold_magnet, alchemy |
| 探索/exp | 3 | spirit_eagle, exp_vortex, mana_flow |
| 特殊 survival | 5 | swift_foot, steadfast, second_wind, frost_heart, death_embrace, mana_tide |

### 3.5 稀有度分布

| 稀有度 | 数量 | 占比 |
|--------|------|------|
| common | 6 | 25% |
| rare | 11 | 46% |
| legendary | 5 | 21% |
| mythic | 2 | 8% |

---

## 4. Buff 联动系统

### 4.1 叠加规则

| 属性类型 | 叠加方式 | 封顶 | 说明 |
|----------|----------|------|------|
| atkMult / defMult / hpMult / spdMult | **乘法** | 无 | 多个 buff 倍率相乘 |
| critBonus | **加法** | 无 | 多个暴击率直接相加 |
| dmgReduction | **加法** | 0.8 (80%) | 防止无伤 |
| lifestealPct | **加法** | 无 | 但建议设计不超 0.5 |
| goldBonus / expBonus | **加法** | 无 | |
| mpRestore / hpRestorePct | **加法** | 无 | |
| dodgeChance | **加法** | 0.5 (50%) | 防止无敌 |
| onAttack DoT | **独立堆叠** | 每种类型 1 个 | burn 和 poison 可以同时存在 |

**设计原则：同类乘法，异类加法。** 倍率用乘法让搭配感有体感差异，加值用加法避免数值膨胀。

### 4.2 Buff x Buff 组合表（8 组）

独立表 `SYNERGY_DEFS`，通过 tags 交叉匹配：

```javascript
const SYNERGY_DEFS = [
  {
    id: "fire_storm",
    name: "烈焰风暴",
    desc: "灼烧伤害翻倍",
    icon: "🌪️",
    tags: ["fire", "attack"],
    minTags: 2,
    effect: { type: "multiply_dot", mult: 2.0 },
  },
  {
    id: "thorns_shield",
    name: "荆棘堡垒",
    desc: "反弹伤害提升至 30%",
    icon: "🛡️",
    tags: ["defense", "reflect"],
    minTags: 2,
    effect: { type: "reflect_pct", pct: 0.3 },
  },
  {
    id: "slaughter_machine",
    name: "杀戮机器",
    desc: "吸血效果 +10%",
    icon: "⚙️",
    tags: ["attack", "sustain"],
    minTags: 2,
    effect: { type: "add_lifesteal", pct: 0.1 },
  },
  {
    id: "critical_fury",
    name: "暴击狂怒",
    desc: "暴击时额外造成 10% 当前 HP 的追击伤害",
    icon: "💥",
    tags: ["crit", "attack"],
    minTags: 2,
    effect: { type: "crit_exec", pct: 0.1 },
  },
  {
    id: "immortal",
    name: "不死之身",
    desc: "死亡之拥触发后额外回复 20% HP",
    icon: "♾️",
    tags: ["survival", "death"],
    minTags: 2,
    effect: { type: "revive_heal", pct: 0.2 },
  },
  {
    id: "boss_hunter",
    name: "Boss 猎手",
    desc: "Boss 战中暴击率翻倍",
    icon: "👑",
    tags: ["boss", "crit"],
    minTags: 2,
    effect: { type: "boss_crit_mult", mult: 2.0 },
  },
  {
    id: "dual_blade",
    name: "双刀流",
    desc: "攻击有 15% 概率连击（造成两次伤害）",
    icon: "⚡",
    tags: ["speed", "attack"],
    minTags: 2,
    effect: { type: "double_strike", chance: 0.15 },
  },
  {
    id: "wealth_flood",
    name: "财富洪流",
    desc: "金币掉落额外 +30%",
    icon: "💰",
    tags: ["economy", "sustain"],
    minTags: 2,
    effect: { type: "add_gold", pct: 0.3 },
  },
];
```

### 4.3 Buff x 职业联动

通过 `classBonus` 字段实现，内嵌在 buff 定义中：

| Buff | 职业 | 额外效果 |
|------|------|----------|
| 狂战士的祝福 | 战士 | ATK 倍率再 ×1.2 |
| 烈焰光环 | 法师 | dotDmg +5 |
| 暗影步 | 游侠 | dodgeChance +10% |
| 迅捷 | 游侠 | firstStrike +15% |
| 铁壁 | 战士 | dmgReduction +10% |
| 暴击透镜 | 游侠 | critBonus +5% |
| 回光返照 | 战士 | healPct 从 40% → 60% |
| 灵鹰之眼 | 法师 | expBonus +20% |

### 4.4 Buff x 装备联动

通过装备特殊属性触发，在 `recalcBuffStats()` 中检测当前装备：

| Buff | 装备 | 激活后的升级 |
|------|------|-------------|
| 烈焰光环 | 烈火剑 | 灼烧伤害 8 → 12 |
| 铁壁 | 龙鳞甲 | 减伤 20% → 35% |
| 暗影步 | 暗影匕首 | 闪避 15% → 25% |
| 吸血 | 圣剑 | 吸血 15% → 25% |
| 法力涌动 | 魔法杖 | 回蓝 3 → 6/回合 |

实现方式：在 `recalcBuffStats()` 遍历 activeBuffs 时，额外检查 `player.equip` 是否匹配，若匹配则对该 buff 的对应字段做加成。

```javascript
// 在 recalcBuffStats 内部，应用 passive 之后：
const EQUIP_BONUS = {
  flame_aura: { weapon: "烈火剑", bonus: { dotDmg: 4 } },       // +4 dot
  iron_skin:  { armor: "龙鳞甲", bonus: { dmgReduction: 0.15 } }, // +15% 减伤
  shadow_step:{ weapon: "暗影匕首", bonus: { dodgeChance: 0.1 } }, // +10% 闪避
  lifesteal:  { weapon: "圣剑", bonus: { lifestealPct: 0.1 } },   // +10% 吸血
  mana_flow:  { weapon: "魔法杖", bonus: { mpRestore: 3 } },      // +3 mp/回合
};
```

### 4.5 Buff x 技能联动

通过技能释放时检测 activeBuffs 中的特定 tags 触发：

| Buff | 技能 | 改写效果 |
|------|------|----------|
| 烈焰光环 | 猛击 | 灼烧从 2 回合 → 3 回合 |
| 烈焰光环 | 火球术 | 火球附带额外 1 层灼烧 |
| 暗影步 | 暗影突袭 | 暗影突袭 CD -1 回合 |
| 暴击透镜 | (所有技能) | 技能暴击时附加易伤（下次受到伤害 +10%） |
| 回光返照 | 怒火冲锋 | 低血时怒火冲锋反伤减半 |

实现方式：在 `doSkill()` 函数中，检查 `player.activeBuffs` 是否包含特定 defId，若包含则修改技能行为参数。

### 4.6 Buff x Boss 特殊互动

| Buff | Boss 互动 |
|------|-----------|
| 决斗家 | Boss 战中 ATK +30%（核心效果） |
| 冰心 | 对 Boss 额外减伤 10%（Boss 通常高攻） |
| Boss 猎手 (synergy) | Boss 战中暴击率翻倍 |
| 死亡之拥 | Boss 战中触发后额外回复 30%（vs 普通 20%） |

---

## 5. 解锁与进度

### 5.1 解锁条件检测

每次以下事件发生时调用 `checkUnlocks()`：
- 战斗结束（胜利/逃跑）
- 到达新楼层
- 游戏结束（胜利/死亡）

统计数据结构：

```javascript
window._buffUnlocks = {
  unlocked: ["iron_skin", "swift_foot", ...],     // 已解锁 buff id
  stats: {
    totalKills: 0,        // 累计击杀
    maxFloor: 1,          // 最高到达楼层
    totalRuns: 0,         // 累计游玩局数
    bossKills: 0,         // Boss 击杀数
    totalGold: 0,         // 累计获得金币
    totalDeaths: 0,       // 累计死亡次数
    totalFlees: 0,        // 累计逃跑次数
    totalSkillUses: 0,    // 累计使用技能次数
    totalDamageTaken: 0,  // 累计受到伤害
    totalClears: 0,       // 累计通关次数
  }
};
```

统计更新时机：

| 统计项 | 更新时机 | 增量 |
|--------|----------|------|
| totalKills | enemyDefeated() | +1 |
| maxFloor | generateFloor() | Math.max(current, floorNum) |
| totalRuns | initPlayer() | +1 |
| bossKills | enemyDefeated() boss=true | +1 |
| totalGold | enemyDefeated() | +本次获得 |
| totalDeaths | playerDied() | +1 |
| totalFlees | doFlee() 成功 | +1 |
| totalSkillUses | doSkill() | +1 |
| totalDamageTaken | enemyAttack() | +实际伤害 |
| totalClears | showVictory() | +1 |

### 5.2 解锁曲线

| 游戏进度 | 预计已解锁 | 说明 |
|----------|-----------|------|
| 第 1 局开始前 | 8 个 | 默认解锁 |
| 第 1 局完成第 1 层 | +1 = 9 | 护盾爆发 |
| 第 1 局完成第 2 层 | +1 = 10 | 吸血 |
| 第 1 局通关 | +1~2 = 11-12 | 经验漩涡 + 可能累计击杀 10 |
| 第 3~5 局后 | ~14 个 | 死亡 3 次回光返照、累计击杀 10 个暴击透镜 |
| 第 5~10 局后 | ~18 个 | 到达第 3 层、累计击杀 30 个、累计获得 200/1000 金 |
| 第 10+ 局后 | 24 个（全解锁） | 累计死亡 10 次、通关 3 次、累计受伤 2000 等 |

### 5.3 稀有度出场权重

每层 buff 选择时，按稀有度加权从池中抽取：

| 稀有度 | 第 1 层 | 第 2 层 | 第 3 层 | 第 4 层 | 第 5 层 |
|--------|---------|---------|---------|---------|---------|
| common | 1.0 | 0.7 | 0.4 | 0.3 | 0.2 |
| rare | 0.7 | 0.8 | 0.8 | 0.7 | 0.5 |
| legendary | 0.0 | 0.2 | 0.4 | 0.6 | 0.7 |
| mythic | 0.0 | 0.0 | 0.1 | 0.3 | 0.5 |

```javascript
const RARITY_WEIGHTS = {
  common:    { 1: 1.0, 2: 0.7, 3: 0.4, 4: 0.3, 5: 0.2 },
  rare:      { 1: 0.7, 2: 0.8, 3: 0.8, 4: 0.7, 5: 0.5 },
  legendary: { 1: 0.0, 2: 0.2, 3: 0.4, 4: 0.6, 5: 0.7 },
  mythic:    { 1: 0.0, 2: 0.0, 3: 0.1, 4: 0.3, 5: 0.5 },
};
```

**加权抽样算法：**
```javascript
function weightedDraw(weightedPool, count) {
  const result = [];
  const pool = [...weightedPool];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    let r = Math.random() * totalWeight;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].weight;
      if (r <= 0) {
        result.push(pool[j].buff);
        pool.splice(j, 1);
        break;
      }
    }
  }
  return result;
}
```

### 5.4 重复选择规则

- 每局最多携带 3 个 buff
- 每个 buff 每局最多选 1 次（不可重复选同一个）
- 主动 buff 最多携带 1 个（防止操作过于复杂）
- 每层前 3 选 1（也可跳过）

### 5.5 与元成长的关系

当前 RPG 的元成长：等级/技能/buff 解锁跨局保留。

Buff 系统是元成长的**主要内容载体**：
- 等级提升 = 基础属性增长（已有）
- 技能提升 = 战斗手段多样化（已有）
- Buff 解锁 = 构筑深度递增（本次新增）

三者关系：
```
每局开始: 1级 + 默认技能 + 从已解锁buff中选择3个
         ↓
局内成长: 升级(属性↑) + 解锁新技能 + 战斗中获得装备
         ↓
局外保留: buff解锁进度(localStorage)
```

**后续可扩展：** 赛季/成就系统（专家 4 方案）作为 P4 之后内容，不纳入 MVP。

### 5.6 localStorage 存档结构

```javascript
// key: "rpg_buff_unlocks_v1"
{
  unlocked: ["iron_skin", "swift_foot", "sharp_eye", ...],
  stats: {
    totalKills: 45,
    maxFloor: 3,
    totalRuns: 8,
    bossKills: 1,
    totalGold: 450,
    totalDeaths: 3,
    totalFlees: 5,
    totalSkillUses: 67,
    totalDamageTaken: 1200,
    totalClears: 1,
  }
}
```

---

## 6. 实现优先级

### P0 — Buff 选择 UI + 基础被动效果（~2 天）

**目标：** 玩家能在层前选择 buff，战斗中生效。

- `BUFF_DEFS` 数据定义（8 个默认解锁 buff）
- `recalcBuffStats()` 聚合函数
- 修改 `getPlayerAtk/Def/Crit()` 读取 buff 倍率
- 修改 `doAttack()` 应用吸血/DoT
- 修改 `enemyAttack()` 应用减伤
- 修改 `resolveTurn()` 回蓝/回血/DoT tick
- 修改 `enemyDefeated()` 应用 gold/exp 加成
- `showBuffSelection()` 弹窗 UI（复用 showModal）
- `movePlayer()` 楼梯处接入选择
- 战斗 HUD 新增 buff 芯片显示
- `loadBuffData()` / `saveBuffData()` localStorage 基础读写

**验证标准：** 选狂战士的祝福进入第 2 层，打怪时伤害提升 30%，HP 上限降低 15%。

### P1 — 联动系统（~1.5 天）

**目标：** 职业/装备联动生效，玩家有搭配感。

- `classBonus` 在 `recalcBuffStats()` 中应用
- `EQUIP_BONUS` 装备联动检测
- 技能联动（烈焰光环 + 猛击延长灼烧）
- Buff 选择 UI 中显示联动提示文字（卡片底部）
- 新增 buff 数据（8 个低门槛解锁）

**验证标准：** 战士选狂战士的祝福，ATK 倍率 = 1.3 × 1.2 = 1.56。装备烈火剑 + 烈焰光环，灼烧伤害 8→12。

### P2 — 组合效果 + 主动 Buff（~1.5 天）

**目标：** 多 buff 搭配产生隐藏效果，主动 buff 可用。

- `SYNERGY_DEFS` 组合表 + `checkSynergies()` 检测
- 组合效果在 `recalcBuffStats()` 后应用
- 主动 buff UI（战斗底部按钮行）
- 主动 buff 冷却管理
- `applyBuff()` 函数
- 新解锁弹窗
- 新增 buff 数据（8 个高门槛解锁，共 24 个）

**验证标准：** 同时携带烈焰光环 + 狂战士的祝福，日志输出"共鸣触发：烈焰风暴"，灼烧伤害翻倍。

### P3 — 进度系统 + 完整解锁（~1 天）

**目标：** 跨局进度感，buff 逐步解锁。

- `checkUnlocks()` 完整实现
- 统计数据采集（在关键函数中更新 `stats`）
- `playerDied()` / `showVictory()` 中调用 checkUnlocks
- 解锁弹窗 UI
- 完整 buff 池（24 个）数据补齐
- 锁定卡片 UI

**验证标准：** 第 1 局只看到 8 个默认 buff，通关后暴击透镜/回光返照等陆续解锁。

### P4 — 打磨（持续）

- 8x8 像素画替换 emoji
- Buff 收藏界面（大厅入口）
- 呼吸光/选中脉冲等动画
- Tooltip hover 详情
- 音效（选中/解锁/共鸣触发）

---

## 附录：矛盾点决议记录

| 矛盾点 | 专家 2 | 专家 3 | 专家 4 | 最终决议 |
|--------|--------|--------|--------|----------|
| 数据模型 | 纯数值 + recalc | 函数式 effect(state) | 函数式 effect(state) | **取专家 2**：纯数值+聚合，可调试、可序列化 |
| Synergy 存储 | 独立 SYNERGY_DEFS 表 | 内嵌在 buff 中 synergy 字段 | synergy 字段在 buff 中 | **取专家 2**：独立表，避免 A+B 和 B+A 冗余 |
| Buff 池规模 | 12 个 MVP | 12 个 MVP | 未明确 | **取 24 个**：8 默认 + 8 低门槛 + 8 高门槛 |
| 赛季/成就 | 无 | 无 | 完整赛季+成就+代币 | **MVP 不做**，列入 P4 之后扩展 |
| 选择方式 | 3 选 1 随机抽取 | 从已解锁自由选最多 3 个 | 从已解锁自由选最多 3 个 | **3 选 1 随机抽取**，每层选 1 个，最多累计 3 个 |
| 图标 | emoji fallback | emoji fallback | emoji + 像素画目标 | **emoji 先行**，像素画 P4 打磨 |
| 主动 buff | 有，execute 枚举 | 无（MVP 只做被动+机制） | 有，带 cooldown ms | **有**，回合制 CD（非 ms） |
| 存档 key | rpg_buff_unlocks_v1 | 未明确 | 按游戏隔离前缀 | **rpg_buff_unlocks_v1**，预留前缀机制 |
