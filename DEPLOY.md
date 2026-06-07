# Klashboard – Build & Deploy Guide

## Why the APK wasn't working

The app uses **Supabase** for auth and data. Without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, the APK shows a **Configuration Error** screen and doesn't function. The GitHub workflow was building the app without these variables.

---

## 1. Fix APK/AAB builds (GitHub Actions)

### Step 1: Add GitHub secrets

1. Open your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Add these repository secrets:

| Secret name | Where to get it |
|-------------|-----------------|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon public key |
| `ANDROID_KEYSTORE_BASE64` | Your release keystore, base64 encoded (see below) |
| `ANDROID_STORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (e.g. `my-key-alias`) |
| `ANDROID_KEY_PASSWORD` | Key password |

### Step 2: Create a keystore (if you don't have one)

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Then encode it for GitHub:

- **Windows (PowerShell):**  
  `[Convert]::ToBase64String([IO.File]::ReadAllBytes("my-release-key.keystore"))`
- **macOS/Linux:**  
  `base64 -i my-release-key.keystore`

Copy the output and paste it into the `ANDROID_KEYSTORE_BASE64` secret.

### Step 3: Trigger the workflow

Push to `main`/`master` or run **Actions** → **Build Android APK** → **Run workflow**.  
APK and AAB artifacts will appear under the workflow run.

### Local builds

Create a `.env` file from `.env.example` and fill in your Supabase values:

```bash
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm run build
npx cap sync android
# Open in Android Studio to build APK, or use: cd android && ./gradlew assembleRelease
```

---

## 2. Publish to www.klashboard.com

You can host the web app on your domain in several ways.

### Option A: Netlify

1. Sign up at [netlify.com](https://netlify.com) and connect your repo.
2. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Environment variables:** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. After deploy, go to **Domain settings** → **Add custom domain** → add `www.klashboard.com`.
4. At your domain registrar, add a CNAME record: `www` → `your-site.netlify.app`.

### Option B: Vercel

1. Sign up at [vercel.com](https://vercel.com) and import your repo.
2. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy, then add `www.klashboard.com` under **Domains**.
4. Update DNS as instructed by Vercel.

### Option C: Your own server (e.g. VPS, shared hosting)

1. Build: `npm run build`
2. Upload the contents of the `dist` folder to your web server (e.g. `public_html`).
3. Ensure your server serves `index.html` for all routes (SPA fallback).
4. Add a `.htaccess` (Apache) or equivalent config:

   ```
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```

5. Point `www.klashboard.com` to your server via A or CNAME records at your registrar.

### Option D: GitHub Pages

1. Enable GitHub Pages for the repo.
2. Use a GitHub Action to build and deploy (e.g. `peaceiris/actions-gh-pages`).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repo secrets.
4. For a custom domain, add a CNAME file and configure DNS at your registrar.

---

## Summary

- **APK not working:** Add Supabase and Android keystore secrets to GitHub, then re-run the workflow.
- **Publishing to www.klashboard.com:** Deploy the built `dist` folder to Netlify, Vercel, or your own host, then configure DNS for `www.klashboard.com`.
