# Publishing Your Android App to Google Play Store

## Prerequisites

1. **Install Android Studio** - Download from https://developer.android.com/studio
2. **Install Java Development Kit (JDK)** - Version 17 or higher
3. **Create a Google Play Console account** - $25 one-time registration fee at https://play.google.com/console

## Step 1: Open Your Android Project

Run this command to open Android Studio with your project:

```bash
npm run android
```

Or manually:
```bash
npx cap open android
```

## Step 2: Configure Your App

### Update App Information

1. Open `android/app/build.gradle`
2. Update the following:
   - `applicationId` (currently: com.groupchallenge.app)
   - `versionCode` (start with 1, increment with each release)
   - `versionName` (e.g., "1.0.0")

### Add App Icon

1. Right-click `res` folder in Android Studio
2. Select New → Image Asset
3. Choose your icon image
4. Generate all sizes

### Add Splash Screen (Optional)

1. Place splash image in `android/app/src/main/res/drawable/`
2. Name it `splash.png`

## Step 3: Generate a Signing Key

Open terminal and run:

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

**IMPORTANT:** Save the keystore file and passwords securely. You'll need them for all future updates.

## Step 4: Configure Signing

Create `android/key.properties`:

```
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=my-key-alias
storeFile=../my-release-key.keystore
```

Update `android/app/build.gradle` to add signing config (before android block):

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    ...
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

## Step 5: Build Release APK/AAB

In Android Studio:

1. Select **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle** (recommended for Play Store)
3. Select your keystore file
4. Enter your passwords
5. Choose **release** build variant
6. Click **Finish**

The AAB file will be in `android/app/release/`

## Step 6: Test Your App

Before publishing, test thoroughly:

1. Install the release build on a real device
2. Test all features
3. Check performance
4. Verify authentication works
5. Test on different screen sizes

## Step 7: Prepare Play Store Listing

You'll need:

1. **App title** (max 50 characters)
2. **Short description** (max 80 characters)
3. **Full description** (max 4000 characters)
4. **Screenshots** (at least 2, up to 8)
   - Phone: 1080 x 1920 or 1080 x 2340
5. **Feature graphic** (1024 x 500)
6. **App icon** (512 x 512 PNG)
7. **Privacy policy URL** (required if app collects data)
8. **Content rating questionnaire**

## Step 8: Upload to Google Play Console

1. Go to https://play.google.com/console
2. Create a new app
3. Fill in all required information:
   - App details
   - Store listing
   - Content rating
   - Target audience
   - Privacy policy
4. Upload your AAB file
5. Complete the release form
6. Submit for review

## Step 9: Wait for Review

- Initial review: 7 days or less
- You'll receive an email when approved
- Updates are usually reviewed faster (1-3 days)

## Common Issues

### Issue: App not signed
**Solution:** Make sure you followed Step 4 correctly

### Issue: Missing permissions
**Solution:** Check `android/app/src/main/AndroidManifest.xml` for required permissions

### Issue: Deep links not working
**Solution:** Add intent filters in AndroidManifest.xml

## Updating Your App

1. Make changes to your React code
2. Increment `versionCode` and `versionName` in build.gradle
3. Run: `npm run build`
4. Run: `npx cap sync`
5. Build new signed AAB
6. Upload to Play Console as an update

## Useful Commands

```bash
# Build and sync
npm run build && npx cap sync

# Open Android Studio
npm run android

# Clean build
cd android && ./gradlew clean && cd ..

# Check for Capacitor updates
npx cap doctor
```

## Important Notes

- **Package name** (applicationId) cannot be changed after first publish
- Keep your keystore file safe - losing it means you can't update your app
- Add `.keystore` and `key.properties` to `.gitignore`
- Test in-app purchases in internal testing track first
- Enable ProGuard for production to reduce app size
- Monitor crashes in Play Console

## Next Steps After Publishing

1. Set up app signing by Google Play (recommended)
2. Create internal/closed testing tracks
3. Enable crash reporting
4. Set up app bundle optimization
5. Create release notes for updates
6. Monitor reviews and ratings

Good luck with your launch!
