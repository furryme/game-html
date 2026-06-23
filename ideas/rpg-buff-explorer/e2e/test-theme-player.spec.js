import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Player-perspective theme E2E tests.
 *
 * These tests verify what the player SEES and EXPERIENCES, not internal API.
 * The player knows: buttons, colors, text on screen, page reload behavior.
 * The player does NOT know: themeManager, getAllThemes(), deep merge.
 */

function resetState(page) {
  return page.evaluate(() => {
    localStorage.removeItem("rpg_buff_theme");
    localStorage.removeItem("rpg_buff_theme_unlocks");
    localStorage.removeItem("rpg_theme_progress");
  });
}

function getBodyBg(page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

function getBodyColor(page) {
  return page.evaluate(() => getComputedStyle(document.body).color);
}

function getTitleBg(page) {
  return page.evaluate(() => {
    var ts = document.getElementById("title-screen");
    return ts ? ts.style.background : "";
  });
}

function getTitleH1Color(page) {
  return page.evaluate(() => {
    var ts = document.getElementById("title-screen");
    var h1 = ts ? ts.querySelector("h1") : null;
    return h1 ? h1.style.color : "";
  });
}

function getCssVar(page, name) {
  return page.evaluate((name) => {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || null;
  }, name);
}

function getThemeButton(page) {
  return page.locator('[onclick="cycleTheme()"]');
}

// ==================== Test 1: Theme button shows current theme name ====================

test.describe("Theme button shows current theme name", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("button text includes theme name on title screen", async ({ page }) => {
    var text = await getThemeButton(page).textContent();
    // Player sees the current theme name in parentheses
    expect(text).toMatch(/\(.*\)/);
    // Default theme name should be visible
    expect(text).toContain("经典地城");
  });

  test("clicking button changes theme name displayed", async ({ page }) => {
    var name1 = await getThemeButton(page).textContent();
    await getThemeButton(page).click();
    await page.waitForTimeout(200);
    var name2 = await getThemeButton(page).textContent();
    // Name should have changed after cycling
    expect(name1).not.toBe(name2);
    // New name should still include a theme in parens
    expect(name2).toMatch(/\(.*\)/);
  });
});

// ==================== Test 2: Each theme has a distinct look ====================

test.describe("Each theme has a distinct look", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("switching to different themes changes body background", async ({ page }) => {
    var bgClassic = await getBodyBg(page);
    // Switch to pixel_retro (already unlocked)
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);
    var bgRetro = await getBodyBg(page);
    expect(bgRetro).not.toBe(bgClassic);
  });

  test("at least two themes produce different body backgrounds", async ({ page }) => {
    var bgs = [];
    // Unlock all themes first so we can switch
    await page.evaluate(() => {
      var tm = window.themeManager;
      tm.unlock("blood_moon");
      tm.unlock("frost_sanctum");
      tm.unlock("void_core");
      tm.unlock("cyber_dungeon");
    });

    var themes = ["default", "pixel_retro", "blood_moon", "frost_sanctum"];
    for (var i = 0; i < themes.length; i++) {
      await page.evaluate((id) => window.themeManager.switch(id), themes[i]);
      await page.waitForTimeout(100);
      bgs.push(await getBodyBg(page));
    }

    var unique = new Set(bgs);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

  test("at least two themes produce different title text colors", async ({ page }) => {
    var colors = [];
    await page.evaluate(() => {
      var tm = window.themeManager;
      tm.unlock("blood_moon");
      tm.unlock("void_core");
    });

    var themes = ["default", "pixel_retro", "blood_moon", "void_core"];
    for (var i = 0; i < themes.length; i++) {
      await page.evaluate((id) => window.themeManager.switch(id), themes[i]);
      await page.waitForTimeout(100);
      colors.push(await getTitleH1Color(page));
    }

    var unique = new Set(colors);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

// ==================== Test 3: Theme persists across reload ====================

test.describe("Theme persists across reload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("reloading page keeps the same theme", async ({ page }) => {
    // Switch to a different theme
    await getThemeButton(page).click();
    await page.waitForTimeout(200);
    var nameBefore = await getThemeButton(page).textContent();
    var bgBefore = await getBodyBg(page);

    // Reload the page
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);

    var nameAfter = await getThemeButton(page).textContent();
    var bgAfter = await getBodyBg(page);

    // Both button text and body background should match
    expect(nameAfter).toBe(nameBefore);
    expect(bgAfter).toBe(bgBefore);
  });
});

