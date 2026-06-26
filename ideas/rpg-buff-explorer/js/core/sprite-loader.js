// sprite-loader.js — PNG sprite sheet loader for HD skin system
// Loads manifest.json, creates Image objects, returns clip rects for drawImage
// Pure incremental: does not modify string-based sprite rendering.

function SpriteLoader() {
  this._sheets = {};    // name -> {image, entry, ready, error}
  this._total = 0;
  this._loaded = 0;
  this._deferred = [];  // waitForAll promises waiting for completion
}

SpriteLoader.prototype.load = function (manifestPath, basePath) {
  var self = this;

  this._sheets = {};
  this._total = 0;
  this._loaded = 0;
  this._deferred = [];

  var xhr = new XMLHttpRequest();
  xhr.open('GET', manifestPath, true);
  xhr.responseType = 'json';
  xhr.onload = function () {
    if (xhr.status >= 400) {
      console.log('[sprite] manifest XHR error status=' + xhr.status + ' path=' + manifestPath);
      self._resolveDeferred(false);
      return;
    }
    var manifest = xhr.response;
    self._total = Object.keys(manifest).length;
    console.log('[sprite] manifest loaded ok, entries=' + self._total + ' names=' + JSON.stringify(Object.keys(manifest)));
    if (self._total === 0) {
      self._resolveDeferred(true);
      return;
    }
    var names = Object.keys(manifest);
    for (var i = 0; i < names.length; i++) {
      self._loadOne(names[i], manifest[names[i]], basePath);
    }
  };
  xhr.onerror = function () {
    console.log('[sprite] manifest XHR onerror path=' + manifestPath);
    self._resolveDeferred(false);
  };
  xhr.send();
};

SpriteLoader.prototype._loadOne = function (name, entry, basePath) {
  var self = this;
  var img = new Image();
  img.crossOrigin = 'anonymous';

  var sheet = {
    image: img,
    entry: entry,
    ready: false,
    error: false
  };

  // 如果有独立的 combatSrc，加载战斗精灵图
  this._hasCombatSrc = {};

  var loadCount = entry.combatSrc ? 2 : 1;
  var loadedCount = 0;
  var hadError = false;

  var onOneDone = function (err) {
    if (err) hadError = true;
    loadedCount++;
    if (loadedCount >= loadCount) {
      sheet.ready = !hadError;
      sheet.error = hadError;
      self._loaded++;
      self._checkDone();
    }
  };

  this._sheets[name] = sheet;

  var mapUrl = basePath + entry.src;
  img.onload = function () {
    console.log('[sprite] img loaded name=' + name + ' map=' + entry.src + ' size=' + img.naturalWidth + 'x' + img.naturalHeight);
    onOneDone(false);
  };
  img.onerror = function () {
    console.log('[sprite] img ERROR name=' + name + ' url=' + mapUrl);
    onOneDone(true);
  };
  img.src = mapUrl;

  // 加载独立的战斗精灵图（如果指定了 combatSrc）
  if (entry.combatSrc) {
    var combatUrl = basePath + entry.combatSrc;
    var combatImg = new Image();
    combatImg.crossOrigin = 'anonymous';
    sheet.combatImage = combatImg;
    this._hasCombatSrc[name] = true;

    combatImg.onload = function () {
      console.log('[sprite] combat img loaded name=' + name + ' combatSrc=' + entry.combatSrc + ' size=' + combatImg.naturalWidth + 'x' + combatImg.naturalHeight);
      onOneDone(false);
    };
    combatImg.onerror = function () {
      console.log('[sprite] combat img ERROR name=' + name + ' url=' + combatUrl);
      onOneDone(true);
    };
    combatImg.src = combatUrl;
  }
};

SpriteLoader.prototype._checkDone = function () {
  if (this._loaded >= this._total) {
    this._resolveDeferred(true);
  }
};

SpriteLoader.prototype._resolveDeferred = function (ok) {
  console.log('[sprite] waitForAll resolve ok=' + ok + ' loaded=' + this._loaded + '/' + this._total);
  var deferred = this._deferred;
  this._deferred = [];
  for (var i = 0; i < deferred.length; i++) {
    deferred[i](ok);
  }
};

SpriteLoader.prototype.isReady = function (name) {
  var s = this._sheets[name];
  return s && s.ready && !s.error;
};

SpriteLoader.prototype.isReadyAll = function () {
  var names = Object.keys(this._sheets);
  for (var i = 0; i < names.length; i++) {
    if (!this._sheets[names[i]].ready) return false;
  }
  return names.length > 0;
};

SpriteLoader.prototype.waitForAll = function () {
  var self = this;
  if (this._loaded >= this._total && this._total > 0) {
    var allOk = true;
    var names = Object.keys(this._sheets);
    for (var i = 0; i < names.length; i++) {
      if (this._sheets[names[i]].error) { allOk = false; break; }
    }
    return Promise.resolve(allOk);
  }
  if (this._total === 0) {
    return Promise.resolve(false);
  }
  return new Promise(function (resolve) {
    self._deferred.push(resolve);
  });
};

