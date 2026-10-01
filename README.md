# cultured — culture first. Chemistry always.

A dark, mobile-native social and dating app built with Expo Router and React Native for iOS and Android. Cultured starts with the things people already share—music taste, humor, playlists and small cultural references—so meeting someone can feel more like finding your people than sorting through profiles.

## Get started

```bash
npm install
npx expo start
```

Use Expo Go where the current SDK is supported, or build a native development client for device-specific features. With a configured simulator/emulator, run `npm run ios` or `npm run android`; run `npm run web` for the React Native Web fallback.

## Quality checks

```bash
npm run typecheck
npx --yes expo-doctor
npm run export:ios
npm run export:android
```

The export commands verify platform-specific JavaScript bundles. Creating signed `.ipa`/`.aab` release artifacts still requires Apple/Google developer accounts and signing credentials; EAS build profiles are provided in `eas.json`. GitHub Actions runs TypeScript, Expo Doctor and both platform exports for PRs and pushes to `main`.

## Product experience

- **Culture Feed:** a culture-only feed with a daily music + meme drop, separate Like and Laugh reactions, locally persisted comments/saves, animated previews, pull-to-refresh and native share sheets.
- **Match Matrix:** an independent one-person-at-a-time Taste Twins flow with shared culture, an optional humor/Fingerprint sheet, a Dating/Friends switch, haptic pass/Resonate controls, native swipe gestures, a rewind that reverses the last decision, and a considered end-of-queue state.
- **People & chat:** a conversation inbox with unread states, shared match context, starter prompts and a persistent message composer; plus an interactive 15-minute co-listening session with timestamped emoji moments. The session timer ends the shared session, **not** access to chat.
- **Cultural Fingerprint:** editable name and bio; humor signals; artists, playlists, saved culture and prompts; a visibility control; a share sheet; and a native local photo-library gallery for photos the user chooses.
- **Settings & Activity:** discovery radius and intent, anti-genre choices, independent session/quiet-hour controls, location and Fingerprint visibility preferences, reduced motion, activity preference, dismissible activity, and an explicit local-data reset.
- **Onboarding:** an 18+ confirmation, a Dating/Friends choice and editable starter-taste choices.

## Native UI, components and motion

This is an actual **React Native / Expo** app, not a browser site wrapped in a mobile view. Interactions use native `Pressable`, `Animated`, `PanResponder`, Expo Haptics, safe-area insets, native modals, the system share sheet and native photo selection. The original **ThreeUI** site/package targets web DOM and WebGL rather than React Native; using its browser components inside the iOS/Android app would add the wrong rendering stack, so the segmented switch, swipe card, waveform, dialogs and motion interactions are purpose-built with native components. The in-app reduced-motion setting shortens or removes transitions and pauses waveform animation.

Official references: [Expo Router tabs](https://docs.expo.dev/router/advanced/tabs/), [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), and [Expo ImagePicker](https://docs.expo.dev/versions/latest/sdk/imagepicker/).

## Data and launch integrations

The app is designed as a rich native front end; the repository did not include a backend, OAuth clients, API credentials or a connected music service. In this implementation, onboarding preferences, discovery decisions, reactions, comments, local chat messages, profile details/photos and settings persist **on this device** through AsyncStorage. Sample people, activity, compatibility signals and posts are illustrative local fixtures. The music waveform is an interactive visual preview; licensed audio playback, shared-device synchronization and account linking are not configured.

A market release still needs product-approved API/authentication, server-side identity and age verification, moderation/report/block tools, real match/feed data, realtime chat, music-provider OAuth/licensing, secure media upload/storage, push notifications, privacy/retention controls, analytics and operational support. The UI does not claim those services are live.

## Security note

At this lockfile, `npm audit` reports **14 moderate, zero high and zero critical** findings in the Expo 57 dependency tree, including transitive Expo CLI/config packages and the Router query-string dependency. The automated `npm audit fix` proposals downgrade core packages across Expo SDK major versions, so they were not applied blindly. Re-check the advisories and upgrade along a compatible patched Expo SDK before a public release.

## Photo-asset provenance

The portraits in `assets/images/` are illustrative photo-search assets and are not Cultured members or endorsements. The Fingerprint gallery displays only photo URIs a device owner chooses locally; the sample candidate/feed portraits remain fixtures. Review the individual image rights and model releases and replace any unverified stock imagery with approved launch assets before public release. See [`ASSET-CREDITS.md`](./ASSET-CREDITS.md).
