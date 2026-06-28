// audio.js — Procedural sound effects via Web Audio API + BGM

var audioCtx = null;
var _stepCounter = 0;
var audioFilterNode = null;
var currentAudioTheme = null;

// BGM state
var bgmAudio = null;
var bgmPlaying = false;
var bgmVolume = 0.2; // Default volume (0.0-1.0)

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

function _skill(ctx) {
  var t = ctx.currentTime;
  // Rising square wave 600-1200Hz
  var osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
  // Short noise tail
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.02), ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  var noise = ctx.createBufferSource();
  noise.buffer = buf;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(0.15, t + 0.05);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  noise.connect(ng).connect(ctx.destination);
  noise.start(t + 0.05);
  noise.stop(t + 0.12);
}

function _trap(ctx) {
  var t = ctx.currentTime;
  // Noise burst
  var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
  var data = buf.getChannelData(0);
  for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  var noise = ctx.createBufferSource();
  noise.buffer = buf;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(0.3, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  noise.connect(ng).connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.1);
  // Low square wave drop 200-80Hz
  var osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function _deny(ctx) {
  var t = ctx.currentTime;
  var osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(150, t);
  var g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.1);
}

function _event(ctx) {
  var t = ctx.currentTime;
  var tv = _getToneVol();
  var wf = _getWaveform();
  var tone = _getTone();
  var notes = [500, 700];
  notes.forEach(function (freq, i) {
    var osc = ctx.createOscillator();
    osc.type = wf || 'sine';
    osc.frequency.setValueAtTime(freq, t + i * 0.06);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.15 * tv, t + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.1);
    _connectOsc(osc, g);
    if (tone === 'hollow') _addHollowPath(osc, g);
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + 0.1);
  });
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
  skill: _skill,
  trap: _trap,
  deny: _deny,
  event: _event,
};

// Expose globally
window.initAudio = initAudio;
window.playSound = playSound;
window.refreshAudioTheme = refreshAudioTheme;

// ==== BGM Functions ====

/**
 * Initialize and play background music (looping).
 * Creates HTMLAudioElement with base64 MP3 data.
 * Call on user gesture to comply with autoplay policy.
 */
function playBGM() {
  if (bgmPlaying) return; // Already playing

  if (!bgmAudio) {
    bgmAudio = new Audio();
    bgmAudio.loop = true;
    bgmAudio.volume = bgmVolume;

    // BGM base64 data (v6: 3.69s-8.69s segment, 300ms crossfade, MP3 48kbps)
    var bgmSrc = 'data:audio/mp3;base64,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';
    bgmAudio.src = bgmSrc;

    bgmAudio.addEventListener('ended', function() {
      // Should not fire due to loop=true, but handle just in case
      bgmPlaying = false;
    });

    bgmAudio.addEventListener('error', function(e) {
      console.log('[BGM] error:', e);
      bgmPlaying = false;
    });
  }

  // Play (may fail if no user gesture)
  bgmPlaying = true; // optimistic set — toggleBGM calls updateBGMButton synchronically right after
  bgmAudio.play().then(function() {
    console.log('[BGM] started playing');
  }).catch(function(err) {
    bgmPlaying = false; // correct flag if playback actually fails
    console.log('[BGM] play failed (autoplay policy?):', err.message);
  });
}

/**
 * Stop background music.
 */
function stopBGM() {
  if (bgmAudio && bgmPlaying) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
    bgmPlaying = false;
    console.log('[BGM] stopped');
  }
}

/**
 * Pause background music (for game pause).
 */
function pauseBGM() {
  if (bgmAudio && bgmPlaying && !bgmAudio.paused) {
    bgmAudio.pause();
    console.log('[BGM] paused');
  }
}

/**
 * Resume background music (for game resume).
 */
function resumeBGM() {
  if (bgmAudio && bgmPlaying && bgmAudio.paused) {
    bgmAudio.play().catch(function() {});
    console.log('[BGM] resumed');
  }
}

/**
 * Toggle BGM on/off.
 */
function toggleBGM() {
  var before = bgmPlaying;
  console.log('[BGM] toggleBGM called, bgmPlaying before:', before);
  if (bgmPlaying) {
    stopBGM();
  } else {
    playBGM();
  }
  console.log('[BGM] toggleBGM after play/stop, bgmPlaying:', bgmPlaying);
  // Update title screen button text if visible
  updateBGMButton();
}

/**
 * Update BGM button text on title screen.
 */
function updateBGMButton() {
  var btns = document.querySelectorAll('[onclick="toggleBGM()"]');
  var state = isBGMPlaying() ? '开' : '关';
  console.log('[BGM] updateBGMButton, isBGMPlaying:', isBGMPlaying(), 'button text:', state, 'btns found:', btns.length);
  for (var i = 0; i < btns.length; i++) {
    btns[i].innerHTML = '🎵 BGM: ' + state;
  }
}

/**
 * Set BGM volume (0.0-1.0).
 */
function setBGMVolume(vol) {
  bgmVolume = Math.max(0, Math.min(1, vol));
  if (bgmAudio) {
    bgmAudio.volume = bgmVolume;
  }
}

/**
 * Check if BGM is currently playing.
 */
function isBGMPlaying() {
  return bgmPlaying && bgmAudio && !bgmAudio.paused;
}

// Expose BGM functions globally
window.playBGM = playBGM;
window.stopBGM = stopBGM;
window.pauseBGM = pauseBGM;
window.resumeBGM = resumeBGM;
window.toggleBGM = toggleBGM;
window.setBGMVolume = setBGMVolume;
window.isBGMPlaying = isBGMPlaying;
