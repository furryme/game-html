const FLOOR_THEMES = [
  {
    id: 'moss_halls',
    name: '青苔回廊',
    colors: {
      wall: '#3a5a3a',
      wallDark: '#2a4a2a',
      floor: '#4a6a4a',
      floorAlt: '#3a5a3a',
      corridor: '#5a7a5a'
    },
    decor: '#6a9a6a',
    envBuff: null,
    enemyPool: ['slime', 'bat', 'mole'],
    trapChance: 0.15,
    visibility: 4,
    roomTarget: [5, 7],
    corridorWidth: 2
  },
  {
    id: 'bone_crypt',
    name: '骨骸 Crypt',
    colors: {
      wall: '#5a5a6a',
      wallDark: '#4a4a5a',
      floor: '#7a7a8a',
      floorAlt: '#6a6a7a',
      corridor: '#8a8a9a'
    },
    decor: '#c8c0b0',
    envBuff: {
      id: 'decay',
      desc: '腐朽: 每5回合损失3%HP'
    },
    enemyPool: ['skeleton', 'spider', 'goblin'],
    trapChance: 0.2,
    visibility: 3,
    roomTarget: [5, 7],
    corridorWidth: 1
  },
  {
    id: 'void_core',
    name: '虚空核心',
    colors: {
      wall: '#3a2a5a',
      wallDark: '#2a1a4a',
      floor: '#5a4a7a',
      floorAlt: '#4a3a6a',
      corridor: '#6a5a8a'
    },
    decor: '#d500f9',
    envBuff: {
      id: 'void',
      desc: '虚空: 敌人ATK+20%，获得EXP+50%'
    },
    enemyPool: ['archer', 'ghost', 'golem', 'hound', 'voodoo', 'assassin'],
    trapChance: 0.25,
    visibility: 3,
    roomTarget: [6, 8],
    corridorWidth: 1
  },
  {
    id: 'inferno_abyss',
    name: '熔火深渊',
    colors: {
      wall: '#cc5500',
      wallDark: '#bb4400',
      floor: '#331100',
      floorAlt: '#441500',
      corridor: '#553311'
    },
    decor: '#ff4400',
    envBuff: {
      id: 'inferno',
      desc: '熔火: 每4回合受到5%最大HP灼烧伤害'
    },
    enemyPool: ['lava_elemental', 'flame_bat', 'fire_sprite', 'crystal_golem'],
    trapChance: 0.3,
    visibility: 3,
    roomTarget: [6, 8],
    corridorWidth: 1
  },
  {
    id: 'throne_endings',
    name: '终焉王座',
    colors: {
      wall: '#222233',
      wallDark: '#1a1a2a',
      floor: '#111122',
      floorAlt: '#1a1a33',
      corridor: '#333344'
    },
    decor: '#6666aa',
    envBuff: {
      id: 'final',
      desc: '终焉: 敌人ATK+30% DEF+15%, EXP+100% 金币+50%'
    },
    enemyPool: ['lava_elemental', 'flame_bat', 'fire_sprite', 'crystal_golem', 'death_knight', 'void_horror'],
    trapChance: 0.3,
    visibility: 2,
    roomTarget: [6, 9],
    corridorWidth: 1
  }
];
