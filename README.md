# LDR Playroom

A romantic, responsive mini-game hub for two people in a long-distance relationship.

## Stage 1 — Website foundation

Included in this starter:
- Responsive landing page for desktop and mobile.
- Romantic visual theme and custom CSS illustration.
- Game catalogue for the eight planned games.
- Create-room and join-room interface previews.
- Mobile navigation, dialog interactions, and toast notifications.
- No framework or build step required.

**Important:** This stage is a front-end foundation only. Room creation, room joining, player presence, and game synchronization are not connected yet. The forms intentionally show a preview notice instead of pretending to create a real online room. Firebase Realtime Database will be integrated in a later stage.

## Project structure

```text
ldr-playroom/
├── index.html
├── README.md
├── .nojekyll
├── assets/
│   └── favicon.svg
├── css/
│   └── styles.css
└── js/
    └── app.js
```

## Run locally

1. Download and extract the ZIP.
2. Open `index.html` in a modern browser.
3. For a local development server, open this folder in VS Code and use the Live Server extension, or run `python -m http.server 8000` from this folder and visit `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a new GitHub repository named `ldr-playroom`.
2. Upload the **contents** of this folder to the repository root (so `index.html` is at the top level).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose branch `main` and folder `/(root)`, then save.
6. Wait for the Pages deployment to finish. The published URL will appear in the Pages settings.

GitHub Pages publishes this static front end. Do not put private keys, passwords, or sensitive personal information in this public repository.

## Next development stages

1. Firebase project setup and Realtime Database rules.
2. Create/join room, unique room code, and two-player presence.
3. Shared game state and turn synchronization.
4. Implement the eight games one by one.
