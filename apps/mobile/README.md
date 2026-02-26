# LockedIn Mobile (Expo)

React Native app for LockedIn, built to use the same API endpoints/actions as `apps/web`.

## Run in Expo Go

From repo root:

```bash
npm run dev:mobile
```

Then scan the QR code in Expo Go.

## API base URL

Set this env var so your phone can reach the API server:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<YOUR-LAN-IP>:4001
```

Example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:4001 npm run dev:mobile
```

If not set, the app falls back to the current dev host (`:4001`) and then `http://localhost:4001`.
