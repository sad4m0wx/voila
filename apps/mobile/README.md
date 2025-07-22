# Voila Mobile App

## Overview
Voila is a cross-platform mobile app (React Native + Expo) for finding optimal meeting points with friends, managing groups, and sharing locations. It features onboarding, authentication, group management, and map-based meeting point calculation.

---

## Architecture

### State Management
- **React Context + Reducers**: Used for authentication (`AuthContext`), groups (`GroupsContext`), group members, attendance, and meeting points.
- **Providers**: All major contexts are composed in `AppProviders.js` for global state.

### Navigation
- **expo-router**: File-based routing for screens and tabs.
- **Stack & Tabs**: Main navigation is a stack with a tab navigator for Home and Groups.

### Providers & Contexts
- `AuthProvider`: Handles user state, onboarding, and phone verification.
- `GroupsCompositeProvider`: Composes group, member, and attendance contexts.
- `MeetingPointProvider`: Manages meeting point calculations and caching.

### Directory Structure (Key Parts)
- `app/`: Screens and navigation layouts.
- `lib/components/`: UI components (auth, meeting, maps, core, utils).
- `lib/contexts/`: Context providers for state management.
- `lib/services/`: API and business logic (Supabase, maps, groups, sharing).
- `lib/utils/`: Utility functions (platform, phone, loading, etc).

---

## Features

### Authentication & Onboarding
- **Phone-based Auth**: Enter phone, receive code, verify.
- **Onboarding Steps**: Name, address, contacts, then access to full app.
- **Profile Management**: Edit name, addresses, and contacts.

### Home/Meeting Point Finder
- **Address Input**: Enter up to 4 addresses to find a meeting point.
- **Optimal Meeting Point**: Calculates best location for all participants.
- **Map Display**: Shows meeting point, routes.
- **Share Meeting Point**: Shareable links for others to join/see. 

### Groups
- **Create Groups**: Add friends by phone or custom locations.
- **Group Meeting Points**: Find best spot for all group members.
- **Attendance Tracking**: RSVP to group meetings.
- **Group Settings**: Edit group info, manage members.

### Maps & Venues
- **Google Maps Integration**: Map display, directions, and venue search.
- **Venue Types**: Filter by type (e.g., restaurant).
- **Open in Maps**: Launch directions in native map apps.

### Profile & Addresses
- **Manage Addresses**: Add, edit, delete, and set default addresses.
- **Contacts Sync**: Import friends from device contacts (with permission).

---

## How to Test

### Manual Testing
1. **Authentication**: Launch app, enter phone, verify code, complete onboarding.
2. **Meeting Point**: Enter addresses, calculate, view map/results, try sharing.
3. **Groups**: Create a group, add members, calculate group meeting point, RSVP.
4. **Profile**: Edit name, add/remove addresses, sync contacts.
5. **Maps**: Check map loads, venues display, open directions in external app.
6. **Error Handling**: Try invalid codes, network loss, max addresses, etc.

### Device/Emulator Testing
- **iOS**: `expo run:ios` (requires Xcode)
- **Android**: `expo run:android` (requires Android Studio/AVD)
- **Web**: `expo start --web`
- **Development Client**: Use Expo Go or custom dev client for native modules.

### Linting & Code Quality
- Run `npm run lint` to check for code style and errors.

### Automated Testing
- **Note**: No automated test files found. Add tests for critical logic as needed.

---

## Configuration

### Environment Variables
- **Google Maps API Key**: Set in `app.config.js` and `app.json` for both iOS and Android.
- **Supabase**: Configure in `lib/config.js`.

### Platform-specific Setup
- **iOS**: Configure permissions in `ios/Voila/Info.plist` (location, contacts).
- **Android**: Permissions in `android/app/src/main/AndroidManifest.xml`.

---

## Development Scripts
- `npm start` — Start Expo dev server
- `npm run android` — Run on Android device/emulator
- `npm run ios` — Run on iOS simulator
- `npm run web` — Run in web browser
- `npm run lint` — Lint code

---

## Contributing
- Fork, branch, and submit PRs.
- Follow code style and add documentation for new features.

## License
[MIT](../LICENSE) (or specify your license)
