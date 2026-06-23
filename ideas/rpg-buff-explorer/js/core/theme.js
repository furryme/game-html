// theme.js — ThemeManager engine for visual customization
// Full 6-module theme system: palette, sprites, tiles, ui, effects, audio
// Source of truth: 主题系统.md

// =================== Color Utilities ===================

function hexToRgb(hex) {
  hex = (hex || '#000').replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return [parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16)];
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(function(c) {
    var h = Math.max(0,Math.min(255,Math.round(c))).toString(16);
    return h.length < 2 ? '0'+h : h;
  }).join('');
}

function tintBlend(baseHex, tintHex, tintPct) {
  var b = hexToRgb(baseHex);
  var t = hexToRgb(tintHex);
  return rgbToHex(
    b[0] + (t[0]-b[0]) * tintPct,
    b[1] + (t[1]-b[1]) * tintPct,
    b[2] + (t[2]-b[2]) * tintPct
  );
}

// =================== THEME_UNLOCK_CONDITIONS ===================

var THEME_UNLOCK_CONDITIONS = {
  default: null,
  pixel_retro: { type: 'totalPlayTime', value: 1800 },
  blood_moon: { type: 'deepestFloor', value: 3 },
  cyber_dungeon: { type: 'clearsByClass', cls: 'mage', value: 1 },
  frost_sanctum: { type: 'totalClears', value: 1 },
  void_core: { type: 'totalClears', value: 3 }
};

// =================== BASE_THEME (classic) ===================
// Design doc section 1.1: full 6-module definition
// All derived themes inherit from here, overriding only differences.

var BASE_THEME = {
  id: 'classic',
  name: '经典地城',
  rarity: 'common',
  unlockCondition: null,

  // --- Module 1: Palette ---
  palette: {
    // Background
    bgDeep:        '#0a0a14',
    bgGame:        '#10101c',
    bgSurface:     '#1a1a2e',

    // Map tiles
    wallDark:      '#2a2a3e',
    wallLight:     '#333349',
    floorDark:     '#1e1e30',
    floorLight:    '#222238',
    corridor:      '#1c1c2e',

    // UI colors
    textPrimary:   '#e0e0e0',
    textSecondary: '#8888aa',
    textMuted:     '#555566',
    gold:          '#f0c040',
    danger:        '#e53935',
    heal:          '#66bb6a',
    magic:         '#7c4dff',
    info:          '#64b5f6',

    // Functional
    overlayBg:     'rgba(10,10,20,0.88)',
    borderSubtle:  'rgba(255,255,255,0.08)',
    borderActive:  'rgba(255,255,255,0.2)',

    // Class colors
    classColors: {
      warrior: '#e53935',
      mage:    '#7c4dff',
      rogue:   '#66bb6a'
    },

    // Backward-compatible keys (read by existing render code)
    void:          '#0a0a1a',
    dark:          '#1a1a2e',
    midDark:       '#2a2a4a',
    grayDk:        '#3a3a5a',
    gray:          '#6a6a8a',
    grayLt:        '#9a9aba',
    light:         '#cadabd',
    white:         '#e8e8e8',
    skin:          '#e8b890',
    skinShd:       '#c89060',
    red:           '#d43',
    redDk:         '#922',
    blue:          '#35c',
    blueDk:        '#238',
    green:         '#4a4',
    greenDk:       '#373',
    gold:          '#f0c040',
    steel:         '#a0b0c0',
    brown:         '#8b5a3b',
    brownDk:       '#5a3a1f',
    stone:         '#5a5a6a',
    stoneLt:       '#7a7a8a',
    bone:          '#c8c0b0',
    crimson:       '#ff4444',
    cyan:          '#00e5ff',
    magenta:       '#d500f9',
    orange:        '#f7971e',
    emerald:       '#2ecc71',
    violet:        '#6c5ce7',
    eye:           '#202030',
    minimapBorder: '#5a4a3a',
    minimapBg:     '#0a0a14',
    playerDotA:    '#ffffff',
    playerDotB:    '#aaccff',
    fogOverlay:    '#000000',
    unseenFill:    '#000000',
    bodyBg:        '#0d0d1a',
    textPrimary:   '#e0e0e0',
    headerGold:    '#d4a855',
    panelBg:       'rgba(13, 13, 26, 0.92)',
    logInfo:       '#5b9bd5',
    logLoot:       '#f0c040',
    logDmg:        '#e74c3c',
    logHeal:       '#2ecc71',

    // Aliases for render.js (reads theme.wall, theme.floor)
    wall:          '#2a2a3e',
    floor:         '#1e1e30'
  },

  // --- Module 2: Sprites ---
  sprites: {
    playerGlow:    { warrior: '#e53935', mage: '#7c4dff', rogue: '#66bb6a' },
    enemyHueShift: 0,
    particleStyle: 'circle',
    particleTrail: false,
    floatFont:     'bold',
    stairIcon:     '🚪',
    stairGlow:     '#ffd700',
    itemBounce:    true
  },

  // --- Module 3: Tiles ---
  tiles: {
    wallStyle:        'bricks',
    floorStyle:       'checker',
    corridorStyle:    'solid',
    viewRadius:       3,
    fogColor:         '#050510',
    revealedDarkness: 0.4
  },

  // --- Module 4: UI ---
  ui: {
    borderRadiusSm: 4,
    borderRadiusMd: 8,
    borderRadiusLg: 12,
    buttonStyle:     'gradient',
    buttonGradient:  'linear-gradient(135deg, #ffd700, #f0a500)',
    buttonTextColor: '#1a1a1a',
    hpBarGrad:       'linear-gradient(90deg, #e53935, #66bb6a)',
    mpBarGrad:       'linear-gradient(90deg, #1565c0, #42a5f5)',
    expBarGrad:      'linear-gradient(90deg, #f9a825, #ffd740)',
    barBg:           '#1a1a2e',
    logDmg:          '#ef5350',
    logHeal:         '#66bb6a',
    logInfo:         '#64b5f6',
    logLoot:         '#ffd740',
    logSkill:        '#ce93d8',
    rarityColors: {
      common:   '#aaaaaa',
      uncommon: '#66bb6a',
      rare:     '#64b5f6',
      epic:     '#ce93d8',
      legend:   '#ffd700'
    },
    // Backward-compatible
    borderRadius: 0,
    fontScale:    1,
    glowEnabled:  false,
    scanlines:    true
  },

  // --- Module 5: Effects ---
  effects: {
    glowBlur:             10,
    glowIntensity:        0.6,
    shakeAmplitude:       8,
    shakeOnCombo:         false,
    particleCountMult:    1.0,
    particleDecay:        0.025,
    floatDuration:        1000,
    transitionDuration:   300,
    floorBannerBg:        'rgba(0,0,0,0.85)',
    // Backward-compatible
    particleShape:           'square',
    glowEnabled:             false,
    glowColor:               'rgba(0,0,0,0)',
    shakeMultiplier:         1,
    particleCountMultiplier: 1,
    particleLifeMultiplier:  1,
    bossAuraColor:           'rgba(200,30,30,0.3)'
  },

  // --- Module 6: Audio ---
  audio: {
    tone:    'dark',
    bpm:     120,
    hitSound: 'metal',
    // Backward-compatible
    filterType:       null,
    filterFreq:       null,
    waveformOverride: null
  }
};

