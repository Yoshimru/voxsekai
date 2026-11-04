@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not defined PORT set "PORT=3001"
title VoxSekai — управление сервером (порт %PORT%)

rem Аргументы командной строки: start / stop / restart / install
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
echo   [1] Установить зависимости и запустить сервер
echo   [2] Остановить сервер
echo   [3] Перезагрузить сервер
echo   [4] Переустановить зависимости
echo   [5] Выйти
echo.
choice /C 12345 /N /M "Выберите действие [1-5]: "
if errorlevel 5 exit /b 0
if errorlevel 4 goto action_install
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

:action_install
call :get_pid
if defined SERVER_PID (
    echo.
    echo Сначала остановите сервер, затем переустановите зависимости.
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
echo Использование: start.bat [start ^| stop ^| restart ^| install]
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

call :ensure_dependencies
if errorlevel 1 exit /b 1

echo.
echo Запуск VoxSekai на порту %PORT%...
start "VoxSekai server (порт %PORT%)" /D "%~dp0" cmd /k "npm start"
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
rem Проверка и установка npm-зависимостей
rem ------------------------------------------------------------
:ensure_dependencies
call :check_runtime
if errorlevel 1 exit /b 1

if exist "node_modules\" (
    call npm ls --depth=0 --silent >nul 2>&1
    if not errorlevel 1 (
        call :check_native_dependencies
        if not errorlevel 1 (
            echo Зависимости уже установлены и совместимы с этим компьютером.
            exit /b 0
        )
        echo Обнаружены зависимости, перенесенные с другого компьютера.
        echo Нативные модули будут переустановлены для текущей версии Node.js.
    )
)

echo Зависимости отсутствуют или требуют обновления.
call :install_dependencies
exit /b %errorlevel%

:install_dependencies
call :check_runtime
if errorlevel 1 exit /b 1

if not exist "package.json" (
    echo.
    echo Ошибка: файл package.json не найден в %CD%.
    exit /b 1
)

echo.
echo === Установка зависимостей ===
if exist "package-lock.json" (
    echo Выполняется npm ci...
    call npm ci --no-audit --no-fund
) else (
    echo package-lock.json не найден — выполняется npm install...
    call npm install --no-audit --no-fund
)

if errorlevel 1 (
    echo.
    echo Не удалось установить зависимости.
    echo Проверьте подключение к интернету и используйте Node.js 20 или новее.
    echo Текущая среда:
    node --version
    node -p "process.platform + ' ' + process.arch"
    exit /b 1
)

call :check_native_dependencies
if errorlevel 1 (
    echo.
    echo Зависимости установлены, но нативный модуль better-sqlite3 не запускается.
    echo Установите 64-битную LTS-версию Node.js и повторите установку.
    echo Диагностика:
    node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()"
    exit /b 1
)

echo.
echo Все зависимости успешно установлены.
exit /b 0

:check_runtime
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo Ошибка: Node.js не найден.
    echo Установите Node.js 20 или новее с https://nodejs.org/
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo Ошибка: npm не найден. Переустановите Node.js с https://nodejs.org/
    exit /b 1
)

set "NODE_MAJOR="
for /f "delims=" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
    echo.
    echo Ошибка: не удалось определить версию Node.js.
    exit /b 1
)

if %NODE_MAJOR% LSS 20 (
    echo.
    echo Ошибка: для текущих зависимостей требуется Node.js 20 или новее.
    node --version
    exit /b 1
)
exit /b 0

rem ------------------------------------------------------------
rem Проверка нативных модулей, зависящих от ОС, архитектуры и Node.js
rem ------------------------------------------------------------
:check_native_dependencies
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close()" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

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
