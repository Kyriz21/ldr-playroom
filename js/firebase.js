// LDR Playroom by DiRi — Firebase connection (Web SDK, modular CDN).
// Firebase web config is public by design. Protect your database with Realtime Database Rules.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  update,
  remove,
  runTransaction,
  onValue,
  onDisconnect,
} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5zJsxfpw1CigEC7JW4US2OX75panKW3w',
  authDomain: 'ldr-playroom.firebaseapp.com',
  databaseURL: 'PASTE_YOUR_REALTIME_DATABASE_URL_HERE',
  projectId: 'ldr-playroom',
  storageBucket: 'ldr-playroom.firebasestorage.app',
  messagingSenderId: '463949725675',
  appId: '1:463949725675:web:b75d2b1a5cd81d9d9ea3ae',
  measurementId: 'G-RPDX3Y7V7S',
};

if (!firebaseConfig.databaseURL || firebaseConfig.databaseURL.includes('PASTE_')) {
  console.warn('[LDR Playroom] Isi databaseURL di js/firebase.js dengan URL Realtime Database dari Firebase Console.');
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes('PASTE_')
  ? getDatabase(app, firebaseConfig.databaseURL)
  : null;

function requireDatabase() {
  if (!db) {
    throw new Error('Database URL belum diisi. Buka js/firebase.js dan tempel URL Realtime Database milikmu.');
  }
  return db;
}

/** Wait for an existing anonymous session, or create one on this browser. */
export async function ensureAnonymousUser() {
  const existingUser = await new Promise((resolve) => {
    let unsubscribe = () => {};
    unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    }, () => resolve(null));
  });

  if (existingUser) return existingUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomValues = new Uint8Array(6);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('');
}

/** Create a unique room and add its host as player one. */
export async function createRoom({ name, user }) {
  const database = requireDatabase();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeRoomCode();
    const now = Date.now();
    const roomRef = ref(database, `rooms/${code}`);
    const initialRoom = {
      hostUid: user.uid,
      createdAt: now,
      players: {
        [user.uid]: {
          name,
          joinedAt: now,
          online: true,
          lastSeen: now,
        },
      },
      activeGame: null,
    };

    const result = await runTransaction(
      roomRef,
      (currentRoom) => (currentRoom === null ? initialRoom : undefined),
      { applyLocally: false },
    );

    if (result.committed) return code;
  }

  throw new Error('Belum berhasil membuat kode room. Silakan coba sekali lagi.');
}

/** Join a room using its six-character code. The room is limited to two players. */
export async function joinRoom({ code, name, user }) {
  const database = requireDatabase();
  const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const roomRef = ref(database, `rooms/${normalizedCode}`);
  const roomSnapshot = await get(roomRef);

  if (!roomSnapshot.exists()) {
    throw new Error('Room tidak ditemukan. Periksa kembali kode yang diberikan pasanganmu.');
  }

  const playersRef = ref(database, `rooms/${normalizedCode}/players`);
  const now = Date.now();
  const result = await runTransaction(
    playersRef,
    (currentPlayers) => {
      const players = currentPlayers || {};
      const alreadyJoined = Boolean(players[user.uid]);
      if (!alreadyJoined && Object.keys(players).length >= 2) return undefined;

      return {
        ...players,
        [user.uid]: {
          ...(players[user.uid] || {}),
          name,
          joinedAt: players[user.uid]?.joinedAt || now,
          online: true,
          lastSeen: now,
        },
      };
    },
    { applyLocally: false },
  );

  if (!result.committed) {
    const latestRoom = await get(roomRef);
    if (!latestRoom.exists()) {
      throw new Error('Room sudah tidak tersedia. Minta pasanganmu membuat room baru.');
    }
    throw new Error('Room sudah penuh. Satu room hanya bisa diisi dua pemain.');
  }

  return normalizedCode;
}

/** Watch room data so both players see changes immediately. */
export function watchRoom(code, callback, onError) {
  return onValue(
    ref(requireDatabase(), `rooms/${code}`),
    (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
    onError,
  );
}

/** Keep a player's online flag in sync with the Firebase connection. */
export function startPresence(code, user) {
  const database = requireDatabase();
  const playerRef = ref(database, `rooms/${code}/players/${user.uid}`);
  const connectionRef = ref(database, '.info/connected');

  const unsubscribe = onValue(connectionRef, async (snapshot) => {
    if (snapshot.val() !== true) return;

    try {
      await onDisconnect(playerRef).update({
        online: false,
        lastSeen: Date.now(),
      });
      await update(playerRef, {
        online: true,
        lastSeen: Date.now(),
      });
    } catch (error) {
      console.error('[LDR Playroom] Presence update failed:', error);
    }
  });

  return async () => {
    unsubscribe();
    try {
      await onDisconnect(playerRef).cancel();
    } catch (error) {
      console.warn('[LDR Playroom] Could not cancel onDisconnect:', error);
    }
  };
}

/** The host closes the room; the guest only removes their own player entry. */
export async function leaveRoom({ code, user }) {
  const database = requireDatabase();
  const roomRef = ref(database, `rooms/${code}`);
  const roomSnapshot = await get(roomRef);
  if (!roomSnapshot.exists()) return;

  const room = roomSnapshot.val();
  if (room.hostUid === user.uid) {
    await remove(roomRef);
  } else {
    await remove(ref(database, `rooms/${code}/players/${user.uid}`));
  }
}
