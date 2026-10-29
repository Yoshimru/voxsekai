@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not defined PORT set "PORT=3001"
title VoxSekai — управление сервером (порт %PORT%)

rem Аргументы командной строки: start / stop / restart
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
if not "%~1"=="" goto usage

:menu
cls
call :get_pid
echo.
echo ============================================================
echo   VoxSekai — управление сервером
echo   Порт: %PORT%   ^|   Адрес: http://localhost:%PORT%
echo ============================================================
if defined SERVER_PID (
    echo   Статус: сервер запущен ^(PID %SERVER_PID%^)
) else (
    echo   Статус: сервер остановлен
)
echo ============================================================
echo.
echo   [1] Запустить сервер
echo   [2] Остановить сервер
echo   [3] Перезагрузить сервер
echo   [4] Выйти
echo.
choice /C 1234 /N /M "Выберите действие [1-4]: "
if errorlevel 4 exit /b 0
if errorlevel 3 goto action_restart
if errorlevel 2 goto action_stop
if errorlevel 1 goto action_start
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
echo === Перезагрузка сервера ===
call :stop_server
if errorlevel 1 (
    echo Сервер не был запущен — запускаю его.
)
call :start_server
if defined CLI_MODE exit /b %errorlevel%
goto menu_pause

:menu_pause
echo.
pause
goto menu

:usage
echo.
echo Использование: start.bat [start ^| stop ^| restart]
echo Без аргументов открывается интерактивное меню.
exit /b 1

rem ------------------------------------------------------------
rem Запуск сервера в отдельном окне
rem ------------------------------------------------------------
:start_server
call :get_pid
if defined SERVER_PID (
    echo.
    echo VoxSekai уже запущен на порту %PORT% ^(PID %SERVER_PID%^).
    echo Открыть: http://localhost:%PORT%
    exit /b 0
)
echo.
echo Запуск VoxSekai на порту %PORT%...
start "VoxSekai server (порт %PORT%)" /D "%~dp0" cmd /k "node server.js"
set /a START_TRIES=0

:wait_start
ping -n 2 127.0.0.1 >nul
call :get_pid
if defined SERVER_PID (
    echo Сервер запущен ^(PID %SERVER_PID%^).
    echo Открыть: http://localhost:%PORT%
    exit /b 0
)
set /a START_TRIES+=1
if %START_TRIES% lss 10 goto wait_start

echo.
echo Не удалось запустить сервер.
echo Проверьте, установлен ли Node.js и нет ли ошибки в окне сервера.
exit /b 1

rem ------------------------------------------------------------
rem Остановка сервера
rem ------------------------------------------------------------
:stop_server
call :get_pid
if not defined SERVER_PID (
    echo.
    echo Сервер на порту %PORT% не запущен.
    exit /b 1
)
echo.
echo Остановка VoxSekai на порту %PORT%...
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
echo Сервер остановлен.
exit /b 0

:stop_failed
echo.
echo Не удалось остановить процесс PID %SERVER_PID%.
echo Возможно, он запущен от другого пользователя или уже завершается.
exit /b 1

rem ------------------------------------------------------------
rem Поиск PID процесса, слушающего порт
rem ------------------------------------------------------------
:get_pid
set "SERVER_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /C:":%PORT% " ^| findstr /I "LISTENING"') do (
    if not defined SERVER_PID set "SERVER_PID=%%P"
)
exit /b 0
