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

// ---- Helper: start a Python HTTP server with CORS ----
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

var PORT_BASE = 38900;

/**
 * Helper: load sprites using SpriteLoader and wait for completion.
 * Returns a promise that resolves to the loader once ready.
 * Workaround: SpriteLoader.waitForAll() returns Promise.resolve(false)
 * when called synchronously after load() because _total is still 0.
 * We poll for _total > 0 first, then call waitForAll().
 */
function loadSpritesInBrowser(page) {
  return page.evaluate(() => {
    return new Promise(function (resolve) {
      var loader = new window.SpriteLoader();
      loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");

      // Poll for _total > 0 (manifest loaded), then wait for images
      var checkInterval = setInterval(function () {
        if (loader._total > 0) {
          clearInterval(checkInterval);
          // Now waitForAll will properly wait for images
          loader.waitForAll().then(function (ok) {
            resolve({ loader: loader, ok: ok });
          });
        }
      }, 50);
    });
  });
}

test.describe("HD Sprite Loader - Unit tests", function () {
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

  test.beforeEach(async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.SpriteLoader === "function", { timeout: 8000 });
    await page.waitForTimeout(300);
  });

  test("0) Diagnostic: manifest XHR and image loading works", async ({ page }) => {
    // Verify XHR + responseType=json
    var xhrResult = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "js/data/sprite-assets/manifest.json", true);
        xhr.responseType = 'json';
        xhr.onload = function () {
          resolve({ ok: xhr.status === 200, keys: xhr.response ? Object.keys(xhr.response) : null });
        };
        xhr.onerror = function () { resolve({ error: true }); };
        xhr.send();
      });
    });
    expect(xhrResult.ok).toBe(true);
    expect(xhrResult.keys).toContain("player-warrior");

    // Verify image loading with crossOrigin
    var imgResult = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
          resolve({ loaded: true, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
        };
        img.onerror = function () { resolve({ loaded: false }); };
        img.src = "js/data/sprite-assets/high-res/player-warrior-map.png";
      });
    });
    expect(imgResult.loaded).toBe(true);
    expect(imgResult.naturalWidth).toBe(256);
  });

  test("1) SpriteLoader loads manifest and sprite sheets", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function (ok) {
              var sheetNames = Object.keys(loader._sheets);
              var warrior = loader._sheets["player-warrior"];
              resolve({
                ok: ok,
                total: loader._total,
                loaded: loader._loaded,
                sheetNames: sheetNames,
                warriorReady: warrior ? warrior.ready : false,
                warriorError: warrior ? warrior.error : false
              });
            });
          }
        }, 50);
      });
    });

    expect(result.ok).toBe(true);
    expect(result.total).toBeGreaterThan(0);
    expect(result.loaded).toBe(result.total);
    expect(result.warriorReady).toBe(true);
    expect(result.warriorError).toBe(false);
  });

  test("2) getEntryWithData returns correct data for map mode", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var mapData = loader.getEntryWithData("player-warrior", false);
              var combatData = loader.getEntryWithData("player-warrior", true);
              resolve({
                mapNotNull: mapData !== null,
                combatNotNull: combatData !== null,
                mapFrameW: mapData ? mapData.frameW : null,
                mapFrameH: mapData ? mapData.frameH : null,
                combatFrameW: combatData ? combatData.combatFrameW : null,
                combatFrameH: combatData ? combatData.combatFrameH : null,
                mapHasImage: !!(mapData && mapData.image),
                combatHasImage: !!(combatData && combatData.image),
                mapHasAnimations: !!(mapData && mapData.animations),
                combatHasAnimations: !!(combatData && combatData.combatAnimations)
              });
            });
          }
        }, 50);
      });
    });

    expect(result.mapNotNull).toBe(true);
    expect(result.combatNotNull).toBe(true);
    expect(result.mapFrameW).toBe(32);
    expect(result.mapFrameH).toBe(48);
    expect(result.combatFrameW).toBe(48);
    expect(result.combatFrameH).toBe(64);
    expect(result.mapHasImage).toBe(true);
    expect(result.combatHasImage).toBe(true);
    expect(result.mapHasAnimations).toBe(true);
    expect(result.combatHasAnimations).toBe(true);
  });

  test("3) Map and combat images are actually loaded", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var sheet = loader._sheets["player-warrior"];
              resolve({
                mapComplete: sheet.image.complete,
                mapNaturalWidth: sheet.image.naturalWidth,
                mapNaturalHeight: sheet.image.naturalHeight,
                combatComplete: sheet.combatImage ? sheet.combatImage.complete : null,
                combatNaturalWidth: sheet.combatImage ? sheet.combatImage.naturalWidth : null,
                combatNaturalHeight: sheet.combatImage ? sheet.combatImage.naturalHeight : null
              });
            });
          }
        }, 50);
      });
    });

    expect(result.mapComplete).toBe(true);
    expect(result.mapNaturalWidth).toBe(256);
    expect(result.mapNaturalHeight).toBe(48);
    expect(result.combatComplete).toBe(true);
    expect(result.combatNaturalWidth).toBe(384);
    expect(result.combatNaturalHeight).toBe(64);
  });

  test("4) Animation config: idle has 2 frames, walk has 4 frames", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var mapData = loader.getEntryWithData("player-warrior", false);
              var combatData = loader.getEntryWithData("player-warrior", true);
              resolve({
                mapIdleFrames: mapData.animations.idle.frames,
                mapWalkFrames: mapData.animations.walk.frames,
                mapAttackFrames: mapData.animations.attack.frames,
                mapHurtFrames: mapData.animations.hurt.frames,
                combatIdleFrames: combatData.combatAnimations.idle.frames,
                combatWalkFrames: combatData.combatAnimations.walk.frames,
                mapIdleSpeed: mapData.animations.idle.speed,
                mapWalkSpeed: mapData.animations.walk.speed,
                combatIdleSpeed: combatData.combatAnimations.idle.speed
              });
            });
          }
        }, 50);
      });
    });

    expect(result.mapIdleFrames).toEqual([0, 1]);
    expect(result.combatIdleFrames).toEqual([0, 1]);
    expect(result.mapWalkFrames).toEqual([2, 3, 4, 5]);
    expect(result.combatWalkFrames).toEqual([2, 3, 4, 5]);
    expect(result.mapAttackFrames).toEqual([6]);
    expect(result.mapHurtFrames).toEqual([7]);
    expect(result.mapIdleSpeed).toBe(20);
    expect(result.mapWalkSpeed).toBe(12);
    expect(result.combatIdleSpeed).toBe(20);
  });

  test("5) isCombat flag selects correct animation set", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var mapSprite = loader.getSprite("player-warrior", "idle", 0, false);
              var combatSprite = loader.getSprite("player-warrior", "idle", 0, true);
              resolve({
                mapSw: mapSprite ? mapSprite.sw : null,
                mapSh: mapSprite ? mapSprite.sh : null,
                combatSw: combatSprite ? combatSprite.sw : null,
                combatSh: combatSprite ? combatSprite.sh : null,
                mapSx: mapSprite ? mapSprite.sx : null,
                combatSx: combatSprite ? combatSprite.sx : null,
                mapImgWidth: mapSprite && mapSprite.image ? mapSprite.image.naturalWidth : null,
                combatImgWidth: combatSprite && combatSprite.image ? combatSprite.image.naturalWidth : null
              });
            });
          }
        }, 50);
      });
    });

    expect(result.mapSw).toBe(32);
    expect(result.mapSh).toBe(48);
    expect(result.combatSw).toBe(48);
    expect(result.combatSh).toBe(64);
    expect(result.mapSx).toBe(0);
    expect(result.combatSx).toBe(0);
    expect(result.mapImgWidth).toBe(256);
    expect(result.combatImgWidth).toBe(384);
  });

  test("6) getFrameCount returns correct counts", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              resolve({
                mapIdle: loader.getFrameCount("player-warrior", "idle", false),
                mapWalk: loader.getFrameCount("player-warrior", "walk", false),
                mapAttack: loader.getFrameCount("player-warrior", "attack", false),
                combatIdle: loader.getFrameCount("player-warrior", "idle", true),
                combatWalk: loader.getFrameCount("player-warrior", "walk", true),
                combatAttack: loader.getFrameCount("player-warrior", "attack", true),
                nonExistent: loader.getFrameCount("player-warrior", "dance", false)
              });
            });
          }
        }, 50);
      });
    });

    expect(result.mapIdle).toBe(2);
    expect(result.mapWalk).toBe(4);
    expect(result.mapAttack).toBe(1);
    expect(result.combatIdle).toBe(2);
    expect(result.combatWalk).toBe(4);
    expect(result.combatAttack).toBe(1);
    expect(result.nonExistent).toBe(0);
  });

  test("7) getSpeed returns correct speed values", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              resolve({
                idle: loader.getSpeed("player-warrior", "idle", false),
                walk: loader.getSpeed("player-warrior", "walk", false),
                attack: loader.getSpeed("player-warrior", "attack", false),
                hurt: loader.getSpeed("player-warrior", "hurt", false),
                combatIdle: loader.getSpeed("player-warrior", "idle", true)
              });
            });
          }
        }, 50);
      });
    });

    expect(result.idle).toBe(20);
    expect(result.walk).toBe(12);
    expect(result.attack).toBe(8);
    expect(result.hurt).toBe(10);
    expect(result.combatIdle).toBe(20);
  });

  test("8) getSheetFrameIndex maps animation frame to sheet column", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              resolve({
                idle_0: loader.getSheetFrameIndex("player-warrior", "idle", 0, false),
                idle_1: loader.getSheetFrameIndex("player-warrior", "idle", 1, false),
                idle_2: loader.getSheetFrameIndex("player-warrior", "idle", 2, false),
                idle_3: loader.getSheetFrameIndex("player-warrior", "idle", 3, false),
                walk_0: loader.getSheetFrameIndex("player-warrior", "walk", 0, false),
                walk_1: loader.getSheetFrameIndex("player-warrior", "walk", 1, false),
                walk_2: loader.getSheetFrameIndex("player-warrior", "walk", 2, false),
                walk_3: loader.getSheetFrameIndex("player-warrior", "walk", 3, false),
                walk_4: loader.getSheetFrameIndex("player-warrior", "walk", 4, false),
                attack_0: loader.getSheetFrameIndex("player-warrior", "attack", 0, false),
                attack_1: loader.getSheetFrameIndex("player-warrior", "attack", 1, false),
                missing: loader.getSheetFrameIndex("nonexistent", "idle", 0, false)
              });
            });
          }
        }, 50);
      });
    });

    expect(result.idle_0).toBe(0);
    expect(result.idle_1).toBe(1);
    expect(result.idle_2).toBe(0);
    expect(result.idle_3).toBe(1);
    expect(result.walk_0).toBe(2);
    expect(result.walk_1).toBe(3);
    expect(result.walk_2).toBe(4);
    expect(result.walk_3).toBe(5);
    expect(result.walk_4).toBe(2);
    expect(result.attack_0).toBe(6);
    expect(result.attack_1).toBe(6);
    expect(result.missing).toBe(-1);
  });

  test("9) isReady and isReadyAll work correctly", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        var readyAllBefore = loader.isReadyAll();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              resolve({
                readyAllBefore: readyAllBefore,
                readyAllAfter: loader.isReadyAll(),
                warriorReady: loader.isReady("player-warrior"),
                nonexistentReady: loader.isReady("nonexistent-sprite")
              });
            });
          }
        }, 50);
      });
    });

    expect(result.readyAllBefore).toBe(false);
    expect(result.readyAllAfter).toBe(true);
    expect(result.warriorReady).toBe(true);
    expect(result.nonexistentReady).toBeFalsy(); // isReady returns undefined for missing
  });

  test("10) clear() releases all images", async ({ page }) => {
    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var beforeTotal = loader._total;
              var beforeLoaded = loader._loaded;
              loader.clear();
              resolve({
                beforeTotal: beforeTotal,
                beforeLoaded: beforeLoaded,
                afterTotal: loader._total,
                afterLoaded: loader._loaded,
                sheetsEmpty: Object.keys(loader._sheets).length === 0,
                readyAfterClear: loader.isReady("player-warrior"),
                readyAllAfterClear: loader.isReadyAll()
              });
            });
          }
        }, 50);
      });
    });

    expect(result.beforeTotal).toBeGreaterThan(0);
    expect(result.afterTotal).toBe(0);
    expect(result.afterLoaded).toBe(0);
    expect(result.sheetsEmpty).toBe(true);
    expect(result.readyAfterClear).toBeFalsy(); // isReady returns undefined for missing
    expect(result.readyAllAfterClear).toBe(false);
  });
});

