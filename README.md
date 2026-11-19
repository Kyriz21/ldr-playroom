# DiRi / LDR Playroom — Fresh Restart

A mobile-first static web app for two-player LDR rooms. Hosted on GitHub Pages and powered by Firebase Authentication (Anonymous) + Realtime Database.

## What is included

- Responsive landing page, room modal, room lobby, and game-preview screen.
- Layout adapts to phones, small phones, tablets, and desktop.
- Firebase anonymous authentication.
- Create room with a six-character code.
- Join room by code, with a two-player limit.
- Realtime player list and online/offline presence.
- Host can close the room; guest can leave the room.
- DiRi identity and copyright attribution.

**Important:** The eight game cards are currently previews. The real-time room foundation is the first stage. Game rules and turn synchronization will be added one game at a time after the room flow is verified.

## 1. Firebase: keep the current project

The included `js/firebase.js` already points to the Firebase web app previously registered for this project:

- Project ID: `ldr-playroom`
- Realtime Database: `https://ldr-playroom-default-rtdb.asia-southeast1.firebasedatabase.app`
- Region: Singapore (`asia-southeast1`)

You do **not** need to delete the Firebase project, web app registration, or anonymous authentication provider. We recommend resetting only the old room data and replacing the Realtime Database Rules.

### 1A. Back up old data (optional)

In Firebase Console → Realtime Database → Data, select the `rooms` node and export JSON if you want to keep a backup. Firebase documents exporting the selected node and its children here: https://firebase.google.com/docs/database/manage-data-console

### 1B. Clear old room data

In the Data tab, open the context menu (three dots) for the top-level `rooms` node and choose the delete/remove action for that selected node. Confirm only if the selected node is `rooms`.

This removes the old room records (`ET9EH9`, `QKBZNE`, `G2VDBP`, etc.) but leaves the Firebase project, web app, Anonymous Authentication, and Realtime Database instance in place.

If the console layout does not show a delete option for the selected node, do not delete the entire database or project. Send a screenshot of the Data tab and use the Firebase Console's data editor to remove the `rooms` node only.

### 1C. Replace Realtime Database Rules

1. Open Firebase Console → Realtime Database → Rules.
2. Select all existing JSON and replace it with the full contents of `firebase-database.rules.json`.
3. Click **Publish**.
4. Confirm the console shows no validation error.

**Important rule detail:** The file intentionally does not define `.read: false` or `.write: false` at the database root. A root-level false rule overrides deeper child rules in Realtime Database. Unspecified paths are denied by default; the app's room rules grant narrowly scoped access under `/rooms/{roomCode}` only.

### 1D. Confirm Anonymous Authentication

Firebase Console → Authentication → Sign-in method → Anonymous must be enabled. Do not remove the web app registration.

For a separate click-by-click reset checklist, see [`RESET-FIREBASE.md`](RESET-FIREBASE.md).

## 2. Upload to GitHub

Upload the **contents** of this folder to the root of the existing `ldr-playroom` repository, replacing the old files:

```text
ldr-playroom/
├── index.html
├── README.md
├── COPYRIGHT.md
├── firebase-database.rules.json
├── .nojekyll
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
└── js/
    ├── app.js
    └── firebase.js
```

Do not upload the outer `ldr-playroom-restart` folder itself. `index.html` must be at the repository root.

Then open GitHub → Settings → Pages → Deploy from a branch → `main` → `/(root)` → Save.

## 3. Test the room flow

1. Open the GitHub Pages site in browser/device A.
2. Create a room and keep the code visible.
3. Open the site in browser/device B (a normal second browser or phone is fine; Incognito can also be used).
4. Join with the exact code.
5. Both devices should see both player names in the room lobby.
6. Try closing/leaving the room and repeat once to verify cleanup.

The Firebase Auth anonymous UID is stored by Firebase in that browser profile. Avoid clearing browser site data during the test unless you intentionally want a new anonymous identity.

## 4. If you truly want to delete Firebase

### Recommended: reset the data only

Use Sections 1A–1C above. This is enough to restart the LDR Playroom backend safely.

### Delete the whole Firebase/Google Cloud project (last resort)

This is **not recommended** for the current restart. Deleting the project disables all Firebase services and Google Cloud services/APIs in that project, removes access to the web app, database, and Authentication, and stops billing/traffic. Project owners may restore it within 30 days according to Firebase Help.

If you still intend to do it:

1. Open Firebase Console and select `ldr-playroom`.
2. Open Project settings (gear) → General.
3. Scroll to the bottom and click **Delete project**.
4. Read every effect, tick the acknowledgement boxes, and confirm only if you intend to delete the entire project.
5. You would then need to create a new Firebase project, register a new Web App, create a Realtime Database, enable Anonymous Authentication, and replace every value in `js/firebase.js` with the new web config and database URL.

Official steps: https://support.google.com/firebase/answer/9137886?hl=en

The default Realtime Database instance should not be separately deleted as part of this restart. The database management API states that the default database cannot be deleted through that API; deleting a non-default instance also requires disabling it first and deleted IDs cannot be reused. For this project, deleting the old `/rooms` data is the correct reset.

## 5. Troubleshooting

- `permission-denied`: confirm the new Rules were Published and the latest `js/firebase.js` + `js/app.js` were uploaded together.
- `auth/operation-not-allowed`: enable Anonymous in Firebase Authentication.
- `room-not-found`: compare the exact six-character code and check the `rooms` node in Firebase Data.
- Blank JS/module error: ensure GitHub Pages serves the repository root and `index.html` is at that root.

## Copyright

© 2026 DiRi. All rights reserved for original DiRi / LDR Playroom project code, copy, and visual design. Third-party services, fonts, and SDKs remain under their respective licenses and terms.
