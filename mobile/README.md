# 📱 Victory Study Circle Android Mobile Application

A production-ready, white-label multi-tenant React Native Android application for the Victory Study Circle Platform, engineered for direct publication on the Google Play Store.

## 🚀 Key Features

- **Single Codebase, Multiple Institutional Apps**: One React Native project (`mobile/`) builds both the standard multi-tenant Victory Study Circle client and dedicated single-tenant branded apps (*ABC Academy*, *XYZ Institute*, etc.) via Android Gradle product flavors.
- **Hardware-Level `FLAG_SECURE` Shield**: Native module automatically prevents screenshots, screen recording, and task-switcher previews during exams, reports, documents, and video lectures.
- **TCS iON Examination Engine**: Live countdown timer with wall-clock delta calculation on app resume, section navigation, question palette with real-time status badges, offline answer queue, and back button interception.
- **Dynamic Organization Branding**: Generic build dynamically queries `GET /api/auth/tenant-branding` upon candidate login to customize logos, colors, and features at runtime.
- **Partitioned Local Storage**: Multi-tenant key partitioning preventing cross-tenant cached data collisions.

---

## 🛠️ Quick Start

### 1. Install Dependencies
```bash
cd mobile
npm install
```

### 2. Run on Android Emulator / Physical Device
```bash
# Start Metro bundler
npm start

# Run the generic Victory Study Circle flavor on connected device / emulator
npm run android
```

> **API Endpoint Config**: Configured in [`src/api/client.ts`](file:///d:/Adhi/Shine/Shine-Exam/mobile/src/api/client.ts). Default is `http://10.0.2.2:5000/api` for standard Android emulators.

---

## 📦 Building Production Android App Bundles (.aab)

```bash
# 1. Victory Study Circle (Generic Multi-Tenant Build)
npm run bundle:generic:release

# 2. ABC Academy (White-Label Branded Build)
npm run bundle:abc:release

# 3. XYZ Institute (White-Label Branded Build)
npm run bundle:xyz:release
```

All production `.aab` bundles are output to:
`android/app/build/outputs/bundle/<flavor>Release/app-<flavor>-release.aab`

For keystore setup, ProGuard verification, and Google Play Console release instructions, refer to [`PLAY_STORE_DEPLOYMENT_GUIDE.md`](file:///d:/Adhi/Shine/Shine-Exam/mobile/PLAY_STORE_DEPLOYMENT_GUIDE.md).
