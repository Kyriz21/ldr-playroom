# LDR Playroom by DiRi

A romantic, responsive online date-night space for two people in a long-distance relationship. The website brings together an eight-game catalogue, a shared-room entry point, and an original photobooth concept preview. The project is credited to **DiRi**.

## Visual direction

The refreshed interface uses a warm editorial layout, a two-person photo-strip motif, soft paper-like surfaces, pastel rose/lilac accents, and a clear activity catalogue. It is informed by broad product patterns from online couple photobooth experiences: shared rooms, separate cameras, synchronized readiness, a coordinated countdown, and a keepsake strip. The implementation, interface copy, CSS artwork, and branding in this repository are original to LDR Playroom by DiRi. No Angie logo, source code, photographs, artwork, or website copy are reused.

## Current features

- Responsive landing page with mobile navigation.
- Eight activity cards: Tic Tac Toe, Love Quiz, This or That, Truth or Dare, Memory Card, Connect Four, Draw & Guess, and Tebak Kata.
- Firebase Anonymous Authentication.
- Create a six-character room code and join using the code.
- Two-player room limit, live player list, and online/offline presence.
- Photobooth concept preview with an original CSS-drawn photo strip.
- DiRi attribution in page metadata, header, footer, and this documentation.

## Firebase setup

### 1. Set the Realtime Database URL

Open `js/firebase.js` and replace:

```js
databaseURL: 'PASTE_YOUR_REALTIME_DATABASE_URL_HERE',
```

with the exact Database URL shown at Firebase Console → Build → Realtime Database. Do not guess the region or URL.

### 2. Enable Anonymous Authentication

Firebase Console → Build → Authentication → Sign-in method → Anonymous → Enable.

### 3. Set Realtime Database Rules

Open Firebase Console → Build → Realtime Database → Rules. Replace the rules with the contents of `firebase-database.rules.json`, then click Publish.

These rules require an authenticated user (the app signs players in anonymously), limit a room to two players, and validate basic player fields. Room codes are random six-character codes; do not store sensitive information in room records.

### 4. Publish to GitHub Pages

Upload the updated project contents to the repository root and commit the changes. GitHub Pages will publish the updated site automatically.

## Project structure

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

## Development status

- Room creation, joining, player list, and presence use Firebase once a real `databaseURL` and the database rules are configured.
- The eight game cards are catalogue placeholders. Game logic and shared game state will be implemented in later stages.
- The photobooth is a visual concept preview only. Camera access, synchronized capture, editing, and photo downloads have not been implemented yet.

## Copyright & third-party services

© 2026 DiRi. All rights reserved. See [`COPYRIGHT.md`](COPYRIGHT.md) for project attribution and third-party service notes.

Never commit Firebase Admin SDK service-account files or private credentials. Firebase web configuration is client-side by design; protect the project with Authentication and database rules.
