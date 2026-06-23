const TILE = { WALL: 0, FLOOR: 1, CORRIDOR: 2 };
const MAP_W = 40;
const MAP_H = 30;
const PIXEL = 4;
const TILE_SIZE = PIXEL * 4; // 16px
const CANVAS_W = 480;
const CANVAS_H = 270;
const MAX_FLOORS = 5;
const ROOM_TYPES = ['combat', 'loot', 'trap', 'resting', 'shrine', 'empty'];

const CLASS_DATA = {
  warrior: {
    hp: 120, mp: 30, atk: 14, def: 10, spd: 8, crit: 5, luck: 0,
    hpGrowth: 20, mpGrowth: 3, atkGrowth: 3, defGrowth: 2, spdGrowth: 1, critGrowth: 0,
    label: '战士', icon: '⚔️', color: '#d4a855'
  },
  mage: {
    hp: 80, mp: 45, atk: 15, def: 3, spd: 12, crit: 5, luck: 3,
    hpGrowth: 15, mpGrowth: 5, atkGrowth: 4, defGrowth: 1, spdGrowth: 2, critGrowth: 0,
    label: '法师', icon: '🔮', color: '#5588ff',
    passiveBurnChance: 0.2, passiveBurnDmgBase: 3
  },
  rogue: {
    hp: 90, mp: 35, atk: 12, def: 4, spd: 16, crit: 20, luck: 2,
    hpGrowth: 18, mpGrowth: 3, atkGrowth: 3, defGrowth: 1, spdGrowth: 3, critGrowth: 2,
    label: '游侠', icon: '🗡️', color: '#44cc66',
    passiveFirstStrikeCrit: true
  }
};
