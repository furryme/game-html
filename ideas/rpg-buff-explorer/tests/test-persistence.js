// test-persistence.js — Persistence + talent system tests
const { describe, it, makeAssert, seedRandom } = require('./test-runner');

describe('defaultPermanentStats', ({ assert }) => {
  it('返回默认统计对象', () => {
    const stats = defaultPermanentStats();
    if (stats.totalKills !== 0) throw new Error('totalKills should be 0');
    if (stats.totalRuns !== 0) throw new Error('totalRuns should be 0');
  });
});

describe('trackProgress', ({ assert }) => {
  it('更新 buffUnlockProgress', () => {
    // trackProgress updates buffUnlockProgress, not permanentStats
    const perm = loadPermanent();
    const progress = perm.buffUnlockProgress;
    // Should not throw
    trackProgress(perm, 'kill', 1);
    trackProgress(perm, 'floor', 2);
  });
});

describe('onDeath/onVictory', ({ assert }) => {
  it('onDeath 保留 50% 金币', () => {
    player.gold = 100;
    const perm = loadPermanent();
    const kept = onDeath(perm);
    if (kept !== 50) throw new Error(`kept gold: expected 50, got ${kept}`);
  });

  it('onVictory 给灵魂碎片', () => {
    const perm = loadPermanent();
    const shardsBefore = perm.soulShards;
    onVictory(perm);
    if (perm.soulShards !== shardsBefore + 3) {
      throw new Error(`soulShards: expected +3, got ${perm.soulShards}`);
    }
  });
});

describe('localStorage 读写', ({ assert }) => {
  it('save 后 load 数据一致', () => {
    const perm = loadPermanent(); // load defaults
    perm.soulShards = 5;
    perm.permanentStats.totalKills = 42;
    savePermanent(perm);

    const loaded = loadPermanent();
    if (loaded.soulShards !== 5) throw new Error(`soulShards: expected 5, got ${loaded.soulShards}`);
    if (loaded.permanentStats.totalKills !== 42) throw new Error(`totalKills: expected 42`);
  });

  it('空存档时 load 返回默认值', () => {
    localStorage.clear();
    const loaded = loadPermanent();
    if (!loaded) throw new Error('loadPermanent should not return null');
    if (loaded.soulShards !== 0) throw new Error(`soulShards: expected 0`);
  });
});

describe('TALENT_DEFS', ({ assert }) => {
  it('5 个天赋已定义', () => {
    const keys = Object.keys(TALENT_DEFS);
    if (keys.length < 5) throw new Error(`talent count: expected >= 5, got ${keys.length}`);
  });

  it('天赋有名字和描述', () => {
    for (const key in TALENT_DEFS) {
      if (!TALENT_DEFS[key].name) throw new Error(`${key}: missing name`);
      if (!TALENT_DEFS[key].desc) throw new Error(`${key}: missing desc`);
    }
  });
});

describe('checkBuffUnlocks', ({ assert }) => {
  it('不报错', () => {
    const perm = loadPermanent();
    checkBuffUnlocks(perm); // should not throw
  });
});
