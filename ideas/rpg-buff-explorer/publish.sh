#!/bin/bash
# 发布脚本：将运行所需文件复制到 web 发布目录
# 用法: ./publish.sh [clean]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../../web"
DEST="$WEB_DIR/games/rpg-buff-explorer"

echo "=== RPG Buff 探险者 - 发布脚本 ==="
echo "源: $SCRIPT_DIR"
echo "目标: $DEST"

# 可选清理
if [ "$1" = "clean" ]; then
  echo ""
  echo "[clean] 清理旧发布目录..."
  rm -rf "$DEST"
fi

# 创建目录
mkdir -p "$DEST"

# 复制运行所需文件
echo ""
echo "[copy] 复制文件..."

# index.html
cp "$SCRIPT_DIR/index.html" "$DEST/"

# CSS
cp -r "$SCRIPT_DIR/css" "$DEST/"

# JS (包含所有子目录)
cp -r "$SCRIPT_DIR/js" "$DEST/"

# 统计
FILE_COUNT=$(find "$DEST" -type f | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$DEST" | cut -f1)

echo ""
echo "[done] 发布完成!"
echo "  文件数: $FILE_COUNT"
echo "  总大小: $TOTAL_SIZE"
echo "  路径:   $DEST/index.html"
echo ""
echo "未复制（不需要）:"
echo "  - .tmp/ (工作流临时文件)"
echo "  - tests/ (单元测试)"
echo "  - e2e/ (端到端测试)"
echo "  - tools/ (开发工具)"
echo "  - *.md (设计文档)"
echo "  - package.json / package-lock.json"
echo "  - playwright.config.js"
echo "  - node_modules/"
