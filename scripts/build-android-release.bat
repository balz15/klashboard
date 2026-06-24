@echo off
setlocal
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0..\android"
echo Building release AAB (version from android\app\build.gradle)...
call gradlew.bat clean bundleRelease
if %ERRORLEVEL% neq 0 exit /b %ERRORLEVEL%
echo.
echo Release bundle ready:
echo   android\app\build\outputs\bundle\release\app-release.aab
exit /b 0
