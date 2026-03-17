#!/usr/bin/env bash
# OpenNeko Engine - Linux Build Script
# Prerequisites: Qt 6, CMake, Ninja (or Make), pkg-config

set -euo pipefail
cd "$(dirname "$0")"

BUILD_TYPE="${1:-Release}"
JOBS="$(nproc)"

# Detect Qt6 prefix — try common locations
QT_PREFIX=""
for candidate in \
    "$HOME/Qt/6.*/gcc_64" \
    /opt/Qt/6.*/gcc_64 \
    /usr/lib/qt6 \
    /usr/lib/x86_64-linux-gnu/cmake/Qt6 \
    /usr/local/lib/cmake/Qt6; do
    # shellcheck disable=SC2086
    resolved="$(ls -d $candidate 2>/dev/null | sort -V | tail -1)"
    if [ -n "$resolved" ] && [ -d "$resolved" ]; then
        QT_PREFIX="$resolved"
        break
    fi
done

if [ -z "$QT_PREFIX" ]; then
    echo "[WARN] Could not auto-detect Qt6 path. Set CMAKE_PREFIX_PATH manually if configure fails."
fi

# Prefer Ninja if available, fall back to Unix Makefiles
if command -v ninja &>/dev/null; then
    GENERATOR="Ninja"
else
    GENERATOR="Unix Makefiles"
fi

echo "[1/4] Cleaning and creating build directory..."
if [ -d build ]; then
    pkill -f OpenNekoEngine 2>/dev/null || true
    rm -rf build
fi
mkdir -p build

echo "[2/4] Configuring project with CMake (${BUILD_TYPE}, ${GENERATOR})..."
CMAKE_ARGS=(
    -B build
    -G "$GENERATOR"
    -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
)
if [ -n "$QT_PREFIX" ]; then
    CMAKE_ARGS+=(-DCMAKE_PREFIX_PATH="$QT_PREFIX")
fi
cmake "${CMAKE_ARGS[@]}"

echo "[3/4] Building project (-j${JOBS})..."
cmake --build build --config "$BUILD_TYPE" -j "$JOBS"

echo "[4/4] Fixing up shared library paths..."
APP_DIR="build/app/stage-desktop"
SO_FILE="build/engine/libopenneko.so"

if [ -f "$SO_FILE" ]; then
    cp -f "$SO_FILE" "$APP_DIR/"
    patchelf --set-rpath '$ORIGIN' "$APP_DIR/OpenNekoEngine" 2>/dev/null || \
        chrpath -r '$ORIGIN' "$APP_DIR/OpenNekoEngine" 2>/dev/null || \
        echo "[WARN] patchelf/chrpath not found — you may need to set LD_LIBRARY_PATH manually."
fi

echo ""
echo "========================================"
echo "  Build Complete!"
echo "  ${APP_DIR}/OpenNekoEngine"
echo "========================================"
