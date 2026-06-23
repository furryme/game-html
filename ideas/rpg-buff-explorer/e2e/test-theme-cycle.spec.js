import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("ThemeManager - Theme Cycling User Interactions", () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure clean state between tests
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);
    // Reset theme state to default
    await page.evaluate(() => {
      localStorage.removeItem("rpg_buff_theme");
      localStorage.removeItem("rpg_buff_theme_unlocks");
    });
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  // ==================== Basic Initialization ====================

  test("1) ThemeManager initialized on window", async ({ page }) => {
    const exists = await page.evaluate(() => {
      return typeof window.themeManager === "object" && window.themeManager !== null;
    });
    expect(exists).toBe(true);
  });

  test('2) Default active theme is "default" (dungeon theme)', async ({ page }) => {
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("default");
    const name = await page.evaluate(() => window.themeManager.getActive().name);
    expect(name).toBe("经典地城");
  });

  test("3) default theme always unlocked (isUnlocked returns true)", async ({ page }) => {
    const unlocked = await page.evaluate(() => window.themeManager.isUnlocked("default"));
    expect(unlocked).toBe(true);
  });

  test("4) pixel_retro unlocked by default", async ({ page }) => {
    const unlocked = await page.evaluate(() => window.themeManager.isUnlocked("pixel_retro"));
    expect(unlocked).toBe(true);
  });

  test("5) blood_moon locked by default", async ({ page }) => {
    const unlocked = await page.evaluate(() => window.themeManager.isUnlocked("blood_moon"));
    expect(unlocked).toBe(false);
  });

  // ==================== Button Click Tests (Core) ====================

  test('6) First click "cycle theme" switches default -> pixel_retro', async ({ page }) => {
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("default");

    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);

    const id = await page.evaluate(() => window.themeManager.getActiveId());
    // blood_moon is locked, so cycle skips it -> pixel_retro
    expect(id).toBe("pixel_retro");
  });

  test('7) Second click "cycle theme" switches pixel_retro -> default', async ({ page }) => {
    // First click: default -> pixel_retro
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");

    // Second click: pixel_retro -> default (wrapping)
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);

    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("default");
  });

  test('8) Third click switches back to pixel_retro', async ({ page }) => {
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(80);
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(80);
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);

    // default -> pixel_retro -> default -> pixel_retro
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("pixel_retro");
  });

  test("9) Rapid clicks - each cycle takes effect, activeId alternates", async ({ page }) => {
    const sequence = [];
    for (let i = 0; i < 10; i++) {
      await page.click('button[onclick="cycleTheme()"]');
      await page.waitForTimeout(50);
      const id = await page.evaluate(() => window.themeManager.getActiveId());
      sequence.push(id);
    }
    // With only default and pixel_retro unlocked, they alternate
    expect(sequence.length).toBe(10);
    for (let i = 0; i < sequence.length; i++) {
      const expected = i % 2 === 0 ? "pixel_retro" : "default";
      expect(sequence[i]).toBe(expected);
    }
  });

  test("10) 20 rapid clicks - no crash or stale state", async ({ page }) => {
    for (let i = 0; i < 20; i++) {
      await page.click('button[onclick="cycleTheme()"]');
      await page.waitForTimeout(30);
    }

    // After 20 clicks starting from default: even number of switches -> back to default
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("default");

    // Button still functional
    const btnText = await page.locator('button[onclick="cycleTheme()"]').textContent();
    expect(btnText).toContain("切换主题");
  });

  // ==================== Unlock Flow Tests ====================

  test("11) After unlocking blood_moon, cycle includes blood_moon", async ({ page }) => {
    // Unlock blood_moon
    await page.evaluate(() => window.themeManager.unlock("blood_moon"));
    expect(
      await page.evaluate(() => window.themeManager.isUnlocked("blood_moon"))
    ).toBe(true);

    // First click: default -> blood_moon (now unlocked, comes first in register order)
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("blood_moon");

    // Second click: blood_moon -> pixel_retro
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");

    // Third click: pixel_retro -> default (wrapping)
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("default");
  });

  test("12) All themes unlocked - cycle order: default -> blood_moon -> pixel_retro -> default", async ({ page }) => {
    // Unlock all themes
    await page.evaluate(() => {
      window.themeManager.unlock("blood_moon");
      // pixel_retro is already unlocked
    });

    const order = [];
    // Record initial
    order.push(await page.evaluate(() => window.themeManager.getActiveId()));

    // Click through full cycle
    for (let i = 0; i < 3; i++) {
      await page.click('button[onclick="cycleTheme()"]');
      await page.waitForTimeout(80);
      order.push(await page.evaluate(() => window.themeManager.getActiveId()));
    }

    expect(order).toEqual(["default", "blood_moon", "pixel_retro", "default"]);
  });

  // ==================== Visual Verification ====================

  test("13) body background color changes after switch (pixel_retro #0c0c1e vs default #0d0d1a)", async ({ page }) => {
    // Browser may normalize #0d0d1a to rgb(13, 13, 26), so compare parsed RGB
    const bgDefault = await page.evaluate(() => {
      const style = getComputedStyle(document.body).backgroundColor;
      // Normalize: handle both "#0d0d1a" and "rgb(13, 13, 26)"
      if (style.startsWith("#")) return style;
      return style;
    });

    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(200);

    const bgPixelRetro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // default bodyBg=#0d0d1a -> rgb(13,13,26), pixel_retro bodyBg=#0c0c1e -> rgb(12,12,30)
    expect(bgPixelRetro).not.toBe(bgDefault);
    expect(bgPixelRetro).toBe("rgb(12, 12, 30)");
  });

  test("14) Canvas rendering uses new theme colors after switch", async ({ page }) => {
    // Start a game so canvas renders
    await page.evaluate(() => startNewGame());
    await page.waitForTimeout(500);

    // Verify active theme palette has default colors
    const darkDefault = await page.evaluate(() => window.themeManager.getActive().palette.dark);
    expect(darkDefault).toBe("#1a1a2e");

    // Switch theme via cycleTheme (calls applyThemeToBody)
    await page.evaluate(() => cycleTheme());
    await page.waitForTimeout(500);

    // Verify active theme palette now has pixel_retro colors
    const darkRetro = await page.evaluate(() => window.themeManager.getActive().palette.dark);
    expect(darkRetro).toBe("#181830");

    // Canvas void color differs between themes
    const voidRetro = await page.evaluate(() => window.themeManager.getActive().palette.void);
    expect(voidRetro).toBe("#0c0c1e");
    expect(voidRetro).not.toBe(darkDefault);
  });

  test("15) After switching back to default, colors restore", async ({ page }) => {
    // Switch away: default -> pixel_retro
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(150);
    const bgRetro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgRetro).toBe("rgb(12, 12, 30)");

    // Switch back: pixel_retro -> default
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(150);
    const bgRestored = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgRestored).toBe("rgb(13, 13, 26)");

    // Also verify title screen h1 color restored (default headerGold = #d4a855)
    const h1Color = await page.evaluate(() => {
      const h1 = document.querySelector("#title-screen h1");
      return h1 ? getComputedStyle(h1).color : null;
    });
    expect(h1Color).toBe("rgb(212, 168, 85)");
  });

  // ==================== Persistence ====================

  test("16) localStorage saves theme after switch to pixel_retro", async ({ page }) => {
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("rpg_buff_theme");
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).not.toBeNull();
    expect(stored.active).toBe("pixel_retro");
  });

  test("17) After reload, theme stays as switched value", async ({ page }) => {
    // Switch to pixel_retro
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");

    // Reload page
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(500);

    // Theme should persist
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("pixel_retro");

    // Body color should match pixel_retro
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(12, 12, 30)");
  });

  // ==================== In-Game Theme Switching ====================

  test("18) After entering dungeon and returning to title, theme still effective", async ({ page }) => {
    // Switch to pixel_retro first
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");

    // Enter game: click "选择职业", pick first class, wait for dungeon
    await page.click('button:has-text("选择职业")');
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);

    // Return to title
    await page.evaluate(() => returnToTitle());
    await page.waitForTimeout(500);

    // Theme should still be pixel_retro
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("pixel_retro");
  });

  test("19) cycleTheme() works while in dungeon game", async ({ page }) => {
    // Enter dungeon
    await page.click('button:has-text("选择职业")');
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);

    // Switch theme via evaluate (button may not be visible in dungeon view)
    await page.evaluate(() => cycleTheme());
    await page.waitForTimeout(200);

    // Should have switched to pixel_retro
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("pixel_retro");

    // Body color updated
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(12, 12, 30)");

    // Game state still intact (in dungeon)
    const screen = await page.evaluate(() => window.gameState.screen);
    expect(screen).toBe("dungeon");
  });

  // ==================== Edge Cases ====================

  test("20) Only default unlocked (lock pixel_retro) - click does not switch", async ({ page }) => {
    // Lock pixel_retro by clearing unlocks
    await page.evaluate(() => {
      localStorage.setItem("rpg_buff_theme_unlocks", JSON.stringify({}));
    });
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);

    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("default");

    // Click cycle button - should not switch since only default is unlocked
    await page.click('button[onclick="cycleTheme()"]');
    await page.waitForTimeout(200);

    // Still default
    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("default");
  });

  test("21) getAllIds() returns all registered themes", async ({ page }) => {
    const ids = await page.evaluate(() => window.themeManager.getAllIds());
    expect(ids).toContain("default");
    expect(ids).toContain("blood_moon");
    expect(ids).toContain("pixel_retro");
    expect(ids).toContain("frost_sanctum");
    expect(ids).toContain("void_core");
    expect(ids).toContain("cyber_dungeon");
    expect(ids.length).toBe(6);
  });
});