// =================== Derived Theme Definitions ===================
// Each is a PARTIAL override of BASE_THEME (only differing fields).
// Design doc section 2.2

// --- Theme 2: Blood Moon ---
var BLOOD_MOON_THEME = {
  id: 'blood_moon',
  name: '血月之夜',
  rarity: 'rare',
  unlockCondition: { type: 'deepestFloor', value: 3 },

  palette: {
    bgDeep: '#1a0a0a', bgGame: '#2a0f0f', bgSurface: '#3e1515',
    wallDark: '#3e1a1a', wallLight: '#4d2222',
    floorDark: '#2e1414', floorLight: '#361818', corridor: '#2a1010',
    textPrimary: '#c0a090', textSecondary: '#8a6a6a', textMuted: '#5a3a3a',
    gold: '#ff6e42', danger: '#ff1744',
    overlayBg: 'rgba(26,10,10,0.92)',
    borderSubtle: 'rgba(255,100,80,0.08)',
    borderActive: 'rgba(255,80,60,0.25)',
    classColors: { warrior: '#ff5252', mage: '#7c4dff', rogue: '#66bb6a' },
    // Backward-compatible overrides
    void: '#1a0505', dark: '#2a0a0a', midDark: '#4a1a1a',
    grayDk: '#5a2a2a', gray: '#8a4a4a', grayLt: '#ba7a7a',
    light: '#dda0a0', red: '#ff3333', redDk: '#cc1111',
    crimson: '#ff2222', bodyBg: '#1a0505',
    headerGold: '#c4a040', panelBg: 'rgba(26, 5, 5, 0.92)',
    minimapBg: '#1a0808', minimapBorder: '#5a2a1a',
    fogOverlay: '#1a0000', unseenFill: '#0a0000',
    logInfo: '#8a6a8a', logDmg: '#ff4444',
    wall: '#3e1a1a', floor: '#2e1414'
  },

  sprites: {
    particleStyle: 'star',
    particleTrail: true,
    enemyHueShift: -30,
    floatFont: 'bold'
  },

  tiles: {
    wallStyle: 'cave',
    floorStyle: 'cracked',
    corridorStyle: 'dashed'
  },

  ui: {
    buttonStyle: 'flat',
    buttonGradient: '#d32f2f',
    buttonTextColor: '#ffffff',
    hpBarGrad: 'linear-gradient(90deg, #b71c1c, #ff5252)',
    logDmg: '#ff4444',
    logSkill: '#e91e63'
  },

  effects: {
    glowBlur: 14,
    shakeAmplitude: 12,
    particleCountMult: 1.3,
    particleDecay: 0.022,
    glowEnabled: true,
    glowColor: 'rgba(180,20,20,0.35)',
    shakeMultiplier: 1.3,
    particleCountMultiplier: 1.3,
    particleLifeMultiplier: 1.1,
    particleShape: 'crescent',
    bossAuraColor: 'rgba(220,20,20,0.4)'
  },

  audio: {
    hitSound: 'stone',
    waveformOverride: 'sawtooth'
  }
};

