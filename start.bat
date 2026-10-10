@echo off
cd /d "%~dp0"
start "" http://localhost:4326
node server.mjs
pause
