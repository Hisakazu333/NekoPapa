@echo off
REM OpenNeko Engine - Windows Build Script
REM Prerequisites: Qt 6, CMake, Visual Studio 2022

echo [1/4] Cleaning and creating build directory...
if exist build (
    echo Closing any running OpenNekoEngine processes...
    taskkill /f /im OpenNekoEngine.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    rd /s /q build 2>nul
)
if not exist build mkdir build

echo [2/4] Configuring project with CMake...
cmake -B build -G "Visual Studio 17 2022" -A x64 -DNNA_ENABLE_LIVE2D=ON
if %errorlevel% neq 0 (
    echo [ERROR] CMake configuration failed!
    pause
    exit /b %errorlevel%
)

echo [3/4] Building project...
cmake --build build --config Release -j 8
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b %errorlevel%
)

set "EXE_DIR=build\app\stage-desktop\Release"
set "EXE_PATH=%EXE_DIR%\OpenNekoEngine.exe"

echo [4/4] Deploying Qt dependencies...
REM Copy openneko.dll next to exe
copy /y "build\engine\Release\openneko.dll" "%EXE_DIR%\" >nul 2>&1

REM Run windeployqt with absolute paths
windeployqt6 --release --qmldir "%CD%\app\stage-desktop\qml" "%CD%\%EXE_PATH%" 2>nul
if %errorlevel% neq 0 (
    REM Fallback: try windeployqt without the "6" suffix
    windeployqt --release --qmldir "%CD%\app\stage-desktop\qml" "%CD%\%EXE_PATH%"
)

echo.
echo ========================================
echo   Build Complete!
echo   %CD%\%EXE_PATH%
echo ========================================
pause
