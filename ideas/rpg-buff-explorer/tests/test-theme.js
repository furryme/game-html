// test-theme.js — ThemeManager tests
const { describe, it } = require('./test-runner');

describe('ThemeManager', function () {
  it('registers themes on init', function () {
    var ids = window.themeManager.getAllIds();
    if (ids.indexOf('default') === -1) throw new Error('default theme not registered');
    if (ids.indexOf('blood_moon') === -1) throw new Error('blood_moon theme not registered');
    if (ids.indexOf('pixel_retro') === -1) throw new Error('pixel_retro theme not registered');
  });

  it('getActive returns a merged theme object', function () {
    var active = window.themeManager.getActive();
    if (!active.palette) throw new Error('active theme missing palette');
    if (!active.effects) throw new Error('active theme missing effects');
    if (!active.ui) throw new Error('active theme missing ui');
    if (!active.audio) throw new Error('active theme missing audio');
  });

  it('default theme palette matches current game colors', function () {
    var tm = window.themeManager;
    tm.switch('default');
    var p = tm.getActive().palette;
    if (p.void !== PAL.void) throw new Error('void color mismatch: ' + p.void + ' !== ' + PAL.void);
    if (p.red !== PAL.red) throw new Error('red color mismatch');
    if (p.blue !== PAL.blue) throw new Error('blue color mismatch');
    if (p.gold !== PAL.gold) throw new Error('gold color mismatch');
    if (p.crimson !== PAL.crimson) throw new Error('crimson color mismatch');
  });

  it('switch to blood_moon changes palette', function () {
    window.themeManager.unlock('blood_moon');
    window.themeManager.switch('blood_moon');
    var p = window.themeManager.getActive().palette;
    if (p.void === PAL.void) throw new Error('blood_moon void should differ from default');
    if (p.red === PAL.red) throw new Error('blood_moon red should differ from default');
  });

  it('switch to pixel_retro changes palette', function () {
    window.themeManager.switch('pixel_retro');
    var p = window.themeManager.getActive().palette;
    if (p.bodyBg === PAL.void) throw new Error('pixel_retro bodyBg should differ from default');
  });

  it('blood_moon effects have glowEnabled true', function () {
    window.themeManager.unlock('blood_moon');
    window.themeManager.switch('blood_moon');
    var e = window.themeManager.getActive().effects;
    if (!e.glowEnabled) throw new Error('blood_moon should have glowEnabled');
    if (e.shakeMultiplier <= 1) throw new Error('blood_moon shakeMultiplier should be > 1');
    if (e.particleShape !== 'crescent') throw new Error('blood_moon particleShape should be crescent');
  });

  it('pixel_retro effects reduce particle count', function () {
    window.themeManager.switch('pixel_retro');
    var e = window.themeManager.getActive().effects;
    if (e.glowEnabled) throw new Error('pixel_retro should have glowEnabled false');
    if (e.particleCountMultiplier >= 1) throw new Error('pixel_retro particleCountMultiplier should be < 1');
    if (e.particleShape !== 'square') throw new Error('pixel_retro particleShape should be square');
  });

  it('pixel_retro audio has filter override', function () {
    window.themeManager.switch('pixel_retro');
    var a = window.themeManager.getActive().audio;
    if (a.filterType !== 'lowpass') throw new Error('pixel_retro filterType should be lowpass');
    if (a.waveformOverride !== 'square') throw new Error('pixel_retro waveformOverride should be square');
  });

  it('blood_moon audio overrides waveform', function () {
    window.themeManager.unlock('blood_moon');
    window.themeManager.switch('blood_moon');
    var a = window.themeManager.getActive().audio;
    if (a.waveformOverride !== 'sawtooth') throw new Error('blood_moon waveformOverride should be sawtooth');
  });

  it('applyLayerOverride tints palette colors', function () {
    window.themeManager.switch('default');
    window.themeManager.applyLayerOverride(3, '#5a2a2a');
    var p = window.themeManager.getActive().palette;
    var orig = window.themeManager.getTheme('default').palette;
    if (p.void === orig.void) throw new Error('layer override should tint void color');
    window.themeManager.applyLayerOverride(3, null);
  });

  it('isUnlocked returns true for default and pixel_retro', function () {
    if (!window.themeManager.isUnlocked('default')) throw new Error('default should be unlocked');
    if (!window.themeManager.isUnlocked('pixel_retro')) throw new Error('pixel_retro should be unlocked by default');
  });

  it('isUnlocked returns false for blood_moon before unlock', function () {
    localStorage._data['rpg_buff_theme_unlocks'] = '{}';
    if (window.themeManager.isUnlocked('blood_moon')) throw new Error('blood_moon should be locked');
  });

  it('unlock unlocks the theme', function () {
    window.themeManager.unlock('blood_moon');
    if (!window.themeManager.isUnlocked('blood_moon')) throw new Error('blood_moon should be unlocked');
  });

  it('switch fails for locked theme', function () {
    localStorage._data['rpg_buff_theme_unlocks'] = '{"pixel_retro":true}';
    var result = window.themeManager.switch('blood_moon');
    if (result !== false) throw new Error('switch to locked theme should return false');
  });

  it('switch persists active theme', function () {
    window.themeManager.switch('pixel_retro');
    var raw = localStorage.getItem('rpg_buff_theme');
    if (!raw) throw new Error('theme state should be saved');
    var data = JSON.parse(raw);
    if (data.active !== 'pixel_retro') throw new Error('saved active theme should be pixel_retro');
  });

  it('getActiveId returns correct id', function () {
    window.themeManager.switch('default');
    if (window.themeManager.getActiveId() !== 'default') throw new Error('active id should be default');
    window.themeManager.switch('pixel_retro');
    if (window.themeManager.getActiveId() !== 'pixel_retro') throw new Error('active id should be pixel_retro');
  });

  it('register adds a custom theme', function () {
    window.themeManager.register('test_theme', {
      id: 'test_theme',
      name: 'Test',
      palette: { void: '#ff00ff' },
    });
    var t = window.themeManager.getTheme('test_theme');
    if (!t) throw new Error('test_theme not found');
    if (t.palette.void !== '#ff00ff') throw new Error('test_theme void color wrong');
    if (!t.effects) throw new Error('custom theme should inherit effects from base');
  });
});

