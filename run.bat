@echo off
title Servidor Local Elenita Café & Restaurante
echo ============================================================
echo      SERVIDOR LOCAL PARA ELENITA CAFÉ & RESTAURANTE POS
echo ============================================================
echo.
echo Los navegadores modernos bloquean la ejecucion de modulos JS
echo cuando se abre el archivo index.html directamente (protocolo file://)
echo debido a politicas de seguridad CORS.
echo.
echo Este script iniciara un servidor web local usando Python.
echo.

:: Verificar si Python esta instalado
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python detectado. Iniciando servidor en http://localhost:8000 ...
    start "" "http://localhost:8000"
    python -m http.server 8000
    exit /b 0
)

:: Si Python no esta, verificar si npx esta instalado
npx -v >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Node.js/npx detectado. Iniciando servidor en http://localhost:8000 ...
    start "" "http://localhost:8000"
    npx -y http-server -p 8000
    exit /b 0
)

:: Si ninguno esta instalado
echo [ERROR] No se detecto ni Python ni Node.js en el sistema.
echo Para poder ejecutar la aplicacion (debido a las politicas de seguridad CORS de los navegadores),
echo debes tener instalado Python o Node.js, o usar la extension "Live Server" de VS Code.
echo.
pause
exit /b 1
