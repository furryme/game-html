// audio.js — Procedural sound effects via Web Audio API

var audioCtx = null;
var _stepCounter = 0;

/**
 * Create AudioContext on first user gesture (autoplay policy).
 * Idempotent — safe to call multiple times.
 */
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    console.log('[audio] AudioContext created, state:', audioCtx.state);
  } catch (e) {
    console.log('[audio] AudioContext failed:', e.message);
  }
}

/**
 * Play a named sound effect. No-op if context missing or name unknown.
 * @param {string} name
 */
function playSound(name) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(function () {});
  }
  var fn = SOUND_MAP[name];
  if (!fn) {
    console.log('[audio] unknown sound:', name);
    return;
  }
  try {
    fn(audioCtx);
  } catch (e) {
    console.log('[audio] playSound(' + name + ') error:', e.message);
  }
}

// ---- Sound generators ----

function _attack(ctx) {
  var t = ctx.currentTime;
  // Noise burst via short buffer
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  var noise = ctx.createBufferSource();
  noise.buffer = buf;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(0.35, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  noise.connect(ng).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.05);
  // Low sweep
  var osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.05);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

function _crit(ctx) {
  var t = ctx.currentTime;
  // Base attack layer
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
  var noise = ctx.createBufferSource();
  noise.buffer = buf;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(0.4, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  noise.connect(ng).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.06);
  // Low sweep
  var osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
  // High pitch accent
  var accent = ctx.createOscillator();
  accent.type = 'square';
  accent.frequency.setValueAtTime(1200, t + 0.02);
  accent.frequency.exponentialRampToValueAtTime(800, t + 0.1);
  var ag = ctx.createGain();
  ag.gain.setValueAtTime(0.2, t + 0.02);
  ag.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  accent.connect(ag).connect(ctx.destination);
  accent.start(t + 0.02);
  accent.stop(t + 0.1);
}

function _defend(ctx) {
  var t = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.08);
}

function _heal(ctx) {
  var t = ctx.currentTime;
  var notes = [440, 660];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.08);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.12);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.12);
  });
}

function _levelUp(ctx) {
  var t = ctx.currentTime;
  var notes = [330, 440, 660];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t + i * 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.15);
  });
}

function _death(ctx) {
  var t = ctx.currentTime;
  var notes = [400, 350, 280, 200];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t + i * 0.15);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(t + i * 0.15);
    osc.stop(t + i * 0.15 + 0.18);
  });
}

function _pickup(ctx) {
  var t = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.setValueAtTime(1800, t + 0.04);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function _bossPhase(ctx) {
  var t = ctx.currentTime;
  // Deep rumble
  var osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(40, t);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
  // Rising tension
  var osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(80, t);
  osc2.frequency.exponentialRampToValueAtTime(300, t + 0.5);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc2.connect(g2).connect(ctx.destination);
  osc2.start(t);
  osc2.stop(t + 0.5);
}

function _step(ctx) {
  _stepCounter++;
  if (_stepCounter % 4 !== 0) return;
  var t = ctx.currentTime;
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.015), ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  var noise = ctx.createBufferSource();
  noise.buffer = buf;
  var filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(filter).connect(g).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.03);
}

function _shop(ctx) {
  var t = ctx.currentTime;
  // "cha" — low metallic ping
  var osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(600, t);
  var g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.2, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc1.connect(g1).connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.06);
  // "ching" — high bright ping
  var osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1600, t + 0.08);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.25, t + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc2.connect(g2).connect(ctx.destination);
  osc2.start(t + 0.08);
  osc2.stop(t + 0.2);
}

// ---- Sound name -> function map ----

var SOUND_MAP = {
  attack: _attack,
  crit: _crit,
  defend: _defend,
  heal: _heal,
  levelUp: _levelUp,
  death: _death,
  pickup: _pickup,
  bossPhase: _bossPhase,
  step: _step,
  shop: _shop,
};

// Expose globally
window.initAudio = initAudio;
window.playSound = playSound;
