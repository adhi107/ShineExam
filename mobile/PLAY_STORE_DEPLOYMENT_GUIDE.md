# Google Play Store Publishing & White-Label Release Guide

This document provides step-by-step instructions to sign, generate, and publish the **Victory Study Circle Android App Bundle (.aab)** to Google Play Console, and release branded white-label applications.

---

## 1. Production Keystore Generation

Generate an upload keystore for production signing:

```bash
keytool -genkeypair -v -keystore victory-release-key.keystore -alias victory-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Store the resulting `victory-release-key.keystore` securely (e.g. in your CI/CD secrets manager). **Never commit the `.keystore` or passwords to public Git repositories.**

---

## 2. Release Signing Configuration

In `mobile/android/gradle.properties` (or as environment variables in CI/CD):

```properties
VICTORY_RELEASE_STORE_FILE=../victory-release-key.keystore
VICTORY_RELEASE_STORE_PASSWORD=your_store_password
VICTORY_RELEASE_KEY_ALIAS=victory-key-alias
VICTORY_RELEASE_KEY_PASSWORD=your_key_password
```

---

## 3. Building Production App Bundles (.aab)

From the `mobile/` directory, run:

```bash
# 1. Build Generic Victory Study Circle Portal
npm run bundle:generic:release

# 2. Build ABC Academy Branded Application
npm run bundle:abc:release

# 3. Build XYZ Institute Branded Application
npm run bundle:xyz:release
```

**Output Locations**:
- Generic: `mobile/android/app/build/outputs/bundle/genericRelease/app-generic-release.aab`
- ABC Academy: `mobile/android/app/build/outputs/bundle/abcRelease/app-abc-release.aab`
- XYZ Institute: `mobile/android/app/build/outputs/bundle/xyzRelease/app-xyz-release.aab`

---

## 4. Google Play Console Data Safety Declarations

When completing the **Data Safety** section on Google Play Console, declare the following:

| Category | Data Type | Collected? | Shared? | Purpose | Ephemeral? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Personal Info** | Name, User ID, Email address | Yes | No | Account management, authentication, candidate identification | No |
| **App Activity** | Examination answers, submitted scores, attempt timestamps | Yes | No | Exam evaluation, fraud prevention, student progress analytics | No |
| **Security & Audits** | Screenshot violation logs, screen recording alerts | Yes | No | Anti-cheat security, account integrity | No |
| **Device or other IDs** | Session tokens | Yes | No | Security watermark embedding and verification | Yes |

*All data is encrypted in transit over HTTPS.*

---

## 5. App Permissions Summary

The application declares only strictly necessary permissions in `AndroidManifest.xml`:
- `android.permission.INTERNET`: Required to communicate with the HTTPS Flask API.
- `android.permission.ACCESS_NETWORK_STATE`: Used to detect network connectivity and trigger offline answer sync.

---

## 6. White-Label Organization Onboarding Checklist

When adding a new institutional client (e.g. `Victory Study Circle`):

1. **Backend**: Provision organization record in MongoDB `db.organizations` with `tenantId: "victory"`.
2. **Brand Config**: Create `mobile/brands/victory.json`.
3. **Flavor**: Add `victory` flavor in `mobile/android/app/build.gradle`.
4. **Icons**: Place branded launcher icons in `mobile/android/app/src/victory/res/mipmap-*/`.
5. **Build**: Run `cd mobile/android && ./gradlew bundleVictoryRelease`.
6. **Publish**: Upload the generated `.aab` to Victory Study Circle's Google Play Console account.
