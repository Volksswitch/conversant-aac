@echo off
REM ============================================================
REM  serve.bat - launch a local web server for the Conversant AAC app.
REM
REM  Double-click this file (or run it from a terminal) to serve the
REM  app\ folder at http://localhost:8000. Open that URL in Chrome or
REM  Edge (the app requires one of those). Close this window or press
REM  Ctrl+C to stop the server.
REM ============================================================

REM Run from this script's own folder so "app" resolves no matter where
REM the file is launched from.
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
    echo ERROR: Python was not found on your PATH.
    echo Install Python, or edit serve.bat to use a different server.
    echo.
    pause
    exit /b 1
)

echo.
echo   Conversant AAC - local server
echo   ---------------------------------
echo   Serving:  %CD%\app
echo   URL:      http://localhost:8000
echo   Browser:  use Chrome or Edge
echo.
echo   (Close this window or press Ctrl+C to stop.)
echo.

REM Open the default browser at the app URL. If it opens the wrong
REM browser, just copy the URL above into Chrome or Edge instead.
start "" "http://localhost:8000"

python -m http.server 8000 --directory app