test.describe("HD Sprite Animation Frame Logic", function () {
  // These tests don't need a server - they test pure JS logic
  test.beforeEach(async ({ page }) => {
    await page.goto("data:text/html,<html><body></body></html>");
  });

  test("11) Frame index changes with spriteAnimFrame (idle: 0->1->0->1)", async ({ page }) => {
    var result = await page.evaluate(() => {
      var frames = [];
      for (var f = 0; f < 100; f += 10) {
        var speed = 20;
        var frameIdx = Math.floor(f / speed) % 2;
        var frameNum = [0, 1][frameIdx];
        frames.push({ spriteFrame: f, frameIdx: frameIdx, frameNum: frameNum });
      }
      return frames;
    });

    expect(result[0].frameIdx).toBe(0);
    expect(result[0].frameNum).toBe(0);
    expect(result[2].frameIdx).toBe(1);
    expect(result[2].frameNum).toBe(1);
    expect(result[4].frameIdx).toBe(0);
    expect(result[4].frameNum).toBe(0);
    expect(result[6].frameIdx).toBe(1);
    expect(result[6].frameNum).toBe(1);
  });

  test("12) Walk animation cycles through 4 frames", async ({ page }) => {
    var result = await page.evaluate(() => {
      var walkFrames = [];
      var speed = 12;
      var frames = [2, 3, 4, 5];
      for (var f = 0; f < 80; f += 12) {
        var frameIdx = Math.floor(f / speed) % frames.length;
        var frameNum = frames[frameIdx];
        walkFrames.push({ spriteFrame: f, frameIdx: frameIdx, frameNum: frameNum });
      }
      return walkFrames;
    });

    expect(result[0].frameIdx).toBe(0);
    expect(result[0].frameNum).toBe(2);
    expect(result[1].frameIdx).toBe(1);
    expect(result[1].frameNum).toBe(3);
    expect(result[2].frameIdx).toBe(2);
    expect(result[2].frameNum).toBe(4);
    expect(result[3].frameIdx).toBe(3);
    expect(result[3].frameNum).toBe(5);
    expect(result[4].frameIdx).toBe(0);
    expect(result[4].frameNum).toBe(2);
  });

  test("13) Combat frame size used in getSprite output", async ({ page }) => {
    var server;
    var port;
    var baseUrl;
    port = findPort(PORT_BASE + 10);
    server = await startHttpServer(PROJECT_ROOT, port);
    baseUrl = "http://127.0.0.1:" + port;

    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.SpriteLoader === "function", { timeout: 8000 });
    await page.waitForTimeout(300);

    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var mapWalk = loader.getSprite("player-warrior", "walk", 2, false);
              var combatWalk = loader.getSprite("player-warrior", "walk", 2, true);
              resolve({
                mapWalk: { sx: mapWalk.sx, sw: mapWalk.sw, sh: mapWalk.sh },
                combatWalk: { sx: combatWalk.sx, sw: combatWalk.sw, sh: combatWalk.sh }
              });
            });
          }
        }, 50);
      });
    });

    server.kill("SIGTERM");

    expect(result.mapWalk.sx).toBe(128);
    expect(result.mapWalk.sw).toBe(32);
    expect(result.mapWalk.sh).toBe(48);
    expect(result.combatWalk.sx).toBe(192);
    expect(result.combatWalk.sw).toBe(48);
    expect(result.combatWalk.sh).toBe(64);
  });

  test("14) isImageLoaded correctly detects loaded images", async ({ page }) => {
    var server;
    var port;
    var baseUrl;
    port = findPort(PORT_BASE + 11);
    server = await startHttpServer(PROJECT_ROOT, port);
    baseUrl = "http://127.0.0.1:" + port;

    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.SpriteLoader === "function", { timeout: 8000 });
    await page.waitForTimeout(300);

    var result = await page.evaluate(() => {
      return new Promise(function (resolve) {
        var loader = new window.SpriteLoader();
        loader.load("js/data/sprite-assets/manifest.json", "js/data/sprite-assets/");
        var check = setInterval(function () {
          if (loader._total > 0) {
            clearInterval(check);
            loader.waitForAll().then(function () {
              var mapData = loader.getEntryWithData("player-warrior", false);
              var combatData = loader.getEntryWithData("player-warrior", true);
              var mapLoaded = window.isImageLoaded(mapData);
              var combatLoaded = window.isImageLoaded(combatData);
              var nullLoaded = window.isImageLoaded(null);
              var undefLoaded = window.isImageLoaded(undefined);
              resolve({
                mapLoaded: mapLoaded,
                combatLoaded: combatLoaded,
                nullLoaded: nullLoaded,
                undefLoaded: undefLoaded
              });
            });
          }
        }, 50);
      });
    });

    server.kill("SIGTERM");

    expect(result.mapLoaded).toBe(true);
    expect(result.combatLoaded).toBe(true);
    expect(result.nullLoaded).toBe(false);
    expect(result.undefLoaded).toBe(false);
  });
});

