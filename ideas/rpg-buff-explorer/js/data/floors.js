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
  }
];
