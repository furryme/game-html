const ENEMY_DATA = {
  slime: {
    name: '史莱姆',
    icon: '🟢',
    hp: 30,
    atk: 6,
    def: 2,
    spd: 5,
    exp: 12,
    gold: [3, 8],
    actions: [
      { type: 'attack', weight: 60, label: '扑咬' },
      { type: 'attack', weight: 25, label: '酸液', dot: { id: 'poison', duration: 2, value: 0.04 } },
      { type: 'defend', weight: 15, label: '蜷缩' }
    ]
  },
  bat: {
    name: '蝙蝠',
    icon: '🦇',
    hp: 22,
    atk: 9,
    def: 1,
    spd: 8,
    exp: 10,
    gold: [2, 6],
    actions: [
      { type: 'attack', weight: 70, label: '撕咬' },
      { type: 'attack', weight: 15, label: '毒爪', dot: { id: 'poison', duration: 2, value: 0.03 } },
      { type: 'flee', weight: 15, label: '逃跑' }
    ]
  },
  mole: {
    name: '鼹鼠',
    icon: '🐀',
    hp: 40,
    atk: 7,
    def: 4,
    spd: 4,
    exp: 15,
    gold: [4, 10],
    actions: [
      { type: 'attack', weight: 55, label: '挖掘' },
      { type: 'attack', weight: 20, label: '突袭', stun: true },
      { type: 'defend', weight: 25, label: '躲藏' }
    ]
  },
  skeleton: {
    name: '骷髅',
    icon: '💀',
    hp: 55,
    atk: 12,
    def: 6,
    spd: 7,
    exp: 22,
    gold: [6, 15],
    actions: [
      { type: 'attack', weight: 50, label: '劈砍' },
      { type: 'attack', weight: 20, label: '重击', mult: 1.5, stun: true },
      { type: 'buff', weight: 15, label: '战吼', selfBuff: { stat: 'atk', mult: 1.5, duration: 2 } },
      { type: 'defend', weight: 15, label: '格挡' }
    ]
  },
  spider: {
    name: '蜘蛛',
    icon: '🕷️',
    hp: 45,
    atk: 15,
    def: 4,
    spd: 8,
    exp: 25,
    gold: [8, 14],
    actions: [
      { type: 'attack', weight: 45, label: '咬击' },
      { type: 'attack', weight: 30, label: '喷毒', dot: { id: 'poison', duration: 3, value: 0.05 } },
      { type: 'buff', weight: 15, label: '结网', selfBuff: { stat: 'atk', mult: 1.3, duration: 2 } },
      { type: 'defend', weight: 10, label: '蜷缩' }
    ]
  },
  goblin: {
    name: '哥布林',
    icon: '👺',
    hp: 60,
    atk: 11,
    def: 7,
    spd: 9,
    exp: 20,
    gold: [5, 18],
    actions: [
      { type: 'attack', weight: 55, label: '刺击' },
      { type: 'buff', weight: 20, label: '咆哮', selfBuff: { stat: 'atk', mult: 1.4, duration: 2 } },
      { type: 'defend', weight: 15, label: '盾牌' },
      { type: 'flee', weight: 10, label: '逃跑' }
    ]
  },
  archer: {
    name: '弓箭手',
    icon: '🏹',
    hp: 50,
    atk: 18,
    def: 5,
    spd: 11,
    exp: 35,
    gold: [10, 20],
    actions: [
      { type: 'attack', weight: 50, label: '射击' },
      { type: 'attack', weight: 25, label: '重箭', mult: 1.6 },
      { type: 'defend', weight: 25, label: '掩护' }
    ]
  },
  ghost: {
    name: '幽灵',
    icon: '👻',
    hp: 65,
    atk: 16,
    def: 8,
    spd: 12,
    exp: 38,
    gold: [12, 22],
    actions: [
      { type: 'attack', weight: 45, label: '魅影' },
      { type: 'debuff', weight: 25, label: '恐惧', enemyDebuff: { stat: 'atk', mult: 0.7, duration: 2 } },
      { type: 'buff', weight: 15, label: '隐身', selfBuff: { stat: 'spd', mult: 1.5, duration: 2 } },
      { type: 'defend', weight: 15, label: '消散' }
    ]
  },
  golem: {
    name: '石魔',
    icon: '🗿',
    hp: 90,
    atk: 14,
    def: 14,
    spd: 4,
    exp: 40,
    gold: [10, 25],
    actions: [
      { type: 'attack', weight: 45, label: '石拳' },
      { type: 'attack', weight: 25, label: '砸地', mult: 1.8 },
      { type: 'buff', weight: 20, label: '石化', selfBuff: { stat: 'def', mult: 1.5, duration: 3 } },
      { type: 'defend', weight: 10, label: '龟缩' }
    ]
  },
  hound: {
    name: '猎犬',
    icon: '🐺',
    hp: 80,
    atk: 22,
    def: 10,
    spd: 12,
    exp: 50,
    gold: [15, 30],
    actions: [
      { type: 'attack', weight: 50, label: '扑咬' },
      { type: 'attack', weight: 25, label: '毒牙', dot: { id: 'poison', duration: 2, value: 0.04 } },
      { type: 'buff', weight: 25, label: '狂暴', selfBuff: { stat: 'atk', mult: 1.5, duration: 2 } }
    ]
  },
  voodoo: {
    name: '巫毒师',
    icon: '🧙',
    hp: 60,
    atk: 28,
    def: 6,
    spd: 11,
    exp: 55,
    gold: [18, 35],
    actions: [
      { type: 'attack', weight: 40, label: '暗箭' },
      { type: 'attack', weight: 25, label: '毒雾', dot: { id: 'poison', duration: 3, value: 0.05 } },
      { type: 'debuff', weight: 20, label: '弱化诅咒', enemyDebuff: { stat: 'atk', mult: 0.7, duration: 2 } },
      { type: 'buff', weight: 15, label: '法力护盾', selfBuff: { stat: 'def', mult: 1.8, duration: 2 } }
    ]
  },
  assassin: {
    name: '刺客',
    icon: '🥷',
    hp: 70,
    atk: 25,
    def: 12,
    spd: 13,
    exp: 52,
    gold: [14, 32],
    actions: [
      { type: 'attack', weight: 45, label: '暗杀', mult: 1.4 },
      { type: 'attack', weight: 25, label: '背刺', mult: 2.0 },
      { type: 'defend', weight: 15, label: '闪避' },
      { type: 'flee', weight: 15, label: '遁走' }
    ]
  },
  lava_elemental: {
    name: '熔火元素',
    icon: '🔥',
    hp: 120,
    atk: 30,
    def: 15,
    spd: 6,
    exp: 70,
    gold: [20, 40],
    actions: [
      { type: 'attack', weight: 40, label: '熔岩拳' },
      { type: 'attack', weight: 30, label: '灼烧', dot: { id: 'burn', duration: 3, value: 0.06 } },
      { type: 'buff', weight: 20, label: '硬化', selfBuff: { stat: 'def', mult: 1.5, duration: 2 } },
      { type: 'defend', weight: 10, label: '结晶化' }
    ]
  },
  flame_bat: {
    name: '焰蝠',
    icon: '🦇',
    hp: 85,
    atk: 28,
    def: 8,
    spd: 15,
    exp: 60,
    gold: [15, 30],
    actions: [
      { type: 'attack', weight: 50, label: '烈焰撕咬' },
      { type: 'attack', weight: 25, label: '火毒', dot: { id: 'burn', duration: 2, value: 0.05 } },
      { type: 'buff', weight: 15, label: '火化', selfBuff: { stat: 'spd', mult: 1.5, duration: 2 } },
      { type: 'flee', weight: 10, label: '逃散' }
    ]
  },
  fire_sprite: {
    name: '火灵',
    icon: '✨',
    hp: 75,
    atk: 35,
    def: 10,
    spd: 14,
    exp: 75,
    gold: [18, 35],
    actions: [
      { type: 'attack', weight: 45, label: '炎爆', mult: 1.3 },
      { type: 'attack', weight: 30, label: '灼烧波', dot: { id: 'burn', duration: 2, value: 0.04 } },
      { type: 'buff', weight: 25, label: '炎化', selfBuff: { stat: 'atk', mult: 1.6, duration: 2 } }
    ]
  },
  crystal_golem: {
    name: '晶体巨人',
    icon: '💎',
    hp: 160,
    atk: 22,
    def: 22,
    spd: 5,
    exp: 80,
    gold: [22, 45],
    actions: [
      { type: 'attack', weight: 35, label: '晶拳' },
      { type: 'attack', weight: 25, label: '碎裂', mult: 2.0 },
      { type: 'buff', weight: 25, label: '结晶化', selfBuff: { stat: 'def', mult: 1.6, duration: 3 } },
      { type: 'defend', weight: 15, label: '龟缩' }
    ]
  },
  death_knight: {
    name: '死亡骑士',
    icon: '⚔️',
    hp: 130,
    atk: 32,
    def: 18,
    spd: 10,
    exp: 85,
    gold: [25, 50],
    actions: [
      { type: 'attack', weight: 40, label: '死击', mult: 1.3 },
      { type: 'attack', weight: 25, label: '处决', mult: 1.8, stun: true },
      { type: 'debuff', weight: 20, label: '死亡恐惧', enemyDebuff: { stat: 'atk', mult: 0.6, duration: 2 } },
      { type: 'buff', weight: 15, label: '死灵之力', selfBuff: { stat: 'atk', mult: 1.5, duration: 2 } }
    ]
  },
  void_horror: {
    name: '虚空恐怖',
    icon: '🌀',
    hp: 150,
    atk: 28,
    def: 16,
    spd: 12,
    exp: 90,
    gold: [28, 55],
    actions: [
      { type: 'attack', weight: 35, label: '虚空撕裂' },
      { type: 'attack', weight: 25, label: '湮灭', mult: 2.2 },
      { type: 'debuff', weight: 20, label: '恐惧', enemyDebuff: { stat: 'atk', mult: 0.65, duration: 2 } },
      { type: 'buff', weight: 20, label: '虚化', selfBuff: { stat: 'def', mult: 2.0, duration: 2 } }
    ]
  }
};

