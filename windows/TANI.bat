@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Yapay-Mevzular.ps1" -Action Diagnostics
set "YM_EXIT_CODE=%ERRORLEVEL%"
pause
exit /b %YM_EXIT_CODE%