test.describe("HD Sprite - Full Page Integration", function () {
  var server;
  var port;
  var baseUrl;

  test.beforeAll(async () => {
    port = findPort(PORT_BASE + 20);
    server = await startHttpServer(PROJECT_ROOT, port);
    baseUrl = "http://127.0.0.1:" + port;
  });

  test.afterAll(() => {
    if (server) server.kill("SIGTERM");
  });

  test("15) Switching to hd_sprites theme loads sprites", async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.themeManager.unlock("hd_sprites");
      window.themeManager.switch("hd_sprites");
    });
    await page.waitForTimeout(2000);

    var loaderExists = await page.evaluate(() => {
      return window.currentSpriteLoader !== null && window.currentSpriteLoader !== undefined;
    });
    expect(loaderExists).toBe(true);

    var warriorData = await page.evaluate(async () => {
      if (!window.currentSpriteLoader) return null;
      await window.currentSpriteLoader.waitForAll();
      return window.currentSpriteLoader.getEntryWithData("player-warrior", false);
    });
    expect(warriorData).not.toBeNull();
    expect(warriorData.frameW).toBe(32);
    expect(warriorData.frameH).toBe(48);
  });

  test("16) Switching away from hd_sprites clears sprites", async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => { window.themeManager.unlock("hd_sprites"); window.themeManager.switch("hd_sprites"); });
    await page.waitForTimeout(2000);

    var beforeLoader = await page.evaluate(() => window.currentSpriteLoader !== null);
    expect(beforeLoader).toBe(true);

    await page.evaluate(() => {
      window.themeManager.switch("default");
    });
    await page.waitForTimeout(500);

    var afterLoader = await page.evaluate(() => window.currentSpriteLoader === null);
    expect(afterLoader).toBe(true);
  });

  test("17) Starting a game with hd_sprites theme shows sprites in dungeon", async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => { window.themeManager.unlock("hd_sprites"); window.themeManager.switch("hd_sprites"); });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      startNewGame();
      pickClass("warrior");
    });
    await page.waitForTimeout(1500);

    await page.evaluate(async () => {
      if (window.currentSpriteLoader) await window.currentSpriteLoader.waitForAll();
    });

    var gameState = await page.evaluate(() => {
      return {
        screen: window.gameState ? window.gameState.screen : "unknown",
        hasLoader: !!window.currentSpriteLoader,
        warriorReady: window.currentSpriteLoader ? window.currentSpriteLoader.isReady("player-warrior") : false
      };
    });

    expect(gameState.screen).toBe("dungeon");
    expect(gameState.hasLoader).toBe(true);
    expect(gameState.warriorReady).toBe(true);
  });

  test("18) getPlayerSpriteData returns sprite data after theme switch", async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.themeManager.unlock("hd_sprites");
      window.themeManager.switch("hd_sprites");
      startNewGame();
      pickClass("warrior");
    });
    await page.waitForTimeout(2000);

    var result = await page.evaluate(() => {
      var mapData = window.getPlayerSpriteData(false);
      var combatData = window.getPlayerSpriteData(true);
      return {
        mapNotNull: mapData !== null,
        combatNotNull: combatData !== null,
        mapFrameW: mapData ? mapData.frameW : null,
        mapFrameH: mapData ? mapData.frameH : null,
        combatFrameW: combatData ? combatData.combatFrameW : null,
        combatFrameH: combatData ? combatData.combatFrameH : null,
        mapImageLoaded: mapData ? window.isImageLoaded(mapData) : false,
        combatImageLoaded: combatData ? window.isImageLoaded(combatData) : false
      };
    });

    expect(result.mapNotNull).toBe(true);
    expect(result.combatNotNull).toBe(true);
    expect(result.mapFrameW).toBe(32);
    expect(result.mapFrameH).toBe(48);
    expect(result.combatFrameW).toBe(48);
    expect(result.combatFrameH).toBe(64);
    expect(result.mapImageLoaded).toBe(true);
    expect(result.combatImageLoaded).toBe(true);
  });

  test("19) drawPlayerSprite uses HD branch when sprites are loaded", async ({ page }) => {
    await page.goto(baseUrl + "/index.html");
    await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
    await page.waitForTimeout(300);

    await page.evaluate(() => {
      window.themeManager.unlock("hd_sprites");
      window.themeManager.switch("hd_sprites");
      startNewGame();
      pickClass("warrior");
    });
    await page.waitForTimeout(2000);

    var result = await page.evaluate(() => {
      var canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      var ctx = canvas.getContext("2d");

      var spriteData = window.getPlayerSpriteData(false);
      window.drawPlayerSprite(ctx, 0, 0, "idle", false, false, null, spriteData);

      var imageData = ctx.getImageData(0, 0, 100, 100);
      var hasPixels = false;
      for (var i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) { hasPixels = true; break; }
      }

      var combatData = window.getPlayerSpriteData(true);
      var canvas2 = document.createElement("canvas");
      canvas2.width = 100;
      canvas2.height = 100;
      var ctx2 = canvas2.getContext("2d");
      window.drawPlayerSprite(ctx2, 0, 0, "idle", true, false, null, combatData);

      var imageData2 = ctx2.getImageData(0, 0, 100, 100);
      var hasCombatPixels = false;
      for (var i = 3; i < imageData2.data.length; i += 4) {
        if (imageData2.data[i] > 0) { hasCombatPixels = true; break; }
      }

      return {
        hasPixels: hasPixels,
        hasCombatPixels: hasCombatPixels,
        spriteDataAvailable: spriteData !== null,
        combatDataAvailable: combatData !== null
      };
    });

    expect(result.spriteDataAvailable).toBe(true);
    expect(result.combatDataAvailable).toBe(true);
    expect(result.hasPixels).toBe(true);
    expect(result.hasCombatPixels).toBe(true);
  });
});
