# CLAUDE.md

## 项目概述

独立 HTML 小游戏合集。每款游戏是单个 `.html` 文件（内联 CSS + JS），无需构建工具，浏览器直接打开即可游玩。`web/index.html` 是游戏大厅首页，支持移动端自适应。

## 开发规范

### Workflow 并行修复（最重要的规则）

**当面临任何需要修复的问题时，无论大小，都必须使用 Workflow 工具编排子 agent 完成所有工作。主 agent 不下场做任何具体工作——只负责编写 Workflow 脚本并汇总结果。**

**原因**：节约上下文窗口，提高并行效率。

**主 agent 在 Workflow 场景中唯一的工作**：
1. 编写 Workflow 脚本（描述任务目标、文件路径、验收标准）
2. 等待完成并汇报结果

**主 agent 不做的**：读源码、读错误日志、分析 API、诊断根因、决定修复方案，这些会快速消耗主 agent 的上下文窗口。
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
- 涉及任何代码时（无论代码量多少），全部用文件传递——子 agent 通过 Read 读取文件路径获取代码
- Workflow 脚本中只传文件路径（如 `path.join(baseDir, 'js/core/combat.js')`），不内嵌源码
- 子 agent 的输出只传文件路径、摘要、结果数据——不传完整文件内容
- 如果子 agent 之间需要传递代码（pipeline 阶段间），用 Write 写到临时文件，传递文件路径
- 只在确实需要时才在脚本中嵌入短代码片段（10 行以内）

### Log 调试法

**当用户报告 bug 时，按以下步骤工作：**

1. **加日志定位** — 在关键函数入口、返回值、边界条件处加 `console.log()`，记录变量名、值、函数调用链
2. **自动化测试** — 通过自动化测试复现问题，并根据日志定位问题根因，逐步缩小范围。如果日志不够详细，加日志再测
3. **根据日志定位** — 不要猜。看日志里哪个变量的值不符合预期，追溯是哪个函数产生的错误值
4. **修复验证** — 修复后，先通过自动化测试验证通过后，再让用户验收。如果问题依然存在，加日志再测
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

### Workflow 脚本编写规范

Workflow 脚本在隔离的 JavaScript 沙箱中执行。以下规则基于实际运行错误验证，**违反将导致脚本执行失败**。

#### A. 语法必须是纯 JavaScript

- **禁止 TypeScript 类型注解**：`: string`、`: number[]`、`interface`、`type`、`enum`、泛型 `<T>` 全部会解析失败
- **禁止私有字段**：`#field` 语法不支持
- **变量声明**：用 `const`/`let`/`var`，不加类型注解
- **class 声明**：支持标准 class 语法（不含私有字段）
- **async/await**：顶层 `await` 支持

#### B. meta 对象必须是纯字面量

`export const meta = {...}` 只能包含字面量值，不能包含变量引用、函数调用、展开运算符或模板字符串。

**可以**：
```js
export const meta = {
  name: "my-workflow",
  description: "does stuff",
  phases: [
    { title: "Phase 1", detail: "step one" },
    { title: "Phase 2", detail: "step two" }
  ]
}
```

**不可以**：
```js
const N = 3;
export const meta = { phases: Array(N) };          // 变量引用
export const meta = { name: `prefix-workflow` };    // 模板字符串
export const meta = { phases: [...basePhases] };    // 展开运算符
```

#### C. 禁止的内置 API

以下调用会导致脚本失败（已有实际错误记录验证）：

| 禁止 | 原因 | 实际错误 |
|---|---|---|
| `require()` | 无 Node.js 模块系统 | `require is not defined` |
| `process` | 无 Node.js 进程对象 | `process is not defined` |
| `fs` / `Buffer` | 无文件系统 API | 同上 |
| `Date.now()` / `new Date()`（无参） | 破坏恢复功能（非确定性） | — |
| `Math.random()` | 破坏恢复功能（非确定性） | — |
| `console.log()` | 沙箱不提供 | 用 `log()` 替代 |

**可用的标准内置**：`JSON`、`Array`、`Object`、`Map`、`Set`、`Math`（除 random）、`Promise`、`String`、`RegExp`、`TypeError` 等。

#### D. 字符串处理

- **避免反引号模板字符串包裹大段多行文本**：可能包含特殊字符导致解析问题
- **推荐**：用单引号字符串拼接 `'line1\n' + 'line2'`，或将大段内容写入文件后传路径
- **短文本拼接**（文件路径等）：`'prefix/' + base` 可以
- **agent prompt 中的代码块**：用三个反引号加 js 标识包裹，即 '```js\n' + code + '\n```'

