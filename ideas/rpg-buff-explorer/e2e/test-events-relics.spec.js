import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

/**
 * Helper: start game and wait for dungeon screen.
 */
async function startGame(page) {
  await page.goto(HTML);
  await page.waitForSelector("#title-screen.screen.active");
  await page.click(".start-btn");
  await page.waitForFunction(
    () => window.gameState && window.gameState.screen === "dungeon"
  );
  // Dismiss buff selection modal if open
  await page.evaluate(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
      closeModal();
    }
  });
  await page.waitForTimeout(500);
}

test.describe("Events", () => {
  // ---- Test 1: triggerEvent shows modal with A/B choice buttons ----
  test("triggerEvent shows modal with two .modal-btn choice buttons", async ({ page }) => {
    await startGame(page);

    // Force a specific event via pickRandomEvent (or directly via triggerEvent)
    await page.evaluate(() => {
      // Use the first event def which is available at floor 1
      var event = EVENT_DEFS[0]; // collapsing_tunnel
      triggerEvent(event);
    });
    await page.waitForTimeout(300);

    // Check modal is visible
    const display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(display).toBe("flex");

    // Check modal has at least 2 .modal-btn elements (A and B choices)
    const btnCount = await page.locator("#modal-overlay .modal-btn").count();
    expect(btnCount).toBeGreaterThanOrEqual(2);

    // Check modal title contains the event title
    const modalText = await page.locator("#modal-overlay .modal").innerText();
    expect(modalText).toContain("坍塌的隧道");
  });

  // ---- Test 2: Click choice A, verify HP damage applied ----
  test("clicking event choice A with damage effect reduces player HP", async ({ page }) => {
    await startGame(page);

    const hpBefore = await page.evaluate(() => player.hp);

    // Trigger collapsing_tunnel event (choiceA: damage 8 HP)
    await page.evaluate(() => {
      var event = EVENT_DEFS[0]; // collapsing_tunnel
      triggerEvent(event);
    });
    await page.waitForTimeout(300);

    // Click the first button (choice A - damage)
    await page.click("#modal-overlay .modal-btn");
    await page.waitForTimeout(300);

    // HP should have decreased (or clamped at 0 if player had low HP)
    const hpAfter = await page.evaluate(() => player.hp);
    expect(hpAfter).toBeLessThan(hpBefore);
  });

  // ---- Test 3: Click choice B, verify gold increase ----
  test("clicking event choice B with giveGold effect increases player gold", async ({ page }) => {
    await startGame(page);

    const goldBefore = await page.evaluate(() => player.gold);

    // Trigger collapsing_tunnel event (choiceB: giveGold 15)
    await page.evaluate(() => {
      var event = EVENT_DEFS[0]; // collapsing_tunnel
      triggerEvent(event);
    });
    await page.waitForTimeout(300);

    // Click the second button (choice B - giveGold)
    const buttons = await page.locator("#modal-overlay .modal-btn").all();
    await buttons[1].click();
    await page.waitForTimeout(300);

    const goldAfter = await page.evaluate(() => player.gold);
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  // ---- Test 4: Heal event - click choice, HP increases ----
  test("glowing_moss event choice A heals player HP", async ({ page }) => {
    await startGame(page);

    // Set HP to a value where healing will show up
    await page.evaluate(() => {
      player.hp = Math.floor(player.maxHp * 0.5);
    });

    const hpBefore = await page.evaluate(() => player.hp);

    // Trigger glowing_moss (choiceA: heal 30)
    await page.evaluate(() => {
      var event = EVENT_DEFS[1]; // glowing_moss
      triggerEvent(event);
    });
    await page.waitForTimeout(300);

    // Click first button (choice A - heal)
    await page.click("#modal-overlay .modal-btn");
    await page.waitForTimeout(300);

    const hpAfter = await page.evaluate(() => player.hp);
    expect(hpAfter).toBeGreaterThan(hpBefore);
    expect(hpAfter).toBeLessThanOrEqual(await page.evaluate(() => player.maxHp));
  });

  // ---- Test 5: Modal closes after choice ----
  test("modal overlay closes after making event choice", async ({ page }) => {
    await startGame(page);

    await page.evaluate(() => {
      triggerEvent(EVENT_DEFS[0]);
    });
    await page.waitForTimeout(300);

    // Verify modal is open
    const displayBefore = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayBefore).toBe("flex");

    // Make a choice
    await page.click("#modal-overlay .modal-btn");
    await page.waitForTimeout(300);

    // Verify modal is closed
    const displayAfter = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(displayAfter).toBe("none");
  });

  // ---- Test 6: Event log entry appears in #log ----
  test("event effect logs message in #log", async ({ page }) => {
    await startGame(page);

    const goldBefore = await page.evaluate(() => player.gold);

    // Trigger hermit_sage event (choiceB: giveGold 20)
    await page.evaluate(() => {
      var event = EVENT_DEFS[7]; // hermit_sage
      triggerEvent(event);
    });
    await page.waitForTimeout(300);

    // Click second button (choice B - giveGold)
    const buttons = await page.locator("#modal-overlay .modal-btn").all();
    await buttons[1].click();
    await page.waitForTimeout(300);

    const logText = await page.locator("#log").innerText();
    expect(logText).toContain("金币");

    const goldAfter = await page.evaluate(() => player.gold);
    expect(goldAfter).toBeGreaterThan(goldBefore);
  });

  // ---- Test 7: gameState.paused is set true during event, false after ----
  test("gameState.paused is true during event and false after choice", async ({ page }) => {
    await startGame(page);

    // Trigger event
    await page.evaluate(() => {
      triggerEvent(EVENT_DEFS[0]);
    });
    await page.waitForTimeout(300);

    const pausedDuring = await page.evaluate(() => gameState.paused);
    expect(pausedDuring).toBe(true);

    // Make choice
    await page.click("#modal-overlay .modal-btn");
    await page.waitForTimeout(300);

    const pausedAfter = await page.evaluate(() => gameState.paused);
    expect(pausedAfter).toBe(false);
  });
});

test.describe("Relics", () => {
  // ---- Test 8: Player death with buffs shows relic selection ----
  test("player death with active buffs shows relic selection modal", async ({ page }) => {
    await startGame(page);

    // Player starts with buffs from DEFAULT_UNLOCKED (set by resetForNewRun)
    const buffsCount = await page.evaluate(() => {
      return player.activeBuffs ? player.activeBuffs.length : 0;
    });

    // Set player HP to 1, then trigger death
    await page.evaluate(() => {
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    if (buffsCount > 0) {
      // With buffs, should show relic selection modal
      const display = await page.evaluate(() => {
        return document.getElementById("modal-overlay").style.display;
      });
      expect(display).toBe("flex");

      // Modal should contain relic text
      const modalText = await page.locator("#modal-overlay .modal").innerText();
      expect(modalText).toContain("遗物");
    }
  });

  // ---- Test 9: Relic selection shows buff cards ----
  test("relic selection modal has buff cards for each active buff", async ({ page }) => {
    await startGame(page);

    const buffIds = await page.evaluate(() => {
      var ids = [];
      for (var i = 0; i < player.activeBuffs.length; i++) {
        ids.push(player.activeBuffs[i].id);
      }
      return ids;
    });

    // Force death
    await page.evaluate(() => {
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    if (buffIds.length > 0) {
      // Check buff cards exist in modal
      const cardCount = await page.locator("#modal-overlay .buff-card").count();
      expect(cardCount).toBeGreaterThanOrEqual(1);

      // Check cards have buff names from activeBuffs
      const cardsText = await page.locator("#modal-overlay .buff-card").allTextContents();
      // At least one card should have a name from buff definitions
      const foundAny = cardsText.some(function (text) {
        return text.length > 0 && !text.includes("空");
      });
      expect(foundAny).toBe(true);
    }
  });

  // ---- Test 10: Selecting a relic via button click saves it ----
  test("selecting a relic buff saves it to permanent.relic", async ({ page }) => {
    await startGame(page);

    // Get first pickable buff id
    const firstBuffId = await page.evaluate(() => {
      for (var i = 0; i < player.activeBuffs.length; i++) {
        if (!player.activeBuffs[i].isRelic) return player.activeBuffs[i].id;
      }
      return null;
    });

    if (!firstBuffId) {
      // Skip if no pickable buffs
      return;
    }

    // Force death which triggers relic selection
    await page.evaluate(() => {
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    // Click first buff card in relic modal to select it
    await page.click("#modal-overlay .buff-card");
    await page.waitForTimeout(500);

    // Check permanent.relic was set
    const relic = await page.evaluate(() => permanent.relic);
    expect(relic).toBe(firstBuffId);

    // Game over screen should be visible
    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("gameover");
  });

  // ---- Test 11: Skipping relic selection clears relic ----
  test("clicking skip button in relic selection sets relic to null", async ({ page }) => {
    await startGame(page);

    // Set a relic first
    await page.evaluate(() => {
      permanent.relic = "iron_skin";
    });

    // Force death
    await page.evaluate(() => {
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    // Click skip button
    await page.click('button:has-text("跳过")');
    await page.waitForTimeout(500);

    const relic = await page.evaluate(() => permanent.relic);
    expect(relic).toBeNull();

    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("gameover");
  });

  // ---- Test 12: Player death with no buffs goes straight to game over ----
  test("player death with no active buffs skips relic selection", async ({ page }) => {
    await startGame(page);

    // Clear all active buffs so relic selection is skipped
    await page.evaluate(() => {
      player.activeBuffs = [];
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    // Should go straight to game over, no relic modal
    const screen = await page.evaluate(() => gameState.screen);
    expect(screen).toBe("gameover");

    // Modal should not be showing (display is "none" or "" which means hidden)
    const display = await page.evaluate(() => {
      return document.getElementById("modal-overlay").style.display;
    });
    expect(["none", ""]).toContain(display);
  });

  // ---- Test 13: onDeath increments permanent death counter ----
  test("onDeath increments permanent.permanentStats.totalDeaths", async ({ page }) => {
    await startGame(page);

    const deathsBefore = await page.evaluate(() => permanent.permanentStats.totalDeaths);

    await page.evaluate(() => {
      player.hp = 1;
      playerDied();
    });
    await page.waitForTimeout(500);

    const deathsAfter = await page.evaluate(() => permanent.permanentStats.totalDeaths);
    expect(deathsAfter).toBeGreaterThan(deathsBefore);
  });

  // ---- Test 14: Relic carried to next run shows as isRelic buff ----
  test("saved relic appears as isRelic buff in next run", async ({ page }) => {
    await startGame(page);

    // Save a relic
    await page.evaluate(() => {
      permanent.relic = "iron_skin";
      savePermanent(permanent);
    });

    // Start a new game (simulates next run)
    await page.evaluate(() => {
      startNewGame();
    });
    await page.waitForTimeout(500);

    // Dismiss buff selection modal if it opened
    await page.evaluate(() => {
      const overlay = document.getElementById('modal-overlay');
      if (overlay && overlay.style.display === 'flex' && typeof closeModal === 'function') {
        closeModal();
      }
    });
    await page.waitForTimeout(300);

    // Check the relic buff is in activeBuffs with isRelic flag
    const hasRelic = await page.evaluate(() => {
      for (var i = 0; i < player.activeBuffs.length; i++) {
        if (player.activeBuffs[i].isRelic) return true;
      }
      return false;
    });
    expect(hasRelic).toBe(true);
  });
});
