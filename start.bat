@echo off
chcp 65001 >nul
rem === VoxSekai: Р±С‹СЃС‚СЂС‹Р№ Р·Р°РїСѓСЃРє СЃРµСЂРІРµСЂР° ===

cd /d "%~dp0"

rem Р•СЃР»Рё СЃРµСЂРІРµСЂ СѓР¶Рµ Р·Р°РїСѓС‰РµРЅ вЂ” РїСЂРµРґСѓРїСЂРµРґРёРј Рё РІС‹Р№РґРµРј
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) { exit 20 }" >nul 2>&1
if %errorlevel%==20 (
    echo VoxSekai: СЃРµСЂРІРµСЂ СѓР¶Рµ Р·Р°РїСѓС‰РµРЅ РЅР° РїРѕСЂС‚Сѓ 3001.
    echo РћС‚РєСЂРѕР№ РµРіРѕ РІ Р±СЂР°СѓР·РµСЂРµ: http://localhost:3001
    pause
    exit /b 0
)

echo Р—Р°РїСѓСЃРє VoxSekai: http://localhost:3001
echo Р”Р»СЏ РѕСЃС‚Р°РЅРѕРІРєРё Р·Р°РєСЂРѕР№С‚Рµ СЌС‚Рѕ РѕРєРЅРѕ РёР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ stop.bat
echo.
title VoxSekai server (port 3001)
node server.js

echo.
echo РЎРµСЂРІРµСЂ РѕСЃС‚Р°РЅРѕРІР»РµРЅ.
pause
