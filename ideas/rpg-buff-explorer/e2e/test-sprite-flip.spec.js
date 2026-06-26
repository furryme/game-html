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

var PORT_BASE = 39100;

/**
 * Helper: start a new game with warrior class, wait for dungeon to be ready.
 */
async function startGame(page, baseUrl) {
  await page.goto(baseUrl + "/index.html");
  await page.waitForFunction(() => typeof window.themeManager === "object", { timeout: 8000 });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    startNewGame();
    pickClass("warrior");
  });
  // Wait for dungeon generation + sprite loading
  await page.waitForFunction(() => {
    return window.gameState && window.gameState.screen === "dungeon" && window.dungeon !== null;
  }, { timeout: 10000 });
  await page.waitForTimeout(1500);
}

test.describe("Sprite Flip - dirX direction logic", function () {
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
    await startGame(page, baseUrl);
  });

  test("1) Move right -> dirX=1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(1, 0);
      return player.dirX;
    });
    expect(dirX).toBe(1);
  });

  test("2) Move left -> dirX=-1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(-1, 0);
      return player.dirX;
    });
    expect(dirX).toBe(-1);
  });

  test("3) Move right then up -> dirX stays 1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(1, 0);   // right: dirX becomes 1
      movePlayer(0, -1);  // up: dx=0, dirX unchanged
      return player.dirX;
    });
    expect(dirX).toBe(1);
  });

  test("4) Move left then up -> dirX stays -1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(-1, 0);  // left: dirX becomes -1
      movePlayer(0, -1);  // up: dx=0, dirX unchanged
      return player.dirX;
    });
    expect(dirX).toBe(-1);
  });

  test("5) Move left then down -> dirX stays -1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(-1, 0);  // left: dirX becomes -1
      movePlayer(0, 1);   // down: dx=0, dirX unchanged
      return player.dirX;
    });
    expect(dirX).toBe(-1);
  });

  test("6) Move right then down -> dirX stays 1", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      movePlayer(1, 0);   // right: dirX becomes 1
      movePlayer(0, 1);   // down: dx=0, dirX unchanged
      return player.dirX;
    });
    expect(dirX).toBe(1);
  });

  test("7) Repeated up-down-left-right -> direction correctly inherited", async ({ page }) => {
    var result = await page.evaluate(() => {
      function attempt(dx, dy, label) {
        var beforeX = player.x, beforeY = player.y, beforeDirX = player.dirX;
        movePlayer(dx, dy);
        var moved = (player.x !== beforeX || player.y !== beforeY);
        return { action: label, dx: dx, dy: dy, moved: moved, dirX: player.dirX, beforeDirX: beforeDirX };
      }

      var steps = [];
      // Record initial state
      steps.push({ action: "init", dirX: player.dirX });

      // Right first to establish dirX=1 and ensure open space to right
      steps.push(attempt(1, 0, "right_1"));

      // Up (vertical, no dirX change)
      steps.push(attempt(0, -1, "up_1"));

      // Down (vertical, no dirX change)
      steps.push(attempt(0, 1, "down_1"));

      // Left to set dirX=-1 (undo right_1, likely open)
      steps.push(attempt(-1, 0, "left_1"));

      // Up again (vertical, no dirX change)
      steps.push(attempt(0, -1, "up_2"));

      // Right to set dirX=1
      steps.push(attempt(1, 0, "right_2"));

      // Down (vertical, no dirX change)
      steps.push(attempt(0, 1, "down_2"));

      // Left again (set dirX=-1)
      steps.push(attempt(-1, 0, "left_2"));

      return steps;
    });

    // Only assert on steps where move actually succeeded (moved=true)
    expect(result[0].dirX).toBe(1); // init: default right

    for (var i = 1; i < result.length; i++) {
      var s = result[i];
      if (!s.moved) continue; // skip blocked moves

      if (s.dx === 0) {
        // Vertical move: dirX should not change
        expect(s.dirX).toBe(s.beforeDirX);
      } else {
        // Horizontal move: dirX should match dx
        expect(s.dirX).toBe(s.dx);
      }
    }

    // Ensure at least some moves succeeded for meaningful coverage
    var movedCount = result.filter(function (s) { return s.moved; }).length;
    expect(movedCount).toBeGreaterThanOrEqual(4);
  });

  test("8) Initial dirX=1 (default facing right)", async ({ page }) => {
    var dirX = await page.evaluate(() => {
      return player.dirX;
    });
    expect(dirX).toBe(1);
  });

  // Additional edge-case: dirY also gets set on every move
  test("9) dirY updates on every vertical move", async ({ page }) => {
    var result = await page.evaluate(() => {
      movePlayer(0, -1);
      var afterUp = player.dirY;
      movePlayer(0, 1);
      var afterDown = player.dirY;
      movePlayer(1, 0);
      var afterRight = player.dirY;
      return { afterUp, afterDown, afterRight };
    });
    expect(result.afterUp).toBe(-1);
    expect(result.afterDown).toBe(1);
    expect(result.afterRight).toBe(0);
  });

  // Verify facingLeft render flag derives from dirX
  test("10) facingLeft render flag matches dirX < 0", async ({ page }) => {
    var result = await page.evaluate(() => {
      var facingLeft1 = player.dirX < 0;
      movePlayer(-1, 0);
      var facingLeft2 = player.dirX < 0;
      movePlayer(1, 0);
      var facingLeft3 = player.dirX < 0;
      return { facingLeft1, facingLeft2, facingLeft3 };
    });
    expect(result.facingLeft1).toBe(false); // dirX=1, not facing left
    expect(result.facingLeft2).toBe(true);  // dirX=-1, facing left
    expect(result.facingLeft3).toBe(false); // dirX=1, not facing left
  });
});