// ==================== Test 4: Theme shop shows all themes ====================

test.describe("Theme shop shows all themes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("clicking shop button opens modal with title", async ({ page }) => {
    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(300);

    var visible = await page.locator("#modal-overlay").isVisible();
    expect(visible).toBe(true);

    var hasTitle = await page.locator("#modal-overlay:has-text('主题商城')").isVisible();
    expect(hasTitle).toBe(true);
  });

  test("shop lists all 6 theme names", async ({ page }) => {
    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(500);

    // Find theme name elements in the shop modal
    var names = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      // Theme names appear as bold 11px gold-colored divs within cards
      var elts = overlay.querySelectorAll(
        'div[style*="font-weight:bold"][style*="font-size:11px"]'
      );
      return Array.from(elts).map(function (e) { return e.textContent.trim(); });
    });

    expect(names.length).toBe(6);
    expect(names).toContain("经典地城");
    expect(names).toContain("像素复古");
    expect(names).toContain("血月之夜");
  });

  test("some themes are locked, some are unlocked", async ({ page }) => {
    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(500);

    // Unlocked themes show "装备" button or "已装备" text
    // Locked themes show "条件:" text
    var state = await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var buttons = overlay.querySelectorAll("button");
      var equipped = 0;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.trim() === "装备") equipped++;
      }
      var divs = overlay.querySelectorAll("div");
      var currentlyEquipped = 0;
      var locked = 0;
      for (var i = 0; i < divs.length; i++) {
        if (divs[i].textContent.trim().indexOf("已装备") >= 0) currentlyEquipped++;
        if (divs[i].textContent.indexOf("条件:") >= 0) locked++;
      }
      return { equipped, currentlyEquipped, locked };
    });

    expect(state.equipped + state.currentlyEquipped).toBeGreaterThanOrEqual(1);
    expect(state.locked).toBeGreaterThan(0);
  });
});

// ==================== Test 5: Equipping theme in shop changes appearance ====================

test.describe("Equipping theme in shop changes appearance", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("clicking equip on pixel_retro changes visual appearance", async ({ page }) => {
    var bgBefore = await getBodyBg(page);
    var titleColorBefore = await getTitleH1Color(page);

    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(500);

    // Click "装备" button for pixel_retro (unlocked theme, not currently equipped)
    await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var btns = overlay.querySelectorAll('button[onclick*="equipTheme"]');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === "装备") {
          btns[i].click();
          break;
        }
      }
    });
    await page.waitForTimeout(300);

    var bgAfter = await getBodyBg(page);
    var titleColorAfter = await getTitleH1Color(page);

    // At least one visual element changed
    var changed = bgAfter !== bgBefore || titleColorAfter !== titleColorBefore;
    expect(changed).toBe(true);
  });

  test("modal closes after equipping", async ({ page }) => {
    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(300);
    expect(await page.locator("#modal-overlay").isVisible()).toBe(true);

    await page.evaluate(() => {
      var overlay = document.getElementById("modal-overlay");
      var btns = overlay.querySelectorAll('button[onclick*="equipTheme"]');
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.trim() === "装备") {
          btns[i].click();
          break;
        }
      }
    });
    await page.waitForTimeout(300);

    // Modal should be hidden after equipping
    var modalVisible = await page.locator("#modal-overlay").isVisible();
    expect(modalVisible).toBe(false);
  });
});

// ==================== Test 6: Theme changes in-game are visible ====================

