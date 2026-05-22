@echo off
setlocal
title Build Linux TDLib libtdjson.so

set "SERVICE_DIR=%~dp0"
set "OUTPUT_DIR=%SERVICE_DIR%lib"
set "IMAGE_NAME=tgmember-tdlib-builder"
set "CONTAINER_NAME=tgmember-tdlib-copy"
set "TDLIB_REF=master"

echo ==============================
echo Build Linux TDLib libtdjson.so
echo ==============================
echo.
echo Service dir: %SERVICE_DIR%
echo Output dir:  %OUTPUT_DIR%
echo TDLib ref:   %TDLIB_REF%
echo.

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found. Please install/start Docker Desktop first.
  pause
  exit /b 1
)

if not exist "%OUTPUT_DIR%" (
  mkdir "%OUTPUT_DIR%"
)

echo ==============================
echo Building Docker image...
echo ==============================

cd /d "%SERVICE_DIR%"
docker build ^
  -f docker/Dockerfile.tdlib-builder ^
  --build-arg TDLIB_REF=%TDLIB_REF% ^
  -t %IMAGE_NAME% .

if errorlevel 1 (
  echo.
  echo TDLib build failed.
  pause
  exit /b 1
)

echo.
echo ==============================
echo Copying libtdjson.so from image...
echo ==============================

docker rm -f %CONTAINER_NAME% >nul 2>nul
docker create --name %CONTAINER_NAME% %IMAGE_NAME% >nul

if errorlevel 1 (
  echo Failed to create temporary container.
  pause
  exit /b 1
)

docker cp %CONTAINER_NAME%:/out/. "%OUTPUT_DIR%"

if errorlevel 1 (
  echo Failed to copy libtdjson.so files.
  docker rm -f %CONTAINER_NAME% >nul 2>nul
  pause
  exit /b 1
)

docker rm -f %CONTAINER_NAME% >nul 2>nul

echo.
echo ==============================
echo Build complete.
echo ==============================
echo Output files:
dir "%OUTPUT_DIR%\libtdjson.so*"
echo.
echo Linux TDLib library should be available at:
echo %OUTPUT_DIR%\libtdjson.so
echo.
pause
endlocal