// --- Theme 3: Frost Sanctum ---
var FROST_SANCTUM_THEME = {
  id: 'frost_sanctum',
  name: '冰盈圣殿',
  rarity: 'epic',
  unlockCondition: { type: 'totalClears', value: 1 },

  palette: {
    bgDeep: '#0a0e1a', bgGame: '#101830', bgSurface: '#162040',
    wallDark: '#1a2a4a', wallLight: '#223366',
    floorDark: '#162040', floorLight: '#1a2850', corridor: '#121c38',
    textPrimary: '#c8d8f0', textSecondary: '#7090b0', textMuted: '#406080',
    gold: '#80deea', danger: '#ff5252', magic: '#40c4ff', info: '#80deea',
    overlayBg: 'rgba(10,14,26,0.9)',
    borderSubtle: 'rgba(100,180,255,0.08)',
    borderActive: 'rgba(64,196,255,0.25)',
    classColors: { warrior: '#ef5350', mage: '#40c4ff', rogue: '#66bb6a' },
    // Backward-compatible overrides
    void: '#0a0e1a', dark: '#101830', midDark: '#162040',
    grayDk: '#1a2850', gray: '#284060', grayLt: '#406888',
    light: '#80b0d0', blue: '#40c4ff', blueDk: '#1565c0',
    cyan: '#80deea', bodyBg: '#0a0e1a',
    headerGold: '#80deea', panelBg: 'rgba(10, 14, 26, 0.92)',
    minimapBg: '#080c18', minimapBorder: '#1a3050',
    fogOverlay: '#050a15', unseenFill: '#020510',
    logInfo: '#80deea', logDmg: '#ff8a80', logHeal: '#b2dfdb', logLoot: '#ffd740',
    wall: '#1a2a4a', floor: '#162040'
  },

  sprites: {
    particleStyle: 'square',
    playerGlow: { warrior: '#ef5350', mage: '#40c4ff', rogue: '#66bb6a' },
    stairGlow: '#80deea',
    floatFont: 'thin'
  },

  tiles: {
    wallStyle: 'bricks',
    floorStyle: 'dots',
    corridorStyle: 'solid',
    revealedDarkness: 0.35
  },

  ui: {
    borderRadiusSm: 2,
    borderRadiusMd: 4,
    borderRadiusLg: 6,
    buttonStyle: 'gradient',
    buttonGradient: 'linear-gradient(135deg, #40c4ff, #0088cc)',
    buttonTextColor: '#ffffff',
    hpBarGrad: 'linear-gradient(90deg, #40c4ff, #80deea)',
    mpBarGrad: 'linear-gradient(90deg, #1565c0, #40c4ff)',
    expBarGrad: 'linear-gradient(90deg, #80deea, #b2ebf2)',
    barBg: '#0a1830',
    logDmg: '#ff8a80',
    logHeal: '#b2dfdb',
    logInfo: '#80deea',
    logLoot: '#ffd740',
    logSkill: '#82b1ff'
  },

  effects: {
    glowBlur: 16,
    shakeAmplitude: 6,
    particleCountMult: 1.5,
    particleDecay: 0.015,
    floatDuration: 1200,
    glowEnabled: true,
    glowColor: 'rgba(64,196,255,0.3)',
    shakeMultiplier: 0.8,
    particleCountMultiplier: 1.5,
    particleLifeMultiplier: 1.4,
    particleShape: 'square',
    bossAuraColor: 'rgba(64,196,255,0.3)'
  },

  audio: {
    tone: 'bright',
    bpm: 140,
    hitSound: 'stone'
  }
};

// --- Theme 4: Void Core ---
var VOID_CORE_THEME = {
  id: 'void_core',
  name: '虚空核心',
  rarity: 'legend',
  unlockCondition: { type: 'totalClears', value: 3 },

  palette: {
    bgDeep: '#05000a', bgGame: '#0d0618', bgSurface: '#1a0a2e',
    wallDark: '#1a0a2e', wallLight: '#261444',
    floorDark: '#120820', floorLight: '#1a0c2e', corridor: '#0e0618',
    textPrimary: '#d0b0f0', textSecondary: '#9070b0', textMuted: '#503060',
    gold: '#e040fb', danger: '#ff1744', magic: '#d500f9', info: '#b388ff',
    overlayBg: 'rgba(5,0,10,0.92)',
    borderSubtle: 'rgba(213,0,249,0.08)',
    borderActive: 'rgba(224,64,251,0.3)',
    classColors: { warrior: '#ff5252', mage: '#d500f9', rogue: '#69f0ae' },
    // Backward-compatible overrides
    void: '#05000a', dark: '#0d0618', midDark: '#1a0a2e',
    grayDk: '#261444', gray: '#503070', grayLt: '#8060a0',
    light: '#c0a0e0', violet: '#d500f9', magenta: '#e040fb',
    crimson: '#ff1744', bodyBg: '#05000a',
    headerGold: '#e040fb', panelBg: 'rgba(5, 0, 10, 0.92)',
    minimapBg: '#040008', minimapBorder: '#2a1050',
    fogOverlay: '#030008', unseenFill: '#010004',
    logInfo: '#b388ff', logDmg: '#ff4081', logHeal: '#69f0ae', logLoot: '#e040fb',
    wall: '#1a0a2e', floor: '#120820'
  },

  sprites: {
    particleStyle: 'star',
    particleTrail: true,
    enemyHueShift: 180,
    floatFont: 'pixel'
  },

  tiles: {
    wallStyle: 'cave',
    floorStyle: 'smooth',
    corridorStyle: 'dashed',
    revealedDarkness: 0.5
  },

  ui: {
    borderRadiusSm: 6,
    borderRadiusMd: 10,
    borderRadiusLg: 16,
    buttonStyle: 'outlined',
    buttonGradient: 'transparent',
    buttonTextColor: '#e040fb',
    hpBarGrad: 'linear-gradient(90deg, #d500f9, #e040fb)',
    mpBarGrad: 'linear-gradient(90deg, #7c4dff, #b388ff)',
    expBarGrad: 'linear-gradient(90deg, #e040fb, #ff80ab)',
    barBg: '#0a0018',
    logDmg: '#ff4081',
    logHeal: '#69f0ae',
    logInfo: '#b388ff',
    logLoot: '#e040fb',
    logSkill: '#ea80fc'
  },

  effects: {
    glowBlur: 20,
    shakeAmplitude: 10,
    particleCountMult: 2.0,
    particleDecay: 0.02,
    floatDuration: 1400,
    glowEnabled: true,
    glowColor: 'rgba(213,0,249,0.4)',
    shakeMultiplier: 1.5,
    particleCountMultiplier: 2.0,
    particleLifeMultiplier: 1.2,
    particleShape: 'star',
    bossAuraColor: 'rgba(213,0,249,0.45)'
  },

  audio: {
    tone: 'hollow',
    bpm: 100,
    hitSound: 'stone'
  }
};

