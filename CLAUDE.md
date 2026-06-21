# CLAUDE.md

## 项目概述

独立 HTML 小游戏合集。每款游戏是单个 `.html` 文件（内联 CSS + JS），无需构建工具，浏览器直接打开即可游玩。`web/index.html` 是游戏大厅首页，支持移动端自适应。

## 开发规范

### Workflow 并行修复（最重要的规则）

**当面临多个需要修复的问题时，必须使用 Workflow 工具编排子 agent 完成所有工作。主 agent 不下场做任何具体工作——只负责编写 Workflow 脚本并汇总结果。**

**原因**：节约上下文窗口，提高并行效率。

**主 agent 在 Workflow 场景中唯一的工作**：
1. 编写 Workflow 脚本（描述任务目标、文件路径、验收标准）
2. 等待完成并汇报结果

**主 agent 不做的**：读源码、读错误日志、分析 API、诊断根因、决定修复方案——
这些全部由 Workflow 内部的子 agent 完成。Workflow 脚本里写清楚"做什么"和"怎么验证"，
子 agent 自己 Read/分析/Edit/运行/迭代。

**下放到 Workflow 子 agent 的工作（包括但不仅限）**：
- 读源码、读错误输出、构建 API 地图
- 诊断问题根因
- 写文件、改代码、修 bug
- 运行测试、迭代修复

**严禁**：
- 主 agent 不要 Read 游戏源码（让子 agent 读）
- 主 agent 不要 Edit 文件（让子 agent 改）
- 主 agent 不要发 Explore agent 收集信息（Workflow 内部自行编排）
- 主 agent 不要逐个串行处理多个文件
- 主 agent 不要做"诊断分析"然后自己决定怎么修——让子 agent 诊断并修复

**Workflow 脚本中的代码传递**：
- 涉及大段代码时，用文件传递——子 agent 通过 Read 读取文件路径获取代码
- Workflow 脚本中只传文件路径（如 `path.join(baseDir, 'js/core/combat.js')`），不内嵌源码
- 子 agent 的输出只传文件路径、摘要、结果数据——不传完整文件内容
- 如果子 agent 之间需要传递代码（pipeline 阶段间），用 Write 写到临时文件，传递文件路径
- 只在确实需要时才在脚本中嵌入短代码片段（10 行以内）

### Log 调试法

**当用户报告 bug 时，按以下步骤工作：**

1. **加日志定位** — 在关键函数入口、返回值、边界条件处加 `console.log()`，记录变量名、值、函数调用链
2. **让用户测试** — 把修改后的文件给用户，让用户在浏览器里测试并把控制台日志贴回来
3. **根据日志定位** — 不要猜。看日志里哪个变量的值不符合预期，追溯是哪个函数产生的错误值
4. **修复验证** — 修复后让用户验证问题是否解决
5. **问题确认解决前，不要删除调试日志**

**日志格式约定：**
- 每个标签用方括号开头，大写：`[init]`, `[update]`, `[render]`, `[input]`, `[collision]`, `[spawn]`, `[score]` 等
- 一行包含：标签 + 关键参数 + 坐标 + 结果/返回值
- 嵌套信息用空格缩进 `  key: value`

**示例日志输出：**
```
[SPAWN] snake dir=right pos(5,3) length=3
[COLLISION] ball pos(200,150) vel(3,-2) paddle.hit=true
[LOCK] piece T pos(4,8) linesCleared=2 score=800
```

**严禁行为：**
- 不要根据猜测修改代码，然后根据用户是否报错来判断对错
- 不要在修复前删除所有日志
- 不要在收到 "还有问题" 时继续加功能或重构
- 不要在用户说 "问题解决了" 之前删除日志

### 代码风格

- 默认不写注释。只在 WHY 不显而易见时加一行注释
- 函数命名用 camelCase，常量用 UPPER_SNAKE
- 单文件游戏用 `<script>` 标签内联，按功能分块，每块用注释分隔

### 提交规范

- 提交信息格式：`<type>: <short description>`
- type: `feat`（新功能）, `fix`（修 bug）, `refactor`（重构）, `style`（样式）, `chore`（配置）

### 目录结构

```
web/games/           游戏文件（桌面端）
web/mobile/games/    游戏文件（移动端适配版本）
web/index.html       游戏大厅首页
ideas/               新游戏的设计文档
ideas/archive/       已实装游戏的设计文档（归档）
```

### 文件命名

- **已完成游戏**：`web/games/NN-name.html`，`NN` 为两位数序号（如 `01-snake.html`）
- **开发中游戏**：`web/games/dev-N-name.html`，`N` 为序号（如 `dev-1-rpg.html`）
- **移动端适配**：同步复制到 `web/mobile/games/`，文件名保持一致
- **设计文档**：`ideas/<中文名称>.md`（如 `物理崩塌.md`、`技能卡对决.md`）
- **已归档设计**：`ideas/archive/<中文名称>.md`（已实装游戏的设计文档移入归档）

### 参考实现

- `web/games/dev-2-tetris.html` — 标准方块游戏的参考实现（含虚影、7-bag、碰撞检测等）
