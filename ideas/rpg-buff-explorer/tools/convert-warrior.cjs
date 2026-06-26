// 战士角色转换脚本：高清图 -> 精灵图（带动画）
const sharp = require('sharp');
const { writeFileSync, mkdirSync, readdirSync } = require('fs');
const path = require('path');

const SRC = 'art_tiger-warrior.png';
const OUT_DIR = 'js/data/sprite-assets/high-res';
mkdirSync(OUT_DIR, { recursive: true });

const PREVIEWS = [8, 16, 24, 32, 48, 64, 128, 256];

// 8帧动画配置：每帧的偏移、缩放、效果
const FRAME_CONFIG = [
  { dx: 0, dy: 0, scale: 1, effect: 'none' },       // 0: idle-0 正常站立
  { dx: 0, dy: -1, scale: 1.02, effect: 'none' },   // 1: idle-1 呼吸（上移+微放大）
  { dx: 1, dy: 1, scale: 1, effect: 'none' },       // 2: walk-0 右步前倾
  { dx: -1, dy: 0, scale: 1, effect: 'none' },      // 3: walk-1 左步回正
  { dx: 2, dy: 1, scale: 1, effect: 'none' },       // 4: walk-2 右步延伸
  { dx: -2, dy: 0, scale: 1, effect: 'none' },      // 5: walk-3 左步延伸
  { dx: 3, dy: 0, scale: 1, effect: 'attack' },     // 6: attack 突刺+白闪
  { dx: -3, dy: 0, scale: 1, effect: 'hurt' },      // 7: hurt 后仰+红闪
];

// 帧排列：[R, R, L, R, L, R, R, R] — frames 2,4 需要翻转
const FRAME_FACE = [false, false, true, false, true, false, false, false];

async function main() {
  console.log('[1] 读取原图: ' + SRC);
  const meta = await sharp(SRC).metadata();
  console.log('  尺寸: ' + meta.width + 'x' + meta.height);

  // 检测非白区域（排除元数据和白色背景）
  console.log('[2] 分析像素...');
  const { data: orig, info: oi } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const rowHasContent = new Array(oi.height).fill(false);
  const colHasContent = new Array(oi.width).fill(false);
  for (let y = 0; y < oi.height; y += 2) {
    for (let x = 0; x < oi.width; x += 2) {
      const i = (y * oi.width + x) * 4;
      if (orig[i] < 220 || orig[i+1] < 220 || orig[i+2] < 220) {
        rowHasContent[y] = true;
        colHasContent[x] = true;
      }
    }
  }

  function findBounds(arr) {
    let start = -1, end = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) {
        if (start === -1) start = i;
        end = i;
      }
    }
    return { start, end };
  }

  const rowB = findBounds(rowHasContent);
  const colB = findBounds(colHasContent);
  console.log('  行范围: ' + rowB.start + ' - ' + rowB.end);
  console.log('  列范围: ' + colB.start + ' - ' + colB.end);

  const padX = 20, padY = 10;
  const cx = Math.max(0, colB.start - padX);
  const cy = Math.max(0, rowB.start - padY);
  const cw = Math.min(oi.width - cx, (colB.end + padX) - colB.start);
  const ch = Math.min(oi.height - cy, (rowB.end + padY) - rowB.start);
  console.log('  裁剪: (' + cx + ',' + cy + ') ' + cw + 'x' + ch);

  // 裁剪 + 白底转透明
  console.log('[3] 裁剪 + 去白底...');
  const { data: cd, info: ci } = await sharp(SRC)
    .extract({ left: cx, top: cy, width: cw, height: ch })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < cd.length; i += 4) {
    const r = cd[i], g = cd[i+1], b = cd[i+2];
    if (r > 230 && g > 230 && b > 230) {
      cd[i+3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      cd[i+3] = 80;
    }
  }

  const cropped = await sharp(cd, {
    raw: { width: ci.width, height: ci.height, channels: 4 }
  }).png().toBuffer();

  console.log('  结果: ' + ci.width + 'x' + ci.height);
  writeFileSync(path.join(OUT_DIR, 'player-warrior-cropped.png'), cropped);

  // 尺寸预览
  console.log('[4] 生成尺寸预览...');
  const aspect = ci.width / ci.height;
  for (const size of PREVIEWS) {
    const pw = Math.round(size * aspect);
    const ph = size;
    const preview = await sharp(cropped)
      .resize(pw, ph, { fit: 'fill', kernel: 'nearest' })
      .png().toBuffer();
    writeFileSync(path.join(OUT_DIR, 'preview-' + size + 'px.png'), preview);
    console.log('  ' + pw + 'x' + ph);
  }

  // 地图精灵图 (32x48)
  console.log('[5] 地图精灵图 32x48 x 8帧 (contain+动画)...');
  await makeSheet(cropped, 32, 48, 'player-warrior-map.png');

  // 战斗精灵图 (48x64)
  console.log('[6] 战斗精灵图 48x64 x 8帧 (contain+动画)...');
  await makeSheet(cropped, 48, 64, 'player-warrior-combat.png');

  // 对比图
  console.log('[7] 对比图...');
  await makeCompare(cropped);

  console.log('\n[DONE] 文件列表:');
  readdirSync(OUT_DIR).forEach(function(f) { console.log('  ' + f); });

  console.log('\n=== manifest.json 条目 ===');
  console.log(getManifestEntry());
}

