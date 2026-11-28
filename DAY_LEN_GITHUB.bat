@echo off
title Day du lieu len GitHub - QLKH2
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   DANG DAY TOAN BO DU LIEU MOI LEN GITHUB PAGES
echo ========================================================
"C:\Users\truon\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe" status
echo.
echo Dang thuc hien git push...
"C:\Users\truon\AppData\Local\Microsoft\WinGet\Packages\Git.MinGit_Microsoft.Winget.Source_8wekyb3d8bbwe\cmd\git.exe" push origin main
echo.
pause
