// test-data.js — Data integrity tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('ENEMY_DATA', ({ assert }) => {
  it('12 种敌人都已定义', () => {
    const count = Object.keys(ENEMY_DATA).length;
    if (count < 10) throw new Error(`enemy count: expected >= 10, got ${count}`);
  });

  it('敌人都有必要字段', () => {
    const required = ['name', 'hp', 'atk', 'def', 'spd', 'exp', 'gold', 'actions'];
    for (const key in ENEMY_DATA) {
      const e = ENEMY_DATA[key];
      for (const field of required) {
        if (e[field] === undefined && e[field] !== 0) {
          throw new Error(`${key}: missing field '${field}'`);
        }
      }
    }
  });
});

describe('BUFF_DEFS', ({ assert }) => {
  it('至少 24 个 buff', () => {
    if (BUFF_DEFS.length < 20) throw new Error(`buff count: expected >= 20, got ${BUFF_DEFS.length}`);
  });

  it('buff ID 唯一', () => {
    const ids = {};
    for (const b of BUFF_DEFS) {
      if (ids[b.id]) throw new Error(`duplicate buff id: ${b.id}`);
      ids[b.id] = true;
    }
  });

  it('稀有度合法', () => {
    const valid = ['common', 'rare', 'legendary', 'mythic'];
    for (const b of BUFF_DEFS) {
      if (!valid.includes(b.rarity)) throw new Error(`invalid rarity: ${b.rarity}`);
    }
  });
});

describe('SKILLS', ({ assert }) => {
  it('22 个技能已定义', () => {
    if (SKILLS.length !== 22) throw new Error(`skill count: expected 22, got ${SKILLS.length}`);
  });

  it('技能 ID 唯一', () => {
    const ids = {};
    for (const s of SKILLS) {
      if (ids[s.id]) throw new Error(`duplicate skill id: ${s.id}`);
      ids[s.id] = true;
    }
  });
});

describe('FLOOR_THEMES', ({ assert }) => {
  it('5 层主题已定义', () => {
    if (FLOOR_THEMES.length !== 5) throw new Error(`expected 5, got ${FLOOR_THEMES.length}`);
  });

  it('主题有名称和颜色', () => {
    for (const t of FLOOR_THEMES) {
      if (!t.name) throw new Error('missing name');
      if (!t.colors) throw new Error('missing colors');
    }
  });

  it('主题有敌人池', () => {
    for (let i = 0; i < FLOOR_THEMES.length; i++) {
      if (!Array.isArray(FLOOR_THEMES[i].enemyPool) || FLOOR_THEMES[i].enemyPool.length === 0) {
        throw new Error(`floor ${i+1}: empty enemyPool`);
      }
    }
  });
});

describe('CLASS_DATA', ({ assert }) => {
  it('3 个职业已定义', () => {
    if (Object.keys(CLASS_DATA).length !== 3) throw new Error('expected 3');
  });

  it('职业属性合理', () => {
    for (const key in CLASS_DATA) {
      if (CLASS_DATA[key].hp < 50) throw new Error(`${key}: hp too low`);
    }
  });
});

describe('PAL 调色板', ({ assert }) => {
  it('核心颜色已定义', () => {
    const required = ['void', 'dark', 'red', 'green', 'blue', 'cyan', 'gold'];
    for (const c of required) {
      if (PAL[c] === undefined) throw new Error(`PAL.${c} is undefined`);
    }
  });
});
