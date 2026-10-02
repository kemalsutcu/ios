@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Yapay-Mevzular.ps1" -Action Start
set "YM_EXIT_CODE=%ERRORLEVEL%"
if not "%YM_EXIT_CODE%"=="0" pause
exit /b %YM_EXIT_CODE%
