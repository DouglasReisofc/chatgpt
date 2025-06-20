
@echo off
echo Starting MongoDB...
echo Please wait, this may take a few moments...

REM Check if MongoDB is already running
netstat -an | findstr "27017" > nul
IF %ERRORLEVEL% EQU 0 (
    echo MongoDB is already running on port 27017
) ELSE (
    start "MongoDB" /B mongod --config "%~dp0mongod.conf"
    echo Started MongoDB server
    timeout /t 5 /nobreak > nul
)

REM Start the Node.js application
echo Starting Node.js application...
npm start
