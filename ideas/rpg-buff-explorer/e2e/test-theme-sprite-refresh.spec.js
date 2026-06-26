import { test, expect } from "@playwright/test";
import { exec, execSync } from "child_process";
import { join } from "path";

var PROJECT_ROOT = join(__dirname, "..");
var SERVER_SCRIPT = join(__dirname, "_test-server.py");

function isPortFree(port) {
  try {
    execSync("lsof -i :" + port + " -sTCP:LISTEN", { stdio: "pipe" });
    return false;
  } catch (e) {
    return true;
  }
}

function findPort(base) {
  for (var i = 0; i < 20; i++) {
    if (isPortFree(base + i)) return base + i;
  }
  throw new Error("No free port found near " + base);
}

function startHttpServer(root, port) {
  return new Promise(function (resolve, reject) {
    var server = exec("python3 " + SERVER_SCRIPT + " " + root + " " + port, {
      timeout: 60000
    });

    var attempts = 0;
    var check = setInterval(function () {
      attempts++;
      try {
        execSync("curl -sf http://127.0.0.1:" + port + "/index.html -o /dev/null", { stdio: "pipe" });
        clearInterval(check);
        resolve(server);
      } catch (e) {
        if (attempts > 30) {
          clearInterval(check);
          reject(new Error("Server did not start on port " + port));
        }
      }
    }, 200);

    server.on("error", function (err) {
      clearInterval(check);
      reject(err);
    });
  });
}

var PORT_BASE = 39200;

/**
 * Helper: wait for sprites to finish loading in the browser.
 * Polls currentSpriteLoader._total > 0 then calls waitForAll().
 */
async function waitForSprites(page) {
  await page.evaluate(async () => {
    return new Promise(function (resolve) {
      var loader = window.currentSpriteLoader;
      if (!loader) { resolve(); return; }
      if (loader._total > 0) {
        loader.waitForAll().then(function () { resolve(); });
      } else {
        var poll = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(poll);
            loader.waitForAll().then(function () { resolve(); });
          }
        }, 50);
        // Safety timeout
        setTimeout(function () { clearInterval(poll); resolve(); }, 8000);
      }
    });
  });
}

/**
 * Helper: start a new game with the warrior class.
 */
async function startDungeonGame(page) {
  await page.evaluate(() => {
    startNewGame();
    if (typeof pickClass === "function") pickClass("warrior");
  });
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon",
    { timeout: 5000 }
  );
  await page.waitForTimeout(500);
  // Dismiss buff selection modal if open
  await page.evaluate(() => {
    var overlay = document.getElementById("modal-overlay");
    if (overlay && overlay.style.display === "flex" && typeof closeModal === "function") {
      closeModal();
    }
  });
  await page.waitForTimeout(300);
}

/**
 * Helper: verify sprite loader is active and warrior sprite is ready.
 * Returns detailed status object.
 */
async function checkSpriteState(page) {
  return await page.evaluate(async () => {
    var loader = window.currentSpriteLoader;
    if (!loader) {
      return { hasLoader: false, theme: window.themeManager ? window.themeManager.getActiveId() : "unknown" };
    }
    if (loader._total > 0) {
      await loader.waitForAll();
    }
    var warrior = loader._sheets ? loader._sheets["player-warrior"] : null;
    var mapData = null;
    var combatData = null;
    if (loader.getEntryWithData) {
      mapData = loader.getEntryWithData("player-warrior", false);
      combatData = loader.getEntryWithData("player-warrior", true);
    }
    return {
      hasLoader: true,
      activeId: window.themeManager ? window.themeManager.getActiveId() : "unknown",
      total: loader._total,
      loaded: loader._loaded,
      warriorReady: warrior ? warrior.ready : false,
      warriorError: warrior ? warrior.error : false,
      mapDataNotNull: mapData !== null,
      combatDataNotNull: combatData !== null,
      mapFrameW: mapData ? mapData.frameW : null,
      mapFrameH: mapData ? mapData.frameH : null,
      mapImageComplete: mapData && mapData.image ? mapData.image.complete : false,
      combatFrameW: combatData ? combatData.combatFrameW : null,
      combatFrameH: combatData ? combatData.combatFrameH : null,
      combatImageComplete: combatData && combatData.image ? combatData.image.complete : false
    };
  });
}