describe('Theme Persistence', function () {
  it('loadThemeUnlocks returns pixel_retro unlocked', function () {
    var unlocks = loadThemeUnlocks();
    if (!unlocks.pixel_retro) throw new Error('pixel_retro should be unlocked by default');
  });

  it('unlockTheme persists to localStorage', function () {
    unlockTheme('blood_moon');
    var unlocks = loadThemeUnlocks();
    if (!unlocks.blood_moon) throw new Error('blood_moon should be unlocked in persistence');
  });

  it('checkThemeUnlocks at floor 3 unlocks blood_moon', function () {
    localStorage._data['rpg_buff_theme_unlocks'] = '{"pixel_retro":true}';
    checkThemeUnlocks(3);
    var unlocks = loadThemeUnlocks();
    if (!unlocks.blood_moon) throw new Error('blood_moon should be unlocked at floor 3');
  });

  it('checkThemeUnlocks at floor 1 does not unlock blood_moon', function () {
    localStorage._data['rpg_buff_theme_unlocks'] = '{"pixel_retro":true}';
    checkThemeUnlocks(1);
    var unlocks = loadThemeUnlocks();
    if (unlocks.blood_moon) throw new Error('blood_moon should NOT be unlocked at floor 1');
  });
});

describe('Theme helper functions', function () {
  it('hexToRgb converts correctly', function () {
    var rgb = hexToRgb('#ff0080');
    if (rgb[0] !== 255 || rgb[1] !== 0 || rgb[2] !== 128) throw new Error('hexToRgb failed');
  });

  it('rgbToHex converts correctly', function () {
    var hex = rgbToHex(255, 0, 128);
    if (hex !== '#ff0080') throw new Error('rgbToHex failed: ' + hex);
  });

  it('tintBlend blends two colors', function () {
    var blended = tintBlend('#000000', '#ffffff', 0.5);
    if (blended !== '#808080') throw new Error('tintBlend failed: ' + blended);
  });
});
