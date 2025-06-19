
@echo off
echo Starting Local MongoDB...
"C:\Users\dedit\Documents\chatgpt\mongodb-local\mongodb-win32-x86_64-windows-7.0.4\bin\mongod.exe" --config "%~dp0mongod-local.conf"
