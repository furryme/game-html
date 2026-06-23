const ITEMS_DATA = {
  hp_potion: {
    name: '生命药水',
    icon: '❤️',
    effect: 'heal',
    value: 80,
    price: 25,
    desc: '回复80点HP'
  },
  mp_potion: {
    name: '魔力药水',
    icon: '💙',
    effect: 'restore_mp',
    value: 40,
    price: 20,
    desc: '回复40点MP'
  },
  big_hp_potion: {
    name: '大生命药水',
    icon: '💖',
    effect: 'heal',
    value: 200,
    price: 60,
    desc: '回复200点HP'
  },
  panacea: {
    name: '万能药',
    icon: '✨',
    effect: 'full_restore',
    value: 0,
    price: 100,
    desc: '完全回复HP、MP，清除所有异常状态'
  },
  bomb: {
    name: '炸弹',
    icon: '💣',
    effect: 'damage',
    value: 60,
    price: 35,
    desc: '对敌人造成60点无视防御的伤害'
  },
  antidote: {
    name: '解毒药',
    icon: '🧪',
    effect: 'cure_poison',
    value: 0,
    price: 15,
    desc: '解除中毒状态'
  },
  silver_key: {
    name: '银钥匙',
    icon: '🔑',
    effect: 'key',
    value: 0,
    price: 30,
    desc: '可以打开上锁的门'
  },
  identify_scroll: {
    name: '鉴定卷轴',
    icon: '📜',
    effect: 'identify',
    value: 0,
    price: 50,
    desc: '鉴定未知物品的属性'
  },
  detect_scroll: {
    name: '探测卷轴',
    icon: '🔍',
    effect: 'detect_traps',
    value: 0,
    price: 25,
    desc: '揭示当前房间内的所有陷阱'
  },
  teleport_scroll: {
    name: '传送卷轴',
    icon: '🌀',
    effect: 'teleport',
    value: 0,
    price: 80,
    desc: '传送到随机安全位置'
  }
};
