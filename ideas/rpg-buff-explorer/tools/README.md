# Sprite Conversion Tools

Convert high-resolution character art into pixel-perfect sprite sheets for the RPG Buff Explorer game.

## Setup

```bash
cd tools
npm install
```

Installs `sharp` (Node.js image processing library).

## Usage

### Batch Mode (with manifest)

Convert all sprites listed in a manifest file:

```bash
node sprite-convert.mjs \
  --input ./art/ \
  --output ../js/data/sprite-assets/high-res/ \
  --manifest ../js/data/sprite-assets/manifest.json
```

The manifest (`manifest.json`) defines each sprite's target frame size and animation layout:

```json
{
  "player-warrior": {
    "src": "warrior.png",
    "frameW": 32,
    "frameH": 48,
    "animations": {
      "idle":   { "frames": [0, 1],       "speed": 30 },
      "walk":   { "frames": [2, 3, 4, 5], "speed": 15 },
      "attack": { "frames": [6, 7, 8],    "speed": 8 },
      "hurt":   { "frames": [9],          "speed": 12 }
    }
  }
}
```

The script counts total unique frames from `animations` (and `combatAnimations` if present) to determine how many equal-width frames to split the source image into.

**Example**: warrior has 10 total frames. If `warrior.png` is 1024x768, the script splits it into 10 frames of 102x768 each, then resizes each to 32x48 with nearest-neighbor interpolation.

### Single File Mode

Convert one image at a time:

```bash
# Single frame
node sprite-convert.mjs \
  --input ./art/slime.png \
  --output ../js/data/sprite-assets/high-res/enemy-slime.png \
  --size 32x32

# Multi-frame (split into 5 frames)
node sprite-convert.mjs \
  --input ./art/slime-sheet.png \
  --output ../js/data/sprite-assets/high-res/enemy-slime.png \
  --size 32x32 \
  --frames 5
```

### Help

```bash
node sprite-convert.mjs --help
```

## How It Works

```
High-res PNG (e.g. 1024x768)
  |
  v
Split into N equal frames (e.g. 10 x 102x768)
  |
  v
Resize each frame with nearest-neighbor (e.g. to 32x48)
  |
  v
Stitch into sprite sheet PNG (e.g. 320x48)
  |
  v
Output: compressed PNG with sharp pixel edges
```

### Resize Options

- **Kernel**: `nearest` -- pixelated, no blur
- **Fit**: `contain` -- preserve aspect ratio, transparent padding
- **Background**: transparent (alpha 0)
- **Output**: PNG with compression level 9

### Frame Splitting

When a source image is wider than the target frame width, it is treated as multiple horizontal frames. The number of frames is determined by:

1. **Batch mode**: counted from `animations.frames` arrays in the manifest
2. **Single file mode**: specified via `--frames N`

Each source frame is extracted, resized independently, and stitched back into a single sprite sheet PNG.

## Art Pipeline

1. Create high-res character art (recommended 256x256 to 1024x1024 per frame)
2. Arrange animation frames horizontally in one PNG (or keep as single image)
3. Run the conversion script
4. Place output PNGs in `js/data/sprite-assets/high-res/`
5. The game loads them via `SpriteLoader` at runtime

## Files

| File | Description |
|------|-------------|
| `sprite-convert.mjs` | Main conversion script |
| `package.json` | Dependencies (sharp) |
| `README.md` | This file |
