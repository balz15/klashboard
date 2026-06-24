# KlashBoard — Google Play Console checklist

Everything you need to publish **com.groupchallenge.app** on Google Play.

Generated assets live in this folder. **Screenshots** must be captured from the real app (see below).

---

## A. Release (required to install)

| Item | Status | Notes |
|------|--------|--------|
| Signed App Bundle (`.aab`) | You build this | `android\app\build\outputs\bundle\release\app-release.aab` |
| `versionCode` | Bump every upload | Integer only: 2, 3, 4… in `android/app/build.gradle` |
| Release notes | You write | Short bullet list per release |

---

## B. Store listing → Main store listing

| Asset | Spec | File / action |
|-------|------|----------------|
| **App name** | Max 30 characters | `KlashBoard` |
| **Short description** | Max 80 characters | See `listing-copy.txt` |
| **Full description** | Max 4000 characters | See `listing-copy.txt` |
| **App icon** | **512 × 512** PNG, max 1 MB, no alpha required | **`icon-512.png`** |
| **Feature graphic** | **1024 × 500** PNG or JPG | **`feature-graphic-1024x500.png`** |
| **Phone screenshots** | Min **2**, max 8; 9:16 or 16:9; short side ≥ 320 px | Capture from app — see **Screenshots** below |
| **7" tablet screenshots** | Optional | Only if you target tablets |
| **10" tablet screenshots** | Optional | Only if you target tablets |

### Screenshots (you must capture these)

Play requires **real in-app screenshots**, not marketing art alone. Suggested shots:

1. **Dashboard** — My Challenges + collapsed reminder / log bars  
2. **Daily quick log** — expanded green “Log today’s progress”  
3. **Contest / challenge detail** — leaderboard or daily tracker  
4. **Group chat** (if enabled)  
5. **Create / join challenge** flow  

**How to capture on Android**

1. Install your closed-testing build from Play, or sideload release APK.  
2. Open each screen → **Power + Volume Down** (or emulator camera button).  
3. Copy PNGs to `play-store/screenshots/phone/` (create folder).  
4. Upload in Play Console → **Store listing → Phone screenshots**.

Recommended size: **1080 × 1920** (portrait) or **1920 × 1080** (landscape).

---

## C. Store settings

| Item | Suggested value |
|------|-----------------|
| **App category** | Health & Fitness *or* Lifestyle |
| **Tags** | habits, accountability, group goals (pick Play’s suggested tags) |
| **Contact email** | Your support email (shown on store page) |
| **Website** | `https://www.klashboard.com` |
| **Privacy policy URL** | **Required** — host `privacy-policy.html` at e.g. `https://www.klashboard.com/privacy` |

---

## D. Policy & compliance (required before rollout)

| Task | Where in Play Console |
|------|------------------------|
| **Privacy policy** | Store listing + Policy → App content |
| **Data safety** | Policy → Data safety — declare account info, app activity, device IDs via Supabase auth |
| **Content rating** | Policy → Content rating — complete IARC questionnaire (likely Everyone / low maturity) |
| **Target audience** | Policy → Target audience and content |
| **Ads** | Declare whether app contains ads (**No** for KlashBoard) |
| **News app** | No |
| **COVID / health claims** | Only if you make medical claims — KlashBoard is general habit tracking |
| **Government apps** | No |

### Data safety (high level for KlashBoard)

Typical declarations:

- **Account creation** — email/password via Supabase  
- **Data collected** — email, name/profile, challenge entries, chat messages (if used)  
- **Data shared** — with other challenge participants in your groups  
- **Encryption in transit** — Yes (HTTPS)  
- **Data deletion** — self-service at https://www.klashboard.com/delete-account (profile menu → Delete account)

Review [Supabase privacy](https://supabase.com/privacy) — you act as data controller for your app users.

### Sensitive permissions (your app)

Declare in listing / permissions declaration:

- **Notifications** — daily check-in reminders  
- **Exact alarms** — scheduled reminder times on Android 12+  

Explain in Data safety / permission rationale: *“Optional daily reminders for group challenge check-ins.”*

---

## E. Testing track (recommended path)

1. **Closed testing** — upload AAB, add tester emails, share opt-in link  
2. Fix issues from testers  
3. **Production** — promote release or upload new AAB with higher `versionCode`

---

## F. Files in this folder

| File | Use |
|------|-----|
| `icon-512.png` | Play Store high-res icon |
| `feature-graphic-1024x500.png` | Store listing banner |
| `listing-copy.txt` | Paste short + full description |
| `privacy-policy.html` | Host on your website; use URL in Play Console |

---

## G. Optional improvements later

- Replace default Android robot **launcher icon** in `android/app/src/main/res/` with branded icon (match `icon-512.png`)  
- Promo video (YouTube URL)  
- Localized listings (other languages)  
- `play-store/screenshots/phone/` — add your captures before upload  

---

## Quick upload order

1. Host privacy policy → get URL  
2. Complete **Data safety**, **Content rating**, **Target audience**  
3. Upload **icon**, **feature graphic**, **screenshots**, **descriptions**  
4. Upload **AAB** to Closed testing → add testers → rollout  
