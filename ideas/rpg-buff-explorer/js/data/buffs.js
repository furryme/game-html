const BUFF_DEFS = [
  {
    id: 'iron_skin',
    name: '铁皮',
    desc: '受到伤害降低20%',
    icon: '🛡️',
    rarity: 'common',
    tags: ['defense'],
    type: 'passive',
    passive: { dmgReduction: 0.2 },
    unlockCondition: null
  },
  {
    id: 'swift_foot',
    name: '疾足',
    desc: '速度+30%，10%概率先手攻击',
    icon: '💨',
    rarity: 'common',
    tags: ['speed'],
    type: 'passive',
    passive: { spdMult: 1.3, firstStrike: 10 },
    unlockCondition: null
  },
  {
    id: 'sharp_eye',
    name: '锐眼',
    desc: '暴击率+8%',
    icon: '🎯',
    rarity: 'common',
    tags: ['attack', 'crit'],
    type: 'passive',
    passive: { critBonus: 8 },
    unlockCondition: null
  },
  {
    id: 'mana_flow',
    name: '灵流',
    desc: '每回合回复3点MP',
    icon: '💎',
    rarity: 'common',
    tags: ['sustain'],
    type: 'passive',
    passive: { mpRestore: 3 },
    unlockCondition: null
  },
  {
    id: 'steadfast',
    name: '坚韧',
    desc: '每回合回复2%最大HP',
    icon: '🏔️',
    rarity: 'common',
    tags: ['defense', 'sustain'],
    type: 'passive',
    passive: { hpRestorePct: 0.02 },
    unlockCondition: null
  },
  {
    id: 'gold_hound',
    name: '寻金',
    desc: '获得金币+25%',
    icon: '🐕',
    rarity: 'common',
    tags: ['economy'],
    type: 'passive',
    passive: { goldBonus: 0.25 },
    unlockCondition: null
  },
  {
    id: 'berserks_blessing',
    name: '狂战士的祝福',
    desc: '攻击力+30%，最大HP-15%',
    icon: '⚔️',
    rarity: 'rare',
    tags: ['attack'],
    type: 'passive',
    passive: { atkMult: 1.3, hpMult: 0.85 },
    classBonus: { warrior: { atkMult: 1.2 } },
    unlockCondition: null
  },
  {
    id: 'spirit_eagle',
    name: '灵鹰',
    desc: '经验获取+30%，每回合回复2%HP',
    icon: '🦅',
    rarity: 'rare',
    tags: ['sustain', 'exp'],
    type: 'passive',
    passive: { expBonus: 0.3, hpRestorePct: 0.02 },
    unlockCondition: null
  },
  {
    id: 'lifesteal',
    name: '吸血',
    desc: '攻击时吸取15%造成伤害的生命值',
    icon: '🩸',
    rarity: 'rare',
    tags: ['attack', 'sustain'],
    type: 'passive',
    passive: { lifestealPct: 0.15 },
    unlockCondition: { type: 'floor', value: 2, label: '到达第2层' }
  },
  {
    id: 'shield_burst',
    name: '护盾爆发',
    desc: '抵挡下一次受到的全部伤害（冷却5回合）',
    icon: '🔰',
    rarity: 'rare',
    tags: ['defense'],
    type: 'active',
    active: { cooldown: 5, execute: 'block_next_attack' },
    unlockCondition: { type: 'floor', value: 1, label: '完成第1层' }
  },
  {
    id: 'second_wind',
    name: '二息',
    desc: '回复40%最大HP（冷却8回合）',
    icon: '💫',
    rarity: 'legendary',
    tags: ['sustain', 'survival'],
    type: 'active',
    active: { cooldown: 8, execute: 'heal_pct', healPct: 0.4 },
    unlockCondition: { type: 'death', value: 3, label: '累计死亡3次' }
  },
  {
    id: 'crit_lens',
    name: '聚焦',
    desc: '暴击率+12%',
    icon: '🔍',
    rarity: 'rare',
    tags: ['crit', 'attack'],
    type: 'passive',
    passive: { critBonus: 12 },
    unlockCondition: { type: 'kill', value: 10, label: '累计击杀10个' }
  },
  {
    id: 'gold_magnet',
    name: '吸金',
    desc: '获得金币+50%',
    icon: '🧲',
    rarity: 'common',
    tags: ['economy'],
    type: 'passive',
    passive: { goldBonus: 0.5 },
    unlockCondition: { type: 'gold', value: 200, label: '累计获得200金' }
  },
  {
    id: 'exp_vortex',
    name: '经验漩涡',
    desc: '经验获取+50%',
    icon: '🌀',
    rarity: 'rare',
    tags: ['exp'],
    type: 'passive',
    passive: { expBonus: 0.5 },
    unlockCondition: { type: 'clear', value: 1, label: '通关1次' }
  },
  {
    id: 'thorns',
    name: '荆棘',
    desc: '受到攻击时反弹15%伤害',
    icon: '🌹',
    rarity: 'rare',
    tags: ['defense', 'reflect'],
    type: 'passive',
    passive: { reflectPct: 0.15 },
    unlockCondition: { type: 'floor', value: 2, label: '完成第2层' }
  },
  {
    id: 'shadow_step',
    name: '影步',
    desc: '15%概率闪避攻击',
    icon: '🌑',
    rarity: 'rare',
    tags: ['speed', 'dodge'],
    type: 'passive',
    passive: { dodgeChance: 0.15 },
    unlockCondition: { type: 'flee', value: 5, label: '累计逃跑5次' }
  },
  {
    id: 'flame_aura',
    name: '烈焰光环',
    desc: '攻击时附加灼烧效果，3回合内每秒造成8点伤害',
    icon: '🔥',
    rarity: 'legendary',
    tags: ['attack', 'fire'],
    type: 'passive',
    passive: { onAttack: 'burn', dotDmg: 8, dotTurns: 3 },
    unlockCondition: { type: 'kill', value: 30, label: '累计击杀30个' }
  },
  {
    id: 'poison_blade',
    name: '淬毒之刃',
    desc: '攻击时附加中毒效果，3回合内每秒造成5点伤害',
    icon: '☠️',
    rarity: 'rare',
    tags: ['attack', 'poison'],
    type: 'passive',
    passive: { onAttack: 'poison', dotDmg: 5, dotTurns: 3 },
    unlockCondition: { type: 'floor', value: 3, label: '到达第3层' }
  },
  {
    id: 'frost_heart',
    name: '冰心',
    desc: '受到伤害降低30%',
    icon: '❄️',
    rarity: 'legendary',
    tags: ['defense'],
    type: 'passive',
    passive: { dmgReduction: 0.3 },
    unlockCondition: { type: 'damage_taken', value: 2000, label: '累计受伤2000点' }
  },
  {
    id: 'duelist',
    name: '决斗家',
    desc: '攻击力+30%（仅对Boss生效）',
    icon: '🗡️',
    rarity: 'mythic',
    tags: ['attack', 'boss'],
    type: 'passive',
    passive: { atkMult: 1.3 },
    unlockCondition: { type: 'boss', value: 1, label: '击杀Boss1次' }
  },
  {
    id: 'death_embrace',
    name: '死亡拥抱',
    desc: '死亡时复活一次（冷却99回合）',
    icon: '💀',
    rarity: 'mythic',
    tags: ['survival'],
    type: 'active',
    active: { cooldown: 99, execute: 'revive' },
    unlockCondition: { type: 'death', value: 10, label: '累计死亡10次' }
  },
  {
    id: 'mana_tide',
    name: '法力潮汐',
    desc: '每回合回复5点MP',
    icon: '🌊',
    rarity: 'legendary',
    tags: ['sustain', 'mana'],
    type: 'passive',
    passive: { mpRestore: 5 },
    unlockCondition: { type: 'skill_use', value: 100, label: '累计使用技能100次' }
  },
  {
    id: 'dragon_fury',
    name: '龙怒',
    desc: '攻击力+50%，最大HP-30%',
    icon: '🐉',
    rarity: 'mythic',
    tags: ['attack', 'fire'],
    type: 'passive',
    passive: { atkMult: 1.5, hpMult: 0.7 },
    unlockCondition: { type: 'clear', value: 3, label: '通关3次' }
  },
  {
    id: 'alchemy',
    name: '炼金术',
    desc: '金币+30%，每回合回复1点MP和1%HP',
    icon: '⚗️',
    rarity: 'rare',
    tags: ['economy', 'sustain'],
    type: 'passive',
    passive: { goldBonus: 0.3, mpRestore: 1, hpRestorePct: 0.01 },
    unlockCondition: { type: 'gold', value: 1000, label: '累计获得1000金' }
  }
];

