// event.js — Random event trigger, UI, and effect application

/**
 * Pick a random event appropriate for the current floor.
 * Returns null if no eligible event.
 */
function pickRandomEvent() {
  var eligible = [];
  for (var i = 0; i < EVENT_DEFS.length; i++) {
    if (EVENT_DEFS[i].minFloor <= gameState.floor) {
      eligible.push(EVENT_DEFS[i]);
    }
  }
  if (eligible.length === 0) return null;
  return pick(eligible);
}

/**
 * Trigger an event modal. Pauses the game.
 */
function triggerEvent(event) {
  console.log('[event] trigger', event.id, 'floor', gameState.floor);
  gameState.paused = true;
  playSound('event');

  var html = '<h3>' + event.title + '</h3>';
  html += '<p style="color:#9a9aba; margin-bottom:12px;">' + event.desc + '</p>';
  html += '<button class="modal-btn" onclick="onEventChoice(\'' + event.id + '\', \'A\')">' + event.choiceA.text + '</button>';
  html += '<button class="modal-btn" onclick="onEventChoice(\'' + event.id + '\', \'B\')">' + event.choiceB.text + '</button>';
  showModal(html);
}

/**
 * Handle player's choice. Applies effect and resumes game.
 * @param {string} eventId
 * @param {string} choice - 'A' or 'B'
 */
function onEventChoice(eventId, choice) {
  console.log('[event] choice', eventId, choice);
  var event = null;
  for (var i = 0; i < EVENT_DEFS.length; i++) {
    if (EVENT_DEFS[i].id === eventId) { event = EVENT_DEFS[i]; break; }
  }
  if (!event) {
    console.log('[event] event not found:', eventId);
    closeModal();
    gameState.paused = false;
    return;
  }

  var c = choice === 'A' ? event.choiceA : event.choiceB;
  applyEventEffect(event.id, c);
  closeModal();
  gameState.paused = false;
  renderPlayerPanel();
}

/**
 * Apply an event effect to player.
 * @param {string} eventId
 * @param {Object} choice - { text, effect, params }
 */
