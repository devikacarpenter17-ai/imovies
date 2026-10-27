@echo off
cd /d "%~dp0"
echo Stopping IMovies...
docker compose down
echo.
echo Stopped. Your movies and bookings are kept. To delete all data too, run:
echo   docker compose down -v
pause