const SYNERGY_DEFS = [
  {
    id: 'fire_storm',
    name: '烈焰风暴',
    tags: ['fire', 'attack'],
    minTags: 2,
    effect: { type: 'multiply_dot', mult: 2.0 },
    desc: 'DOT伤害翻倍'
  },
  {
    id: 'thorns_shield',
    name: '荆棘堡垒',
    tags: ['defense', 'reflect'],
    minTags: 2,
    effect: { type: 'reflect_pct', pct: 0.3 },
    desc: '反射伤害提升至30%'
  },
  {
    id: 'slaughter_machine',
    name: '杀戮机器',
    tags: ['attack', 'sustain'],
    minTags: 2,
    effect: { type: 'add_lifesteal', pct: 0.1 },
    desc: '额外获得10%吸血'
  },
  {
    id: 'critical_fury',
    name: '暴击狂怒',
    tags: ['crit', 'attack'],
    minTags: 2,
    effect: { type: 'crit_exec', pct: 0.1 },
    desc: '暴击时10%概率处决敌人'
  },
  {
    id: 'immortal',
    name: '不死之身',
    tags: ['survival', 'death'],
    minTags: 2,
    effect: { type: 'revive_heal', pct: 0.2 },
    desc: '死亡时以20%HP复活'
  },
  {
    id: 'boss_hunter',
    name: 'Boss猎手',
    tags: ['boss', 'crit'],
    minTags: 2,
    effect: { type: 'boss_crit_mult', mult: 2.0 },
    desc: '对Boss暴击伤害翻倍'
  },
  {
    id: 'dual_blade',
    name: '双刀流',
    tags: ['speed', 'attack'],
    minTags: 2,
    effect: { type: 'double_strike', chance: 0.15 },
    desc: '15%概率额外攻击一次'
  },
  {
    id: 'wealth_flood',
    name: '财富洪流',
    tags: ['economy', 'sustain'],
    minTags: 2,
    effect: { type: 'add_gold', pct: 0.3 },
    desc: '额外获得30%金币'
  }
];

const RARITY_WEIGHTS = {
  common: { 1: 1.0, 2: 0.7, 3: 0.4 },
  rare: { 1: 0.7, 2: 0.8, 3: 0.8 },
  legendary: { 1: 0.0, 2: 0.2, 3: 0.4 },
  mythic: { 1: 0.0, 2: 0.0, 3: 0.1 }
};
