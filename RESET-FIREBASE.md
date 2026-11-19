# Reset Firebase for the DiRi / LDR Playroom restart

## Recommended reset — keep the Firebase project

Do **not** delete the whole `ldr-playroom` project. The current Web App and Anonymous Authentication setup can be reused.

1. In Firebase Console, choose project `ldr-playroom`.
2. Open Build → Realtime Database → Data.
3. If you want a backup, select the `rooms` node and export it first.
4. Open the context menu for the `rooms` node and delete only that selected path. Confirm the visible selection is `/rooms`, not the database root.
5. Open Realtime Database → Rules.
6. Replace every existing rule with the entire contents of `firebase-database.rules.json` in this package.
7. Click Publish. The Rules editor must show that the rules were saved without an error.
8. Open Authentication → Sign-in method and verify Anonymous is enabled. Leave it enabled.
9. Do not remove the registered Web App.

### Why the new Rules file is different

The new file deliberately has no root-level `.read: false` or `.write: false`. In Realtime Database, parent rules cascade and a root-level deny cannot be overridden by a child rule. The new file leaves unspecified paths denied by default, then defines limited access only under `/rooms/{roomCode}`.

## Browser cleanup before testing

1. Close all tabs that have the old LDR Playroom website open.
2. Open the newly deployed GitHub Pages site with a hard refresh (`Ctrl + Shift + R`).
3. Use the desktop browser as Player 1 and a phone browser as Player 2. They should be separate browser profiles/devices so they get different anonymous Firebase UIDs.
4. If an old session persists, use the browser's site settings to clear site data for the GitHub Pages domain, then reopen the site. This signs that browser out of its anonymous session; it does not delete the Firebase project.

## If you insist on deleting the entire Firebase project

This is a last resort and is not needed for the restart.

1. Firebase Console → select `ldr-playroom`.
2. Project settings (gear icon) → General.
3. Scroll to the bottom → Delete project.
4. Review the warnings and acknowledgement boxes. Confirm only if you want to delete the whole project.
5. You must then create a new Firebase project, register a new Web App, create Realtime Database, enable Anonymous Authentication, and replace the entire `firebaseConfig` object in `js/firebase.js` with the new values.

Deleting the project disables/removes access to its Firebase and Google Cloud services, including the database, Authentication, and registered apps. Firebase Help says project owners may restore a deleted project within 30 days: https://support.google.com/firebase/answer/9137886?hl=en

The current `ldr-playroom-default-rtdb` is the default Realtime Database instance. Do not try to delete the default database instance on its own; the database management API says the default instance cannot be deleted by that API. Clearing the `/rooms` node and replacing Rules is the appropriate reset for this project.
