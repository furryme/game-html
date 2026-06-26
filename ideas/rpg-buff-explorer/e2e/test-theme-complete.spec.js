import { test, expect } from "@playwright/test";

const HTML = "file:///Users/dxm/Desktop/code/game-html/ideas/rpg-buff-explorer/index.html";

test.describe("ThemeManager - Complete Theme System", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HTML);
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);
    // Reset stored state so every test starts from default
    await page.evaluate(() => {
      localStorage.removeItem("rpg_buff_theme");
      localStorage.removeItem("rpg_buff_theme_unlocks");
      localStorage.removeItem("rpg_theme_progress");
    });
    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);
  });

  // ==================== A. Theme Data: 7 Themes ====================

  test("A1) All 7 themes are registered", async ({ page }) => {
    const ids = await page.evaluate(() => window.themeManager.getAllIds());
    const expected = [
      "default",
      "blood_moon", "frost_sanctum", "void_core",
      "pixel_retro", "cyber_dungeon", "hd_sprites"
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  test("A2) Each theme has all 6 modules", async ({ page }) => {
    const modules = await page.evaluate(() => {
      const ids = window.themeManager.getAllIds();
      const result = {};
      for (const id of ids) {
        const t = window.themeManager.getTheme(id);
        if (!t) continue;
        result[id] = {
          palette: !!t.palette,
          sprites: !!t.sprites,
          tiles: !!t.tiles,
          ui: !!t.ui,
          effects: !!t.effects,
          audio: !!t.audio
        };
      }
      return result;
    });
    const uniqueIds = Object.keys(modules);
    expect(uniqueIds.length).toBe(7);
    for (const id of uniqueIds) {
      expect(modules[id].palette).toBe(true);
      expect(modules[id].sprites).toBe(true);
      expect(modules[id].tiles).toBe(true);
      expect(modules[id].ui).toBe(true);
      expect(modules[id].effects).toBe(true);
      expect(modules[id].audio).toBe(true);
    }
  });

  test("A3) Theme names and rarities are correct", async ({ page }) => {
    const info = await page.evaluate(() => {
      const tm = window.themeManager;
      const themes = {};
      const ids = ["classic", "blood_moon", "frost_sanctum", "void_core", "pixel_retro", "cyber_dungeon", "hd_sprites"];
      for (const id of ids) {
        const t = tm.getTheme(id);
        if (t) themes[id] = { name: t.name, rarity: t.rarity };
      }
      return themes;
    });
    expect(info.classic.name).toBe("经典地城");
    expect(info.classic.rarity).toBe("common");
    expect(info.blood_moon.name).toBe("血月之夜");
    expect(info.blood_moon.rarity).toBe("rare");
    expect(info.frost_sanctum.name).toBe("冰盈圣殿");
    expect(info.frost_sanctum.rarity).toBe("epic");
    expect(info.void_core.name).toBe("虚空核心");
    expect(info.void_core.rarity).toBe("legend");
    expect(info.pixel_retro.name).toBe("像素复古");
    expect(info.pixel_retro.rarity).toBe("common");
    expect(info.cyber_dungeon.name).toBe("赛博地猛");
    expect(info.cyber_dungeon.rarity).toBe("rare");
    expect(info.hd_sprites.name).toBe("高清皮肤");
    expect(info.hd_sprites.rarity).toBe("rare");
  });

  // ==================== B. Theme Switching ====================

  test("B1) switch() changes active theme", async ({ page }) => {
    await page.evaluate(() => window.themeManager.unlock("blood_moon"));
    const result = await page.evaluate(() => {
      const ok = window.themeManager.switch("blood_moon");
      return { ok, activeId: window.themeManager.getActiveId() };
    });
    expect(result.ok).toBe(true);
    expect(result.activeId).toBe("blood_moon");
  });

  test("B2) getActive() returns correct theme object", async ({ page }) => {
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    const result = await page.evaluate(() => {
      const active = window.themeManager.getActive();
      return {
        id: window.themeManager.getActiveId(),
        name: active.name,
        hasPalette: !!active.palette,
        dark: active.palette.dark
      };
    });
    expect(result.id).toBe("pixel_retro");
    expect(result.name).toBe("像素复古");
    expect(result.hasPalette).toBe(true);
    expect(result.dark).toBe("#181830");
  });

  test("B3) CSS variables updated on switch", async ({ page }) => {
    const darkBefore = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--tp-dark").trim()
    );

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(100);

    const darkAfter = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--tp-dark").trim()
    );

    // classic dark=#1a1a2e, pixel_retro dark=#181830
    expect(darkBefore).toBe("#1a1a2e");
    expect(darkAfter).toBe("#181830");
  });

  test("B4) localStorage persists theme choice", async ({ page }) => {
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(100);

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("rpg_buff_theme");
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored).not.toBeNull();
    expect(stored.active).toBe("pixel_retro");
  });

  test("B5) Theme persists across page reload", async ({ page }) => {
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(100);

    await page.reload();
    await page.waitForSelector("#title-screen.active", { timeout: 5000 });
    await page.waitForTimeout(300);

    const id = await page.evaluate(() => window.themeManager.getActiveId());
    expect(id).toBe("pixel_retro");
  });

  // ==================== C. Tile Styles ====================

  test("C1) wallStyle has multiple variants across themes", async ({ page }) => {
    const walls = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").tiles.wallStyle,
        blood_moon: tm.getTheme("blood_moon").tiles.wallStyle,
        pixel_retro: tm.getTheme("pixel_retro").tiles.wallStyle,
        void_core: tm.getTheme("void_core").tiles.wallStyle
      };
    });
    expect(walls.classic).toBe("bricks");
    expect(walls.blood_moon).toBe("cave");
    expect(walls.pixel_retro).toBe("solid");
    expect(walls.void_core).toBe("cave");
  });

  test("C2) floorStyle has multiple variants across themes", async ({ page }) => {
    const floors = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").tiles.floorStyle,
        pixel_retro: tm.getTheme("pixel_retro").tiles.floorStyle,
        frost_sanctum: tm.getTheme("frost_sanctum").tiles.floorStyle,
        blood_moon: tm.getTheme("blood_moon").tiles.floorStyle,
        void_core: tm.getTheme("void_core").tiles.floorStyle,
        cyber_dungeon: tm.getTheme("cyber_dungeon").tiles.floorStyle
      };
    });
    expect(floors.classic).toBe("checker");
    expect(floors.pixel_retro).toBe("smooth");
    expect(floors.frost_sanctum).toBe("dots");
    expect(floors.blood_moon).toBe("cracked");
    expect(floors.void_core).toBe("smooth");
    expect(floors.cyber_dungeon).toBe("dots");
  });

  test("C3) switching theme changes tile style properties", async ({ page }) => {
    const classicTiles = await page.evaluate(() => {
      const t = window.themeManager.getActive();
      return { wall: t.tiles.wallStyle, floor: t.tiles.floorStyle };
    });

    await page.evaluate(() => {
      window.themeManager.unlock("blood_moon");
      window.themeManager.switch("blood_moon");
    });
    await page.waitForTimeout(100);

    const bloodTiles = await page.evaluate(() => {
      const t = window.themeManager.getActive();
      return { wall: t.tiles.wallStyle, floor: t.tiles.floorStyle };
    });

    expect(bloodTiles.wall).not.toBe(classicTiles.wall);
    expect(bloodTiles.floor).not.toBe(classicTiles.floor);
  });

  // ==================== D. Sprite Recoloring ====================

  test("D1) getThemeSpritePalette exists globally", async ({ page }) => {
    const exists = await page.evaluate(() =>
      typeof window.getThemeSpritePalette === "function"
    );
    expect(exists).toBe(true);
  });

  test("D2) getThemeSpritePalette returns player and enemy palettes", async ({ page }) => {
    const result = await page.evaluate(() => {
      const theme = window.themeManager.getActive();
      const pal = window.getThemeSpritePalette(theme, "warrior");
      return {
        hasPlayer: Array.isArray(pal.player),
        hasEnemy: Array.isArray(pal.enemy),
        playerLen: pal.player.length,
        enemyLen: pal.enemy.length
      };
    });
    expect(result.hasPlayer).toBe(true);
    expect(result.hasEnemy).toBe(true);
    expect(result.playerLen).toBeGreaterThan(10);
    expect(result.enemyLen).toBeGreaterThan(10);
  });

  test("D3) enemyHueShift changes sprite colors", async ({ page }) => {
    const result = await page.evaluate(() => {
      const classicTheme = window.themeManager.getTheme("classic");
      const bloodTheme = window.themeManager.getTheme("blood_moon");
      const classicPal = window.getThemeSpritePalette(classicTheme, "warrior");
      const bloodPal = window.getThemeSpritePalette(bloodTheme, "warrior");
      // enemyHueShift for classic=0, blood_moon=-30, so enemy palettes differ
      let diffCount = 0;
      for (let i = 0; i < classicPal.enemy.length; i++) {
        if (classicPal.enemy[i] !== bloodPal.enemy[i]) diffCount++;
      }
      return diffCount;
    });
    expect(result).toBeGreaterThan(0);
  });

  test("D4) classColors from theme affect player sprite palette", async ({ page }) => {
    const result = await page.evaluate(() => {
      const classic = window.themeManager.getTheme("classic");
      const blood = window.themeManager.getTheme("blood_moon");
      // classic warrior=#e53935, blood_moon warrior=#ff5252
      const classicPal = window.getThemeSpritePalette(classic, "warrior");
      const bloodPal = window.getThemeSpritePalette(blood, "warrior");
      return {
        classicSlot13: classicPal.player[13],
        bloodSlot13: bloodPal.player[13]
      };
    });
    expect(result.classicSlot13).toBe("#e53935");
    expect(result.bloodSlot13).toBe("#ff5252");
  });

  // ==================== E. CSS Variables ====================

  test("E1) :root has theme CSS variables set", async ({ page }) => {
    const vars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        tpDark: root.getPropertyValue("--tp-dark").trim(),
        tpVoid: root.getPropertyValue("--tp-void").trim(),
        tpGold: root.getPropertyValue("--tp-gold").trim(),
        tpBodyBg: root.getPropertyValue("--tp-body-bg").trim(),
        tuRadius: root.getPropertyValue("--tu-radius-sm").trim()
      };
    });
    expect(vars.tpDark).toBe("#1a1a2e");
    expect(vars.tpVoid).toBe("#0a0a1a");
    expect(vars.tpGold).toBe("#f0c040");
    expect(vars.tpBodyBg).toBe("#0d0d1a");
    expect(vars.tuRadius).toBe("4px");
  });

  test("E2) Switching themes changes CSS variable values", async ({ page }) => {
    // Record classic values
    const classic = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        dark: root.getPropertyValue("--tp-dark").trim(),
        header: root.getPropertyValue("--tp-header").trim(),
        radiusMd: root.getPropertyValue("--tu-radius-md").trim()
      };
    });

    // Switch to blood_moon
    await page.evaluate(() => {
      window.themeManager.unlock("blood_moon");
      window.themeManager.switch("blood_moon");
    });
    await page.waitForTimeout(100);

    const blood = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        dark: root.getPropertyValue("--tp-dark").trim(),
        header: root.getPropertyValue("--tp-header").trim(),
        radiusMd: root.getPropertyValue("--tu-radius-md").trim()
      };
    });

    expect(blood.dark).not.toBe(classic.dark);
    expect(blood.dark).toBe("#2a0a0a");
    expect(blood.header).toBe("#c4a040");
  });

  test("E3) CSS variables set for class colors", async ({ page }) => {
    const classes = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        warrior: root.getPropertyValue("--tp-class-warrior").trim(),
        mage: root.getPropertyValue("--tp-class-mage").trim(),
        rogue: root.getPropertyValue("--tp-class-rogue").trim()
      };
    });
    expect(classes.warrior).toBe("#e53935");
    expect(classes.mage).toBe("#7c4dff");
    expect(classes.rogue).toBe("#66bb6a");

    // Switch to cyber_dungeon to verify class colors change
    await page.evaluate(() => {
      window.themeManager.unlock("cyber_dungeon");
      window.themeManager.switch("cyber_dungeon");
    });
    await page.waitForTimeout(100);

    const cyber = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        warrior: root.getPropertyValue("--tp-class-warrior").trim(),
        mage: root.getPropertyValue("--tp-class-mage").trim(),
        rogue: root.getPropertyValue("--tp-class-rogue").trim()
      };
    });
    expect(cyber.warrior).toBe("#ff0044");
    expect(cyber.mage).toBe("#00e5ff");
    expect(cyber.rogue).toBe("#00ff88");
  });

  // ==================== F. UI Theming ====================

  test("F1) UI colors change when theme switches", async ({ page }) => {
    const classicUI = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        logDmg: root.getPropertyValue("--tu-logDmg").trim(),
        logHeal: root.getPropertyValue("--tu-logHeal").trim(),
        barBg: root.getPropertyValue("--tu-barBg").trim()
      };
    });

    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    await page.waitForTimeout(100);

    const retroUI = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        logDmg: root.getPropertyValue("--tu-logDmg").trim(),
        logHeal: root.getPropertyValue("--tu-logHeal").trim(),
        barBg: root.getPropertyValue("--tu-barBg").trim()
      };
    });

    expect(retroUI.logDmg).not.toBe(classicUI.logDmg);
    expect(retroUI.logDmg).toBe("#d03030");
    expect(retroUI.logHeal).toBe("#30b040");
    expect(retroUI.barBg).toBe("#1a1a1a");
  });

  test("F2) Button styles differ by theme (gradient/flat/outlined)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classicBtn: tm.getTheme("classic").ui.buttonStyle,
        classicGrad: tm.getTheme("classic").ui.buttonGradient,
        bloodBtn: tm.getTheme("blood_moon").ui.buttonStyle,
        bloodGrad: tm.getTheme("blood_moon").ui.buttonGradient,
        voidBtn: tm.getTheme("void_core").ui.buttonStyle,
        voidGrad: tm.getTheme("void_core").ui.buttonGradient,
        retroBtn: tm.getTheme("pixel_retro").ui.buttonStyle,
        cyberBtn: tm.getTheme("cyber_dungeon").ui.buttonStyle
      };
    });
    expect(result.classicBtn).toBe("gradient");
    expect(result.classicGrad).toContain("linear-gradient");
    expect(result.bloodBtn).toBe("flat");
    expect(result.bloodGrad).toBe("#d32f2f");
    expect(result.voidBtn).toBe("outlined");
    expect(result.voidGrad).toBe("transparent");
    expect(result.retroBtn).toBe("flat");
    expect(result.cyberBtn).toBe("outlined");
  });

  test("F3) UI border radius varies by theme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: { sm: tm.getTheme("classic").ui.borderRadiusSm, lg: tm.getTheme("classic").ui.borderRadiusLg },
        retro: { sm: tm.getTheme("pixel_retro").ui.borderRadiusSm, lg: tm.getTheme("pixel_retro").ui.borderRadiusLg },
        frost: { sm: tm.getTheme("frost_sanctum").ui.borderRadiusSm, lg: tm.getTheme("frost_sanctum").ui.borderRadiusLg },
        voidCore: { sm: tm.getTheme("void_core").ui.borderRadiusSm, lg: tm.getTheme("void_core").ui.borderRadiusLg }
      };
    });
    // classic has rounded corners
    expect(result.classic.sm).toBe(4);
    expect(result.classic.lg).toBe(12);
    // pixel_retro has square corners (retro style)
    expect(result.retro.sm).toBe(0);
    expect(result.retro.lg).toBe(0);
    // frost has smaller radius
    expect(result.frost.sm).toBe(2);
    // void has larger radius
    expect(result.voidCore.sm).toBe(6);
    expect(result.voidCore.lg).toBe(16);
  });

  // ==================== G. Effects ====================

  test("G1) particleShape varies by theme", async ({ page }) => {
    const shapes = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").effects.particleShape,
        blood_moon: tm.getTheme("blood_moon").effects.particleShape,
        void_core: tm.getTheme("void_core").effects.particleShape,
        pixel_retro: tm.getTheme("pixel_retro").effects.particleShape,
        frost_sanctum: tm.getTheme("frost_sanctum").effects.particleShape
      };
    });
    expect(shapes.classic).toBe("square");
    expect(shapes.blood_moon).toBe("crescent");
    expect(shapes.void_core).toBe("star");
    expect(shapes.pixel_retro).toBe("square");
    expect(shapes.frost_sanctum).toBe("square");
  });

  test("G2) particleCountMult varies by theme", async ({ page }) => {
    const counts = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").effects.particleCountMult,
        blood_moon: tm.getTheme("blood_moon").effects.particleCountMult,
        pixel_retro: tm.getTheme("pixel_retro").effects.particleCountMult,
        void_core: tm.getTheme("void_core").effects.particleCountMult,
        frost_sanctum: tm.getTheme("frost_sanctum").effects.particleCountMult
      };
    });
    expect(counts.classic).toBe(1.0);
    expect(counts.blood_moon).toBe(1.3);
    expect(counts.pixel_retro).toBe(0.5);
    expect(counts.void_core).toBe(2.0);
    expect(counts.frost_sanctum).toBe(1.5);
  });

  test("G3) glowEnabled varies by theme", async ({ page }) => {
    const glow = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").effects.glowEnabled,
        blood_moon: tm.getTheme("blood_moon").effects.glowEnabled,
        void_core: tm.getTheme("void_core").effects.glowEnabled,
        pixel_retro: tm.getTheme("pixel_retro").effects.glowEnabled,
        frost_sanctum: tm.getTheme("frost_sanctum").effects.glowEnabled,
        cyber_dungeon: tm.getTheme("cyber_dungeon").effects.glowEnabled
      };
    });
    expect(glow.classic).toBe(false);
    expect(glow.blood_moon).toBe(true);
    expect(glow.void_core).toBe(true);
    expect(glow.pixel_retro).toBe(false);
    expect(glow.frost_sanctum).toBe(true);
    expect(glow.cyber_dungeon).toBe(true);
  });

  test("G4) shakeMultiplier varies by theme", async ({ page }) => {
    const shake = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").effects.shakeMultiplier,
        blood_moon: tm.getTheme("blood_moon").effects.shakeMultiplier,
        void_core: tm.getTheme("void_core").effects.shakeMultiplier,
        pixel_retro: tm.getTheme("pixel_retro").effects.shakeMultiplier,
        frost_sanctum: tm.getTheme("frost_sanctum").effects.shakeMultiplier
      };
    });
    expect(shake.classic).toBe(1);
    expect(shake.blood_moon).toBe(1.3);
    expect(shake.void_core).toBe(1.5);
    expect(shake.pixel_retro).toBe(0.8);
    expect(shake.frost_sanctum).toBe(0.8);
  });

  test("G5) Effects CSS variables are set via --te-* prefix", async ({ page }) => {
    const vars = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        shape: root.getPropertyValue("--te-particleShape").trim(),
        count: root.getPropertyValue("--te-particleCountMultiplier").trim(),
        glow: root.getPropertyValue("--te-glowEnabled").trim(),
        shake: root.getPropertyValue("--te-shakeMultiplier").trim()
      };
    });
    expect(vars.shape).toBe("square");
    expect(vars.count).toBe("1");
    expect(vars.glow).toBe("false");
    expect(vars.shake).toBe("1");
  });

  // ==================== H. Audio ====================

  test("H1) refreshAudioTheme exists globally", async ({ page }) => {
    const exists = await page.evaluate(() =>
      typeof window.refreshAudioTheme === "function"
    );
    expect(exists).toBe(true);
  });

  test("H2) waveformOverride differs by theme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: tm.getTheme("classic").audio.waveformOverride,
        blood_moon: tm.getTheme("blood_moon").audio.waveformOverride,
        pixel_retro: tm.getTheme("pixel_retro").audio.waveformOverride
      };
    });
    expect(result.classic).toBe(null);
    expect(result.blood_moon).toBe("sawtooth");
    expect(result.pixel_retro).toBe("square");
  });

  test("H3) Audio filter settings vary by theme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: { filter: tm.getTheme("classic").audio.filterType, freq: tm.getTheme("classic").audio.filterFreq },
        pixel_retro: { filter: tm.getTheme("pixel_retro").audio.filterType, freq: tm.getTheme("pixel_retro").audio.filterFreq }
      };
    });
    expect(result.classic.filter).toBe(null);
    expect(result.pixel_retro.filter).toBe("lowpass");
    expect(result.pixel_retro.freq).toBe(3000);
  });

  test("H4) Audio BPM and hitSound vary by theme", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tm = window.themeManager;
      return {
        classic: { bpm: tm.getTheme("classic").audio.bpm, hit: tm.getTheme("classic").audio.hitSound },
        blood_moon: { hit: tm.getTheme("blood_moon").audio.hitSound },
        pixel_retro: { bpm: tm.getTheme("pixel_retro").audio.bpm, hit: tm.getTheme("pixel_retro").audio.hitSound },
        frost_sanctum: { bpm: tm.getTheme("frost_sanctum").audio.bpm },
        void_core: { bpm: tm.getTheme("void_core").audio.bpm }
      };
    });
    expect(result.classic.bpm).toBe(120);
    expect(result.classic.hit).toBe("metal");
    expect(result.blood_moon.hit).toBe("stone");
    expect(result.pixel_retro.bpm).toBe(160);
    expect(result.pixel_retro.hit).toBe("wood");
    expect(result.frost_sanctum.bpm).toBe(140);
    expect(result.void_core.bpm).toBe(100);
  });

  // ==================== I. Theme Shop ====================

  test("I1) showThemeShop exists globally", async ({ page }) => {
    const exists = await page.evaluate(() =>
      typeof window.showThemeShop === "function"
    );
    expect(exists).toBe(true);
  });

  test("I2) getAllThemes() returns 7 theme entries", async ({ page }) => {
    const count = await page.evaluate(() => {
      return window.themeManager.getAllThemes().length;
    });
    expect(count).toBe(7);
  });

  test("I3) getAllThemes() includes unlock state and progress", async ({ page }) => {
    const themes = await page.evaluate(() => {
      return window.themeManager.getAllThemes();
    });
    const idMap = {};
    for (const t of themes) idMap[t.id] = t;

    // default (classic) always unlocked, no condition
    expect(idMap.default.unlocked).toBe(true);
    expect(idMap.default.unlockCondition).toBe(null);

    // pixel_retro unlocked by default
    expect(idMap.pixel_retro.unlocked).toBe(true);

    // hd_sprites unlocked by default (no unlock condition)
    expect(idMap.hd_sprites.unlocked).toBe(true);
    expect(idMap.hd_sprites.unlockCondition).toBe(null);

    // blood_moon locked
    expect(idMap.blood_moon.unlocked).toBe(false);
    expect(idMap.blood_moon.unlockCondition).not.toBeNull();

    // All have id, name, rarity
    for (const t of themes) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.rarity).toBeTruthy();
      expect(typeof t.unlocked).toBe("boolean");
    }
  });

  test("I4) Unlock conditions are defined correctly", async ({ page }) => {
    const conditions = await page.evaluate(() => {
      const themes = window.themeManager.getAllThemes();
      const map = {};
      for (const t of themes) map[t.id] = t.unlockCondition;
      return map;
    });
    expect(conditions.default).toBe(null);
    expect(conditions.pixel_retro).toEqual({ type: "totalPlayTime", value: 1800 });
    expect(conditions.blood_moon).toEqual({ type: "deepestFloor", value: 3 });
    expect(conditions.frost_sanctum).toEqual({ type: "totalClears", value: 1 });
    expect(conditions.cyber_dungeon).toEqual({ type: "clearsByClass", cls: "mage", value: 1 });
    expect(conditions.void_core).toEqual({ type: "totalClears", value: 3 });
    expect(conditions.hd_sprites).toBe(null);
  });

  test("I5) checkUnlockConditions unlocks eligible themes", async ({ page }) => {
    const newly = await page.evaluate(() => {
      // Simulate stats that should unlock blood_moon (deepestFloor >= 3)
      // and frost_sanctum (totalClears >= 1)
      const stats = { deepestFloor: 5, totalClears: 2, totalPlayTime: 0, clearsByClass: {} };
      return window.themeManager.checkUnlockConditions(stats);
    });
    expect(newly).toContain("blood_moon");
    expect(newly).toContain("frost_sanctum");
    // Verify they are now unlocked
    const unlocked = await page.evaluate(() => ({
      blood_moon: window.themeManager.isUnlocked("blood_moon"),
      frost_sanctum: window.themeManager.isUnlocked("frost_sanctum")
    }));
    expect(unlocked.blood_moon).toBe(true);
    expect(unlocked.frost_sanctum).toBe(true);
  });

  test("I6) Theme shop button opens shop modal", async ({ page }) => {
    await page.click('button[onclick="showThemeShop()"]');
    await page.waitForTimeout(300);
    // Check modal overlay has content
    const visible = await page.locator("#modal-overlay").isVisible();
    expect(visible).toBe(true);
    const hasTitle = await page.locator("#modal-overlay:has-text('主题商城')").isVisible();
    expect(hasTitle).toBe(true);
  });

  // ==================== J. Dungeon Layer Overrides ====================

  test("J1) DUNGEON_LAYER_OVERRIDES has 3 entries", async ({ page }) => {
    const count = await page.evaluate(() => {
      return Object.keys(window.DUNGEON_LAYER_OVERRIDES).length;
    });
    expect(count).toBe(3);
  });

  test("J2) Layer overrides include layer 1, 3, 5", async ({ page }) => {
    const layers = await page.evaluate(() => {
      return Object.keys(window.DUNGEON_LAYER_OVERRIDES);
    });
    expect(layers).toContain("1");
    expect(layers).toContain("3");
    expect(layers).toContain("5");
  });

  test("J3) applyLayerOverride merges floor tints", async ({ page }) => {
    const result = await page.evaluate(() => {
      window.themeManager.switch("default");
      const before = window.themeManager.getActive();

      window.themeManager.applyLayerOverride(3);
      const after = window.themeManager.getActive();

      return {
        hasWallTint: !!after.palette.wallTint,
        wallTint: after.palette.wallTint,
        hasFloorTint: !!after.palette.floorTint,
        hasAmbient: !!after.effects.ambientParticles
      };
    });
    expect(result.hasWallTint).toBe(true);
    expect(result.wallTint).toBe("rgba(189, 189, 189, 0.1)");
    expect(result.hasFloorTint).toBe(true);
    expect(result.hasAmbient).toBe(true);
  });

  test("J4) clearLayerOverride removes overrides", async ({ page }) => {
    const result = await page.evaluate(() => {
      window.themeManager.applyLayerOverride(5);
      const withOverride = window.themeManager.getActive();

      window.themeManager.clearLayerOverride();
      const cleared = window.themeManager.getActive();
      return {
        wallTintNull: cleared.palette.wallTint === undefined,
        layerInfoNull: window.themeManager.getLayerOverride() === null
      };
    });
    expect(result.wallTintNull).toBe(true);
    expect(result.layerInfoNull).toBe(true);
  });

  test("J5) Layer override labels and banner colors are set", async ({ page }) => {
    const info = await page.evaluate(() => {
      const o = window.DUNGEON_LAYER_OVERRIDES;
      return {
        layer1: { label: o[1].label, banner: o[1].bannerColor },
        layer3: { label: o[3].label, banner: o[3].bannerColor },
        layer5: { label: o[5].label, banner: o[5].bannerColor }
      };
    });
    expect(info.layer1.banner).toBe("#4caf50");
    expect(info.layer3.label).toContain("骨骼");
    expect(info.layer3.banner).toBe("#bdbdbd");
    expect(info.layer5.label).toBe("虚空核心");
    expect(info.layer5.banner).toBe("#e040fb");
  });

  test("J6) Layer override palette has floorDetail and wallCracks", async ({ page }) => {
    const detail = await page.evaluate(() => {
      const o = window.DUNGEON_LAYER_OVERRIDES;
      return {
        layer1: { floor: o[1].patch.tiles.floorDetail, cracks: o[1].patch.tiles.wallCracks },
        layer3: { floor: o[3].patch.tiles.floorDetail, cracks: o[3].patch.tiles.wallCracks },
        layer5: { floor: o[5].patch.tiles.floorDetail, cracks: o[5].patch.tiles.wallCracks }
      };
    });
    expect(detail.layer1.floor).toBe("moss");
    expect(detail.layer1.cracks).toBe(false);
    expect(detail.layer3.floor).toBe("bones");
    expect(detail.layer3.cracks).toBe(true);
    expect(detail.layer5.floor).toBe("void_crack");
    expect(detail.layer5.cracks).toBe(true);
  });

  // ==================== K. Edge Cases ====================

  test("K1) Switching to locked theme fails", async ({ page }) => {
    const result = await page.evaluate(() => {
      // blood_moon is locked by default
      const ok = window.themeManager.switch("blood_moon");
      return { ok, activeId: window.themeManager.getActiveId() };
    });
    expect(result.ok).toBe(false);
    expect(result.activeId).toBe("default");
  });

  test("K2) Default theme is always unlocked", async ({ page }) => {
    const result = await page.evaluate(() => {
      return {
        classic: window.themeManager.isUnlocked("classic"),
        default: window.themeManager.isUnlocked("default")
      };
    });
    expect(result.classic).toBe(true);
    expect(result.default).toBe(true);
  });

  test("K3) Missing theme falls back to default (classic)", async ({ page }) => {
    const result = await page.evaluate(() => {
      const t = window.themeManager.getTheme("nonexistent_theme");
      const active = window.themeManager.getActive();
      return {
        missingThemeNull: t === null,
        activeName: active.name
      };
    });
    expect(result.missingThemeNull).toBe(true);
    expect(result.activeName).toBe("经典地城");
  });

  test("K4) Unlocking a theme then switching to it succeeds", async ({ page }) => {
    const result = await page.evaluate(() => {
      window.themeManager.unlock("void_core");
      const ok = window.themeManager.switch("void_core");
      return { ok, activeId: window.themeManager.getActiveId() };
    });
    expect(result.ok).toBe(true);
    expect(result.activeId).toBe("void_core");
  });

  test("K5) checkUnlockConditions does not unlock without stats", async ({ page }) => {
    const newly = await page.evaluate(() => {
      return window.themeManager.checkUnlockConditions({});
    });
    expect(newly.length).toBe(0);
  });

  test("K6) CycleTheme skips locked themes", async ({ page }) => {
    // Only classic and pixel_retro unlocked initially
    const sequence = [];
    for (let i = 0; i < 6; i++) {
      await page.click('button[onclick="cycleTheme()"]');
      await page.waitForTimeout(50);
      const id = await page.evaluate(() => window.themeManager.getActiveId());
      sequence.push(id);
    }
    // Should alternate between unlocked themes, never hitting locked ones
    for (const id of sequence) {
      expect(["default", "pixel_retro", "hd_sprites", "blood_moon", "frost_sanctum", "void_core", "cyber_dungeon"]).toContain(id);
      expect(id).not.toBe("blood_moon");
      expect(id).not.toBe("frost_sanctum");
      expect(id).not.toBe("void_core");
      expect(id).not.toBe("cyber_dungeon");
    }
  });

  test("K7) THEME_UNLOCK_CONDITIONS global is accessible", async ({ page }) => {
    const conds = await page.evaluate(() => {
      return window.THEME_UNLOCK_CONDITIONS;
    });
    expect(conds.default).toBe(null);
    expect(conds.blood_moon.type).toBe("deepestFloor");
    expect(conds.pixel_retro.type).toBe("totalPlayTime");
  });

  test("K8) hexToRgb and rgbToHex helpers work", async ({ page }) => {
    const result = await page.evaluate(() => {
      const rgb = hexToRgb("#ff0080");
      const hex = rgbToHex(255, 0, 128);
      const blended = tintBlend("#000000", "#ffffff", 0.5);
      return { rgb, hex, blended };
    });
    expect(result.rgb).toEqual([255, 0, 128]);
    expect(result.hex).toBe("#ff0080");
    expect(result.blended).toBe("#808080");
  });

  // ==================== L. Integration: Full Game Flow ====================

  test("L1) Theme survives entering and leaving dungeon", async ({ page }) => {
    // Switch to pixel_retro
    await page.evaluate(() => window.themeManager.switch("pixel_retro"));
    expect(await page.evaluate(() => window.themeManager.getActiveId())).toBe("pixel_retro");

    // Enter dungeon
    await page.click('button:has-text("选择职业")');
    await page.waitForSelector("#modal-overlay .class-card", { timeout: 5000 });
    await page.evaluate(() => {
      const cards = document.querySelectorAll("#modal-overlay .class-card");
      if (cards[0]) cards[0].click();
    });
    await page.waitForFunction(() => window.gameState && window.gameState.screen === "dungeon");
    await page.waitForTimeout(500);

    // Theme still pixel_retro
    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");

    // Return to title
    await page.evaluate(() => returnToTitle());
    await page.waitForTimeout(500);

    expect(
      await page.evaluate(() => window.themeManager.getActiveId())
    ).toBe("pixel_retro");
  });

  test("L2) Body background changes are visible after switch", async ({ page }) => {
    const bgClassic = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    await page.evaluate(() => {
      window.themeManager.unlock("blood_moon");
      window.themeManager.switch("blood_moon");
    });
    await page.waitForTimeout(200);

    const bgBlood = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    expect(bgBlood).not.toBe(bgClassic);
    // blood_moon bodyBg = #1a0505 -> rgb(26, 5, 5)
    expect(bgBlood).toBe("rgb(26, 5, 5)");
  });

  test("L3) All themes can be unlocked and switched to", async ({ page }) => {
    const stats = { deepestFloor: 10, totalClears: 5, totalPlayTime: 3600, clearsByClass: { mage: 2 } };
    const unlocked = await page.evaluate((stats) => {
      const newIds = window.themeManager.checkUnlockConditions(stats);
      return newIds;
    }, stats);

    // All should now be switchable
    for (const id of ["default", "blood_moon", "frost_sanctum", "void_core", "pixel_retro", "cyber_dungeon", "hd_sprites"]) {
      const result = await page.evaluate((id) => {
        const ok = window.themeManager.switch(id);
        return { ok, activeId: window.themeManager.getActiveId() };
      }, id);
      expect(result.ok).toBe(true);
      expect(result.activeId).toBe(id);
    }
  });
});