// --- Theme 5: Pixel Retro ---
var PIXEL_RETRO_THEME = {
  id: 'pixel_retro',
  name: '像素复古',
  rarity: 'common',
  unlockCondition: { type: 'totalPlayTime', value: 1800 },

  palette: {
    bgDeep: '#0f0f0f', bgGame: '#1a1a1a', bgSurface: '#2a2a2a',
    wallDark: '#555555', wallLight: '#777777',
    floorDark: '#333333', floorLight: '#444444', corridor: '#2e2e2e',
    textPrimary: '#cccccc', textSecondary: '#888888', textMuted: '#555555',
    gold: '#ffff55', danger: '#e03030', heal: '#30c040', magic: '#3080e0', info: '#6888a8',
    overlayBg: 'rgba(15,15,15,0.9)',
    borderSubtle: 'rgba(200,200,200,0.1)',
    borderActive: 'rgba(255,255,85,0.3)',
    classColors: { warrior: '#e03030', mage: '#3080e0', rogue: '#30c040' },
    // Backward-compatible overrides
    void: '#0c0c1e', dark: '#181830', midDark: '#282848',
    grayDk: '#383858', gray: '#686888', grayLt: '#9898b8',
    light: '#c8c8d8', white: '#e0e0e0',
    red: '#e03030', redDk: '#a02020',
    blue: '#3080e0', blueDk: '#2060a0',
    green: '#30c040', greenDk: '#208028',
    steel: '#a0a8c0', brown: '#884828', brownDk: '#583818',
    stone: '#585878', stoneLt: '#787898', bone: '#c0b8a8',
    crimson: '#e82020', cyan: '#00c8e8', magenta: '#c800e0',
    orange: '#e88818', emerald: '#20b860', violet: '#6048c8',
    bodyBg: '#0c0c1e', headerGold: '#d8b850',
    panelBg: 'rgba(12, 12, 30, 0.92)',
    minimapBg: '#080818', minimapBorder: '#484868',
    fogOverlay: '#080818', unseenFill: '#000008',
    logInfo: '#6888a8', logLoot: '#e8b830', logDmg: '#d03030', logHeal: '#30b040',
    wall: '#555555', floor: '#333333'
  },

  sprites: {
    particleStyle: 'pixel',
    floatFont: 'pixel',
    itemBounce: false
  },

  tiles: {
    wallStyle: 'solid',
    floorStyle: 'smooth',
    viewRadius: 2
  },

  ui: {
    borderRadiusSm: 0,
    borderRadiusMd: 0,
    borderRadiusLg: 0,
    buttonStyle: 'flat',
    buttonGradient: '#ffff55',
    buttonTextColor: '#000000',
    hpBarGrad: '#e03030',
    mpBarGrad: '#3080e0',
    expBarGrad: '#ffff55',
    barBg: '#1a1a1a',
    logDmg: '#d03030',
    logHeal: '#30b040',
    logInfo: '#6888a8',
    logLoot: '#e8b830',
    logSkill: '#8850c0',
    borderRadius: 0,
    fontScale: 1,
    scanlines: true
  },

  effects: {
    glowBlur: 0,
    shakeAmplitude: 4,
    particleCountMult: 0.5,
    floatDuration: 1500,
    glowEnabled: false,
    glowColor: 'rgba(0,0,0,0)',
    shakeMultiplier: 0.8,
    particleCountMultiplier: 0.5,
    particleLifeMultiplier: 1.2,
    particleShape: 'square',
    bossAuraColor: 'rgba(160,20,20,0.25)'
  },

  audio: {
    tone: 'bright',
    bpm: 160,
    hitSound: 'wood',
    filterType: 'lowpass',
    filterFreq: 3000,
    waveformOverride: 'square'
  }
};

