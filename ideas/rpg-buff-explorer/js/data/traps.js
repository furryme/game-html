const TRAP_TYPES = {
  spike: {
    name: '刺钉陷阱',
    icon: '🔺',
    color: '#e53935',
    effect: 'dmg',
    value: 10,
    detectChance: 0.4,
    desc: '受到10点伤害'
  },
  slime: {
    name: '泥沼陷阱',
    icon: '🟤',
    color: '#795548',
    effect: 'slow',
    value: 2,
    detectChance: 0.3,
    desc: '速度降低2回合'
  },
  mirror: {
    name: '幻觉陷阱',
    icon: '👁️',
    color: '#9c27b0',
    effect: 'invert',
    value: 3,
    detectChance: 0.5,
    desc: '操作方向反转3回合'
  },
  poison: {
    name: '毒雾陷阱',
    icon: '☁️',
    color: '#4caf50',
    effect: 'poison',
    value: 3,
    detectChance: 0.4,
    desc: '中毒3回合'
  },
  rock: {
    name: '落石陷阱',
    icon: '🪨',
    color: '#607d8b',
    effect: 'aoe_dmg',
    value: 8,
    detectChance: 0.2,
    desc: '周围格子受到8点伤害'
  },
  warp: {
    name: '传送陷阱',
    icon: '🌀',
    color: '#2196f3',
    effect: 'teleport',
    value: 0,
    detectChance: 0.3,
    desc: '传送到随机位置'
  }
};