const BOSS_DATA = {
  moss_giant: {
    floor: 1,
    name: '青苔巨蟒',
    icon: '🐍',
    hp: 150,
    atk: 18,
    def: 10,
    spd: 6,
    exp: 80,
    gold: [30, 50],
    rules: [
      { threshold: 0.5, effect: 'berserk', desc: '狂暴: ATK+50%' }
    ]
  },
  shadow_mage: {
    floor: 2,
    name: '暗影法师',
    icon: '🧙‍♂️',
    hp: 200,
    atk: 22,
    def: 12,
    spd: 10,
    exp: 120,
    gold: [40, 60],
    rules: [
      { threshold: 1.0, effect: 'skill_seal', desc: '技能封印: 每回合随机封印一个技能' },
      { threshold: 0.5, effect: 'dark_drain', desc: '暗伤: 每回合固定8点伤害' }
    ]
  },
  greed_king: {
    floor: 3,
    name: '贪婪之王',
    icon: '👑',
    hp: 250,
    atk: 25,
    def: 14,
    spd: 8,
    exp: 200,
    gold: [80, 120],
    gems: [3],
    rules: [
      { threshold: 1.0, effect: 'equip_corrupt', desc: '装备腐化: 每2回合装备属性-20%' },
      { threshold: 0.66, effect: 'gold_tempt', desc: '金币诱惑: 概率弹出投降' },
      { threshold: 0.33, effect: 'berserk', desc: '狂暴: ATK+50%, 可能追加攻击' }
    ]
  },
  inferno_beast: {
    floor: 4,
    name: '熔火巨兽',
    icon: '🐉',
    hp: 400,
    atk: 28,
    def: 18,
    spd: 8,
    exp: 120,
    gold: [60, 90],
    soulShards: [1],
    rules: [
      { threshold: 0.5, effect: 'berserk', desc: '狂暴: ATK+50%' },
      { threshold: 1.0, effect: 'summon_minion', desc: '召唤小怪: 每4回合召唤', interval: 4 }
    ]
  },
  lord_endings: {
    floor: 5,
    name: '终焉领主',
    icon: '💀',
    hp: 500,
    atk: 35,
    def: 20,
    spd: 14,
    exp: 300,
    gold: [100, 150],
    soulShards: [3],
    rules: [
      { threshold: 1.0, effect: 'skill_seal', desc: '技能封印: 每回合随机封印一个技能' },
      { threshold: 1.0, effect: 'equip_corrupt', desc: '装备腐化: 每2回合装备属性-20%' },
      { threshold: 0.33, effect: 'berserk', desc: '狂暴: ATK+50%' }
    ]
  }
};
