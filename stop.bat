@echo off
chcp 65001 >nul
rem === VoxSekai: Р С•РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р С”Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В° Р С—Р С• Р С—Р С•РЎР‚РЎвЂљРЎС“ 3001 ===

set "PORT=3001"
set "KILLED="

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1 && set "KILLED=%%P"
)

if defined KILLED (
    echo VoxSekai: Р С—РЎР‚Р С•РЎвЂ Р ВµРЎРѓРЎРѓ %KILLED% Р Р…Р В° Р С—Р С•РЎР‚РЎвЂљРЎС“ %PORT% Р С•РЎРѓРЎвЂљР В°Р Р…Р С•Р Р†Р В»Р ВµР Р….
) else (
    echo VoxSekai: Р В·Р В°Р С—РЎС“РЎвЂ°Р ВµР Р…Р Р…РЎвЂ№Р в„– РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ Р Р…Р В° Р С—Р С•РЎР‚РЎвЂљРЎС“ %PORT% Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….
)

pause
