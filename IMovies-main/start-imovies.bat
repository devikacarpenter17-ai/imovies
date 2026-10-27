@echo off
setlocal EnableExtensions EnableDelayedExpansion
title IMovies launcher
cd /d "%~dp0"

echo ==========================================
echo   IMovies - starting up
echo ==========================================
echo.

REM ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  start https://nodejs.org/
  echo.
  echo Install the LTS version, then double-click this file again.
  pause
  exit /b 1
)

REM ---------- 2. Settings file ----------
if not exist "server\.env" (
  echo Creating server\.env with a fresh secret key...
  copy "server\.env.example" "server\.env" >nul
  powershell -NoProfile -Command "$s=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'); (Get-Content 'server\.env') -replace 'JWT_SECRET=.*',('JWT_SECRET='+$s) | Set-Content 'server\.env'"
)

REM ---------- 3. Database: Atlas (cloud) or local MongoDB ----------
REM If MONGO_URI in server\.env points anywhere except this computer, it is
REM treated as MongoDB Atlas and no local MongoDB is started.
set "USE_REMOTE="
findstr /b /i "MONGO_URI=" "server\.env" >nul 2>nul
if not errorlevel 1 (
  findstr /b /i "MONGO_URI=" "server\.env" | findstr /i /l "127.0.0.1 localhost" >nul
  if errorlevel 1 set "USE_REMOTE=1"
)

if defined USE_REMOTE (
  echo Using the MongoDB Atlas connection from server\.env
  goto :packages
)

sc query MongoDB >nul 2>nul
if not errorlevel 1 (
  sc query MongoDB | find "RUNNING" >nul
  if errorlevel 1 (
    echo Starting the MongoDB service...
    net start MongoDB >nul 2>nul
    if errorlevel 1 (
      echo Could not start the MongoDB service. Right-click this file and choose
      echo "Run as administrator" once, or start MongoDB yourself.
    )
  )
) else (
  where mongod >nul 2>nul
  if errorlevel 1 (
    echo No local MongoDB found.
    echo Either install MongoDB Community Server, or paste your MongoDB Atlas
    echo connection string into server\.env as MONGO_URI=...
    echo.
    pause
    exit /b 1
  ) else (
    echo Starting MongoDB...
    if not exist "%~dp0data\db" mkdir "%~dp0data\db"
    start "MongoDB" /min mongod --dbpath "%~dp0data\db"
    timeout /t 4 >nul
  )
)

:packages
REM ---------- 4. Packages (first run only) ----------
if not exist "server\node_modules" (
  echo Installing server packages. This takes a minute on the first run...
  pushd server
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo.
    echo Server install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  popd
)
if not exist "client\node_modules" (
  echo Installing website packages. This takes a minute on the first run...
  pushd client
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo.
    echo Website install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  popd
)

REM ---------- 5. TMDB key for real movies and posters (asked once) ----------
findstr /r /b /i /c:"TMDB_API_KEY=[^ ]" "server\.env" >nul 2>nul
if errorlevel 1 (
  if not exist "server\.tmdb_skipped" (
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
      echo TMDB_API_KEY=!TMDBKEY!>>"server\.env"
    ) else (
      echo skipped> "server\.tmdb_skipped"
    )
  )
)

REM ---------- 6. Database setup ----------
REM Safe to run every time: it only adds what is missing.
echo Checking database...
pushd server
call npm run seed
if errorlevel 1 (
  popd
  echo.
  echo Could not reach the database. If you use MongoDB Atlas, check that:
  echo   - the MONGO_URI in server\.env has your real password
  echo   - Network Access in Atlas allows your IP address
  pause
  exit /b 1
)
popd

REM ---------- 7. Import real movies (first run, and again until it succeeds) ----------
REM Tries TMDB if you gave a key, then falls back to Apple iTunes, which needs no key.
if not exist "server\.tmdb_imported" (
  echo.
  echo Importing real movies and posters. This can take a minute...
  pushd server
  call npm run import:movies
  if errorlevel 1 (
    echo.
    echo The movie import did not finish. Connect to your phone hotspot or a VPN, then run update-movies.bat
  ) else (
    echo done> ".tmdb_imported"
  )
  popd
)

REM ---------- 8. Start everything ----------
echo.
echo Starting the API and the website in two new windows...
start "IMovies API" /D "%~dp0server" cmd /k npm start
start "IMovies Website" /D "%~dp0client" cmd /k npm run dev

timeout /t 7 >nul
start http://localhost:5173

echo.
echo IMovies is opening in your browser: http://localhost:5173
echo   Admin login: admin@imovies.com / Admin@123
echo   User login:  user@imovies.com  / User@123
echo.
echo To stop it, close the "IMovies API" and "IMovies Website" windows.
timeout /t 10 >nul
exit /b 0