test.describe("Sprite loading persists after page refresh", function () {
  var server;
  var port;
  var baseUrl;

  test.beforeAll(async () => {
    port = findPort(PORT_BASE);
    server = await startHttpServer(PROJECT_ROOT, port);
    baseUrl = "http://127.0.0.1:" + port;
  });

  test.afterAll(() => {
    if (server) server.kill("SIGTERM");
  });

  // Clear stored theme state before each test so we start from default
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.evaluate(() => {
      localStorage.removeItem("rpg_buff_theme");
    });
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);
  });

  // ---- Test 1: First load, switch to hd_sprites, start game, verify sprites ----
  test("1) First load switch to hd_sprites and start game loads sprites", async ({ page }) => {
    // Switch to hd_sprites (unlocked by default)
    await page.evaluate(() => {
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(1000);

    // Wait for sprites to load
    await waitForSprites(page);

    // Start game
    await startDungeonGame(page);

    // Verify sprite state
    var state = await checkSpriteState(page);
    expect(state.hasLoader).toBe(true);
    expect(state.activeId).toBe("hd_sprites");
    expect(state.warriorReady).toBe(true);
    expect(state.warriorError).toBe(false);
    expect(state.mapDataNotNull).toBe(true);
    expect(state.combatDataNotNull).toBe(true);
    expect(state.mapFrameW).toBe(32);
    expect(state.mapFrameH).toBe(48);
    expect(state.mapImageComplete).toBe(true);
    expect(state.combatFrameW).toBe(48);
    expect(state.combatFrameH).toBe(64);
    expect(state.combatImageComplete).toBe(true);
  });

  // ---- Test 2: Page refresh preserves hd_sprites theme and loads sprites (CORE TEST) ----
  test("2) Page refresh keeps hd_sprites theme and reloads sprites", async ({ page }) => {
    // Switch to hd_sprites and verify
    await page.evaluate(() => {
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(1000);
    await waitForSprites(page);

    var stateBefore = await checkSpriteState(page);
    expect(stateBefore.hasLoader).toBe(true);
    expect(stateBefore.activeId).toBe("hd_sprites");
    expect(stateBefore.warriorReady).toBe(true);

    // Reload the page
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(500);

    // Theme should be restored
    var themeAfter = await page.evaluate(() => window.themeManager.getActiveId());
    expect(themeAfter).toBe("hd_sprites");

    // Wait for sprites to load after reload
    await waitForSprites(page);

    // Verify sprites loaded correctly
    var stateAfter = await checkSpriteState(page);
    expect(stateAfter.hasLoader).toBe(true);
    expect(stateAfter.activeId).toBe("hd_sprites");
    expect(stateAfter.warriorReady).toBe(true);
    expect(stateAfter.warriorError).toBe(false);
    expect(stateAfter.mapDataNotNull).toBe(true);
    expect(stateAfter.combatDataNotNull).toBe(true);
    expect(stateAfter.mapFrameW).toBe(32);
    expect(stateAfter.mapFrameH).toBe(48);
    expect(stateAfter.mapImageComplete).toBe(true);
    expect(stateAfter.combatFrameW).toBe(48);
    expect(stateAfter.combatFrameH).toBe(64);
    expect(stateAfter.combatImageComplete).toBe(true);

    // Start a game after reload to verify sprites work in-game
    await startDungeonGame(page);
    await waitForSprites(page);

    var stateInGame = await checkSpriteState(page);
    expect(stateInGame.hasLoader).toBe(true);
    expect(stateInGame.warriorReady).toBe(true);
  });

  // ---- Test 3: Switch to pixel_retro, reload, start game -> pixel sprites (no HD) ----
  test("3) Switch to pixel_retro, reload, start game - no sprite loader", async ({ page }) => {
    // Switch to pixel_retro (no sprite assets)
    await page.evaluate(() => {
      window.themeManager.switch("pixel_retro");
    });
    await page.waitForTimeout(500);

    // Verify no sprite loader for pixel_retro
    var stateBefore = await page.evaluate(() => ({
      hasLoader: window.currentSpriteLoader !== null && window.currentSpriteLoader !== undefined,
      activeId: window.themeManager.getActiveId()
    }));
    expect(stateBefore.hasLoader).toBe(false);
    expect(stateBefore.activeId).toBe("pixel_retro");

    // Reload
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(500);

    // Theme should be pixel_retro, no sprite loader
    var stateAfter = await page.evaluate(() => ({
      hasLoader: window.currentSpriteLoader !== null && window.currentSpriteLoader !== undefined,
      activeId: window.themeManager.getActiveId()
    }));
    expect(stateAfter.hasLoader).toBe(false);
    expect(stateAfter.activeId).toBe("pixel_retro");

    // Start game and verify no HD sprites
    await startDungeonGame(page);
    await page.waitForTimeout(500);

    var stateInGame = await page.evaluate(() => ({
      hasLoader: window.currentSpriteLoader !== null && window.currentSpriteLoader !== undefined,
      screen: window.gameState ? window.gameState.screen : "unknown"
    }));
    expect(stateInGame.hasLoader).toBe(false);
    expect(stateInGame.screen).toBe("dungeon");
  });

  // ---- Test 4: Switch back to hd_sprites, reload, verify HD sprites again ----
  test("4) Switch back to hd_sprites after pixel_retro, reload, verify HD sprites", async ({ page }) => {
    // First switch to pixel_retro
    await page.evaluate(() => {
      window.themeManager.switch("pixel_retro");
    });
    await page.waitForTimeout(500);

    // Then switch to hd_sprites
    await page.evaluate(() => {
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(1500);
    await waitForSprites(page);

    var stateBefore = await checkSpriteState(page);
    expect(stateBefore.hasLoader).toBe(true);
    expect(stateBefore.activeId).toBe("hd_sprites");
    expect(stateBefore.warriorReady).toBe(true);

    // Reload
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(500);

    // Verify theme restored
    var themeAfter = await page.evaluate(() => window.themeManager.getActiveId());
    expect(themeAfter).toBe("hd_sprites");

    // Wait for sprites to load
    await waitForSprites(page);

    var stateAfter = await checkSpriteState(page);
    expect(stateAfter.hasLoader).toBe(true);
    expect(stateAfter.activeId).toBe("hd_sprites");
    expect(stateAfter.warriorReady).toBe(true);
    expect(stateAfter.warriorError).toBe(false);
    expect(stateAfter.mapDataNotNull).toBe(true);
    expect(stateAfter.combatDataNotNull).toBe(true);
    expect(stateAfter.mapFrameW).toBe(32);
    expect(stateAfter.mapFrameH).toBe(48);
    expect(stateAfter.mapImageComplete).toBe(true);
    expect(stateAfter.combatFrameW).toBe(48);
    expect(stateAfter.combatFrameH).toBe(64);
    expect(stateAfter.combatImageComplete).toBe(true);

    // Start game
    await startDungeonGame(page);
    await waitForSprites(page);

    var stateInGame = await checkSpriteState(page);
    expect(stateInGame.hasLoader).toBe(true);
    expect(stateInGame.warriorReady).toBe(true);
  });
});

test.describe("Sprite rendering after refresh", function () {
  var server;
  var port;
  var baseUrl;

  test.beforeAll(async () => {
    port = findPort(PORT_BASE + 50);
    server = await startHttpServer(PROJECT_ROOT, port);
    baseUrl = "http://127.0.0.1:" + port;
  });

  test.afterAll(() => {
    if (server) server.kill("SIGTERM");
  });

  // Clear stored theme state before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.evaluate(() => {
      localStorage.removeItem("rpg_buff_theme");
    });
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);
  });

  // ---- Test 5: Verify actual sprite rendering on canvas after reload ----
  test("5) Sprite actually renders on canvas after reload", async ({ page }) => {
    // Switch to hd_sprites and start game
    await page.evaluate(() => {
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(1000);
    await waitForSprites(page);

    await startDungeonGame(page);
    await waitForSprites(page);
    await page.evaluate(() => { renderAll(); });

    // Verify drawPlayerSprite uses HD branch by checking canvas has sprite pixels
    var hasPixels = await page.evaluate(() => {
      var canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      var ctx = canvas.getContext("2d");
      var spriteData = window.getPlayerSpriteData(false);
      window.drawPlayerSprite(ctx, 0, 0, "idle", false, false, null, spriteData);
      var imageData = ctx.getImageData(0, 0, 100, 100);
      for (var i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) return true;
      }
      return false;
    });
    expect(hasPixels).toBe(true);

    // Reload page
    await page.reload();
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(500);

    // Wait for sprites to load after reload
    await waitForSprites(page);

    // Start game again
    await startDungeonGame(page);
    await waitForSprites(page);
    await page.evaluate(() => { renderAll(); });

    // Verify sprite still renders after reload
    var hasPixelsAfterReload = await page.evaluate(() => {
      var canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      var ctx = canvas.getContext("2d");
      var spriteData = window.getPlayerSpriteData(false);
      window.drawPlayerSprite(ctx, 0, 0, "idle", false, false, null, spriteData);
      var imageData = ctx.getImageData(0, 0, 100, 100);
      for (var i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) return true;
      }
      return false;
    });
    expect(hasPixelsAfterReload).toBe(true);

    // Also verify combat sprite renders
    var hasCombatPixels = await page.evaluate(() => {
      var canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      var ctx = canvas.getContext("2d");
      var combatData = window.getPlayerSpriteData(true);
      window.drawPlayerSprite(ctx, 0, 0, "idle", true, false, null, combatData);
      var imageData = ctx.getImageData(0, 0, 100, 100);
      for (var i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) return true;
      }
      return false;
    });
    expect(hasCombatPixels).toBe(true);
  });

  // ---- Test 6: Multiple reloads don't break sprite loading ----
  test("6) Multiple reloads preserve sprite loading", async ({ page }) => {
    await page.evaluate(() => {
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(1000);
    await waitForSprites(page);

    // Do 3 reload cycles
    for (var r = 0; r < 3; r++) {
      await page.reload();
      await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
      await page.waitForTimeout(500);
      await waitForSprites(page);

      var state = await checkSpriteState(page);
      expect(state.activeId).toBe("hd_sprites");
      expect(state.hasLoader).toBe(true);
      expect(state.warriorReady).toBe(true);
    }
  });
});
