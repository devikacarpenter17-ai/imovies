@echo off
cd /d "%~dp0server"
echo Refreshing real movies and posters from TMDB...
echo (This also rebuilds the show schedule. Shows that already have bookings are kept.)
echo.
call npm run import:movies
echo.
pause
