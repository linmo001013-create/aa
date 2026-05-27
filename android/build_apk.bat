@echo off
setlocal
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\Administrator\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%PATH%

echo JAVA_HOME=%JAVA_HOME%
echo ANDROID_HOME=%ANDROID_HOME%
java -version

echo.
echo ===== Building APK =====
call gradlew.bat assembleDebug
echo.
echo ===== Done =====
if exist app\build\outputs\apk\debug\app-debug.apk (
    echo APK generated at: app\build\outputs\apk\debug\app-debug.apk
) else (
    echo APK not found, checking other locations...
    dir /S app\build\outputs\*.apk 2>nul
)
pause
