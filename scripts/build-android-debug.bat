@echo off
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
cd /d "%~dp0..\android"
call gradlew.bat assembleDebug
exit /b %ERRORLEVEL%