function applyEventEffect(eventId, choice) {
  var effect = choice.effect;
  var p = choice.params || {};
  console.log('[event] apply', effect, eventId, JSON.stringify(p));

  switch (effect) {
    // === Basic stat modifications ===
    case 'heal':
      var heal = Math.min(player.maxHp - player.hp, p.amount || 20);
      player.hp += heal;
      addLog('事件恢复 ' + heal + ' HP', 'heal');
      break;

    case 'damage':
      player.hp -= (p.hp || 10);
      addLog('事件受到 ' + (p.hp || 10) + ' 点伤害', 'dmg');
      break;

    case 'restoreMp':
      var mpRestore = Math.min(player.maxMp - player.mp, p.amount || 15);
      player.mp += mpRestore;
      addLog('事件恢复 ' + mpRestore + ' MP', 'heal');
      break;

    case 'giveGold':
      player.gold += (p.amount || 10);
      addLog('事件获得 ' + (p.amount || 10) + ' 金币', 'loot');
      break;

    case 'takeGold':
      var loss = Math.min(player.gold, p.amount || 10);
      player.gold -= loss;
      addLog('事件失去 ' + loss + ' 金币', 'dmg');
      break;

    // === Item effects ===
    case 'giveItem':
      var itemId = p.item || 'hp_potion';
      player.inventory[itemId] = (player.inventory[itemId] || 0) + (p.count || 1);
      var itemDef = ITEMS_DATA[itemId];
      addLog('事件获得 ' + (itemDef ? itemDef.name : itemId), 'loot');
      break;

    // === Status effects ===
    case 'poison':
      // Remove existing poison if any, add new one
      player.statuses = player.statuses.filter(function (s) { return s.id !== 'poison'; });
      player.statuses.push({
        id: 'poison',
        type: 'dot',
        turnsLeft: p.turns || 3,
        value: p.value || 4,
      });
      addLog('你中毒了（' + (p.turns || 3) + '回合，每回合-' + (p.value || 4) + 'HP）', 'dmg');
      break;

    case 'debuffSpd':
      player._slowTurns = (p.turns || 2);
      addLog('行动迟缓 ' + (p.turns || 2) + ' 回合', 'dmg');
      break;

    case 'buffNextCombat':
      // Temporary ATK bonus for next combat encounter
      player._eventAtkBonus = (p.atk || 3);
      addLog('下次战斗攻击力+' + (p.atk || 3), 'loot');
      break;

    // === Special NPC effects ===
    case 'buyPotion':
      if (player.gold >= (p.cost || 15)) {
        player.gold -= (p.cost || 15);
        player.inventory.hp_potion = (player.inventory.hp_potion || 0) + 1;
        addLog('花 ' + (p.cost || 15) + ' 金币买了 1 生命药水', 'loot');
      } else {
        addLog('金币不够买药水', 'info');
      }
      break;

    case 'sellEquipment':
      var sold = false;
      for (var slot of ['weapon', 'armor', 'accessory']) {
        if (player.equip[slot]) {
          var eq = player.equip[slot];
          var sellPrice = (eq.price || 20);
          player.gold += sellPrice;
          addLog('出售 ' + eq.name + '，获得 ' + sellPrice + ' 金币', 'loot');
          player.equip[slot] = null;
          sold = true;
          // Only sell the first found slot
          break;
        }
      }
      if (!sold) {
        addLog('你没有可出售的装备', 'info');
      }
      break;

    case 'healKnight':
      if (player.inventory.hp_potion && player.inventory.hp_potion > 0) {
        player.inventory.hp_potion--;
        if (player.inventory.hp_potion <= 0) delete player.inventory.hp_potion;
        var reward = p.reward || 30;
        player.gold += reward;
        addLog('治疗了骑士，获得 ' + reward + ' 金币奖励', 'loot');
      } else {
        addLog('没有生命药水可以治疗', 'info');
      }
      break;

    case 'nothing':
      addLog('你离开了受伤的骑士', 'info');
      break;

    // === Special encounter effects ===
    case 'fightAnimal':
      var animalExp = p.exp || 20;
      var animalDmg = p.hpCost || 10;
      player.exp += animalExp;
      player.hp -= animalDmg;
      addLog('击败野兽！+' + animalExp + 'EXP，-' + animalDmg + 'HP', 'loot');
      // Check level up
      if (player.exp >= player.expNext) {
        player.exp -= player.expNext;
        player.lvl++;
        player.expNext = calcExpNext(player.lvl);
        recalcPlayerStats();
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        addLog('升级！达到 Lv.' + player.lvl, 'loot');
      }
      break;

    case 'bribeAnimal':
      if (player.gold >= (p.cost || 10)) {
        player.gold -= (p.cost || 10);
        addLog('花 ' + (p.cost || 10) + ' 金币让野兽离开', 'info');
      } else {
        addLog('金币不够贿赂野兽，但它似乎也没兴趣', 'info');
      }
      break;

    case 'shrineOffer':
      if (player.gold >= (p.cost || 20)) {
        player.gold -= (p.cost || 20);
        player._eventAtkBonus = (player._eventAtkBonus || 0) + 8;
        addLog('供奉了金币，获得力量祝福（下次战斗ATK+8）', 'loot');
      } else {
        // Not enough gold, just pray
        var shrineHeal = Math.min(player.maxHp - player.hp, 25);
        player.hp += shrineHeal;
        addLog('金币不够供奉，改为祈祷，恢复 ' + shrineHeal + ' HP', 'heal');
      }
      break;

    case 'duelRival':
      // Risk/reward: 50% win (get gold) vs 50% lose (take damage)
      if (Math.random() < 0.5) {
        var duelGold = rng(15, 30);
        player.gold += duelGold;
        addLog('在决斗中获胜！获得 ' + duelGold + ' 金币', 'loot');
      } else {
        var duelDmg = rng(10, 20);
        player.hp -= duelDmg;
        addLog('决斗失败，受到 ' + duelDmg + ' 点伤害', 'dmg');
      }
      break;

    case 'shareRival':
      var sharedGold = rng(5, 15);
      player.gold += sharedGold;
      addLog('与冒险者友好共享，获得 ' + sharedGold + ' 金币', 'loot');
      break;

    case 'faceGhost':
      var ghostGold = rng(10, 25);
      player.gold += ghostGold;
      addLog('直面幽灵，获得灵魂馈赠 ' + ghostGold + ' 金币', 'loot');
      break;

    default:
      console.log('[event] unknown effect:', effect);
      addLog('神秘的力量笼罩了你...', 'info');
      break;
  }

  // Clamp HP
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  if (player.hp < 0) player.hp = 0;

  // Check death
  if (player.hp <= 0) {
    addLog('你在事件中倒下了...', 'dmg');
  }
}

// Global exports for onclick handlers
window.onEventChoice = onEventChoice;