// --- Theme 6: Cyber Dungeon ---
var CYBER_DUNGEON_THEME = {
  id: 'cyber_dungeon',
  name: '赛博地猛',
  rarity: 'rare',
  unlockCondition: { type: 'clearsByClass', cls: 'mage', value: 1 },

  palette: {
    bgDeep: '#0a0a12', bgGame: '#0c1018', bgSurface: '#0a1628',
    wallDark: '#0a1628', wallLight: '#102040',
    floorDark: '#0c1a2e', floorLight: '#102038', corridor: '#081420',
    textPrimary: '#c0e0d0', textSecondary: '#40c0a0', textMuted: '#1a5040',
    gold: '#00ff88', danger: '#ff0044', heal: '#00e676', magic: '#00e5ff', info: '#00bcd4',
    overlayBg: 'rgba(10,10,18,0.92)',
    borderSubtle: 'rgba(0,229,255,0.08)',
    borderActive: 'rgba(0,255,136,0.3)',
    classColors: { warrior: '#ff0044', mage: '#00e5ff', rogue: '#00ff88' },
    // Backward-compatible overrides
    void: '#0a0a12', dark: '#0c1018', midDark: '#0a1628',
    grayDk: '#102040', gray: '#204060', grayLt: '#408080',
    light: '#80c0b0', cyan: '#00ff88',
    bodyBg: '#0a0a12', headerGold: '#00ff88',
    panelBg: 'rgba(10, 10, 18, 0.92)',
    minimapBg: '#060610', minimapBorder: '#0a3040',
    fogOverlay: '#040410', unseenFill: '#020208',
    logInfo: '#00bcd4', logDmg: '#ff0044', logHeal: '#00e676', logLoot: '#00ff88',
    wall: '#0a1628', floor: '#0c1a2e'
  },

  sprites: {
    particleStyle: 'square',
    particleTrail: true,
    playerGlow: { warrior: '#ff0044', mage: '#00e5ff', rogue: '#00ff88' },
    stairGlow: '#00ff88',
    floatFont: 'bold'
  },

  tiles: {
    wallStyle: 'bricks',
    floorStyle: 'dots',
    corridorStyle: 'dashed'
  },

  ui: {
    borderRadiusSm: 2,
    borderRadiusMd: 4,
    borderRadiusLg: 8,
    buttonStyle: 'outlined',
    buttonGradient: 'transparent',
    buttonTextColor: '#00e5ff',
    hpBarGrad: 'linear-gradient(90deg, #ff0044, #ff6e00)',
    mpBarGrad: 'linear-gradient(90deg, #00bcd4, #00e5ff)',
    expBarGrad: 'linear-gradient(90deg, #00ff88, #69f0ae)',
    barBg: '#060a10',
    logDmg: '#ff0044',
    logHeal: '#00e676',
    logInfo: '#00bcd4',
    logLoot: '#00ff88',
    logSkill: '#00e5ff'
  },

  effects: {
    glowBlur: 12,
    shakeAmplitude: 6,
    particleCountMult: 1.2,
    particleDecay: 0.02,
    glowEnabled: true,
    glowColor: 'rgba(0,229,255,0.35)',
    shakeMultiplier: 1.0,
    particleCountMultiplier: 1.2,
    particleLifeMultiplier: 1.3,
    particleShape: 'square',
    bossAuraColor: 'rgba(0,229,255,0.3)'
  },

  audio: {
    tone: 'hollow',
    bpm: 130,
    hitSound: 'metal'
  }
};

// =================== FLOOR_TINTS (legacy) ===================
// Kept for backward compatibility with old code that reads it directly.

var FLOOR_TINTS = {
  1: null,
  2: '#4a5a3a',
  3: '#5a2a2a',
  4: '#3a2a5a',
  5: '#5a4a2a'
};

// =================== DUNGEON_LAYER_OVERRIDES ===================
// Design doc section 3.3
// Floor range mapping: layer 1 = floors 1-2, layer 3 = floors 3-4, layer 5 = floor 5

var DUNGEON_LAYER_OVERRIDES = {
  1: {
    patch: {
      palette: {
        wallTint: 'rgba(46, 125, 50, 0.15)',
        floorTint: 'rgba(27, 94, 32, 0.1)',
        ambientParticle: 'rgba(129, 199, 132, 0.3)'
      },
      tiles: {
        floorDetail: 'moss',
        wallCracks: false
      },
      effects: {
        ambientParticles: true,
        ambientParticleCount: 5
      }
    },
    label: '青苔回廊',
    bannerColor: '#4caf50'
  },

  3: {
    patch: {
      palette: {
        wallTint: 'rgba(189, 189, 189, 0.1)',
        floorTint: 'rgba(120, 80, 80, 0.08)',
        ambientParticle: 'rgba(255, 255, 255, 0.15)'
      },
      tiles: {
        floorDetail: 'bones',
        wallCracks: true
      },
      effects: {
        ambientParticles: true,
        ambientParticleCount: 3
      }
    },
    label: '骨骼 Crypt',
    bannerColor: '#bdbdbd'
  },

  5: {
    patch: {
      palette: {
        wallTint: 'rgba(156, 39, 176, 0.2)',
        floorTint: 'rgba(244, 67, 54, 0.1)',
        ambientParticle: 'rgba(234, 128, 252, 0.4)'
      },
      tiles: {
        floorDetail: 'void_crack',
        wallCracks: true
      },
      effects: {
        ambientParticles: true,
        ambientParticleCount: 8
      }
    },
    label: '虚空核心',
    bannerColor: '#e040fb'
  }
};

// =================== ThemeManager (IIFE) ===================

