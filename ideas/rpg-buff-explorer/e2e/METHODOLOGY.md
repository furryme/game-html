# E2E 测试方法论

## 核心理念：玩家视角优先

测试应该模拟一个真实玩家的行为和观察，而不是内部 API 的单元测试。

**玩家知道的东西：**
- 按钮、颜色、屏幕上的文字、按键操作
- 页面刷新后发生了什么变化
- 游戏是否卡住、是否能继续操作

**玩家不知道的东西：**
- `themeManager.getActiveId()` 返回什么
- `gameState.paused` 的布尔值
- `dungeon.enemies[0].hp` 的具体数值
- `localStorage.getItem(SAVE_KEY)` 的 JSON 结构

**好的测试** = 玩家做了一件事，看到了预期的结果。
**差的测试** = 检查内部状态，但没验证用户是否看到了变化。

## 反模式（Anti-Patterns）

### 1. 只测状态不验证视觉

```javascript
// 反模式：只检查内部状态
const id = await page.evaluate(() => window.themeManager.getActiveId());
expect(id).toBe("pixel_retro");

// 改进：验证玩家看到的视觉变化
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
expect(bg).not.toBe(initialBg);  // 玩家能看到颜色变了
```

**问题**：`themeManager.switch()` 可能返回 success，但 CSS 没有应用。
只有检查 DOM/Canvas 才能确认用户看到了变化。

### 2. 在过渡之后不验证输入是否有效

这是最高频的 bug 来源。详见下方规则。

### 3. 用 `page.evaluate()` 模拟玩家操作

```javascript
// 反模式：绕过 UI 直接调用函数
await page.evaluate(() => startCombat(0));

// 改进：通过 UI 操作触发
await page.keyboard.press("d");  // 移动到敌人旁边触发战斗
```

例外：当 UI 操作不稳定时（如随机生成的地图），`evaluate` 作为 setup 可以接受，
但验证环节必须通过 UI 或视觉检查。

### 4. 测试内部 API 而不关联用户行为

```javascript
// 反模式
const modules = await page.evaluate(() => {
  return { palette: !!t.palette, sprites: !!t.sprites };
});

// 改进：验证切换主题后画布渲染使用了新颜色
```

## 黄金规则：每次过渡后验证输入

**规则**：在任何屏幕切换、模态框关闭、战斗结束后，必须验证玩家可以继续操作。

```javascript
// 过渡：战斗结束
await page.click(".btn-atk");
await page.waitForTimeout(500);

// 验证 1：gameState.screen 回到 dungeon
expect(await page.evaluate(() => gameState.screen)).toBe("dungeon");

// 验证 2（关键）：玩家可以移动
const posBefore = await page.evaluate(() => ({ x: player.x, y: player.y }));
await page.keyboard.press("W");
await page.waitForTimeout(150);
const posAfter = await page.evaluate(() => ({ x: player.x, y: player.y }));
expect(posAfter.y !== posBefore.y).toBe(true);

// 验证 3：没有残留的模态框遮挡
const modalVisible = await page.locator("#modal-overlay").isVisible();
expect(modalVisible).toBe(false);
```

**需要验证输入的过渡场景：**
1. 楼层转换（stairs -> floor break modal -> proceed -> new floor）
2. 战斗结束（enemy defeated -> back to dungeon）
3. 战斗逃跑（flee -> back to dungeon）
4. Buff 选择（pick buff -> modal close -> can move）
5. 事件选择（event choice -> modal close -> can move）
6. 游戏结束重开（game over -> restart -> can play）
7. 背包打开/关闭（press i -> press i again -> can move）
8. 主题切换（cycle theme -> canvas re-renders)

## 最有效的测试场景

根据实际 bug 捕获记录，以下测试场景覆盖最常见的错误类型：

### Tier 1: 必写（捕获最多 bug）

