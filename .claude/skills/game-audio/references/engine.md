# 音效引擎模板

## 完整引擎（含 BGM）

```js
/* ── 合成音效引擎 (Web Audio API) ── */
const Audio = (() => {
  let ac, muted = localStorage.getItem('[GAME]_muted') === '1';
  let bgmGain, bgmTimer, bgmPlaying = false;
  const init = () => { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); };

  const note = (freq, dur, type = 'square', vol = 0.15, delay = 0) => {
    if (muted) return;
    init();
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur);
  };

  // ── 背景音乐 ──
  const BEAT   = 0.20;
  const melody = [/* 根据游戏类型填充 */];
  const bass   = [/* 根据游戏类型填充 */];
  const loopDur = melody.length * BEAT;

  const playLoop = () => {
    if (muted || !ac) return;
    const t = ac.currentTime + 0.05;
    for (let i = 0; i < melody.length; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(melody[i], t + i * BEAT);
      g.gain.setValueAtTime(0.035, t + i * BEAT);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * BEAT + BEAT * 0.85);
      o.connect(g).connect(bgmGain);
      o.start(t + i * BEAT);
      o.stop(t + i * BEAT + BEAT * 0.9);
    }
    for (let i = 0; i < bass.length; i++) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(bass[i], t + i * BEAT * 2);
      g.gain.setValueAtTime(0.05, t + i * BEAT * 2);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * BEAT * 2 + BEAT * 1.85);
      o.connect(g).connect(bgmGain);
      o.start(t + i * BEAT * 2);
      o.stop(t + i * BEAT * 2 + BEAT * 1.9);
    }
  };

  const startBGM = () => {
    if (bgmPlaying || muted) return;
    init();
    if (!bgmGain) { bgmGain = ac.createGain(); bgmGain.connect(ac.destination); }
    bgmGain.gain.setValueAtTime(1, ac.currentTime);
    bgmPlaying = true;
    playLoop();
    bgmTimer = setInterval(playLoop, loopDur * 1000);
  };

  const stopBGM = () => {
    if (!bgmPlaying) return;
    clearInterval(bgmTimer);
    bgmTimer = null;
    bgmPlaying = false;
  };

  const setMuted = (v) => {
    muted = v;
    localStorage.setItem('[GAME]_muted', muted ? '1' : '0');
    if (bgmGain) {
      bgmGain.gain.linearRampToValueAtTime(muted ? 0 : 1, ac.currentTime + 0.05);
    }
  };

  return {
    // 在这里定义音效函数，每个函数开头检查 muted
    setMuted, startBGM, stopBGM
  };
})();
```

## 音量按钮 CSS

```css
#volBtn {
  background: none;
  border: 1px solid #555;
  border-radius: 6px;
  color: #eee;
  font-size: 16px;
  padding: 4px 10px;
  cursor: pointer;
  transition: background 0.2s;
  line-height: 1;
}
#volBtn:hover { background: #ffffff15; }
#volBtn.muted { color: #666; border-color: #444; }
```

## 音量按钮 HTML

放在页面头部区域，和分数等并列：
```html
<button id="volBtn">🔊</button>
```

## 音量按钮 JS

放在游戏 JS 的 DOM 获取部分之后：
```js
const volBtn = document.getElementById('volBtn');
let muted = localStorage.getItem('[GAME]_muted') === '1';
if (muted) { volBtn.textContent = '🔇'; volBtn.classList.add('muted'); }
volBtn.addEventListener('click', () => {
  muted = !muted;
  Audio.setMuted(muted);
  volBtn.textContent = muted ? '🔇' : '🔊';
  volBtn.classList.toggle('muted', muted);
});
```

## 关键注意事项

1. `[GAME]` 替换为游戏唯一标识（如 snake, breakout, tetris）
2. `bgmGain` 必须连接 `ac.destination`，否则 BGM 无声
3. `setMuted` 通过 `bgmGain.gain` 控制 BGM 静音，不启停循环
4. 每个音效函数开头都要 `if (muted) return`
5. `gameOver()` 音效内调用 `stopBGM()` 并放在 note 调用之前
6. 在开始按钮的 click handler 里调用 `Audio.startBGM()`
