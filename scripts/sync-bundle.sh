#!/bin/bash
# Sync bundle to global pnpm directory with clean step
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TARGET_DIR="/Users/ethan/node/pnpm_global/bundle"

cd "$ROOT_DIR"

echo "=== Cleaning old bundle ==="
rm -rf bundle/
rm -rf "$TARGET_DIR"

echo ""
echo "=== Building bundle ==="
npm run bundle

echo ""
echo "=== Syncing to $TARGET_DIR ==="
rsync -av --delete bundle/ "$TARGET_DIR/"

echo ""
echo "=== Verification ==="
ls -lh "$TARGET_DIR/gemini.js"
echo "Total files: $(find "$TARGET_DIR" -type f | wc -l)"
