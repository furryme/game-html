# Workflow 脚本模板

## 模板清单

| 模板 | 文件 | 适用场景 |
|------|------|----------|
| 扫描并修复 | `scan-and-fix.js` | 扫描文件找问题，然后修复 |
| 并行任务 | `parallel-tasks.js` | 多个独立任务同时执行 |
| 多阶段流水线 | `pipeline-stage.js` | 数据经过多道工序处理 |

## 使用方法

1. 根据场景选择对应模板
2. 复制模板文件内容到 `Workflow.script` 参数
3. 修改标注 `[TODO]` 的部分
4. 提交给 Workflow 工具执行

## 必须遵守的规则（违反会导致执行失败）

### 语法
- 必须是纯 JavaScript，**禁止 TypeScript**（无类型注解、interface、enum、泛型）
- **禁止私有字段**（`#field`）
- meta 对象必须是**纯字面量**（无变量引用、函数调用、模板字符串）

### 禁止的 API
- `require()` / `process` / `fs` / `Buffer`（无 Node.js 模块系统）
- `Date.now()` / `new Date()` / `Math.random()`（破坏恢复功能）
- `console.log()`（改用 `log()`）

### 正确的用法
- `parallel()` 必须传入**函数数组**：`parallel([() => agent(...), () => agent(...)])`
- `pipeline()` 用于有前后依赖的多阶段处理
- 字符串拼接用单引号 + `\n`，避免反引号模板字符串

## 常见错误速查

| 错误 | 原因 | 修复 |
|------|------|------|
| `require is not defined` | 使用了 Node.js 模块 | 删除 require，用 agent 读文件 |
| `parallel() expects functions` | 直接传 agent 调用 | 包装为 `() => agent(...)` |
| 解析失败 | 使用了 TypeScript 语法 | 删除类型注解 |
