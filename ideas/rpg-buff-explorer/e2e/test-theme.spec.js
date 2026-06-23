import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("ThemeManager theme system", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("1) ThemeManager initialized on window", async ({ page }) => {
    const exists = await page.evaluate(() => {
      return typeof window.themeManager === "object" && window.themeManager !== null;
    });
    expect(exists).toBe(true);
  });

  test('2) Default active theme is "default"', async ({ page }) => {
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("default");
  });

  test("3) Switch to pixel_retro theme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const ok = window.themeManager.switch("pixel_retro");
      return { ok, activeId: window.themeManager.getActiveId() };
    });
    expect(result.ok).toBe(true);
    expect(result.activeId).toBe("pixel_retro");
  });

  test("4) BASE_THEME palette has expected color keys", async ({ page }) => {
    const keys = await page.evaluate(() => {
      const palette = window.themeManager.getActive().palette;
      return Object.keys(palette);
    });
    const requiredKeys = ["void", "dark", "gray", "white", "red", "green", "gold", "bodyBg", "textPrimary", "headerGold", "panelBg"];
    for (const key of requiredKeys) {
      expect(keys).toContain(key);
    }
  });

  test('5) blood_moon theme not unlocked by default', async ({ page }) => {
    const unlocked = await page.evaluate(() => window.themeManager.isUnlocked("blood_moon"));
    expect(unlocked).toBe(false);
  });

  test("6) Canvas background reflects switched theme", async ({ page }) => {
    // Ensure known theme state: switch to default first (previous tests may have changed it)
    await page.evaluate(() => {
      window.themeManager.switch("default");
    });

    // Start a new game with default theme first
    await page.evaluate(() => startNewGame());
    await page.waitForTimeout(500);

    // Verify we're on dungeon screen
    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("dungeon");

    // Force render twice with default theme and verify active theme
    await page.evaluate(() => { renderAll(); renderAll(); });
    const activeBefore = await page.evaluate(() => window.themeManager.getActiveId());
    expect(activeBefore).toBe("default");

    // Read minimap border pixels (top-right corner) - always renders with theme colors
    const pixelsDefault = await page.evaluate(() => {
      const c = document.getElementById("game-canvas");
      const ctx = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      // Sample minimap area (top-right, known to use theme colors)
      var colors = [];
      // Minimap border at top-right
      var mx = w - 60, my = 2;
      for (var dy = 0; dy < 3; dy++) {
        for (var dx = 0; dx < 6; dx++) {
          var i = ((my + dy) * w + (mx + dx)) * 4;
          colors.push(imgData.data[i] + ',' + imgData.data[i + 1] + ',' + imgData.data[i + 2]);
        }
      }
      // Also sample a few map tiles from left side
      for (var dy = 2; dy < 5; dy++) {
        for (var dx = 2; dx < 5; dx++) {
          var i = (dy * 4 + dx * 4) * 4;
          colors.push(imgData.data[i] + ',' + imgData.data[i + 1] + ',' + imgData.data[i + 2]);
        }
      }
      return { colors: colors, theme: window.themeManager.getActiveId() };
    });
    expect(pixelsDefault.theme).toBe("default");

    // Switch to pixel_retro and force multiple renders
    await page.evaluate(() => {
      window.themeManager.switch("pixel_retro");
      renderAll();
      renderAll();
      renderAll();
    });
    await page.waitForTimeout(200);

    // Read the same pixels after theme switch
    const pixelsPixelRetro = await page.evaluate(() => {
      const c = document.getElementById("game-canvas");
      const ctx = c.getContext("2d");
      const w = c.width;
      const h = c.height;
      const imgData = ctx.getImageData(0, 0, w, h);
      var colors = [];
      var mx = w - 60, my = 2;
      for (var dy = 0; dy < 3; dy++) {
        for (var dx = 0; dx < 6; dx++) {
          var i = ((my + dy) * w + (mx + dx)) * 4;
          colors.push(imgData.data[i] + ',' + imgData.data[i + 1] + ',' + imgData.data[i + 2]);
        }
      }
      for (var dy = 2; dy < 5; dy++) {
        for (var dx = 2; dx < 5; dx++) {
          var i = (dy * 4 + dx * 4) * 4;
          colors.push(imgData.data[i] + ',' + imgData.data[i + 1] + ',' + imgData.data[i + 2]);
        }
      }
      return { colors: colors, theme: window.themeManager.getActiveId() };
    });
    expect(pixelsPixelRetro.theme).toBe("pixel_retro");

    // At least one sampled pixel should differ after theme switch
    var anyDiff = false;
    for (var k = 0; k < pixelsDefault.colors.length; k++) {
      if (pixelsDefault.colors[k] !== pixelsPixelRetro.colors[k]) {
        anyDiff = true;
        break;
      }
    }
    expect(anyDiff, "canvas colors should differ after theme switch").toBe(true);

    // Also verify the active theme palette has pixel_retro colors
    const palette = await page.evaluate(() => window.themeManager.getActive().palette);
    // pixel_retro overrides dark=#181830 (r=24,g=24,b=48) vs default dark=#1a1a2e (r=26,g=26,b=46)
    const hexToRgb = (hex) => {
      hex = hex.replace("#", "");
      return {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    };
    const darkColor = hexToRgb(palette.dark);
    // pixel_retro dark = #181830
    expect(darkColor.r).toBe(24);
    expect(darkColor.g).toBe(24);
    expect(darkColor.b).toBe(48);
  });

  test("7) Theme persists after reload via localStorage", async ({ page }) => {
    // Switch to pixel_retro
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));

    // Verify localStorage was written
    const hasStorage = await page.evaluate(() => {
      return localStorage.getItem("rpg_buff_theme") !== null;
    });
    expect(hasStorage).toBe(true);

    // Reload and verify theme is restored
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);

    const idAfterReload = await page.evaluate(() => window.themeManager.getActiveId());
    expect(idAfterReload).toBe("pixel_retro");
  });

  test('8) Title screen has "切换主题" button', async ({ page }) => {
    await expect(page.locator("#title-screen button:has-text('切换主题')")).toBeVisible();
  });

  test("9) Unlocking blood_moon theme via unlock()", async ({ page }) => {
    // Initially locked
    expect(await page.evaluate(() => window.themeManager.isUnlocked("blood_moon"))).toBe(false);

    // Unlock it
    await page.evaluate(() => window.themeManager.unlock("blood_moon"));

    // Now should be unlocked and switable
    const result = await page.evaluate(() => {
      const isUnlocked = window.themeManager.isUnlocked("blood_moon");
      const ok = window.themeManager.switch("blood_moon");
      return { isUnlocked, ok, activeId: window.themeManager.getActiveId() };
    });
    expect(result.isUnlocked).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.activeId).toBe("blood_moon");
  });

  test("10) getAllIds returns all registered theme IDs", async ({ page }) => {
    const ids = await page.evaluate(() => window.themeManager.getAllIds());
    expect(ids).toContain("default");
    expect(ids).toContain("blood_moon");
    expect(ids).toContain("pixel_retro");
  });
});
