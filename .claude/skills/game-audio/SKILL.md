# Game Audio

为单文件 HTML 游戏添加 Web Audio API 合成音效、背景音乐和音量控制。零外部文件，所有声音由代码实时生成。

## 何时使用

每当用户要求为 HTML 游戏添加声音、音效、背景音乐、BGM、音频、音量控制时使用此 skill。适用于贪吃蛇、打砖块、俄罗斯方块等纯前端小游戏。

## 步骤

### 1. 分析游戏

读取游戏 HTML 文件，找出：
- **关键事件**：得分/收集、碰撞/失败、开始、暂停、输入/移动、升级/过关
- **游戏风格**：复古街机、休闲、紧张、舒缓
- **localStorage 前缀**：游戏已有的 key（如 `snake_best`），用于确定 muted key 的前缀
- **头部区域**：放置音量按钮的位置（通常和分数栏并列）

### 2. 设计音效

为每个关键事件设计 1-2 个音符的组合。音效设计原则：

| 事件 | 风格 | 示例（频率, 时长, 间隔） |
|------|------|-------------------------|
| 得分/收集 | 短促上滑，积极反馈 | 520→780, 各 0.08s, 间隔 0.06s |
| 碰撞/失败 | 下行琶音，沉重 | 440→349→262, 递增时长 |
| 开始 | 上行三音，有活力 | 440→554→659 |
| 输入/移动 | 极短极轻，不干扰 | 220, 0.04s, triangle 波形 |
| 升级/过关 | 快速上行琶音 | 523→659→784→1047 |

**波形选择**：square 用于主旋律和街机音效，triangle 用于柔和提示，sine 用于铃声。

音符频率参考 `references/notes.md`。

### 3. 设计 BGM 旋律

根据游戏情绪选择调性和节奏：

| 游戏类型 | 情绪 | 推荐调性 | 速度 (BEAT) |
|----------|------|----------|-------------|
| 休闲/经典 | 轻快 | C 大调 | 0.20s |
| 紧张/街机 | 急促 | A 小调 | 0.15s |
| 解谜/益智 | 舒缓 | F 大调 | 0.25s |
| 冒险/RPG | 史诗 | D 小调 | 0.22s |

**旋律编写规则**：
- 主旋律 8-16 拍，使用白键音符（简化创作）
- 低音为 4-8 拍和弦根音循环，频率约为主旋律的 1/4
- 旋律先上行后下行，形成乐句感
- 参考 `references/notes.md` 底部的和弦进行

**示例（C 大调轻快）**：
```js
const melody = [523,659,784,659,523,392,440,494,587,784,880,784,659,587,523,440];
const bass   = [131,131,110,110,87,87,98,98];
```

### 4. 注入代码

将代码注入到游戏 HTML 的三个位置：

**A. `<style>` 末尾** — 添加音量按钮 CSS（参考 `references/engine.md` 的 CSS 部分）

**B. 头部区域 HTML** — 在分数/信息栏添加 `<button id="volBtn">🔊</button>`

**C. `<script>` 顶部** — 插入完整的 Audio IIFE 引擎

引擎结构（用伪代码表示）：
```
const Audio = (() => {
  // 状态：ac, muted, bgmGain, bgmTimer, bgmPlaying
  // init() — 懒创建 AudioContext
  // note(freq, dur, type, vol, delay) — 播放单个音符，muted 时跳过
  // playLoop() — 播放一轮 BGM（旋律 + 低音）
  // startBGM() / stopBGM() — 启停 BGM 循环
  // setMuted(v) — 通过 bgmGain.gain 切换静音，持久化 localStorage
  // 返回对象：各音效函数 + setMuted, startBGM, stopBGM
})();
```

完整模板见 `references/engine.md`。

### 5. 连接事件

在游戏代码的关键位置调用 Audio 方法：

- 开始按钮 click handler → `Audio.start(); Audio.startBGM();`
- 得分/收集处 → `Audio.eat();`（或对应名称）
- 游戏结束函数 → `Audio.gameOver();`（内部已停 BGM）
- 键盘输入处理 → `Audio.move();`
- 其他事件 → 按需添加

### 6. 音量按钮逻辑

在 Audio 引擎之后、游戏初始化代码之前添加：

```js
const volBtn = document.getElementById('volBtn');
let muted = localStorage.getItem('[GAME]_muted') === '1';
if (muted) { volBtn.textContent = '🔇'; volBtn.classList.add('muted'); }
volBtn.addEventListener('click', () => {
  muted = !muted;
  Audio.setMuted(muted);
  volBtn.textContent = muted ? '🔇' : '🔊';
  volBtn.classList.toggle('muted', muted);
});
```

### 7. 验证

- 开始游戏时应同时播放开始音效和 BGM
- 点击音量按钮应同时静音音效和 BGM
- 游戏结束时 BGM 停止，播放失败音效
- localStorage 正确持久化静音状态

## 常见陷阱

- **bgmGain 未连 destination** — BGM 完全无声。必须 `bgmGain.connect(ac.destination)`
- **用 stopBGM/startBGM 做静音切换** — `bgmPlaying` 状态会混乱导致无法恢复。用 `bgmGain.gain` 控制音量
- **muted 变量未声明** — 音量按钮外部 muted 变量需用 `let` 声明，从 localStorage 读取初始值
- **音效函数未检查 muted** — 每个音效函数开头都要 `if (muted) return`
- **AudioContext 未初始化** — 浏览器要求用户交互后才能创建 AudioContext。`init()` 在首次 note() 调用时懒创建
