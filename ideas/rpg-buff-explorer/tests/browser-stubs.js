// browser-stubs.js — Minimal browser API stubs for Node.js
// Load this BEFORE any game JS files.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// --- Global object setup ---
globalThis.window = globalThis;
globalThis.document = {
  _elements: {},
  _body: { style: {}, appendChild: function () {} },
  getElementById(id) {
    if (!this._elements[id]) {
      this._elements[id] = {
        style: { display: 'block' },
        innerHTML: '',
        className: '',
        classList: { add: function () {}, remove: function () {}, toggle: function () {} },
        children: [],
        childNodes: [],
        scrollHeight: 0, scrollTop: 0,
        firstChild: null,
        addEventListener: function () {},
        querySelectorAll: function () { return []; },
        querySelector: function () { return null; },
        getElementsByTagName: function () { return []; },
        createEvent: function () { return {}; },
        appendChild: function (c) { this.children.push(c); this.childNodes.push(c); if (!this.firstChild) this.firstChild = c; return c; },
        removeChild: function (c) { const i = this.children.indexOf(c); if (i !== -1) this.children.splice(i, 1); },
      };
    }
    return this._elements[id];
  },
  querySelectorAll(sel) {
    const results = [];
    for (const id in this._elements) {
      results.push(this._elements[id]);
    }
    return results;
  },
  querySelector(sel) {
    if (sel.startsWith('#')) {
      return this.getElementById(sel.slice(1));
    }
    return null;
  },
  createElement(tag) {
    const el = {
      style: { display: 'flex' },
      innerHTML: '',
      className: '',
      classList: { add: function () {}, remove: function () {} },
      children: [],
      addEventListener: function () {},
      appendChild: function () {},
      removeChild: function () {},
      firstChild: null,
      scrollHeight: 0, scrollTop: 0,
      querySelectorAll: function () { return []; },
      setAttribute: function () {},
    };
    return el;
  },
  body: { style: {}, appendChild: function () {} },
  addEventListener: function () {},
};
globalThis.document.body = globalThis.document._body;

// --- Canvas stub ---
globalThis.HTMLCanvasElement = function () {
  return {
    getContext: function () {
      return {
        fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', globalAlpha: 1,
        fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
        fillText: function () {}, strokeText: function () {},
        beginPath: function () {}, arc: function () {}, stroke: function () {}, closePath: function () {},
        drawImage: function () {},
        save: function () {}, restore: function () {},
        setTransform: function () {}, translate: function () {}, scale: function () {}, rotate: function () {},
        measureText: function () { return { width: 0 }; },
        getImageData: function () { return { data: [] }; },
        putImageData: function () {},
        createImageData: function () { return { data: [] }; },
      };
    },
    width: 0, height: 0,
  };
};

// --- localStorage stub ---
const _localStorageData = {};
globalThis.localStorage = {
  _data: _localStorageData,
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = String(val); },
  removeItem(key) { delete this._data[key]; },
  clear() { for (const k in this._data) delete this._data[k]; },
  key(i) { return Object.keys(this._data)[i]; },
  get length() { return Object.keys(this._data).length; },
};

// --- Sound stub ---
globalThis.playSound = function () {};

// --- Other browser APIs ---
globalThis.requestAnimationFrame = function (fn) { return setTimeout(fn, 16); };
globalThis.cancelAnimationFrame = function (id) { clearTimeout(id); };
globalThis.setTimeout = globalThis.setTimeout;
globalThis.setInterval = globalThis.setInterval;
globalThis.clearTimeout = globalThis.clearTimeout;

// --- AudioContext stub ---
globalThis.AudioContext = function () {
  return {
    createGain: function () { return { gain: {}, connect: function () {} }; },
    createOscillator: function () { return { type: '', frequency: {}, connect: function () {}, start: function () {}, stop: function () {} }; },
    createBufferSource: function () { return { connect: function () {}, start: function () {}, stop: function () {} }; },
    createBuffer: function () { return null; },
    destination: {},
    sampleRate: 44100,
  };
};

/**
 * Load all game JS files into the current context.
 * @param {string} baseDir — path to the game root (contains js/ directory)
 */
function loadGameFiles(baseDir) {
  const jsDir = path.join(baseDir, 'js');
  const fileOrder = [
    // DATA
    'data/constants.js',
    'data/palette.js',
    'data/floors.js',
    'data/enemies.js',
    'data/skills.js',
    'data/items.js',
    'data/buffs.js',
    'data/traps.js',
    'data/events.js',
    // CORE
    'core/state.js',
    'core/utils.js',
    'core/sprite.js',
    'core/fog.js',
    'core/generator.js',
    'core/buff.js',
    'core/equip.js',
    'core/movement.js',
    'core/combat.js',
    'core/boss.js',
    'core/persistence.js',
    'core/economy.js',
    'core/audio.js',
    'core/event.js',
    // VIEW
    'view/fx.js',
    'view/render.js',
    'view/ui.js',
    // CORE late
    'core/shop.js',
    // MAIN
    'main.js',
  ];

  for (const file of fileOrder) {
    const filePath = path.join(jsDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`[stub] skipping missing file: ${file}`);
      continue;
    }
    const code = fs.readFileSync(filePath, 'utf-8');
    try {
      // Use vm.runInThisContext to execute in global scope (mimics <script> tags)
      vm.runInThisContext(code, { filename: filePath, displayErrors: false });
    } catch (e) {
      console.error(`[stub] ERROR loading ${file}:`, e.message);
      console.error(e.stack);
    }
  }
}

module.exports = { loadGameFiles };