test.describe("Theme changes in-game are visible", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
    // Enter dungeon
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);
  });

  test("switching theme in-game changes body background", async ({ page }) => {
    var bg1 = await getBodyBg(page);

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);
    var bg2 = await getBodyBg(page);

    expect(bg2).not.toBe(bg1);
  });

  test("switching between two themes changes canvas background color", async ({ page }) => {
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);

    // Read canvas background from the theme's palette (what the renderer uses)
    var canvasBg1 = await page.evaluate(() => {
      var active = window.themeManager.getActive();
      return active.palette.bgGame;
    });

    await page.evaluate(() => {
      var tm = window.themeManager;
      tm.unlock("blood_moon");
      tm.switch("blood_moon");
    });
    await page.waitForTimeout(200);

    var canvasBg2 = await page.evaluate(() => {
      var active = window.themeManager.getActive();
      return active.palette.bgGame;
    });

    // Canvas background color should differ between themes
    expect(canvasBg1).not.toBe(canvasBg2);
  });

  test("CSS variables change when theme switches in-game", async ({ page }) => {
    var dark1 = await getCssVar(page, "--tp-dark");
    var textPrimary1 = await getCssVar(page, "--tp-text-primary");

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);

    var dark2 = await getCssVar(page, "--tp-dark");
    var textPrimary2 = await getCssVar(page, "--tp-text-primary");

    // CSS variables should have changed
    var changed = dark2 !== dark1 || textPrimary2 !== textPrimary1;
    expect(changed).toBe(true);
  });
});

// ==================== Test 7: Tile style differences are present ====================

test.describe("Tile style differences are present", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("wallStyle differs between themes", async ({ page }) => {
    var walls = await page.evaluate(() => {
      var tm = window.themeManager;
      return {
        classic: tm.getActive().tiles.wallStyle,
        blood_moon: tm.getTheme("blood_moon").tiles.wallStyle,
        pixel_retro: tm.getTheme("pixel_retro").tiles.wallStyle,
        void_core: tm.getTheme("void_core").tiles.wallStyle
      };
    });

    // Verify at least two different wall styles exist
    var unique = new Set([walls.classic, walls.blood_moon, walls.pixel_retro, walls.void_core]);
    expect(unique.size).toBeGreaterThan(1);
  });

  test("floorStyle differs between themes", async ({ page }) => {
    var floors = await page.evaluate(() => {
      var tm = window.themeManager;
      return {
        classic: tm.getActive().tiles.floorStyle,
        pixel_retro: tm.getTheme("pixel_retro").tiles.floorStyle,
        frost_sanctum: tm.getTheme("frost_sanctum").tiles.floorStyle,
        blood_moon: tm.getTheme("blood_moon").tiles.floorStyle
      };
    });

    var unique = new Set([
      floors.classic, floors.pixel_retro, floors.frost_sanctum, floors.blood_moon
    ]);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ==================== Test 8: Effects differ between themes ====================

test.describe("Effects differ between themes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("particleShape differs between themes", async ({ page }) => {
    var shapes = await page.evaluate(() => {
      var tm = window.themeManager;
      return {
        classic: tm.getActive().effects.particleShape,
        blood_moon: tm.getTheme("blood_moon").effects.particleShape,
        void_core: tm.getTheme("void_core").effects.particleShape,
        pixel_retro: tm.getTheme("pixel_retro").effects.particleShape
      };
    });

    // blood_moon uses crescent, others use square/star
    expect(shapes.blood_moon).toBe("crescent");
    expect(shapes.classic).toBe("square");
  });

  test("glowEnabled is true for blood_moon, false for pixel_retro", async ({ page }) => {
    var glow = await page.evaluate(() => {
      var tm = window.themeManager;
      return {
        blood_moon: tm.getTheme("blood_moon").effects.glowEnabled,
        pixel_retro: tm.getTheme("pixel_retro").effects.glowEnabled,
        classic: tm.getActive().effects.glowEnabled
      };
    });

    expect(glow.blood_moon).toBe(true);
    expect(glow.pixel_retro).toBe(false);
    expect(glow.classic).toBe(false);
  });

  test("particleCountMult differs: pixel_retro is 0.5, void_core is 2.0", async ({ page }) => {
    var counts = await page.evaluate(() => {
      var tm = window.themeManager;
      return {
        pixel_retro: tm.getTheme("pixel_retro").effects.particleCountMult,
        void_core: tm.getTheme("void_core").effects.particleCountMult,
        classic: tm.getActive().effects.particleCountMult
      };
    });

    expect(counts.pixel_retro).toBe(0.5);
    expect(counts.void_core).toBe(2.0);
    expect(counts.classic).toBe(1.0);
  });
});

