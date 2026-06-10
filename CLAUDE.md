# CLAUDE.md

## 开发规范

### Log 调试法（最重要的规则）

**当用户报告 bug 时，按以下步骤工作：**

1. **加日志定位** — 在关键函数入口、返回值、边界条件处加 `console.log()`，记录变量名、值、函数调用链
2. **让用户测试** — 把修改后的文件给用户，让用户在浏览器里测试并把控制台日志贴回来
3. **根据日志定位** — 不要猜。看日志里哪个变量的值不符合预期，追溯是哪个函数产生的错误值
4. **修复验证** — 修复后让用户验证问题是否解决
5. **问题确认解决前，不要删除调试日志**

**日志格式约定：**
- 每个标签用方括号开头，大写：`[SPAWN]`, `[LOCK]`, `[moveDown]`, `[GHOST]`, `[HARD DROP]`, `[LATERAL]`, `[HOLD]`, `[GAMELOOP]`
- 一行包含：标签 + 关键参数 + 坐标 + 结果/返回值
- 嵌套信息用空格缩进 `  key: value`

**示例日志输出：**
```
[SPAWN] Z dir=down world(4,-1) minY=0 maxY=1 minX=0 maxX=2
  internal cells: [[-1,4],[-1,5],[0,5],[0,6]] isValid: true
[GHOST] from(4,-1)->(4,18) steps=19
[LATERAL] dir=1 gravity=down dx=1 dy=0 from(4,0)->(5,0) ok=true
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

### 游戏文件

- 游戏文件放在 `web/games/` 下
- 设计文档放在 `ideas/` 下
- 设计文档命名：`ideas/<game-name>-design.md`

### 参考实现

- `web/games/dev-2-tetris.html` — 标准方块游戏的参考实现（含虚影、7-bag、碰撞检测等）