var ThemeManager = (function () {
  var themes = {};
  var activeId = 'default';
  var _layerOverride = null;
  var _equippedModules = {};
  var STORAGE_KEY = 'rpg_buff_theme';
  var UNLOCK_KEY = 'rpg_buff_theme_unlocks';

  var _themeDefs = [
    BASE_THEME,
    BLOOD_MOON_THEME,
    FROST_SANCTUM_THEME,
    VOID_CORE_THEME,
    PIXEL_RETRO_THEME,
    CYBER_DUNGEON_THEME
  ];

  // --- Deep merge ---
  function deepMerge(target, source) {
    if (!source) return target;
    var result = Object.assign({}, target);
    for (var key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
          target[key] && typeof target[key] === 'object') {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // --- Floor-to-layer mapping ---
  function floorToLayer(floorNum) {
    if (floorNum >= 5) return 5;
    if (floorNum >= 3) return 3;
    return 1;
  }

  // --- CSS variable application ---
  function _applyCSS(t) {
    var root = document.documentElement;
    if (!root) return;
    var s = root.style;

    // palette -> --tp-*
    var p = t.palette;
    if (p) {
      // 1. Skip nested objects (classColors, rarityColors handled below)
      for (var k in p) {
        var v = p[k];
        if (v && typeof v === 'object') continue;
        s.setProperty('--tp-' + k, v);
      }

      // 2. classColors -> --tp-class-*
      var cc = p.classColors;
      if (cc && typeof cc === 'object') {
        s.setProperty('--tp-class-warrior', cc.warrior || '');
        s.setProperty('--tp-class-mage', cc.mage || '');
        s.setProperty('--tp-class-rogue', cc.rogue || '');
      }

      // Derived: --tp-header maps to headerGold (used by components.css)
      s.setProperty('--tp-header', p.headerGold || p.gold || '');
    }

    // ui -> --tu-*
    var u = t.ui;
    if (u) {
      // 1. Skip nested objects
      for (var k in u) {
        var v = u[k];
        if (v && typeof v === 'object') continue;
        s.setProperty('--tu-' + k, v);
      }

      // 2. borderRadius* -> --tu-radius-sm/md/lg
      s.setProperty('--tu-radius-sm', (u.borderRadiusSm != null ? u.borderRadiusSm + 'px' : ''));
      s.setProperty('--tu-radius-md', (u.borderRadiusMd != null ? u.borderRadiusMd + 'px' : ''));
      s.setProperty('--tu-radius-lg', (u.borderRadiusLg != null ? u.borderRadiusLg + 'px' : ''));

      // 3. Legacy --tu-radius (scalar, kept for backward compat)
      s.setProperty('--tu-radius', (u.borderRadius != null ? u.borderRadius + 'px' : '0'));

      // 4. Gradient / bar vars (explicit naming)
      s.setProperty('--tu-button-gradient', u.buttonGradient || '');
      s.setProperty('--tu-button-text', u.buttonTextColor || '');
      s.setProperty('--tu-hp-grad', u.hpBarGrad || '');
      s.setProperty('--tu-mp-grad', u.mpBarGrad || '');
      s.setProperty('--tu-exp-grad', u.expBarGrad || '');
      s.setProperty('--tu-bar-bg', u.barBg || '');

      // 5. rarityColors -> --tu-rarity-*
      var rc = u.rarityColors;
      if (rc && typeof rc === 'object') {
        s.setProperty('--tu-rarity-common', rc.common || '');
        s.setProperty('--tu-rarity-uncommon', rc.uncommon || '');
        s.setProperty('--tu-rarity-rare', rc.rare || '');
        s.setProperty('--tu-rarity-epic', rc.epic || '');
        s.setProperty('--tu-rarity-legend', rc.legend || '');
      }
    }

    // effects -> --te-*
    var e = t.effects;
    if (e) {
      for (var k in e) {
        var v = e[k];
        if (v && typeof v === 'object') continue;
        s.setProperty('--te-' + k, v);
      }
    }

    // Body background and text color (direct DOM update for immediate visibility)
    if (p && document.body) {
      document.body.style.background = p.bodyBg || '';
      document.body.style.color = p.textPrimary || '';
    }
  }

  // --- Canvas theme application ---
  function _applyCanvas(t) {
    if (window.refreshCanvasTheme) {
      window.refreshCanvasTheme();
    }
  }

  // --- Audio theme application ---
  function _applyAudio(t) {
    if (window.refreshAudioTheme) {
      window.refreshAudioTheme();
    }
  }

  // --- Sprite asset management ---
  function _applySpriteAssets(t) {
    var sa = t.spriteAssets;
    if (sa && sa.enabled && window.SpriteLoader) {
      if (!window.currentSpriteLoader || window.currentSpriteLoader._manifest !== sa.manifest) {
        window.currentSpriteLoader = new window.SpriteLoader();
        window.currentSpriteLoader.load(sa.manifest, sa.basePath);
      }
    } else {
      // Clear sprite loader when not enabled or unavailable
      window.currentSpriteLoader = null;
    }
  }

  // --- Full apply (CSS + Canvas + Audio + Sprites) ---
  function _apply(t) {
    _applyCSS(t);
    _applyCanvas(t);
    _applyAudio(t);
    _applySpriteAssets(t);
    if (typeof applyThemeToBody === 'function') {
      applyThemeToBody(t);
    }
    if (typeof dispatchEvent === 'function') {
      dispatchEvent(new CustomEvent('themechange', { detail: t }));
    }
  }

  // --- Build active theme: base -> equipped modules -> layer override ---
  function buildActiveTheme() {
    var theme = themes[activeId] || BASE_THEME;
    var result = deepMerge({}, theme);

    // 1. Apply equipped module overrides
    for (var mod in _equippedModules) {
      var srcId = _equippedModules[mod];
      var src = themes[srcId];
      if (src && src[mod]) {
        result[mod] = Object.assign({}, result[mod], src[mod]);
      }
    }

    // 2. Apply dungeon layer override
    if (_layerOverride && _layerOverride.patch) {
      result = deepMerge(result, _layerOverride.patch);
    }

    return result;
  }

  // --- LocalStorage helpers ---
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        activeId = data.active || 'default';
        if (data.layerFloor) {
          _layerOverride = {
            floorNum: data.layerFloor,
            patch: data.layerPatch || {}
          };
        }
        if (data.equipped) {
          _equippedModules = data.equipped;
        }
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      var state = { active: activeId, equipped: _equippedModules };
      if (_layerOverride) {
        state.layerFloor = _layerOverride.floorNum;
        state.layerPatch = _layerOverride.patch;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function loadUnlocks() {
    try {
      var raw = localStorage.getItem(UNLOCK_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    if (typeof loadThemeUnlocks === 'function') {
      return loadThemeUnlocks();
    }
    return { classic: true, pixel_retro: true };
  }

  function saveUnlocks(unlocks) {
    try {
      localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlocks));
    } catch (e) {}
  }

  // --- Unlock condition check ---
  function meetsCondition(cond, stats) {
    if (!cond) return true;
    switch (cond.type) {
      case 'deepestFloor':
        return (stats.deepestFloor || 0) >= cond.value;
      case 'totalClears':
        return (stats.totalClears || 0) >= cond.value;
      case 'totalPlayTime':
        return (stats.totalPlayTime || 0) >= cond.value;
      case 'clearsByClass':
        return (stats.clearsByClass && stats.clearsByClass[cond.cls] || 0) >= cond.value;
      default:
        return false;
    }
  }

  // --- Merge base theme with layer override ---
  function mergeWithLayer(base, floorNum) {
    var layerNum = floorToLayer(floorNum);
    var layerDef = DUNGEON_LAYER_OVERRIDES[layerNum];
    if (layerDef) {
      return deepMerge(base, layerDef.patch);
    }
    return base;
  }

  // =================== Public API ===================

  return {
    // Register a theme (auto-merge with BASE_THEME)
    register: function (id, themeDef) {
      var merged = deepMerge(BASE_THEME, themeDef);
      themes[merged.id] = merged;
    },

    // Switch to a theme (full switch, clears module mixing)
    switch: function (id) {
      // Normalize 'classic' to 'default' (default is the public-facing ID)
      if (id === 'classic') id = 'default';
      if (!themes[id]) return false;
      if (!this.isUnlocked(id)) return false;
      activeId = id;
      _equippedModules = {};
      saveState();
      var t = this.getActive();
      _apply(t);
      return true;
    },

    // Mix-and-match: equip a module from a different theme
    equip: function (moduleName, themeId) {
      var source = themes[themeId];
      if (!source || !source[moduleName]) return false;
      if (!this.isUnlocked(themeId)) return false;
      _equippedModules[moduleName] = themeId;
      saveState();
      var t = this.getActive();
      _apply(t);
      return true;
    },

    // Apply dungeon layer overlay
    applyLayerOverride: function (floorNum, tintColor) {
      // Explicitly passed null → clear override
      if (tintColor === null) {
        _layerOverride = null;
        saveState();
        var t = this.getActive();
        _apply(t);
        return;
      }
      var layerNum = floorToLayer(floorNum);
      var layerDef = DUNGEON_LAYER_OVERRIDES[layerNum];
      var patch = layerDef ? JSON.parse(JSON.stringify(layerDef.patch)) : { palette: {} };
      if (tintColor) {
        var baseTheme = themes[activeId] || BASE_THEME;
        var baseVoid = baseTheme.palette ? baseTheme.palette.void : '#0a0a1a';
        patch.palette.void = tintBlend(baseVoid, tintColor, 0.4);
      }
      _layerOverride = { floorNum: floorNum, patch: patch };
      saveState();
      var t = this.getActive();
      _apply(t);
    },

    // Clear dungeon layer overlay
    clearLayerOverride: function () {
      _layerOverride = null;
      saveState();
      var t = this.getActive();
      _apply(t);
    },

    // Get fully merged active theme
    getActive: function () {
      return buildActiveTheme();
    },

    // Get current active theme ID
    getActiveId: function () {
      return activeId;
    },

    // Get all registered theme IDs (exclude 'classic' internal alias, use 'default' as canonical)
    getAllIds: function () {
      var all = Object.keys(themes);
      if (themes['default'] && themes['classic'] === themes['default']) {
        return all.filter(function (id) { return id !== 'classic'; });
      }
      return all;
    },

    // Get all theme info for shop UI
    getAllThemes: function () {
      var stats = this.loadStats();
      var result = [];
      for (var i = 0; i < _themeDefs.length; i++) {
        var def = _themeDefs[i];
        var unlocked = def.id === 'classic' || this.isUnlocked(def.id === 'classic' ? 'default' : def.id);
        var progress = null;
        var required = null;
        if (def.unlockCondition) {
          var cond = def.unlockCondition;
          switch (cond.type) {
            case 'deepestFloor':
              progress = stats.deepestFloor || 0;
              required = cond.value;
              break;
            case 'totalClears':
              progress = stats.totalClears || 0;
              required = cond.value;
              break;
            case 'totalPlayTime':
              progress = stats.totalPlayTime || 0;
              required = cond.value;
              break;
            case 'clearsByClass':
              progress = (stats.clearsByClass && stats.clearsByClass[cond.cls]) || 0;
              required = cond.value;
              break;
          }
        }
        result.push({
          id: def.id === 'classic' ? 'default' : def.id,
          name: def.name,
          rarity: def.rarity,
          unlockCondition: def.unlockCondition,
          unlocked: unlocked,
          progress: progress,
          required: required,
          equipped: activeId === (def.id === 'classic' ? 'default' : def.id)
        });
      }
      return result;
    },

    // Check if a theme is unlocked
    isUnlocked: function (id) {
      if (id === 'classic' || id === 'default') return true;
      var unlocks = loadUnlocks();
      return !!unlocks[id];
    },

    // Unlock a theme
    unlock: function (id) {
      var unlocks = loadUnlocks();
      unlocks[id] = true;
      saveUnlocks(unlocks);
    },

    // Load/unlock helpers (exposed for external calls)
    loadUnlocks: loadUnlocks,
    saveUnlocks: saveUnlocks,

    // Check all unlock conditions and auto-unlock eligible themes
    checkUnlockConditions: function (stats) {
      var newlyUnlocked = [];
      for (var i = 0; i < _themeDefs.length; i++) {
        var def = _themeDefs[i];
        if (this.isUnlocked(def.id)) continue;
        if (def.unlockCondition && meetsCondition(def.unlockCondition, stats)) {
          this.unlock(def.id);
          newlyUnlocked.push(def.id);
        }
      }
      return newlyUnlocked;
    },

    // Load progress stats from localStorage
    loadStats: function () {
      try {
        var raw = localStorage.getItem('rpg_theme_progress');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return {};
    },

    // Save progress stats to localStorage
    saveStats: function (stats) {
      try {
        localStorage.setItem('rpg_theme_progress', JSON.stringify(stats));
      } catch (e) {}
    },

    // Get the raw theme definition (merged with BASE_THEME)
    getTheme: function (id) {
      return themes[id] || null;
    },

    // Get the equipped modules map
    getEquippedModules: function () {
      return Object.assign({}, _equippedModules);
    },

    // Clear all equipped modules (reset to base theme)
    clearEquipped: function () {
      _equippedModules = {};
      saveState();
      var t = this.getActive();
      _apply(t);
    },

    // Get layer override info
    getLayerOverride: function () {
      return _layerOverride;
    },

    // Legacy: FLOOR_TINTS compatibility
    applyFloorTint: function (floorNum, tint) {
      if (tint) {
        _layerOverride = {
          floorNum: floorNum,
          patch: { palette: { wallTint: tint + '40', floorTint: tint + '20' } }
        };
      } else {
        var layerNum = floorToLayer(floorNum);
        var layerDef = DUNGEON_LAYER_OVERRIDES[layerNum];
        if (layerDef) {
          _layerOverride = { floorNum: floorNum, patch: layerDef.patch };
        }
      }
      saveState();
      var t = this.getActive();
      _apply(t);
    },

    // Merge base theme with layer (exposed for render helpers)
    mergeWithLayer: mergeWithLayer,

    // Get sprite data from current SpriteLoader (or null)
    getThemeSpriteData: function (spriteName, animName, isCombat) {
      var loader = window.currentSpriteLoader;
      if (loader && typeof loader.getSprite === 'function') {
        return loader.getSprite(spriteName, animName, isCombat);
      }
      return null;
    },

    // Check if sprite assets are loaded and ready for a given sprite
    isSpriteReady: function (spriteName) {
      var loader = window.currentSpriteLoader;
      if (loader && typeof loader.isReady === 'function') {
        return loader.isReady(spriteName);
      }
      return false;
    },

    // Initialize: register all themes, load saved state
    init: function () {
      for (var i = 0; i < _themeDefs.length; i++) {
        this.register(_themeDefs[i].id, _themeDefs[i]);
      }
      // Backward compat: 'default' alias for 'classic'
      if (!themes['default']) {
        themes['default'] = themes['classic'];
      }
      // Normalize 'classic' to 'default' for backward compat
      if (activeId === 'classic') activeId = 'default';
      loadState();
      if (activeId === 'classic') activeId = 'default';
      try {
        if (!themes[activeId]) activeId = 'default';
      } catch (e) {
        activeId = 'default';
      }
      var t = this.getActive();
      _apply(t);
    }
  };
})();

// Initialize on load
ThemeManager.init();

// =================== Exports ===================

window.themeManager = ThemeManager;
window.BASE_THEME = BASE_THEME;
window.FLOOR_TINTS = FLOOR_TINTS;
window.DUNGEON_LAYER_OVERRIDES = DUNGEON_LAYER_OVERRIDES;
window.THEME_UNLOCK_CONDITIONS = THEME_UNLOCK_CONDITIONS;

// Global sprite loader state - null when no sprite theme is active
window.currentSpriteLoader = null;

/**
 * Get sprite data from the active SpriteLoader.
 * Returns spriteData if available, null otherwise (falls back to string sprites).
 * @param {string} spriteName - Key in manifest (e.g. "player-warrior")
 * @param {string} animName - Animation name (e.g. "idle", "walk", "attack")
 * @param {boolean} isCombat - Use combat frame dimensions if true
 * @returns {object|null} Sprite frame data or null
 */
function getThemeSpriteData(spriteName, animName, isCombat) {
  if (window.themeManager && typeof window.themeManager.getThemeSpriteData === 'function') {
    return window.themeManager.getThemeSpriteData(spriteName, animName, isCombat);
  }
  return null;
}

window.getThemeSpriteData = getThemeSpriteData;

// Legacy exports for backward compatibility
window.BLOOD_MOON_THEME = BLOOD_MOON_THEME;
window.PIXEL_RETRO_THEME = PIXEL_RETRO_THEME;
