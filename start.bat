
@echo off
echo Iniciando MongoDB...
echo Aguarde, isso pode levar alguns momentos...

REM Check if MongoDB is already running
netstat -an | findstr "27017" > nul
IF %ERRORLEVEL% EQU 0 (
    echo MongoDB ja esta rodando na porta 27017
) ELSE (
    start "MongoDB" /B mongod --config "%~dp0mongod.conf"
    echo Servidor MongoDB iniciado
    timeout /t 5 /nobreak > nul
)

REM Start the Node.js application
echo Iniciando aplicacao Node.js...
node index.js
