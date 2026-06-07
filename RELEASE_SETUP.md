# Quick Guide: Generate Play Store Release Bundle

## Prerequisites

You need a signing key to create a release build. This is a one-time setup.

## Step 1: Generate Signing Key

Run this command (you'll be prompted for passwords and info):

```bash
keytool -genkey -v -keystore android/my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT:**
- Remember your passwords! You'll need them for every release.
- Never commit the keystore file to git.
- Back up the keystore file securely.

## Step 2: Configure Signing

Add these lines to `android/gradle.properties`:

```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=Balajee155!
MYAPP_RELEASE_KEY_PASSWORD=Balajee155!
```

## Step 3: Add to .gitignore

Make sure these are in your `.gitignore`:

```
android/*.keystore
android/key.properties
```

## Step 4: Build Release Bundle

Run:

```bash
npm run build:release
```

Or manually:

```bash
npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
```

## Output

Your release bundle will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

Upload this `.aab` file to Google Play Console.

## For APK Instead of Bundle

If you need an APK instead:

```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Before Each Release

1. Update version in `android/app/build.gradle`:
   - Increment `versionCode` (e.g., 1 → 2)
   - Update `versionName` (e.g., "1.0" → "1.1")

2. Test thoroughly on real devices

3. Build release bundle

4. Upload to Play Console
