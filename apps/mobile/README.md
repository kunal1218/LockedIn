# LockedIn Mobile (Expo)

React Native app for LockedIn, built to use the same API endpoints/actions as `apps/web`.

## Run in Expo Go

From repo root:

```bash
npm run dev:mobile
```

Then scan the QR code in Expo Go.

## API base URL

Default is production Railway (same backend as web):

```bash
EXPO_PUBLIC_API_BASE_URL=https://api-production-ccb1.up.railway.app
EXPO_PUBLIC_WEB_APP_URL=https://quadblitz.com
```

Override only if needed (for local API work):

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:4001 EXPO_PUBLIC_WEB_APP_URL=http://192.168.1.42:3000 npm run dev:mobile
```