#### E. 特殊字符

- **ASCII 框图字符**（`|`、`─`、`┌`、`┐`、`└`、`┘`）可能导致解析错误，避免使用
- **Emoji 和 Unicode 字符**：在 `meta.description` 和 `log()` 中可用，但在 agent prompt 中可能引起问题
- **中文**：在 meta 和 agent prompt 中正常使用无问题

#### F. 代码传递原则

- **大段代码通过文件传递**：用 Write 工具写入文件，传文件路径给子 agent，让子 agent 用 Read 获取
- **Workflow 脚本中只传文件路径**，不内嵌源码
- **子 agent 之间**（pipeline 阶段间）也用文件传递
- **仅在确实需要时才嵌入短代码片段**（10 行以内）

#### G. API 使用规则

**`agent(prompt, opts)`** — 编排子 agent
- 直接调用（同步风格，返回 agent 结果）
- 或在 `parallel()` 中作为 thunk 调用
- 可选参数：`label`（标识用途）、`phase`（所属阶段）、`schema`（结构化返回）、`isolation: "worktree"`（隔离工作区）

**`parallel(thunks)`** — 并行执行
- **必须传入函数数组**，不是 Promise 数组（已有实际错误记录）
- 每个 thunk 返回 Promise，引擎并行调度
```js
// 正确
const results = await parallel([
  () => agent("do task 1", { label: "task1" }),
  () => agent("do task 2", { label: "task2" })
]);

// 错误 — 已有失败记录
const results = await parallel([
  agent("do task 1"),  // 直接传 agent 调用，不是函数
  agent("do task 2")
]);
```

**`pipeline(items, stage1, stage2, ...)`** — 流水线处理
- 阶段间无屏障（item 到达下一阶段不等待前一个 item）
- 适合：处理文件列表、数据转换链

**`phase(title)`** — 标记阶段切换，用于 UI 展示进度

**`log(message)`** — 输出进度消息，替代 `console.log()`

**`args`** — 用户传入的参数对象

**`budget`** — token 预算对象（只读）

#### H. 并发限制

- 并发 agent 数上限：`min(16, CPU 核心数 - 2)`
- 总 agent 数上限：1000
- 单个 `parallel`/`pipeline` 最多 4096 项

#### I. 返回值

- 脚本末尾 `return` 一个对象作为最终结果
- 返回结构化数据（对象/数组），不要返回大段文本

#### J. 常见错误（实际发生记录）

| 错误信息 | 根因 | 修复方法 |
|---|---|---|
| `require is not defined` | 脚本中使用了 `const fs = require('fs')` | 删除 Node.js 的 require 调用，子 agent 通过 prompt 获取数据后自行用 Write 写入文件 |
| `process is not defined` | 脚本中引用了 `process.cwd()` 等 | 改用字符串字面量路径 |
| `parallel() expects an array of functions` | 直接传 `agent()` 结果而非 `() => agent()` | 所有 parallel 项包装为 thunk 函数 |
| `agent stalled on all 6 attempts` | prompt 过大或任务过于复杂导致子 agent 超时 | 拆分任务为更小的子任务，控制 prompt 长度 |

#### K. 最佳实践

- **agent prompt 要具体**：明确文件路径、验收标准、操作步骤
- **用 `schema` 参数**让子 agent 返回结构化数据（方便后续阶段处理）
- **用 `label` 参数**标识 agent 用途（方便调试定位）
- **优先用 `pipeline()`**处理有前后依赖的文件列表，优先用 `parallel()` 处理独立任务
- **prompt 字符串拼接**用单引号 `'` + `\n` + `'` 的方式，不用反引号包裹多行
- **路径统一用变量**：在脚本顶部定义 `var base = "/absolute/path"`，后续拼接使用

#### L. Workflow 模板

`.claude/workflows/templates/` 目录下有预建模板，编写脚本时优先选择模板修改，不要从零手写：

| 模板 | 文件 | 适用场景 |
|---|---|---|
| 扫描并修复 | `scan-and-fix.js` | 扫描文件找问题，然后修复 |
| 并行任务 | `parallel-tasks.js` | 多个独立任务同时执行 |
| 多阶段流水线 | `pipeline-stage.js` | 数据经过多道工序处理 |

**使用方法**：
1. 根据场景选择对应模板
2. 复制模板内容到 `Workflow.script` 参数
3. 修改标注 `[TODO]` 的部分
4. 提交给 Workflow 工具执行
