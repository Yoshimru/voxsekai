@echo off

rem Keep the console open when the file is launched by double-clicking it.
rem This makes early Windows, Node.js, and npm errors visible.
if "%~1"=="" (
    "%ComSpec%" /d /k call "%~f0" __menu
    exit /b
)

setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 (
    echo.
    echo ERROR: Cannot open the project directory:
    echo %~dp0
    pause
    exit /b 1
)

set "INTERACTIVE_MODE="
if /i "%~1"=="__menu" (
    set "INTERACTIVE_MODE=1"
    shift
)

if not defined PORT set "PORT=3001"
title VoxSekai server manager - port %PORT%

if /i "%~1"=="start" (
    set "CLI_MODE=1"
    goto action_start
)
if /i "%~1"=="stop" (
    set "CLI_MODE=1"
    goto action_stop
)
if /i "%~1"=="restart" (
    set "CLI_MODE=1"
    goto action_restart
)
if /i "%~1"=="install" (
    set "CLI_MODE=1"
    goto action_install
)
if not "%~1"=="" goto usage

:menu
cls
call :get_pid
echo.
echo ============================================================
echo   VoxSekai server manager
echo   Port: %PORT%   ^|   URL: http://localhost:%PORT%
echo ============================================================
if defined SERVER_PID (
    echo   Status: running ^(PID %SERVER_PID%^)
) else (
    echo   Status: stopped
)
echo ============================================================
echo.
echo   [1] Install dependencies and start
echo   [2] Stop server
echo   [3] Restart server
echo   [4] Reinstall dependencies
echo   [5] Exit
echo.
set "MENU_CHOICE="
set /p "MENU_CHOICE=Select an action [1-5]: "
if "%MENU_CHOICE%"=="5" exit 0
if "%MENU_CHOICE%"=="4" goto action_install
if "%MENU_CHOICE%"=="3" goto action_restart
if "%MENU_CHOICE%"=="2" goto action_stop
if "%MENU_CHOICE%"=="1" goto action_start
echo.
echo Invalid menu item.
pause
goto menu

:action_start
call :start_server
if defined CLI_MODE exit /b %errorlevel%
goto menu_pause

:action_stop
call :stop_server
if defined CLI_MODE exit /b %errorlevel%
goto menu_pause

:action_restart
echo.
echo === Restarting server ===
call :stop_server
if errorlevel 1 echo The server was not running. Starting it now.
call :start_server
if defined CLI_MODE exit /b %errorlevel%
goto menu_pause

:action_install
call :get_pid
if defined SERVER_PID (
    echo.
    echo Stop the server before reinstalling dependencies.
    if defined CLI_MODE exit /b 1
    goto menu_pause
)
call :install_dependencies
if defined CLI_MODE exit /b %errorlevel%
goto menu_pause

:menu_pause
echo.
pause
goto menu

:usage
echo.
echo Usage: start.bat [start ^| stop ^| restart ^| install]
echo Run start.bat without arguments to open the interactive menu.
exit /b 1

rem ------------------------------------------------------------
rem Start the Node.js server in a separate, persistent window.
rem ------------------------------------------------------------
:start_server
call :get_pid
if defined SERVER_PID (
    echo.
    echo A process is already listening on port %PORT% ^(PID %SERVER_PID%^).
    echo URL: http://localhost:%PORT%
    exit /b 0
)

call :ensure_dependencies
if errorlevel 1 exit /b 1

echo.
echo Starting VoxSekai on port %PORT%...
start "VoxSekai server - port %PORT%" /D "%~dp0" "%ComSpec%" /d /k "npm start"
set /a START_TRIES=0

:wait_start
ping -n 2 127.0.0.1 >nul
call :get_pid
if defined SERVER_PID (
    echo Server started ^(PID %SERVER_PID%^).
    echo URL: http://localhost:%PORT%
    exit /b 0
)
set /a START_TRIES+=1
if %START_TRIES% lss 10 goto wait_start

echo.
echo ERROR: The server did not start.
echo Read the error shown in the separate server window.
exit /b 1

rem ------------------------------------------------------------
rem Check dependencies and reinstall platform-specific modules.
rem ------------------------------------------------------------
:ensure_dependencies
call :check_runtime
if errorlevel 1 exit /b 1

if exist "node_modules\" (
    call npm ls --depth=0 --silent >nul 2>&1
    if not errorlevel 1 (
        call :check_native_dependencies
        if not errorlevel 1 (
            echo Dependencies are installed and compatible.
            exit /b 0
        )
        echo Dependencies were copied from an incompatible computer.
        echo Reinstalling native modules for this computer...
    )
)

echo Dependencies are missing or need to be updated.
call :install_dependencies
exit /b %errorlevel%

:install_dependencies
call :check_runtime
if errorlevel 1 exit /b 1

if not exist "package.json" (
    echo.
    echo ERROR: package.json was not found in:
    echo %CD%
    exit /b 1
)

echo.
echo === Installing dependencies ===
if exist "package-lock.json" (
    echo Running npm ci...
    call npm ci --no-audit --no-fund
) else (
    echo package-lock.json is missing. Running npm install...
    call npm install --no-audit --no-fund
)

if errorlevel 1 (
    echo.
    echo ERROR: npm could not install the dependencies.
    echo Check the internet connection and install 64-bit Node.js LTS 20 or newer.
    echo Current environment:
    node --version
    node -p "process.platform + ' ' + process.arch"
    exit /b 1
)

call :check_native_dependencies
if errorlevel 1 (
    echo.
    echo ERROR: better-sqlite3 cannot run on this computer.
    echo Install 64-bit Node.js LTS and run option 4 again.
    echo Diagnostic output:
    node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()"
    exit /b 1
)

echo.
echo Dependencies installed successfully.
exit /b 0

:check_runtime
rem The official installer normally uses this directory. Add it when PATH is stale.
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Node.js was not found.
    echo Install 64-bit Node.js LTS from https://nodejs.org/
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: npm was not found.
    echo Reinstall 64-bit Node.js LTS from https://nodejs.org/
    exit /b 1
)

set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
    echo.
    echo ERROR: Cannot determine the Node.js version.
    exit /b 1
)

if %NODE_MAJOR% LSS 20 (
    echo.
    echo ERROR: Node.js 20 or newer is required.
    node --version
    exit /b 1
)
exit /b 0

:check_native_dependencies
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

rem ------------------------------------------------------------
rem Stop the process listening on the configured port.
rem ------------------------------------------------------------
:stop_server
call :get_pid
if not defined SERVER_PID (
    echo.
    echo No server is listening on port %PORT%.
    exit /b 1
)
echo.
echo Stopping VoxSekai on port %PORT%...
set /a STOP_TRIES=0

:kill_loop
call :get_pid
if not defined SERVER_PID goto stopped
set /a STOP_TRIES+=1
if %STOP_TRIES% gtr 5 goto stop_failed
taskkill /PID %SERVER_PID% /F >nul 2>&1
ping -n 2 127.0.0.1 >nul
goto kill_loop

:stopped
echo Server stopped.
exit /b 0

:stop_failed
echo.
echo ERROR: Cannot stop PID %SERVER_PID%.
echo It may belong to another Windows user or require administrator access.
exit /b 1

:get_pid
set "SERVER_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /I "LISTENING"') do (
    if not defined SERVER_PID set "SERVER_PID=%%P"
)
exit /b 0