// ==================== Test 9: UI elements respond to theme ====================

test.describe("UI elements respond to theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  test("HP bar gradient CSS variable changes when theme switches", async ({ page }) => {
    var hpBefore = await getCssVar(page, "--tu-hp-grad");

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);

    var hpAfter = await getCssVar(page, "--tu-hp-grad");
    expect(hpAfter).not.toBe(hpBefore);
  });

  test("log damage color changes when theme switches", async ({ page }) => {
    var logDmgBefore = await getCssVar(page, "--tu-logDmg");

    await page.evaluate(() => {
      var tm = window.themeManager;
      tm.unlock("blood_moon");
      tm.switch("blood_moon");
    });
    await page.waitForTimeout(150);

    var logDmgAfter = await getCssVar(page, "--tu-logDmg");
    expect(logDmgAfter).not.toBe(logDmgBefore);
  });

  test("button gradient and text color change between themes", async ({ page }) => {
    var btnGradBefore = await getCssVar(page, "--tu-button-gradient");
    var btnTextBefore = await getCssVar(page, "--tu-button-text");

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(150);

    var btnGradAfter = await getCssVar(page, "--tu-button-gradient");
    var btnTextAfter = await getCssVar(page, "--tu-button-text");

    var changed = btnGradAfter !== btnGradBefore || btnTextAfter !== btnTextBefore;
    expect(changed).toBe(true);
  });
});

// ==================== Test 10: Sprite colors differ by theme ====================

test.describe("Sprite colors differ by theme", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await resetState(page);
    await page.reload();
    await page.waitForSelector(".start-btn", { timeout: 5000 });
    await page.waitForTimeout(300);
    // Enter dungeon
    await page.click(".start-btn");
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      var cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(
      () => window.gameState && window.gameState.screen === "dungeon"
    );
    await page.waitForTimeout(500);
  });

  test("getThemeSpritePalette returns different player colors for different themes", async ({
    page
  }) => {
    var result = await page.evaluate(() => {
      var tm = window.themeManager;
      var classic = tm.getTheme("classic");
      var blood = tm.getTheme("blood_moon");
      var classicPal = window.getThemeSpritePalette(classic, "warrior");
      var bloodPal = window.getThemeSpritePalette(blood, "warrior");
      var diffs = 0;
      for (var i = 0; i < classicPal.player.length; i++) {
        if (classicPal.player[i] !== bloodPal.player[i]) diffs++;
      }
      return diffs;
    });

    expect(result).toBeGreaterThan(0);
  });

  test("enemy sprite palette colors differ between themes", async ({ page }) => {
    var result = await page.evaluate(() => {
      var tm = window.themeManager;
      var classic = tm.getTheme("classic");
      var blood = tm.getTheme("blood_moon");
      var classicPal = window.getThemeSpritePalette(classic, "warrior");
      var bloodPal = window.getThemeSpritePalette(blood, "warrior");
      var diffs = 0;
      for (var i = 0; i < classicPal.enemy.length; i++) {
        if (classicPal.enemy[i] !== bloodPal.enemy[i]) diffs++;
      }
      return diffs;
    });

    expect(result).toBeGreaterThan(0);
  });
});
