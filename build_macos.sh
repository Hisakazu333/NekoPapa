#!/usr/bin/env bash
# OpenNeko Engine - macOS Build Script
# Prerequisites: Qt 6 (Homebrew), CMake, Ninja

set -euo pipefail
cd "$(dirname "$0")"

BUILD_TYPE="${1:-Release}"
JOBS="$(sysctl -n hw.ncpu)"

echo "[1/4] Cleaning and creating build directory..."
if [ -d build ]; then
    pkill -f OpenNekoEngine 2>/dev/null || true
    rm -rf build
fi
mkdir -p build

echo "[2/4] Configuring project with CMake (${BUILD_TYPE})..."
if [ "$BUILD_TYPE" = "Debug" ]; then
    cmake --preset macos
else
    cmake --preset macos-release
fi

echo "[3/4] Building project (-j${JOBS})..."
cmake --build build --config "$BUILD_TYPE" -j "$JOBS"

echo "[4/4] Fixing up dylib paths..."
APP_DIR="build/app/stage-desktop"
DYLIB="build/engine/libopenneko.dylib"

if [ -f "$DYLIB" ]; then
    cp -f "$DYLIB" "$APP_DIR/"
    install_name_tool -change "@rpath/libopenneko.dylib" "@executable_path/libopenneko.dylib" \
        "$APP_DIR/OpenNekoEngine" 2>/dev/null || true
fi

echo ""
echo "========================================"
echo "  Build Complete!"
echo "  ${APP_DIR}/OpenNekoEngine"
echo "========================================"
