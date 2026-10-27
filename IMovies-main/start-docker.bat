@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IMovies (Docker)
cd /d "%~dp0"

echo ==========================================
echo   IMovies - starting with Docker
echo ==========================================
echo.

REM ---------- 1. Docker ----------
where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo Docker is installed but not running. Open Docker Desktop, wait until it says
  echo it is running, then double-click this file again.
  pause
  exit /b 1
)

REM ---------- 2. Settings file with a fresh secret ----------
if not exist ".env" (
  echo Creating .env with a fresh secret key...
  powershell -NoProfile -Command "'JWT_SECRET=' + [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N') | Set-Content -Encoding ascii '.env'"
)

REM ---------- 3. TMDB key for real movies and posters (asked once) ----------
set "NEWKEY="
findstr /r /b /i /c:"TMDB_API_KEY=[^ ]" ".env" >nul 2>nul
if errorlevel 1 (
  if not exist ".tmdb_skipped" (
    echo.
    echo ------------------------------------------------------------
    echo  Optional: a free TMDB key gives the richest movie details.
    echo  1. Make a free account at https://www.themoviedb.org
    echo  2. Open https://www.themoviedb.org/settings/api and request a key
    echo  3. Paste the "API Key" here
    echo  Press Enter to skip. Movies and posters then come from Apple iTunes.
    echo ------------------------------------------------------------
    set "TMDBKEY="
    set /p "TMDBKEY=TMDB key: "
    if defined TMDBKEY (
      echo TMDB_API_KEY=!TMDBKEY!>>".env"
      set "NEWKEY=1"
    ) else (
      echo skipped> ".tmdb_skipped"
    )
  )
)

REM ---------- 4. Build and start ----------
echo Building and starting. The first run downloads images and takes a few minutes...
docker compose up -d --build
if errorlevel 1 (
  echo.
  echo Docker could not start IMovies. Scroll up for the error message.
  pause
  exit /b 1
)

REM ---------- 5. Wait until the site answers ----------
echo.
echo Waiting for the site to be ready...
set /a tries=0
:wait
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:8080/api/health -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% GEQ 60 goto notready
timeout /t 2 >nul
goto wait

:notready
echo.
echo The site did not answer after 2 minutes. To see what went wrong, run:
echo   docker compose logs server
pause
exit /b 1

:ready
REM First time: replace any placeholder movies with real ones
if not exist ".movies_imported" (
  echo Importing real movies and posters...
  docker compose exec -T server node scripts/importMovies.js
  if not errorlevel 1 echo done> ".movies_imported"
)
start http://localhost:8080
echo.
echo IMovies is running at http://localhost:8080
echo   Admin login: admin@imovies.com / Admin@123
echo   User login:  user@imovies.com  / User@123
echo.
echo To stop it, run stop-docker.bat. Your data is kept between runs.
timeout /t 10 >nul
exit /b 0
