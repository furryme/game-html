// utils.js — Utility functions

/** Random integer in [min, max] inclusive. */
function rng(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Clamp v to [min, max]. */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Pick a random element from array. */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Shuffle array in-place (Fisher-Yates). */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Manhattan distance. */
function manhattan(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/** Check tile coordinates within map bounds. */
function inBounds(x, y) {
  return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
}

/**
 * Weighted random pick.
 * @param {Array} items - [{item, weight}] or [{weight, ...}] (if no .item, returns the entry itself)
 */
function weightedPick(items) {
  const total = items.reduce(function (s, i) { return s + i.weight; }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight;
    if (r <= 0) return items[i].item !== undefined ? items[i].item : items[i];
  }
  var last = items[items.length - 1];
  return last.item !== undefined ? last.item : last;
}

/** Add a log entry to the game log panel. */
function addLog(msg, type) {
  type = type || 'info';
  const logEl = document.getElementById('log');
  if (!logEl) return;
  const entry = document.createElement('div');
  entry.className = 'log-entry log-' + type;
  entry.innerHTML = msg;
  logEl.appendChild(entry);
  while (logEl.children.length > 50) {
    logEl.removeChild(logEl.firstChild);
  }
  logEl.scrollTop = logEl.scrollHeight;
}

/** Show a modal overlay with HTML content. */
function showModal(html) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }
  overlay.innerHTML = '<div class="modal">' + html + '</div>';
  overlay.style.display = 'flex';
}

/** Close the modal overlay. */
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

/** Activate a screen by id (e.g. 'title', 'game', 'combat', 'gameover'). */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  // 'dungeon', 'game', 'combat' don't have overlay screens — just hide all overlays
  // combat renders on canvas, buttons are in sidebar — no HTML overlay needed
  if (id === 'dungeon' || id === 'game' || id === 'combat') {
    // Also force hide combat-screen to prevent z-index blocking clicks
    var cs = document.getElementById('combat-screen');
    if (cs) cs.style.display = 'none';
    return;
  }
  const el = document.getElementById(id + '-screen');
  if (el) el.classList.add('active');
}

/**
 * Look up a buff definition by id. BUFF_DEFS is an array of objects with an 'id' field.
 * @param {string} id
 * @returns {Object|null}
 */
function findBuffDef(id) {
  for (let i = 0; i < BUFF_DEFS.length; i++) {
    if (BUFF_DEFS[i].id === id) return BUFF_DEFS[i];
  }
  return null;
}
