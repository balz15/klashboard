#!/bin/bash

echo "=========================================="
echo "Building Release Bundle for Play Console"
echo "=========================================="

# Step 1: Build web assets
echo ""
echo "Step 1: Building web assets..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

# Step 2: Sync with Android
echo ""
echo "Step 2: Syncing with Android..."
npx cap sync android

# Step 3: Check for signing configuration
echo ""
echo "Step 3: Checking signing configuration..."

if [ ! -f "android/gradle.properties" ] || ! grep -q "MYAPP_RELEASE_STORE_FILE" android/gradle.properties; then
    echo ""
    echo "⚠️  No signing key configured!"
    echo ""
    echo "To build a release bundle, you need to:"
    echo "1. Generate a keystore file:"
    echo "   keytool -genkey -v -keystore android/my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000"
    echo ""
    echo "2. Add to android/gradle.properties:"
    echo "   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore"
    echo "   MYAPP_RELEASE_KEY_ALIAS=my-key-alias"
    echo "   MYAPP_RELEASE_STORE_PASSWORD=your_store_password"
    echo "   MYAPP_RELEASE_KEY_PASSWORD=your_key_password"
    echo ""
    echo "3. Add to .gitignore:"
    echo "   android/*.keystore"
    echo "   android/key.properties"
    echo ""
    exit 1
fi

# Step 4: Build release bundle
echo ""
echo "Step 4: Building release bundle..."
cd android && ./gradlew bundleRelease

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Success! Your release bundle is ready at:"
    echo "   android/app/build/outputs/bundle/release/app-release.aab"
    echo ""
    echo "This .aab file can be uploaded to Google Play Console."
else
    echo ""
    echo "❌ Bundle build failed!"
    echo "Check the error messages above."
    exit 1
fi
