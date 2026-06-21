import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

// ---- Title-screen tests: just navigate, do not click start ----

test.describe("title screen", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    // Wait for initGame() to run and populate #title-buttons
    await page.waitForSelector(".start-btn", { timeout: 5000 });
  });

  test("page loads", async ({ page }) => {
    expect(page.url()).toContain("index.html");
  });

  test("title screen #title-screen is active", async ({ page }) => {
    const isActive = await page.evaluate(() => {
      const el = document.getElementById("title-screen");
      return el && el.classList.contains("active");
    });
    expect(isActive).toBe(true);
  });

  test(".start-btn visible", async ({ page }) => {
    await expect(page.locator(".start-btn").first()).toBeVisible();
  });
});

// ---- Dungeon tests: navigate then click start each time ----

test.describe("dungeon after start", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    // Click the first .start-btn ("开始冒险")
    await page.click(".start-btn");
    // Give startNewGame() time to generate floor, call renderPlayerPanel, renderHUD
    await page.waitForTimeout(500);
  });

  test("click .start-btn sets gameState.screen to dungeon", async ({ page }) => {
    const screen = await page.evaluate(() => {
      // gameState exposed via Object.defineProperty on window
      return gameState.screen;
    });
    expect(screen).toBe("dungeon");
  });

  test("canvas has width > 0 and height > 0", async ({ page }) => {
    const dims = await page.evaluate(() => {
      const c = document.getElementById("game-canvas");
      return { width: c.width, height: c.height };
    });
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  test("player panel text contains LV.", async ({ page }) => {
    const text = await page.locator("#player-panel").innerText();
    expect(text).toContain("LV.");
  });

  test("press W key changes player.y", async ({ page }) => {
    const yBefore = await page.evaluate(() => {
      return player.y;
    });
    await page.keyboard.press("W");
    await page.waitForTimeout(150);
    const yAfter = await page.evaluate(() => {
      return player.y;
    });
    expect(yAfter).not.toBe(yBefore);
  });

  test("dungeon-actions contains WASD", async ({ page }) => {
    const text = await page.locator("#dungeon-actions").innerText();
    expect(text).toContain("WASD");
  });
});
