// audio.js — Procedural sound effects via Web Audio API

var audioCtx = null;
var _stepCounter = 0;
var audioFilterNode = null;
var currentAudioTheme = null;

/**
 * Refresh audio theme from the active theme config.
 * Called by ThemeManager when theme changes.
 */
function refreshAudioTheme() {
  var theme = window.themeManager ? window.themeManager.getActive() : null;
  if (!theme || !theme.audio) return;

  if (audioFilterNode) {
    try { audioFilterNode.disconnect(); } catch (e) {}
    audioFilterNode = null;
  }

  currentAudioTheme = theme.audio;

  if (theme.audio.filterType === 'lowpass' && audioCtx) {
    audioFilterNode = audioCtx.createBiquadFilter();
    audioFilterNode.type = 'lowpass';
    audioFilterNode.frequency.value = theme.audio.filterFreq || 3000;
  }
}

/** Get current audio theme or null */
function _getAT() {
  return currentAudioTheme || (window.themeManager ? window.themeManager.getActive().audio : null) || null;
}

/** Get waveform type, respecting theme override */
function _getWaveform() {
  var at = _getAT();
  return at && at.waveformOverride ? at.waveformOverride : null;
}

/** Get tone volume multiplier: bright=1.2, dark=0.8, hollow=1.0 */
function _getToneVol() {
  var at = _getAT();
  if (!at || !at.tone) return 1;
  if (at.tone === 'bright') return 1.2;
  if (at.tone === 'dark') return 0.8;
  return 1;
}

/** Get tone name or empty string */
function _getTone() {
  var at = _getAT();
  return at && at.tone ? at.tone : '';
}

/**
 * Connect osc -> [filter if theme has filterType] -> gain -> destination.
 * Returns nothing (connection already made).
 */
function _connectOsc(osc, gain) {
  var at = _getAT();
  if (at && at.filterType) {
    var f = audioCtx.createBiquadFilter();
    f.type = at.filterType;
    f.frequency.value = at.filterFreq || 3000;
    osc.connect(f).connect(gain).connect(audioCtx.destination);
  } else {
    osc.connect(gain).connect(audioCtx.destination);
  }
}

/**
 * For 'hollow' tone: add a parallel bandpass 500-2000Hz path.
 * osc = source oscillator, gain = gain node already connected to destination.
 */
function _addHollowPath(osc, gain) {
  var f = audioCtx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1250;
  f.Q.value = 0.7;
  osc.connect(f).connect(gain);
}

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
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  var osc = ctx.createOscillator();
  osc.type = wf || 'sine';
  osc.frequency.setValueAtTime(800, t);
  osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.3 * tv, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  _connectOsc(osc, g);
  if (tone === 'hollow') _addHollowPath(osc, g);
  osc.start(t);
  osc.stop(t + 0.08);
}

function _heal(ctx) {
  var t = ctx.currentTime;
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  var notes = [440, 660];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = wf || 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.08);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2 * tv, t + i * 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.12);
    _connectOsc(osc, g);
    if (tone === 'hollow') _addHollowPath(osc, g);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.12);
  });
}

function _levelUp(ctx) {
  var t = ctx.currentTime;
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  var notes = [330, 440, 660];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = wf || 'square';
    osc.frequency.setValueAtTime(freq, t + i * 0.12);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15 * tv, t + i * 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.15);
    _connectOsc(osc, g);
    if (tone === 'hollow') _addHollowPath(osc, g);
    osc.start(t + i * 0.12);
    osc.stop(t + i * 0.12 + 0.15);
  });
}

function _death(ctx) {
  var t = ctx.currentTime;
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  var notes = [400, 350, 280, 200];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = wf || 'sawtooth';
    osc.frequency.setValueAtTime(freq, t + i * 0.15);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18 * tv, t + i * 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.18);
    _connectOsc(osc, g);
    if (tone === 'hollow') _addHollowPath(osc, g);
    osc.start(t + i * 0.15);
    osc.stop(t + i * 0.15 + 0.18);
  });
}

function _pickup(ctx) {
  var t = ctx.currentTime;
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  var osc = ctx.createOscillator();
  osc.type = wf || 'sine';
  osc.frequency.setValueAtTime(1400, t);
  osc.frequency.setValueAtTime(1800, t + 0.04);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.2 * tv, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  _connectOsc(osc, g);
  if (tone === 'hollow') _addHollowPath(osc, g);
  osc.start(t);
  osc.stop(t + 0.1);
}

function _bossPhase(ctx) {
  var t = ctx.currentTime;
  var tv = _getToneVol();
  var wf = _getWaveform();
  var tone = _getTone();
  // Deep rumble — always sine to preserve sub-bass
  var osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(40, t);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.35 * tv, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.5);
  // Rising tension — uses waveform override
  var osc2 = ctx.createOscillator();
  osc2.type = wf || 'sawtooth';
  osc2.frequency.setValueAtTime(80, t);
  osc2.frequency.exponentialRampToValueAtTime(300, t + 0.5);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.15 * tv, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  _connectOsc(osc2, g2);
  if (tone === 'hollow') _addHollowPath(osc2, g2);
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
  var wf = _getWaveform();
  var tv = _getToneVol();
  var tone = _getTone();
  // "cha" — low metallic ping
  var osc1 = ctx.createOscillator();
  osc1.type = wf || 'sine';
  osc1.frequency.setValueAtTime(600, t);
  var g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.2 * tv, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  _connectOsc(osc1, g1);
  if (tone === 'hollow') _addHollowPath(osc1, g1);
  osc1.start(t);
  osc1.stop(t + 0.06);
  // "ching" — high bright ping
  var osc2 = ctx.createOscillator();
  osc2.type = wf || 'sine';
  osc2.frequency.setValueAtTime(1600, t + 0.08);
  var g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(0.25 * tv, t + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  _connectOsc(osc2, g2);
  if (tone === 'hollow') _addHollowPath(osc2, g2);
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
window.refreshAudioTheme = refreshAudioTheme;
