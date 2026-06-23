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
      self._resolveDeferred(false);
      return;
    }
    var manifest = xhr.response;
    self._total = Object.keys(manifest).length;
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
    self._resolveDeferred(false);
  };
  xhr.send();
};

SpriteLoader.prototype._loadOne = function (name, entry, basePath) {
  var self = this;
  var img = new Image();
  img.crossOrigin = 'anonymous';

  this._sheets[name] = {
    image: img,
    entry: entry,
    ready: false,
    error: false
  };

  var onSet = function () {
    self._sheets[name].ready = true;
    self._loaded++;
    self._checkDone();
  };
  var onErr = function () {
    self._sheets[name].error = true;
    self._loaded++;
    self._checkDone();
  };

  img.onload = onSet;
  img.onerror = onErr;
  img.onloadstart = function () {
    img.onload = onSet;
    img.onerror = onErr;
  };

  img.src = basePath + entry.src;
};

SpriteLoader.prototype._checkDone = function () {
  if (this._loaded >= this._total) {
    this._resolveDeferred(true);
  }
};

SpriteLoader.prototype._resolveDeferred = function (ok) {
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
  if (!s || !s.ready || !s.image) return null;

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

  return {
    image: s.image,
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
    this._sheets[names[i]].image.src = '';
    this._sheets[names[i]].image = null;
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