| 场景 | 捕获的 bug 类型 | 优先级 |
|------|--------------|--------|
| 过渡后输入验证 | 模态框残留、paused 未重置、屏幕叠加 | P0 |
| 完整游戏流程 | 状态泄漏、内存泄漏、数据不一致 | P0 |
| Canvas 渲染不为空白 | 渲染管线断裂、主题颜色未应用 | P1 |
| 快速连续操作不崩溃 | 竞态条件、重复状态切换 | P1 |

### Tier 2: 应该写

| 场景 | 捕获的 bug 类型 |
|------|--------------|
| 视觉 + 状态双重验证 | 状态与 UI 不同步 |
| 页面刷新后状态恢复 | 持久化/加载失败 |
| 边界条件（满血用药水、无 buff 死亡） | 边界值错误 |

### Tier 3: 锦上添花

| 场景 | 捕获的 bug 类型 |
|------|--------------|
| 特定数值验证（exp、gold 精确值） | 数值计算错误 |
| 内部 API 完整性（themeManager 方法存在） | 接口变更回归 |

## 测试编写模板

### 玩家视角测试模板

```javascript
test("描述玩家看到的行为", async ({ page }) => {
  // 1. Setup: 到达已知状态
  await page.goto(HTML);
  await page.waitForSelector(".start-btn", { timeout: 10000 });

  // 2. Action: 玩家执行操作
  await page.click("button:has-text('选择职业')");
  await page.locator(".class-card").first().click();
  await page.waitForTimeout(500);

  // 3. Verify Visual: 玩家看到的
  await expect(page.locator("#game-canvas")).toBeVisible();
  expect(await page.locator("#modal-overlay").isVisible()).toBe(false);

  // 4. Verify Input Works: 关键 -- 游戏还能玩
  await page.keyboard.press("d");
  await page.waitForTimeout(200);
  const screen = await page.evaluate(() => gameState.screen);
  expect(screen).toBe("dungeon");
});
```

### 视觉验证测试模板

```javascript
test("操作后视觉发生变化", async ({ page }) => {
  // Record before
  const before = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Hash a sample of pixels
    let hash = 0;
    for (let i = 0; i < data.length; i += 80)
      hash = ((hash << 5) - hash + data[i]) | 0;
    return hash;
  });

  // Do action
  await page.click('button[onclick="cycleTheme()"]');
  await page.waitForTimeout(300);

  // Verify changed
  const after = await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let hash = 0;
    for (let i = 0; i < data.length; i += 80)
      hash = ((hash << 5) - hash + data[i]) | 0;
    return hash;
  });

  expect(after).not.toBe(before);
});
```

## 测试分类与视角比例

当前测试套件中，每个类别应追求的玩家视角 vs 开发者视角比例：

| 类别 | 玩家视角目标 | 当前状况 |
|------|------------|---------|
| Player Journey | 100% | 良好 -- 全部通过用户交互操作 |
| Visual Verification | 100% | 良好 -- 检查 DOM/Canvas/颜色 |
| Combat | 70%+ | 混合 -- 部分直接调用 `startCombat()` |
| Theme System | 50%+ | 偏低 -- `theme-complete` 大量内部 API 测试 |
| Dungeon Expansion | 40%+ | 偏低 -- 大量数据验证，缺少视觉验证 |
| Events/Relics | 70%+ | 良好 -- 通过 UI 选择验证 |
| Buff Selection | 70%+ | 良好 -- 通过 UI 点击验证 |
| Synergy | 50% | 中等 -- 数据验证为主，UI 验证为辅 |

## 何时使用 `page.evaluate()`

| 场景 | 推荐 | 理由 |
|------|------|------|
| Setup 初始状态 | 可以接受 | 避免随机性影响测试稳定性 |
| 模拟玩家操作 | 避免 | 应该用 `page.click()` / `page.keyboard` |
| 读取像素数据 | 必须 | Playwright 无法直接读取 Canvas 像素 |
| 读取内部状态 | 有限使用 | 作为辅助断言，不替代视觉验证 |
| 强制触发特定状态 | 仅限 setup | 如设置敌人 HP=1 简化测试 |