async function makeSheet(imgBuf, fw, fh, filename) {
  // 计算人物在帧中的实际内容尺寸
  // 源图比例 ~0.5 (430/868)
  // contain: 以较短边为基准，确保完整放入
  const srcW = 430, srcH = 868;
  const srcAspect = srcW / srcH; // ~0.495
  const frameAspect = fw / fh;

  // contain 缩放：取 min(fw/srcW, fh/srcH) 作为缩放因子
  const scale = Math.min(fw / srcW, fh / srcH);
  const charW = Math.round(srcW * scale);
  const charH = Math.round(srcH * scale);
  const charCenterX = Math.round((fw - charW) / 2);
  const charCenterY = Math.round((fh - charH) / 2);

  console.log('  frame ' + fw + 'x' + fh + ', char ' + charW + 'x' + charH +
    ', center (' + charCenterX + ',' + charCenterY + ')');

  // 创建透明底图函数
  function createTransparent(w, h) {
    const buf = Buffer.alloc(w * h * 4, 0);
    return sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  }

  // 正向人物：resize 到实际内容尺寸
  const charRight = await sharp(imgBuf)
    .resize(charW, charH, { kernel: 'nearest' })
    .ensureAlpha().png().toBuffer();

  // 翻转人物
  const charLeft = await sharp(imgBuf)
    .resize(charW, charH, { kernel: 'nearest' })
    .flop().ensureAlpha().png().toBuffer();

  // 为每帧生成偏移帧
  const frames = [];
  for (let i = 0; i < FRAME_CONFIG.length; i++) {
    const cfg = FRAME_CONFIG[i];

    // 选择翻转方向
    const isFlipped = FRAME_FACE[i];
    const baseChar = isFlipped ? charLeft : charRight;

    // 缩放（idle-1），确保不超出帧
    let charForFrame = baseChar;
    let thisCharW = charW;
    let thisCharH = charH;
    if (cfg.scale !== 1) {
      thisCharW = Math.min(fw, Math.round(charW * cfg.scale));
      thisCharH = Math.min(fh, Math.round(charH * cfg.scale));
      charForFrame = await sharp(baseChar)
        .resize(thisCharW, thisCharH, { kernel: 'nearest' })
        .ensureAlpha().png().toBuffer();
    }

    // 计算偏移
    // Map (32px): 直接用 cfg.dx/dy
    // Combat (48px): 放大 1.5x 偏移
    const scaleX = fw <= 32 ? 1 : 1.5;
    const scaleY = fw <= 32 ? 1 : 1.5;
    const dx = Math.round(cfg.dx * scaleX);
    const dy = Math.round(cfg.dy * scaleY);

    let left = Math.round((fw - thisCharW) / 2) + dx;
    let top = Math.round((fh - thisCharH) / 2) + dy;

    // clamp
    left = Math.max(0, Math.min(fw - thisCharW, left));
    top = Math.max(0, Math.min(fh - thisCharH, top));

    console.log('  frame ' + i + ' (' + (isFlipped ? 'L' : 'R') +
      '): pos(' + left + ',' + top + ') char(' + thisCharW + 'x' + thisCharH + ')');

    // 创建帧画布（透明）
    const frameCanvas = await createTransparent(fw, fh);

    // 放置人物
    let frameResult = await sharp(frameCanvas).composite([{
      input: charForFrame,
      left: left,
      top: top
    }]).png().toBuffer();

    // 攻击帧：白色闪烁叠加
    if (cfg.effect === 'attack') {
      const whiteBuf = Buffer.alloc(fw * fh * 4);
      for (let pi = 0; pi < fw * fh * 4; pi += 4) {
        whiteBuf[pi] = 255; whiteBuf[pi+1] = 255; whiteBuf[pi+2] = 255; whiteBuf[pi+3] = 80;
      }
      const whiteImg = await sharp(whiteBuf, { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer();
      frameResult = await sharp(frameResult).composite([{
        input: whiteImg,
        blend: 'screen'
      }]).png().toBuffer();
    }

    // 受伤帧：红色闪烁叠加
    if (cfg.effect === 'hurt') {
      const redBuf = Buffer.alloc(fw * fh * 4);
      for (let pi = 0; pi < fw * fh * 4; pi += 4) {
        redBuf[pi] = 255; redBuf[pi+1] = 0; redBuf[pi+2] = 0; redBuf[pi+3] = 80;
      }
      const redImg = await sharp(redBuf, { raw: { width: fw, height: fh, channels: 4 } }).png().toBuffer();
      frameResult = await sharp(frameResult).composite([{
        input: redImg,
        blend: 'screen'
      }]).png().toBuffer();
    }

    frames.push(frameResult);
  }

  // 拼接精灵图（8帧水平排列）
  const sheetW = fw * 8;
  const sheetH = fh;
  const sheetBg = await createTransparent(sheetW, sheetH);

  const overlays = frames.map(function(frame, i) {
    return { input: frame, left: i * fw, top: 0 };
  });

  const result = await sharp(sheetBg).composite(overlays).png().toBuffer();
  writeFileSync(path.join(OUT_DIR, filename), result);
  console.log('  -> ' + filename + ' (' + sheetW + 'x' + sheetH + ')');
}

async function makeCompare(imgBuf) {
  const sizes = [32, 48, 64, 128];
  const parts = [];
  for (const s of sizes) {
    parts.push({
      buf: await sharp(imgBuf)
        .resize(s, Math.round(s * 1.5), { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha().png().toBuffer(),
      w: s
    });
  }

  let tw = 20;
  parts.forEach(function(p) { tw += p.w + 15; });
  const th = 210;

  const bg = Buffer.alloc(tw * th * 4);
  for (let i = 0; i < bg.length; i += 4) {
    bg[i] = 20; bg[i+1] = 20; bg[i+2] = 40; bg[i+3] = 255;
  }

  const bgPng = await sharp(bg, { raw: { width: tw, height: th, channels: 4 } }).png().toBuffer();

  const overlays = [];
  let ox = 10;
  parts.forEach(function(p) {
    overlays.push({ input: p.buf, left: ox, top: 10 });
    ox += p.w + 15;
  });

  const result = await sharp(bgPng).composite(overlays).png().toBuffer();
  writeFileSync(path.join(OUT_DIR, 'compare-sizes.png'), result);
  console.log('  -> compare-sizes.png');
}

function getManifestEntry() {
  return JSON.stringify({
    "player-warrior": {
      "src": "player-warrior-map.png",
      "frameW": 32, "frameH": 48,
      "animations": {
        "idle":   { frames: [0, 1], speed: 20 },
        "walk":   { frames: [2, 3, 4, 5], speed: 12 },
        "attack": { frames: [6], speed: 8 },
        "hurt":   { frames: [7], speed: 10 }
      },
      "combatSrc": "player-warrior-combat.png",
      "combatFrameW": 48, "combatFrameH": 64,
      "combatAnimations": {
        "idle":   { frames: [0, 1], speed: 20 },
        "walk":   { frames: [2, 3, 4, 5], speed: 12 },
        "attack": { frames: [6], speed: 8 },
        "hurt":   { frames: [7], speed: 10 }
      }
    }
  }, null, 2);
}

main().catch(function(e) {
  console.error('错误: ' + e.message);
  console.error(e.stack);
  process.exit(1);
});
