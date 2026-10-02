@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Yapay-Mevzular.ps1" -Action Menu
set "YM_EXIT_CODE=%ERRORLEVEL%"
if not "%YM_EXIT_CODE%"=="0" (
  echo.
  echo Islem tamamlanamadi. Yukaridaki hata mesajini kontrol edin.
  pause
)
exit /b %YM_EXIT_CODE%
