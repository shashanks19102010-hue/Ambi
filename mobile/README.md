# Ambi Mobile

Expo React Native test client for the existing Ambi web application.

## What this does

- Keeps the existing Next.js website in place.
- Adds an independent Android/iOS client in `mobile/`.
- Calls the existing `/api/chat` endpoint over HTTPS.
- Stores only a generated installation identifier in Expo SecureStore.
- Does not contain Groq or other provider API keys.
- Uses restrictive Android permissions in the Expo config.

## Local setup

From the repository root:

```bash
cd mobile
npm install
cp .env.example .env.local
```

Set `EXPO_PUBLIC_AMBI_API_BASE_URL` in `.env.local` to the public HTTPS URL of the Ambi web deployment. Do not put any provider API key in this file.

Start Expo:

```bash
npm run start
```

## Android APK test build

Install and authenticate with EAS CLI:

```bash
npm install --global eas-cli
eas login
```

Then from `mobile/`:

```bash
eas build --platform android --profile preview
```

The `preview` profile is configured to produce an installable APK for direct device testing. Production builds use the Play Store-oriented AAB format unless an APK build type is explicitly selected.

## Security notes

A native mobile app cannot keep a provider secret secret once shipped to a user's device. Ambi therefore keeps provider credentials on the server. The mobile bundle contains only public configuration such as the API base URL.

The mobile client also:

- sends requests only to the configured HTTPS endpoint;
- limits message size before upload;
- ignores malformed server-sent-event frames instead of executing them;
- uses a request timeout;
- avoids dangerous device permissions;
- uses SecureStore for the installation identifier;
- avoids dynamic code execution and arbitrary downloaded scripts.

This is a security-focused baseline, not a guarantee that any app can never be attacked. The production release should additionally use dependency auditing, signed builds, server-side authentication, rate limiting, monitoring, and regular security updates.