SpriteLoader.prototype.getSprite = function (name, animName, frameIndex, isCombat) {
  var s = this._sheets[name];
  if (!s || !s.ready) return null;

  var entry = s.entry;
  var anims = isCombat ? entry.combatAnimations : entry.animations;
  if (!anims || !anims[animName]) return null;

  var anim = anims[animName];
  var frames = anim.frames;
  if (!frames || frames.length === 0) return null;

  var idx = ((frameIndex || 0) % frames.length + frames.length) % frames.length;
  var frameIdx = frames[idx];

  var sw = isCombat ? entry.combatFrameW : entry.frameW;
  var sh = isCombat ? entry.combatFrameH : entry.frameH;

  // 如果有独立的 combatSrc，战斗时使用 combatImage
  var img = s.image;
  if (isCombat && s.combatImage) {
    img = s.combatImage;
  }
  if (!img) return null;

  return {
    image: img,
    sx: frameIdx * sw,
    sy: 0,
    sw: sw,
    sh: sh
  };
};

SpriteLoader.prototype.getFrameCount = function (name, animName, isCombat) {
  var s = this._sheets[name];
  if (!s) return 0;

  var anims = isCombat ? s.entry.combatAnimations : s.entry.animations;
  if (!anims || !anims[animName]) return 0;

  return anims[animName].frames.length;
};

SpriteLoader.prototype.getAnimationNames = function (name, isCombat) {
  var s = this._sheets[name];
  if (!s) return [];

  var anims = isCombat ? s.entry.combatAnimations : s.entry.animations;
  if (!anims) return [];

  return Object.keys(anims);
};

SpriteLoader.prototype.getSpeed = function (name, animName, isCombat) {
  var s = this._sheets[name];
  if (!s) return 0;

  var anims = isCombat ? s.entry.combatAnimations : s.entry.animations;
  if (!anims || !anims[animName]) return 0;

  return anims[animName].speed || 15;
};

// Return manifest entry + loaded image(s) in the format drawPlayerSprite expects
SpriteLoader.prototype.getEntryWithData = function (name, isCombat) {
  var s = this._sheets[name];
  if (!s || !s.ready || !s.entry) return null;
  if (!this._lastGetDataLogged || this._lastGetDataLogged.name !== name) {
    console.log('[sprite] getEntryWithData name=' + name + ' isCombat=' + isCombat + ' ready=' + s.ready + ' hasCombatImg=' + !!s.combatImage);
    this._lastGetDataLogged = { name: name };
  }

  var entry = s.entry;
  var img;

  if (isCombat && s.combatImage) {
    img = s.combatImage;
  } else {
    img = s.image;
  }
  if (!img) return null;

  var result = {
    image: img,
    frameW: entry.frameW,
    frameH: entry.frameH,
    animations: entry.animations,
    combatFrameW: entry.combatFrameW,
    combatFrameH: entry.combatFrameH,
    combatAnimations: entry.combatAnimations
  };
  return result;
};

// Also return the frame index within the sheet for a given animation frame
SpriteLoader.prototype.getSheetFrameIndex = function (name, animName, frameIndex, isCombat) {
  var s = this._sheets[name];
  if (!s) return -1;

  var anims = isCombat ? s.entry.combatAnimations : s.entry.animations;
  if (!anims || !anims[animName]) return -1;

  var frames = anims[animName].frames;
  if (!frames || frames.length === 0) return -1;

  var idx = ((frameIndex || 0) % frames.length + frames.length) % frames.length;
  return frames[idx];
};

// Clear all loaded images for GC when switching themes
SpriteLoader.prototype.clear = function () {
  var names = Object.keys(this._sheets);
  for (var i = 0; i < names.length; i++) {
    var s = this._sheets[names[i]];
    if (s.image) { s.image.src = ''; s.image = null; }
    if (s.combatImage) { s.combatImage.src = ''; s.combatImage = null; }
  }
  this._sheets = {};
  this._total = 0;
  this._loaded = 0;
  this._deferred = [];
};

// Export for inline script loading
if (typeof window !== 'undefined') {
  window.SpriteLoader = SpriteLoader;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpriteLoader;
}

// Initialize ThemeManager now that SpriteLoader is defined.
// This must happen after sprite-loader.js is parsed because _applySpriteAssets
// guards on `window.SpriteLoader` being available (see theme.js _applySpriteAssets).
// Previously ThemeManager.init() was at the bottom of theme.js which loaded before
// sprite-loader.js, causing HD sprites to not load on page refresh.
if (typeof ThemeManager !== 'undefined') {
  ThemeManager.init();
}
