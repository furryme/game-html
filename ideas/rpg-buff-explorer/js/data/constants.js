const TILE = { WALL: 0, FLOOR: 1, CORRIDOR: 2 };
const MAP_W = 40;
const MAP_H = 30;
const PIXEL = 4;
const TILE_SIZE = PIXEL * 4; // 16px
const CANVAS_W = 480;
const CANVAS_H = 270;
const MAX_FLOORS = 3;
const ROOM_TYPES = ['combat', 'loot', 'trap', 'resting', 'shrine', 'empty'];

const CLASS_DATA = {
  warrior: { hp: 120, mp: 30, atk: 14, def: 10, spd: 8, crit: 5, luck: 0 },
  mage:    { hp: 90,  mp: 60, atk: 10, def: 6,  spd: 9, crit: 5, luck: 3 },
  ranger:  { hp: 100, mp: 40, atk: 12, def: 8,  spd: 11, crit: 10, luck: 2 }
};
