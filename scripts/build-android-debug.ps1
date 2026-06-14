# Builds a debug APK you can sideload on your phone for testing.
# Requires: Node.js, JDK 17+, Android SDK (easiest via Android Studio).

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Test-Command($name) {
    return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

Write-Host ""
Write-Host "=== KlashBoard Android debug APK build ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env is missing. Copy .env.example and set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY." -ForegroundColor Red
    exit 1
}

if (-not (Test-Command "java")) {
    Write-Host "ERROR: Java (JDK 17+) not found." -ForegroundColor Red
    Write-Host "Install Android Studio (recommended): https://developer.android.com/studio"
    Write-Host "  - Studio installs JDK + Android SDK in one step."
    Write-Host "  - After install, open Studio once so SDK downloads finish."
    Write-Host ""
    Write-Host "Then set environment variables (System -> Environment Variables):"
    Write-Host "  ANDROID_HOME = %LOCALAPPDATA%\Android\Sdk"
    Write-Host "  Add to PATH: %ANDROID_HOME%\platform-tools"
    Write-Host ""
    exit 1
}

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = $env:ANDROID_SDK_ROOT }
if (-not $sdk -and (Test-Path "$env:LOCALAPPDATA\Android\Sdk")) {
    $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
    $sdk = $env:ANDROID_HOME
}

if (-not $sdk -or -not (Test-Path $sdk)) {
    Write-Host "ERROR: Android SDK not found. Install Android Studio and open it once." -ForegroundColor Red
    Write-Host "Expected SDK at: $env:LOCALAPPDATA\Android\Sdk"
    exit 1
}

Write-Host "Using ANDROID_HOME: $sdk" -ForegroundColor Gray
Write-Host ""

Write-Host "Step 1/3: Building web app (embeds .env Supabase keys)..." -ForegroundColor Yellow
npm.cmd run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Step 2/3: Syncing Capacitor Android project..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Step 3/3: Compiling debug APK (first run may take 10-20 min)..." -ForegroundColor Yellow
Set-Location "$Root\android"
.\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = "$Root\android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""
Write-Host "SUCCESS" -ForegroundColor Green
Write-Host "APK ready:" -ForegroundColor Green
Write-Host "  $apk"
Write-Host ""
Write-Host "Install on phone:"
Write-Host "  1. Copy APK to phone (USB, email, or Drive)"
Write-Host "  2. Open the file on the phone and allow install from unknown sources"
Write-Host "  3. Uninstall any old broken build first if install fails"
Write-Host ""
